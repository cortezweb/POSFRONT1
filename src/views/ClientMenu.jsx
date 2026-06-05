import { useState, useEffect } from "react";
import { useCart } from "../context/CartContext";
import { db } from "../firebase/config";
import { collection, getDocs, addDoc, serverTimestamp, query, where, orderBy, limit, onSnapshot, doc, updateDoc, increment } from "firebase/firestore";
import { formatCurrency, formatWhatsAppMessage, parseComboItem, getProductPriceWithExtras, getOptionPriceAdjustment } from "../utils/formatters";
import { MapboxSearch } from "../components/MapboxSearch";
import { 
  ShoppingBag, Trash2, Plus, Minus, X, 
  Check, ChevronRight, MessageSquare, Tag, Loader2,
  Home, QrCode, Crown, Percent, User, Info, Menu, Search
} from "lucide-react";

export const ClientMenu = () => {
  const {
    cart, addToCart, removeFromCart, updateQuantity, clearCart,
    applyCoupon, removeCoupon, couponCode, couponDiscount,
    shippingCost, shippingDistance, serviceMode, setServiceMode,
    tableNumber, setTableNumber, customerName, setCustomerName,
    customerPhone, setCustomerPhone, customerAddress, customerCoords,
    businessConfig, getTotals
  } = useCart();

  const availableCoupons = Object.entries(businessConfig.discounts?.coupons || {});

  const [products, setProducts] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [optionsSelected, setOptionsSelected] = useState({});
  const [comboItemsSelected, setComboItemsSelected] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  
  const [cartOpen, setCartOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState("home");
  const [infoDrawerOpen, setInfoDrawerOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [tablesList, setTablesList] = useState([]);

  // Estados para seguimiento de pedidos
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [trackPhoneInput, setTrackPhoneInput] = useState("");
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState("");
  const [trackResults, setTrackResults] = useState([]);

  const handleSearchOrder = async (e) => {
    e.preventDefault();
    if (!trackPhoneInput.trim()) return;
    setTrackLoading(true);
    setTrackError("");
    setTrackResults([]);
    try {
      const qPhone = query(
        collection(db, "orders"),
        where("customerPhone", "==", trackPhoneInput.trim()),
        orderBy("createdAt", "desc"),
        limit(5)
      );
      const querySnapshot = await getDocs(qPhone);
      const results = [];
      querySnapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });

      if (results.length === 0) {
        const cleanOrderNum = trackPhoneInput.replace("#", "").trim();
        const qOrder = query(
          collection(db, "orders"),
          where("orderNumber", "==", cleanOrderNum),
          limit(3)
        );
        const querySnapshotOrder = await getDocs(qOrder);
        querySnapshotOrder.forEach((doc) => {
          results.push({ id: doc.id, ...doc.data() });
        });
      }

      if (results.length === 0) {
        setTrackError("No se encontraron pedidos con ese teléfono o número de orden.");
      } else {
        setTrackResults(results);
      }
    } catch (err) {
      console.error("Error al buscar pedido:", err);
      try {
        const cleanOrderNum = trackPhoneInput.replace("#", "").trim();
        const qOrder = query(
          collection(db, "orders"),
          where("orderNumber", "==", cleanOrderNum),
          limit(3)
        );
        const querySnapshotOrder = await getDocs(qOrder);
        const results = [];
        querySnapshotOrder.forEach((doc) => {
          results.push({ id: doc.id, ...doc.data() });
        });
        if (results.length === 0) {
          setTrackError("No se encontraron pedidos. Verifica los datos.");
        } else {
          setTrackResults(results);
        }
      } catch (innerErr) {
        setTrackError("Error de conexión. Inténtalo más tarde.");
      }
    } finally {
      setTrackLoading(false);
    }
  };

  // Cargar productos de Firestore en tiempo real
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "products"), (snapshot) => {
      const prods = [];
      snapshot.forEach((doc) => {
        prods.push({ id: doc.id, ...doc.data() });
      });
      setProducts(prods);
    }, (error) => {
      console.error("Error al cargar productos en tiempo real:", error);
    });
    return () => unsubscribe();
  }, []);

  // Cargar categorías de Firestore
  useEffect(() => {
    const q = query(collection(db, "categories"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = [];
      snapshot.forEach((doc) => {
        doc.data(); // evitamos warnings de unused variable si los hubiera
        cats.push({ id: doc.id, ...doc.data() });
      });
      setCategoriesList(cats);
    });
    return () => unsubscribe();
  }, []);

  // Cargar mesas de Firestore en tiempo real
  useEffect(() => {
    const q = query(collection(db, "tables"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setTablesList(list);
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
    const searchLower = clientSearch.toLowerCase();
    const matchesSearch = 
      p.name?.toLowerCase().includes(searchLower) ||
      p.description?.toLowerCase().includes(searchLower) ||
      p.id?.toLowerCase().includes(searchLower);
    return matchesCategory && matchesSearch;
  });

  const handleOpenCustomize = (product) => {
    if (product.stock !== undefined && product.stock <= 0) {
      alert("Este producto está agotado.");
      return;
    }
    setSelectedProduct(product);
    setQuantity(1);
    
    // Inicializar opciones seleccionadas con la primera opción de cada grupo
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
    // Validar combos
    if (selectedProduct.comboItems) {
      const incomplete = comboItemsSelected.some((item) => item === "");
      if (incomplete) {
        alert("Por favor selecciona todos los componentes del combo.");
        return;
      }
    }

    // Validar stock disponible
    const cartCountForProduct = cart
      .filter((item) => item.id === selectedProduct.id)
      .reduce((sum, item) => sum + item.quantity, 0);

    const totalRequested = cartCountForProduct + quantity;
    const availableStock = selectedProduct.stock !== undefined ? selectedProduct.stock : 9999;

    if (totalRequested > availableStock) {
      if (availableStock - cartCountForProduct <= 0) {
        alert(`No hay más stock disponible para este producto. Ya tienes ${cartCountForProduct} en el carrito.`);
      } else {
        alert(`Solo quedan ${availableStock - cartCountForProduct} unidades disponibles de este producto. Ya tienes ${cartCountForProduct} en el carrito.`);
      }
      return;
    }

    addToCart(selectedProduct, quantity, optionsSelected, comboItemsSelected);
    setSelectedProduct(null);
  };

  const handleApplyCoupon = (e) => {
    e.preventDefault();
    setCouponError("");
    if (!couponInput) return;
    const res = applyCoupon(couponInput);
    if (!res.success) {
      setCouponError(res.message);
    } else {
      setCouponInput("");
    }
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (!customerName || !customerPhone) {
      alert("Por favor ingresa tu nombre y número de teléfono.");
      return;
    }

    if (serviceMode === "delivery" && (!customerAddress || !customerCoords)) {
      alert("Por favor selecciona una dirección de envío válida de la lista de sugerencias o usa el GPS.");
      return;
    }

    if (serviceMode === "dinein" && !tableNumber) {
      alert("Por favor selecciona una mesa.");
      return;
    }

    setLoadingOrder(true);
    try {
      const totals = getTotals();
      const orderNumber = Math.floor(1000 + Math.random() * 9000).toString(); // Generar número aleatorio temporal

      const orderData = {
        orderNumber,
        status: "pending_approval",
        createdBy: "client",
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

      // Guardar en Firestore
      const docRef = await addDoc(collection(db, "orders"), orderData);

      // Descontar stock de Firestore de forma atómica
      try {
        for (const item of cart) {
          if (item.id) {
            const productRef = doc(db, "products", item.id);
            await updateDoc(productRef, {
              stock: increment(-item.quantity)
            });
          }
        }
      } catch (stockErr) {
        console.error("Error al actualizar el stock de productos:", stockErr);
      }

      // Formatear mensaje de WhatsApp
      const cleanPhone = businessConfig.whatsappNumber.replace(/\D/g, "");
      const encodedMsg = formatWhatsAppMessage(orderData, totals, businessConfig);
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;

      setOrderSuccess({
        id: docRef.id,
        orderNumber,
        whatsappUrl
      });

      // Limpiar carrito
      clearCart();
      setCartOpen(false);
    } catch (err) {
      console.error("Error al procesar el pedido:", err);
      alert("Ocurrió un error al registrar el pedido. Inténtalo nuevamente.");
    } finally {
      setLoadingOrder(false);
    }
  };

  const totals = getTotals();

  if (orderSuccess) {
    return (
      <div className="min-h-screen bg-pizza-charcoal text-white flex items-center justify-center p-4">
        <div className="w-full max-w-lg glass-panel rounded-3xl p-8 text-center border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-[#ffd79b]/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-pizza-gold/10 text-pizza-gold mb-6 border border-pizza-gold/20">
            <Check size={40} className="animate-bounce" />
          </div>

          <h2 className="font-pizza-title text-3xl font-bold text-white mb-2">¡Pedido Recibido!</h2>
          <p className="text-white/70 text-sm mb-4">
            Tu orden <strong className="text-pizza-gold">#{orderSuccess.orderNumber}</strong> ha sido registrada y está en estado de <strong className="text-pizza-gold">Aprobación Pendiente</strong>.
          </p>

          <div className="bg-pizza-dark/80 rounded-2xl p-5 border border-white/5 text-left mb-6 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">Siguiente Paso Requerido:</h3>
            <p className="text-xs text-white/80 leading-relaxed">
              Para completar la sincronización y que nuestro personal comience la preparación, por favor envía el ticket por WhatsApp haciendo click en el botón de abajo.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <a
              href={orderSuccess.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-[#25d366] hover:bg-[#20ba5a] text-white py-4 px-6 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#25d366]/20"
            >
              <MessageSquare size={18} />
              Enviar Ticket por WhatsApp
            </a>

            <button
              onClick={() => {
                window.location.hash = `#/track/${orderSuccess.id}`;
                setOrderSuccess(null);
              }}
              className="w-full bg-pizza-red hover:bg-pizza-red/90 text-white py-3.5 px-6 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-pizza-red/20 cursor-pointer"
            >
              Seguir Mi Pedido en Vivo 🚀
            </button>
            
            <button
              onClick={() => setOrderSuccess(null)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-3.5 px-6 rounded-2xl font-semibold text-sm transition-all border border-gray-200 cursor-pointer"
            >
              Volver al Menú
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pizza-charcoal text-white pb-24 relative">
      {/* -------------------- INTERFAZ DESKTOP (MD y superior) -------------------- */}
      <div className="hidden md:block">
        {/* Navbar de marca */}
        <header className="sticky top-0 z-40 bg-pizza-charcoal/90 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {businessConfig.logoUrl ? (
              <img 
                src={businessConfig.logoUrl} 
                alt="Logo" 
                className="w-8 h-8 rounded-full object-cover border border-white/10" 
                onError={(e) => { e.target.style.display = 'none'; }} 
              />
            ) : (
              <span className="text-2xl">🍕</span>
            )}
            <div>
              <h1 className="font-pizza-title text-xl font-bold text-white leading-none">
                {businessConfig.name || "Pizza Hub"}
              </h1>
              <span className="text-[10px] text-pizza-gold font-medium uppercase tracking-wider">
                Auténtico Sabor
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsTrackModalOpen(true)}
              className="flex items-center gap-1.5 bg-[#181818] border border-white/10 hover:bg-white/5 text-white/80 text-xs font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer"
            >
              <Search size={14} className="text-[#ffd79b]" />
              Seguir Pedido
            </button>

            <button
              onClick={() => setCartOpen(true)}
              className="relative bg-pizza-red/10 border border-pizza-red/20 text-pizza-red hover:bg-pizza-red/20 p-2.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center"
            >
              <ShoppingBag size={20} />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-pizza-gold text-pizza-charcoal text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                  {cart.reduce((acc, item) => acc + item.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Hero Banner */}
        <section className="px-6 pt-8 pb-4">
          <div className="relative rounded-3xl overflow-hidden glass-panel border border-white/10 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-br from-pizza-red/20 to-pizza-gold/5">
            <div>
              <span className="bg-pizza-red/20 border border-pizza-red/30 text-pizza-red text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">
                Promociones Activas
              </span>
              <h2 className="font-pizza-title text-2xl md:text-3xl font-extrabold text-white leading-tight mb-2">
                ¡Descuentos Progresivos en todo el Menú!
              </h2>
              <p className="text-xs text-white/60 max-w-lg">
                Ahorra automáticamente en tu total al agregar más productos. 
                {couponCode ? (
                  <> Tienes el cupón <strong className="text-pizza-gold">{couponCode}</strong> activado.</>
                ) : (
                  <> Usa un código de cupón disponible abajo para obtener descuentos adicionales.</>
                )}
              </p>
            </div>
            {businessConfig.discounts?.autoDiscounts?.length > 0 && (
              <div className="flex gap-2.5 shrink-0 bg-black/40 border border-white/5 rounded-2xl p-3 text-xs">
                {(businessConfig.discounts.autoDiscounts).map((rule, idx, arr) => (
                  <div 
                    key={idx} 
                    className={`text-center px-2.5 ${idx < arr.length - 1 ? "border-r border-white/10" : ""}`}
                  >
                    <span className="block text-pizza-gold font-bold text-sm">
                      &gt; {formatCurrency(rule.minAmount, businessConfig.currency)}
                    </span>
                    <span className="text-[10px] text-white/50">{rule.discountPercent}% OFF</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Sección de Cupones y Ofertas */}
        {availableCoupons.length > 0 && (
          <section className="px-6 py-4 space-y-4">
            <h3 className="font-pizza-title text-base font-bold text-white flex items-center gap-1.5">
              <Percent size={18} className="text-pizza-gold" />
              Cupones Disponibles
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableCoupons.map(([code, discount]) => (
                <div 
                  key={code} 
                  className="relative bg-gradient-to-r from-pizza-red/5 to-pizza-gold/5 border border-pizza-red/10 rounded-2xl p-4 flex items-center justify-between overflow-hidden shadow-sm hover:shadow-md transition-all group"
                >
                  {/* Perforaciones circulares de ticket */}
                  <div className="absolute top-1/2 -translate-y-1/2 -left-3 w-6 h-6 rounded-full bg-pizza-charcoal border-r border-pizza-red/10 z-10"></div>
                  <div className="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 rounded-full bg-pizza-charcoal border-l border-pizza-red/10 z-10"></div>
                  
                  {/* Línea divisoria punteada */}
                  <div className="absolute top-0 bottom-0 left-[72%] border-l-2 border-dashed border-pizza-red/10"></div>

                  <div className="flex-1 pr-6 flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-xl bg-pizza-red/10 flex items-center justify-center text-pizza-red shrink-0">
                      <Tag size={18} />
                    </div>
                    <div>
                      <span className="text-[9px] text-pizza-red font-black uppercase tracking-wider block">CUPÓN EXCLUSIVO</span>
                      <h4 className="text-sm font-extrabold text-white">{code}</h4>
                      <p className="text-[10px] text-white/50">{discount}% de descuento en tu total</p>
                    </div>
                  </div>

                  <div className="pl-4 shrink-0 flex flex-col items-center justify-center min-w-[80px]">
                    {couponCode === code ? (
                      <span className="text-[9px] bg-green-500/10 border border-green-500/35 text-green-600 font-bold px-2 py-1 rounded-lg flex items-center gap-1 select-none">
                        <Check size={10} />
                        Aplicado
                      </span>
                    ) : (
                      <button
                        onClick={() => applyCoupon(code)}
                        className="text-[9px] bg-pizza-red hover:bg-pizza-red/90 text-white font-black px-3 py-1.5 rounded-xl transition-all cursor-pointer border-0"
                      >
                        Aplicar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Selector de Categorías */}
        <section className="px-6 py-4 overflow-x-auto flex gap-2 sticky top-[72px] z-30 bg-pizza-charcoal/95 backdrop-blur-md">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-5 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 border ${
                activeCategory === cat.id
                  ? "bg-pizza-red border-pizza-red text-white shadow-lg shadow-pizza-red/20"
                  : "bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </section>

        {/* Grid de Productos */}
        {/* Buscador de Productos */}
        <section className="px-6 py-2">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input
              type="text"
              placeholder="Buscar especialidad o ingrediente..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="w-full bg-[#181818]/60 border border-white/5 focus:border-pizza-gold/40 focus:ring-1 focus:ring-pizza-gold/40 text-white rounded-2xl pl-11 pr-10 py-3 text-sm placeholder-white/20 outline-none transition-all"
            />
            {clientSearch && (
              <button
                onClick={() => setClientSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 p-1 cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </section>

        <main className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-center glass-panel rounded-3xl p-8 border border-white/5">
              <span className="text-5xl mb-4">🍕🔍</span>
              <h4 className="font-pizza-title text-lg font-bold text-white">No encontramos esa combinación</h4>
              <p className="text-sm text-white/40 mt-2 max-w-sm">
                No hay productos en esta sección que coincidan con tu búsqueda. Prueba con otro nombre o borra el filtro.
              </p>
              <button
                onClick={() => {
                  setClientSearch("");
                  setActiveCategory("all");
                }}
                className="mt-6 px-6 py-3 bg-pizza-red text-white text-xs font-bold rounded-2xl hover:bg-pizza-red/90 transition-all cursor-pointer shadow-lg shadow-pizza-red/20 uppercase tracking-wider"
              >
                Ver todo el menú
              </button>
            </div>
          ) : (
            filteredProducts.map((prod) => {
              const hasDiscount = prod.discount > 0;
              const discountedPrice = hasDiscount ? prod.price * (1 - prod.discount / 100) : prod.price;
              const isOutOfStock = prod.stock !== undefined && prod.stock <= 0;

              return (
                <div
                  key={prod.id}
                  className={`glass-panel rounded-3xl overflow-hidden border border-white/5 hover:border-white/15 transition-all duration-300 flex flex-col group ${isOutOfStock ? "opacity-60" : ""}`}
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-pizza-dark">
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isOutOfStock ? "grayscale" : ""}`}
                    />
                    {hasDiscount && !isOutOfStock && (
                      <div className="absolute top-4 left-4 bg-pizza-red text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1">
                        <Tag size={10} />
                        {prod.discount}% OFF
                      </div>
                    )}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="bg-pizza-red text-white text-xs font-black px-3.5 py-1.5 rounded-full uppercase tracking-widest shadow-lg">
                          Agotado
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-pizza-title text-lg font-bold text-white mb-2 group-hover:text-pizza-gold transition-colors">
                        {prod.name}
                      </h3>
                      <p className="text-xs text-white/60 line-clamp-3 mb-4">
                        {prod.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex flex-col">
                        {hasDiscount ? (
                          <>
                            <span className="text-[10px] text-white/40 line-through">
                              {formatCurrency(prod.price, businessConfig.currency)}
                            </span>
                            <span className="text-lg font-extrabold text-pizza-gold">
                              {formatCurrency(discountedPrice, businessConfig.currency)}
                            </span>
                          </>
                        ) : (
                          <span className="text-lg font-extrabold text-pizza-gold">
                            {formatCurrency(prod.price, businessConfig.currency)}
                          </span>
                        )}
                      </div>

                      {isOutOfStock ? (
                        <span className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-2xl text-xs font-bold select-none">
                          Agotado
                        </span>
                      ) : (
                        <button
                          onClick={() => handleOpenCustomize(prod)}
                          className="bg-[#ffd79b]/10 hover:bg-pizza-red hover:border-pizza-red border border-[#ffd79b]/20 text-[#ffd79b] hover:text-white px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                        >
                          Agregar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </main>

        {/* Pie de página Desktop */}
        <footer className="py-8 mt-12 border-t border-white/5 text-center text-xs text-white/30 space-y-2">
          <p>© 2026 {businessConfig.name || "Pizza Hub"} - Todos los derechos reservados.</p>
          <p>
            <a href="#/login" className="hover:text-pizza-gold transition-colors font-medium">
              Acceso Personal (POS / KDS / Admin)
            </a>
          </p>
        </footer>
      </div>

      {/* -------------------- INTERFAZ MÓVIL (Menor a MD) -------------------- */}
      <div className="md:hidden flex flex-col min-h-screen pb-16">
        {/* Cabecera Móvil Estilo Burger King */}
        <header className="sticky top-0 z-40 bg-pizza-charcoal/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setInfoDrawerOpen(true)}
            className="p-2 hover:bg-white/5 rounded-xl text-white/70 hover:text-white cursor-pointer"
          >
            <Menu size={20} />
          </button>
          
          <div className="flex items-center gap-1.5 justify-center">
            {businessConfig.logoUrl ? (
              <img 
                src={businessConfig.logoUrl} 
                alt="Logo" 
                className="w-6 h-6 rounded-full object-cover border border-white/10" 
                onError={(e) => { e.target.style.display = 'none'; }} 
              />
            ) : (
              <span className="text-xl">🍕</span>
            )}
            <span className="font-pizza-title text-base font-black uppercase tracking-wider text-white">
              {businessConfig.name || "Pizza Hub"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsTrackModalOpen(true)}
              className="p-2 hover:bg-white/5 rounded-xl text-[#ffd79b] cursor-pointer border-0 bg-transparent"
              title="Seguir mi pedido"
            >
              <Search size={20} />
            </button>
            <a
              href="#/login"
              className="p-2 hover:bg-white/5 rounded-xl text-white/70 hover:text-white cursor-pointer"
            >
              <User size={20} />
            </a>
          </div>
        </header>

        {/* Contenido de Pestañas Móviles */}
        <div className="flex-1 px-4 py-4 overflow-y-auto">
          {activeMobileTab === "home" && (
            <div className="space-y-6">
              {/* Gran Banner de bienvenida */}
              <div className="relative rounded-3xl overflow-hidden border border-white/10 p-5 bg-gradient-to-br from-pizza-red/20 to-pizza-gold/5 flex flex-col justify-between min-h-[160px]">
                <div className="space-y-1">
                  <span className="bg-pizza-gold text-pizza-charcoal text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Especial de la Casa
                  </span>
                  <h2 className="font-pizza-title text-xl font-black text-white leading-tight">
                    La Trufada Real
                  </h2>
                  <p className="text-[11px] text-white/70 max-w-[200px]">
                    Sabor gourmet con salsa de trufa negra, champiñones y mozzarella. ¡10% OFF hoy!
                  </p>
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-lg font-black text-pizza-gold">
                    {formatCurrency(22.50, businessConfig.currency)}
                  </span>
                  <button 
                    onClick={() => {
                      const trufada = products.find(p => p.name?.toLowerCase().includes("trufada"));
                      if (trufada) handleOpenCustomize(trufada);
                      else setActiveMobileTab("menu");
                    }}
                    className="bg-pizza-red text-white text-[11px] font-bold px-3 py-1.5 rounded-xl hover:bg-pizza-red/90 transition-all cursor-pointer"
                  >
                    Ver Más
                  </button>
                </div>
              </div>

              {/* Botones Gigantes de Pedido (Estilo Burger King) */}
              <div className="grid grid-cols-2 gap-3.5">
                <button
                  onClick={() => {
                    setServiceMode("pickup");
                    setActiveMobileTab("menu");
                  }}
                  className="flex flex-col items-center justify-center gap-2 p-5 bg-white/5 border border-white/10 rounded-2xl hover:border-pizza-gold/40 transition-all active:scale-95 group text-center"
                >
                  <span className="text-3xl filter drop-shadow">🥡</span>
                  <span className="font-bold text-xs text-white group-hover:text-pizza-gold">Para Llevar</span>
                  <span className="text-[9px] text-white/40">Recoge en tienda</span>
                </button>
                <button
                  onClick={() => {
                    setServiceMode("delivery");
                    setActiveMobileTab("menu");
                  }}
                  className="flex flex-col items-center justify-center gap-2 p-5 bg-white/5 border border-white/10 rounded-2xl hover:border-pizza-red/40 transition-all active:scale-95 group text-center"
                >
                  <span className="text-3xl filter drop-shadow">🛵</span>
                  <span className="font-bold text-xs text-white group-hover:text-pizza-gold">Pedir Delivery</span>
                  <span className="text-[9px] text-white/40">Envío rápido a casa</span>
                </button>
              </div>

              {/* Recomendados / Más Vendidos */}
              <div className="space-y-3">
                <h3 className="font-pizza-title text-sm font-bold text-white flex items-center gap-1">
                  🔥 Recomendadas
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-2 shrink-0 scrollbar-none">
                  {products.slice(0, 4).map((prod) => {
                    const isOutOfStock = prod.stock !== undefined && prod.stock <= 0;
                    return (
                      <div 
                        key={prod.id} 
                        className={`w-40 bg-[#181818] border border-white/5 rounded-2xl p-3 flex flex-col justify-between shrink-0 hover:border-pizza-gold/20 transition-all ${isOutOfStock ? "opacity-60" : ""}`}
                      >
                        <div className="aspect-video w-full rounded-xl overflow-hidden bg-pizza-dark relative mb-2">
                          <img src={prod.imageUrl} alt={prod.name} className={`w-full h-full object-cover ${isOutOfStock ? "grayscale" : ""}`} />
                          {isOutOfStock && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <span className="bg-pizza-red text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">
                                Agotado
                              </span>
                            </div>
                          )}
                        </div>
                        <h4 className="font-bold text-[11px] text-white truncate leading-tight">{prod.name}</h4>
                        <div className="flex justify-between items-center mt-2.5">
                          <span className="text-[11px] font-black text-pizza-gold">
                            {formatCurrency(prod.price * (1 - (prod.discount || 0)/100), businessConfig.currency)}
                          </span>
                          {isOutOfStock ? (
                            <span className="text-[9px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg font-bold select-none">
                              Agotado
                            </span>
                          ) : (
                            <button 
                              onClick={() => handleOpenCustomize(prod)}
                              className="bg-white/5 hover:bg-pizza-gold/15 hover:text-pizza-gold text-[9px] font-bold px-2 py-1 rounded-lg border border-white/10 cursor-pointer"
                            >
                              + Pedir
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeMobileTab === "menu" && (
            <div className="space-y-4">
              {/* Categorías en mobile */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 shrink-0 scrollbar-none sticky top-14 bg-pizza-charcoal z-10 py-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border shrink-0 transition-all cursor-pointer ${
                      activeCategory === cat.id
                        ? "bg-pizza-red border-pizza-red text-white shadow-lg shadow-pizza-red/20"
                        : "bg-gray-50 border-gray-200 text-gray-600"
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
                  placeholder="Buscar pizza o plato..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full bg-[#181818]/60 border border-white/5 focus:border-pizza-gold/40 focus:ring-1 focus:ring-pizza-gold/40 text-white rounded-xl pl-9 pr-8 py-2 text-xs placeholder-white/20 outline-none transition-all"
                />
                {clientSearch && (
                  <button
                    onClick={() => setClientSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 p-0.5 cursor-pointer transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Grid de pizzas en mobile */}
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.length === 0 ? (
                  <div className="col-span-full py-8 flex flex-col items-center justify-center text-center bg-[#181818]/40 border border-white/5 rounded-2xl p-4">
                    <span className="text-3xl mb-2">🍕🔍</span>
                    <h4 className="font-bold text-xs text-white">Sin resultados</h4>
                    <p className="text-[10px] text-white/40 mt-1 max-w-[200px]">
                      No encontramos coincidencias para esta búsqueda.
                    </p>
                    <button
                      onClick={() => {
                        setClientSearch("");
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
                    const isOutOfStock = prod.stock !== undefined && prod.stock <= 0;
                    return (
                      <div 
                        key={prod.id}
                        onClick={() => {
                          if (isOutOfStock) return;
                          handleOpenCustomize(prod);
                        }}
                        className={`bg-[#181818] border border-white/5 rounded-2xl p-3 flex flex-col justify-between hover:border-white/15 transition-all cursor-pointer group ${isOutOfStock ? "opacity-60" : ""}`}
                      >
                        <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-pizza-dark mb-2">
                          <img src={prod.imageUrl} alt={prod.name} className={`w-full h-full object-cover ${isOutOfStock ? "grayscale" : ""}`} />
                          {prod.discount > 0 && !isOutOfStock && (
                            <span className="absolute top-1 left-1 bg-pizza-red text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white">
                              -{prod.discount}%
                            </span>
                          )}
                          {isOutOfStock && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <span className="bg-pizza-red text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                                Agotado
                              </span>
                            </div>
                          )}
                        </div>
                        <h4 className="font-bold text-xs text-white truncate leading-tight group-hover:text-pizza-gold transition-colors">
                          {prod.name}
                        </h4>
                        <p className="text-[9px] text-white/50 line-clamp-1 mt-0.5 mb-2 leading-none">
                          {prod.description}
                        </p>
                        <div className="flex justify-between items-center mt-auto pt-1.5 border-t border-white/5">
                          <span className="text-xs font-black text-pizza-gold">
                            {formatCurrency(discountedPrice, businessConfig.currency)}
                          </span>
                          {isOutOfStock ? (
                            <span className="text-[9px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-md font-bold select-none">
                              Agotado
                            </span>
                          ) : (
                            <span className="text-[9px] text-[#ffd79b] bg-[#ffd79b]/10 border border-[#ffd79b]/25 px-1.5 py-0.5 rounded-md font-bold">
                              + Pedir
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeMobileTab === "offers" && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="font-pizza-title text-base font-bold text-white flex items-center gap-1.5">
                  <Percent size={16} className="text-pizza-gold" />
                  Cupones y Ofertas
                </h3>
                <p className="text-[11px] text-white/50">Aplica códigos promocionales y ahorra en tu pizza.</p>
              </div>

              {/* Cupón en móvil */}
              <div className="bg-[#181818] border border-white/5 rounded-2xl p-4 space-y-3 text-left">
                <h4 className="text-xs font-bold text-white">Ingresa tu Cupón</h4>
                {couponCode ? (
                  <div className="flex items-center justify-between bg-pizza-gold/10 border border-pizza-gold/25 rounded-xl p-3 text-xs text-pizza-gold font-bold">
                    <span className="flex items-center gap-1.5">
                      <Tag size={14} />
                      {couponCode} (-{couponDiscount}%)
                    </span>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="text-[10px] bg-pizza-gold/20 hover:bg-pizza-gold/30 px-2 py-1 rounded-lg cursor-pointer"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ej: PIZZALOVE"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      className="flex-1 bg-pizza-dark/80 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red"
                    />
                    <button
                      type="submit"
                      className="bg-pizza-red hover:bg-pizza-red/90 px-4 rounded-xl text-xs font-bold text-white transition-all cursor-pointer border-0"
                    >
                      Aplicar
                    </button>
                  </form>
                )}
                {couponError && (
                  <span className="text-[10px] text-pizza-red font-semibold block">{couponError}</span>
                )}
              </div>

              {/* Cupones Disponibles en móvil */}
              {availableCoupons.length > 0 && (
                <div className="space-y-3 text-left">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white/40">Cupones Disponibles</h4>
                  <div className="space-y-2.5">
                    {availableCoupons.map(([code, discount]) => (
                      <div 
                        key={code} 
                        className="relative bg-gradient-to-r from-pizza-red/5 to-pizza-gold/5 border border-pizza-red/10 rounded-2xl p-4 flex items-center justify-between overflow-hidden shadow-sm"
                      >
                        <div className="absolute top-1/2 -translate-y-1/2 -left-3 w-6 h-6 rounded-full bg-pizza-charcoal border-r border-pizza-red/10 z-10"></div>
                        <div className="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 rounded-full bg-pizza-charcoal border-l border-pizza-red/10 z-10"></div>
                        <div className="absolute top-0 bottom-0 left-[70%] border-l border-dashed border-pizza-red/10"></div>

                        <div className="flex-1 pr-4 flex items-center gap-2.5 text-left">
                          <div className="w-8 h-8 rounded-lg bg-pizza-red/10 flex items-center justify-center text-pizza-red shrink-0">
                            <Tag size={16} />
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-white">{code}</h4>
                            <p className="text-[9px] text-white/55">{discount}% de descuento en tu total</p>
                          </div>
                        </div>

                        <div className="pl-3 shrink-0 flex flex-col items-center justify-center min-w-[70px]">
                          {couponCode === code ? (
                            <span className="text-[8px] bg-green-500/10 border border-green-500/35 text-green-600 font-bold px-1.5 py-1 rounded flex items-center gap-0.5 select-none">
                              <Check size={8} />
                              Aplicado
                            </span>
                          ) : (
                            <button
                              onClick={() => applyCoupon(code)}
                              className="text-[8px] bg-pizza-red hover:bg-pizza-red/90 text-white font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer border-0"
                            >
                              Aplicar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Descuentos progresivos informativos */}
              {businessConfig.discounts?.autoDiscounts?.length > 0 && (
                <div className="space-y-2.5 text-left">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white/40">Descuentos Progresivos</h4>
                  <div className="space-y-2">
                    {businessConfig.discounts.autoDiscounts.map((rule, idx) => {
                      const emojis = ["🍕", "👑", "💎", "⭐", "🎉"];
                      const emoji = emojis[idx % emojis.length];
                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{emoji}</span>
                            <div>
                              <span className="text-xs font-semibold block">
                                Compras &gt; {formatCurrency(rule.minAmount, businessConfig.currency)}
                              </span>
                              <span className="text-[9px] text-white/40">
                                Descuento automático del {rule.discountPercent}%
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-extrabold text-pizza-gold">{rule.discountPercent}% OFF</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeMobileTab === "fidelizacion" && (
            <div className="flex flex-col items-center justify-center space-y-6 py-4">
              <div className="text-center space-y-1">
                <h3 className="font-pizza-title text-base font-bold text-white flex items-center justify-center gap-1.5">
                  <Crown size={16} className="text-pizza-gold" />
                  Pizza Club Fidelidad
                </h3>
                <p className="text-[11px] text-white/50">Acumula 10% de tus compras en puntos.</p>
              </div>

              {/* Tarjeta de fidelidad digital */}
              <div className="w-full max-w-sm rounded-3xl p-5 border border-white/10 shadow-2xl relative overflow-hidden bg-gradient-to-br from-[#1c1c1c] via-[#2d2417] to-[#121212] text-left">
                <div className="absolute top-0 right-0 w-32 h-32 bg-pizza-gold/5 rounded-full blur-2xl pointer-events-none" />
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-pizza-gold text-[9px] font-bold uppercase tracking-widest block">PIZZA CLUB MEMBER</span>
                    <span className="text-xs font-bold text-white">Hamilton POS Club</span>
                  </div>
                  <span className="text-xl">🍕</span>
                </div>

                <div className="mb-4">
                  <span className="text-[9px] text-white/40 uppercase block">Saldo de Puntos</span>
                  <span className="text-xl font-black text-pizza-gold">850 Puntos</span>
                </div>

                <div className="flex justify-between items-end">
                  <span className="font-mono text-[10px] text-white/60 tracking-widest">ID: 9812-4029-1102</span>
                  <span className="bg-pizza-gold/20 border border-pizza-gold/30 text-pizza-gold text-[9px] font-bold px-2 py-0.5 rounded-md uppercase">
                    Socio Oro
                  </span>
                </div>
              </div>

              {/* QR Code */}
              <div className="bg-white p-4 rounded-2xl shadow-xl flex flex-col items-center gap-2">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin)}`} 
                  alt="QR Club" 
                  className="w-36 h-36"
                />
                <span className="text-[9px] text-black/60 font-mono tracking-widest uppercase mt-1">Hamilton vCard</span>
              </div>
            </div>
          )}

          {activeMobileTab === "cart" && (
            <div className="space-y-6 text-left">
              <h3 className="font-pizza-title text-base font-bold text-white flex items-center gap-1.5">
                <ShoppingBag size={18} className="text-pizza-gold" />
                Tu Carrito de Compra
              </h3>

              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-white/40 space-y-4">
                  <ShoppingBag size={44} className="text-white/10" />
                  <p className="text-xs">Tu pedido está vacío en este momento</p>
                  <button 
                    onClick={() => setActiveMobileTab("menu")}
                    className="bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer border-0"
                  >
                    Explorar Carta
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Lista de productos en mobile */}
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div 
                        key={item.cartId} 
                        className="bg-white/5 border border-white/5 rounded-2xl p-3 flex justify-between items-start text-xs"
                      >
                        <div className="flex-1 pr-2">
                          <h4 className="font-bold text-white text-xs">{item.name}</h4>
                          <span className="text-xs text-pizza-gold font-bold block mt-0.5">
                            {formatCurrency(item.price, businessConfig.currency)} x {item.quantity}
                          </span>
                          
                          {Object.keys(item.optionsSelected).length > 0 && (
                            <div className="text-[10px] text-white/40 mt-1">
                              {Object.entries(item.optionsSelected).map(([k,v]) => `${k}: ${v}`).join(", ")}
                            </div>
                          )}
                          
                          {item.comboItems && item.comboItems.length > 0 && (
                            <div className="text-[10px] text-pizza-gold/60 mt-1">
                              Combo: {item.comboItems.join(" + ")}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-3 justify-between">
                          <button 
                            onClick={() => removeFromCart(item.cartId)}
                            className="p-1 text-white/30 hover:text-pizza-red transition-colors border-0 bg-transparent cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                          
                          <div className="flex items-center gap-1.5 bg-pizza-charcoal rounded-lg p-0.5">
                            <button
                              onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                              className="p-0.5 text-white/50 hover:text-white border-0 bg-transparent cursor-pointer"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="text-[11px] font-bold w-4 text-center">{item.quantity}</span>
                            <button
                              onClick={() => {
                                const currentProduct = products.find(p => p.id === item.id);
                                const availableStock = currentProduct?.stock !== undefined ? currentProduct.stock : 9999;
                                if (item.quantity + 1 > availableStock) {
                                  alert(`No hay más stock disponible. El stock máximo es ${availableStock}.`);
                                  return;
                                }
                                updateQuantity(item.cartId, item.quantity + 1);
                              }}
                              className="p-0.5 text-white/50 hover:text-white border-0 bg-transparent cursor-pointer"
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Modalidad de Entrega en mobile */}
                  <div className="space-y-1.5 pt-4 border-t border-white/5">
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-white/40">
                      Modalidad de Entrega
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setServiceMode("pickup")}
                        className={`py-2 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                          serviceMode === "pickup"
                            ? "bg-pizza-red/10 border-pizza-red text-pizza-red font-bold"
                            : "bg-pizza-dark/80 border-white/5 text-white/70"
                        }`}
                      >
                        Llevar 🥡
                      </button>
                      <button
                        onClick={() => setServiceMode("delivery")}
                        className={`py-2 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                          serviceMode === "delivery"
                            ? "bg-pizza-red/10 border-pizza-red text-pizza-red font-bold"
                            : "bg-pizza-dark/80 border-white/5 text-white/70"
                        }`}
                      >
                        Delivery 🚀
                      </button>
                      <button
                        onClick={() => setServiceMode("dinein")}
                        className={`py-2 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                          serviceMode === "dinein"
                            ? "bg-pizza-red/10 border-pizza-red text-pizza-red font-bold"
                            : "bg-pizza-dark/80 border-white/5 text-white/70"
                        }`}
                      >
                        En Mesa 🍽️
                      </button>
                    </div>
                  </div>

                  {/* Datos del Cliente y Checkout */}
                  <form onSubmit={handleSubmitOrder} className="space-y-4 pt-4 border-t border-white/5">
                    <div className="space-y-3">
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Tu Nombre Completo"
                        className="w-full bg-pizza-dark/80 border border-white/5 rounded-xl px-3.5 py-2.5 text-white text-xs placeholder-white/20 focus:outline-none focus:border-pizza-red"
                      />
                      <input
                        type="text"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Teléfono (WhatsApp)"
                        className="w-full bg-pizza-dark/80 border border-white/5 rounded-xl px-3.5 py-2.5 text-white text-xs placeholder-white/20 focus:outline-none focus:border-pizza-red"
                      />

                      {serviceMode === "delivery" && (
                        <div className="space-y-2">
                          <MapboxSearch />
                          {shippingDistance > 0 && (
                            <div className="bg-pizza-gold/5 border border-pizza-gold/15 rounded-xl p-3 flex flex-col gap-1 text-[11px] text-[#ffd79b]">
                              <span>🚀 Distancia: <strong>{shippingDistance.toFixed(2)} km</strong></span>
                              <span>💵 Costo de Envío: <strong>{formatCurrency(shippingCost, businessConfig.currency)}</strong></span>
                            </div>
                          )}
                        </div>
                      )}

                      {serviceMode === "dinein" && (
                        <select
                          required
                          value={tableNumber}
                          onChange={(e) => setTableNumber(e.target.value)}
                          className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-pizza-red"
                        >
                          <option value="">Selecciona tu Mesa</option>
                          {tablesList.map((t) => (
                            <option key={t.id} value={t.name} disabled={t.status === "ocupada"}>
                              {t.name} {t.status === "ocupada" ? "(Ocupada)" : "(Libre)"}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Método de pago */}
                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-white/40">
                          Método de Pago
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("cash")}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                              paymentMethod === "cash"
                                ? "bg-pizza-gold/15 border-pizza-gold text-[#ffd79b] font-bold"
                                : "bg-pizza-dark/80 border-white/5 text-white/70"
                            }`}
                          >
                            💵 Efectivo
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("yape")}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                              paymentMethod === "yape"
                                ? "bg-pizza-gold/15 border-pizza-gold text-[#ffd79b] font-bold"
                                : "bg-pizza-dark/80 border-white/5 text-white/70"
                            }`}
                          >
                            📱 Yape/Plin
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("transfer")}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                              paymentMethod === "transfer"
                                ? "bg-pizza-gold/15 border-pizza-gold text-[#ffd79b] font-bold"
                                : "bg-pizza-dark/80 border-white/5 text-white/70"
                            }`}
                          >
                            💳 Transf.
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Resumen de totales */}
                    <div className="bg-pizza-dark/80 border border-white/5 rounded-2xl p-4 space-y-2 mt-4 text-xs">
                      <div className="flex justify-between text-white/60">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(totals.subtotal, businessConfig.currency)}</span>
                      </div>
                      
                      {totals.totalDiscount > 0 && (
                        <div className="flex justify-between text-pizza-red font-semibold">
                          <span>Descuentos:</span>
                          <span>-{formatCurrency(totals.totalDiscount, businessConfig.currency)}</span>
                        </div>
                      )}

                      {serviceMode === "delivery" && (
                        <div className="flex justify-between text-white/60">
                          <span>Envío (Delivery):</span>
                          <span>{formatCurrency(totals.shippingCost, businessConfig.currency)}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-white/5">
                        <span>TOTAL:</span>
                        <span className="text-pizza-gold">{formatCurrency(totals.total, businessConfig.currency)}</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loadingOrder}
                      className="w-full bg-pizza-red hover:bg-pizza-red/90 text-white rounded-2xl py-3.5 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-pizza-red/20 disabled:opacity-50 border-0"
                    >
                      {loadingOrder ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          Realizar Pedido
                          <ChevronRight size={14} />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Barra de Navegación Inferior Estilo Burger King */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#141414]/90 backdrop-blur-xl border-t border-white/10 pb-safe pt-2 px-3 flex justify-between items-center text-[10px]">
          <button
            onClick={() => setActiveMobileTab("home")}
            className={`flex flex-col items-center gap-1.5 flex-1 border-0 bg-transparent py-1 cursor-pointer ${
              activeMobileTab === "home" ? "text-pizza-gold font-extrabold scale-105" : "text-white/40"
            }`}
          >
            <Home size={18} />
            <span>Inicio</span>
          </button>

          <button
            onClick={() => setActiveMobileTab("menu")}
            className={`flex flex-col items-center gap-1.5 flex-1 border-0 bg-transparent py-1 cursor-pointer ${
              activeMobileTab === "menu" ? "text-pizza-gold font-extrabold scale-105" : "text-white/40"
            }`}
          >
            <span className="text-sm leading-none shrink-0 filter drop-shadow">🍕</span>
            <span>Carta</span>
          </button>

          <button
            onClick={() => setActiveMobileTab("fidelizacion")}
            className={`flex flex-col items-center gap-1.5 flex-1 border-0 bg-transparent py-1 cursor-pointer ${
              activeMobileTab === "fidelizacion" ? "text-pizza-gold font-extrabold scale-105" : "text-white/40"
            }`}
          >
            <QrCode size={18} />
            <span>Club QR</span>
          </button>

          <button
            onClick={() => setActiveMobileTab("offers")}
            className={`flex flex-col items-center gap-1.5 flex-1 border-0 bg-transparent py-1 cursor-pointer ${
              activeMobileTab === "offers" ? "text-pizza-gold font-extrabold scale-105" : "text-white/40"
            }`}
          >
            <Percent size={18} />
            <span>Promos</span>
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
        </nav>
      </div>

      {/* Info Drawer (Modal Lateral de Contacto en Mobile) */}
      {infoDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex">
          <div className="w-80 bg-[#161616] border-r border-white/10 h-full p-6 flex flex-col justify-between shadow-2xl animate-slide-in text-left">
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-white/5">
                <span className="font-pizza-title text-base font-bold text-white">Información</span>
                <button onClick={() => setInfoDrawerOpen(false)} className="text-white/50 hover:text-white border-0 bg-transparent cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-pizza-gold mb-1">Pizzería</h4>
                  <p className="text-white/80">{businessConfig.name || "Pizza Hub & Co."}</p>
                  <p className="text-white/60 mt-0.5">{businessConfig.address || "Av. del Sabor 789, Ciudad Pizza"}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-pizza-gold mb-1">Contacto</h4>
                  <p className="text-white/80">WhatsApp: {businessConfig.whatsappNumber || "+51 999 999 999"}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-pizza-gold mb-1">Horario de Atención</h4>
                  <p className="text-white/80">Lunes a Domingo: 12:00 PM - 11:00 PM</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <a 
                href="#/login" 
                onClick={() => setInfoDrawerOpen(false)}
                className="flex items-center justify-center gap-1.5 w-full bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl py-3 text-xs font-bold text-gray-800 transition-colors"
              >
                <User size={14} />
                Acceso Personal
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Personalización (Común) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#181818] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] relative">
            
            {/* Botón de Cerrar Absoluto */}
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 z-20 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white/80 hover:text-white cursor-pointer border-0 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Cabecera con Imagen (si existe) */}
            {selectedProduct.imageUrl ? (
              <div className="relative h-44 w-full shrink-0">
                <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/45 to-black/25" />
                <div className="absolute bottom-4 left-5 right-5 text-left">
                  <h3 className="font-pizza-title text-xl font-bold text-white drop-shadow">
                    {selectedProduct.name}
                  </h3>
                  {selectedProduct.description && (
                    <p className="text-[11px] text-white/70 line-clamp-2 mt-1 leading-normal max-w-md">
                      {selectedProduct.description}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-5 border-b border-white/5 text-left shrink-0">
                <div>
                  <h3 className="font-pizza-title text-lg font-bold text-white">
                    Personalizar: {selectedProduct.name}
                  </h3>
                  {selectedProduct.description && (
                    <p className="text-xs text-white/50 mt-1 max-w-xs">{selectedProduct.description}</p>
                  )}
                </div>
              </div>
            )}

            {/* Contenido Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
              {/* Opciones del Producto */}
              {selectedProduct.options && Object.entries(selectedProduct.options).map(([groupName, values]) => (
                <div key={groupName} className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white/40">
                    Elige tu {groupName}:
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    {values.map((val) => {
                      const isSelected = optionsSelected[groupName] === val;
                      const extraPrice = getOptionPriceAdjustment(val);
                      const cleanedLabel = val.replace(/\s*\(\+\s*\$?\s*[0-9.]+\)/, "").trim();

                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleOptionChange(groupName, val)}
                          className={`px-4 py-3 rounded-2xl text-xs font-semibold border transition-all cursor-pointer flex flex-col justify-between text-left h-16 ${
                            isSelected
                              ? "bg-pizza-gold/10 border-pizza-gold text-[#ffd79b] font-black shadow-md shadow-pizza-gold/5"
                              : "bg-[#111111] border-white/5 text-white/70 hover:bg-white/5 hover:border-white/10"
                          }`}
                        >
                          <span className="truncate w-full">{cleanedLabel}</span>
                          {extraPrice > 0 ? (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold self-end border mt-1.5 ${
                              isSelected 
                                ? "bg-pizza-gold/20 border-pizza-gold text-pizza-gold" 
                                : "bg-white/5 border-white/10 text-white/50"
                            }`}>
                              + {formatCurrency(extraPrice, businessConfig.currency)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-white/30 font-medium self-end mt-1.5">
                              Precio Base
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
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white/40">
                    Componentes del Combo:
                  </h4>
                  <div className="space-y-3">
                    {selectedProduct.comboItems.map((itemText, idx) => {
                      const parsed = parseComboItem(itemText);
                      if (parsed.isSelection) {
                        const currentValue = comboItemsSelected[idx] || "";
                        const selectedOption = parsed.options.find(opt => `${parsed.name}: ${opt}` === currentValue || opt === currentValue) || parsed.options[0];
                        
                        return (
                          <div key={idx} className="bg-pizza-dark/40 border border-white/5 rounded-2xl p-4.5 space-y-3">
                            <span className="text-[11px] font-bold text-pizza-gold block uppercase tracking-wider">
                              {parsed.name}
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {parsed.options.map((opt) => {
                                const isSelected = selectedOption === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => handleComboItemChange(idx, `${parsed.name}: ${opt}`)}
                                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                                      isSelected
                                        ? "bg-pizza-red text-white font-extrabold border-pizza-red shadow-md shadow-pizza-red/10"
                                        : "bg-pizza-charcoal border-white/5 text-white/70 hover:bg-white/5"
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
                          <div key={idx} className="bg-pizza-dark/25 border border-white/5 rounded-2xl p-3.5 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-extrabold text-xs">
                                ✓
                              </div>
                              <span className="text-xs text-white/80 font-medium">{parsed.name}</span>
                            </div>
                            <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Incluido
                            </span>
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              )}

              {/* Selector de Cantidad */}
              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <span className="text-xs font-bold uppercase tracking-wider text-white/50">Cantidad:</span>
                <div className="flex items-center gap-4 bg-pizza-dark/80 rounded-2xl border border-white/5 p-1.5">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-1 text-white/60 hover:text-white hover:bg-white/5 rounded-xl cursor-pointer border-0 bg-transparent"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="text-sm font-bold w-6 text-center">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const cartCountForProduct = cart
                        .filter((item) => item.id === selectedProduct.id)
                        .reduce((sum, item) => sum + item.quantity, 0);
                      const availableStock = selectedProduct.stock !== undefined ? selectedProduct.stock : 9999;
                      if (cartCountForProduct + quantity >= availableStock) {
                        alert(`No puedes seleccionar más de ${availableStock} unidades (ya tienes ${cartCountForProduct} en el carrito).`);
                        return;
                      }
                      setQuantity(quantity + 1);
                    }}
                    className="p-1 text-white/60 hover:text-white hover:bg-white/5 rounded-xl cursor-pointer border-0 bg-transparent"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Pie de modal */}
            <div className="p-5 border-t border-white/5 bg-pizza-dark/65 flex items-center justify-between text-left shrink-0">
              <div className="flex flex-col">
                <span className="text-[10px] text-white/40 uppercase font-semibold tracking-wider">Total Adición:</span>
                <span className="text-lg font-black text-pizza-gold">
                  {formatCurrency(getProductPriceWithExtras(selectedProduct, optionsSelected) * quantity, businessConfig.currency)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddToCart}
                className="bg-pizza-red hover:bg-pizza-red/90 text-white rounded-2xl px-6 py-3 font-bold text-xs transition-all cursor-pointer shadow-lg shadow-pizza-red/20 border-0 active:scale-98"
              >
                Agregar al Carrito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cajón lateral del Carrito (Solo visible en Desktop) */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-[#161616] border-l border-white/10 h-full flex flex-col shadow-2xl relative">
            {/* Cabecera Carrito */}
            <div className="flex items-center justify-between p-5 border-b border-white/5 bg-[#161616]">
              <div className="flex items-center gap-2">
                <ShoppingBag className="text-pizza-gold" size={20} />
                <h3 className="font-pizza-title text-base font-bold text-white">Tu Carrito</h3>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="p-1 rounded-full hover:bg-white/5 text-white/50 hover:text-white cursor-pointer border-0 bg-transparent"
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenido Carrito */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 text-left">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-white/40">
                  <ShoppingBag size={48} className="mb-4 text-white/20" />
                  <p className="text-sm font-medium">Tu carrito está vacío</p>
                  <p className="text-xs max-w-xs mt-1">Explora el catálogo y agrega tus pizzas favoritas.</p>
                </div>
              ) : (
                <>
                  {/* Lista de productos */}
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div
                        key={item.cartId}
                        className="flex items-start gap-3 bg-pizza-dark/50 border border-white/5 rounded-2xl p-4 relative"
                      >
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-white">{item.name}</h4>
                          <span className="text-xs font-semibold text-pizza-gold block mt-0.5">
                            {formatCurrency(item.price, businessConfig.currency)}
                          </span>

                          {/* Opciones seleccionadas */}
                          {Object.keys(item.optionsSelected).length > 0 && (
                            <div className="text-[10px] text-white/40 mt-1.5 leading-tight">
                              {Object.entries(item.optionsSelected)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(", ")}
                            </div>
                          )}

                          {/* Items del combo */}
                          {item.comboItems && item.comboItems.length > 0 && (
                            <div className="text-[10px] text-pizza-gold/75 mt-1 bg-pizza-gold/5 border border-pizza-gold/10 px-2.5 py-1.5 rounded-lg">
                              <strong>Combo:</strong> {item.comboItems.join(" + ")}
                            </div>
                          )}
                        </div>

                        {/* Cantidades y eliminación */}
                        <div className="flex flex-col items-end gap-3 justify-between h-full">
                          <button
                            onClick={() => removeFromCart(item.cartId)}
                            className="p-1 text-white/30 hover:text-pizza-red transition-colors cursor-pointer border-0 bg-transparent"
                          >
                            <Trash2 size={14} />
                          </button>
                          
                          <div className="flex items-center gap-2 bg-pizza-charcoal border border-white/5 rounded-xl p-1">
                            <button
                              onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                              className="p-0.5 text-white/60 hover:text-white hover:bg-white/5 rounded cursor-pointer border-0 bg-transparent"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                            <button
                              onClick={() => {
                                const currentProduct = products.find(p => p.id === item.id);
                                const availableStock = currentProduct?.stock !== undefined ? currentProduct.stock : 9999;
                                if (item.quantity + 1 > availableStock) {
                                  alert(`No hay más stock disponible. El stock máximo es ${availableStock}.`);
                                  return;
                                }
                                updateQuantity(item.cartId, item.quantity + 1);
                              }}
                              className="p-0.5 text-white/60 hover:text-white hover:bg-white/5 rounded cursor-pointer border-0 bg-transparent"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Cupón */}
                  <form onSubmit={handleApplyCoupon} className="pt-4 border-t border-white/5 space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
                      Código de Descuento
                    </label>
                    {couponCode ? (
                      <div className="flex items-center justify-between bg-pizza-gold/10 border border-pizza-gold/20 rounded-xl p-3 text-xs text-pizza-gold font-bold">
                        <span className="flex items-center gap-1.5">
                          <Tag size={14} />
                          {couponCode} (-{couponDiscount}%)
                        </span>
                        <button
                          type="button"
                          onClick={removeCoupon}
                          className="text-[10px] bg-pizza-gold/20 hover:bg-pizza-gold/30 px-2 py-1 rounded-lg cursor-pointer border-0"
                        >
                          Remover
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="PIZZALOVE"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value)}
                          className="flex-1 bg-pizza-dark/80 border border-white/5 rounded-xl px-3 py-2.5 text-white text-xs placeholder-white/20 focus:outline-none focus:border-pizza-red"
                        />
                        <button
                          type="submit"
                          className="bg-pizza-red hover:bg-pizza-red/90 text-white px-4 rounded-xl text-xs font-bold transition-all cursor-pointer border-0"
                        >
                          Aplicar
                        </button>
                      </div>
                    )}
                    {!couponCode && availableCoupons.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1.5">
                        <span className="text-[9px] text-white/40 block w-full">Sugeridos:</span>
                        {availableCoupons.map(([code, discount]) => (
                          <button
                            key={code}
                            type="button"
                            onClick={() => applyCoupon(code)}
                            className="text-[9px] bg-pizza-red/10 border border-pizza-red/20 text-pizza-red hover:bg-pizza-red hover:text-white px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer"
                          >
                            {code} (-{discount}%)
                          </button>
                        ))}
                      </div>
                    )}
                    {couponError && (
                      <span className="text-[10px] text-pizza-red font-semibold block">{couponError}</span>
                    )}
                  </form>

                  {/* Tipo de Servicio */}
                  <div className="pt-4 border-t border-white/5 space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
                      Modalidad de Entrega
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setServiceMode("pickup")}
                        className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                          serviceMode === "pickup"
                            ? "bg-pizza-red/10 border-pizza-red text-pizza-red font-bold"
                            : "bg-pizza-dark/80 border-white/5 text-white/70"
                        }`}
                      >
                        🥡 Recojo
                      </button>
                      <button
                        onClick={() => setServiceMode("delivery")}
                        className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                          serviceMode === "delivery"
                            ? "bg-pizza-red/10 border-pizza-red text-pizza-red font-bold"
                            : "bg-pizza-dark/80 border-white/5 text-white/70"
                        }`}
                      >
                        🚀 Delivery
                      </button>
                      <button
                        onClick={() => setServiceMode("dinein")}
                        className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                          serviceMode === "dinein"
                            ? "bg-pizza-red/10 border-pizza-red text-pizza-red font-bold"
                            : "bg-pizza-dark/80 border-white/5 text-white/70"
                        }`}
                      >
                        🍽️ Mesa
                      </button>
                    </div>
                  </div>

                  {/* Formulario de Datos */}
                  <form onSubmit={handleSubmitOrder} className="pt-4 border-t border-white/5 space-y-4">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
                      Datos de Facturación &amp; Envío
                    </label>

                    <div className="space-y-3">
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Tu Nombre Completo"
                        className="w-full bg-pizza-dark/80 border border-white/5 rounded-xl px-3.5 py-2.5 text-white text-xs placeholder-white/20 focus:outline-none focus:border-pizza-red"
                      />
                      <input
                        type="text"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Teléfono (WhatsApp)"
                        className="w-full bg-pizza-dark/80 border border-white/5 rounded-xl px-3.5 py-2.5 text-white text-xs placeholder-white/20 focus:outline-none focus:border-pizza-red"
                      />

                      {serviceMode === "delivery" && (
                        <div className="space-y-2">
                          <MapboxSearch />
                          {shippingDistance > 0 && (
                            <div className="bg-pizza-gold/5 border border-pizza-gold/15 rounded-xl p-3 flex flex-col gap-1 text-[11px] text-[#ffd79b]">
                              <span>🚀 Distancia de Envío: <strong>{shippingDistance.toFixed(2)} km</strong></span>
                              <span>💵 Costo Adicional de Delivery: <strong>{formatCurrency(shippingCost, businessConfig.currency)}</strong></span>
                            </div>
                          )}
                        </div>
                      )}

                      {serviceMode === "dinein" && (
                        <select
                          required
                          value={tableNumber}
                          onChange={(e) => setTableNumber(e.target.value)}
                          className="w-full bg-pizza-dark/80 border border-white/5 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-pizza-red"
                        >
                          <option value="">Selecciona tu Mesa</option>
                          {tablesList.map((t) => (
                            <option key={t.id} value={t.name} disabled={t.status === "ocupada"}>
                              {t.name} {t.status === "ocupada" ? "(Ocupada)" : "(Libre)"}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Método de pago */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">
                          Método de Pago
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("cash")}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                              paymentMethod === "cash"
                                ? "bg-pizza-gold/15 border-pizza-gold text-[#ffd79b] font-bold"
                                : "bg-pizza-dark/80 border-white/5 text-white/70"
                            }`}
                          >
                            💵 Efectivo
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("yape")}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                              paymentMethod === "yape"
                                ? "bg-pizza-gold/15 border-pizza-gold text-[#ffd79b] font-bold"
                                : "bg-pizza-dark/80 border-white/5 text-white/70"
                            }`}
                          >
                            📱 Yape/Plin
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("transfer")}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                              paymentMethod === "transfer"
                                ? "bg-pizza-gold/15 border-pizza-gold text-[#ffd79b] font-bold"
                                : "bg-pizza-dark/80 border-white/5 text-white/70"
                            }`}
                          >
                            💳 Transf.
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Resumen de totales */}
                    <div className="bg-pizza-dark/80 border border-white/5 rounded-2xl p-4 space-y-2 mt-4 text-xs">
                      <div className="flex justify-between text-white/60">
                        <span>Subtotal Productos:</span>
                        <span>{formatCurrency(totals.subtotal, businessConfig.currency)}</span>
                      </div>
                      
                      {totals.totalDiscount > 0 && (
                        <div className="flex justify-between text-pizza-red font-semibold">
                          <span>Descuentos (-{totals.autoDiscountPercent}% progresivo):</span>
                          <span>-{formatCurrency(totals.totalDiscount, businessConfig.currency)}</span>
                        </div>
                      )}

                      {businessConfig.tax?.taxEnabled && !businessConfig.tax?.taxIncluded && (
                        <div className="flex justify-between text-white/60">
                          <span>{businessConfig.tax.taxName} ({businessConfig.tax.taxRate}%):</span>
                          <span>{formatCurrency(totals.taxAmount, businessConfig.currency)}</span>
                        </div>
                      )}

                      {serviceMode === "delivery" && (
                        <div className="flex justify-between text-white/60">
                          <span>Envío (Delivery):</span>
                          <span>{formatCurrency(totals.shippingCost, businessConfig.currency)}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-white/5">
                        <span>TOTAL NETO:</span>
                        <span className="text-pizza-gold">{formatCurrency(totals.total, businessConfig.currency)}</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loadingOrder}
                      className="w-full bg-pizza-red hover:bg-pizza-red/90 text-white rounded-2xl py-4 font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-pizza-red/20 disabled:opacity-50 border-0"
                    >
                      {loadingOrder ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Procesando Pedido...
                        </>
                      ) : (
                        <>
                          Realizar Pedido &amp; Validar
                          <ChevronRight size={16} />
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SEGUIMIENTO DE PEDIDOS */}
      {isTrackModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-white/10 rounded-3xl w-full max-w-md p-6 relative overflow-hidden text-left shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="absolute top-0 right-0 p-4">
              <button
                onClick={() => {
                  setIsTrackModalOpen(false);
                  setTrackPhoneInput("");
                  setTrackResults([]);
                  setTrackError("");
                }}
                className="text-white/40 hover:text-white p-1 rounded-full hover:bg-white/5 cursor-pointer border-0 bg-transparent"
              >
                <X size={20} />
              </button>
            </div>

            <h3 className="font-pizza-title text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Search size={20} className="text-pizza-gold" />
              Seguimiento de Pedido
            </h3>
            <p className="text-xs text-white/60 mb-5">
              Ingresa el número de teléfono con el que realizaste tu pedido o el número de ticket (ej: 4912).
            </p>

            <form onSubmit={handleSearchOrder} className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Teléfono o # de Orden"
                  value={trackPhoneInput}
                  onChange={(e) => setTrackPhoneInput(e.target.value)}
                  className="flex-1 bg-pizza-dark border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-pizza-red"
                />
                <button
                  type="submit"
                  disabled={trackLoading}
                  className="bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl px-4 py-3 text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer border-0"
                >
                  {trackLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  Buscar
                </button>
              </div>
            </form>

            {/* Mensaje de Error */}
            {trackError && (
              <div className="mt-4 p-3.5 bg-pizza-red/10 border border-pizza-red/20 rounded-xl text-xs text-pizza-red text-center">
                {trackError}
              </div>
            )}

            {/* Resultados de Búsqueda */}
            {trackResults.length > 0 && (
              <div className="mt-5 space-y-3">
                <h4 className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Pedidos Encontrados:</h4>
                <div className="divide-y divide-white/5 max-h-56 overflow-y-auto pr-1 space-y-2">
                  {trackResults.map((res) => (
                    <div
                      key={res.id}
                      onClick={() => {
                        window.location.hash = `#/track/${res.id}`;
                        setIsTrackModalOpen(false);
                      }}
                      className="pt-2 first:pt-0 flex justify-between items-center cursor-pointer group"
                    >
                      <div className="text-left">
                        <span className="text-xs font-bold text-white group-hover:text-pizza-gold transition-colors block">
                          Orden #{res.orderNumber}
                        </span>
                        <span className="text-[10px] text-white/40">
                          {res.createdAt ? new Date(res.createdAt.seconds * 1000).toLocaleString() : "Reciente"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                          res.status === "pending_approval" ? "bg-pizza-gold/10 border-pizza-gold/20 text-[#ffd79b]" :
                          res.status === "preparing" ? "bg-pizza-red/10 border-pizza-red/20 text-pizza-red" :
                          res.status === "ready" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                          res.status === "completed" ? "bg-gray-500/15 border-white/5 text-white/50" :
                          "bg-red-500/10 border-red-500/20 text-red-400"
                        }`}>
                          {res.status === "pending_approval" ? "Por Aprobar" :
                           res.status === "preparing" ? "Cocina" :
                           res.status === "ready" ? "Listo" :
                           res.status === "completed" ? "Entregado" : "Rechazado"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

