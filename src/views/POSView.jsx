import { useState, useEffect, useRef } from "react";
import { rCol, rDoc } from "../firebase/tenant";
import { useCart } from "../context/CartContext";
import { getDocs, addDoc, setDoc, runTransaction, serverTimestamp, query, where, onSnapshot, updateDoc, increment, orderBy } from "firebase/firestore";
import { db } from "../firebase/config";
import { PaymentModal } from "../components/pos/PaymentModal";
import { SaleReceiptModal } from "../components/pos/SaleReceiptModal";
import { formatCurrency, parseComboItem, getProductPriceWithExtras, getOptionPriceAdjustment } from "../utils/formatters";
import { MapboxSearch } from "../components/MapboxSearch";
import { 
  ShoppingBag, Plus, Minus, X, LogOut, Menu, Search, Volume2, VolumeX, Bell, CheckCircle, XCircle, Printer,
  ChefHat, Receipt, Wallet, Utensils, StickyNote, Clock, Trash2, Bike
} from "lucide-react";
import { logoutUser } from "../firebase/auth";
import { TicketTemplate } from "../components/TicketTemplate";
import { KitchenTicket, PreBillTicket } from "../components/KitchenTicket";

export const POSView = ({ user, role, permissions, onLogout, isEmbedded = false }) => {
  const {
    cart, addToCart, updateQuantity, updateItemNote, clearCart,
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
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [activeMobileTab, setActiveMobileTab] = useState("menu");
  const [posSearch, setPosSearch] = useState("");
  const [tablesList, setTablesList] = useState([]);
  const [zonesList, setZonesList] = useState([]);

  useEffect(() => {
    return onSnapshot(rCol("zones"), (snap) => {
      setZonesList(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    }, () => {});
  }, []);
  const [itemNote, setItemNote] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [lastSentOrder, setLastSentOrder] = useState(null);

  // Cuentas abiertas (pedidos en mesa aún sin cobrar)
  const [openOrders, setOpenOrders] = useState([]);
  const [isAccountsOpen, setIsAccountsOpen] = useState(false);
  const [paymentContext, setPaymentContext] = useState(null);
  const [saleReceipt, setSaleReceipt] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
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

  const printDocument = (type, data, size) => {
    setPrintJob({ type, data, size });
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

  // Valida los datos mínimos según el tipo de servicio
  const validateCartOrder = () => {
    if (serviceMode === "dinein" && !tableNumber) {
      alert("Selecciona la mesa.");
      return false;
    }
    if (serviceMode === "pickup" && !customerName) {
      alert("Ingresa el nombre del cliente para el pedido para llevar.");
      return false;
    }
    if (serviceMode === "delivery") {
      if (!customerName || !customerPhone) {
        alert("Ingresa el nombre y teléfono del cliente para el delivery.");
        return false;
      }
      if (!customerAddress || !customerCoords) {
        alert("Por favor selecciona una dirección de delivery válida de la lista de sugerencias o usa el GPS.");
        return false;
      }
    }
    return true;
  };

  // Registra el carrito como pedido y lo manda a cocina. Devuelve el pedido para imprimir.
  const createOrderFromCart = async (paymentFields = {}) => {
    const totals = getTotals();
    const orderNumber = Math.floor(1000 + Math.random() * 9000).toString();
    const isDineIn = serviceMode === "dinein";
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
      paymentMethod: "",
      paymentStatus: "pending",
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
      sentToKitchenAt: serverTimestamp(),
      ...paymentFields
    };

    const ref = await addDoc(rCol("orders"), orderData);

    for (const item of cart) {
      updateDoc(rDoc("products", item.id), { stock: increment(-item.quantity) }).catch(() => {});
    }

    if (isDineIn) {
      const table = tablesList.find((t) => t.name === tableNumber);
      if (table && table.status !== "ocupada") updateDoc(rDoc("tables", table.id), { status: "ocupada" }).catch(() => {});
    }

    return { ...orderData, id: ref.id, createdAt: { seconds: Math.floor(Date.now() / 1000) } };
  };

  const resetCartForm = (keepTable) => {
    clearCart();
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setOrderNote("");
    if (keepTable) setTableNumber(keepTable);
  };

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 6000);
  };

  // COMANDA: envía a cocina e imprime; la cuenta queda abierta
  const handleSendComanda = async () => {
    if (cart.length === 0 || !validateCartOrder()) return;
    setLoading(true);
    try {
      const order = await createOrderFromCart();
      printDocument("comanda", order);
      setLastSentOrder(order);
      resetCartForm(serviceMode === "dinein" ? tableNumber : "");
      flash(`Comanda #${order.orderNumber} enviada a cocina.`);
    } catch (err) {
      console.error("Error al enviar comanda:", err);
      alert("Error al enviar la comanda.");
    } finally {
      setLoading(false);
    }
  };

  // ---------- Cuentas abiertas (mesas y pedidos para llevar/delivery sin cobrar) ----------
  const buildBill = (key, label, orders, extra = {}) => {
    const itemsMap = {};
    orders.forEach((o) => (o.items || []).forEach((it) => {
      const k = `${it.name}|${it.price}`;
      if (!itemsMap[k]) itemsMap[k] = { name: it.name, price: Number(it.price || 0), quantity: 0 };
      itemsMap[k].quantity += it.quantity;
    }));
    return {
      key,
      label,
      orders,
      subtotal: orders.reduce((n, o) => n + Number(o.subtotal || 0), 0),
      discount: orders.reduce((n, o) => n + Number(o.discountAmount || 0), 0),
      total: orders.reduce((n, o) => n + Number(o.total || 0), 0),
      openedAt: Math.min(...orders.map((o) => o.createdAt?.seconds || Infinity)),
      items: Object.values(itemsMap),
      orderNumbers: orders.map((o) => o.orderNumber),
      inKitchen: orders.filter((o) => o.status === "preparing").length,
      ...extra
    };
  };

  const tableGroups = openOrders.filter((o) => o.serviceMode === "dinein").reduce((acc, o) => {
    const k = o.tableNumber || "Sin mesa";
    (acc[k] = acc[k] || []).push(o);
    return acc;
  }, {});
  const openBills = [
    ...Object.entries(tableGroups).map(([table, list]) => buildBill(`mesa-${table}`, `Mesa ${table}`, list, { tableNumber: table })),
    ...openOrders
      .filter((o) => o.serviceMode !== "dinein")
      .map((o) => buildBill(`orden-${o.id}`, `${o.serviceMode === "delivery" ? "Delivery" : "Para llevar"} #${o.orderNumber}${o.customerName ? ` · ${o.customerName}` : ""}`, [o]))
  ].sort((a, b) => a.openedAt - b.openedAt);

  const currentTableBill = serviceMode === "dinein" && tableNumber ? openBills.find((b) => b.tableNumber === tableNumber) : null;

  // PRECUENTA: cuenta abierta de la mesa + lo que hay en el carrito
  const handlePreBill = (bill) => {
    if (bill) return printDocument("precuenta", bill);
    if (cart.length === 0 && !currentTableBill) return;
    const totals = getTotals();
    const cartOrder = cart.length ? [{ items: cart, subtotal: totals.subtotal, discountAmount: totals.totalDiscount, total: totals.total, orderNumber: "nuevo" }] : [];
    const merged = buildBill("preview", tableNumber ? `Mesa ${tableNumber}` : "", [...(currentTableBill?.orders || []), ...cartOrder], {
      tableNumber: serviceMode === "dinein" ? tableNumber : ""
    });
    printDocument("precuenta", { ...merged, orderNumbers: merged.orderNumbers.filter((n) => n !== "nuevo") });
  };

  const handleAddRound = (bill) => {
    if (bill.tableNumber) {
      setServiceMode("dinein");
      setTableNumber(bill.tableNumber);
    }
    setIsAccountsOpen(false);
    setActiveMobileTab("menu");
  };

  // GENERAR VENTA: abre la ventana de pago con lo pendiente de la mesa + el carrito
  const handleGenerateSale = () => {
    if (cart.length > 0 && !validateCartOrder()) return;
    const cartTotal = cart.length ? getTotals().total : 0;
    const billTotal = currentTableBill?.total || 0;
    if (cartTotal + billTotal <= 0) return;
    setPaymentContext({
      source: "cart",
      bill: currentTableBill,
      amount: Math.round((cartTotal + billTotal) * 100) / 100,
      label: serviceMode === "dinein" && tableNumber ? `Mesa ${tableNumber}` : customerName || "Venta directa"
    });
  };

  const handleChargeBill = (bill) => {
    setPaymentContext({ source: "bill", bill, amount: Math.round(bill.total * 100) / 100, label: bill.label });
  };

  // Número correlativo por serie (NV001-000001)
  const nextReceiptNumber = async (serie) => {
    const counterRef = rDoc("counters", serie);
    const n = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const next = (snap.exists() ? snap.data().value || 0 : 0) + 1;
      tx.set(counterRef, { value: next, updatedAt: serverTimestamp() }, { merge: true });
      return next;
    });
    return `${serie}-${String(n).padStart(6, "0")}`;
  };

  const finalizeSale = async (payment) => {
    const ctx = paymentContext;
    const receiptNumber = await nextReceiptNumber(payment.serie);
    const primaryMethod = payment.payments.length === 1 ? payment.payments[0].method : "mixed";
    const ratio = ctx.amount > 0 ? payment.total / ctx.amount : 1;
    const saleId = `${payment.serie}-${receiptNumber.split("-")[1]}`;

    const paidFields = (orderTotal) => {
      const newTotal = Math.round(orderTotal * ratio * 100) / 100;
      const share = payment.total > 0 ? newTotal / payment.total : 0;
      return {
        paymentStatus: "paid",
        paymentMethod: primaryMethod,
        payments: payment.payments.map((p) => ({ method: p.method, amount: Math.round(p.amount * share * 100) / 100, reference: p.reference })),
        paidAt: serverTimestamp(),
        paidBy: user.uid,
        saleId,
        receiptType: payment.receiptType,
        receiptNumber,
        invoiceCustomer: payment.customer,
        ...(ratio < 1 ? { total: newTotal, saleDiscountPercent: payment.discountPercent } : {})
      };
    };

    const paidOrders = [];
    // 1. Pedidos que ya estaban abiertos
    const pending = ctx.bill?.orders || [];
    await Promise.all(pending.map((o) => {
      const fields = paidFields(Number(o.total || 0));
      paidOrders.push({ ...o, ...fields });
      return updateDoc(rDoc("orders", o.id), {
        ...fields,
        ...(o.status === "ready" ? { status: "completed", completedAt: serverTimestamp() } : {})
      });
    }));

    // 2. Lo que está en el carrito (va a cocina ya pagado)
    let newOrder = null;
    if (ctx.source === "cart" && cart.length > 0) {
      const totals = getTotals();
      newOrder = await createOrderFromCart(paidFields(totals.total));
      paidOrders.push(newOrder);
    }

    // 3. Registro de la venta
    await setDoc(rDoc("sales", saleId), {
      receiptType: payment.receiptType,
      receiptNumber,
      serie: payment.serie,
      customer: payment.customer,
      orderIds: paidOrders.map((o) => o.id).filter(Boolean),
      orderNumbers: paidOrders.map((o) => o.orderNumber),
      tableNumber: ctx.bill?.tableNumber || (serviceMode === "dinein" ? tableNumber : ""),
      grossTotal: ctx.amount,
      discountPercent: payment.discountPercent,
      total: payment.total,
      taxBase: payment.taxBase,
      taxAmount: payment.taxAmount,
      payments: payment.payments,
      primaryMethod,
      change: payment.change,
      serviceMode: newOrder?.serviceMode || ctx.bill?.orders?.[0]?.serviceMode || serviceMode,
      items: paidOrders.flatMap((o) => o.items || []).map((it) => ({ name: it.name, quantity: it.quantity, price: Number(it.price || 0), note: it.note || "" })),
      customerPhone: paidOrders[0]?.customerPhone || "",
      customerAddress: paidOrders[0]?.customerAddress || "",
      status: "valid",
      cashier: user.email,
      createdAt: serverTimestamp()
    });

    // 4. Liberar la mesa si quedó todo cobrado
    const tableName = ctx.bill?.tableNumber || (newOrder?.serviceMode === "dinein" ? newOrder.tableNumber : "");
    if (tableName) {
      const table = tablesList.find((t) => t.name === tableName);
      if (table) updateDoc(rDoc("tables", table.id), { status: "libre" }).catch(() => {});
    }

    // 5. Recibo de venta (ventana con imprimir, WhatsApp y PDF)
    const allItems = paidOrders.flatMap((o) => o.items || []);
    const firstOrder = paidOrders[0] || {};
    setSaleReceipt({
      receiptNumber,
      receiptType: payment.receiptType,
      createdAtMs: Date.now(),
      customer: {
        ...payment.customer,
        name: payment.customer.id ? payment.customer.name : (firstOrder.serviceMode !== "dinein" && firstOrder.customerName) || "Clientes Varios",
        phone: payment.customer.phone || firstOrder.customerPhone || "",
        address: firstOrder.customerAddress || ""
      },
      customerPhone: firstOrder.customerPhone || "",
      serviceMode: newOrder?.serviceMode || firstOrder.serviceMode || serviceMode,
      tableNumber: tableName,
      items: allItems.map((it) => ({ name: it.name, quantity: it.quantity, price: Number(it.price || 0), note: it.note || "" })),
      subtotal: allItems.reduce((n, i) => n + Number(i.price || 0) * i.quantity, 0),
      discount: Math.round((ctx.amount - payment.total) * 100) / 100,
      taxBase: payment.taxBase,
      taxAmount: payment.taxAmount,
      shippingCost: paidOrders.reduce((n, o) => n + Number(o.shippingCost || 0), 0),
      total: payment.total,
      payments: payment.payments,
      change: payment.change,
      primaryMethod
    });

    if (newOrder) {
      setLastSentOrder(newOrder);
      resetCartForm("");
    }
    setPaymentContext(null);
    flash(`Venta ${receiptNumber} registrada${payment.change > 0 ? ` · Cambio ${formatCurrency(payment.change, businessConfig.currency)}` : ""}.`);
  };

  const totals = getTotals();

  // ---------- Panel "Orden actual" (escritorio y móvil) ----------
  const renderCartPanel = (variant) => {
    const isDesktop = variant === "desktop";
    const itemsCount = cart.reduce((n, i) => n + i.quantity, 0);
    const grandTotal = totals.total + (currentTableBill?.total || 0);
    const canSell = cart.length > 0 || Boolean(currentTableBill);
    const modeBtn = (id, label, Icon) => (
      <button
        key={id}
        type="button"
        onClick={() => setServiceMode(id)}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
          serviceMode === id ? "bg-pizza-red text-white shadow" : "text-white/60 hover:text-white"
        }`}
      >
        <Icon size={13} /> {label}
      </button>
    );
    const inputCls = "w-full bg-[#181818] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-pizza-red/60";

    return (
      <div className={isDesktop
        ? `w-[400px] xl:w-[440px] shrink-0 bg-[#101010] border-l border-white/5 flex flex-col ${isEmbedded ? "h-full" : "h-screen sticky top-0"}`
        : "flex flex-col text-left bg-[#101010] rounded-2xl border border-white/5 overflow-hidden"}
      >
        {/* Zona desplazable: datos del pedido y productos (el pie queda fijo) */}
        <div className={isDesktop ? "flex-1 min-h-0 overflow-y-auto" : ""}>
        {/* Cabecera */}
        <div className="p-4 border-b border-white/5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-pizza-title text-base font-bold flex items-center gap-2">
              <ShoppingBag size={18} className="text-pizza-red" />
              Orden actual
              {itemsCount > 0 && <span className="bg-pizza-red text-white text-[10px] font-black rounded-full px-2 py-0.5">{itemsCount}</span>}
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => { setNowSec(Math.floor(Date.now() / 1000)); setIsAccountsOpen(true); }}
                className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  openBills.length > 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                }`}
                title="Cuentas sin cobrar"
              >
                <Receipt size={12} /> Cuentas{openBills.length > 0 ? ` (${openBills.length})` : ""}
              </button>
              {cart.length > 0 && (
                <button type="button" onClick={clearCart} className="p-1.5 rounded-lg text-white/40 hover:text-pizza-red hover:bg-pizza-red/10 cursor-pointer" title="Vaciar orden" aria-label="Vaciar orden">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-1 p-1 rounded-xl bg-[#181818] border border-white/5">
            {modeBtn("dinein", "Mesa", Utensils)}
            {modeBtn("pickup", "Para llevar", ShoppingBag)}
            {modeBtn("delivery", "Delivery", Bike)}
          </div>

          {serviceMode === "dinein" && (
            <div className="space-y-2">
              <select value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} className={inputCls}>
                <option value="">Selecciona la mesa</option>
                {[...zonesList, { id: "", name: zonesList.length ? "Sin lugar" : "" }].map((z) => {
                  const group = tablesList.filter((t) => (z.id ? t.zoneId === z.id : !zonesList.some((zz) => zz.id === t.zoneId)));
                  if (group.length === 0) return null;
                  const opts = group.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name} · {t.capacity || "?"} pers. {openBills.some((b) => b.tableNumber === t.name) ? "(cuenta abierta)" : t.status === "ocupada" ? "(ocupada)" : ""}
                    </option>
                  ));
                  return z.name ? <optgroup key={z.id || "none"} label={z.name}>{opts}</optgroup> : opts;
                })}
              </select>
              {currentTableBill && (
                <div className="flex items-center justify-between text-[11px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl px-3 py-2">
                  <span className="font-bold">Cuenta abierta · {currentTableBill.orders.length} pedido(s)</span>
                  <span className="font-black">{formatCurrency(currentTableBill.total, businessConfig.currency)}</span>
                </div>
              )}
            </div>
          )}
          {serviceMode !== "dinein" && (
            <div className="grid grid-cols-2 gap-2">
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nombre del cliente" className={inputCls} />
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder={serviceMode === "delivery" ? "Teléfono" : "Teléfono (opcional)"} className={inputCls} />
            </div>
          )}
          {serviceMode === "delivery" && (
            <div className="space-y-2">
              <MapboxSearch compact />
              {shippingDistance > 0 && (
                <div className="bg-white/5 rounded-xl px-3 py-2 text-[11px] text-white/60">
                  Envío: <strong className="text-white">{shippingDistance.toFixed(2)} km</strong> · {formatCurrency(shippingCost, businessConfig.currency)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Productos */}
        <div className="p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="py-10 text-center text-white/40">
              <ShoppingBag size={30} className="mx-auto mb-2 text-white/15" />
              <p className="text-xs font-semibold">La orden está vacía</p>
              <p className="text-[11px] text-white/30">Toca un producto del catálogo para agregarlo.</p>
            </div>
          ) : cart.map((item) => (
            <div key={item.cartId} className="bg-[#181818] border border-white/5 rounded-2xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-tight">{item.name}</p>
                  <p className="text-[11px] text-white/40">{formatCurrency(item.price, businessConfig.currency)} c/u</p>
                  {Object.keys(item.optionsSelected || {}).length > 0 && (
                    <p className="text-[10px] text-white/50 mt-0.5">{Object.entries(item.optionsSelected).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
                  )}
                  {item.comboItems?.length > 0 && <p className="text-[10px] text-white/50 mt-0.5">Combo: {item.comboItems.join(" + ")}</p>}
                </div>
                <span className="text-sm font-black shrink-0">{formatCurrency(item.price * item.quantity, businessConfig.currency)}</span>
              </div>

              {editingNoteId === item.cartId ? (
                <div className="flex gap-1.5 mt-2">
                  <input
                    autoFocus
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { updateItemNote(item.cartId, noteDraft); setEditingNoteId(null); } if (e.key === "Escape") setEditingNoteId(null); }}
                    placeholder="Ej. sin cebolla, bien cocido..."
                    className="flex-1 bg-[#101010] border border-amber-500/30 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-white/30 focus:outline-none"
                  />
                  <button type="button" onClick={() => { updateItemNote(item.cartId, noteDraft); setEditingNoteId(null); }} className="px-2.5 rounded-lg bg-amber-500 text-white cursor-pointer" aria-label="Guardar nota">
                    <CheckCircle size={13} />
                  </button>
                </div>
              ) : item.note ? (
                <button type="button" onClick={() => { setEditingNoteId(item.cartId); setNoteDraft(item.note); }} className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 bg-amber-500/10 rounded-lg px-2.5 py-1 cursor-pointer">
                  <StickyNote size={11} /> {item.note}
                </button>
              ) : null}

              <div className="flex items-center justify-between mt-2">
                <button
                  type="button"
                  onClick={() => { setEditingNoteId(item.cartId); setNoteDraft(item.note || ""); }}
                  className={`text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${item.note ? "text-white/30 hover:text-white/60" : "text-pizza-red hover:underline"}`}
                >
                  <StickyNote size={11} /> {item.note ? "Editar nota" : "Añadir nota para comanda"}
                </button>
                <div className="flex items-center gap-1">
                  <div className="flex items-center bg-[#101010] rounded-lg border border-white/5">
                    <button type="button" onClick={() => updateQuantity(item.cartId, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white cursor-pointer" aria-label="Quitar uno">
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const p = products.find((x) => x.id === item.id);
                        if (p && p.stock !== undefined && item.quantity >= p.stock) {
                          alert(`No hay suficiente stock disponible. Límite: ${p.stock} unidades.`);
                          return;
                        }
                        updateQuantity(item.cartId, item.quantity + 1);
                      }}
                      className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white cursor-pointer"
                      aria-label="Agregar uno"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <button type="button" onClick={() => updateQuantity(item.cartId, 0)} className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-pizza-red hover:bg-pizza-red/10 cursor-pointer" aria-label="Quitar producto">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        </div>

        {/* Pie: totales y acciones */}
        <div className="p-4 border-t border-white/5 space-y-3">
          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-xl px-3 py-2.5 text-xs font-semibold">
              <span className="block">{successMsg}</span>
              {lastSentOrder && (
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => printDocument("comanda", lastSentOrder)} className="flex items-center gap-1 bg-white/10 hover:bg-white/15 text-white rounded-lg px-2.5 py-1 text-[10px] font-bold cursor-pointer">
                    <Printer size={11} /> Reimprimir comanda
                  </button>
                </div>
              )}
            </div>
          )}

          {cart.length > 0 && (
            <input value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder="Nota general para cocina (opcional)" className={inputCls} />
          )}

          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-white/50"><span>Subtotal</span><span>{formatCurrency(totals.subtotal, businessConfig.currency)}</span></div>
            {totals.totalDiscount > 0 && (
              <div className="flex justify-between text-pizza-red"><span>Descuento</span><span>-{formatCurrency(totals.totalDiscount, businessConfig.currency)}</span></div>
            )}
            {serviceMode === "delivery" && totals.shippingCost > 0 && (
              <div className="flex justify-between text-white/50"><span>Envío</span><span>{formatCurrency(totals.shippingCost, businessConfig.currency)}</span></div>
            )}
            {currentTableBill && (
              <div className="flex justify-between text-white/50"><span>Ya pedido en la mesa</span><span>{formatCurrency(currentTableBill.total, businessConfig.currency)}</span></div>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t border-white/5">
              <span className="text-sm font-bold">Total</span>
              <span className="text-2xl font-black">{formatCurrency(grandTotal, businessConfig.currency)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handlePreBill()}
              disabled={!canSell}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold disabled:opacity-40 cursor-pointer"
            >
              <Receipt size={15} /> Precuenta
            </button>
            <button
              type="button"
              onClick={handleSendComanda}
              disabled={loading || cart.length === 0}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-bold disabled:opacity-40 cursor-pointer"
            >
              <ChefHat size={15} /> {loading ? "Enviando..." : "Comanda"}
            </button>
          </div>
          <button
            type="button"
            onClick={handleGenerateSale}
            disabled={loading || !canSell}
            className="w-full flex items-center justify-between gap-2 px-4 py-3.5 rounded-xl bg-pizza-red hover:bg-pizza-red/90 text-white font-bold text-sm shadow-lg shadow-pizza-red/20 disabled:opacity-40 cursor-pointer"
          >
            <span className="flex items-center gap-2"><Wallet size={17} /> Generar venta</span>
            <span className="font-black">{formatCurrency(grandTotal, businessConfig.currency)}</span>
          </button>
        </div>
      </div>
    );
  };

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

        {renderCartPanel("desktop")}
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

          {activeMobileTab === "cart" && renderCartPanel("mobile")}

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
                <p className="text-[11px] text-white/40">Mesas y pedidos sin cobrar</p>
              </div>
              <button onClick={() => setIsAccountsOpen(false)} className="p-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-white cursor-pointer" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {openBills.length === 0 ? (
                <div className="py-16 text-center text-xs text-white/40">
                  <Utensils size={28} className="mx-auto mb-2 text-white/20" />
                  No hay cuentas por cobrar.
                </div>
              ) : openBills.map((bill) => {
                const minutes = Number.isFinite(bill.openedAt) ? Math.max(0, Math.floor((nowSec - bill.openedAt) / 60)) : 0;
                return (
                  <div key={bill.key} className="bg-[#181818] border border-white/5 rounded-2xl p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-base font-black">{bill.label}</h4>
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
                    <div className={`grid ${bill.tableNumber ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
                      {bill.tableNumber && <button onClick={() => handleAddRound(bill)} className="flex flex-col items-center gap-1 bg-white/5 hover:bg-white/10 rounded-xl py-2.5 text-[10px] font-bold cursor-pointer">
                        <Plus size={14} /> Agregar
                      </button>}
                      <button onClick={() => handlePreBill(bill)} className="flex flex-col items-center gap-1 bg-white/5 hover:bg-white/10 rounded-xl py-2.5 text-[10px] font-bold cursor-pointer">
                        <Printer size={14} /> Precuenta
                      </button>
                      <button
                        onClick={() => { setIsAccountsOpen(false); handleChargeBill(bill); }}
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

      {saleReceipt && (
        <SaleReceiptModal
          receipt={saleReceipt}
          businessConfig={businessConfig}
          onClose={() => setSaleReceipt(null)}
          onPrint={(kind) => printDocument("receipt", {
            orderNumber: saleReceipt.receiptNumber,
            receiptType: saleReceipt.receiptType,
            customerName: saleReceipt.customer.name,
            customerPhone: saleReceipt.customer.phone || "",
            customerDoc: saleReceipt.customer.docNumber && saleReceipt.customer.docNumber !== "0" ? `${saleReceipt.customer.docType} ${saleReceipt.customer.docNumber}` : "",
            serviceMode: saleReceipt.serviceMode,
            tableNumber: saleReceipt.tableNumber,
            customerAddress: saleReceipt.customer.address,
            paymentMethod: saleReceipt.primaryMethod,
            items: saleReceipt.items,
            subtotal: saleReceipt.subtotal,
            discountAmount: saleReceipt.discount,
            taxAmount: saleReceipt.taxAmount,
            shippingCost: saleReceipt.shippingCost,
            total: saleReceipt.total,
            createdAt: { seconds: Math.floor(saleReceipt.createdAtMs / 1000) }
          }, kind === "letter" ? "letter" : undefined)}
        />
      )}

      {paymentContext && (
        <PaymentModal
          amountDue={paymentContext.amount}
          businessConfig={businessConfig}
          subtitle={paymentContext.label}
          defaultCustomerName={customerName}
          onClose={() => setPaymentContext(null)}
          onConfirm={finalizeSale}
        />
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
          printSize={printJob.size || printSize}
        />
      )}
      {printJob?.type === "comanda" && <KitchenTicket order={printJob.data} printSize={printSize} />}
      {printJob?.type === "precuenta" && <PreBillTicket bill={printJob.data} config={businessConfig} printSize={printSize} />}
    </div>
  );
};
