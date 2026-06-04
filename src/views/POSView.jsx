import { useState, useEffect, useRef } from "react";
import { useCart } from "../context/CartContext";
import { db } from "../firebase/config";
import { collection, getDocs, addDoc, serverTimestamp, query, where, onSnapshot, doc, updateDoc, increment, orderBy } from "firebase/firestore";
import { formatCurrency } from "../utils/formatters";
import { MapboxSearch } from "../components/MapboxSearch";
import { 
  ShoppingBag, Plus, Minus, X, ChevronRight, LogOut, Menu, Search, Volume2, VolumeX, Bell, CheckCircle, XCircle, Printer
} from "lucide-react";
import { logoutUser } from "../firebase/auth";
import { TicketTemplate } from "../components/TicketTemplate";

export const POSView = ({ user, onLogout, isEmbedded = false }) => {
  const {
    cart, addToCart, updateQuantity, clearCart,
    shippingCost, shippingDistance, serviceMode, setServiceMode,
    tableNumber, setTableNumber, customerName, setCustomerName,
    customerPhone, setCustomerPhone, customerAddress, setCustomerAddress,
    customerCoords,
    businessConfig, getTotals
  } = useCart();

  const [products, setProducts] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [optionsSelected, setOptionsSelected] = useState({});
  const [comboItemsSelected, setComboItemsSelected] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [activeMobileTab, setActiveMobileTab] = useState("menu");
  const [posSearch, setPosSearch] = useState("");

  const [pendingOrders, setPendingOrders] = useState([]);
  const [isApprovalTrayOpen, setIsApprovalTrayOpen] = useState(false);
  const [isAlertMuted, setIsAlertMuted] = useState(() => {
    return localStorage.getItem("pos_muted") === "true";
  });
  const isInitialPos = useRef(true);
  const isAlertMutedRef = useRef(isAlertMuted);

  // Estados para ticket de impresión
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState(null);
  const [printSize, setPrintSize] = useState("80mm");

  const triggerPrint = (order) => {
    setSelectedOrderForPrint(order);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  useEffect(() => {
    isAlertMutedRef.current = isAlertMuted;
    localStorage.setItem("pos_muted", isAlertMuted ? "true" : "false");
  }, [isAlertMuted]);

  const playPosNotification = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const playBeep = (time, frequency, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(frequency, time);
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.3, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(time);
        osc.stop(time + duration);
      };

      const now = ctx.currentTime;
      // Sonido de timbre de aviso: La5, Do6, Mi6
      playBeep(now, 880.00, 0.15);
      playBeep(now + 0.15, 1046.50, 0.15);
      playBeep(now + 0.3, 1318.51, 0.45);
    } catch (err) {
      console.warn("No se pudo reproducir el sonido en POS:", err);
    }
  };

  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      where("status", "==", "pending_approval")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ords = [];
      snapshot.forEach((doc) => {
        ords.push({ id: doc.id, ...doc.data() });
      });

      // Ordenar localmente por fecha de creación (de más nuevos a más viejos)
      ords.sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      });

      if (isInitialPos.current) {
        isInitialPos.current = false;
      } else {
        const newAdded = snapshot.docChanges().some(change => change.type === "added");
        if (newAdded && !isAlertMutedRef.current) {
          playPosNotification();
        }
      }
      setPendingOrders(ords);
    }, (error) => {
      console.error("Error al cargar pedidos por aprobar en POS:", error);
    });

    return () => unsubscribe();
  }, []);

  const handleApproveOrder = async (orderId) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: "preparing",
        approvedAt: serverTimestamp(),
        approvedBy: user.uid
      });
      // Imprimir ticket automáticamente al aprobar
      const approvedOrder = pendingOrders.find(o => o.id === orderId);
      if (approvedOrder) {
        const orderForPrint = {
          ...approvedOrder,
          authorizedAt: { seconds: Math.floor(Date.now() / 1000) }
        };
        triggerPrint(orderForPrint);
      }
    } catch (err) {
      console.error("Error al aprobar orden:", err);
      alert("Error al aprobar la orden.");
    }
  };

  const handleRejectOrder = async (orderId) => {
    if (!window.confirm("¿Estás seguro de que deseas rechazar este pedido?")) return;
    try {
      const orderRef = doc(db, "orders", orderId);
      const orderToReject = pendingOrders.find(o => o.id === orderId);
      await updateDoc(orderRef, {
        status: "rejected",
        rejectedAt: serverTimestamp(),
        rejectedBy: user.uid
      });

      // Restaurar stock
      if (orderToReject && orderToReject.items) {
        for (const item of orderToReject.items) {
          const prodRef = doc(db, "products", item.id);
          await updateDoc(prodRef, {
            stock: increment(item.quantity)
          });
        }
      }
    } catch (err) {
      console.error("Error al rechazar orden:", err);
      alert("Error al rechazar la orden.");
    }
  };

  // Cargar catálogo de productos
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const prods = [];
        querySnapshot.forEach((doc) => {
          prods.push({ id: doc.id, ...doc.data() });
        });
        setProducts(prods);
      } catch (error) {
        console.error("Error al cargar productos en POS:", error);
      }
    };
    fetchProducts();
  }, []);

  // Cargar categorías de Firestore
  useEffect(() => {
    const q = query(collection(db, "categories"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = [];
      snapshot.forEach((doc) => {
        cats.push({ id: doc.id, ...doc.data() });
      });
      setCategoriesList(cats);
    });
    return () => unsubscribe();
  }, []);

  const categoriesListToUse = categoriesList.length > 0 ? categoriesList : [
    { id: "pizzas", name: "Pizzas" },
    { id: "combos", name: "Combos" },
    { id: "bebidas", name: "Bebidas" },
    { id: "entradas", name: "Entradas" }
  ];

  const categories = [{ id: "all", name: "Todos" }, ...categoriesListToUse];

  const filteredProducts = products.filter((p) => {
    const matchesCategory = activeCategory === "all" || p.category === activeCategory;
    const searchLower = posSearch.toLowerCase();
    const matchesSearch = 
      p.name?.toLowerCase().includes(searchLower) ||
      p.description?.toLowerCase().includes(searchLower) ||
      p.id?.toLowerCase().includes(searchLower);
    return matchesCategory && matchesSearch;
  });

  const handleOpenCustomize = (product) => {
    if (product.stock !== undefined && product.stock <= 0) {
      alert("Lo sentimos, este producto está agotado por el momento.");
      return;
    }
    setSelectedProduct(product);
    setQuantity(1);
    
    const initialOpts = {};
    if (product.options) {
      Object.entries(product.options).forEach(([groupName, values]) => {
        initialOpts[groupName] = values[0];
      });
    }
    setOptionsSelected(initialOpts);

    if (product.comboItems) {
      setComboItemsSelected(Array(product.comboItems.length).fill(""));
    } else {
      setComboItemsSelected([]);
    }
  };

  const handleOptionChange = (groupName, value) => {
    setOptionsSelected((prev) => ({ ...prev, [groupName]: value }));
  };

  const handleComboItemChange = (index, value) => {
    setComboItemsSelected((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  const handleAddToCart = () => {
    if (selectedProduct.comboItems) {
      const incomplete = comboItemsSelected.some((item) => item === "");
      if (incomplete) {
        alert("Completa todos los ítems del combo.");
        return;
      }
    }
    const existingCartItem = cart.find(item => item.id === selectedProduct.id);
    const currentQtyInCart = existingCartItem ? existingCartItem.quantity : 0;
    if (selectedProduct.stock !== undefined && selectedProduct.stock < (currentQtyInCart + quantity)) {
      alert(`Lo sentimos, el stock disponible es de ${selectedProduct.stock} unidades. Ya tienes ${currentQtyInCart} en tu carrito.`);
      return;
    }
    addToCart(selectedProduct, quantity, optionsSelected, comboItemsSelected);
    setSelectedProduct(null);
  };

  const handleLogoutClick = async () => {
    await logoutUser();
    onLogout();
  };

  const handleSaveOrder = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (!customerName || !customerPhone) {
      alert("Ingresa el Nombre y Teléfono del cliente.");
      return;
    }

    if (serviceMode === "delivery" && (!customerAddress || !customerCoords)) {
      alert("Por favor selecciona una dirección de delivery válida de la lista de sugerencias o usa el GPS.");
      return;
    }

    if (serviceMode === "dinein" && !tableNumber) {
      alert("Selecciona la mesa asignada.");
      return;
    }

    setLoading(true);
    try {
      const totals = getTotals();
      const orderNumber = Math.floor(1000 + Math.random() * 9000).toString();

      const orderData = {
        orderNumber,
        status: "pending_approval",
        createdBy: user.uid,
        customerName,
        customerPhone,
        customerAddress: serviceMode === "delivery" ? customerAddress : "",
        customerCoords: serviceMode === "delivery" ? customerCoords : null,
        serviceMode,
        tableNumber: serviceMode === "dinein" ? tableNumber : "",
        paymentMethod,
        items: cart,
        distanceKm: serviceMode === "delivery" ? shippingDistance : 0,
        shippingCost: serviceMode === "delivery" ? shippingCost : 0,
        subtotal: totals.subtotal,
        discountAmount: totals.totalDiscount,
        taxAmount: totals.taxAmount,
        total: totals.total,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "orders"), orderData);

      // Descontar stock
      for (const item of cart) {
        const prodRef = doc(db, "products", item.id);
        await updateDoc(prodRef, {
          stock: increment(-item.quantity)
        });
      }

      // Imprimir ticket automáticamente al registrar en POS
      const orderForPrint = {
        ...orderData,
        createdAt: { seconds: Math.floor(Date.now() / 1000) } // usar timestamp local para impresión instantánea
      };
      triggerPrint(orderForPrint);

      setSuccessMsg(`¡Orden #${orderNumber} enviada a autorización!`);
      clearCart();
      
      // Limpiar campos locales
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setTableNumber("");

      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Error al registrar orden en POS:", err);
      alert("Error al registrar la orden.");
    } finally {
      setLoading(false);
    }
  };

  const totals = getTotals();

  return (
    <div className={isEmbedded ? "w-full h-[calc(100vh-80px)] overflow-hidden" : "min-h-screen bg-pizza-charcoal text-white"}>
      
      {/* -------------------- INTERFAZ DESKTOP (MD y superior) -------------------- */}
      <div className="hidden md:flex flex-row w-full h-full min-h-screen">
        {/* Panel Izquierdo: Catálogo y Categorías */}
        <div className="flex-1 p-4 lg:p-6 overflow-y-auto max-h-full border-r border-white/5 flex flex-col">
          {/* Cabecera del POS */}
          {!isEmbedded && (
            <header className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                {businessConfig.logoUrl ? (
                  <img 
                    src={businessConfig.logoUrl} 
                    alt="Logo" 
                    className="w-8 h-8 rounded-full object-cover border border-white/10" 
                    onError={(e) => { e.target.style.display = 'none'; }} 
                  />
                ) : (
                  <span className="text-3xl">🍕</span>
                )}
                <div>
                  <h2 className="font-pizza-title text-xl font-bold">
                    {businessConfig.name || "Pizza Hub"} POS
                  </h2>
                  <span className="text-[10px] text-white/50 block">Rol: Cajero ({user.email})</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Selector de Tamaño de Ticket */}
                <div className="flex items-center gap-1.5 bg-[#181818] border border-white/5 rounded-xl px-3 py-2 text-xs">
                  <Printer size={13} className="text-[#ffd79b]" />
                  <span className="text-white/60">Ticket:</span>
                  <select
                    value={printSize}
                    onChange={(e) => setPrintSize(e.target.value)}
                    className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs border-0 pr-1"
                  >
                    <option value="58mm">58mm</option>
                    <option value="80mm">80mm</option>
                    <option value="letter">Carta</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setIsApprovalTrayOpen(true)}
                  className={`flex items-center gap-2 text-xs font-bold py-2 px-4 rounded-xl transition-all cursor-pointer border relative ${
                    pendingOrders.length > 0
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20 animate-pulse"
                      : "bg-[#181818] border-white/5 text-white/70 hover:bg-white/5"
                  }`}
                  title="Pedidos web esperando aprobación de caja"
                >
                  <span>📲 Por Aprobar</span>
                  {pendingOrders.length > 0 && (
                    <span className="bg-amber-500 text-[#161616] text-[10px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center">
                      {pendingOrders.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={handleLogoutClick}
                  className="flex items-center gap-1.5 bg-pizza-red/10 border border-pizza-red/20 hover:bg-pizza-red/20 text-pizza-red text-xs font-bold py-2 px-4 rounded-xl transition-all cursor-pointer"
                >
                  <LogOut size={14} />
                  Cerrar Sesión
                </button>
              </div>
            </header>
          )}

          {/* Categorías */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1 shrink-0">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 border ${
                  activeCategory === cat.id
                    ? "bg-pizza-red border-pizza-red text-white"
                    : "bg-[#181818] border-white/5 hover:bg-white/5 text-white/70"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Buscador de Productos */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input
              type="text"
              placeholder="Buscar producto por nombre o descripción..."
              value={posSearch}
              onChange={(e) => setPosSearch(e.target.value)}
              className="w-full bg-[#181818]/60 border border-white/5 focus:border-pizza-gold/40 focus:ring-1 focus:ring-pizza-gold/40 text-white rounded-xl pl-11 pr-10 py-3 text-sm placeholder-white/20 outline-none transition-all"
            />
            {posSearch && (
              <button
                onClick={() => setPosSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 p-1 cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Grid de Productos */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto flex-1 pr-1">
            {filteredProducts.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-center bg-[#181818]/40 border border-white/5 rounded-2xl p-6">
                <span className="text-4xl mb-3">🔍</span>
                <h4 className="font-bold text-sm text-white">No se encontraron productos</h4>
                <p className="text-xs text-white/40 mt-1 max-w-[280px]">
                  Intenta buscar con otros términos o cambia de categoría.
                </p>
                <button
                  onClick={() => {
                    setPosSearch("");
                    setActiveCategory("all");
                  }}
                  className="mt-4 px-4 py-2 bg-pizza-red text-white text-xs font-bold rounded-xl hover:bg-pizza-red/90 transition-all cursor-pointer"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              filteredProducts.map((prod) => {
                const hasDiscount = prod.discount > 0;
                const discountedPrice = hasDiscount ? prod.price * (1 - prod.discount / 100) : prod.price;

                return (
                  <div
                    key={prod.id}
                    onClick={() => handleOpenCustomize(prod)}
                    className="bg-[#181818] border border-white/5 hover:border-pizza-gold/30 rounded-2xl p-4 flex flex-col justify-between cursor-pointer hover:shadow-lg transition-all duration-200 group"
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="aspect-video w-full rounded-xl overflow-hidden bg-pizza-dark relative">
                        <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                        {hasDiscount && (
                          <span className="absolute top-2 left-2 bg-pizza-red text-[8px] font-black px-1.5 py-0.5 rounded-full text-white">
                            {prod.discount}%
                          </span>
                        )}
                      </div>
                      <h3 className="font-pizza-title text-sm font-bold leading-tight group-hover:text-pizza-gold transition-colors">
                        {prod.name}
                      </h3>
                    </div>

                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/5">
                      <span className="text-xs font-black text-pizza-gold">
                        {formatCurrency(discountedPrice, businessConfig.currency)}
                      </span>
                      <span className="text-[10px] text-white/35 font-semibold bg-white/5 px-2 py-0.5 rounded-md">
                        + Agregar
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Panel Derecho: Carrito de Compras del POS */}
        <div className="w-full md:w-[420px] bg-[#101010] border-l border-white/5 p-6 flex flex-col justify-between max-h-screen overflow-y-auto shrink-0">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-pizza-title text-base font-bold flex items-center gap-1.5">
                <ShoppingBag size={18} className="text-[#ffd79b]" />
                Orden Actual
              </h3>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-[10px] font-bold uppercase tracking-wider text-pizza-red bg-pizza-red/15 px-2.5 py-1 rounded-lg hover:bg-pizza-red/25 transition-colors cursor-pointer"
                >
                  Vaciar
                </button>
              )}
            </div>

            {successMsg && (
              <div className="bg-[#ffd79b]/10 border border-[#ffd79b]/35 text-[#ffd79b] rounded-xl p-4 text-xs font-semibold">
                {successMsg}
              </div>
            )}

            {/* Items en la lista */}
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-xs text-white/30">
                  El carrito de la caja registradora está vacío.
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.cartId}
                    className="flex items-start justify-between bg-[#161616] border border-white/5 rounded-xl p-3 text-xs"
                  >
                    <div className="flex-1 pr-2">
                      <span className="font-bold text-white block">{item.name}</span>
                      <span className="text-[10px] text-pizza-gold">
                        {formatCurrency(item.price, businessConfig.currency)} x {item.quantity}
                      </span>
                      {Object.keys(item.optionsSelected).length > 0 && (
                        <span className="block text-[9px] text-white/40 leading-none mt-1">
                          {Object.entries(item.optionsSelected).map(([k, v]) => `${k}: ${v}`).join(", ")}
                        </span>
                      )}
                      {item.comboItems && item.comboItems.length > 0 && (
                        <span className="block text-[9px] text-pizza-gold/60 mt-0.5">
                          Combo: {item.comboItems.join(" + ")}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-pizza-charcoal rounded-lg p-0.5">
                        <button
                          onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                          className="p-0.5 hover:bg-white/5 rounded text-white/50 hover:text-white"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="w-4 text-center font-bold text-[10px]">{item.quantity}</span>
                        <button
                          onClick={() => {
                            const matchedProd = products.find(p => p.id === item.id);
                            if (matchedProd && matchedProd.stock !== undefined && item.quantity >= matchedProd.stock) {
                              alert(`No hay suficiente stock disponible. Límite: ${matchedProd.stock} unidades.`);
                              return;
                            }
                            updateQuantity(item.cartId, item.quantity + 1);
                          }}
                          className="p-0.5 hover:bg-white/5 rounded text-white/50 hover:text-white"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Formulario del Cajero */}
            <form onSubmit={handleSaveOrder} className="space-y-4 pt-4 border-t border-white/5 text-left">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Datos del Cliente</h4>
              
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nombre del Cliente"
                  className="w-full bg-[#181818] border border-white/5 rounded-lg p-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red"
                />
                <input
                  type="text"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Teléfono"
                  className="w-full bg-[#181818] border border-white/5 rounded-lg p-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red"
                />
              </div>

              {/* Servicio */}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setServiceMode("pickup")}
                  className={`py-2 rounded-lg text-[9px] font-bold uppercase border transition-all cursor-pointer ${
                    serviceMode === "pickup"
                      ? "bg-pizza-red/10 border-pizza-red text-pizza-red"
                      : "bg-[#181818] border-white/5 text-white/70"
                  }`}
                >
                  🥡 Recojo
                </button>
                <button
                  type="button"
                  onClick={() => setServiceMode("delivery")}
                  className={`py-2 rounded-lg text-[9px] font-bold uppercase border transition-all cursor-pointer ${
                    serviceMode === "delivery"
                      ? "bg-pizza-red/10 border-pizza-red text-pizza-red"
                      : "bg-[#181818] border-white/5 text-white/70"
                  }`}
                >
                  🚀 Delivery
                </button>
                <button
                  type="button"
                  onClick={() => setServiceMode("dinein")}
                  className={`py-2 rounded-lg text-[9px] font-bold uppercase border transition-all cursor-pointer ${
                    serviceMode === "dinein"
                      ? "bg-pizza-red/10 border-pizza-red text-pizza-red"
                      : "bg-[#181818] border-white/5 text-white/70"
                  }`}
                >
                  🍽️ Mesa
                </button>
              </div>

              {serviceMode === "delivery" && (
                <div className="space-y-2">
                  <MapboxSearch />
                  {shippingDistance > 0 && (
                    <div className="bg-pizza-gold/5 border border-pizza-gold/15 rounded-lg p-2.5 text-[10px] text-[#ffd79b]">
                      Envío: <strong>{shippingDistance.toFixed(2)} km</strong> ({formatCurrency(shippingCost, businessConfig.currency)})
                    </div>
                  )}
                </div>
              )}

              {serviceMode === "dinein" && (
                <select
                  required
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full bg-[#181818] border border-white/5 rounded-lg p-2.5 text-xs text-white"
                >
                  <option value="">Selecciona Mesa</option>
                  {Array.from({ length: businessConfig.serviceModes?.tableNumbers || 20 }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {businessConfig.serviceModes?.tableLabel || "Mesa"} {i + 1}
                    </option>
                  ))}
                </select>
              )}

              {/* Método de pago */}
              <div>
                <span className="block text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Método de Pago</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cash")}
                    className={`py-2 rounded-lg text-[9px] font-bold uppercase border transition-all cursor-pointer ${
                      paymentMethod === "cash"
                        ? "bg-pizza-gold/15 border-pizza-gold text-[#ffd79b]"
                        : "bg-[#181818] border-white/5 text-white/70"
                    }`}
                  >
                    💵 Efectivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("yape")}
                    className={`py-2 rounded-lg text-[9px] font-bold uppercase border transition-all cursor-pointer ${
                      paymentMethod === "yape"
                        ? "bg-pizza-gold/15 border-pizza-gold text-[#ffd79b]"
                        : "bg-[#181818] border-white/5 text-white/70"
                    }`}
                  >
                    📱 Yape/Plin
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("transfer")}
                    className={`py-2 rounded-lg text-[9px] font-bold uppercase border transition-all cursor-pointer ${
                      paymentMethod === "transfer"
                        ? "bg-pizza-gold/15 border-pizza-gold text-[#ffd79b]"
                        : "bg-[#181818] border-white/5 text-white/70"
                    }`}
                  >
                    💳 Transf.
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Totales y Botón Enviar */}
          <div className="pt-4 border-t border-white/5 mt-4 space-y-4">
            <div className="bg-pizza-dark/80 rounded-xl p-3 space-y-1.5 text-xs text-left">
              <div className="flex justify-between text-white/50">
                <span>Subtotal:</span>
                <span>{formatCurrency(totals.subtotal, businessConfig.currency)}</span>
              </div>
              {totals.totalDiscount > 0 && (
                <div className="flex justify-between text-pizza-red font-semibold">
                  <span>Descuento ({totals.autoDiscountPercent}%):</span>
                  <span>-{formatCurrency(totals.totalDiscount, businessConfig.currency)}</span>
                </div>
              )}
              {serviceMode === "delivery" && (
                <div className="flex justify-between text-white/50">
                  <span>Costo Envío:</span>
                  <span>{formatCurrency(totals.shippingCost, businessConfig.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-white pt-1.5 border-t border-white/5">
                <span>Total Orden:</span>
                <span className="text-pizza-gold">{formatCurrency(totals.total, businessConfig.currency)}</span>
              </div>
            </div>

            <button
              onClick={handleSaveOrder}
              disabled={loading || cart.length === 0}
              className="w-full bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl py-3.5 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-pizza-red/20 disabled:opacity-40"
            >
              {loading ? "Registrando..." : "Registrar & Solicitar Autorización"}
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* -------------------- INTERFAZ MÓVIL (Menor a MD) -------------------- */}
      <div className={`md:hidden flex flex-col pb-16 ${isEmbedded ? "h-[calc(100vh-80px)] overflow-y-auto" : "min-h-screen bg-pizza-charcoal text-white"}`}>
        {/* Cabecera Móvil del POS */}
        <header className="sticky top-0 z-40 bg-pizza-charcoal/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xl">🍕</span>
            <div className="text-left">
              <h2 className="font-pizza-title text-sm font-bold text-white">{businessConfig.name || "Pizza Hub"} POS</h2>
              <span className="text-[9px] text-white/50 block">Rol: Cajero ({user.email})</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsApprovalTrayOpen(true)}
              className={`flex items-center gap-1 text-[10px] font-bold py-1.5 px-2.5 rounded-xl transition-all cursor-pointer border relative ${
                pendingOrders.length > 0
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-500 hover:bg-amber-500/25 animate-pulse"
                  : "bg-white/5 border-white/5 text-white/70"
              }`}
              title="Pedidos web pendientes"
            >
              <span>📲 {pendingOrders.length}</span>
            </button>

            <button
              onClick={handleLogoutClick}
              className="flex items-center gap-1 p-2 bg-pizza-red/10 border border-pizza-red/20 text-pizza-red text-[10px] font-bold rounded-xl transition-all cursor-pointer"
            >
              <LogOut size={12} />
              Salir
            </button>
          </div>
        </header>

        {/* Contenido de Pestañas Móviles */}
        <div className="flex-1 px-4 py-4 overflow-y-auto">
          {activeMobileTab === "menu" && (
            <div className="flex flex-col h-full space-y-4">
              {/* Categorías */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 shrink-0 scrollbar-none sticky top-12 bg-pizza-charcoal z-10 py-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border shrink-0 transition-all cursor-pointer ${
                      activeCategory === cat.id
                        ? "bg-pizza-red border-pizza-red text-white shadow-lg shadow-pizza-red/20"
                        : "bg-white/5 border-white/5 text-white/60"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Buscador de Productos Móvil */}
              <div className="relative shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
                <input
                  type="text"
                  placeholder="Buscar pizza o producto..."
                  value={posSearch}
                  onChange={(e) => setPosSearch(e.target.value)}
                  className="w-full bg-[#181818]/60 border border-white/5 focus:border-pizza-gold/40 focus:ring-1 focus:ring-pizza-gold/40 text-white rounded-xl pl-9 pr-8 py-2 text-xs placeholder-white/20 outline-none transition-all"
                />
                {posSearch && (
                  <button
                    onClick={() => setPosSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 p-0.5 cursor-pointer transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Grid de pizzas */}
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.length === 0 ? (
                  <div className="col-span-full py-8 flex flex-col items-center justify-center text-center bg-[#181818]/40 border border-white/5 rounded-2xl p-4">
                    <span className="text-3xl mb-2">🔍</span>
                    <h4 className="font-bold text-xs text-white">Sin resultados</h4>
                    <p className="text-[10px] text-white/40 mt-1 max-w-[200px]">
                      Intenta buscar con otros términos.
                    </p>
                    <button
                      onClick={() => {
                        setPosSearch("");
                        setActiveCategory("all");
                      }}
                      className="mt-3 px-3 py-1.5 bg-pizza-red text-white text-[10px] font-bold rounded-lg hover:bg-pizza-red/90 transition-all cursor-pointer"
                    >
                      Limpiar
                    </button>
                  </div>
                ) : (
                  filteredProducts.map((prod) => {
                    const discountedPrice = prod.discount > 0 ? prod.price * (1 - prod.discount / 100) : prod.price;
                    return (
                      <div 
                        key={prod.id}
                        onClick={() => handleOpenCustomize(prod)}
                        className="bg-[#181818] border border-white/5 rounded-2xl p-3 flex flex-col justify-between hover:border-white/15 transition-all cursor-pointer group"
                      >
                        <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-pizza-dark mb-2">
                          <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                          {prod.discount > 0 && (
                            <span className="absolute top-1 left-1 bg-pizza-red text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white">
                              -{prod.discount}%
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-xs text-white truncate leading-tight group-hover:text-pizza-gold transition-colors text-left">
                          {prod.name}
                        </h4>
                        <div className="flex justify-between items-center mt-auto pt-2 border-t border-white/5">
                          <span className="text-xs font-black text-pizza-gold">
                            {formatCurrency(discountedPrice, businessConfig.currency)}
                          </span>
                          <span className="text-[9px] text-[#ffd79b] bg-[#ffd79b]/10 border border-[#ffd79b]/25 px-1.5 py-0.5 rounded-md font-bold">
                            + Agregar
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeMobileTab === "cart" && (
            <div className="space-y-6 text-left">
              <div className="flex justify-between items-center">
                <h3 className="font-pizza-title text-base font-bold flex items-center gap-1.5">
                  <ShoppingBag size={18} className="text-[#ffd79b]" />
                  Orden Actual
                </h3>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-[10px] font-bold uppercase tracking-wider text-pizza-red bg-pizza-red/15 px-2.5 py-1 rounded-lg hover:bg-pizza-red/25 transition-colors cursor-pointer"
                  >
                    Vaciar
                  </button>
                )}
              </div>

              {successMsg && (
                <div className="bg-[#ffd79b]/10 border border-[#ffd79b]/35 text-[#ffd79b] rounded-xl p-4 text-xs font-semibold">
                  {successMsg}
                </div>
              )}

              {/* Items del POS */}
              {cart.length === 0 ? (
                <div className="py-12 text-center text-xs text-white/30">
                  El carrito de la caja registradora está vacío.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div 
                        key={item.cartId} 
                        className="bg-[#161616] border border-white/5 rounded-2xl p-3 flex justify-between items-start text-xs"
                      >
                        <div className="flex-1 pr-2 text-left">
                          <span className="font-bold text-white block">{item.name}</span>
                          <span className="text-[10px] text-pizza-gold">
                            {formatCurrency(item.price, businessConfig.currency)} x {item.quantity}
                          </span>
                          {Object.keys(item.optionsSelected).length > 0 && (
                            <span className="block text-[9px] text-white/40 leading-none mt-1">
                              {Object.entries(item.optionsSelected).map(([k, v]) => `${k}: ${v}`).join(", ")}
                            </span>
                          )}
                          {item.comboItems && item.comboItems.length > 0 && (
                            <span className="block text-[9px] text-pizza-gold/60 mt-0.5">
                              Combo: {item.comboItems.join(" + ")}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-pizza-charcoal rounded-lg p-0.5">
                            <button
                              onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                              className="p-0.5 hover:bg-white/5 rounded text-white/50 hover:text-white"
                            >
                              <Minus size={10} />
                            </button>
                            <span className="w-4 text-center font-bold text-[10px]">{item.quantity}</span>
                            <button
                              onClick={() => {
                                const matchedProd = products.find(p => p.id === item.id);
                                if (matchedProd && matchedProd.stock !== undefined && item.quantity >= matchedProd.stock) {
                                  alert(`No hay suficiente stock disponible. Límite: ${matchedProd.stock} unidades.`);
                                  return;
                                }
                                updateQuantity(item.cartId, item.quantity + 1);
                              }}
                              className="p-0.5 hover:bg-white/5 rounded text-white/50 hover:text-white"
                            >
                              <Plus size={10} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Formulario cajero en mobile */}
                  <div className="space-y-4 pt-4 border-t border-white/5 text-left">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Datos del Cliente</h4>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Nombre del Cliente"
                        className="w-full bg-[#181818] border border-white/5 rounded-lg p-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red"
                      />
                      <input
                        type="text"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Teléfono"
                        className="w-full bg-[#181818] border border-white/5 rounded-lg p-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red"
                      />
                    </div>

                    {/* Servicio */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setServiceMode("pickup")}
                        className={`py-2 rounded-lg text-[9px] font-bold uppercase border transition-all cursor-pointer ${
                          serviceMode === "pickup"
                            ? "bg-pizza-red/10 border-pizza-red text-pizza-red"
                            : "bg-[#181818] border-white/5 text-white/70"
                        }`}
                      >
                        Llevar 🥡
                      </button>
                      <button
                        type="button"
                        onClick={() => setServiceMode("delivery")}
                        className={`py-2 rounded-lg text-[9px] font-bold uppercase border transition-all cursor-pointer ${
                          serviceMode === "delivery"
                            ? "bg-pizza-red/10 border-pizza-red text-pizza-red"
                            : "bg-[#181818] border-white/5 text-white/70"
                        }`}
                      >
                        Delivery 🚀
                      </button>
                      <button
                        type="button"
                        onClick={() => setServiceMode("dinein")}
                        className={`py-2 rounded-lg text-[9px] font-bold uppercase border transition-all cursor-pointer ${
                          serviceMode === "dinein"
                            ? "bg-pizza-red/10 border-pizza-red text-pizza-red"
                            : "bg-[#181818] border-white/5 text-white/70"
                        }`}
                      >
                        Mesa 🍽️
                      </button>
                    </div>

                    {serviceMode === "delivery" && (
                      <div className="space-y-2">
                        <MapboxSearch />
                        {shippingDistance > 0 && (
                          <div className="bg-pizza-gold/5 border border-pizza-gold/15 rounded-lg p-2.5 text-[10px] text-[#ffd79b]">
                            Envío: <strong>{shippingDistance.toFixed(2)} km</strong> ({formatCurrency(shippingCost, businessConfig.currency)})
                          </div>
                        )}
                      </div>
                    )}

                    {serviceMode === "dinein" && (
                      <select
                        required
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        className="w-full bg-[#181818] border border-white/5 rounded-lg p-2.5 text-xs text-white"
                      >
                        <option value="">Selecciona Mesa</option>
                        {Array.from({ length: businessConfig.serviceModes?.tableNumbers || 20 }).map((_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {businessConfig.serviceModes?.tableLabel || "Mesa"} {i + 1}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Método de pago */}
                    <div>
                      <span className="block text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Método de Pago</span>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("cash")}
                          className={`py-2 rounded-lg text-[9px] font-bold uppercase border transition-all cursor-pointer ${
                            paymentMethod === "cash"
                              ? "bg-pizza-gold/15 border-pizza-gold text-[#ffd79b]"
                              : "bg-[#181818] border-white/5 text-white/70"
                          }`}
                        >
                          Efectivo 💵
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("yape")}
                          className={`py-2 rounded-lg text-[9px] font-bold uppercase border transition-all cursor-pointer ${
                            paymentMethod === "yape"
                              ? "bg-pizza-gold/15 border-pizza-gold text-[#ffd79b]"
                              : "bg-[#181818] border-white/5 text-white/70"
                          }`}
                        >
                          Yape 📱
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("transfer")}
                          className={`py-2 rounded-lg text-[9px] font-bold uppercase border transition-all cursor-pointer ${
                            paymentMethod === "transfer"
                              ? "bg-pizza-gold/15 border-pizza-gold text-[#ffd79b]"
                              : "bg-[#181818] border-white/5 text-white/70"
                          }`}
                        >
                          Transf. 💳
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Resumen y botón registrar */}
                  <div className="pt-4 border-t border-white/5 mt-4 space-y-4">
                    <div className="bg-pizza-dark/80 rounded-xl p-3 space-y-1.5 text-xs text-left">
                      <div className="flex justify-between text-white/50">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(totals.subtotal, businessConfig.currency)}</span>
                      </div>
                      {totals.totalDiscount > 0 && (
                        <div className="flex justify-between text-pizza-red font-semibold">
                          <span>Descuento ({totals.autoDiscountPercent}%):</span>
                          <span>-{formatCurrency(totals.totalDiscount, businessConfig.currency)}</span>
                        </div>
                      )}
                      {serviceMode === "delivery" && (
                        <div className="flex justify-between text-white/50">
                          <span>Costo Envío:</span>
                          <span>{formatCurrency(totals.shippingCost, businessConfig.currency)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold text-white pt-1.5 border-t border-white/5">
                        <span>Total Orden:</span>
                        <span className="text-pizza-gold">{formatCurrency(totals.total, businessConfig.currency)}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveOrder}
                      disabled={loading || cart.length === 0}
                      className="w-full bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl py-3.5 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-pizza-red/20 disabled:opacity-40"
                    >
                      {loading ? "Registrando..." : "Registrar & Solicitar Autorización"}
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeMobileTab === "logout" && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-pizza-red/10 border border-pizza-red/20 flex items-center justify-center text-pizza-red mb-2">
                <LogOut size={28} />
              </div>
              <h3 className="font-pizza-title text-base font-bold text-white">¿Cerrar Sesión del POS?</h3>
              <p className="text-xs text-white/60 max-w-xs">
                Se desconectará tu usuario de esta caja registradora. Tendrás que ingresar tus credenciales nuevamente.
              </p>
              <div className="flex gap-3 w-full max-w-xs pt-4">
                <button
                  onClick={() => setActiveMobileTab("menu")}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl py-3 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleLogoutClick}
                  className="flex-1 bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl py-3 text-xs font-bold transition-all cursor-pointer shadow-lg shadow-pizza-red/20"
                >
                  Sí, Salir
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Barra de Navegación Inferior Móvil */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#141414]/90 backdrop-blur-xl border-t border-white/10 pb-safe pt-2 px-3 flex justify-between items-center text-[10px]">
          <button
            onClick={() => setActiveMobileTab("menu")}
            className={`flex flex-col items-center gap-1.5 flex-1 border-0 bg-transparent py-1 cursor-pointer ${
              activeMobileTab === "menu" ? "text-pizza-gold font-extrabold scale-105" : "text-white/40"
            }`}
          >
            <Menu size={18} />
            <span>Catálogo</span>
          </button>

          <button
            onClick={() => setActiveMobileTab("cart")}
            className={`flex flex-col items-center gap-1.5 flex-1 border-0 bg-transparent py-1 relative cursor-pointer ${
              activeMobileTab === "cart" ? "text-pizza-gold font-extrabold scale-105" : "text-white/40"
            }`}
          >
            <div className="relative">
              <ShoppingBag size={18} />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-pizza-red text-white text-[8px] font-extrabold w-4.5 h-4.5 rounded-full flex items-center justify-center border border-[#141414]">
                  {cart.reduce((acc, item) => acc + item.quantity, 0)}
                </span>
              )}
            </div>
            <span>Pedido</span>
          </button>

          <button
            onClick={() => setActiveMobileTab("logout")}
            className={`flex flex-col items-center gap-1.5 flex-1 border-0 bg-transparent py-1 cursor-pointer ${
              activeMobileTab === "logout" ? "text-pizza-red font-extrabold scale-105" : "text-white/40"
            }`}
          >
            <LogOut size={18} />
            <span>Salir</span>
          </button>
        </nav>
      </div>

      {/* Modal de Personalización (Común) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#181818] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <h3 className="font-pizza-title text-sm font-bold">Personalizar: {selectedProduct.name}</h3>
              <button onClick={() => setSelectedProduct(null)} className="p-1 rounded-full hover:bg-white/5 border-0 bg-transparent cursor-pointer">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-5 text-left flex-1">
              {selectedProduct.options && Object.entries(selectedProduct.options).map(([groupName, values]) => (
                <div key={groupName} className="space-y-1.5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/40">{groupName}:</h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    {values.map((val) => (
                      <button
                        key={val}
                        onClick={() => handleOptionChange(groupName, val)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-left ${
                          optionsSelected[groupName] === val
                            ? "bg-pizza-red/10 border-pizza-red text-pizza-red font-bold"
                            : "bg-[#101010] border-white/5 text-white/70"
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {selectedProduct.comboItems && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/40">Opciones de Combo:</h4>
                  {selectedProduct.comboItems.map((cName, idx) => (
                    <div key={idx} className="space-y-1">
                      <span className="text-xs text-white/60">{cName}</span>
                      <input
                        type="text"
                        placeholder="Ejemplo: Pizza Margherita"
                        required
                        value={comboItemsSelected[idx] || ""}
                        onChange={(e) => handleComboItemChange(idx, e.target.value)}
                        className="w-full bg-[#101010] border border-white/5 rounded-xl px-3 py-2 text-white text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Cantidad:</span>
                <div className="flex items-center gap-3 bg-[#101010] rounded-xl p-1 border border-white/5">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-1 text-white/60 hover:text-white border-0 bg-transparent cursor-pointer">
                    <Minus size={14} />
                  </button>
                  <span className="text-xs font-bold w-5 text-center">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="p-1 text-white/60 hover:text-white border-0 bg-transparent cursor-pointer">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/5 bg-[#101010] flex items-center justify-between">
              <span className="text-sm font-bold text-pizza-gold">
                Total: {formatCurrency((selectedProduct.price * (1 - (selectedProduct.discount || 0) / 100)) * quantity, businessConfig.currency)}
              </span>
              <button
                onClick={handleAddToCart}
                className="bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer border-0"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bandeja de Aprobación de Pedidos en Línea */}
      {isApprovalTrayOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-lg bg-[#141414] border-l border-white/10 h-full flex flex-col shadow-2xl animate-fade-in-right">
            {/* Header del Tray */}
            <div className="p-5 bg-[#181818] border-b border-white/5 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-pizza-title text-base font-bold text-white flex items-center gap-2">
                  <Bell className="text-amber-500 animate-bounce" size={18} />
                  Aprobación de Pedidos en Línea
                </h3>
                <p className="text-[10px] text-white/50 mt-0.5">Pedidos esperando confirmación del cajero</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Selector de ticket rápido */}
                <div className="flex items-center gap-1 bg-[#181818] border border-white/5 rounded-xl px-2 py-1.5 text-[11px]">
                  <Printer size={13} className="text-[#ffd79b]" />
                  <select
                    value={printSize}
                    onChange={(e) => setPrintSize(e.target.value)}
                    className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-[11px] border-0"
                  >
                    <option value="58mm">58mm</option>
                    <option value="80mm">80mm</option>
                    <option value="letter">Carta</option>
                  </select>
                </div>

                {/* Activar/Silenciar sonido de alerta */}
                <button
                  onClick={() => setIsAlertMuted(!isAlertMuted)}
                  className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                    isAlertMuted 
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20" 
                      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20"
                  }`}
                  title={isAlertMuted ? "Activar timbre de aviso" : "Silenciar timbre de aviso"}
                >
                  {isAlertMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <button
                  onClick={() => setIsApprovalTrayOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-full border-0 bg-transparent text-white/60 hover:text-white cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Listado de Pedidos */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {pendingOrders.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center justify-center text-white/30 space-y-3">
                  <span className="text-4xl">🍕</span>
                  <h4 className="font-bold text-sm text-white/60">¡Bandeja al día!</h4>
                  <p className="text-xs max-w-xs leading-relaxed">
                    No hay pedidos en línea pendientes de aprobación. Los pedidos web de los clientes aparecerán aquí automáticamente.
                  </p>
                </div>
              ) : (
                pendingOrders.map((order) => {
                  return (
                    <div 
                      key={order.id} 
                      className="bg-[#181818] border border-white/5 rounded-2xl p-4 flex flex-col justify-between space-y-4 hover:border-amber-500/20 transition-all text-left"
                    >
                      {/* Cabecera del pedido en la bandeja */}
                      <div className="flex justify-between items-start border-b border-white/5 pb-3">
                        <div>
                          <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider block w-max mb-1">
                            Orden #{order.orderNumber}
                          </span>
                          <h4 className="text-xs font-bold text-white leading-tight">
                            Cliente: {order.customerName}
                          </h4>
                          <span className="text-[10px] text-white/40 block mt-0.5">
                            📞 {order.customerPhone}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-pizza-gold block">
                            {formatCurrency(order.total, businessConfig.currency)}
                          </span>
                          <span className="text-[10px] text-white/40 block mt-1 uppercase font-semibold">
                            {order.serviceMode === "delivery" ? "🚀 Delivery" :
                             order.serviceMode === "pickup" ? "🥡 Recojo" : "🍽️ Mesa"}
                          </span>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={item.cartId || idx} className="text-xs flex justify-between bg-pizza-dark/40 rounded-xl p-2.5 border border-white/5">
                            <div className="text-left">
                              <span className="font-bold text-white">{item.quantity}x {item.name}</span>
                              {item.optionsSelected && Object.keys(item.optionsSelected).length > 0 && (
                                <span className="block text-[10px] text-white/40 mt-0.5 pl-2 border-l border-white/10 leading-tight">
                                  {Object.entries(item.optionsSelected).map(([k, v]) => `${k}: ${v}`).join(", ")}
                                </span>
                              )}
                              {item.comboItems && item.comboItems.length > 0 && (
                                <span className="block text-[10px] text-pizza-gold/60 mt-0.5 pl-2 border-l border-pizza-gold/20 leading-tight">
                                  Combo: {item.comboItems.join(" + ")}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#ffd79b] font-semibold">
                              {formatCurrency((item.price * item.quantity), businessConfig.currency)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Dirección en caso de delivery */}
                      {order.serviceMode === "delivery" && order.customerAddress && (
                        <div className="bg-[#101010] border border-white/5 rounded-xl p-2.5 text-left">
                          <span className="text-[9px] uppercase tracking-wider font-bold text-white/30 block mb-0.5">Dirección de Entrega</span>
                          <p className="text-[10px] text-white/70 leading-normal">{order.customerAddress}</p>
                          {order.distanceKm > 0 && (
                            <span className="inline-block text-[9px] text-[#ffd79b] bg-[#ffd79b]/10 border border-[#ffd79b]/25 rounded-md px-1.5 py-0.5 mt-1.5 font-bold">
                              Distancia: {order.distanceKm.toFixed(2)} km
                            </span>
                          )}
                        </div>
                      )}

                      {/* Mesa en caso de mesa */}
                      {order.serviceMode === "dinein" && order.tableNumber && (
                        <div className="bg-pizza-gold/5 border border-pizza-gold/15 rounded-xl p-2 text-left text-[10px] text-[#ffd79b] font-bold">
                          🍽️ Asignado a Mesa: {order.tableNumber}
                        </div>
                      )}

                      {/* Acciones */}
                      <div className="flex gap-2 pt-2 border-t border-white/5">
                        <button
                          onClick={() => handleRejectOrder(order.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-pizza-red/10 border border-pizza-red/20 hover:bg-pizza-red/20 text-pizza-red text-[11px] font-bold py-2.5 rounded-xl transition-all cursor-pointer"
                        >
                          <XCircle size={13} />
                          Rechazar
                        </button>
                        <button
                          onClick={() => triggerPrint(order)}
                          className="bg-[#202020] border border-white/5 hover:bg-white/5 text-[#ffd79b] hover:text-white px-3 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                          title="Imprimir Ticket"
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          onClick={() => handleApproveOrder(order.id)}
                          className="flex-[1.5] flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold py-2.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
                        >
                          <CheckCircle size={13} />
                          Aprobar y Cocinar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {selectedOrderForPrint && (
        <TicketTemplate 
          order={selectedOrderForPrint} 
          totals={{
            subtotal: selectedOrderForPrint.subtotal || 0,
            totalDiscount: selectedOrderForPrint.discountAmount || 0,
            taxAmount: selectedOrderForPrint.taxAmount || 0,
            shippingCost: selectedOrderForPrint.shippingCost || 0,
            total: selectedOrderForPrint.total || 0
          }} 
          config={businessConfig} 
          printSize={printSize} 
        />
      )}
    </div>
  );
};
