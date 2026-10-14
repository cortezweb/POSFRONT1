import { useState, useEffect, useRef } from "react";
import { rCol, rDoc } from "../firebase/tenant";
import { useCart } from "../context/CartContext";
import { getDocs, addDoc, serverTimestamp, query, where, onSnapshot, updateDoc, increment, orderBy } from "firebase/firestore";
import { formatCurrency, parseComboItem, getProductPriceWithExtras, getOptionPriceAdjustment } from "../utils/formatters";
import { MapboxSearch } from "../components/MapboxSearch";
import { 
  ShoppingBag, Plus, Minus, X, ChevronRight, LogOut, Menu, Search, Volume2, VolumeX, Bell, CheckCircle, XCircle, Printer,
  ChefHat, Receipt, Wallet, Utensils, StickyNote, Clock
} from "lucide-react";
import { logoutUser } from "../firebase/auth";
import { TicketTemplate } from "../components/TicketTemplate";
import { KitchenTicket, PreBillTicket } from "../components/KitchenTicket";

export const POSView = ({ user, role, permissions, onLogout, isEmbedded = false }) => {
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
  const [tablesList, setTablesList] = useState([]);
  const [itemNote, setItemNote] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [lastSentOrder, setLastSentOrder] = useState(null);

  // Cuentas abiertas (pedidos en mesa aún sin cobrar)
  const [openOrders, setOpenOrders] = useState([]);
  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
  const [payingBill, setPayingBill] = useState(null);
  const [payMethod, setPayMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    if (!isAccountsOpen) return;
    const tick = () => setNowSec(Math.floor(Date.now() / 1000));
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [isAccountsOpen]);

  useEffect(() => {
    const q = query(rCol("orders"), where("paymentStatus", "==", "pending"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        if (data.status !== "rejected" && data.status !== "cancelled") list.push(data);
      });
      setOpenOrders(list);
    }, (error) => console.error("Error al cargar cuentas abiertas:", error));
    return () => unsubscribe();
  }, []);

  // Obtener mesas en tiempo real
  useEffect(() => {
    const q = query(rCol("tables"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setTablesList(list);
    });
    return () => unsubscribe();
  }, []);

  const [pendingOrders, setPendingOrders] = useState([]);
  const [isApprovalTrayOpen, setIsApprovalTrayOpen] = useState(false);
  const [isAlertMuted, setIsAlertMuted] = useState(() => {
    return localStorage.getItem("pos_muted") === "true";
  });
  const isInitialPos = useRef(true);
  const isAlertMutedRef = useRef(isAlertMuted);

  // Documento a imprimir: { type: "receipt" | "comanda" | "precuenta", data }
  const [printJob, setPrintJob] = useState(null);
  const [printSize, setPrintSize] = useState("80mm");

  const printDocument = (type, data) => {
    setPrintJob({ type, data });
    setTimeout(() => {
      window.print();
    }, 250);
  };
  const triggerPrint = (order) => printDocument("receipt", order);

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
      rCol("orders"),
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
      const orderRef = rDoc("orders", orderId);
      const toApprove = pendingOrders.find(o => o.id === orderId);
      await updateDoc(orderRef, {
        status: "preparing",
        approvedAt: serverTimestamp(),
        approvedBy: user.uid,
        // Pedido web en mesa: queda en la cuenta abierta de la mesa hasta cobrar
        ...(toApprove?.serviceMode === "dinein" && !toApprove?.paymentStatus ? { paymentStatus: "pending" } : {})
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
      const orderRef = rDoc("orders", orderId);
      const orderToReject = pendingOrders.find(o => o.id === orderId);
      await updateDoc(orderRef, {
        status: "rejected",
        rejectedAt: serverTimestamp(),
        rejectedBy: user.uid
      });

      // Restaurar stock
      if (orderToReject && orderToReject.items) {
        for (const item of orderToReject.items) {
          const prodRef = rDoc("products", item.id);
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
        const querySnapshot = await getDocs(rCol("products"));
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
    const q = query(rCol("categories"), orderBy("name", "asc"));
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
    { id: "platos", name: "Platos Principales" },
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
    setItemNote("");
    
    const initialOpts = {};
    if (product.options) {
      Object.entries(product.options).forEach(([groupName, values]) => {
        initialOpts[groupName] = values[0];
      });
    }
    setOptionsSelected(initialOpts);

    // Inicializar selecciones de combos auto-seleccionando opciones e items fijos
    if (product.comboItems) {
      const initialCombos = product.comboItems.map((itemText) => {
        const parsed = parseComboItem(itemText);
        if (parsed.isSelection) {
          return parsed.options[0] ? `${parsed.name}: ${parsed.options[0]}` : parsed.name;
        } else {
          return parsed.name;
        }
      });
      setComboItemsSelected(initialCombos);
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
    addToCart(selectedProduct, quantity, optionsSelected, comboItemsSelected, itemNote);
    setSelectedProduct(null);
  };

  const handleLogoutClick = async () => {
    await logoutUser();
    onLogout();
  };

  const handleSaveOrder = async (e) => {
    e?.preventDefault?.();
    if (cart.length === 0) return;

    if (serviceMode === "dinein" && !tableNumber) {
      alert("Selecciona la mesa.");
      return;
    }
    if (serviceMode === "pickup" && !customerName) {
      alert("Ingresa el nombre del cliente para el pedido para llevar.");
      return;
    }
    if (serviceMode === "delivery") {
      if (!customerName || !customerPhone) {
        alert("Ingresa el nombre y teléfono del cliente para el delivery.");
        return;
      }
      if (!customerAddress || !customerCoords) {
        alert("Por favor selecciona una dirección de delivery válida de la lista de sugerencias o usa el GPS.");
        return;
      }
    }

    setLoading(true);
    try {
      const totals = getTotals();
      const orderNumber = Math.floor(1000 + Math.random() * 9000).toString();
      const isDineIn = serviceMode === "dinein";

      // El personal envía directo a cocina. En mesa la cuenta queda abierta hasta cobrar;
      // para llevar y delivery se cobra al registrar.
      const orderData = {
        orderNumber,
        status: "preparing",
        createdBy: user.uid,
        waiterName: user.email?.split("@")[0] || "",
        customerName: customerName || (isDineIn ? `Mesa ${tableNumber}` : ""),
        customerPhone: customerPhone || "",
        customerAddress: serviceMode === "delivery" ? customerAddress : "",
        customerCoords: serviceMode === "delivery" ? customerCoords : null,
        serviceMode,
        tableNumber: isDineIn ? tableNumber : "",
        paymentMethod: isDineIn ? "" : paymentMethod,
        paymentStatus: isDineIn ? "pending" : "paid",
        ...(isDineIn ? {} : { paidAt: serverTimestamp() }),
        orderNote: orderNote.trim(),
        items: cart,
        distanceKm: serviceMode === "delivery" ? shippingDistance : 0,
        shippingCost: serviceMode === "delivery" ? shippingCost : 0,
        subtotal: totals.subtotal,
        discountAmount: totals.totalDiscount,
        taxAmount: totals.taxAmount,
        total: totals.total,
        createdAt: serverTimestamp(),
        approvedAt: serverTimestamp(),
        approvedBy: user.uid,
        sentToKitchenAt: serverTimestamp()
      };

      await addDoc(rCol("orders"), orderData);

      // Descontar stock
      for (const item of cart) {
        const prodRef = rDoc("products", item.id);
        await updateDoc(prodRef, {
          stock: increment(-item.quantity)
        });
      }

      // Marcar la mesa como ocupada
      if (isDineIn) {
        const table = tablesList.find((t) => t.name === tableNumber);
        if (table && table.status !== "ocupada") {
          updateDoc(rDoc("tables", table.id), { status: "ocupada" }).catch(() => {});
        }
      }

      // Imprimir la comanda para cocina
      const localOrder = {
        ...orderData,
        createdAt: { seconds: Math.floor(Date.now() / 1000) }
      };
      printDocument("comanda", localOrder);
      setLastSentOrder(localOrder);

      setSuccessMsg(`¡Orden #${orderNumber} enviada a cocina!`);
      clearCart();

      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setOrderNote("");
      if (!isDineIn) setTableNumber("");

      setTimeout(() => setSuccessMsg(""), 6000);
    } catch (err) {
      console.error("Error al registrar orden en POS:", err);
      alert("Error al registrar la orden.");
    } finally {
      setLoading(false);
    }
  };

  // ---------- Cuentas abiertas por mesa ----------
  const openBills = Object.values(
    openOrders
      .filter((o) => o.serviceMode === "dinein")
      .reduce((acc, o) => {
        const key = o.tableNumber || "Sin mesa";
        if (!acc[key]) acc[key] = { tableNumber: key, orders: [], subtotal: 0, discount: 0, total: 0, openedAt: Infinity };
        acc[key].orders.push(o);
        acc[key].subtotal += Number(o.subtotal || 0);
        acc[key].discount += Number(o.discountAmount || 0);
        acc[key].total += Number(o.total || 0);
        acc[key].openedAt = Math.min(acc[key].openedAt, o.createdAt?.seconds || Infinity);
        return acc;
      }, {})
  )
    .map((b) => {
      // Agrupar platos iguales de todas las rondas
      const itemsMap = {};
      b.orders.forEach((o) => (o.items || []).forEach((it) => {
        const key = `${it.name}|${it.price}`;
        if (!itemsMap[key]) itemsMap[key] = { name: it.name, price: Number(it.price || 0), quantity: 0 };
        itemsMap[key].quantity += it.quantity;
      }));
      return {
        ...b,
        items: Object.values(itemsMap),
        orderNumbers: b.orders.map((o) => o.orderNumber),
        inKitchen: b.orders.filter((o) => o.status === "preparing").length
      };
    })
    .sort((a, b) => a.openedAt - b.openedAt);

  const handlePrintPreBill = (bill) => printDocument("precuenta", bill);

  const handleAddRound = (bill) => {
    setServiceMode("dinein");
    setTableNumber(bill.tableNumber);
    setIsAccountsOpen(false);
    setActiveMobileTab("menu");
  };

  const handleConfirmPayment = async () => {
    if (!payingBill) return;
    const received = Number(cashReceived || 0);
    if (payMethod === "cash" && cashReceived !== "" && received < payingBill.total) {
      alert("El monto recibido es menor al total.");
      return;
    }
    setIsPaying(true);
    try {
      await Promise.all(payingBill.orders.map((o) =>
        updateDoc(rDoc("orders", o.id), {
          paymentStatus: "paid",
          paymentMethod: payMethod,
          paidAt: serverTimestamp(),
          paidBy: user.uid,
          // Lo ya servido se cierra; lo que sigue en cocina se cerrará al entregarse
          ...(o.status === "ready" ? { status: "completed", completedAt: serverTimestamp() } : {})
        })
      ));

      const table = tablesList.find((t) => t.name === payingBill.tableNumber);
      if (table) updateDoc(rDoc("tables", table.id), { status: "libre" }).catch(() => {});

      // Comprobante final con todos los pedidos de la mesa
      triggerPrint({
        orderNumber: payingBill.orderNumbers.join("-"),
        customerName: `Mesa ${payingBill.tableNumber}`,
        customerPhone: "",
        serviceMode: "dinein",
        tableNumber: payingBill.tableNumber,
        paymentMethod: payMethod,
        items: payingBill.orders.flatMap((o) => o.items || []),
        subtotal: payingBill.subtotal,
        discountAmount: payingBill.discount,
        taxAmount: payingBill.orders.reduce((n, o) => n + Number(o.taxAmount || 0), 0),
        shippingCost: 0,
        total: payingBill.total,
        createdAt: { seconds: Math.floor(Date.now() / 1000) }
      });

      setSuccessMsg(`Mesa ${payingBill.tableNumber} cobrada.`);
      setPayingBill(null);
      setCashReceived("");
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      console.error("Error al cobrar la mesa:", err);
      alert("Error al registrar el cobro.");
    } finally {
      setIsPaying(false);
    }
  };

  const totals = getTotals();

  return (
    <div className={isEmbedded ? "w-full h-[calc(100vh-96px)] md:h-[calc(100vh-128px)] overflow-hidden" : "min-h-screen bg-pizza-dark text-white"}>
      
      {/* -------------------- INTERFAZ DESKTOP (MD y superior) -------------------- */}
      <div className={`hidden md:flex flex-row w-full h-full ${isEmbedded ? "min-h-full" : "min-h-screen"}`}>
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
                  <span className="text-3xl">🌶️</span>
                )}
                <div>
                  <h2 className="font-pizza-title text-xl font-bold">
                    {businessConfig.name || "GloryChef"} POS
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
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto flex-1 pr-1 content-start">
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
        <div className={`w-full md:w-[420px] bg-[#101010] border-l border-white/5 p-6 flex flex-col justify-between ${isEmbedded ? "max-h-full" : "max-h-screen"} overflow-y-auto shrink-0`}>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="font-pizza-title text-base font-bold flex items-center gap-1.5">
                <ShoppingBag size={18} className="text-[#ffd79b]" />
                Orden Actual
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setNowSec(Math.floor(Date.now() / 1000)); setIsAccountsOpen(true); }}
                  className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                    openBills.length > 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                  }`}
                  title="Mesas con cuenta abierta: precuenta y cobro"
                >
                  <Receipt size={12} />
                  Cuentas{openBills.length > 0 ? ` (${openBills.length})` : ""}
                </button>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-[10px] font-bold uppercase tracking-wider text-pizza-red bg-pizza-red/15 px-2.5 py-1 rounded-lg hover:bg-pizza-red/25 transition-colors cursor-pointer"
                >
                  Vaciar
                </button>
              )}
              </div>
            </div>

            {successMsg && (
              <div className="bg-[#ffd79b]/10 border border-[#ffd79b]/35 text-[#ffd79b] rounded-xl p-4 text-xs font-semibold">
                <span className="block">{successMsg}</span>
                {lastSentOrder && (
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={() => printDocument("comanda", lastSentOrder)} className="flex items-center gap-1 bg-white/10 hover:bg-white/15 text-white rounded-lg px-2.5 py-1.5 text-[10px] font-bold cursor-pointer">
                      <Printer size={11} /> Comanda
                    </button>
                    <button type="button" onClick={() => triggerPrint(lastSentOrder)} className="flex items-center gap-1 bg-white/10 hover:bg-white/15 text-white rounded-lg px-2.5 py-1.5 text-[10px] font-bold cursor-pointer">
                      <Receipt size={11} /> Ticket cliente
                    </button>
                  </div>
                )}
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
                      {item.note && (
                        <span className="block text-[9px] text-amber-400 mt-0.5">📝 {item.note}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-pizza-dark rounded-lg p-0.5 border border-white/5">
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
              
              <div className="grid grid-cols-1 gap-2">
                <input
                  type="text"
                  
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={serviceMode === "dinein" ? "Nombre del cliente (opcional)" : "Nombre del cliente"}
                  className="w-full bg-[#181818] border border-white/5 rounded-lg p-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red"
                />
                <input
                  type="text"
                  
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={serviceMode === "delivery" ? "Teléfono" : "Teléfono (opcional)"}
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
                  {tablesList.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name} ({t.status === "ocupada" ? "Ocupada" : "Libre"})
                    </option>
                  ))}
                </select>
              )}

              {/* Nota general del pedido */}
              <input
                type="text"
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder="Nota general para cocina (opcional)"
                className="w-full bg-[#181818] border border-white/5 rounded-lg p-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red"
              />

              {/* Método de pago (en mesa se cobra al cerrar la cuenta) */}
              {serviceMode === "dinein" ? (
                <p className="text-[10px] text-white/40 bg-white/5 rounded-lg p-2.5">
                  En mesa la cuenta queda abierta. Cóbrala desde <strong className="text-white/70">Cuentas abiertas</strong> cuando el cliente la pida.
                </p>
              ) : (
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
                {paymentMethod === "yape" && businessConfig.yapeQrUrl && (
                  <div className="mt-3 flex flex-col items-center justify-center p-3 bg-white/5 border border-white/5 rounded-xl gap-2 text-center">
                    <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">QR Yape / Plin</span>
                    <div className="w-32 h-32 bg-white rounded-lg p-1.5 flex items-center justify-center shadow-md">
                      <img src={businessConfig.yapeQrUrl} alt="QR Yape" className="w-full h-full object-contain" />
                    </div>
                  </div>
                )}
              </div>
              )}
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
              <ChefHat size={15} />
              {loading ? "Enviando..." : "Enviar a cocina"}
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* -------------------- INTERFAZ MÓVIL (Menor a MD) -------------------- */}
      <div className={`md:hidden flex flex-col pb-16 ${isEmbedded ? "h-[calc(100vh-96px)] overflow-y-auto" : "min-h-screen bg-pizza-dark text-white"}`}>
        {/* Cabecera Móvil del POS */}
        <header className="sticky top-0 z-40 bg-pizza-dark/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xl">🌶️</span>
            <div className="text-left">
              <h2 className="font-pizza-title text-sm font-bold text-white">{businessConfig.name || "GloryChef"} POS</h2>
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
              <div className="flex gap-1.5 overflow-x-auto pb-1 shrink-0 scrollbar-none sticky top-12 bg-pizza-dark z-10 py-1">
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
                  placeholder="Buscar plato o bebida..."
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
              <div className="grid grid-cols-2 gap-3 content-start">
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setNowSec(Math.floor(Date.now() / 1000)); setIsAccountsOpen(true); }}
                    className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                      openBills.length > 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                    }`}
                    title="Mesas con cuenta abierta: precuenta y cobro"
                  >
                    <Receipt size={12} />
                    Cuentas{openBills.length > 0 ? ` (${openBills.length})` : ""}
                  </button>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-[10px] font-bold uppercase tracking-wider text-pizza-red bg-pizza-red/15 px-2.5 py-1 rounded-lg hover:bg-pizza-red/25 transition-colors cursor-pointer"
                  >
                    Vaciar
                  </button>
                )}
                </div>
              </div>

              {successMsg && (
                <div className="bg-[#ffd79b]/10 border border-[#ffd79b]/35 text-[#ffd79b] rounded-xl p-4 text-xs font-semibold">
                  <span className="block">{successMsg}</span>
                  {lastSentOrder && (
                    <div className="flex gap-2 mt-2">
                      <button type="button" onClick={() => printDocument("comanda", lastSentOrder)} className="flex items-center gap-1 bg-white/10 hover:bg-white/15 text-white rounded-lg px-2.5 py-1.5 text-[10px] font-bold cursor-pointer">
                        <Printer size={11} /> Comanda
                      </button>
                      <button type="button" onClick={() => triggerPrint(lastSentOrder)} className="flex items-center gap-1 bg-white/10 hover:bg-white/15 text-white rounded-lg px-2.5 py-1.5 text-[10px] font-bold cursor-pointer">
                        <Receipt size={11} /> Ticket cliente
                      </button>
                    </div>
                  )}
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
                          {item.note && (
                            <span className="block text-[9px] text-amber-400 mt-0.5">📝 {item.note}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-pizza-dark rounded-lg p-0.5 border border-white/5">
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
                    
                    <div className="grid grid-cols-1 gap-2">
                      <input
                        type="text"
                        
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder={serviceMode === "dinein" ? "Nombre del cliente (opcional)" : "Nombre del cliente"}
                        className="w-full bg-[#181818] border border-white/5 rounded-lg p-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red"
                      />
                      <input
                        type="text"
                        
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder={serviceMode === "delivery" ? "Teléfono" : "Teléfono (opcional)"}
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
                        {tablesList.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name} ({t.status === "ocupada" ? "Ocupada" : "Libre"})
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Nota general del pedido */}
                    <input
                      type="text"
                      value={orderNote}
                      onChange={(e) => setOrderNote(e.target.value)}
                      placeholder="Nota general para cocina (opcional)"
                      className="w-full bg-[#181818] border border-white/5 rounded-lg p-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red"
                    />

                    {/* Método de pago (en mesa se cobra al cerrar la cuenta) */}
                    {serviceMode === "dinein" ? (
                      <p className="text-[10px] text-white/40 bg-white/5 rounded-lg p-2.5">
                        En mesa la cuenta queda abierta. Cóbrala desde <strong className="text-white/70">Cuentas abiertas</strong> cuando el cliente la pida.
                      </p>
                    ) : (
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
                      {paymentMethod === "yape" && businessConfig.yapeQrUrl && (
                        <div className="mt-3 flex flex-col items-center justify-center p-3 bg-white/5 border border-white/5 rounded-xl gap-2 text-center">
                          <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">QR Yape / Plin</span>
                          <div className="w-32 h-32 bg-white rounded-lg p-1.5 flex items-center justify-center shadow-md">
                            <img src={businessConfig.yapeQrUrl} alt="QR Yape" className="w-full h-full object-contain" />
                          </div>
                        </div>
                      )}
                    </div>
                    )}
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
                      <ChefHat size={15} />
              {loading ? "Enviando..." : "Enviar a cocina"}
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
          <div className="w-full max-w-lg bg-[#181818] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] relative">
            
            {/* Botón de Cerrar Absoluto */}
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 z-20 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white/80 hover:text-white cursor-pointer border-0 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Cabecera con Imagen (si existe) */}
            {selectedProduct.imageUrl ? (
              <div className="relative h-36 w-full shrink-0">
                <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/45 to-black/25" />
                <div className="absolute bottom-3 left-4 right-4 text-left">
                  <h3 className="font-pizza-title text-base font-bold text-white">
                    {selectedProduct.name}
                  </h3>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 border-b border-white/5 text-left shrink-0">
                <h3 className="font-pizza-title text-sm font-bold text-white">
                  Personalizar: {selectedProduct.name}
                </h3>
              </div>
            )}

            {/* Contenido Scrollable */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 text-left">
              {/* Opciones del Producto */}
              {selectedProduct.options && Object.entries(selectedProduct.options).map(([groupName, values]) => (
                <div key={groupName} className="space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                    {groupName}:
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {values.map((val) => {
                      const isSelected = optionsSelected[groupName] === val;
                      const extraPrice = getOptionPriceAdjustment(val);
                      const cleanedLabel = val.replace(/\s*\(\+\s*\$?\s*[0-9.]+\)/, "").trim();

                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleOptionChange(groupName, val)}
                          className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex flex-col justify-between text-left h-14 ${
                            isSelected
                              ? "bg-pizza-gold/10 border-pizza-gold text-[#ffd79b] font-black"
                              : "bg-[#111111] border-white/5 text-white/70 hover:bg-white/5"
                          }`}
                        >
                          <span className="truncate w-full">{cleanedLabel}</span>
                          {extraPrice > 0 ? (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold self-end border mt-1 ${
                              isSelected 
                                ? "bg-pizza-gold/20 border-pizza-gold text-pizza-gold" 
                                : "bg-white/5 border-white/10 text-white/50"
                            }`}>
                              + {formatCurrency(extraPrice, businessConfig.currency)}
                            </span>
                          ) : (
                            <span className="text-[9px] text-white/30 font-medium self-end mt-1">
                              Base
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Items del Combo */}
              {selectedProduct.comboItems && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                    Opciones de Combo:
                  </h4>
                  <div className="space-y-2.5">
                    {selectedProduct.comboItems.map((itemText, idx) => {
                      const parsed = parseComboItem(itemText);
                      if (parsed.isSelection) {
                        const currentValue = comboItemsSelected[idx] || "";
                        const selectedOption = parsed.options.find(opt => `${parsed.name}: ${opt}` === currentValue || opt === currentValue) || parsed.options[0];
                        
                        return (
                          <div key={idx} className="bg-pizza-dark/40 border border-white/5 rounded-xl p-3.5 space-y-2">
                            <span className="text-[10px] font-bold text-pizza-gold block uppercase tracking-wider">
                              {parsed.name}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {parsed.options.map((opt) => {
                                const isSelected = selectedOption === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => handleComboItemChange(idx, `${parsed.name}: ${opt}`)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                      isSelected
                                        ? "bg-pizza-red text-white font-extrabold border-pizza-red"
                                        : "bg-pizza-dark border-white/5 text-white/70 hover:bg-white/5"
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div key={idx} className="bg-pizza-dark/25 border border-white/5 rounded-xl p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-500 font-extrabold text-xs">✓</span>
                              <span className="text-xs text-white/80 font-medium">{parsed.name}</span>
                            </div>
                            <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                              Incluido
                            </span>
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              )}

              {/* Nota para cocina */}
              <div className="pt-3 border-t border-white/5">
                <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">
                  <StickyNote size={12} /> Nota para cocina
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {["Sin cebolla", "Sin picante", "Bien cocido", "Para llevar", "Sin sal"].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setItemNote((prev) => (prev ? `${prev}, ${n}` : n))}
                      className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white/70 cursor-pointer"
                    >
                      + {n}
                    </button>
                  ))}
                </div>
                <textarea
                  value={itemNote}
                  onChange={(e) => setItemNote(e.target.value)}
                  rows={2}
                  placeholder="Ej. sin cebolla, salsa aparte..."
                  className="w-full bg-[#101010] border border-white/5 rounded-xl p-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red/50 resize-none"
                />
              </div>

              {/* Selector de Cantidad */}
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Cantidad:</span>
                <div className="flex items-center gap-3 bg-[#101010] rounded-xl p-1 border border-white/5">
                  <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-1 text-white/60 hover:text-white border-0 bg-transparent cursor-pointer">
                    <Minus size={14} />
                  </button>
                  <span className="text-xs font-bold w-5 text-center">{quantity}</span>
                  <button type="button" onClick={() => setQuantity(quantity + 1)} className="p-1 text-white/60 hover:text-white border-0 bg-transparent cursor-pointer">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Pie de modal */}
            <div className="p-4 border-t border-white/5 bg-[#101010] flex items-center justify-between shrink-0">
              <span className="text-sm font-bold text-pizza-gold">
                Total: {formatCurrency(getProductPriceWithExtras(selectedProduct, optionsSelected) * quantity, businessConfig.currency)}
              </span>
              <button
                type="button"
                onClick={handleAddToCart}
                className="bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl px-5 py-2 text-xs font-bold transition-all cursor-pointer border-0 active:scale-98"
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
                  <span className="text-4xl">🍲</span>
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

      {/* Cuentas abiertas por mesa: precuenta, agregar ronda y cobro */}
      {isAccountsOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end" onClick={() => setIsAccountsOpen(false)}>
          <div className="w-full max-w-md h-full bg-[#121212] border-l border-white/10 flex flex-col text-left" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="font-pizza-title font-bold text-base flex items-center gap-2">
                  <Receipt size={18} className="text-pizza-red" /> Cuentas abiertas
                </h3>
                <p className="text-[11px] text-white/40">Mesas con pedidos sin cobrar</p>
              </div>
              <button onClick={() => setIsAccountsOpen(false)} className="p-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-white cursor-pointer" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {openBills.length === 0 ? (
                <div className="py-16 text-center text-xs text-white/40">
                  <Utensils size={28} className="mx-auto mb-2 text-white/20" />
                  No hay mesas con cuenta abierta.
                </div>
              ) : openBills.map((bill) => {
                const minutes = Number.isFinite(bill.openedAt) ? Math.max(0, Math.floor((nowSec - bill.openedAt) / 60)) : 0;
                return (
                  <div key={bill.tableNumber} className="bg-[#181818] border border-white/5 rounded-2xl p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-base font-black">Mesa {bill.tableNumber}</h4>
                        <p className="text-[10px] text-white/40 flex items-center gap-1">
                          <Clock size={10} /> {minutes} min · {bill.orders.length} pedido(s)
                          {bill.inKitchen > 0 && <span className="text-amber-400 font-bold"> · {bill.inKitchen} en cocina</span>}
                        </p>
                      </div>
                      <span className="text-lg font-black text-pizza-red">{formatCurrency(bill.total, businessConfig.currency)}</span>
                    </div>
                    <div className="text-[11px] text-white/60 space-y-0.5 max-h-24 overflow-y-auto">
                      {bill.items.map((it, i) => (
                        <div key={i} className="flex justify-between gap-2">
                          <span className="truncate">{it.quantity} × {it.name}</span>
                          <span className="text-white/40 shrink-0">{formatCurrency(it.price * it.quantity, businessConfig.currency)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => handleAddRound(bill)} className="flex flex-col items-center gap-1 bg-white/5 hover:bg-white/10 rounded-xl py-2.5 text-[10px] font-bold cursor-pointer">
                        <Plus size={14} /> Agregar
                      </button>
                      <button onClick={() => handlePrintPreBill(bill)} className="flex flex-col items-center gap-1 bg-white/5 hover:bg-white/10 rounded-xl py-2.5 text-[10px] font-bold cursor-pointer">
                        <Printer size={14} /> Precuenta
                      </button>
                      <button
                        onClick={() => { setPayingBill(bill); setPayMethod("cash"); setCashReceived(""); }}
                        className="flex flex-col items-center gap-1 bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl py-2.5 text-[10px] font-bold cursor-pointer"
                      >
                        <Wallet size={14} /> Cobrar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Cobro de mesa */}
      {payingBill && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#181818] border border-white/10 rounded-3xl p-6 space-y-4 text-left shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-pizza-title font-bold text-base">Cobrar Mesa {payingBill.tableNumber}</h3>
              <button onClick={() => setPayingBill(null)} className="p-1 text-white/60 hover:text-white cursor-pointer" aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="bg-pizza-dark/60 rounded-2xl p-4 text-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-white/40">Total a cobrar</span>
              <div className="text-3xl font-black text-pizza-red">{formatCurrency(payingBill.total, businessConfig.currency)}</div>
              {payingBill.inKitchen > 0 && (
                <p className="text-[10px] text-amber-400 mt-1">{payingBill.inKitchen} pedido(s) siguen en cocina; se cerrarán al entregarse.</p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[["cash", "💵 Efectivo"], ["yape", "📱 QR"], ["transfer", "💳 Tarjeta/Transf."]].map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPayMethod(k)}
                  className={`py-3 rounded-xl text-[10px] font-bold border cursor-pointer ${payMethod === k ? "bg-pizza-red/10 border-pizza-red text-pizza-red" : "bg-[#121212] border-white/5 text-white/70"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {payMethod === "cash" && (
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">Monto recibido</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder={payingBill.total.toFixed(2)}
                  className="w-full bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-lg font-bold text-white focus:outline-none focus:border-pizza-red/50"
                  autoFocus
                />
                <div className="flex flex-wrap gap-1.5">
                  {[Math.ceil(payingBill.total), 50, 100, 200].filter((v, i, arr) => v >= payingBill.total && arr.indexOf(v) === i).map((v) => (
                    <button key={v} type="button" onClick={() => setCashReceived(String(v))} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold cursor-pointer">
                      {formatCurrency(v, businessConfig.currency)}
                    </button>
                  ))}
                </div>
                {cashReceived !== "" && Number(cashReceived) >= payingBill.total && (
                  <div className="flex justify-between text-sm font-bold bg-emerald-500/10 text-emerald-400 rounded-xl px-4 py-2.5">
                    <span>Cambio</span>
                    <span>{formatCurrency(Number(cashReceived) - payingBill.total, businessConfig.currency)}</span>
                  </div>
                )}
              </div>
            )}
            {payMethod === "yape" && businessConfig.yapeQrUrl && (
              <div className="flex justify-center">
                <img src={businessConfig.yapeQrUrl} alt="QR de pago" className="w-36 h-36 bg-white rounded-xl p-2 object-contain" />
              </div>
            )}
            <button
              onClick={handleConfirmPayment}
              disabled={isPaying}
              className="w-full flex items-center justify-center gap-2 bg-pizza-red hover:bg-pizza-red/90 disabled:opacity-60 text-white font-bold text-sm py-3.5 rounded-xl cursor-pointer"
            >
              {isPaying ? "Registrando cobro..." : "Confirmar cobro e imprimir"}
            </button>
          </div>
        </div>
      )}

      {printJob?.type === "receipt" && (
        <TicketTemplate
          order={printJob.data}
          totals={{
            subtotal: printJob.data.subtotal || 0,
            totalDiscount: printJob.data.discountAmount || 0,
            taxAmount: printJob.data.taxAmount || 0,
            shippingCost: printJob.data.shippingCost || 0,
            total: printJob.data.total || 0
          }}
          config={businessConfig}
          printSize={printSize}
        />
      )}
      {printJob?.type === "comanda" && <KitchenTicket order={printJob.data} printSize={printSize} />}
      {printJob?.type === "precuenta" && <PreBillTicket bill={printJob.data} config={businessConfig} printSize={printSize} />}
    </div>
  );
};
