import { useState, useEffect } from "react";
import { useCart } from "../context/CartContext";
import { db } from "../firebase/config";
import { collection, getDocs, addDoc, serverTimestamp, query, where, orderBy, limit, onSnapshot, doc, updateDoc, increment } from "firebase/firestore";
import { formatCurrency, formatWhatsAppMessage, parseComboItem, getProductPriceWithExtras, getOptionPriceAdjustment } from "../utils/formatters";
import { MapboxSearch } from "../components/MapboxSearch";
import { 
  ShoppingBag, Trash2, Plus, Minus, X, 
  Check, ChevronRight, MessageSquare, Tag, Loader2,
  Home, Percent, User, Menu, Search, Calendar, Clock,
  Utensils, Truck, ClipboardList
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

  // Acceso secreto a login (Easter Egg para personal)
  const [logoClicks, setLogoClicks] = useState(0);
  const [lastLogoClickTime, setLastLogoClickTime] = useState(0);

  const handleLogoClick = () => {
    const now = Date.now();
    if (now - lastLogoClickTime < 3000) {
      const clicks = logoClicks + 1;
      setLogoClicks(clicks);
      if (clicks >= 5) {
        window.location.hash = "#/login";
        setLogoClicks(0);
      }
    } else {
      setLogoClicks(1);
    }
    setLastLogoClickTime(now);
  };

  // Estados para seguimiento de pedidos
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [trackPhoneInput, setTrackPhoneInput] = useState("");
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState("");
  const [trackResults, setTrackResults] = useState([]);

  // Estados para Módulo de Eventos & Pre-registro
  const [events, setEvents] = useState([]);
  const [selectedEventForReg, setSelectedEventForReg] = useState(null);
  const [regForm, setRegForm] = useState({ name: "", phone: "", email: "", optIn: true });
  const [registeringEvent, setRegisteringEvent] = useState(false);
  const [regSuccessCoupon, setRegSuccessCoupon] = useState("");

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
        console.error("Error al buscar orden:", innerErr);
        setTrackError("Error de conexión. Inténtalo más tarde.");
      }
    } finally {
      setTrackLoading(false);
    }
  };

  // Suscribirse a eventos activos de Firestore en tiempo real
  useEffect(() => {
    const q = query(collection(db, "events"), where("active", "==", true), orderBy("date", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const evs = [];
      snapshot.forEach((doc) => {
        evs.push({ id: doc.id, ...doc.data() });
      });
      setEvents(evs);
    }, (error) => {
      console.error("Error al cargar eventos en cliente:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenRegisterEvent = (event) => {
    setRegForm({
      name: customerName || "",
      phone: customerPhone || "",
      email: "",
      optIn: true
    });
    setRegSuccessCoupon("");
    setSelectedEventForReg(event);
  };

  // Manejar el submit del pre-registro
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regForm.name.trim() || !regForm.phone.trim() || !regForm.email.trim()) {
      alert("Todos los campos obligatorios deben ser completados.");
      return;
    }

    setRegisteringEvent(true);
    try {
      await addDoc(collection(db, "event_registrations"), {
        eventId: selectedEventForReg.id,
        eventTitle: selectedEventForReg.title,
        name: regForm.name.trim(),
        phone: regForm.phone.trim(),
        email: regForm.email.trim(),
        couponCode: selectedEventForReg.couponCode || "",
        registeredAt: serverTimestamp()
      });

      // Guardar nombre y tlf para autocompletar checkout
      setCustomerName(regForm.name.trim());
      setCustomerPhone(regForm.phone.trim());

      // Auto-aplicar cupón si aplica
      if (selectedEventForReg.couponCode) {
        applyCoupon(selectedEventForReg.couponCode);
        setRegSuccessCoupon(selectedEventForReg.couponCode);
      } else {
        setRegSuccessCoupon("SUCCESS_NO_COUPON");
      }
    } catch (err) {
      console.error("Error al guardar asistencia:", err);
      alert("Error al procesar el pre-registro. Inténtalo nuevamente.");
    } finally {
      setRegisteringEvent(false);
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
    { id: "platos", name: "Platos Principales" },
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

  // Obtener información del producto vinculado al banner de inicio
  const linkedProduct = businessConfig.homeBannerProductId
    ? products.find((p) => p.id === businessConfig.homeBannerProductId)
    : null;

  const bannerImage = businessConfig.homeBannerUrl || (linkedProduct?.imageUrl) || "https://lh3.googleusercontent.com/aida-public/AB6AXuAYoGneI4pI-8Eb4DtGVQMxjlTNo52gDYIAxGrJNq7ksf6zNzl2jp2VhKCHFbDiYJHr1briONU3QRmwFZKtD4h27ye2k5Hc01jJ97ROubdyCKfeWPKE3rxXkuJO7G3uY3BE1vqJYN9CwKG20LfLvW0cDU5Umkv9PBK7tUGOyf6he8x7nDXZyuy726F5d90MYjywFlC-8ct19Tu8UIWdoTyv_53NgrsKstqNUc0gDUmMYV76Mhr0_vWv4XzjASfA5GfKvqyxNifhWWQ";

  const bannerTitle = businessConfig.homeBannerTitle || (linkedProduct ? `¡Prueba nuestro/a ${linkedProduct.name}!` : "¡Descuentos Progresivos en todo el Menú!");

  const bannerSubtitle = businessConfig.homeBannerSubtitle || (linkedProduct ? (linkedProduct.description || "Haz clic para ver los detalles y ordenar.") : "Ahorra automáticamente en tu total al agregar más productos.");

  const handleBannerClick = () => {
    if (linkedProduct) {
      handleOpenCustomize(linkedProduct);
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
      <div className="min-h-screen bg-pizza-charcoal text-pizza-dark flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white border border-gray-200 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-[#ffd79b]/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-pizza-gold/10 text-pizza-gold mb-6 border border-pizza-gold/20">
            <Check size={40} className="animate-bounce" />
          </div>

          <h2 className="font-pizza-title text-3xl font-bold text-pizza-dark mb-2">¡Pedido Recibido!</h2>
          <p className="text-gray-600 text-sm mb-4">
            Tu orden <strong className="text-pizza-gold">#{orderSuccess.orderNumber}</strong> ha sido registrada y está en estado de <strong className="text-pizza-gold">Aprobación Pendiente</strong>.
          </p>

          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-150 text-left mb-6 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Siguiente Paso Requerido:</h3>
            <p className="text-xs text-gray-700 leading-relaxed">
              Para completar la sincronización y que nuestro personal comience la preparación, por favor envía el ticket por WhatsApp haciendo click en el botón de abajo.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <a
              href={orderSuccess.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full bg-[#25d366] hover:bg-[#20ba5a] text-white py-4 px-6 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#25d366]/20 keep-white"
            >
              <MessageSquare size={18} />
              Enviar Ticket por WhatsApp
            </a>

            <button
              onClick={() => {
                window.location.hash = `#/track/${orderSuccess.id}`;
                setOrderSuccess(null);
              }}
              className="w-full bg-pizza-red hover:bg-pizza-red/90 text-white py-3.5 px-6 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-pizza-red/20 cursor-pointer keep-white"
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
    <div className="min-h-screen bg-pizza-charcoal text-pizza-dark pb-24 relative">
      {/* -------------------- INTERFAZ DESKTOP (MD y superior) -------------------- */}
      <div className="hidden md:block">
        {/* Navbar de marca */}
        <header className="sticky top-0 z-40 bg-pizza-charcoal/90 backdrop-blur-xl border-b border-gray-200/50 px-6 py-4 flex items-center justify-between">
          <div onClick={handleLogoClick} className="flex items-center gap-2 cursor-pointer select-none" title="Acceso Personal">
            {businessConfig.logoUrl ? (
              <img 
                src={businessConfig.logoUrl} 
                alt="Logo" 
                className="w-8 h-8 rounded-full object-cover border border-gray-200" 
                onError={(e) => { e.target.style.display = 'none'; }} 
              />
            ) : (
              <span className="text-2xl">🌶️</span>
            )}
            <div>
              <h1 className="font-pizza-title text-xl font-bold text-pizza-dark leading-none">
                {businessConfig.name || "Sabor Boliviano"}
              </h1>
              <span className="text-[10px] text-pizza-red font-medium uppercase tracking-wider">
                Auténtico Sabor
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsTrackModalOpen(true)}
              className="flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-pizza-dark/80 text-xs font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer"
            >
              <Truck size={14} className="text-pizza-red" />
              Seguir Pedido
            </button>

            <button
              onClick={() => setCartOpen(true)}
              className="relative bg-pizza-red/10 border border-pizza-red/20 text-pizza-red hover:bg-pizza-red/20 p-2.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center"
            >
              <ShoppingBag size={20} />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-pizza-red text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                  {cart.reduce((acc, item) => acc + item.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Hero Banner */}
        <section className="px-6 pt-8 pb-4">
          <div 
            onClick={handleBannerClick}
            className={`relative rounded-[32px] overflow-hidden border border-pizza-red/10 p-8 md:p-12 bg-gradient-to-br from-[#FFF5F1] to-white shadow-sm flex flex-col justify-between ${linkedProduct ? "cursor-pointer hover:shadow-md transition-all duration-300" : ""}`}
          >
            <div className="max-w-2xl relative z-10 text-left">
              <span className="bg-pizza-red/10 border border-pizza-red/20 text-pizza-red text-[10px] font-bold px-4 py-1.5 rounded-full uppercase tracking-wider mb-6 inline-block">
                {linkedProduct ? "Platillo Destacado" : "Promociones Activas"}
              </span>
              <h2 className="font-pizza-title text-3xl md:text-4xl font-extrabold text-pizza-dark leading-tight mb-4">
                {bannerTitle}
              </h2>
              <p className="text-sm text-pizza-dark/70 mb-8 leading-relaxed max-w-lg">
                {bannerSubtitle}
              </p>

              {/* Progressive Discount Bar or CTA Button */}
              {linkedProduct ? (
                <div className="mt-4">
                  <button
                    type="button"
                    className="bg-pizza-red hover:bg-pizza-red/90 text-white font-extrabold text-xs px-6 py-3.5 rounded-2xl transition-all cursor-pointer shadow-lg shadow-pizza-red/20 uppercase tracking-wider inline-flex items-center gap-2 border-0 pointer-events-none keep-white"
                  >
                    Ver Especialidad
                    <ChevronRight size={14} />
                  </button>
                </div>
              ) : (
                businessConfig.discounts?.autoDiscounts?.length > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-pizza-red">Progreso del Descuento</span>
                      <span className="text-pizza-dark/70">
                        {totals.autoDiscountPercent > 0 
                          ? `Llegaste a ${totals.autoDiscountPercent}% OFF` 
                          : "Agrega productos para ganar descuento"}
                      </span>
                    </div>
                    <div className="relative bg-gray-200 h-3 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-[#ff9e7d] to-[#ff5200] h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(100, (totals.subtotal / (Math.max(...businessConfig.discounts.autoDiscounts.map(d => d.minAmount)) || 1)) * 100)}%` }}
                      />
                      {/* Milestone markers */}
                      {businessConfig.discounts.autoDiscounts.map((rule, idx, arr) => {
                        const maxAmount = Math.max(...arr.map(d => d.minAmount)) || 1;
                        const position = (rule.minAmount / maxAmount) * 100;
                        if (position >= 100) return null;
                        return (
                          <div 
                            key={idx} 
                            className="absolute top-0 bottom-0 w-0.5 bg-white/70"
                            style={{ left: `${position}%` }}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] uppercase font-bold tracking-wider text-pizza-dark/50">
                      {businessConfig.discounts.autoDiscounts.map((rule, idx) => (
                        <span 
                          key={idx}
                          className={totals.subtotal >= rule.minAmount ? "text-pizza-red" : ""}
                        >
                          &gt; {formatCurrency(rule.minAmount, businessConfig.currency)} ({rule.discountPercent}% OFF)
                        </span>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Abstract background shape */}
            <div className="absolute top-0 right-0 w-1/2 h-full hidden lg:block pointer-events-none select-none">
              <img 
                className={`w-full h-full object-cover ${(businessConfig.homeBannerUrl || linkedProduct?.imageUrl) ? "opacity-95 rounded-r-[32px] [mask-image:linear-gradient(to_right,transparent,black_15%)]" : "opacity-12 mix-blend-multiply"}`} 
                alt="Banner Especial"
                src={bannerImage}
              />
            </div>
          </div>
        </section>

        {/* Sección de Cupones y Ofertas */}
        {availableCoupons.length > 0 && (
          <section className="px-6 py-4 space-y-4">
            <h3 className="font-pizza-title text-base font-bold text-pizza-dark flex items-center gap-1.5">
              <Percent size={18} className="text-pizza-red" />
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
                      <h4 className="text-sm font-extrabold text-pizza-dark">{code}</h4>
                      <p className="text-[10px] text-gray-500">{discount}% de descuento en tu total</p>
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar especialidad o ingrediente..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="w-full bg-white border border-gray-200 focus:border-pizza-red focus:ring-1 focus:ring-pizza-red text-pizza-dark rounded-2xl pl-11 pr-10 py-3 text-sm placeholder-gray-400 outline-none transition-all shadow-xs"
            />
            {clientSearch && (
              <button
                onClick={() => setClientSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-pizza-dark p-1 cursor-pointer transition-colors border-0 bg-transparent"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </section>

        <main className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-white border border-gray-150 rounded-3xl p-8 shadow-sm">
              <span className="text-5xl mb-4">🍲🔍</span>
              <h4 className="font-pizza-title text-lg font-bold text-pizza-dark">No encontramos esa combinación</h4>
              <p className="text-sm text-gray-500 mt-2 max-w-sm">
                No hay productos en esta sección que coincidan con tu búsqueda. Prueba con otro nombre o borra el filtro.
              </p>
              <button
                onClick={() => {
                  setClientSearch("");
                  setActiveCategory("all");
                }}
                className="mt-6 px-6 py-3 bg-pizza-red text-white text-xs font-bold rounded-2xl hover:bg-pizza-red/90 transition-all cursor-pointer shadow-lg shadow-pizza-red/20 uppercase tracking-wider keep-white"
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
                  className={`bg-white rounded-3xl overflow-hidden border border-gray-150 hover:border-gray-250 hover:shadow-md transition-all duration-300 flex flex-col group ${isOutOfStock ? "opacity-60" : ""}`}
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-gray-50">
                    <img
                      src={prod.imageUrl}
                      alt={prod.name}
                      className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isOutOfStock ? "grayscale" : ""}`}
                    />
                    {hasDiscount && !isOutOfStock && (
                      <div className="absolute top-4 left-4 bg-pizza-red text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1 keep-white">
                        <Tag size={10} />
                        {prod.discount}% OFF
                      </div>
                    )}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="bg-pizza-red text-white text-xs font-black px-3.5 py-1.5 rounded-full uppercase tracking-widest shadow-lg keep-white">
                          Agotado
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-pizza-title text-lg font-bold text-pizza-dark mb-2 group-hover:text-pizza-red transition-colors">
                        {prod.name}
                      </h3>
                      <p className="text-xs text-gray-500 line-clamp-3 mb-4">
                        {prod.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex flex-col">
                        {hasDiscount ? (
                          <>
                            <span className="text-[10px] text-gray-400 line-through">
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
                          className="bg-pizza-red/10 hover:bg-pizza-red hover:border-pizza-red border border-pizza-red/20 text-pizza-red hover:text-white px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer"
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
        <footer className="py-8 mt-12 border-t border-gray-200 text-center text-xs text-gray-400 space-y-2">
          <p>© 2026 {businessConfig.name || "Sabor Boliviano"} - Todos los derechos reservados.</p>
        </footer>
      </div>

      {/* -------------------- INTERFAZ MÓVIL (Menor a MD) -------------------- */}
      <div className="md:hidden flex flex-col min-h-screen pb-16 text-pizza-dark">
        {/* Cabecera Móvil Estilo Stitch */}
        <header className="sticky top-0 z-40 bg-pizza-charcoal/90 backdrop-blur-xl border-b border-gray-200/50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setInfoDrawerOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-xl text-pizza-dark/75 hover:text-pizza-dark cursor-pointer border-0 bg-transparent"
            >
              <Menu size={20} />
            </button>
            <span 
              onClick={handleLogoClick}
              className="font-pizza-title text-base font-black uppercase tracking-wider text-pizza-red cursor-pointer select-none"
            >
              {businessConfig.name || "Q'Pique"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveMobileTab("cart")}
              className="relative p-2 hover:bg-gray-100 rounded-xl text-pizza-red cursor-pointer border-0 bg-transparent flex items-center justify-center"
              title="Ver mi carrito"
            >
              <ShoppingBag size={20} />
              {cart.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-pizza-red text-white text-[8px] font-extrabold w-4.5 h-4.5 rounded-full flex items-center justify-center border border-white keep-white">
                  {cart.reduce((acc, item) => acc + item.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Contenido de Pestañas Móviles */}
        <div className="flex-1 px-4 py-4 overflow-y-auto">
          {activeMobileTab === "home" && (
            <div className="space-y-6">
              {/* Gran Banner de bienvenida con Descuentos Progresivos de Stitch */}
              <div 
                onClick={handleBannerClick}
                className={`relative w-full min-h-[220px] rounded-3xl overflow-hidden shadow-lg group ${linkedProduct ? "cursor-pointer" : ""}`}
              >
                <img 
                  alt="Imagen del Banner" 
                  className="absolute inset-0 w-full h-full object-cover" 
                  src={bannerImage}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-5 text-left">
                  <span className="text-white/80 font-bold text-[9px] uppercase tracking-widest mb-1 keep-white">
                    {linkedProduct ? "Recomendado" : "Tu Próximo Nivel"}
                  </span>
                  <h2 className="text-white font-pizza-title text-lg font-black mb-2 leading-tight keep-white">
                    {bannerTitle}
                  </h2>
                  
                  {linkedProduct ? (
                    <div className="space-y-2">
                      <p className="text-white/70 text-[10px] leading-relaxed line-clamp-2 keep-white">
                        {bannerSubtitle}
                      </p>
                      <span className="inline-flex items-center gap-1 text-pizza-gold text-[9px] font-black uppercase tracking-wider mt-1.5">
                        Ver Especialidad
                        <ChevronRight size={10} />
                      </span>
                    </div>
                  ) : (
                    businessConfig.discounts?.autoDiscounts?.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-end text-white text-[10px] font-bold keep-white">
                          <span>
                            {totals.autoDiscountPercent > 0 
                              ? `¡Llegaste a ${totals.autoDiscountPercent}% OFF!` 
                              : "Agrega productos para ganar descuento"}
                          </span>
                          <span>
                            {totals.autoDiscountPercent > 0 
                              ? `${totals.autoDiscountPercent}%` 
                              : "0%"}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-orange-400 to-pizza-red rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(255,102,0,0.5)]"
                            style={{ width: `${Math.min(100, (totals.subtotal / (Math.max(...businessConfig.discounts.autoDiscounts.map(d => d.minAmount)) || 1)) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[8px] uppercase font-bold tracking-wider text-white/50 keep-white">
                          {businessConfig.discounts.autoDiscounts.map((rule, idx) => (
                            <span 
                              key={idx}
                              className={totals.subtotal >= rule.minAmount ? "text-pizza-red font-black" : ""}
                            >
                              &gt; {formatCurrency(rule.minAmount, businessConfig.currency)} ({rule.discountPercent}% OFF)
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-white/70 text-xs leading-tight keep-white">
                        {bannerSubtitle}
                      </p>
                    )
                  )}
                </div>
              </div>

              {/* Cupones Disponibles en mobile (Estilo horizontal del mockup) */}
              {availableCoupons.length > 0 && (
                <div className="space-y-3 text-left">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="font-pizza-title text-sm font-bold text-pizza-dark">Cupones Disponibles</h3>
                    <button 
                      onClick={() => setActiveMobileTab("offers")}
                      className="text-pizza-red text-xs font-bold border-0 bg-transparent cursor-pointer"
                    >
                      Ver todos
                    </button>
                  </div>
                  
                  <div className="flex gap-4 overflow-x-auto pb-2 shrink-0 scrollbar-none">
                    {availableCoupons.map(([code, discount]) => {
                      const isApplied = couponCode === code;
                      return (
                        <div 
                          key={code}
                          className="min-w-[240px] max-w-[260px] bg-white border border-dashed border-pizza-red/30 rounded-2xl p-4.5 flex items-center justify-between shadow-sm shrink-0 active:scale-[0.98] transition-transform"
                        >
                          <div className="flex flex-col text-left">
                            <span className="text-pizza-red font-black text-lg tracking-tighter">{code}</span>
                            <span className="text-gray-500 text-[10px] font-medium truncate max-w-[120px]">
                              {discount}% OFF en tu total
                            </span>
                          </div>
                          
                          {isApplied ? (
                            <span className="text-[9px] bg-green-500/10 border border-green-500/35 text-green-600 font-bold px-2.5 py-1.5 rounded-full flex items-center gap-0.5 select-none">
                              <Check size={8} />
                              Listo
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                applyCoupon(code);
                              }}
                              className="bg-pizza-red hover:bg-pizza-red/90 text-white px-4 py-1.5 rounded-full text-[10px] font-bold shadow-md cursor-pointer border-0 keep-white"
                            >
                              Copiar
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Botones Gigantes de Pedido (Estilo Burger King) */}
              <div className="grid grid-cols-2 gap-3.5 text-pizza-dark">
                <button
                  onClick={() => {
                    setServiceMode("pickup");
                    setActiveMobileTab("menu");
                  }}
                  className="flex flex-col items-center justify-center gap-2 p-5 bg-white border border-gray-200 rounded-2xl hover:border-pizza-gold transition-all active:scale-95 group text-center cursor-pointer"
                >
                  <span className="text-3xl filter drop-shadow">🥡</span>
                  <span className="font-bold text-xs text-pizza-dark group-hover:text-pizza-red">Para Llevar</span>
                  <span className="text-[9px] text-pizza-dark/50">Recoge en tienda</span>
                </button>
                <button
                  onClick={() => {
                    setServiceMode("delivery");
                    setActiveMobileTab("menu");
                  }}
                  className="flex flex-col items-center justify-center gap-2 p-5 bg-white border border-gray-200 rounded-2xl hover:border-pizza-red transition-all active:scale-95 group text-center cursor-pointer"
                >
                  <span className="text-3xl filter drop-shadow">🛵</span>
                  <span className="font-bold text-xs text-pizza-dark group-hover:text-pizza-red">Pedir Delivery</span>
                  <span className="text-[9px] text-pizza-dark/50">Envío rápido a casa</span>
                </button>
              </div>

              {/* Recomendados / Más Vendidos */}
              <div className="space-y-3">
                <h3 className="font-pizza-title text-sm font-bold text-pizza-dark flex items-center gap-1">
                  🔥 Recomendadas
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-2 shrink-0 scrollbar-none">
                  {products.slice(0, 4).map((prod) => {
                    const isOutOfStock = prod.stock !== undefined && prod.stock <= 0;
                    return (
                      <div 
                        key={prod.id} 
                        className={`w-40 bg-white border border-gray-200 rounded-2xl p-3 flex flex-col justify-between shrink-0 hover:border-pizza-red/40 transition-all ${isOutOfStock ? "opacity-60" : ""}`}
                      >
                        <div className="aspect-video w-full rounded-xl overflow-hidden bg-pizza-dark relative mb-2">
                          <img src={prod.imageUrl} alt={prod.name} className={`w-full h-full object-cover ${isOutOfStock ? "grayscale" : ""}`} />
                          {isOutOfStock && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <span className="bg-pizza-red text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase keep-white">
                                Agotado
                              </span>
                            </div>
                          )}
                        </div>
                        <h4 className="font-bold text-[11px] text-pizza-dark truncate leading-tight">{prod.name}</h4>
                        <div className="flex justify-between items-center mt-2.5">
                          <span className="text-[11px] font-black text-pizza-red">
                            {formatCurrency(prod.price * (1 - (prod.discount || 0)/100), businessConfig.currency)}
                          </span>
                          {isOutOfStock ? (
                            <span className="text-[9px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-lg font-bold select-none">
                              Agotado
                            </span>
                          ) : (
                            <button 
                              onClick={() => handleOpenCustomize(prod)}
                              className="bg-pizza-red/10 hover:bg-pizza-red hover:text-white text-pizza-red text-[9px] font-bold px-2 py-1 rounded-lg border border-pizza-red/20 cursor-pointer"
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
              {/* Categorías en mobile (Estilo Stitch) */}
              <div className="flex gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-none sticky top-14 bg-pizza-charcoal z-10 py-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 transition-all cursor-pointer ${
                      activeCategory === cat.id
                        ? "bg-pizza-red border-pizza-red text-white shadow-md"
                        : "bg-gray-100 border-transparent text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Buscador de Productos Móvil */}
              <div className="relative shrink-0">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Buscar plato o bebida..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full bg-white border border-gray-200 focus:border-pizza-red focus:ring-1 focus:ring-pizza-red text-pizza-dark rounded-xl pl-10 pr-9 py-2.5 text-xs placeholder-gray-400 outline-none transition-all"
                />
                {clientSearch && (
                  <button
                    onClick={() => setClientSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-pizza-dark p-0.5 cursor-pointer transition-colors border-0 bg-transparent"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Listado de pizzas en mobile (Estilo Tarjetas Horizontales Stitch) */}
              <div className="space-y-3.5">
                {filteredProducts.length === 0 ? (
                  <div className="py-8 flex flex-col items-center justify-center text-center bg-white border border-gray-200 rounded-3xl p-4">
                    <span className="text-3xl mb-2">🍲🔍</span>
                    <h4 className="font-bold text-xs text-pizza-dark">Sin resultados</h4>
                    <p className="text-[10px] text-gray-500 mt-1 max-w-[200px]">
                      No encontramos coincidencias para esta búsqueda.
                    </p>
                    <button
                      onClick={() => {
                        setClientSearch("");
                        setActiveCategory("all");
                      }}
                      className="mt-3 px-3 py-1.5 bg-pizza-red text-white text-[10px] font-bold rounded-lg hover:bg-pizza-red/90 transition-all cursor-pointer border-0"
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
                        className={`bg-white border border-gray-100 rounded-3xl p-4 flex gap-4 shadow-[0px_4px_20px_rgba(0,0,0,0.05)] active:scale-[0.98] transition-all duration-300 cursor-pointer group ${isOutOfStock ? "opacity-60" : ""}`}
                      >
                        {/* Contenedor de Imagen */}
                        <div className="w-24 h-24 rounded-2xl overflow-hidden flex-none bg-gray-50 relative">
                          <img src={prod.imageUrl} alt={prod.name} className={`w-full h-full object-cover ${isOutOfStock ? "grayscale" : ""}`} />
                          {prod.discount > 0 && !isOutOfStock && (
                            <span className="absolute top-1.5 left-1.5 bg-pizza-red text-[8px] font-black px-2 py-0.5 rounded-full text-white keep-white shadow-sm">
                              -{prod.discount}%
                            </span>
                          )}
                          {isOutOfStock && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <span className="bg-pizza-red text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase keep-white">
                                Agotado
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Contenedor de Información */}
                        <div className="flex flex-col justify-between flex-1 min-w-0 py-0.5">
                          <div className="text-left">
                            <h4 className="font-pizza-title text-sm font-extrabold text-pizza-dark truncate group-hover:text-pizza-red transition-colors">
                              {prod.name}
                            </h4>
                            <p className="text-[10px] text-gray-500 line-clamp-2 mt-1 leading-normal font-sans">
                              {prod.description}
                            </p>
                          </div>
                          <div className="flex justify-between items-center mt-2.5">
                            <span className="text-sm font-black text-pizza-gold">
                              {formatCurrency(discountedPrice, businessConfig.currency)}
                            </span>
                            {isOutOfStock ? (
                              <span className="text-[9px] text-red-500 bg-red-50 border border-red-200 px-2.5 py-1 rounded-xl font-bold select-none">
                                Agotado
                              </span>
                            ) : (
                              <span className="text-[10px] text-white bg-pizza-red hover:bg-pizza-red/90 px-3 py-1.5 rounded-xl font-extrabold shadow-sm transition-all keep-white">
                                + Pedir
                              </span>
                            )}
                          </div>
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
              <div className="space-y-1 text-left">
                <h3 className="font-pizza-title text-base font-bold text-pizza-dark flex items-center gap-1.5">
                  <Percent size={16} className="text-pizza-red" />
                  Cupones y Ofertas
                </h3>
                <p className="text-[11px] text-gray-500">Aplica códigos promocionales y ahorra en tu orden.</p>
              </div>

              {/* Cupón en móvil */}
              <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm space-y-3 text-left">
                <h4 className="text-xs font-bold text-pizza-dark">Ingresa tu Cupón</h4>
                {couponCode ? (
                  <div className="flex items-center justify-between bg-pizza-gold/10 border border-pizza-gold/25 rounded-xl p-3 text-xs text-pizza-gold font-bold">
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
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ej: BOLIVIA50"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      className="flex-1 bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-pizza-dark placeholder-gray-400 focus:outline-none focus:border-pizza-red focus:ring-1 focus:ring-pizza-red"
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
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Cupones Disponibles</h4>
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
                            <h4 className="text-xs font-extrabold text-pizza-dark">{code}</h4>
                            <p className="text-[9px] text-gray-500">{discount}% de descuento en tu total</p>
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

              {/* Progressive Discount Bar (Móvil) */}
              {businessConfig.discounts?.autoDiscounts?.length > 0 && (
                <div className="space-y-2.5 text-left">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Descuentos Progresivos</h4>
                  <div className="bg-white border border-gray-200 rounded-3xl p-5 space-y-3 shadow-sm">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-pizza-red">Progreso de tu Descuento</span>
                      <span className="text-pizza-dark/80">
                        {totals.autoDiscountPercent > 0 
                          ? `${totals.autoDiscountPercent}% OFF` 
                          : "0% OFF"}
                      </span>
                    </div>
                    <div className="relative bg-gray-150 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-[#ff9e7d] to-[#ff5200] h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(100, (totals.subtotal / (Math.max(...businessConfig.discounts.autoDiscounts.map(d => d.minAmount)) || 1)) * 100)}%` }}
                      />
                      {/* Milestone markers */}
                      {businessConfig.discounts.autoDiscounts.map((rule, idx, arr) => {
                        const maxAmount = Math.max(...arr.map(d => d.minAmount)) || 1;
                        const position = (rule.minAmount / maxAmount) * 100;
                        if (position >= 100) return null;
                        return (
                          <div 
                            key={idx} 
                            className="absolute top-0 bottom-0 w-0.5 bg-white/70"
                            style={{ left: `${position}%` }}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[8px] uppercase font-bold tracking-wider text-gray-500">
                      {businessConfig.discounts.autoDiscounts.map((rule, idx) => (
                        <span 
                          key={idx}
                          className={totals.subtotal >= rule.minAmount ? "text-pizza-red font-black" : ""}
                        >
                          &gt; {formatCurrency(rule.minAmount, businessConfig.currency)} ({rule.discountPercent}%)
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeMobileTab === "eventos" && (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <h3 className="font-pizza-title text-base font-bold text-pizza-dark flex items-center justify-center gap-1.5">
                  <Calendar size={16} className="text-pizza-red" />
                  Próximos Eventos & Promociones
                </h3>
                <p className="text-[11px] text-gray-500">Regístrate a nuestros eventos y obtén beneficios al instante.</p>
              </div>

              {/* Grid / Lista de Eventos */}
              <div className="space-y-4 text-left">
                {events.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                    <span className="text-3xl mb-2">🎉🍲</span>
                    <h4 className="font-bold text-xs text-pizza-dark">¡Próximamente más eventos!</h4>
                    <p className="text-[10px] text-gray-500 mt-1 max-w-[220px] leading-relaxed">
                      Estamos preparando noches especiales con música en vivo, catas y descuentos increíbles. ¡Mantente al tanto!
                    </p>
                  </div>
                ) : (
                  events.map((event) => {
                    const hasBanner = !!event.bannerUrl;
                    return (
                      <div
                        key={event.id}
                        className={`relative rounded-3xl overflow-hidden border p-5 flex flex-col justify-between min-h-[170px] shadow-sm ${
                          hasBanner 
                            ? "border-white/10 bg-gradient-to-br from-gray-900 to-black text-white" 
                            : "border-pizza-red/15 bg-gradient-to-br from-[#FFF5F1] to-white text-pizza-dark"
                        }`}
                      >
                        {event.bannerUrl && (
                          <div 
                            className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none filter blur-xs" 
                            style={{ backgroundImage: `url(${event.bannerUrl})` }} 
                          />
                        )}

                        <div className="relative space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="bg-pizza-red text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider keep-white">
                              Evento Especial
                            </span>
                            <span className={`text-[9px] font-bold flex items-center gap-1 ${hasBanner ? "text-[#ffd79b] keep-white" : "text-pizza-gold"}`}>
                              <Calendar size={11} className="inline shrink-0" /> {event.date} | <Clock size={11} className="inline shrink-0" /> {event.time}
                            </span>
                          </div>

                          <h4 className={`font-pizza-title text-base font-black leading-tight ${hasBanner ? "text-white keep-white" : "text-pizza-dark"}`}>
                            {event.title}
                          </h4>
                          <p className={`text-[11px] font-sans leading-relaxed ${hasBanner ? "text-white/80 keep-white" : "text-gray-600"}`}>
                            {event.description}
                          </p>

                          {event.couponCode && (
                            <div className="inline-flex items-center gap-1.5 bg-pizza-red/10 border border-pizza-red/20 rounded-xl px-3 py-1.5 text-[10px] text-pizza-red font-bold mt-1">
                              🎁 Regístrate y recibe: {event.discountPercent}% OFF (Cupón: {event.couponCode})
                            </div>
                          )}
                        </div>

                        <div className="relative mt-4 pt-3 border-t border-gray-200/50 flex justify-between items-center shrink-0">
                          <span className={`text-[9px] font-semibold ${hasBanner ? "text-white/50 keep-white" : "text-gray-500"}`}>
                            Entrada libre con registro
                          </span>
                          <button
                            onClick={() => handleOpenRegisterEvent(event)}
                            className="bg-pizza-gold hover:bg-pizza-gold/90 text-white font-black px-4 py-2 rounded-xl transition-all cursor-pointer shadow-md shadow-pizza-gold/10 border-0 keep-white"
                          >
                            Pre-registrarse
                          </button>
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
              <h3 className="font-pizza-title text-base font-bold text-pizza-dark flex items-center gap-1.5">
                <ShoppingBag size={18} className="text-pizza-red" />
                Tu Carrito de Compra
              </h3>

              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 space-y-4 bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                  <ShoppingBag size={44} className="text-gray-200" />
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
                        className="bg-white border border-gray-200 rounded-2xl p-4 flex justify-between items-start text-xs shadow-sm"
                      >
                        <div className="flex-1 pr-2">
                          <h4 className="font-bold text-pizza-dark text-xs">{item.name}</h4>
                          <span className="text-xs text-pizza-gold font-bold block mt-0.5">
                            {formatCurrency(item.price, businessConfig.currency)} x {item.quantity}
                          </span>
                          
                          {Object.keys(item.optionsSelected).length > 0 && (
                            <div className="text-[10px] text-gray-500 mt-1">
                              {Object.entries(item.optionsSelected).map(([k,v]) => `${k}: ${v}`).join(", ")}
                            </div>
                          )}
                          
                          {item.comboItems && item.comboItems.length > 0 && (
                            <div className="text-[10px] text-pizza-gold/80 mt-1 bg-pizza-gold/5 border border-pizza-gold/15 rounded-lg px-2 py-1">
                              Combo: {item.comboItems.join(" + ")}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-3 justify-between h-full">
                          <button 
                            onClick={() => removeFromCart(item.cartId)}
                            className="p-1 text-gray-400 hover:text-pizza-red transition-colors border-0 bg-transparent cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                          
                          <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg p-0.5">
                            <button
                              onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                              className="p-0.5 text-gray-500 hover:text-pizza-dark border-0 bg-transparent cursor-pointer"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="text-[11px] font-bold w-4 text-center text-pizza-dark">{item.quantity}</span>
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
                              className="p-0.5 text-gray-500 hover:text-pizza-dark border-0 bg-transparent cursor-pointer"
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Modalidad de Entrega en mobile (Estilo Claro) */}
                  <div className="space-y-2 pt-4 border-t border-gray-200">
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">
                      Modalidad de Entrega
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setServiceMode("pickup")}
                        className={`py-2 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                          serviceMode === "pickup"
                            ? "bg-pizza-red/10 border-pizza-red text-pizza-red font-bold"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        Llevar 🥡
                      </button>
                      <button
                        onClick={() => setServiceMode("delivery")}
                        className={`py-2 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                          serviceMode === "delivery"
                            ? "bg-pizza-red/10 border-pizza-red text-pizza-red font-bold"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        Delivery 🚀
                      </button>
                      <button
                        onClick={() => setServiceMode("dinein")}
                        className={`py-2 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                          serviceMode === "dinein"
                            ? "bg-pizza-red/10 border-pizza-red text-pizza-red font-bold"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        En Mesa 🍽️
                      </button>
                    </div>
                  </div>

                  {/* Datos del Cliente y Checkout */}
                  <form onSubmit={handleSubmitOrder} className="space-y-4 pt-4 border-t border-gray-200">
                    <div className="space-y-3">
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Tu Nombre Completo"
                        className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-pizza-dark placeholder-gray-400 focus:outline-none focus:border-pizza-red focus:ring-1 focus:ring-pizza-red"
                      />
                      <input
                        type="text"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Teléfono (WhatsApp)"
                        className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-pizza-dark placeholder-gray-400 focus:outline-none focus:border-pizza-red focus:ring-1 focus:ring-pizza-red"
                      />

                      {serviceMode === "delivery" && (
                        <div className="space-y-2">
                          <MapboxSearch />
                          {shippingDistance > 0 && (
                            <div className="bg-pizza-gold/5 border border-pizza-gold/15 rounded-xl p-3 flex flex-col gap-1 text-[11px] text-pizza-gold">
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
                          className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-pizza-dark focus:outline-none focus:border-pizza-red"
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
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">
                          Método de Pago
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("cash")}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                              paymentMethod === "cash"
                                ? "bg-pizza-red/10 border-pizza-red text-pizza-red font-bold"
                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            💵 Efectivo
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("yape")}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                              paymentMethod === "yape"
                                ? "bg-pizza-red/10 border-pizza-red text-pizza-red font-bold"
                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            📱 Yape/Plin
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("transfer")}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                              paymentMethod === "transfer"
                                ? "bg-pizza-red/10 border-pizza-red text-pizza-red font-bold"
                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            💳 Transf.
                          </button>
                        </div>
                        {paymentMethod === "yape" && businessConfig.yapeQrUrl && (
                          <div className="mt-4 flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-2xl gap-2 text-center">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Escanea el QR para pagar con Yape o Plin</span>
                            <div className="w-40 h-40 bg-white rounded-xl p-2 flex items-center justify-center shadow-lg border border-gray-200">
                              <img src={businessConfig.yapeQrUrl} alt="QR Yape" className="w-full h-full object-contain" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Resumen de totales */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2 mt-4 text-xs shadow-sm text-pizza-dark">
                      <div className="flex justify-between text-gray-600">
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
                        <div className="flex justify-between text-gray-600">
                          <span>Envío (Delivery):</span>
                          <span>{formatCurrency(totals.shippingCost, businessConfig.currency)}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-sm font-extrabold text-pizza-dark pt-2 border-t border-gray-200">
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

          {activeMobileTab === "pedidos" && (
            <div className="space-y-6 text-left">
              <div className="space-y-1">
                <h3 className="font-pizza-title text-base font-bold text-pizza-dark flex items-center gap-1.5">
                  <ClipboardList size={18} className="text-pizza-red" />
                  Seguimiento de Pedidos
                </h3>
                <p className="text-[11px] text-gray-500">
                  Ingresa el número de teléfono con el que realizaste tu pedido o el número de ticket (ej: 4912) para seguir su estado en tiempo real.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm space-y-4">
                <form onSubmit={handleSearchOrder} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Teléfono o # de Orden"
                    value={trackPhoneInput}
                    onChange={(e) => setTrackPhoneInput(e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-pizza-dark placeholder-gray-400 focus:outline-none focus:border-pizza-red focus:ring-1 focus:ring-pizza-red"
                  />
                  <button
                    type="submit"
                    disabled={trackLoading}
                    className="bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl px-4 py-2.5 text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer border-0 keep-white shadow-md shadow-pizza-red/15"
                  >
                    {trackLoading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                    Buscar
                  </button>
                </form>

                {trackError && (
                  <div className="p-3 bg-pizza-red/10 border border-pizza-red/20 rounded-xl text-[11px] text-pizza-red text-center">
                    {trackError}
                  </div>
                )}
              </div>

              {trackResults.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Pedidos Encontrados:</h4>
                  <div className="space-y-3">
                    {trackResults.map((res) => (
                      <div
                        key={res.id}
                        onClick={() => {
                          window.location.hash = `#/track/${res.id}`;
                        }}
                        className="bg-white border border-gray-150 rounded-2xl p-4 flex justify-between items-center cursor-pointer hover:border-pizza-red/30 transition-all shadow-sm active:scale-[0.98]"
                      >
                        <div>
                          <span className="text-xs font-bold text-pizza-dark block">
                            Orden #{res.orderNumber}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {res.createdAt ? new Date(res.createdAt.seconds * 1000).toLocaleString() : "Reciente"}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                            res.status === "pending_approval" ? "bg-pizza-gold/10 border-pizza-gold/20 text-pizza-gold" :
                            res.status === "preparing" ? "bg-pizza-red/10 border-pizza-red/20 text-pizza-red" :
                            res.status === "ready" ? "bg-emerald-50 border-emerald-200 text-emerald-600 font-bold" :
                            res.status === "completed" ? "bg-gray-150 border-gray-250 text-gray-600" :
                            "bg-red-50 border-red-200 text-red-600"
                          }`}>
                            {res.status === "pending_approval" ? "Por Aprobar" :
                             res.status === "preparing" ? "Cocina" :
                             res.status === "ready" ? "Listo" :
                             res.status === "completed" ? "Entregado" :
                             "Cancelado"}
                          </span>
                          <span className="text-[10px] font-bold text-pizza-dark">
                            {formatCurrency(res.total, businessConfig.currency)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeMobileTab === "perfil" && (
            <div className="space-y-6 text-left">
              <div className="space-y-1">
                <h3 className="font-pizza-title text-base font-bold text-pizza-dark flex items-center gap-1.5">
                  <User size={18} className="text-pizza-red" />
                  Mi Perfil de Cliente
                </h3>
                <p className="text-[11px] text-gray-500">
                  Configura tus datos para que tus próximos pedidos se procesen más rápido.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ingresa tu nombre"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4.5 py-2.5 text-xs text-pizza-dark placeholder-gray-400 focus:outline-none focus:border-pizza-red focus:ring-1 focus:ring-pizza-red"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Teléfono (WhatsApp)</label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Ingresa tu teléfono"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4.5 py-2.5 text-xs text-pizza-dark placeholder-gray-400 focus:outline-none focus:border-pizza-red focus:ring-1 focus:ring-pizza-red"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Dirección de Entrega</label>
                    <MapboxSearch />
                  </div>
                </div>
              </div>

              {/* Acceso personal ocultado en interfaz de cliente */}
            </div>
          )}
        </div>

        {/* Barra de Navegación Inferior Estilo Stitch (Inicio, Menú, Eventos, Pedidos, Perfil) */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-gray-200/80 pb-safe pt-2 px-3 flex justify-between items-center text-[10px]">
          <button
            onClick={() => setActiveMobileTab("home")}
            className={`flex flex-col items-center gap-1.5 flex-1 border-0 bg-transparent py-1 cursor-pointer ${
              activeMobileTab === "home" ? "text-pizza-red font-extrabold scale-105" : "text-pizza-dark/40"
            }`}
          >
            <Home size={18} />
            <span>Inicio</span>
          </button>

          <button
            onClick={() => setActiveMobileTab("menu")}
            className={`flex flex-col items-center gap-1.5 flex-1 border-0 bg-transparent py-1 cursor-pointer ${
              activeMobileTab === "menu" ? "text-pizza-red font-extrabold scale-105" : "text-pizza-dark/40"
            }`}
          >
            <Utensils size={18} />
            <span>Menú</span>
          </button>

          <button
            onClick={() => setActiveMobileTab("eventos")}
            className={`flex flex-col items-center gap-1.5 flex-1 border-0 bg-transparent py-1 cursor-pointer ${
              activeMobileTab === "eventos" ? "text-pizza-red font-extrabold scale-105" : "text-pizza-dark/40"
            }`}
          >
            <Calendar size={18} />
            <span>Eventos</span>
          </button>

          <button
            onClick={() => setActiveMobileTab("pedidos")}
            className={`flex flex-col items-center gap-1.5 flex-1 border-0 bg-transparent py-1 cursor-pointer ${
              activeMobileTab === "pedidos" ? "text-pizza-red font-extrabold scale-105" : "text-pizza-dark/40"
            }`}
          >
            <ClipboardList size={18} />
            <span>Pedidos</span>
          </button>

          <button
            onClick={() => setActiveMobileTab("perfil")}
            className={`flex flex-col items-center gap-1.5 flex-1 border-0 bg-transparent py-1 cursor-pointer ${
              activeMobileTab === "perfil" ? "text-pizza-red font-extrabold scale-105" : "text-pizza-dark/40"
            }`}
          >
            <User size={18} />
            <span>Perfil</span>
          </button>
        </nav>
      </div>

      {/* Info Drawer (Modal Lateral de Contacto en Mobile) */}
      {infoDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex">
          <div className="w-80 bg-white border-r border-gray-200 h-full p-6 flex flex-col justify-between shadow-2xl animate-slide-in text-left">
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                <span className="font-pizza-title text-base font-bold text-pizza-dark">Información</span>
                <button onClick={() => setInfoDrawerOpen(false)} className="text-gray-400 hover:text-pizza-dark border-0 bg-transparent cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-pizza-red mb-1">Restaurante</h4>
                  <p className="text-gray-700 font-medium">{businessConfig.name || "Sabor Boliviano"}</p>
                  <p className="text-gray-500 mt-0.5">{businessConfig.address || "Av. Hernando Siles 456, Sucre, Bolivia"}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-pizza-red mb-1">Contacto</h4>
                  <p className="text-gray-700 font-medium">WhatsApp: {businessConfig.whatsappNumber || "+51 999 999 999"}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-pizza-red mb-1">Horario de Atención</h4>
                  <p className="text-gray-700 font-medium">Lunes a Domingo: 12:00 PM - 11:00 PM</p>
                </div>
              </div>
            </div>

            {/* Acceso personal ocultado en interfaz de cliente */}
          </div>
        </div>
      )}

      {/* Modal de Personalización (Común) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] relative">
            
            {/* Botón de Cerrar Absoluto */}
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 z-20 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 cursor-pointer border-0 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Cabecera con Imagen (si existe) */}
            {selectedProduct.imageUrl ? (
              <div className="relative h-44 w-full shrink-0">
                <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                <div className="absolute bottom-4 left-5 right-5 text-left">
                  <h3 className="font-pizza-title text-xl font-bold text-white drop-shadow keep-white">
                    {selectedProduct.name}
                  </h3>
                  {selectedProduct.description && (
                    <p className="text-[11px] text-white/70 line-clamp-2 mt-1 leading-normal max-w-md keep-white">
                      {selectedProduct.description}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-5 border-b border-gray-100 text-left shrink-0">
                <div>
                  <h3 className="font-pizza-title text-lg font-bold text-pizza-dark">
                    Personalizar: {selectedProduct.name}
                  </h3>
                  {selectedProduct.description && (
                    <p className="text-xs text-gray-500 mt-1 max-w-xs">{selectedProduct.description}</p>
                  )}
                </div>
              </div>
            )}

            {/* Contenido Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
              {/* Opciones del Producto */}
              {selectedProduct.options && Object.entries(selectedProduct.options).map(([groupName, values]) => (
                <div key={groupName} className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
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
                              ? "bg-pizza-red/10 border-pizza-red text-pizza-red font-black shadow-md shadow-pizza-red/5"
                              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                          }`}
                        >
                          <span className="truncate w-full">{cleanedLabel}</span>
                          {extraPrice > 0 ? (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold self-end border mt-1.5 ${
                              isSelected 
                                ? "bg-pizza-red/20 border-pizza-red text-pizza-red" 
                                : "bg-gray-50 border-gray-200 text-gray-500"
                            }`}>
                              + {formatCurrency(extraPrice, businessConfig.currency)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-medium self-end mt-1.5">
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
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Componentes del Combo:
                  </h4>
                  <div className="space-y-3">
                    {selectedProduct.comboItems.map((itemText, idx) => {
                      const parsed = parseComboItem(itemText);
                      if (parsed.isSelection) {
                        const currentValue = comboItemsSelected[idx] || "";
                        const selectedOption = parsed.options.find(opt => `${parsed.name}: ${opt}` === currentValue || opt === currentValue) || parsed.options[0];
                        
                        return (
                          <div key={idx} className="bg-gray-50 border border-gray-100 rounded-2xl p-4.5 space-y-3">
                            <span className="text-[11px] font-bold text-pizza-red block uppercase tracking-wider">
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
                                        ? "bg-pizza-red text-white font-extrabold border-pizza-red shadow-md shadow-pizza-red/10 keep-white"
                                        : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
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
                          <div key={idx} className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-extrabold text-xs">
                                ✓
                              </div>
                              <span className="text-xs text-pizza-dark font-medium">{parsed.name}</span>
                            </div>
                            <span className="text-[9px] bg-emerald-50 border border-emerald-200 text-emerald-600 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
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
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Cantidad:</span>
                <div className="flex items-center gap-4 bg-gray-100 rounded-2xl border border-gray-200 p-1.5">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-1 text-gray-500 hover:text-pizza-dark hover:bg-gray-200 rounded-xl cursor-pointer border-0 bg-transparent"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="text-sm font-bold w-6 text-center text-pizza-dark">{quantity}</span>
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
                    className="p-1 text-gray-500 hover:text-pizza-dark hover:bg-gray-200 rounded-xl cursor-pointer border-0 bg-transparent"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Pie de modal */}
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-left shrink-0">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Total Adición:</span>
                <span className="text-lg font-black text-pizza-red">
                  {formatCurrency(getProductPriceWithExtras(selectedProduct, optionsSelected) * quantity, businessConfig.currency)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddToCart}
                className="bg-pizza-red hover:bg-pizza-red/90 text-white rounded-2xl px-6 py-3 font-bold text-xs transition-all cursor-pointer shadow-lg shadow-pizza-red/20 border-0 active:scale-98 keep-white"
              >
                Agregar al Carrito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cajón lateral del Carrito (Solo visible en Desktop) */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white border-l border-gray-200 h-full flex flex-col shadow-2xl relative">
            {/* Cabecera Carrito */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-white">
              <div className="flex items-center gap-2">
                <ShoppingBag className="text-pizza-red" size={20} />
                <h3 className="font-pizza-title text-base font-bold text-pizza-dark">Tu Carrito</h3>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-pizza-dark cursor-pointer border-0 bg-transparent"
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenido Carrito */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 text-left">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-gray-450">
                  <ShoppingBag size={48} className="mb-4 text-gray-200" />
                  <p className="text-sm font-medium">Tu carrito está vacío</p>
                  <p className="text-xs max-w-xs mt-1 text-gray-500">Explora el catálogo y agrega tus platos favoritos.</p>
                </div>
              ) : (
                <>
                  {/* Lista de productos */}
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div
                        key={item.cartId}
                        className="flex items-start gap-3 bg-white border border-gray-200 rounded-2xl p-4 relative shadow-sm"
                      >
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-pizza-dark">{item.name}</h4>
                          <span className="text-xs font-semibold text-pizza-gold block mt-0.5">
                            {formatCurrency(item.price, businessConfig.currency)}
                          </span>

                          {/* Opciones seleccionadas */}
                          {Object.keys(item.optionsSelected).length > 0 && (
                            <div className="text-[10px] text-gray-500 mt-1.5 leading-tight">
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
                            className="p-1 text-gray-400 hover:text-pizza-red transition-colors cursor-pointer border-0 bg-transparent"
                          >
                            <Trash2 size={14} />
                          </button>
                          
                          <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-xl p-1">
                            <button
                              onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                              className="p-0.5 text-gray-500 hover:text-pizza-dark hover:bg-gray-200 rounded cursor-pointer border-0 bg-transparent"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="text-xs font-bold w-4 text-center text-pizza-dark">{item.quantity}</span>
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
                              className="p-0.5 text-gray-500 hover:text-pizza-dark hover:bg-gray-200 rounded cursor-pointer border-0 bg-transparent"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Cupón */}
                  <form onSubmit={handleApplyCoupon} className="pt-4 border-t border-gray-200 space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
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
                          placeholder="BOLIVIA50"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value)}
                          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-pizza-dark text-xs placeholder-gray-400 focus:outline-none focus:border-pizza-red focus:ring-1 focus:ring-pizza-red"
                        />
                        <button
                          type="submit"
                          className="bg-pizza-red hover:bg-pizza-red/90 text-white px-4 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 keep-white"
                        >
                          Aplicar
                        </button>
                      </div>
                    )}
                    {!couponCode && availableCoupons.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1.5">
                        <span className="text-[9px] text-gray-400 block w-full">Sugeridos:</span>
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
                  <div className="pt-4 border-t border-gray-200 space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Modalidad de Entrega
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setServiceMode("pickup")}
                        className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                          serviceMode === "pickup"
                            ? "bg-pizza-red/10 border-pizza-red text-pizza-red font-bold"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        Llevar 🥡
                      </button>
                      <button
                        type="button"
                        onClick={() => setServiceMode("delivery")}
                        className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                          serviceMode === "delivery"
                            ? "bg-pizza-red/10 border-pizza-red text-pizza-red font-bold"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        Delivery 🚀
                      </button>
                      <button
                        type="button"
                        onClick={() => setServiceMode("dinein")}
                        className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                          serviceMode === "dinein"
                            ? "bg-pizza-red/10 border-pizza-red text-pizza-red font-bold"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        Mesa 🍽️
                      </button>
                    </div>
                  </div>

                  {/* Formulario de Datos */}
                  <form onSubmit={handleSubmitOrder} className="pt-4 border-t border-gray-200 space-y-4">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Datos de Facturación &amp; Envío
                    </label>

                    <div className="space-y-3">
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Tu Nombre Completo"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-pizza-dark text-xs placeholder-gray-400 focus:outline-none focus:border-pizza-red focus:ring-1 focus:ring-pizza-red"
                      />
                      <input
                        type="text"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Teléfono (WhatsApp)"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-pizza-dark text-xs placeholder-gray-400 focus:outline-none focus:border-pizza-red focus:ring-1 focus:ring-pizza-red"
                      />

                      {serviceMode === "delivery" && (
                        <div className="space-y-2">
                          <MapboxSearch />
                          {shippingDistance > 0 && (
                            <div className="bg-pizza-gold/5 border border-pizza-gold/20 rounded-xl p-3 flex flex-col gap-1 text-[11px] text-pizza-gold">
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
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-pizza-dark text-xs focus:outline-none focus:border-pizza-red focus:ring-1 focus:ring-pizza-red"
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
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Método de Pago
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("cash")}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                              paymentMethod === "cash"
                                ? "bg-pizza-gold/10 border-pizza-gold text-pizza-gold font-bold"
                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            💵 Efectivo
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("yape")}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                              paymentMethod === "yape"
                                ? "bg-pizza-gold/10 border-pizza-gold text-pizza-gold font-bold"
                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            📱 Yape/Plin
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("transfer")}
                            className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase border transition-all cursor-pointer ${
                              paymentMethod === "transfer"
                                ? "bg-pizza-gold/10 border-pizza-gold text-pizza-gold font-bold"
                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            💳 Transf.
                          </button>
                        </div>
                        {paymentMethod === "yape" && businessConfig.yapeQrUrl && (
                          <div className="mt-4 flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-2xl gap-2 text-center animate-fade-in">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Escanea el QR para pagar con Yape o Plin</span>
                            <div className="w-40 h-40 bg-white rounded-xl p-2 flex items-center justify-center shadow-lg border border-gray-200">
                              <img src={businessConfig.yapeQrUrl} alt="QR Yape" className="w-full h-full object-contain" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Resumen de totales */}
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2 mt-4 text-xs text-pizza-dark shadow-xs">
                      <div className="flex justify-between text-gray-600">
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
                        <div className="flex justify-between text-gray-600">
                          <span>{businessConfig.tax.taxName} ({businessConfig.tax.taxRate}%):</span>
                          <span>{formatCurrency(totals.taxAmount, businessConfig.currency)}</span>
                        </div>
                      )}

                      {serviceMode === "delivery" && (
                        <div className="flex justify-between text-gray-650">
                          <span>Envío (Delivery):</span>
                          <span>{formatCurrency(totals.shippingCost, businessConfig.currency)}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-base font-extrabold text-pizza-dark pt-2 border-t border-gray-200">
                        <span>TOTAL NETO:</span>
                        <span className="text-pizza-gold">{formatCurrency(totals.total, businessConfig.currency)}</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loadingOrder}
                      className="w-full bg-pizza-red hover:bg-pizza-red/90 text-white rounded-2xl py-4 font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-pizza-red/20 disabled:opacity-50 border-0 keep-white"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md p-6 relative overflow-hidden text-left shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="absolute top-0 right-0 p-4">
              <button
                onClick={() => {
                  setIsTrackModalOpen(false);
                  setTrackPhoneInput("");
                  setTrackResults([]);
                  setTrackError("");
                }}
                className="text-gray-400 hover:text-pizza-dark p-1 rounded-full hover:bg-gray-100 cursor-pointer border-0 bg-transparent"
              >
                <X size={20} />
              </button>
            </div>

            <h3 className="font-pizza-title text-xl font-bold text-pizza-dark mb-2 flex items-center gap-2">
              <Search size={20} className="text-pizza-red" />
              Seguimiento de Pedido
            </h3>
            <p className="text-xs text-gray-500 mb-5">
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
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-pizza-dark placeholder-gray-400 focus:outline-none focus:border-pizza-red focus:ring-1 focus:ring-pizza-red"
                />
                <button
                  type="submit"
                  disabled={trackLoading}
                  className="bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl px-4 py-3 text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer border-0 keep-white"
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
                <h4 className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Pedidos Encontrados:</h4>
                <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto pr-1 space-y-2">
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
                        <span className="text-xs font-bold text-pizza-dark group-hover:text-pizza-red transition-colors block">
                          Orden #{res.orderNumber}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {res.createdAt ? new Date(res.createdAt.seconds * 1000).toLocaleString() : "Reciente"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${
                          res.status === "pending_approval" ? "bg-pizza-gold/10 border-pizza-gold/20 text-pizza-gold" :
                          res.status === "preparing" ? "bg-pizza-red/10 border-pizza-red/20 text-pizza-red" :
                          res.status === "ready" ? "bg-emerald-50 border-emerald-200 text-emerald-600 font-bold" :
                          res.status === "completed" ? "bg-gray-100 border-gray-200 text-gray-505" :
                          "bg-red-50 border-red-200 text-red-600"
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

      {/* MODAL DE PRE-REGISTRO A EVENTOS */}
      {selectedEventForReg && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col text-left animate-in fade-in zoom-in-95 duration-250">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-pizza-title text-sm font-bold uppercase text-pizza-dark flex items-center gap-1.5">
                <Calendar size={15} className="text-pizza-red" />
                Pre-registro
              </h3>
              {!registeringEvent && (
                <button
                  onClick={() => setSelectedEventForReg(null)}
                  className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-pizza-dark cursor-pointer border-0 bg-transparent"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="p-6">
              {!regSuccessCoupon ? (
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div className="text-center pb-2">
                    <span className="text-[10px] text-pizza-red font-bold uppercase tracking-wider block">Registrándote para:</span>
                    <h4 className="text-sm font-bold text-pizza-dark leading-tight mt-0.5">{selectedEventForReg.title}</h4>
                    <span className="text-[10px] text-gray-500 block mt-1">📅 {selectedEventForReg.date} | ⏰ {selectedEventForReg.time}</span>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1 font-pizza-title">Tu Nombre Completo</label>
                    <input
                      type="text"
                      required
                      value={regForm.name}
                      onChange={(e) => setRegForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ej. Juan Pérez"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-pizza-dark placeholder-gray-400 focus:outline-none focus:border-pizza-red focus:ring-1 focus:ring-pizza-red"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1 font-pizza-title">Teléfono / WhatsApp</label>
                    <input
                      type="tel"
                      required
                      value={regForm.phone}
                      onChange={(e) => setRegForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Ej. +51 987654321"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-pizza-dark placeholder-gray-400 focus:outline-none focus:border-pizza-red focus:ring-1 focus:ring-pizza-red"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1 font-pizza-title">Correo Electrónico</label>
                    <input
                      type="email"
                      required
                      value={regForm.email}
                      onChange={(e) => setRegForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="ejemplo@correo.com"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-pizza-dark placeholder-gray-400 focus:outline-none focus:border-pizza-red focus:ring-1 focus:ring-pizza-red"
                    />
                  </div>

                  <div className="flex items-start gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="optin-check"
                      checked={regForm.optIn}
                      onChange={(e) => setRegForm(prev => ({ ...prev, optIn: e.target.checked }))}
                      className="w-4 h-4 mt-0.5 rounded border-gray-300 bg-gray-50 text-pizza-red focus:ring-pizza-red/20 focus:ring-opacity-50 cursor-pointer"
                    />
                    <label htmlFor="optin-check" className="text-[10px] text-gray-500 leading-tight select-none cursor-pointer">
                      Acepto recibir invitaciones a futuros eventos y promociones exclusivas vía WhatsApp o Email.
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={registeringEvent}
                    className="w-full bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl py-3 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-pizza-red/20 border-0 mt-2 disabled:opacity-50 keep-white"
                  >
                    {registeringEvent ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        Confirmar Asistencia
                        <ChevronRight size={14} />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="text-center space-y-4 py-2">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/25 flex items-center justify-center text-green-400 mx-auto text-xl animate-bounce">
                    ✓
                  </div>
                  
                  <div>
                    <h4 className="font-pizza-title text-base font-black text-pizza-dark leading-tight">¡Pre-registro Exitoso!</h4>
                    <p className="text-[11px] text-gray-600 mt-1 font-sans leading-relaxed">
                      Te hemos registrado para <strong>{selectedEventForReg.title}</strong>. ¡Te esperamos!
                    </p>
                  </div>

                  {regSuccessCoupon !== "SUCCESS_NO_COUPON" ? (
                    <div className="bg-pizza-gold/5 border border-pizza-gold/20 rounded-2xl p-4 space-y-2">
                      <span className="text-[9px] uppercase font-bold text-pizza-red tracking-widest block">TU CUPÓN DE DESCUENTO</span>
                      <span className="font-mono text-lg font-black text-pizza-dark bg-gray-50 px-4 py-1.5 rounded-lg border border-gray-200 inline-block tracking-widest">
                        {regSuccessCoupon}
                      </span>
                      <p className="text-[10px] text-gray-500 leading-tight">
                        Se ha aplicado **automáticamente** un <strong>{selectedEventForReg.discountPercent}% de descuento</strong> a tu orden actual.
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(regSuccessCoupon);
                          alert("Código de cupón copiado al portapapeles.");
                        }}
                        className="text-[9px] text-pizza-gold hover:underline font-bold bg-transparent border-0 cursor-pointer block mx-auto"
                      >
                        Copiar Código
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-500 bg-gray-50 border border-gray-150 rounded-xl p-3 leading-relaxed">
                      Presenta tu nombre al ingresar. No es necesario presentar ticket digital.
                    </p>
                  )}

                  <button
                    onClick={() => setSelectedEventForReg(null)}
                    className="w-full bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl py-2.5 font-bold text-xs transition-colors cursor-pointer border-0 mt-2 keep-white"
                  >
                    Volver al Menú
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

