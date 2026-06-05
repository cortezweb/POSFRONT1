import { useState, useEffect, useMemo, useRef } from "react";
import { db, firebaseConfig, storage } from "../firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { compressImage } from "../utils/imageCompressor";
import { searchAddress } from "../utils/mapboxService";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
import { 
  collection, query, onSnapshot, doc, updateDoc, setDoc, deleteDoc, addDoc,
  serverTimestamp, orderBy, increment 
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { formatCurrency } from "../utils/formatters";
import { logoutUser } from "../firebase/auth";
import { SoundNotification } from "../components/SoundNotification";
import { TicketTemplate } from "../components/TicketTemplate";
import { POSView } from "./POSView";
import { CookView } from "./CookView";
import { 
  Check, X, Printer, Settings, LogOut, Loader2, ClipboardList, MessageSquare, 
  MapPin, Users, DollarSign, Package, ShieldAlert, Globe, Percent, BarChart3, 
  Download, Plus, Trash2, Edit2, Menu, Lock, FileText, Search, Store,
  TrendingUp, Tag, Table, ChefHat, Info, Calendar
} from "lucide-react";

import { usePermissions } from "../hooks/usePermissions";
import { PERMISSIONS, ROLES_PERMISSIONS } from "../utils/permissionsConfig";
import { HasPermission } from "../components/HasPermission";

export const AdminView = ({ user, role, permissions, onLogout }) => {
  const { hasPermission } = usePermissions(role, permissions);
  const [activeTab, setActiveTab] = useState("pedidos");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Impresión e Interfaces
  const [printSize, setPrintSize] = useState("80mm");
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [filterStatus, setFilterStatus] = useState("pending_approval"); // 'pending_approval' | 'preparing' | 'ready' | 'archived'

  // Hover states for custom SVG graphs
  const [hoveredHourPoint, setHoveredHourPoint] = useState(null);
  const [hoveredProductIndex, setHoveredProductIndex] = useState(null);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadLogoError, setUploadLogoError] = useState("");
  const [uploadingQr, setUploadingQr] = useState(false);
  const [uploadQrError, setUploadQrError] = useState("");

  // Estados y Refs para Mapa del Local
  const [adminMapSearch, setAdminMapSearch] = useState("");
  const [adminMapSuggestions, setAdminMapSuggestions] = useState([]);
  const [loadingAdminMap, setLoadingAdminMap] = useState(false);
  const [isAdminMapSearchOpen, setIsAdminMapSearchOpen] = useState(false);

  const adminMapContainerRef = useRef(null);
  const adminMapRef = useRef(null);
  const adminMarkerRef = useRef(null);
  const isAdminDraggingRef = useRef(false);
  const adminSearchTimeoutRef = useRef(null);

  const [visualOptions, setVisualOptions] = useState([]);
  const [visualCombos, setVisualCombos] = useState([]);
  const [editorMode, setEditorMode] = useState("visual"); // 'visual' | 'text'

  // Configuración del negocio leída para el ticket y administración
  const [businessConfig, setBusinessConfig] = useState({
    name: "Pizza Hub & Co.",
    whatsappNumber: "+51999999999",
    address: "Av. del Sabor 789, Ciudad Pizza",
    currency: "USD",
    logoUrl: "",
    yapeQrUrl: "",
    vCardEnabled: true,
    maintenanceMessage: "",
    tax: { taxEnabled: true, taxRate: 18, taxIncluded: true, taxName: "IGV" },
    discounts: { coupons: {}, autoDiscounts: [] },
    shipping: { shippingMode: "distance", shippingCostPerKm: 1.5, businessLocation: { lat: -12.046374, lng: -77.031002 }, shippingZones: [] },
    serviceModes: { delivery: true, pickup: true, dineIn: true, tableNumbers: 20, tableLabel: "Mesa" }
  });

  // Catálogo de Productos (Inventario)
  const [productsList, setProductsList] = useState([]);
  // Mesas
  const [tablesList, setTablesList] = useState([]);
  const [tableNameForm, setTableNameForm] = useState("");
  const [tableCapacityForm, setTableCapacityForm] = useState("4");
  const [editingTable, setEditingTable] = useState(null);
  // Lista de usuarios registrada en Firestore (Personal)
  const [usersList, setUsersList] = useState([]);
  // Auditoría
  const [auditLogs, setAuditLogs] = useState([]);
  // Turnos de Caja (Shifts)
  const [shifts, setShifts] = useState([]);
  const [activeShift, setActiveShift] = useState(null);

  // Estados para Módulo de Finanzas
  const [expenses, setExpenses] = useState([]);
  const [financesPeriod, setFinancesPeriod] = useState("month");
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    description: "",
    category: "Insumos",
    amount: "",
    date: ""
  });
  const [isSavingExpense, setIsSavingExpense] = useState(false);

  // States para Formularios
  const [settingsForm, setSettingsForm] = useState(null);
  const [seoForm, setSeoForm] = useState({ metaTitle: "", metaDescription: "", keywords: "" });
  const [storeStatusForm, setStoreStatusForm] = useState({ maintenanceMessage: "", deliveryCostPerKm: 1.5, baseLat: -12.046374, baseLng: -77.031002, deliveryRange: 15 });
  const [marketingForm, setMarketingForm] = useState({ couponCode: "", couponDiscount: "", minAmountDiscount: "", discountPercentRule: "" });

  // Registro de Personal
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffRole, setStaffRole] = useState("cashier");
  const [staffPermissions, setStaffPermissions] = useState([]);
  const [staffRegistering, setStaffRegistering] = useState(false);
  const [editingPermissionsUser, setEditingPermissionsUser] = useState(null);
  const [editingPermissionsList, setEditingPermissionsList] = useState([]);

  // Arqueo de Caja
  const [cashBase, setCashBase] = useState("");
  const [actualCash, setActualCash] = useState("");
  const [actualElectronic, setActualElectronic] = useState("");

  // Eventos y pre-registros
  const [eventsList, setEventsList] = useState([]);
  const [eventRegistrations, setEventRegistrations] = useState([]);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [crudEvent, setCrudEvent] = useState(null); // null = nuevo
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    couponCode: "",
    discountPercent: "15",
    active: true,
    bannerUrl: ""
  });
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventTabSubView, setEventTabSubView] = useState("lista_eventos"); // 'lista_eventos' | 'registros'
  const [uploadingEventBanner, setUploadingEventBanner] = useState(false);
  const [uploadEventBannerError, setUploadEventBannerError] = useState("");

  // CRUD de Inventario
  const [isCrudModalOpen, setIsCrudModalOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [crudProduct, setCrudProduct] = useState(null); // null = nuevo
  const [crudForm, setCrudForm] = useState({
    id: "",
    name: "",
    description: "",
    price: "",
    discount: "0",
    cost: "",
    stock: "50",
    category: "pizzas",
    imageUrl: "",
    optionsText: "", // "Tamaño: Mediana, Familiar\nMasa: Tradicional, Fina"
    comboItemsText: "" // line separated
  });

  useEffect(() => {
    if (isCrudModalOpen) {
      // Inicializar constructor visual desde los strings de crudForm
      const parsedOpts = [];
      if (crudForm.optionsText?.trim()) {
        crudForm.optionsText.split("\n").forEach((line, idx) => {
          const parts = line.split(":");
          if (parts.length === 2) {
            parsedOpts.push({
              id: Date.now() + idx,
              name: parts[0].trim(),
              values: parts[1].split(",").map(v => v.trim()).filter(Boolean)
            });
          }
        });
      }
      setVisualOptions(parsedOpts);

      const parsedCombos = [];
      if (crudForm.comboItemsText?.trim()) {
        crudForm.comboItemsText.split("\n").forEach((item, idx) => {
          if (item.trim()) {
            parsedCombos.push({
              id: Date.now() + idx,
              value: item.trim()
            });
          }
        });
      }
      setVisualCombos(parsedCombos);
      setEditorMode("visual"); // Resetear a visual por defecto al abrir
    }
  }, [isCrudModalOpen]);

  // Sincronizar estados visuales con los campos de texto correspondientes
  const syncOptionsToText = (newGroups) => {
    const text = newGroups
      .map(g => `${g.name.trim()}: ${g.values.map(v => v.trim()).join(", ")}`)
      .filter(line => line.split(":")[0].trim()) // Filtrar vacíos
      .join("\n");
    setCrudForm(prev => ({ ...prev, optionsText: text }));
  };

  const syncCombosToText = (newCombos) => {
    const text = newCombos
      .map(c => c.value.trim())
      .filter(Boolean)
      .join("\n");
    setCrudForm(prev => ({ ...prev, comboItemsText: text }));
  };

  // Manejadores interactivos para Opciones y Tamaños
  const handleAddOptionGroup = () => {
    const newGroups = [
      ...visualOptions,
      { id: Date.now(), name: "Nuevo Grupo", values: [] }
    ];
    setVisualOptions(newGroups);
    syncOptionsToText(newGroups);
  };

  const handleUpdateGroupName = (id, newName) => {
    const newGroups = visualOptions.map(g => g.id === id ? { ...g, name: newName } : g);
    setVisualOptions(newGroups);
    syncOptionsToText(newGroups);
  };

  const handleRemoveOptionGroup = (id) => {
    const newGroups = visualOptions.filter(g => g.id !== id);
    setVisualOptions(newGroups);
    syncOptionsToText(newGroups);
  };

  const handleAddOptionValue = (groupId, val) => {
    if (!val.trim()) return;
    const newGroups = visualOptions.map(g => {
      if (g.id === groupId) {
        // Evitar duplicados
        if (g.values.includes(val.trim())) return g;
        return { ...g, values: [...g.values, val.trim()] };
      }
      return g;
    });
    setVisualOptions(newGroups);
    syncOptionsToText(newGroups);
  };

  const handleRemoveOptionValue = (groupId, valIdx) => {
    const newGroups = visualOptions.map(g => {
      if (g.id === groupId) {
        return { ...g, values: g.values.filter((_, idx) => idx !== valIdx) };
      }
      return g;
    });
    setVisualOptions(newGroups);
    syncOptionsToText(newGroups);
  };

  // Manejadores interactivos para Ítems de Combo
  const handleAddComboItem = () => {
    const newCombos = [
      ...visualCombos,
      { id: Date.now(), value: "" }
    ];
    setVisualCombos(newCombos);
    syncCombosToText(newCombos);
  };

  const handleUpdateComboItem = (id, newValue) => {
    const newCombos = visualCombos.map(c => c.id === id ? { ...c, value: newValue } : c);
    setVisualCombos(newCombos);
    syncCombosToText(newCombos);
  };

  const handleRemoveComboItem = (id) => {
    const newCombos = visualCombos.filter(c => c.id !== id);
    setVisualCombos(newCombos);
    syncCombosToText(newCombos);
  };

  // Gestión de Categorías
  const [categoriesList, setCategoriesList] = useState([]);
  const [categoryForm, setCategoryForm] = useState({ id: "", name: "" });

  const categoriesListToUse = useMemo(() => {
    return categoriesList.length > 0 ? categoriesList : [
      { id: "pizzas", name: "Pizzas" },
      { id: "combos", name: "Combos" },
      { id: "bebidas", name: "Bebidas" },
      { id: "entradas", name: "Entradas" }
    ];
  }, [categoriesList]);

  // Estados para Filtros y Búsqueda Profesional
  const [orderSearch, setOrderSearch] = useState("");
  const [orderServiceMode, setOrderServiceMode] = useState("all");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryCategory, setInventoryCategory] = useState("all");
  const [customerSearch, setCustomerSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("all");

  // Suscribirse a logs de Auditoría
  const logAuditEvent = async (userEmail, action, details) => {
    try {
      await addDoc(collection(db, "logs"), {
        userEmail,
        action,
        details,
        timestamp: new Date()
      });
    } catch (err) {
      console.error("Error al registrar log de auditoría:", err);
    }
  };

  // Cargar configuración global
  useEffect(() => {
    const docRef = doc(db, "config", "settings");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBusinessConfig(data);
        setSettingsForm(data);
        setSeoForm({
          metaTitle: data.seo?.metaTitle || "",
          metaDescription: data.seo?.metaDescription || "",
          keywords: data.seo?.keywords || ""
        });
        setStoreStatusForm({
          maintenanceMessage: data.maintenanceMessage || "",
          deliveryCostPerKm: data.shipping?.shippingCostPerKm || 1.5,
          baseLat: data.shipping?.businessLocation?.lat || -12.046374,
          baseLng: data.shipping?.businessLocation?.lng || -77.031002,
          deliveryRange: data.shipping?.deliveryRange || 15
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Lógica de Mapbox para Ubicación de la Sede/Local
  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
  const hasMapboxToken = mapboxToken && !mapboxToken.includes("PLACEHOLDER");

  // Efecto A: Inicializar y destruir el mapa en la pestaña de tienda
  useEffect(() => {
    if (activeTab !== "tienda" || !hasMapboxToken || !adminMapContainerRef.current) {
      if (adminMapRef.current) {
        adminMapRef.current.remove();
        adminMapRef.current = null;
        adminMarkerRef.current = null;
      }
      return;
    }

    if (!storeStatusForm) return;

    const lat = parseFloat(storeStatusForm.baseLat) || -12.046374;
    const lng = parseFloat(storeStatusForm.baseLng) || -77.031002;

    try {
      mapboxgl.accessToken = mapboxToken;
      const map = new mapboxgl.Map({
        container: adminMapContainerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [lng, lat],
        zoom: 14,
        attributionControl: false
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      // Cargar marcador
      const markerEl = document.createElement("div");
      markerEl.style.fontSize = "32px";
      markerEl.style.cursor = "move";
      markerEl.style.filter = "drop-shadow(0 2px 4px rgba(0,0,0,0.6))";
      markerEl.innerHTML = "🍕";

      const marker = new mapboxgl.Marker(markerEl, { draggable: true })
        .setLngLat([lng, lat])
        .addTo(map);

      // Eventos del marcador
      marker.on("dragstart", () => {
        isAdminDraggingRef.current = true;
      });

      marker.on("dragend", () => {
        const newLngLat = marker.getLngLat();
        setStoreStatusForm((prev) => ({
          ...prev,
          baseLat: newLngLat.lat.toFixed(6),
          baseLng: newLngLat.lng.toFixed(6)
        }));
        isAdminDraggingRef.current = false;
      });

      // Evento de clic en el mapa
      map.on("click", (e) => {
        marker.setLngLat(e.lngLat);
        setStoreStatusForm((prev) => ({
          ...prev,
          baseLat: e.lngLat.lat.toFixed(6),
          baseLng: e.lngLat.lng.toFixed(6)
        }));
      });

      adminMapRef.current = map;
      adminMarkerRef.current = marker;

      return () => {
        if (adminMapRef.current) {
          adminMapRef.current.remove();
          adminMapRef.current = null;
          adminMarkerRef.current = null;
        }
      };
    } catch (err) {
      console.error("Error al inicializar mapa en administración:", err);
    }
  }, [activeTab, storeStatusForm === null]);

  // Efecto B: Sincronizar cambios en los inputs numéricos con el mapa
  useEffect(() => {
    if (adminMapRef.current && adminMarkerRef.current && storeStatusForm && !isAdminDraggingRef.current) {
      const lat = parseFloat(storeStatusForm.baseLat);
      const lng = parseFloat(storeStatusForm.baseLng);
      if (!isNaN(lat) && !isNaN(lng)) {
        adminMarkerRef.current.setLngLat([lng, lat]);
        adminMapRef.current.setCenter([lng, lat]);
      }
    }
  }, [storeStatusForm?.baseLat, storeStatusForm?.baseLng]);

  // Manejador de búsqueda en administración
  const handleAdminSearchChange = (e) => {
    const val = e.target.value;
    setAdminMapSearch(val);

    if (adminSearchTimeoutRef.current) clearTimeout(adminSearchTimeoutRef.current);

    if (val.trim().length < 3) {
      setAdminMapSuggestions([]);
      setIsAdminMapSearchOpen(false);
      return;
    }

    setLoadingAdminMap(true);
    setIsAdminMapSearchOpen(true);

    adminSearchTimeoutRef.current = setTimeout(async () => {
      const results = await searchAddress(val);
      setAdminMapSuggestions(results);
      setLoadingAdminMap(false);
    }, 450);
  };

  const handleSelectAdminSuggestion = (suggestion) => {
    setAdminMapSearch(suggestion.placeName);
    setAdminMapSuggestions([]);
    setIsAdminMapSearchOpen(false);

    setStoreStatusForm((prev) => ({
      ...prev,
      baseLat: suggestion.center.lat.toFixed(6),
      baseLng: suggestion.center.lng.toFixed(6)
    }));
  };

  // Suscribirse a órdenes
  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ords = [];
      snapshot.forEach((doc) => {
        ords.push({ id: doc.id, ...doc.data() });
      });
      setOrders(ords);
      setLoading(false);
    }, (error) => {
      console.error("Error al escuchar órdenes:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Suscribirse a productos (Inventario)
  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods = [];
      snapshot.forEach((doc) => {
        prods.push({ id: doc.id, ...doc.data() });
      });
      setProductsList(prods);
    });
    return () => unsubscribe();
  }, []);

  // Suscribirse a categorías
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

  // Suscribirse a logs de auditoría
  useEffect(() => {
    const q = query(collection(db, "logs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = [];
      snapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() });
      });
      setAuditLogs(logs.slice(0, 100)); // Limitar a los últimos 100 logs
    });
    return () => unsubscribe();
  }, []);

  // Suscribirse a personal (Usuarios)
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const uList = [];
      snapshot.forEach((doc) => {
        uList.push({ uid: doc.id, ...doc.data() });
      });
      setUsersList(uList);
    });
    return () => unsubscribe();
  }, []);

  // Suscribirse a mesas
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

  // Sincronizar permisos por defecto cuando cambia el rol a registrar
  useEffect(() => {
    setStaffPermissions(ROLES_PERMISSIONS[staffRole] || []);
  }, [staffRole]);

  // Suscribirse a turnos de caja
  useEffect(() => {
    const q = query(collection(db, "shifts"), orderBy("openTime", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sList = [];
      snapshot.forEach((doc) => {
        sList.push({ id: doc.id, ...doc.data() });
      });
      setShifts(sList);
      const active = sList.find(s => s.status === "open");
      setActiveShift(active || null);
    });
    return () => unsubscribe();
  }, []);

  // Suscribirse a egresos (gastos financieros)
  useEffect(() => {
    const q = query(collection(db, "expenses"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const exps = [];
      snapshot.forEach((doc) => {
        exps.push({ id: doc.id, ...doc.data() });
      });
      setExpenses(exps);
    }, (error) => {
      console.error("Error al suscribirse a egresos:", error);
    });
    return () => unsubscribe();
  }, []);

  // Suscribirse a eventos
  useEffect(() => {
    const q = query(collection(db, "events"), orderBy("date", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const evs = [];
      snapshot.forEach((doc) => {
        evs.push({ id: doc.id, ...doc.data() });
      });
      setEventsList(evs);
    }, (error) => {
      console.error("Error al escuchar eventos:", error);
    });
    return () => unsubscribe();
  }, []);

  // Suscribirse a pre-registros
  useEffect(() => {
    const q = query(collection(db, "event_registrations"), orderBy("registeredAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const regs = [];
      snapshot.forEach((doc) => {
        regs.push({ id: doc.id, ...doc.data() });
      });
      setEventRegistrations(regs);
    }, (error) => {
      console.error("Error al escuchar pre-registros:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleLogoutClick = async () => {
    await logoutUser();
    onLogout();
  };

  // Filtrado de pedidos
  const pendingOrders = orders.filter((o) => o.status === "pending_approval");
  const preparingOrders = orders.filter((o) => o.status === "preparing");
  const readyOrders = orders.filter((o) => o.status === "ready");
  const archivedOrders = orders.filter((o) => o.status === "completed" || o.status === "rejected");

  const activeOrders = 
    filterStatus === "pending_approval" ? pendingOrders :
    filterStatus === "preparing" ? preparingOrders :
    filterStatus === "ready" ? readyOrders : archivedOrders;

  const filteredActiveOrders = activeOrders.filter((order) => {
    const searchLower = orderSearch.toLowerCase();
    const matchesSearch = 
      order.orderNumber?.toString().includes(searchLower) ||
      order.customerName?.toLowerCase().includes(searchLower) ||
      order.customerPhone?.toLowerCase().includes(searchLower);
    
    const matchesService = orderServiceMode === "all" || order.serviceMode === orderServiceMode;
    return matchesSearch && matchesService;
  });

  const inventoryCategories = ["all", ...categoriesListToUse.map((c) => c.id)];
  const filteredInventory = productsList.filter((prod) => {
    const searchLower = inventorySearch.toLowerCase();
    const matchesSearch = 
      prod.name?.toLowerCase().includes(searchLower) ||
      prod.description?.toLowerCase().includes(searchLower) ||
      prod.id?.toLowerCase().includes(searchLower);
    
    const matchesCategory = inventoryCategory === "all" || prod.category === inventoryCategory;
    return matchesSearch && matchesCategory;
  });

  const auditActions = ["all", ...new Set(auditLogs.map((l) => l.action).filter(Boolean))];
  const filteredAuditLogs = auditLogs.filter((log) => {
    const searchLower = auditSearch.toLowerCase();
    const matchesSearch = 
      log.userEmail?.toLowerCase().includes(searchLower) ||
      log.details?.toLowerCase().includes(searchLower);
    
    const matchesAction = auditActionFilter === "all" || log.action === auditActionFilter;
    return matchesSearch && matchesAction;
  });

  // Acciones de Aprobación de Órdenes
  const handleAuthorize = async (order) => {
    try {
      const orderRef = doc(db, "orders", order.id);
      await updateDoc(orderRef, {
        status: "preparing",
        authorizedBy: user.uid,
        authorizedAt: serverTimestamp()
      });
      await logAuditEvent(user.email, "AUTORIZAR_ORDEN", `Orden #${order.orderNumber} autorizada para cocina`);
      triggerPrint(order);
    } catch (err) {
      console.error("Error al autorizar orden:", err);
      alert("Error al autorizar orden.");
    }
  };

  const handleReject = async (order) => {
    if (window.confirm(`¿Seguro que deseas RECHAZAR la orden #${order.orderNumber}?`)) {
      try {
        const orderRef = doc(db, "orders", order.id);
        await updateDoc(orderRef, {
          status: "rejected",
          rejectedBy: user.uid,
          rejectedAt: serverTimestamp()
        });
        
        // Restaurar stock
        if (order.items) {
          for (const item of order.items) {
            const prodRef = doc(db, "products", item.id);
            await updateDoc(prodRef, {
              stock: increment(item.quantity)
            });
          }
        }
        
        await logAuditEvent(user.email, "RECHAZAR_ORDEN", `Orden #${order.orderNumber} rechazada`);
      } catch (err) {
        console.error("Error al rechazar orden:", err);
        alert("Error al rechazar orden.");
      }
    }
  };

  const handleMarkCompleted = async (order) => {
    try {
      const orderRef = doc(db, "orders", order.id);
      await updateDoc(orderRef, {
        status: "completed",
        completedAt: serverTimestamp()
      });
      await logAuditEvent(user.email, "COMPLETAR_ORDEN", `Orden #${order.orderNumber} entregada`);
    } catch (err) {
      console.error("Error al completar orden:", err);
      alert("Error al completar la orden.");
    }
  };

  const handleShareDeliveryWhatsApp = (order) => {
    const phone = window.prompt(
      "Ingrese el número de teléfono del repartidor (con código de país, ej. 51999999999) o presione Aceptar vacío para elegir un contacto en WhatsApp:",
      ""
    );
    if (phone === null) return;

    let msg = `🛵 *PEDIDO PARA DELIVERY* 🛵\n\n`;
    msg += `*Orden:* #${order.orderNumber}\n`;
    msg += `*Cliente:* ${order.customerName}\n`;
    msg += `*Teléfono:* ${order.customerPhone}\n`;
    msg += `*Dirección:* ${order.customerAddress}\n`;
    
    if (order.customerCoords && order.customerCoords.lat && order.customerCoords.lng) {
      const mapsLink = `https://www.google.com/maps/search/?api=1&query=${order.customerCoords.lat},${order.customerCoords.lng}`;
      msg += `📍 *Ubicación GPS (Mapas):* ${mapsLink}\n`;
    } else {
      msg += `📍 *Ubicación GPS:* No marcada por mapa\n`;
    }
    
    msg += `💳 *Método de Pago:* ${
      order.paymentMethod === "cash" ? "Efectivo" :
      order.paymentMethod === "yape" ? "Yape/Plin" : "Transferencia"
    }\n`;
    msg += `💵 *Total a cobrar/cobrado:* ${formatCurrency(order.total, businessConfig.currency)}\n\n`;
    
    msg += `📋 *DETALLE DEL PEDIDO:*\n`;
    order.items.forEach((item) => {
      msg += `• ${item.quantity}x ${item.name}`;
      if (item.optionsSelected && Object.keys(item.optionsSelected).length > 0) {
        msg += ` (${Object.entries(item.optionsSelected).map(([k, v]) => `${k}: ${v}`).join(", ")})`;
      }
      if (item.comboItems && item.comboItems.length > 0) {
        msg += ` [Combo: ${item.comboItems.join(" + ")}]`;
      }
      msg += `\n`;
    });

    const encodedMsg = encodeURIComponent(msg);
    const cleanPhone = phone.replace(/\D/g, "");
    
    let url = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodedMsg}`
      : `https://api.whatsapp.com/send?text=${encodedMsg}`;
    
    window.open(url, "_blank");
  };

  // Impresión
  const triggerPrint = (order) => {
    setSelectedOrderForPrint(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const getSelectedOrderTotals = () => {
    if (!selectedOrderForPrint) return { subtotal: 0, totalDiscount: 0, taxAmount: 0, shippingCost: 0, total: 0 };
    return {
      subtotal: selectedOrderForPrint.subtotal || 0,
      totalDiscount: selectedOrderForPrint.discountAmount || 0,
      taxAmount: selectedOrderForPrint.taxAmount || 0,
      shippingCost: selectedOrderForPrint.shippingCost || 0,
      total: selectedOrderForPrint.total || 0
    };
  };

  // Registro de usuarios usando Auth secundario (Evita logout de admin)
  const handleRegisterStaff = async (e) => {
    e.preventDefault();
    if (!staffEmail || !staffPassword || !staffRole) {
      alert("Por favor ingresa todos los campos.");
      return;
    }
    setStaffRegistering(true);
    let secondaryApp;
    try {
      const appName = `SecondaryAuth-${Date.now()}`;
      secondaryApp = initializeApp(firebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);
      const cred = await createUserWithEmailAndPassword(secondaryAuth, staffEmail, staffPassword);
      const uid = cred.user.uid;
      
      // Guardar rol y permisos en colección principal de Firestore
      await setDoc(doc(db, "users", uid), {
        email: staffEmail,
        role: staffRole,
        permissions: staffPermissions,
        disabled: false
      });

      await logAuditEvent(user.email, "CREAR_PERSONAL", `Creado personal: ${staffEmail} con rol: ${staffRole}`);
      setStaffEmail("");
      setStaffPassword("");
      setStaffPermissions([]);
      alert(`Usuario ${staffEmail} registrado exitosamente con rol ${staffRole}.`);
    } catch (err) {
      console.error("Error al registrar personal:", err);
      alert(`Error al registrar personal: ${err.message}`);
    } finally {
      if (secondaryApp) {
        await deleteApp(secondaryApp);
      }
      setStaffRegistering(false);
    }
  };

  const handleToggleSuspend = async (staffUser) => {
    try {
      const userRef = doc(db, "users", staffUser.uid);
      const newStatus = !staffUser.disabled;
      await updateDoc(userRef, { disabled: newStatus });
      await logAuditEvent(user.email, newStatus ? "SUSPENDER_USUARIO" : "ACTIVAR_USUARIO", `Personal: ${staffUser.email}`);
    } catch (err) {
      console.error("Error toggle suspend:", err);
      alert("Error al cambiar estado del usuario.");
    }
  };

  const handleChangeRole = async (staffUser, newRole) => {
    try {
      const userRef = doc(db, "users", staffUser.uid);
      await updateDoc(userRef, { role: newRole });
      await logAuditEvent(user.email, "CAMBIAR_ROL", `Personal: ${staffUser.email} cambiado a: ${newRole}`);
    } catch (err) {
      console.error("Error changing role:", err);
      alert("Error al cambiar rol del usuario.");
    }
  };

  // Control de Arqueo de Caja (Shifts)
  const getShiftExpectedTotals = () => {
    if (!activeShift) return { cash: 0, electronic: 0, count: 0 };
    const openTimeSeconds = activeShift.openTime?.seconds || 0;
    
    // Filtrar órdenes completadas o aprobadas después de abrir caja
    const shiftOrders = orders.filter((o) => {
      const oTime = o.createdAt?.seconds || 0;
      return oTime >= openTimeSeconds && (o.status === "completed" || o.status === "preparing" || o.status === "ready");
    });

    let cash = 0;
    let electronic = 0;
    shiftOrders.forEach((o) => {
      if (o.paymentMethod === "cash") {
        cash += o.total || 0;
      } else {
        electronic += o.total || 0;
      }
    });

    return { cash, electronic, count: shiftOrders.length };
  };

  const handleOpenShift = async (e) => {
    e.preventDefault();
    const base = parseFloat(cashBase);
    if (isNaN(base) || base < 0) {
      alert("Ingresa un monto base válido.");
      return;
    }
    try {
      await addDoc(collection(db, "shifts"), {
        status: "open",
        openedBy: user.email,
        openTime: new Date(),
        cashBase: base,
        closeTime: null
      });
      await logAuditEvent(user.email, "APERTURA_CAJA", `Base inicial: ${formatCurrency(base, businessConfig.currency)}`);
      setCashBase("");
    } catch (err) {
      console.error("Error opening shift:", err);
      alert("Error al abrir turno.");
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    const actualCashNum = parseFloat(actualCash);
    const actualElectronicNum = parseFloat(actualElectronic);
    if (isNaN(actualCashNum) || isNaN(actualElectronicNum)) {
      alert("Ingresa montos reales válidos.");
      return;
    }
    
    const expected = getShiftExpectedTotals();
    const expectedCashTotal = activeShift.cashBase + expected.cash;
    const discrepancy = (actualCashNum + actualElectronicNum) - (expectedCashTotal + expected.electronic);

    try {
      const shiftRef = doc(db, "shifts", activeShift.id);
      await updateDoc(shiftRef, {
        status: "closed",
        closeTime: new Date(),
        closedBy: user.email,
        expectedCash: expectedCashTotal,
        expectedElectronic: expected.electronic,
        actualCash: actualCashNum,
        actualElectronic: actualElectronicNum,
        discrepancy
      });
      
      await logAuditEvent(
        user.email, 
        "CIERRE_CAJA", 
        `Reporte Z - Efectivo real: ${formatCurrency(actualCashNum, businessConfig.currency)}, Descuadre: ${formatCurrency(discrepancy, businessConfig.currency)}`
      );
      
      setActualCash("");
      setActualElectronic("");
      alert("Turno de caja cerrado exitosamente (Reporte Z registrado).");
    } catch (err) {
      console.error("Error closing shift:", err);
      alert("Error al cerrar turno.");
    }
  };

  // CRUD de Inventario (Productos)
  const handleOpenAddProduct = () => {
    setCrudProduct(null);
    setCrudForm({
      id: "",
      name: "",
      description: "",
      price: "",
      discount: "0",
      cost: "",
      stock: "50",
      category: "pizzas",
      imageUrl: "",
      optionsText: "",
      comboItemsText: ""
    });
    setIsCrudModalOpen(true);
  };

  const handleOpenEditProduct = (prod) => {
    setCrudProduct(prod);
    
    // Convertir options {} de vuelta a texto editable
    let optsText = "";
    if (prod.options) {
      optsText = Object.entries(prod.options)
        .map(([group, list]) => `${group}: ${list.join(", ")}`)
        .join("\n");
    }

    // Convertir comboItems [] a texto
    let combosText = "";
    if (prod.comboItems) {
      combosText = prod.comboItems.join("\n");
    }

    setCrudForm({
      id: prod.id,
      name: prod.name,
      description: prod.description || "",
      price: prod.price.toString(),
      discount: (prod.discount || 0).toString(),
      cost: (prod.cost || 0).toString(),
      stock: (prod.stock !== undefined ? prod.stock : 50).toString(),
      category: prod.category,
      imageUrl: prod.imageUrl || "",
      optionsText: optsText,
      comboItemsText: combosText
    });
    setIsCrudModalOpen(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      setUploadError("Falta configurar las variables de entorno de Cloudinary (VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET) en el archivo .env");
      return;
    }

    setUploadingImage(true);
    setUploadError("");

    try {
      // 1. Comprimir imagen localmente (WebP)
      const compressedBlob = await compressImage(file, 800, 0.75);
      const compressedFile = new File([compressedBlob], `product_${Date.now()}.webp`, { type: "image/webp" });

      // 2. Preparar FormData para Cloudinary
      const formData = new FormData();
      formData.append("file", compressedFile);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

      // 3. Subir mediante la API REST de Cloudinary
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || "Error al subir a Cloudinary");
      }

      const data = await response.json();
      
      // 4. Obtener URL de Cloudinary y optimizarla al vuelo
      let secureUrl = data.secure_url;
      if (secureUrl.includes("/upload/")) {
        secureUrl = secureUrl.replace("/upload/", "/upload/f_auto,q_auto/");
      }

      setCrudForm((prev) => ({ ...prev, imageUrl: secureUrl }));
    } catch (err) {
      console.error("Error en la subida a Cloudinary:", err);
      setUploadError(err.message || "Error de red al subir la imagen.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!crudForm.name || !crudForm.price) {
      alert("Nombre y Precio son requeridos.");
      return;
    }

    const priceNum = parseFloat(crudForm.price);
    const discountNum = parseInt(crudForm.discount || "0");
    const costNum = parseFloat(crudForm.cost) || 0;
    const stockNum = parseInt(crudForm.stock) || 0;
    if (isNaN(priceNum) || priceNum <= 0) {
      alert("Precio inválido.");
      return;
    }

    // Procesar Options
    const parsedOptions = {};
    if (crudForm.optionsText.trim()) {
      const lines = crudForm.optionsText.split("\n");
      lines.forEach((line) => {
        const parts = line.split(":");
        if (parts.length === 2) {
          const groupName = parts[0].trim();
          const list = parts[1].split(",").map((x) => x.trim()).filter(Boolean);
          if (groupName && list.length > 0) {
            parsedOptions[groupName] = list;
          }
        }
      });
    }

    // Procesar Combos
    const parsedCombos = crudForm.comboItemsText
      ? crudForm.comboItemsText.split("\n").map((x) => x.trim()).filter(Boolean)
      : [];

    const productPayload = {
      name: crudForm.name,
      description: crudForm.description,
      price: priceNum,
      discount: discountNum,
      cost: costNum,
      stock: stockNum,
      category: crudForm.category,
      imageUrl: crudForm.imageUrl || "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80",
      ...(Object.keys(parsedOptions).length > 0 ? { options: parsedOptions } : {}),
      ...(parsedCombos.length > 0 ? { comboItems: parsedCombos } : {})
    };

    try {
      if (crudProduct) {
        // EDIT
        await setDoc(doc(db, "products", crudProduct.id), productPayload, { merge: true });
        await logAuditEvent(user.email, "EDITAR_PRODUCTO", `Producto editado: ${crudForm.name}`);
      } else {
        // ADD
        const newId = crudForm.id.trim() || crudForm.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        if (!newId) {
          alert("ID de producto inválido.");
          return;
        }
        await setDoc(doc(db, "products", newId), { id: newId, ...productPayload });
        await logAuditEvent(user.email, "CREAR_PRODUCTO", `Producto creado: ${crudForm.name} (ID: ${newId})`);
      }
      setIsCrudModalOpen(false);
      alert("Producto guardado exitosamente.");
    } catch (err) {
      console.error("Error saving product:", err);
      alert(`Error al guardar producto: ${err.message}`);
    }
  };

  const handleDeleteProduct = async (prodId) => {
    if (window.confirm("¿Seguro que deseas eliminar este producto permanentemente del catálogo?")) {
      try {
        await deleteDoc(doc(db, "products", prodId));
        await logAuditEvent(user.email, "ELIMINAR_PRODUCTO", `Producto eliminado con ID: ${prodId}`);
        alert("Producto eliminado.");
      } catch (err) {
        console.error("Error deleting product:", err);
        alert("Error al eliminar producto.");
      }
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.description || !expenseForm.amount) {
      alert("Descripción y monto son obligatorios.");
      return;
    }
    const amountNum = parseFloat(expenseForm.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("El monto debe ser un número válido mayor a 0.");
      return;
    }
    setIsSavingExpense(true);
    try {
      const expenseDate = expenseForm.date ? new Date(expenseForm.date + "T12:00:00") : new Date();
      const payload = {
        description: expenseForm.description,
        category: expenseForm.category,
        amount: amountNum,
        date: expenseDate,
        createdBy: user.email || "admin@pizzahub.com"
      };
      await addDoc(collection(db, "expenses"), payload);
      await logAuditEvent(user.email, "CREAR_EGRESO", `Egreso registrado: ${expenseForm.description} (${expenseForm.category}) por $${amountNum.toFixed(2)}`);
      
      setExpenseForm({ description: "", category: "Insumos", amount: "", date: "" });
      setIsExpenseModalOpen(false);
      alert("Egreso registrado exitosamente.");
    } catch (err) {
      console.error("Error al registrar egreso:", err);
      alert("Error al registrar egreso: " + err.message);
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId, expenseDesc, expenseAmount) => {
    if (window.confirm(`¿Seguro que deseas eliminar el egreso "${expenseDesc}" por $${expenseAmount.toFixed(2)}?`)) {
      try {
        await deleteDoc(doc(db, "expenses", expenseId));
        await logAuditEvent(user.email, "ELIMINAR_EGRESO", `Egreso eliminado: ${expenseDesc} por $${expenseAmount.toFixed(2)}`);
        alert("Egreso eliminado exitosamente.");
      } catch (err) {
        console.error("Error al eliminar egreso:", err);
        alert("Error al eliminar egreso.");
      }
    }
  };

  // Ventas Report Metrics & CSS Visual Charts
  const completedOrders = orders.filter(o => o.status === "completed");
  const totalSalesRevenue = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const averageTicket = completedOrders.length > 0 ? totalSalesRevenue / completedOrders.length : 0;

  // Ventas por hora
  const salesByHour = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, total: 0, count: 0 }));
    completedOrders.forEach(o => {
      if (o.createdAt) {
        const date = o.createdAt.seconds ? new Date(o.createdAt.seconds * 1000) : new Date(o.createdAt);
        if (!isNaN(date.getTime())) {
          const hour = date.getHours();
          hours[hour].total += o.total || 0;
          hours[hour].count += 1;
        }
      }
    });
    return hours;
  }, [completedOrders]);

  // Top 5 Productos
  const topProducts = useMemo(() => {
    const productCounts = {};
    completedOrders.forEach(o => {
      if (o.items && Array.isArray(o.items)) {
        o.items.forEach(item => {
          const name = item.name || "Producto";
          const qty = Number(item.quantity) || 0;
          const revenue = (Number(item.price) || 0) * qty;
          if (!productCounts[name]) {
            productCounts[name] = { name, quantity: 0, revenue: 0 };
          }
          productCounts[name].quantity += qty;
          productCounts[name].revenue += revenue;
        });
      }
    });
    return Object.values(productCounts)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [completedOrders]);

  // Distribución de Canales de Ventas
  const modeCounts = { dinein: 0, pickup: 0, delivery: 0 };
  completedOrders.forEach(o => {
    if (modeCounts[o.serviceMode] !== undefined) {
      modeCounts[o.serviceMode] += o.total || 0;
    }
  });

  // Distribución de Métodos de Pago
  const payCounts = { cash: 0, yape: 0, transfer: 0 };
  completedOrders.forEach(o => {
    if (payCounts[o.paymentMethod] !== undefined) {
      payCounts[o.paymentMethod] += o.total || 0;
    }
  });

  // Clientes CRM Agrupado
  const customerMap = {};
  orders.forEach((o) => {
    const key = o.customerPhone || "sin-telefono";
    if (!customerMap[key]) {
      customerMap[key] = {
        name: o.customerName || "N/A",
        phone: o.customerPhone || "N/A",
        address: o.customerAddress || "N/A",
        totalSpent: 0,
        totalOrders: 0,
        lastOrderDate: null
      };
    }
    customerMap[key].totalSpent += o.total || 0;
    customerMap[key].totalOrders += 1;
    if (!customerMap[key].lastOrderDate || (o.createdAt && o.createdAt.seconds > customerMap[key].lastOrderDate.seconds)) {
      customerMap[key].lastOrderDate = o.createdAt;
    }
  });
  const uniqueCustomers = Object.values(customerMap).sort((a, b) => b.totalSpent - a.totalSpent);
  const filteredCustomers = uniqueCustomers.filter((c) => {
    const searchLower = customerSearch.toLowerCase();
    return (
      c.name?.toLowerCase().includes(searchLower) ||
      c.phone?.toLowerCase().includes(searchLower) ||
      c.address?.toLowerCase().includes(searchLower)
    );
  });

  // Manejar subida de Logo comercial (Cloudinary -> Storage -> Base64)
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingLogo(true);
    setUploadLogoError("");

    try {
      // 1. Comprimir imagen localmente (WebP) a tamaño logo
      const compressedBlob = await compressImage(file, 400, 0.8);
      const compressedFile = new File([compressedBlob], `logo_${Date.now()}.webp`, { type: "image/webp" });

      // A. Intentar con Cloudinary primero
      if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET) {
        try {
          const formData = new FormData();
          formData.append("file", compressedFile);
          formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

          const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: "POST",
            body: formData
          });

          if (response.ok) {
            const data = await response.json();
            let secureUrl = data.secure_url;
            if (secureUrl.includes("/upload/")) {
              secureUrl = secureUrl.replace("/upload/", "/upload/f_auto,q_auto/");
            }
            setSettingsForm((prev) => ({ ...prev, logoUrl: secureUrl }));
            setUploadingLogo(false);
            return;
          }
        } catch (cloudinaryErr) {
          console.warn("Fallo subida a Cloudinary, intentando Firebase Storage...", cloudinaryErr);
        }
      }

      // B. Intentar con Firebase Storage
      if (storage) {
        try {
          const logoRef = ref(storage, `logos/business_logo_${Date.now()}.webp`);
          await uploadBytes(logoRef, compressedFile);
          const downloadURL = await getDownloadURL(logoRef);
          setSettingsForm((prev) => ({ ...prev, logoUrl: downloadURL }));
          setUploadingLogo(false);
          return;
        } catch (firebaseStorageErr) {
          console.warn("Fallo subida a Firebase Storage, recurriendo a Base64...", firebaseStorageErr);
        }
      }

      // C. Fallback: Guardar como Base64 en Firestore
      const reader = new FileReader();
      reader.readAsDataURL(compressedBlob);
      reader.onloadend = () => {
        const base64data = reader.result;
        setSettingsForm((prev) => ({ ...prev, logoUrl: base64data }));
        setUploadingLogo(false);
      };
      reader.onerror = (readErr) => {
        throw readErr;
      };

    } catch (err) {
      console.error("Error al procesar subida de logo:", err);
      setUploadLogoError(err.message || "Error al procesar el archivo del logo.");
      setUploadingLogo(false);
    }
  };

  // Manejar subida de QR de Yape (Cloudinary -> Storage -> Base64)
  const handleQrUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingQr(true);
    setUploadQrError("");

    try {
      // 1. Comprimir imagen localmente (WebP) a tamaño adecuado para QR (600px)
      const compressedBlob = await compressImage(file, 600, 0.8);
      const compressedFile = new File([compressedBlob], `yape_qr_${Date.now()}.webp`, { type: "image/webp" });

      // A. Intentar con Cloudinary primero
      if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET) {
        try {
          const formData = new FormData();
          formData.append("file", compressedFile);
          formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

          const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: "POST",
            body: formData
          });

          if (response.ok) {
            const data = await response.json();
            let secureUrl = data.secure_url;
            if (secureUrl.includes("/upload/")) {
              secureUrl = secureUrl.replace("/upload/", "/upload/f_auto,q_auto/");
            }
            setSettingsForm((prev) => ({ ...prev, yapeQrUrl: secureUrl }));
            setUploadingQr(false);
            return;
          }
        } catch (cloudinaryErr) {
          console.warn("Fallo subida de QR a Cloudinary, intentando Firebase Storage...", cloudinaryErr);
        }
      }

      // B. Intentar con Firebase Storage
      if (storage) {
        try {
          const qrRef = ref(storage, `qrs/yape_qr_${Date.now()}.webp`);
          await uploadBytes(qrRef, compressedFile);
          const downloadURL = await getDownloadURL(qrRef);
          setSettingsForm((prev) => ({ ...prev, yapeQrUrl: downloadURL }));
          setUploadingQr(false);
          return;
        } catch (firebaseStorageErr) {
          console.warn("Fallo subida de QR a Firebase Storage, recurriendo a Base64...", firebaseStorageErr);
        }
      }

      // C. Fallback: Guardar como Base64 en Firestore
      const reader = new FileReader();
      reader.readAsDataURL(compressedBlob);
      reader.onloadend = () => {
        const base64data = reader.result;
        setSettingsForm((prev) => ({ ...prev, yapeQrUrl: base64data }));
        setUploadingQr(false);
      };
      reader.onerror = (readErr) => {
        throw readErr;
      };

    } catch (err) {
      console.error("Error al procesar subida de QR:", err);
      setUploadQrError(err.message || "Error al procesar el archivo del QR.");
      setUploadingQr(false);
    }
  };

  // Guardar Cambios Configuración General
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!settingsForm) return;
    try {
      const configRef = doc(db, "config", "settings");
      await updateDoc(configRef, settingsForm);
      await logAuditEvent(user.email, "ACTUALIZAR_CONFIGURACION", "Se actualizaron parámetros globales del negocio");
      alert("Configuración comercial guardada con éxito.");
    } catch (err) {
      console.error(err);
      alert("Error al actualizar la configuración.");
    }
  };

  // Guardar Cambios SEO
  const handleSaveSeo = async (e) => {
    e.preventDefault();
    try {
      const configRef = doc(db, "config", "settings");
      await updateDoc(configRef, { seo: seoForm });
      await logAuditEvent(user.email, "ACTUALIZAR_SEO", "Se actualizaron meta-tags y SEO");
      alert("Optimización SEO guardada con éxito.");
    } catch (err) {
      console.error(err);
      alert("Error al actualizar SEO.");
    }
  };

  // Guardar Tienda Online (Mantenimiento, GPS, costo por KM)
  const handleSaveStoreStatus = async (e) => {
    e.preventDefault();
    try {
      const configRef = doc(db, "config", "settings");
      await updateDoc(configRef, {
        maintenanceMessage: storeStatusForm.maintenanceMessage,
        "shipping.shippingCostPerKm": parseFloat(storeStatusForm.deliveryCostPerKm || "0"),
        "shipping.deliveryRange": parseFloat(storeStatusForm.deliveryRange || "15"),
        "shipping.businessLocation": {
          lat: parseFloat(storeStatusForm.baseLat || "0"),
          lng: parseFloat(storeStatusForm.baseLng || "0")
        }
      });
      await logAuditEvent(user.email, "ACTUALIZAR_ESTADO_TIENDA", "Se modificaron parámetros de la Tienda Online y Delivery");
      alert("Parámetros de Tienda Online guardados con éxito.");
    } catch (err) {
      console.error(err);
      alert("Error al actualizar tienda.");
    }
  };

  // Gestión de Cupones / Auto-Descuentos (Marketing)
  const handleAddCoupon = async (e) => {
    e.preventDefault();
    if (!marketingForm.couponCode || !marketingForm.couponDiscount) return;
    const discountVal = parseInt(marketingForm.couponDiscount);
    if (isNaN(discountVal) || discountVal <= 0 || discountVal > 100) {
      alert("Porcentaje de descuento inválido (1-100).");
      return;
    }
    try {
      const configRef = doc(db, "config", "settings");
      const key = `discounts.coupons.${marketingForm.couponCode.toUpperCase().trim()}`;
      await updateDoc(configRef, { [key]: discountVal });
      await logAuditEvent(user.email, "CREAR_CUPON", `Cupón: ${marketingForm.couponCode.toUpperCase().trim()} (${discountVal}%)`);
      setMarketingForm(prev => ({ ...prev, couponCode: "", couponDiscount: "" }));
      alert("Cupón agregado.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCoupon = async (code) => {
    if (window.confirm(`¿Seguro que deseas eliminar el cupón ${code}?`)) {
      try {
        const configRef = doc(db, "config", "settings");
        // En Firestore, para borrar un campo de un mapa anidado podemos usar FieldValue.delete() o reescribir.
        // Como no queremos añadir imports complejos, actualizamos el mapa local y guardamos
        const newCoupons = { ...businessConfig.discounts.coupons };
        delete newCoupons[code];
        await updateDoc(configRef, { "discounts.coupons": newCoupons });
        await logAuditEvent(user.email, "ELIMINAR_CUPON", `Cupón: ${code}`);
        alert("Cupón eliminado.");
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleAddAutoDiscount = async (e) => {
    e.preventDefault();
    if (!marketingForm.minAmountDiscount || !marketingForm.discountPercentRule) return;
    const min = parseFloat(marketingForm.minAmountDiscount);
    const pct = parseInt(marketingForm.discountPercentRule);
    if (isNaN(min) || isNaN(pct) || min <= 0 || pct <= 0 || pct > 100) {
      alert("Rango de descuento automático inválido.");
      return;
    }
    try {
      const configRef = doc(db, "config", "settings");
      const list = [...(businessConfig.discounts.autoDiscounts || [])];
      list.push({ minAmount: min, discountPercent: pct });
      list.sort((a, b) => a.minAmount - b.minAmount);
      await updateDoc(configRef, { "discounts.autoDiscounts": list });
      await logAuditEvent(user.email, "CREAR_DESCUENTO_PROGRESIVO", `Mínimo: ${min}, Descuento: ${pct}%`);
      setMarketingForm(prev => ({ ...prev, minAmountDiscount: "", discountPercentRule: "" }));
      alert("Descuento automático progresivo agregado.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAutoDiscount = async (idx) => {
    if (window.confirm("¿Seguro que deseas eliminar esta regla de descuento?")) {
      try {
        const configRef = doc(db, "config", "settings");
        const list = [...(businessConfig.discounts.autoDiscounts || [])];
        list.splice(idx, 1);
        await updateDoc(configRef, { "discounts.autoDiscounts": list });
        await logAuditEvent(user.email, "ELIMINAR_DESCUENTO_PROGRESIVO", "Regla de descuento automático eliminada");
        alert("Regla eliminada.");
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Exportación a CSV
  const downloadCSV = (filename, headers, rows) => {
    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.map(val => {
        const text = String(val === null || val === undefined ? "" : val);
        return `"${text.replace(/"/g, '""')}"`;
      }).join(";"))
    ].join("\n");
    
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportSalesCSV = () => {
    const headers = ["Numero_Orden", "Fecha", "Cliente", "Telefono", "Metodo_Pago", "Servicio", "Total", "Estado"];
    const rows = completedOrders.map(o => [
      o.orderNumber,
      o.createdAt ? new Date(o.createdAt.seconds * 1000).toLocaleString() : "",
      o.customerName,
      o.customerPhone,
      o.paymentMethod,
      o.serviceMode,
      o.total,
      o.status
    ]);
    downloadCSV("reporte_ventas.csv", headers, rows);
    logAuditEvent(user.email, "EXPORTAR_CSV_VENTAS", "Exportó reporte de ventas a CSV");
  };

  const handleExportInventoryCSV = () => {
    const headers = ["ID", "Nombre", "Categoria", "Precio", "Descuento", "Descripcion"];
    const rows = productsList.map(p => [
      p.id,
      p.name,
      p.category,
      p.price,
      p.discount,
      p.description
    ]);
    downloadCSV("catalogo_inventario.csv", headers, rows);
    logAuditEvent(user.email, "EXPORTAR_CSV_INVENTARIO", "Exportó catálogo de inventario a CSV");
  };

  const handleExportCustomersCSV = () => {
    const headers = ["Cliente", "Telefono", "Direccion", "Total_Pedidos", "Total_Gastado", "Ultimo_Pedido"];
    const rows = uniqueCustomers.map(c => [
      c.name,
      c.phone,
      c.address,
      c.totalOrders,
      c.totalSpent,
      c.lastOrderDate ? new Date(c.lastOrderDate.seconds * 1000).toLocaleString() : ""
    ]);
    downloadCSV("directorio_clientes.csv", headers, rows);
    logAuditEvent(user.email, "EXPORTAR_CSV_CLIENTES", "Exportó directorio de clientes a CSV");
  };

  const handleExportAuditCSV = () => {
    const headers = ["Fecha", "Accion", "Usuario (Email)", "Detalles"];
    const rows = filteredAuditLogs.map(log => [
      log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString() : "",
      log.action || "",
      log.userEmail || "",
      log.details || ""
    ]);
    downloadCSV("bitacora_auditoria.csv", headers, rows);
    logAuditEvent(user.email, "EXPORTAR_CSV_AUDITORIA", "Exportó bitácora de auditoría a CSV");
  };

  const handleExportShiftsCSV = () => {
    const headers = ["Fecha Apertura", "Fecha Cierre", "Cajero", "Base Inicial", "Esperado Cash", "Esperado Electronico", "Actual Cash", "Actual Electronico", "Descuadre", "Estado"];
    const rows = shifts.map(s => {
      const openDate = s.openTime ? new Date(s.openTime.seconds * 1000).toLocaleString() : "";
      const closeDate = s.closeTime ? new Date(s.closeTime.seconds * 1000).toLocaleString() : "Turno Activo";
      const totalExpectedCash = s.cashBase + (s.expectedCash || 0);
      return [
        openDate,
        closeDate,
        s.openedBy || "",
        s.cashBase || 0,
        s.expectedCash || 0,
        s.expectedElectronic || 0,
        s.actualCash || 0,
        s.actualElectronic || 0,
        s.discrepancy || 0,
        s.status || ""
      ];
    });
    downloadCSV("reportes_z_caja.csv", headers, rows);
    logAuditEvent(user.email, "EXPORTAR_CSV_TURNOS", "Exportó historial de turnos de caja a CSV");
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      alert("El nombre de la categoría es requerido.");
      return;
    }
    const catId = categoryForm.id.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || 
                  categoryForm.name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (!catId) {
      alert("Nombre de categoría inválido.");
      return;
    }
    try {
      await setDoc(doc(db, "categories", catId), {
        id: catId,
        name: categoryForm.name.trim()
      });
      setCategoryForm({ id: "", name: "" });
      await logAuditEvent(user.email, "CREAR_CATEGORIA", `Categoría creada/editada: ${categoryForm.name.trim()} (ID: ${catId})`);
      alert("Categoría guardada exitosamente.");
    } catch (err) {
      console.error("Error al guardar categoría:", err);
      alert("Error al guardar categoría.");
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta categoría? Nota: Los productos existentes bajo esta categoría conservarán su categoría en su base de datos, pero ya no aparecerán en el filtro de esta categoría hasta que la vuelvas a crear o los reasignes.")) return;
    try {
      await deleteDoc(doc(db, "categories", catId));
      await logAuditEvent(user.email, "ELIMINAR_CATEGORIA", `Categoría eliminada: ${catId}`);
      alert("Categoría eliminada.");
    } catch (err) {
      console.error("Error al eliminar categoría:", err);
      alert("Error al eliminar categoría.");
    }
  };

  const handleSaveTable = async (e) => {
    e.preventDefault();
    if (!tableNameForm.trim()) {
      alert("El nombre de la mesa es requerido.");
      return;
    }
    const tId = editingTable ? editingTable.id : tableNameForm.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || Date.now().toString();
    try {
      await setDoc(doc(db, "tables", tId), {
        id: tId,
        name: tableNameForm.trim(),
        capacity: parseInt(tableCapacityForm, 10) || 4,
        status: editingTable ? editingTable.status : "libre"
      });
      setTableNameForm("");
      setTableCapacityForm("4");
      setEditingTable(null);
      await logAuditEvent(user.email, editingTable ? "EDITAR_MESA" : "CREAR_MESA", `Mesa: ${tableNameForm.trim()} (ID: ${tId})`);
      alert("Mesa guardada exitosamente.");
    } catch (err) {
      console.error("Error al guardar mesa:", err);
      alert("Error al guardar mesa.");
    }
  };

  const handleToggleTableStatus = async (table) => {
    try {
      const nextStatus = table.status === "ocupada" ? "libre" : "ocupada";
      await updateDoc(doc(db, "tables", table.id), { status: nextStatus });
      await logAuditEvent(user.email, "CAMBIAR_ESTADO_MESA", `Mesa ${table.name} cambiada a ${nextStatus}`);
    } catch (err) {
      console.error("Error al cambiar estado de mesa:", err);
      alert("Error al cambiar el estado.");
    }
  };

  const handleDeleteTable = async (tId, name) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la mesa "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "tables", tId));
      await logAuditEvent(user.email, "ELIMINAR_MESA", `Mesa eliminada: ${name} (ID: ${tId})`);
      alert("Mesa eliminada.");
    } catch (err) {
      console.error("Error al eliminar mesa:", err);
      alert("Error al eliminar mesa.");
    }
  };

  // Funciones para Gestión de Eventos y Pre-registros
  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!eventForm.title.trim() || !eventForm.date || !eventForm.time) {
      alert("El título, fecha y hora son obligatorios.");
      return;
    }
    const discountVal = parseInt(eventForm.discountPercent);
    if (isNaN(discountVal) || discountVal < 0 || discountVal > 100) {
      alert("Porcentaje de descuento inválido (0-100).");
      return;
    }

    setSavingEvent(true);
    try {
      const eventData = {
        title: eventForm.title.trim(),
        description: eventForm.description.trim(),
        date: eventForm.date,
        time: eventForm.time,
        couponCode: eventForm.couponCode.toUpperCase().trim(),
        discountPercent: discountVal,
        active: eventForm.active,
        bannerUrl: eventForm.bannerUrl.trim()
      };

      if (crudEvent) {
        // Actualizar evento existente
        await updateDoc(doc(db, "events", crudEvent.id), eventData);
        await logAuditEvent(user.email, "ACTUALIZAR_EVENTO", `Evento actualizado: ${eventForm.title}`);
      } else {
        // Crear nuevo evento
        await addDoc(collection(db, "events"), eventData);
        await logAuditEvent(user.email, "CREAR_EVENTO", `Evento creado: ${eventForm.title}`);
      }

      // Si el evento tiene código de cupón y porcentaje de descuento, registrar el cupón en la config global
      if (eventForm.couponCode.trim() && discountVal > 0) {
        const configRef = doc(db, "config", "settings");
        const key = `discounts.coupons.${eventForm.couponCode.toUpperCase().trim()}`;
        await updateDoc(configRef, { [key]: discountVal });
      }

      setIsEventModalOpen(false);
      setCrudEvent(null);
      setEventForm({
        title: "",
        description: "",
        date: "",
        time: "",
        couponCode: "",
        discountPercent: "15",
        active: true,
        bannerUrl: ""
      });
      alert("Evento guardado correctamente.");
    } catch (err) {
      console.error("Error al guardar evento:", err);
      alert("Error al guardar el evento.");
    } finally {
      setSavingEvent(false);
    }
  };

  const handleDeleteEvent = async (id, title) => {
    if (window.confirm(`¿Seguro que deseas eliminar el evento "${title}"?`)) {
      try {
        await deleteDoc(doc(db, "events", id));
        await logAuditEvent(user.email, "ELIMINAR_EVENTO", `Evento eliminado: ${title}`);
        alert("Evento eliminado.");
      } catch (err) {
        console.error("Error al eliminar evento:", err);
        alert("Error al eliminar el evento.");
      }
    }
  };

  const handleDeleteRegistration = async (id, name) => {
    if (window.confirm(`¿Seguro que deseas eliminar el pre-registro de ${name}?`)) {
      try {
        await deleteDoc(doc(db, "event_registrations", id));
        alert("Pre-registro eliminado.");
      } catch (err) {
        console.error("Error al eliminar pre-registro:", err);
      }
    }
  };

  const handleExportRegistrationsCSV = () => {
    const headers = ["Fecha Registro", "Evento", "Cliente", "Telefono", "Email", "Cupon"];
    const rows = eventRegistrations.map(r => [
      r.registeredAt ? new Date(r.registeredAt.seconds * 1000).toLocaleString() : "",
      r.eventTitle || "",
      r.name || "",
      r.phone || "",
      r.email || "",
      r.couponCode || ""
    ]);
    downloadCSV("pre_registros_eventos.csv", headers, rows);
    logAuditEvent(user.email, "EXPORTAR_CSV_REGISTROS_EVENTOS", "Exportó lista de pre-registros de eventos a CSV");
  };

  const handleEventBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingEventBanner(true);
    setUploadEventBannerError("");

    try {
      // 1. Comprimir imagen localmente (WebP) a tamaño óptimo para banner (1200px)
      const compressedBlob = await compressImage(file, 1200, 0.8);
      const compressedFile = new File([compressedBlob], `event_banner_${Date.now()}.webp`, { type: "image/webp" });

      // A. Intentar con Cloudinary primero
      if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET) {
        try {
          const formData = new FormData();
          formData.append("file", compressedFile);
          formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

          const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: "POST",
            body: formData
          });

          if (response.ok) {
            const data = await response.json();
            let secureUrl = data.secure_url;
            if (secureUrl.includes("/upload/")) {
              secureUrl = secureUrl.replace("/upload/", "/upload/f_auto,q_auto/");
            }
            setEventForm((prev) => ({ ...prev, bannerUrl: secureUrl }));
            setUploadingEventBanner(false);
            return;
          }
        } catch (cloudinaryErr) {
          console.warn("Fallo subida de banner a Cloudinary, intentando Firebase Storage...", cloudinaryErr);
        }
      }

      // B. Intentar con Firebase Storage
      if (storage) {
        try {
          const bannerRef = ref(storage, `events/event_banner_${Date.now()}.webp`);
          await uploadBytes(bannerRef, compressedFile);
          const downloadURL = await getDownloadURL(bannerRef);
          setEventForm((prev) => ({ ...prev, bannerUrl: downloadURL }));
          setUploadingEventBanner(false);
          return;
        } catch (firebaseStorageErr) {
          console.warn("Fallo subida de banner a Firebase Storage, recurriendo a Base64...", firebaseStorageErr);
        }
      }

      // C. Fallback: Base64 en Firestore
      const reader = new FileReader();
      reader.readAsDataURL(compressedBlob);
      reader.onloadend = () => {
        const base64data = reader.result;
        setEventForm((prev) => ({ ...prev, bannerUrl: base64data }));
        setUploadingEventBanner(false);
      };
      reader.onerror = (readErr) => {
        throw readErr;
      };

    } catch (err) {
      console.error("Error al procesar subida de banner:", err);
      setUploadEventBannerError(err.message || "Error al procesar el archivo del banner.");
      setUploadingEventBanner(false);
    }
  };

  // Definición de las pestañas del Dashboard
  const tabsList = [
    { id: "pedidos", label: "Pedidos Activos", icon: ClipboardList, permission: PERMISSIONS.VER_PEDIDOS },
    { id: "cocina", label: "Cocina KDS", icon: ChefHat, permission: PERMISSIONS.ACCESO_COCINA },
    { id: "pos", label: "POS Caja", icon: Store, permission: PERMISSIONS.ACCESO_POS },
    { id: "ventas", label: "Reporte Ventas", icon: BarChart3, permission: PERMISSIONS.VER_VENTAS },
    { id: "finanzas", label: "Resultados Financieros", icon: TrendingUp, permission: PERMISSIONS.VER_FINANZAS },
    { id: "inventario", label: "Inventario CRUD", icon: Package, permission: PERMISSIONS.VER_INVENTARIO },
    { id: "categorias", label: "Categorías", icon: Tag, permission: PERMISSIONS.VER_INVENTARIO },
    { id: "mesas", label: "Gestión Mesas", icon: Table, permission: PERMISSIONS.VER_MESAS },
    { id: "contactos", label: "Clientes", icon: Users, permission: PERMISSIONS.VER_CLIENTES },
    { id: "personal", label: "Gestión Personal", icon: Lock, permission: PERMISSIONS.VER_PERSONAL },
    { id: "caja", label: "Arqueo de Caja", icon: DollarSign, permission: PERMISSIONS.VER_CAJA },
    { id: "turnos", label: "Historial Turnos (Z)", icon: FileText, permission: PERMISSIONS.VER_HISTORIAL_TURNOS },
    { id: "auditoria", label: "Auditoría Logs", icon: ShieldAlert, permission: PERMISSIONS.VER_AUDITORIA },
    { id: "tienda", label: "Tienda Online", icon: Globe, permission: PERMISSIONS.CONFIGURAR_TIENDA },
    { id: "configuracion", label: "Configuración", icon: Settings, permission: PERMISSIONS.CONFIGURAR_TIENDA },
    { id: "seo", label: "Optimización SEO", icon: Search, permission: PERMISSIONS.CONFIGURAR_TIENDA },
    { id: "marketing", label: "Marketing / Cupones", icon: Percent, permission: PERMISSIONS.CONFIGURAR_TIENDA },
    { id: "eventos", label: "Eventos & Marketing", icon: Calendar, permission: PERMISSIONS.CONFIGURAR_TIENDA }
  ].filter(tab => hasPermission(tab.permission));

  // Redirigir a la primera pestaña permitida si la seleccionada actualmente no está autorizada
  useEffect(() => {
    if (tabsList.length > 0 && !tabsList.find(t => t.id === activeTab)) {
      setActiveTab(tabsList[0].id);
    }
  }, [tabsList, activeTab]);

  return (
    <div className="min-h-screen bg-pizza-dark text-white flex flex-col md:flex-row print:bg-white print:text-black">
      
      {/* Mobile Top Header */}
      <header className="md:hidden bg-pizza-dark/95 border-b border-white/5 p-4 flex justify-between items-center z-40 shrink-0 sticky top-0">
        <div className="flex items-center gap-2">
          {businessConfig.logoUrl ? (
            <img 
              src={businessConfig.logoUrl} 
              alt="Logo" 
              className="w-6 h-6 rounded-full object-cover border border-white/10" 
              onError={(e) => { e.target.style.display = 'none'; }} 
            />
          ) : (
            <span className="text-2xl">🍕</span>
          )}
          <span className="font-pizza-title font-bold text-sm">
            {businessConfig.name || "Pizza Hub"} ({role === "admin" ? "ADM" : role === "cashier" ? "CAJ" : "COC"})
          </span>
        </div>
        <div className="flex items-center gap-3">
          <SoundNotification pendingCount={pendingOrders.length} isMuted={isMuted} setIsMuted={setIsMuted} />
          <button onClick={() => setMobileMenuOpen(true)} className="p-1 rounded-xl bg-white/5">
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Responsive Left Sidebar Overlay for Mobile */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/75" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-72 bg-pizza-dark flex flex-col justify-between p-6 border-r border-white/10 z-10">
            <div className="space-y-6 overflow-y-auto pr-1 max-h-[85vh]">
              <div className="flex justify-between items-center">
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
                    <h2 className="font-pizza-title font-bold leading-none text-base">
                      {businessConfig.name || "Pizza Hub"}
                    </h2>
                    <span className="text-[10px] text-white/50">
                      {role === "admin" ? "Panel Administrador" : role === "cashier" ? "Panel Cajero" : "Panel Cocina"}
                    </span>
                  </div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-white/60 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <nav className="space-y-1">
                {tabsList.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setActiveTab(t.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                        activeTab === t.id
                          ? "bg-pizza-red text-white shadow-md shadow-pizza-red/15 font-bold"
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon size={16} />
                      {t.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            <button
              onClick={handleLogoutClick}
              className="flex items-center justify-center gap-2 bg-pizza-red/10 border border-pizza-red/20 text-pizza-red font-bold text-xs py-3 rounded-xl hover:bg-pizza-red/25 cursor-pointer mt-4"
            >
              <LogOut size={14} />
              Cerrar Sesión
            </button>
          </aside>
        </div>
      )}

      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex w-64 bg-pizza-dark border-r border-white/5 flex-col justify-between p-6 z-30 shrink-0 sticky top-0 h-screen">
        <div className="flex flex-col flex-1 overflow-y-auto pr-1">
          <div className="flex items-center gap-2.5 mb-8">
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
              <h2 className="font-pizza-title text-base font-bold flex items-center gap-1.5 leading-none">
                {businessConfig.name || "Pizza Hub"}
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  role === "admin" 
                    ? "bg-pizza-red/20 text-pizza-red border border-pizza-red/35" 
                    : role === "cashier"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/35"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/35"
                }`}>
                  {role === "admin" ? "Admin" : role === "cashier" ? "Cajero" : "Cocinero"}
                </span>
              </h2>
              <span className="text-[10px] text-white/40 block mt-1">{user.email}</span>
            </div>
          </div>

          <nav className="space-y-1 flex-1">
            {tabsList.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                    activeTab === t.id
                      ? "bg-pizza-red text-white shadow-lg shadow-pizza-red/15 font-bold"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={16} />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-white/5">
          <button
            onClick={handleLogoutClick}
            className="w-full flex items-center justify-center gap-2 bg-pizza-red/10 border border-pizza-red/20 text-pizza-red font-bold text-xs py-3 rounded-xl hover:bg-pizza-red/25 cursor-pointer"
          >
            <LogOut size={14} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Right Pane Content */}
      <main className="flex-1 overflow-y-auto min-h-screen bg-[#161616] p-4 md:p-8 print:p-0">
        
        {/* If POS or Kitchen screen is embedded, let it render directly occupying the space */}
        {activeTab === "pos" ? (
          <POSView user={user} onLogout={onLogout} isEmbedded={true} />
        ) : activeTab === "cocina" ? (
          <CookView user={user} onLogout={onLogout} isEmbedded={true} />
        ) : (
          <div className="max-w-6xl mx-auto space-y-6 print:space-y-0">
            
            {/* Header section (except POS) */}
            <div className="hidden md:flex justify-between items-center print:hidden">
              <div>
                <h1 className="text-2xl font-bold tracking-tight uppercase font-pizza-title">
                  {tabsList.find(t => t.id === activeTab)?.label}
                </h1>
                <p className="text-xs text-white/50">Módulo del sistema de administración {businessConfig.name || "Pizza Hub"}</p>
              </div>

              <div className="flex items-center gap-3">
                {activeTab === "pedidos" && (
                  <>
                    <SoundNotification pendingCount={pendingOrders.length} isMuted={isMuted} setIsMuted={setIsMuted} />
                    <div className="flex items-center gap-1.5 bg-[#181818] border border-white/10 rounded-full px-3 py-1.5 text-xs">
                      <Settings size={14} className="text-[#ffd79b]" />
                      <span className="text-white/60">Ticket:</span>
                      <select
                        value={printSize}
                        onChange={(e) => setPrintSize(e.target.value)}
                        className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs"
                      >
                        <option value="58mm">58mm</option>
                        <option value="80mm">80mm</option>
                        <option value="letter">Carta (Letter)</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* TAB CONTENT: PEDIDOS ACTIVOS */}
            {activeTab === "pedidos" && (
              <div className="space-y-6">
                {/* Stats */}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
                  <div 
                    onClick={() => setFilterStatus("pending_approval")}
                    className={`glass-panel p-4 rounded-2xl border cursor-pointer transition-all ${
                      filterStatus === "pending_approval" 
                        ? "border-[#ffd79b] bg-[#ffd79b]/5 shadow-lg shadow-[#ffd79b]/5" 
                        : "border-white/5 hover:border-white/15"
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Por Aprobar</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-[#ffd79b]">{pendingOrders.length}</span>
                      {pendingOrders.length > 0 && (
                        <span className="text-[9px] text-pizza-red font-bold animate-pulse-soft">Revisar</span>
                      )}
                    </div>
                  </div>

                  <div 
                    onClick={() => setFilterStatus("preparing")}
                    className={`glass-panel p-4 rounded-2xl border cursor-pointer transition-all ${
                      filterStatus === "preparing" 
                        ? "border-pizza-red bg-pizza-red/5 shadow-lg shadow-pizza-red/5" 
                        : "border-white/5 hover:border-white/15"
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">En Cocina</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-pizza-red">{preparingOrders.length}</span>
                      <span className="text-[10px] text-white/50">Cocinando</span>
                    </div>
                  </div>

                  <div 
                    onClick={() => setFilterStatus("ready")}
                    className={`glass-panel p-4 rounded-2xl border cursor-pointer transition-all ${
                      filterStatus === "ready" 
                        ? "border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/5" 
                        : "border-white/5 hover:border-white/15"
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Listos para Entrega</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-emerald-400">{readyOrders.length}</span>
                      <span className="text-[10px] text-white/50">Listo</span>
                    </div>
                  </div>

                  <div 
                    onClick={() => setFilterStatus("archived")}
                    className={`glass-panel p-4 rounded-2xl border cursor-pointer transition-all ${
                      filterStatus === "archived" 
                        ? "border-white/40 bg-white/5" 
                        : "border-white/5 hover:border-white/15"
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Historial / Archivados</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-white/70">{archivedOrders.length}</span>
                      <span className="text-[10px] text-white/50">Cerrados</span>
                    </div>
                  </div>
                </section>

                {/* Pedidos Grid */}
                <div>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 print:hidden">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">
                      Pedidos: {
                        filterStatus === "pending_approval" ? "Pendientes de Autorización" :
                        filterStatus === "preparing" ? "En Preparación en Cocina" :
                        filterStatus === "ready" ? "Listos para despacho/servicio" : "Historial Completo / Cancelados"
                      }
                    </h3>

                    {/* Buscador y Filtros de Pedidos */}
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                      <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-2.5 text-white/40" size={16} />
                        <input
                          type="text"
                          placeholder="Buscar por orden, cliente, tlf..."
                          value={orderSearch}
                          onChange={(e) => setOrderSearch(e.target.value)}
                          className="w-full bg-[#181818] border border-white/5 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-gold/50"
                        />
                        {orderSearch && (
                          <button
                            onClick={() => setOrderSearch("")}
                            className="absolute right-2.5 top-2.5 text-white/40 hover:text-white text-xs cursor-pointer"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <select
                        value={orderServiceMode}
                        onChange={(e) => setOrderServiceMode(e.target.value)}
                        className="bg-[#181818] border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pizza-gold/50"
                      >
                        <option value="all">Todas las modalidades</option>
                        <option value="delivery">🚀 Delivery</option>
                        <option value="pickup">🥡 Recojo</option>
                        <option value="dinein">🍽️ Mesa</option>
                      </select>
                    </div>
                  </div>

                  {loading ? (
                    <div className="py-20 text-center text-sm text-white/40 flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin text-pizza-red" />
                      Cargando pedidos...
                    </div>
                  ) : filteredActiveOrders.length === 0 ? (
                    <div className="glass-panel py-20 text-center rounded-3xl border border-white/5 text-white/35 text-sm">
                      {orderSearch || orderServiceMode !== "all" 
                        ? "Ningún pedido coincide con los filtros aplicados." 
                        : "No hay órdenes registradas con este estado."}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:hidden">
                      {filteredActiveOrders.map((order) => {
                        const dateText = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleTimeString() : "";
                        const authDateText = order.authorizedAt ? new Date(order.authorizedAt.seconds * 1000).toLocaleTimeString() : "";

                        return (
                          <div
                            key={order.id}
                            className="bg-[#141414] border border-white/5 hover:border-white/10 rounded-3xl p-5 shadow-lg flex flex-col justify-between"
                          >
                            <div>
                              {/* Header Tarjeta */}
                              <div className="flex justify-between items-start border-b border-white/5 pb-3 mb-4">
                                <div>
                                  <span className="text-sm font-black text-[#ffd79b]">Orden #{order.orderNumber}</span>
                                  <span className="block text-[10px] text-white/40">{dateText}</span>
                                  {order.authorizedAt && (
                                    <span className="block text-[9px] text-[#ffd79b]/80">Aprobado: {authDateText}</span>
                                  )}
                                </div>
                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                                  order.status === "pending_approval"
                                    ? "bg-[#ffd79b]/10 border-[#ffd79b]/20 text-[#ffd79b]"
                                    : order.status === "preparing"
                                    ? "bg-pizza-red/10 border-pizza-red/20 text-pizza-red"
                                    : order.status === "ready"
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                    : order.status === "completed"
                                    ? "bg-white/10 border-white/10 text-white/60"
                                    : "bg-red-500/15 border-red-500/20 text-red-400"
                                }`}>
                                  {order.status === "pending_approval" ? "Autorizar" :
                                   order.status === "preparing" ? "Cocinando" :
                                   order.status === "ready" ? "Listo" :
                                   order.status === "completed" ? "Entregado" : "Rechazado"}
                                </span>
                              </div>

                              {/* Customer info */}
                              <div className="text-xs space-y-1 mb-4 text-left">
                                <p><strong>Cliente:</strong> {order.customerName}</p>
                                <p><strong>Teléfono:</strong> {order.customerPhone}</p>
                                <p><strong>Servicio:</strong> {
                                  order.serviceMode === "delivery" ? "🚀 Delivery" :
                                  order.serviceMode === "pickup" ? "🥡 Recojo" : `🍽️ Mesa ${order.tableNumber}`
                                }</p>
                                {order.serviceMode === "delivery" && (
                                  <p className="line-clamp-2"><strong>Dirección:</strong> {order.customerAddress}</p>
                                )}
                                <p><strong>Pago:</strong> {
                                  order.paymentMethod === "cash" ? "💵 Efectivo" :
                                  order.paymentMethod === "yape" ? "📱 Yape/Plin" : "💳 Transferencia"
                                }</p>
                              </div>

                              {/* Details */}
                              <div className="border-t border-b border-white/5 py-3 mb-4 space-y-2 text-xs text-left">
                                <span className="block text-[9px] font-bold uppercase tracking-widest text-white/30">Detalle de Compra</span>
                                {order.items.map((item, idx) => (
                                  <div key={item.cartId || idx} className="flex flex-col">
                                    <div className="flex justify-between font-medium">
                                      <span className="text-white">{item.quantity}x {item.name}</span>
                                      <span className="text-white/60">
                                        {formatCurrency(item.price * item.quantity, businessConfig.currency)}
                                      </span>
                                    </div>
                                    {item.optionsSelected && Object.keys(item.optionsSelected).length > 0 && (
                                      <span className="text-[10px] text-white/40 pl-3">
                                        Opciones: {Object.entries(item.optionsSelected).map(([k, v]) => `${k}: ${v}`).join(", ")}
                                      </span>
                                    )}
                                    {item.comboItems && item.comboItems.length > 0 && (
                                      <span className="text-[10px] text-pizza-gold/80 pl-3">
                                        Combo: {item.comboItems.join(" + ")}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Footer card */}
                            <div>
                              <div className="flex justify-between items-baseline mb-4 bg-black/40 rounded-xl p-3 border border-white/5 text-xs">
                                <span className="text-white/40">Total Cobrado:</span>
                                <span className="text-base font-black text-pizza-gold">
                                  {formatCurrency(order.total, businessConfig.currency)}
                                </span>
                              </div>

                              <div className="flex flex-col gap-2">
                                {order.status === "pending_approval" && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      onClick={() => handleReject(order)}
                                      className="bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 text-red-400 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                                    >
                                      <X size={14} />
                                      Rechazar
                                    </button>
                                    <button
                                      onClick={() => handleAuthorize(order)}
                                      className="bg-pizza-red hover:bg-pizza-red/95 text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md shadow-pizza-red/15"
                                    >
                                      <Check size={14} />
                                      Autorizar
                                    </button>
                                  </div>
                                )}

                                {order.status === "ready" && (
                                  <button
                                    onClick={() => handleMarkCompleted(order)}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5"
                                  >
                                    <Check size={14} />
                                    Completar (Entregar)
                                  </button>
                                )}

                                {order.serviceMode === "delivery" && order.status !== "pending_approval" && (
                                  <button
                                    onClick={() => handleShareDeliveryWhatsApp(order)}
                                    className="bg-emerald-600/10 border border-emerald-500/25 hover:bg-emerald-600/20 text-emerald-400 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5"
                                  >
                                    <MessageSquare size={14} className="text-emerald-400" />
                                    Repartidor (WhatsApp)
                                  </button>
                                )}

                                {order.status !== "pending_approval" && (
                                  <button
                                    onClick={() => triggerPrint(order)}
                                    className="bg-[#202020] border border-white/5 hover:bg-white/5 text-white py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5"
                                  >
                                    <Printer size={14} className="text-[#ffd79b]" />
                                    Reimprimir Ticket
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: VENTAS REPORT */}
            {activeTab === "ventas" && hasPermission(PERMISSIONS.VER_VENTAS) && (
              <div className="space-y-6">
                {/* Export sales & General metrics */}
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">Métricas Financieras de Facturación</h3>
                  <button
                    onClick={handleExportSalesCSV}
                    className="flex items-center gap-1.5 bg-[#181818] border border-white/10 hover:bg-white/5 text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-colors"
                  >
                    <Download size={14} className="text-[#ffd79b]" />
                    Exportar Ventas (CSV)
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="glass-panel p-6 rounded-3xl border border-white/5 text-left bg-black/15">
                    <span className="text-xs font-semibold uppercase text-white/40 tracking-wider">Total Facturado</span>
                    <h2 className="text-3xl font-black text-pizza-gold mt-1">
                      {formatCurrency(totalSalesRevenue, businessConfig.currency)}
                    </h2>
                    <p className="text-[10px] text-white/40 mt-1">Ventas completadas de la base de datos</p>
                  </div>

                  <div className="glass-panel p-6 rounded-3xl border border-white/5 text-left bg-black/15">
                    <span className="text-xs font-semibold uppercase text-white/40 tracking-wider">Pedidos Concluidos</span>
                    <h2 className="text-3xl font-black text-white mt-1">
                      {completedOrders.length}
                    </h2>
                    <p className="text-[10px] text-white/40 mt-1">Transacciones procesadas</p>
                  </div>

                  <div className="glass-panel p-6 rounded-3xl border border-white/5 text-left bg-black/15">
                    <span className="text-xs font-semibold uppercase text-white/40 tracking-wider">Ticket Promedio</span>
                    <h2 className="text-3xl font-black text-emerald-400 mt-1">
                      {formatCurrency(averageTicket, businessConfig.currency)}
                    </h2>
                    <p className="text-[10px] text-white/40 mt-1">Facturación promedio por cliente</p>
                  </div>
                </div>

                {/* CSS visual charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Chart 1: Service Mode Distribution */}
                  <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] text-left">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-5">Distribución por Tipo de Servicio</h3>
                    
                    {totalSalesRevenue === 0 ? (
                      <p className="text-xs text-white/30 text-center py-10">Sin datos de ventas para mostrar</p>
                    ) : (
                      <div className="space-y-4">
                        {/* Stacked bar */}
                        <div className="w-full h-7 rounded-lg overflow-hidden flex bg-white/5 border border-white/5 shadow-inner">
                          {Object.entries(modeCounts).map(([mode, amt]) => {
                            const pct = totalSalesRevenue > 0 ? (amt / totalSalesRevenue) * 100 : 0;
                            if (pct === 0) return null;
                            const color = 
                              mode === "delivery" ? "bg-pizza-red" :
                              mode === "pickup" ? "bg-pizza-gold" : "bg-emerald-500";
                            return (
                              <div
                                key={mode}
                                style={{ width: `${pct}%` }}
                                className={`${color} h-full transition-all duration-300 relative group`}
                                title={`${mode}: ${pct.toFixed(1)}%`}
                              />
                            );
                          })}
                        </div>
                        {/* Detailed Metrics */}
                        <div className="grid grid-cols-3 gap-4 pt-2">
                          {[
                            { key: "delivery", label: "🛵 Delivery", colorClass: "text-pizza-red" },
                            { key: "pickup", label: "🥡 Recojo", colorClass: "text-pizza-gold" },
                            { key: "dinein", label: "🍽️ Mesa", colorClass: "text-emerald-600" }
                          ].map((item) => {
                            const amt = modeCounts[item.key] || 0;
                            const pct = totalSalesRevenue > 0 ? (amt / totalSalesRevenue) * 100 : 0;
                            return (
                              <div key={item.key} className="space-y-0.5">
                                <span className={`text-[10px] font-bold ${item.colorClass}`}>{item.label}</span>
                                <span className="block text-sm font-black">{formatCurrency(amt, businessConfig.currency)}</span>
                                <span className="block text-[9px] text-white/40 font-medium">{pct.toFixed(1)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Chart 2: Payment Method Distribution */}
                  <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] text-left">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-5">Distribución por Método de Pago</h3>

                    {totalSalesRevenue === 0 ? (
                      <p className="text-xs text-white/30 text-center py-10">Sin datos de ventas para mostrar</p>
                    ) : (
                      <div className="space-y-4">
                        {[
                          { key: "cash", label: "💵 Efectivo en Caja", color: "bg-pizza-gold" },
                          { key: "yape", label: "📱 Yape / Plin", color: "bg-pizza-red" },
                          { key: "transfer", label: "💳 Transferencia Bancaria", color: "bg-blue-500" }
                        ].map((method) => {
                          const amt = payCounts[method.key] || 0;
                          const pct = totalSalesRevenue > 0 ? (amt / totalSalesRevenue) * 100 : 0;
                          return (
                            <div key={method.key} className="space-y-1">
                              <div className="flex justify-between items-baseline text-[10px] font-bold">
                                <span className="text-white/60">{method.label}</span>
                                <span className="text-white/80">
                                  {formatCurrency(amt, businessConfig.currency)} ({pct.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden">
                                <div
                                  style={{ width: `${pct}%` }}
                                  className={`h-full ${method.color} rounded-full transition-all duration-300`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Graficos SVG interactivos */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                  {/* Line Chart: Ventas por Hora */}
                  <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] text-left relative group">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-5">Volumen de Ventas por Hora</h3>
                    
                    {totalSalesRevenue === 0 ? (
                      <p className="text-xs text-white/30 text-center py-10">Sin datos de ventas para mostrar</p>
                    ) : (() => {
                      const width = 500;
                      const height = 200;
                      const paddingLeft = 45;
                      const paddingRight = 20;
                      const paddingTop = 20;
                      const paddingBottom = 35;
                      
                      const chartWidth = width - paddingLeft - paddingRight;
                      const chartHeight = height - paddingTop - paddingBottom;
                      
                      const maxSales = Math.max(...salesByHour.map(h => h.total), 10);
                      
                      // Y-axis ticks (4 divisions)
                      const yTicks = [0, maxSales * 0.25, maxSales * 0.5, maxSales * 0.75, maxSales];
                      
                      // Generate SVG path for line
                      let points = [];
                      salesByHour.forEach((h, index) => {
                        const x = paddingLeft + (index / 23) * chartWidth;
                        const y = (paddingTop + chartHeight) - (h.total / maxSales) * chartHeight;
                        points.push({ x, y, hour: h.hour, total: h.total, count: h.count });
                      });
                      
                      const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                      const areaPath = points.length > 0 
                        ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
                        : '';
                        
                      return (
                        <div className="relative">
                          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
                            <defs>
                              {/* Area Gradient */}
                              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--chart-line-sales)" stopOpacity="0.15" />
                                <stop offset="100%" stopColor="var(--chart-line-sales)" stopOpacity="0" />
                              </linearGradient>
                              {/* Line Gradient */}
                              <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="var(--chart-line-sales)" />
                                <stop offset="100%" stopColor="var(--chart-line-sales-end)" />
                              </linearGradient>
                            </defs>
                            
                            {/* Y-Axis Grid Lines & Labels */}
                            {yTicks.map((val, idx) => {
                              const y = (paddingTop + chartHeight) - (val / maxSales) * chartHeight;
                              return (
                                <g key={idx}>
                                  <line 
                                    x1={paddingLeft} 
                                    y1={y} 
                                    x2={width - paddingRight} 
                                    y2={y} 
                                    stroke="var(--chart-grid)" 
                                    strokeDasharray="4 4"
                                    strokeWidth="1"
                                  />
                                  <text 
                                    x={paddingLeft - 8} 
                                    y={y + 3} 
                                    fill="var(--chart-text)" 
                                    fontSize="8.5" 
                                    fontWeight="bold"
                                    textAnchor="end"
                                  >
                                    {formatCurrency(val, businessConfig.currency).split('.')[0]}
                                  </text>
                                </g>
                              );
                            })}
                            
                            {/* X-Axis Labels (every 4 hours: 0, 4, 8, 12, 16, 20, 23) */}
                            {salesByHour.map((h, idx) => {
                              if (idx % 4 !== 0 && idx !== 23) return null;
                              const x = paddingLeft + (idx / 23) * chartWidth;
                              const y = paddingTop + chartHeight + 14;
                              return (
                                <text
                                  key={idx}
                                  x={x}
                                  y={y}
                                  fill="var(--chart-text)"
                                  fontSize="8.5"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  {`${h.hour.toString().padStart(2, '0')}:00`}
                                </text>
                              );
                            })}
                            
                            {/* Area under the line */}
                            {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}
                            
                            {/* Main Line */}
                            {linePath && (
                              <path 
                                d={linePath} 
                                fill="none" 
                                stroke="url(#lineGrad)" 
                                strokeWidth="2.5" 
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            )}
                            
                            {/* Hover guideline */}
                            {hoveredHourPoint && (
                              <line
                                x1={hoveredHourPoint.x}
                                y1={paddingTop}
                                x2={hoveredHourPoint.x}
                                y2={paddingTop + chartHeight}
                                stroke="var(--chart-hover-line)"
                                strokeWidth="1"
                                strokeDasharray="2 2"
                              />
                            )}
                            
                            {/* Data Points */}
                            {points.map((p, idx) => {
                              const isHovered = hoveredHourPoint && hoveredHourPoint.hour === p.hour;
                              if (p.total === 0 && !isHovered) return null;
                              
                              return (
                                <circle
                                  key={idx}
                                  cx={p.x}
                                  cy={p.y}
                                  r={isHovered ? 6 : 3.5}
                                  fill={isHovered ? "var(--chart-line-sales-end)" : "var(--chart-line-sales)"}
                                  stroke={isHovered ? "#ffffff" : "rgba(255,255,255,0.8)"}
                                  strokeWidth={isHovered ? 2 : 1}
                                  className="transition-all duration-150 cursor-pointer"
                                  onMouseEnter={() => setHoveredHourPoint(p)}
                                  onMouseLeave={() => setHoveredHourPoint(null)}
                                />
                              );
                            })}
                          </svg>
                          
                          {/* Tooltip Overlay */}
                          {hoveredHourPoint && (
                            <div 
                              className="absolute z-10 bg-white border border-black/10 rounded-xl p-2.5 shadow-2xl pointer-events-none text-xs space-y-0.5 text-left transition-all duration-100"
                              style={{
                                left: `${((hoveredHourPoint.x - 20) / width) * 100}%`,
                                top: `${((hoveredHourPoint.y - 75) / height) * 100}%`,
                                transform: 'translateX(-40%)',
                                minWidth: '120px'
                              }}
                            >
                              <p className="font-bold text-pizza-gold">{hoveredHourPoint.hour.toString().padStart(2, '0')}:00 hrs</p>
                              <p className="text-black/80 font-medium">Ventas: <span className="font-black text-black">{formatCurrency(hoveredHourPoint.total, businessConfig.currency)}</span></p>
                              <p className="text-black/50 text-[10px] font-medium">Pedidos: <span className="font-bold text-black/70">{hoveredHourPoint.count}</span></p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Horizontal Bar Chart: Top 5 Products */}
                  <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] text-left relative group">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-5">Top 5 Productos Más Vendidos</h3>
                    
                    {topProducts.length === 0 ? (
                      <p className="text-xs text-white/30 text-center py-10">Sin datos de productos vendidos</p>
                    ) : (() => {
                      const width = 500;
                      const height = 200;
                      const paddingLeft = 110;
                      const paddingRight = 60;
                      const paddingTop = 15;
                      const paddingBottom = 15;
                      
                      const chartWidth = width - paddingLeft - paddingRight;
                      const chartHeight = height - paddingTop - paddingBottom;
                      
                      const barHeight = 20;
                      const barSpacing = (chartHeight - (5 * barHeight)) / 4;
                      
                      const maxQty = Math.max(...topProducts.map(p => p.quantity), 1);
                      
                      return (
                        <div className="relative">
                          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
                            <defs>
                              {/* Bar Gradient */}
                              <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="var(--chart-bar-start)" />
                                <stop offset="100%" stopColor="var(--chart-bar-end)" />
                              </linearGradient>
                            </defs>
                            
                            {topProducts.map((p, idx) => {
                              const y = paddingTop + idx * (barHeight + barSpacing);
                              const w = (p.quantity / maxQty) * chartWidth;
                              const isHovered = hoveredProductIndex === idx;
                              
                              return (
                                <g 
                                  key={idx} 
                                  className="cursor-pointer"
                                  onMouseEnter={() => setHoveredProductIndex(idx)}
                                  onMouseLeave={() => setHoveredProductIndex(null)}
                                >
                                  {/* Product Name Label */}
                                  <text
                                    x={paddingLeft - 10}
                                    y={y + barHeight / 2 + 3}
                                    fill={isHovered ? "var(--color-pizza-gold)" : "#1a1c1c"}
                                    fontSize="9.5"
                                    fontWeight="bold"
                                    textAnchor="end"
                                    className="transition-colors duration-150"
                                  >
                                    {p.name.length > 18 ? `${p.name.substring(0, 16)}...` : p.name}
                                  </text>
                                  
                                  {/* Background track */}
                                  <rect
                                    x={paddingLeft}
                                    y={y}
                                    width={chartWidth}
                                    height={barHeight}
                                    fill="var(--chart-bg-track)"
                                    rx="4"
                                    ry="4"
                                  />
                                  
                                  {/* Product Bar */}
                                  <rect
                                    x={paddingLeft}
                                    y={y}
                                    width={Math.max(w, 4)}
                                    height={barHeight}
                                    fill="url(#barGrad)"
                                    opacity={isHovered ? 1 : 0.85}
                                    rx="4"
                                    ry="4"
                                    className="transition-all duration-200"
                                  />
                                  
                                  {/* Quantity label */}
                                  <text
                                    x={paddingLeft + w + 8}
                                    y={y + barHeight / 2 + 3}
                                    fill={isHovered ? "var(--color-pizza-gold)" : "var(--chart-text)"}
                                    fontSize="9.5"
                                    fontWeight="black"
                                    textAnchor="start"
                                    className="transition-colors duration-150"
                                  >
                                    {p.quantity} uds
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                          
                          {/* Tooltip Overlay */}
                          {hoveredProductIndex !== null && topProducts[hoveredProductIndex] && (
                            <div 
                              className="absolute z-10 bg-white border border-black/10 rounded-xl p-2.5 shadow-2xl pointer-events-none text-xs space-y-0.5 text-left transition-all duration-100"
                              style={{
                                left: `${(paddingLeft + (topProducts[hoveredProductIndex].quantity / maxQty) * chartWidth) / width * 100}%`,
                                top: `${(paddingTop + hoveredProductIndex * (barHeight + barSpacing) - 35) / height * 100}%`,
                                transform: 'translateX(-50%)',
                                minWidth: '130px'
                              }}
                            >
                              <p className="font-bold text-pizza-gold">{topProducts[hoveredProductIndex].name}</p>
                              <p className="text-black/80 font-medium">Cantidad: <span className="font-black text-black">{topProducts[hoveredProductIndex].quantity} uds</span></p>
                              <p className="text-black/80 font-medium">Ingresos: <span className="font-black text-emerald-600">{formatCurrency(topProducts[hoveredProductIndex].revenue, businessConfig.currency)}</span></p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: RESULTADOS FINANCIEROS */}
            {activeTab === "finanzas" && hasPermission(PERMISSIONS.VER_FINANZAS) && (() => {
              const getFinanceFilteredData = () => {
                const now = new Date();
                let startDate = new Date(0); // Epoch start (Histórico)

                if (financesPeriod === "today") {
                  startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                } else if (financesPeriod === "week") {
                  startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                } else if (financesPeriod === "month") {
                  startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                } else if (financesPeriod === "year") {
                  startDate = new Date(now.getFullYear(), 0, 1);
                }

                // Filtrar órdenes completadas
                const filteredOrders = completedOrders.filter(o => {
                  if (!o.createdAt) return false;
                  const orderDate = o.createdAt.seconds 
                    ? new Date(o.createdAt.seconds * 1000) 
                    : new Date(o.createdAt);
                  return orderDate >= startDate;
                });

                // Filtrar egresos
                const filteredExpenses = expenses.filter(e => {
                  if (!e.date) return false;
                  const expDate = e.date.seconds
                    ? new Date(e.date.seconds * 1000)
                    : new Date(e.date);
                  return expDate >= startDate;
                });

                return { filteredOrders, filteredExpenses };
              };

              const getFinanceChartData = () => {
                const now = new Date();
                let bins = [];

                if (financesPeriod === "today") {
                  for (let i = 0; i < 6; i++) {
                    const hStart = i * 4;
                    const dStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hStart, 0, 0);
                    const dEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hStart + 4, 0, 0);
                    bins.push({ start: dStart, end: dEnd, label: `${hStart}:00`, income: 0, expense: 0 });
                  }
                } else if (financesPeriod === "week") {
                  for (let i = 6; i >= 0; i--) {
                    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
                    const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
                    const dEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
                    const label = d.toLocaleDateString("es-ES", { weekday: "short" });
                    bins.push({ start: dStart, end: dEnd, label: label, income: 0, expense: 0 });
                  }
                } else if (financesPeriod === "month") {
                  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                  const step = Math.ceil(lastDay / 5);
                  for (let i = 0; i < 5; i++) {
                    const startDay = i * step + 1;
                    const endDay = Math.min((i + 1) * step, lastDay);
                    const dStart = new Date(now.getFullYear(), now.getMonth(), startDay, 0, 0, 0);
                    const dEnd = new Date(now.getFullYear(), now.getMonth(), endDay, 23, 59, 59);
                    bins.push({ start: dStart, end: dEnd, label: `${startDay}-${endDay}`, income: 0, expense: 0 });
                  }
                } else if (financesPeriod === "year") {
                  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                  for (let i = 0; i < 6; i++) {
                    const mStart = i * 2;
                    const dStart = new Date(now.getFullYear(), mStart, 1, 0, 0, 0);
                    const dEnd = new Date(now.getFullYear(), mStart + 1, 31, 23, 59, 59);
                    bins.push({ start: dStart, end: dEnd, label: `${monthNames[mStart]}-${monthNames[mStart+1]}`, income: 0, expense: 0 });
                  }
                } else {
                  for (let i = 5; i >= 0; i--) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i * 6, 1);
                    const dStart = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0);
                    const dEnd = new Date(d.getFullYear(), d.getMonth() + 5, 31, 23, 59, 59);
                    bins.push({ start: dStart, end: dEnd, label: `${d.getFullYear() % 100} S${i%2+1}`, income: 0, expense: 0 });
                  }
                }

                const { filteredOrders: finOrders, filteredExpenses: finExpenses } = getFinanceFilteredData();

                finOrders.forEach(o => {
                  const orderDate = o.createdAt?.seconds 
                    ? new Date(o.createdAt.seconds * 1000) 
                    : new Date(o.createdAt || 0);
                  const bin = bins.find(b => orderDate >= b.start && orderDate <= b.end);
                  if (bin) {
                    bin.income += o.total || 0;
                  }
                });

                finExpenses.forEach(e => {
                  const expDate = e.date?.seconds
                    ? new Date(e.date.seconds * 1000)
                    : new Date(e.date || 0);
                  const bin = bins.find(b => expDate >= b.start && expDate <= b.end);
                  if (bin) {
                    bin.expense += e.amount || 0;
                  }
                });

                return bins;
              };

              const { filteredOrders: finOrders, filteredExpenses: finExpenses } = getFinanceFilteredData();
              const totalIncomes = finOrders.reduce((sum, o) => sum + (o.total || 0), 0);
              const totalExpenses = finExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
              const netProfit = totalIncomes - totalExpenses;
              const profitMargin = totalIncomes > 0 ? (netProfit / totalIncomes) * 100 : 0;

              const chartBins = getFinanceChartData();
              const maxVal = Math.max(...chartBins.map(b => Math.max(b.income, b.expense)), 50);

              const svgWidth = 600;
              const svgHeight = 200;
              const padLeft = 50;
              const padRight = 20;
              const padTop = 20;
              const padBot = 30;

              const getSvgCoords = (val, idx) => {
                const x = padLeft + (idx / (chartBins.length - 1)) * (svgWidth - padLeft - padRight);
                const y = svgHeight - padBot - (val / maxVal) * (svgHeight - padTop - padBot);
                return { x, y };
              };

              let incomePoints = "";
              let expensePoints = "";
              let incomeAreaPath = `M ${padLeft} ${svgHeight - padBot} `;
              let expenseAreaPath = `M ${padLeft} ${svgHeight - padBot} `;

              chartBins.forEach((b, idx) => {
                const incCoords = getSvgCoords(b.income, idx);
                const expCoords = getSvgCoords(b.expense, idx);

                incomePoints += `${incCoords.x},${incCoords.y} `;
                expensePoints += `${expCoords.x},${expCoords.y} `;

                incomeAreaPath += `L ${incCoords.x} ${incCoords.y} `;
                expenseAreaPath += `L ${expCoords.x} ${expCoords.y} `;

                if (idx === chartBins.length - 1) {
                  incomeAreaPath += `L ${incCoords.x} ${svgHeight - padBot} Z`;
                  expenseAreaPath += `L ${expCoords.x} ${svgHeight - padBot} Z`;
                }
              });

              const productProfitability = {};
              finOrders.forEach(order => {
                if (!order.items) return;
                order.items.forEach(item => {
                  const name = item.name;
                  const qty = item.quantity || 0;
                  const price = item.price || 0;
                  const totalItemRevenue = qty * price;
                  
                  const matchedProd = productsList.find(p => p.name === name || p.id === item.productId);
                  const unitCost = matchedProd ? (matchedProd.cost || 0) : 0;
                  const totalItemCost = qty * unitCost;

                  if (!productProfitability[name]) {
                    productProfitability[name] = {
                      name: name,
                      quantity: 0,
                      revenue: 0,
                      cost: 0,
                      unitPrice: matchedProd ? matchedProd.price : price,
                      unitCost: unitCost
                    };
                  }
                  productProfitability[name].quantity += qty;
                  productProfitability[name].revenue += totalItemRevenue;
                  productProfitability[name].cost += totalItemCost;
                });
              });

              const profitabilityList = Object.values(productProfitability).map(p => {
                const net = p.revenue - p.cost;
                const margin = p.revenue > 0 ? (net / p.revenue) * 100 : 0;
                return { ...p, net, margin };
              }).sort((a, b) => b.revenue - a.revenue);

              const starProduct = profitabilityList.length > 0
                ? [...profitabilityList].sort((a, b) => b.quantity - a.quantity)[0]
                : null;

              const mostProfitableProduct = profitabilityList.length > 0
                ? [...profitabilityList].sort((a, b) => b.net - a.net)[0]
                : null;

              const unifiedTransactions = [
                ...finOrders.map(o => ({
                  id: o.id,
                  type: "ingreso",
                  description: `Pedido #${o.orderNumber || ""} - ${o.customerName || "Cliente"}`,
                  category: "Venta",
                  amount: o.total || 0,
                  date: o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000) : new Date(o.createdAt || 0),
                  createdBy: o.serviceMode === "delivery" ? "Delivery" : o.serviceMode === "pickup" ? "Retiro" : "Mesa"
                })),
                ...finExpenses.map(e => ({
                  id: e.id,
                  type: "egreso",
                  description: e.description,
                  category: e.category,
                  amount: e.amount || 0,
                  date: e.date?.seconds ? new Date(e.date.seconds * 1000) : new Date(e.date || 0),
                  createdBy: e.createdBy
                }))
              ].sort((a, b) => b.date - a.date);

              const handleExportFinancesCSV = () => {
                const headers = ["Fecha", "Tipo", "Categoria", "Descripcion", "Monto", "Usuario / Canal"];
                const rows = unifiedTransactions.map(t => [
                  t.date.toLocaleString(),
                  t.type.toUpperCase(),
                  t.category,
                  t.description,
                  t.amount.toFixed(2),
                  t.createdBy
                ]);
                downloadCSV(`reporte_financiero_${financesPeriod}.csv`, headers, rows);
                logAuditEvent(user.email, "EXPORTAR_CSV_FINANZAS", `Exporto reporte financiero (${financesPeriod}) a CSV`);
              };

              return (
                <div className="space-y-6">
                  {/* Cabecera y botón exportar */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">Resultados Financieros y Balance</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={handleExportFinancesCSV}
                        className="flex items-center gap-1.5 bg-[#181818] border border-white/10 hover:bg-white/5 text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-colors"
                      >
                        <Download size={14} className="text-pizza-gold" />
                        Exportar Reporte (CSV)
                      </button>
                      <button
                        onClick={() => setIsExpenseModalOpen(true)}
                        className="flex items-center gap-1.5 bg-pizza-gold text-pizza-dark font-black hover:bg-[#ffd79b] text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-all"
                      >
                        <Plus size={14} />
                        Registrar Egreso
                      </button>
                    </div>
                  </div>

                  {/* Filtro de Períodos */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "today", label: "Hoy" },
                      { id: "week", label: "Últimos 7 Días" },
                      { id: "month", label: "Este Mes" },
                      { id: "year", label: "Este Año" },
                      { id: "all", label: "Histórico" }
                    ].map((period) => (
                      <button
                        key={period.id}
                        onClick={() => setFinancesPeriod(period.id)}
                        className={`text-xs px-4 py-2 rounded-xl transition-all cursor-pointer ${
                          financesPeriod === period.id
                            ? "bg-pizza-gold text-pizza-dark font-bold"
                            : "bg-white/5 border border-white/5 hover:bg-white/10 text-white/80"
                        }`}
                      >
                        {period.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-6 text-left">
                    {/* Tarjetas KPI */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Tarjeta 1: Ingresos */}
                      <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#121212] relative overflow-hidden">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Total Ingresos</span>
                          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                            <TrendingUp size={16} />
                          </div>
                        </div>
                        <h2 className="text-2xl font-black text-white mt-3">
                          {formatCurrency(totalIncomes, businessConfig.currency)}
                        </h2>
                        <div className="text-[10px] text-white/40 mt-1 flex justify-between">
                          <span>{finOrders.length} Ventas</span>
                          <span className="text-emerald-400 font-bold">100% Entrante</span>
                        </div>
                      </div>

                      {/* Tarjeta 2: Egresos */}
                      <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#121212] relative overflow-hidden">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Total Egresos</span>
                          <div className="p-2 rounded-lg bg-pizza-red/10 text-pizza-red">
                            <TrendingUp size={16} className="rotate-180" />
                          </div>
                        </div>
                        <h2 className="text-2xl font-black text-white mt-3">
                          {formatCurrency(totalExpenses, businessConfig.currency)}
                        </h2>
                        <div className="text-[10px] text-white/40 mt-1 flex justify-between">
                          <span>{finExpenses.length} Gastos</span>
                          <span className="text-pizza-red font-bold">Saliente</span>
                        </div>
                      </div>

                      {/* Tarjeta 3: Utilidad Neta */}
                      <div className={`glass-panel p-5 rounded-2xl border border-white/5 bg-[#121212] relative overflow-hidden`}>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Utilidad Neta</span>
                          <div className={`p-2 rounded-lg ${netProfit >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-pizza-red/10 text-pizza-red"}`}>
                            <DollarSign size={16} />
                          </div>
                        </div>
                        <h2 className={`text-2xl font-black mt-3 ${netProfit >= 0 ? "text-emerald-400" : "text-pizza-red"}`}>
                          {formatCurrency(netProfit, businessConfig.currency)}
                        </h2>
                        <p className="text-[10px] text-white/40 mt-1">Balance neto en caja</p>
                      </div>

                      {/* Tarjeta 4: Margen de Utilidad */}
                      <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#121212] relative overflow-hidden">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Margen de Beneficio</span>
                          <div className="p-2 rounded-lg bg-pizza-gold/10 text-pizza-gold">
                            <Percent size={16} />
                          </div>
                        </div>
                        <h2 className="text-2xl font-black text-pizza-gold mt-3">
                          {profitMargin.toFixed(1)}%
                        </h2>
                        <p className="text-[10px] text-white/40 mt-1">Retorno sobre ingresos</p>
                      </div>
                    </div>

                    {/* Fila 2: Gráfico y Resumen de Productos */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Panel del Gráfico */}
                      <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-1">Tendencia de Ingresos vs. Egresos</h4>
                          <p className="text-[10px] text-white/40 mb-4">Visualización cronológica agrupada del período activo</p>
                        </div>
                        
                        {chartBins.length > 1 && maxVal > 50 ? (
                          <div className="w-full overflow-x-auto">
                            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full min-w-[450px] overflow-visible">
                              <defs>
                                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="var(--chart-line-income)" stopOpacity="0.15"/>
                                  <stop offset="100%" stopColor="var(--chart-line-income)" stopOpacity="0"/>
                                </linearGradient>
                                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="var(--chart-line-expense)" stopOpacity="0.15"/>
                                  <stop offset="100%" stopColor="var(--chart-line-expense)" stopOpacity="0"/>
                                </linearGradient>
                              </defs>

                              {/* Líneas de fondo (Grilla) */}
                              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                                const y = padTop + ratio * (svgHeight - padTop - padBot);
                                const valLabel = (maxVal * (1 - ratio)).toFixed(0);
                                return (
                                  <g key={i}>
                                    <line x1={padLeft} y1={y} x2={svgWidth - padRight} y2={y} stroke="var(--chart-grid)" strokeWidth="0.5" strokeDasharray="3,3" />
                                    <text x={padLeft - 8} y={y + 3} textAnchor="end" fill="var(--chart-text)" className="text-[9px] font-bold">{valLabel}</text>
                                  </g>
                                );
                              })}

                              {/* Líneas y áreas de gráfico */}
                              {incomePoints && (
                                <>
                                  <path d={incomeAreaPath} fill="url(#incomeGrad)" />
                                  <polyline fill="none" stroke="var(--chart-line-income)" strokeWidth="2.5" points={incomePoints} />
                                </>
                              )}
                              {expensePoints && (
                                <>
                                  <path d={expenseAreaPath} fill="url(#expenseGrad)" />
                                  <polyline fill="none" stroke="var(--chart-line-expense)" strokeWidth="2.5" points={expensePoints} />
                                </>
                              )}

                              {/* Puntos interactivos / círculos */}
                              {chartBins.map((b, idx) => {
                                const inc = getSvgCoords(b.income, idx);
                                const exp = getSvgCoords(b.expense, idx);
                                return (
                                  <g key={idx}>
                                    {/* Círculo Ingresos */}
                                    <circle cx={inc.x} cy={inc.y} r="4" className="fill-emerald-500 stroke-white stroke-2 hover:scale-150 cursor-pointer transition-all" />
                                    {/* Círculo Egresos */}
                                    <circle cx={exp.x} cy={exp.y} r="4" className="fill-red-500 stroke-white stroke-2 hover:scale-150 cursor-pointer transition-all" />
                                    
                                    {/* Etiquetas del eje X */}
                                    <text x={inc.x} y={svgHeight - 10} textAnchor="middle" fill="var(--chart-text)" className="text-[9px] font-bold">
                                      {b.label}
                                    </text>
                                  </g>
                                );
                              })}
                            </svg>
                          </div>
                        ) : (
                          <div className="h-40 flex items-center justify-center text-xs text-white/30">
                            Sin suficientes transacciones para graficar
                          </div>
                        )}

                        <div className="flex gap-4 justify-center text-[10px] mt-2 border-t border-white/5 pt-3">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Ingresos (Ventas)</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Egresos (Gastos)</span>
                        </div>
                      </div>

                      {/* Productos Destacados */}
                      <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] flex flex-col justify-between">
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-white/60">Destacados Financieros</h4>
                          
                          {starProduct ? (
                            <div className="border border-white/5 rounded-xl p-3.5 bg-white/[0.02] flex items-center gap-3">
                              <div className="p-2.5 rounded-lg bg-pizza-gold/10 text-pizza-gold">
                                <Package size={18} />
                              </div>
                              <div className="text-left">
                                <span className="block text-[8px] font-bold text-white/30 uppercase tracking-widest">Producto más Vendido</span>
                                <span className="block text-xs font-bold text-white truncate max-w-[140px]">{starProduct.name}</span>
                                <span className="block text-[10px] text-white/50">{starProduct.quantity} unidades vendidas</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-white/20">No hay ventas registradas</p>
                          )}

                          {mostProfitableProduct ? (
                            <div className="border border-white/5 rounded-xl p-3.5 bg-white/[0.02] flex items-center gap-3">
                              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                                <TrendingUp size={18} />
                              </div>
                              <div className="text-left">
                                <span className="block text-[8px] font-bold text-white/30 uppercase tracking-widest">Mayor Margen Neto</span>
                                <span className="block text-xs font-bold text-white truncate max-w-[140px]">{mostProfitableProduct.name}</span>
                                <span className="block text-[10px] text-emerald-400 font-bold">+{formatCurrency(mostProfitableProduct.net, businessConfig.currency)} neto</span>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-6 text-[10px] text-white/30 border-t border-white/5 pt-3 leading-relaxed">
                          💡 Para calcular utilidades netas reales por producto, asegúrate de asignarle su respectivo <strong>Costo COGS</strong> en el CRUD de inventario.
                        </div>
                      </div>
                    </div>

                    {/* Rentabilidad de Productos */}
                    <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212]">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-4">Rentabilidad por Producto del Catálogo</h4>
                      
                      {profitabilityList.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="border-b border-white/5 text-[10px] font-bold text-white/40 uppercase tracking-wider">
                                <th className="py-2.5">Producto</th>
                                <th className="py-2.5 text-center">Unidades</th>
                                <th className="py-2.5 text-right">Precio Venta</th>
                                <th className="py-2.5 text-right">Costo COGS</th>
                                <th className="py-2.5 text-right">Ingreso Bruto</th>
                                <th className="py-2.5 text-right">Costo Total</th>
                                <th className="py-2.5 text-right">Utilidad Neta</th>
                                <th className="py-2.5 text-right">Margen</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {profitabilityList.map((p, idx) => (
                                <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                  <td className="py-2.5 font-semibold text-white">{p.name}</td>
                                  <td className="py-2.5 text-center font-bold text-white/70">{p.quantity}</td>
                                  <td className="py-2.5 text-right text-white/60">{formatCurrency(p.unitPrice, businessConfig.currency)}</td>
                                  <td className="py-2.5 text-right text-white/40">{p.unitCost > 0 ? formatCurrency(p.unitCost, businessConfig.currency) : "-"}</td>
                                  <td className="py-2.5 text-right text-white/80">{formatCurrency(p.revenue, businessConfig.currency)}</td>
                                  <td className="py-2.5 text-right text-white/40">{p.cost > 0 ? formatCurrency(p.cost, businessConfig.currency) : "-"}</td>
                                  <td className={`py-2.5 text-right font-bold ${p.net >= 0 ? "text-emerald-400" : "text-pizza-red"}`}>
                                    {formatCurrency(p.net, businessConfig.currency)}
                                  </td>
                                  <td className={`py-2.5 text-right font-black ${p.margin > 50 ? "text-emerald-400" : p.margin > 20 ? "text-pizza-gold" : "text-white/60"}`}>
                                    {p.margin.toFixed(0)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-xs text-white/30">
                          No hay órdenes completadas registradas en el período seleccionado.
                        </div>
                      )}
                    </div>

                    {/* Transacciones Recientes (Libro Diario) y Egresos */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Libro Diario Unificado */}
                      <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-4">Libro de Transacciones Diario</h4>
                          
                          {unifiedTransactions.length > 0 ? (
                            <div className="overflow-y-auto max-h-[300px] pr-2 space-y-2.5">
                              {unifiedTransactions.map((t, idx) => (
                                <div key={t.id || idx} className="flex justify-between items-center border-b border-white/5 pb-2.5 last:border-b-0">
                                  <div className="text-left space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                        t.type === "ingreso" 
                                          ? "bg-emerald-500/10 text-emerald-400" 
                                          : "bg-pizza-red/10 text-pizza-red"
                                      }`}>
                                        {t.type}
                                      </span>
                                      <span className="text-[10px] text-white/40">{t.date.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</span>
                                    </div>
                                    <p className="text-xs font-bold text-white/80">{t.description}</p>
                                    <p className="text-[9px] text-white/30">Categoría: {t.category} • Por: {t.createdBy}</p>
                                  </div>
                                  <div className="text-right">
                                    <span className={`text-xs font-bold ${
                                      t.type === "ingreso" ? "text-emerald-400" : "text-pizza-red"
                                    }`}>
                                      {t.type === "ingreso" ? "+" : "-"}{formatCurrency(t.amount, businessConfig.currency)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-10 text-xs text-white/30">
                              No se encontraron transacciones en este período.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Listado / Administración rápida de Egresos */}
                      <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-4 font-pizza-title flex justify-between items-center">
                            <span>Gastos Registrados</span>
                            <span className="text-[10px] font-normal text-white/40">Periodo actual</span>
                          </h4>

                          {finExpenses.length > 0 ? (
                            <div className="overflow-y-auto max-h-[300px] pr-2 space-y-2.5 text-left">
                              {finExpenses.map((exp) => {
                                const expDate = exp.date?.seconds
                                  ? new Date(exp.date.seconds * 1000)
                                  : new Date(exp.date || 0);
                                return (
                                  <div key={exp.id} className="border-b border-white/5 pb-2.5 flex justify-between items-center group">
                                    <div>
                                      <p className="text-xs font-bold text-white">{exp.description}</p>
                                      <div className="flex gap-2 items-center text-[9px] text-white/40 mt-0.5">
                                        <span className="font-semibold text-pizza-gold">{exp.category}</span>
                                        <span>•</span>
                                        <span>{expDate.toLocaleDateString()}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black text-pizza-red">
                                        -{formatCurrency(exp.amount, businessConfig.currency)}
                                      </span>
                                      <button
                                        onClick={() => handleDeleteExpense(exp.id, exp.description, exp.amount)}
                                        className="p-1 text-white/20 hover:text-pizza-red hover:bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                        title="Eliminar gasto"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-10 text-xs text-white/30">
                              Sin gastos en el período actual
                            </div>
                          )}
                        </div>

                        <div className="mt-4">
                          <button
                            onClick={() => setIsExpenseModalOpen(true)}
                            className="w-full bg-[#181818] border border-white/10 hover:bg-white/5 text-white/80 font-bold rounded-xl py-2.5 text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Plus size={14} />
                            Nuevo Gasto / Egreso
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* TAB CONTENT: INVENTARIO CRUD */}
            {activeTab === "inventario" && hasPermission(PERMISSIONS.VER_INVENTARIO) && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">Catálogo de Productos del Menú</h3>
                  
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Buscador de Inventario */}
                    <div className="relative w-full sm:w-60">
                      <Search className="absolute left-3 top-2.5 text-white/40" size={16} />
                      <input
                        type="text"
                        placeholder="Buscar producto por nombre o ID..."
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                        className="w-full bg-[#181818] border border-white/5 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red/50"
                      />
                      {inventorySearch && (
                        <button
                          onClick={() => setInventorySearch("")}
                          className="absolute right-2.5 top-2.5 text-white/40 hover:text-white text-xs cursor-pointer"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {/* Selector de Categorías de Inventario */}
                    <select
                      value={inventoryCategory}
                      onChange={(e) => setInventoryCategory(e.target.value)}
                      className="bg-[#181818] border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pizza-red/50 w-full sm:w-auto"
                    >
                      <option value="all">Todas las categorías</option>
                      {categoriesListToUse.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>

                    <button
                      onClick={handleExportInventoryCSV}
                      className="flex items-center justify-center gap-1.5 bg-[#181818] border border-white/10 hover:bg-white/5 text-xs px-4 py-2 rounded-xl cursor-pointer w-full sm:w-auto"
                    >
                      <Download size={14} className="text-[#ffd79b]" />
                      Exportar Catálogo (CSV)
                    </button>
                    <HasPermission role={role} permission={PERMISSIONS.CREAR_PRODUCTO}>
                      <button
                        onClick={handleOpenAddProduct}
                        className="flex items-center justify-center gap-1.5 bg-pizza-red hover:bg-pizza-red/90 text-xs px-4 py-2 rounded-xl font-bold cursor-pointer w-full sm:w-auto shrink-0"
                      >
                        <Plus size={14} />
                        Agregar Producto
                      </button>
                    </HasPermission>
                  </div>
                </div>

                {/* Table list */}
                <div className="glass-panel overflow-x-auto rounded-3xl border border-white/5 bg-[#121212]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/5 text-[10px] uppercase font-bold text-white/50 tracking-wider">
                        <th className="py-4 px-6">Detalle</th>
                        <th className="py-4 px-6">ID</th>
                        <th className="py-4 px-6">Categoría</th>
                        <th className="py-4 px-6">Precio Base</th>
                        <th className="py-4 px-6">Stock</th>
                        <th className="py-4 px-6">Descuento</th>
                        <th className="py-4 px-6 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredInventory.map((prod) => (
                        <tr key={prod.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 px-6 flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-pizza-dark overflow-hidden shrink-0 border border-white/5">
                              <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <span className="font-bold text-white block text-sm">{prod.name}</span>
                              <span className="text-[10px] text-white/40 line-clamp-1 max-w-xs">{prod.description || "Sin descripción"}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 font-mono text-white/50">{prod.id}</td>
                          <td className="py-4 px-6">
                            <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-[10px] font-semibold text-white/80 uppercase">
                              {prod.category}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-bold text-pizza-gold">
                            {formatCurrency(prod.price, businessConfig.currency)}
                          </td>
                          <td className="py-4 px-6">
                            {prod.stock !== undefined ? (
                              <span className={`font-bold px-2.5 py-0.5 rounded-md text-[10px] ${
                                prod.stock <= 0 ? "bg-pizza-red/15 border border-pizza-red/25 text-pizza-red" :
                                prod.stock <= 5 ? "bg-amber-500/15 border border-amber-500/25 text-amber-500" :
                                "bg-emerald-500/15 border border-emerald-500/25 text-emerald-400"
                              }`}>
                                {prod.stock} u.
                              </span>
                            ) : (
                              <span className="text-white/30">-</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            {prod.discount > 0 ? (
                              <span className="bg-pizza-red/10 border border-pizza-red/35 text-pizza-red text-[9px] font-black px-1.5 py-0.5 rounded">
                                -{prod.discount}% OFF
                              </span>
                            ) : (
                              <span className="text-white/30">-</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right space-x-1.5 shrink-0">
                            <HasPermission role={role} permission={PERMISSIONS.EDITAR_PRODUCTO}>
                              <button
                                onClick={() => handleOpenEditProduct(prod)}
                                className="p-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-lg transition-colors cursor-pointer"
                                title="Editar"
                              >
                                <Edit2 size={13} />
                              </button>
                            </HasPermission>
                            <HasPermission role={role} permission={PERMISSIONS.ELIMINAR_PRODUCTO}>
                              <button
                                onClick={() => handleDeleteProduct(prod.id)}
                                className="p-2 bg-pizza-red/10 hover:bg-pizza-red/20 text-pizza-red rounded-lg transition-colors cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 size={13} />
                              </button>
                            </HasPermission>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: CATEGORIAS CRUD */}
            {activeTab === "categorias" && hasPermission(PERMISSIONS.VER_INVENTARIO) && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left animate-in fade-in zoom-in-95 duration-200">
                
                {/* Crear/Editar Categoría Form */}
                <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-5 h-fit">
                  <div className="flex items-center gap-2 text-pizza-red">
                    <Tag size={18} />
                    <h3 className="font-pizza-title font-bold text-sm uppercase">Gestionar Categoría</h3>
                  </div>

                  <form onSubmit={handleSaveCategory} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Nombre de la Categoría</label>
                      <input
                        type="text"
                        required
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Ej. Postres, Ensaladas"
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red/50"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">ID Personalizado (Opcional)</label>
                      <input
                        type="text"
                        value={categoryForm.id}
                        onChange={(e) => setCategoryForm(prev => ({ ...prev, id: e.target.value }))}
                        placeholder="Ej. postres (Autogenerado si está vacío)"
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red/50"
                      />
                    </div>

                    <button type="submit" className="w-full bg-pizza-red text-white text-xs font-bold py-3 rounded-xl cursor-pointer hover:bg-pizza-red/90 transition-all shadow-md shadow-pizza-red/10">
                      Guardar Categoría
                    </button>
                  </form>
                </div>

                {/* Tabla de Categorías */}
                <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-4">
                  <h3 className="font-pizza-title font-bold text-sm uppercase text-white/70">Categorías Registradas</h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/5 text-[9px] uppercase font-bold text-white/40 pb-2">
                          <th className="pb-2">ID</th>
                          <th className="pb-2">Nombre</th>
                          <th className="pb-2 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {categoriesListToUse.map((cat) => (
                          <tr key={cat.id} className="hover:bg-white/[0.01]">
                            <td className="py-3 font-mono text-white/50">{cat.id}</td>
                            <td className="py-3 font-semibold text-white/80">{cat.name}</td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => setCategoryForm({ id: cat.id, name: cat.name })}
                                className="p-1.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-lg transition-colors cursor-pointer mr-1.5"
                                title="Editar"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="p-1.5 bg-pizza-red/10 hover:bg-pizza-red/20 text-pizza-red rounded-lg transition-colors cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: GESTION DE MESAS */}
            {activeTab === "mesas" && hasPermission(PERMISSIONS.VER_MESAS) && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left animate-in fade-in zoom-in-95 duration-200">
                
                {/* Formulario de Mesa */}
                <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-5 h-fit">
                  <div className="flex items-center gap-2 text-pizza-red">
                    <Table size={18} />
                    <h3 className="font-pizza-title font-bold text-sm uppercase">
                      {editingTable ? "Editar Mesa" : "Gestionar Mesa"}
                    </h3>
                  </div>

                  <form onSubmit={handleSaveTable} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Nombre / Identificador de Mesa</label>
                      <input
                        type="text"
                        required
                        value={tableNameForm}
                        onChange={(e) => setTableNameForm(e.target.value)}
                        placeholder="Ej. Mesa 1, Terraza 5, Barra VIP"
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red/50"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Capacidad (Personas)</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={tableCapacityForm}
                        onChange={(e) => setTableCapacityForm(e.target.value)}
                        placeholder="Ej. 4"
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pizza-red/50"
                      />
                    </div>

                    <button type="submit" className="w-full bg-pizza-red text-white text-xs font-bold py-3 rounded-xl cursor-pointer hover:bg-pizza-red/90 transition-all shadow-md shadow-pizza-red/10">
                      {editingTable ? "Guardar Cambios" : "Agregar Mesa"}
                    </button>
                    {editingTable && (
                      <button type="button" onClick={() => { setEditingTable(null); setTableNameForm(""); setTableCapacityForm("4"); }} className="w-full bg-white/5 border border-white/10 text-white text-xs font-bold py-2 rounded-xl cursor-pointer hover:bg-white/10 transition-all mt-2">
                        Cancelar Edición
                      </button>
                    )}
                  </form>
                </div>

                {/* Tabla de Mesas */}
                <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-4">
                  <h3 className="font-pizza-title font-bold text-sm uppercase text-white/70">Mesas y Estado de Ocupación</h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/5 text-[9px] uppercase font-bold text-white/40 pb-2">
                          <th className="pb-2">ID</th>
                          <th className="pb-2">Nombre</th>
                          <th className="pb-2">Capacidad</th>
                          <th className="pb-2">Estado</th>
                          <th className="pb-2 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {tablesList.map((t) => (
                          <tr key={t.id} className="hover:bg-white/[0.01]">
                            <td className="py-3 font-mono text-white/50">{t.id}</td>
                            <td className="py-3 font-semibold text-white/80">{t.name}</td>
                            <td className="py-3 text-white/60">{t.capacity} personas</td>
                            <td className="py-3">
                              <button 
                                type="button"
                                onClick={() => handleToggleTableStatus(t)}
                                className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase border cursor-pointer transition-colors ${
                                  t.status === "ocupada"
                                    ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/25"
                                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25"
                                }`}
                              >
                                {t.status === "ocupada" ? "Ocupada" : "Libre"}
                              </button>
                            </td>
                            <td className="py-3 text-right">
                              <button
                                type="button"
                                onClick={() => { setEditingTable(t); setTableNameForm(t.name); setTableCapacityForm(t.capacity.toString()); }}
                                className="p-1.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-lg transition-colors cursor-pointer mr-1.5"
                                title="Editar"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTable(t.id, t.name)}
                                className="p-1.5 bg-pizza-red/10 hover:bg-pizza-red/20 text-pizza-red rounded-lg transition-colors cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: CONTACTOS CLIENTES */}
            {activeTab === "contactos" && hasPermission(PERMISSIONS.VER_CLIENTES) && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">Directorio de Clientes Recurrentes</h3>
                  
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Buscador de Clientes */}
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-2.5 text-white/40" size={16} />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, teléfono o dirección..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full bg-[#181818] border border-white/5 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-gold/50"
                      />
                      {customerSearch && (
                        <button
                          onClick={() => setCustomerSearch("")}
                          className="absolute right-2.5 top-2.5 text-white/40 hover:text-white text-xs cursor-pointer"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    <button
                      onClick={handleExportCustomersCSV}
                      className="flex items-center justify-center gap-1.5 bg-[#181818] border border-white/10 hover:bg-white/5 text-xs px-4 py-2.5 rounded-xl cursor-pointer w-full sm:w-auto"
                    >
                      <Download size={14} className="text-[#ffd79b]" />
                      Exportar Directorio (CSV)
                    </button>
                  </div>
                </div>

                <div className="glass-panel overflow-x-auto rounded-3xl border border-white/5 bg-[#121212]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/5 text-[10px] uppercase font-bold text-white/50 tracking-wider">
                        <th className="py-4 px-6">Cliente</th>
                        <th className="py-4 px-6">Teléfono / WhatsApp</th>
                        <th className="py-4 px-6">Dirección de Envío</th>
                        <th className="py-4 px-6">Frecuencia</th>
                        <th className="py-4 px-6">Monto Histórico</th>
                        <th className="py-4 px-6 text-right">Último Pedido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredCustomers.map((c, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-4 px-6 font-bold text-white text-sm">{c.name}</td>
                          <td className="py-4 px-6 font-mono text-white/70">{c.phone}</td>
                          <td className="py-4 px-6 text-white/50 max-w-xs truncate">{c.address}</td>
                          <td className="py-4 px-6 font-bold">{c.totalOrders} pedidos</td>
                          <td className="py-4 px-6 font-bold text-pizza-gold">
                            {formatCurrency(c.totalSpent, businessConfig.currency)}
                          </td>
                          <td className="py-4 px-6 text-white/40 text-right">
                            {c.lastOrderDate ? new Date(c.lastOrderDate.seconds * 1000).toLocaleDateString() : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: GESTION DE PERSONAL */}
            {activeTab === "personal" && hasPermission(PERMISSIONS.VER_PERSONAL) && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
                
                {/* Form Creation */}
                <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-5 h-fit">
                  <div className="flex items-center gap-2 text-pizza-red">
                    <Lock size={18} />
                    <h3 className="font-pizza-title font-bold text-sm uppercase">Registrar Personal</h3>
                  </div>

                  <form onSubmit={handleRegisterStaff} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Correo del Empleado</label>
                      <input
                        type="email"
                        required
                        value={staffEmail}
                        onChange={(e) => setStaffEmail(e.target.value)}
                        placeholder="empleado@pizzeriahub.com"
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Contraseña</label>
                      <input
                        type="password"
                        required
                        value={staffPassword}
                        onChange={(e) => setStaffPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Rol en Pizzería</label>
                      <select
                        value={staffRole}
                        onChange={(e) => setStaffRole(e.target.value)}
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white"
                      >
                        <option value="cashier">Cajero / POS</option>
                        <option value="cook">Cocinero / Producción</option>
                        <option value="admin">Administrador Central</option>
                      </select>
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">
                        Permisos del Personal
                      </label>
                      <div className="bg-[#181818] border border-white/5 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2.5">
                        {Object.entries(PERMISSIONS).map(([key, value]) => {
                          const isChecked = staffPermissions.includes(value);
                          return (
                            <label key={key} className="flex items-center gap-2 text-[10px] text-white/70 hover:text-white cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setStaffPermissions(prev => [...prev, value]);
                                  } else {
                                    setStaffPermissions(prev => prev.filter(p => p !== value));
                                  }
                                }}
                                className="accent-pizza-red cursor-pointer"
                              />
                              <span>{key.replace(/_/g, " ")}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={staffRegistering}
                      className="w-full bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl py-3 font-bold text-xs transition-all cursor-pointer disabled:opacity-40"
                    >
                      {staffRegistering ? "Creando en Auth..." : "Registrar Personal"}
                    </button>
                  </form>
                </div>

                {/* Users List */}
                <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-4">
                  <h3 className="font-pizza-title font-bold text-sm uppercase text-white/70">Equipo y Personal Activo</h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/5 text-[9px] uppercase font-bold text-white/40 pb-2">
                          <th className="pb-2">Email</th>
                          <th className="pb-2">Rol Asignado</th>
                          <th className="pb-2">Estado</th>
                          <th className="pb-2 text-right">Gestión</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {usersList.map((usr) => (
                          <tr key={usr.uid} className="hover:bg-white/[0.01]">
                            <td className="py-3.5 font-semibold text-white/80">{usr.email}</td>
                            <td className="py-3.5">
                              <select
                                value={usr.role}
                                onChange={(e) => handleChangeRole(usr, e.target.value)}
                                className="bg-[#181818] border border-white/5 text-white text-[10px] rounded px-2 py-1 font-bold"
                              >
                                <option value="cashier">Cajero</option>
                                <option value="cook">Cocinero</option>
                                <option value="admin">Admin</option>
                              </select>
                            </td>
                            <td className="py-3.5">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                                usr.disabled 
                                  ? "bg-red-500/10 border-red-500/20 text-red-400" 
                                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              }`}>
                                {usr.disabled ? "Suspendido" : "Activo"}
                              </span>
                            </td>
                            <td className="py-3.5 text-right flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPermissionsUser(usr);
                                  setEditingPermissionsList(usr.permissions || ROLES_PERMISSIONS[usr.role] || []);
                                }}
                                className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#181818] hover:bg-white/5 text-white/80 transition-colors cursor-pointer"
                                title="Personalizar permisos de este usuario"
                              >
                                Permisos 🔐
                              </button>
                              <button
                                onClick={() => handleToggleSuspend(usr)}
                                className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                                  usr.disabled 
                                    ? "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400" 
                                    : "bg-red-500/10 border-red-500/20 hover:bg-red-500/20 text-red-400"
                                }`}
                              >
                                {usr.disabled ? "Habilitar" : "Suspender"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Modal para Editar Permisos Personalizados */}
            {editingPermissionsUser && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="glass-panel max-w-md w-full bg-pizza-dark border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center pb-3 border-b border-white/5">
                    <div className="text-left">
                      <h3 className="font-pizza-title font-bold text-sm uppercase text-white flex items-center gap-2">
                        <span>Editar Permisos 🔐</span>
                      </h3>
                      <p className="text-[10px] text-white/40 mt-0.5">{editingPermissionsUser.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingPermissionsUser(null)}
                      className="p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white cursor-pointer transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-3 text-left">
                    <p className="text-[11px] text-white/60 leading-relaxed">
                      Personaliza los accesos de este usuario sobreescribiendo los permisos por defecto de su rol (<strong>{editingPermissionsUser.role}</strong>).
                    </p>
                    
                    <div className="bg-black/35 border border-white/5 rounded-2xl p-4 max-h-60 overflow-y-auto space-y-3">
                      {Object.entries(PERMISSIONS).map(([key, value]) => {
                        const isChecked = editingPermissionsList.includes(value);
                        return (
                          <label key={key} className="flex items-center gap-3 text-[11px] text-white/70 hover:text-white cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditingPermissionsList(prev => [...prev, value]);
                                } else {
                                  setEditingPermissionsList(prev => prev.filter(p => p !== value));
                                }
                              }}
                              className="accent-pizza-red cursor-pointer scale-105"
                            />
                            <span>{key.replace(/_/g, " ")}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-3 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => setEditingPermissionsUser(null)}
                      className="flex-1 bg-[#1c1c1c] border border-white/10 hover:bg-white/5 text-white rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer text-center"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const userRef = doc(db, "users", editingPermissionsUser.uid);
                          await updateDoc(userRef, { permissions: editingPermissionsList });
                          await logAuditEvent(user.email, "EDITAR_PERMISOS", `Permisos editados para ${editingPermissionsUser.email}`);
                          setEditingPermissionsUser(null);
                          alert("Permisos actualizados con éxito.");
                        } catch (err) {
                          console.error("Error al actualizar permisos:", err);
                          alert("Error al actualizar permisos.");
                        }
                      }}
                      className="flex-1 bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer text-center"
                    >
                      Guardar Permisos
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: ARQUEO DE CAJA */}
            {activeTab === "caja" && hasPermission(PERMISSIONS.VER_CAJA) && (
              <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] text-left max-w-md mx-auto space-y-6">
                <div className="flex items-center gap-2 text-pizza-gold">
                  <DollarSign size={18} />
                  <h3 className="font-pizza-title font-bold text-sm uppercase">Control de Caja Registradora</h3>
                </div>

                {!activeShift ? (
                  // Shift Closed: Form to Open
                  <form onSubmit={handleOpenShift} className="space-y-4">
                    <div className="bg-pizza-red/10 border border-pizza-red/20 rounded-xl p-3.5 text-[11px] text-[#ffd79b] leading-relaxed">
                      ⚠️ <strong>Turno Cerrado.</strong> Registra el saldo inicial en caja (efectivo base) para aperturar un nuevo turno de ventas.
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Monto Inicial en Efectivo</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={cashBase}
                        onChange={(e) => setCashBase(e.target.value)}
                        placeholder="Ej. 100.00"
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-gold"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-pizza-gold text-pizza-dark font-black rounded-xl py-3 text-xs transition-all cursor-pointer hover:bg-[#ffd79b]"
                    >
                      Abrir Turno de Caja
                    </button>
                  </form>
                ) : (
                  // Shift Open: Form to Close
                  <div className="space-y-5">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 text-[11px] text-emerald-400 space-y-1">
                      <p>📢 <strong>Turno Abierto</strong></p>
                      <p><strong>Cajero:</strong> {activeShift.openedBy}</p>
                      <p><strong>Apertura:</strong> {new Date(activeShift.openTime.seconds * 1000).toLocaleString()}</p>
                    </div>

                    {/* Expected dynamic shift calculations */}
                    {(() => {
                      const exp = getShiftExpectedTotals();
                      const totalCashExpected = activeShift.cashBase + exp.cash;
                      return (
                        <div className="space-y-3 pt-2 border-t border-white/5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-white/40">Efectivo Base:</span>
                            <span className="font-bold">{formatCurrency(activeShift.cashBase, businessConfig.currency)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/40">Ventas en Efectivo:</span>
                            <span className="font-bold text-emerald-400">+{formatCurrency(exp.cash, businessConfig.currency)}</span>
                          </div>
                          <div className="flex justify-between border-b border-white/5 pb-2">
                            <span className="text-white/40">Ventas Yape/Transf.:</span>
                            <span className="font-bold text-emerald-400">+{formatCurrency(exp.electronic, businessConfig.currency)}</span>
                          </div>
                          <div className="flex justify-between text-sm font-black text-pizza-gold pt-1">
                            <span>Esperado en Caja:</span>
                            <span>{formatCurrency(totalCashExpected + exp.electronic, businessConfig.currency)}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Close shift form */}
                    <form onSubmit={handleCloseShift} className="space-y-4 pt-4 border-t border-white/5">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">Cierre de Caja (Reporte Z)</h4>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] text-white/40 font-bold mb-1">Efectivo Real</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={actualCash}
                            onChange={(e) => setActualCash(e.target.value)}
                            placeholder="Ej. 150.00"
                            className="w-full bg-[#181818] border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-white/40 font-bold mb-1">Tarjeta / Yape Real</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={actualElectronic}
                            onChange={(e) => setActualElectronic(e.target.value)}
                            placeholder="Ej. 50.00"
                            className="w-full bg-[#181818] border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-pizza-red text-white font-bold rounded-xl py-3 text-xs transition-all cursor-pointer hover:bg-pizza-red/90"
                      >
                        Cerrar Turno (Reporte Z)
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: HISTORIAL DE TURNOS */}
            {activeTab === "turnos" && hasPermission(PERMISSIONS.VER_HISTORIAL_TURNOS) && (
              <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-4 text-left">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                  <h3 className="font-pizza-title font-bold text-sm uppercase text-white/70 flex items-center gap-2">
                    <FileText className="text-pizza-gold" size={18} />
                    Historial de Turnos y Cierres (Reportes Z)
                  </h3>
                  
                  <button
                    onClick={handleExportShiftsCSV}
                    className="flex items-center gap-1.5 bg-[#181818] border border-white/10 hover:bg-white/5 text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-colors animate-fade-in"
                  >
                    <Download size={14} className="text-pizza-gold" />
                    Exportar Reportes Z (CSV)
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-[9px] uppercase font-bold text-white/40 pb-2">
                        <th className="pb-2">Cajero</th>
                        <th className="pb-2">Apertura / Cierre</th>
                        <th className="pb-2">Monto Base</th>
                        <th className="pb-2">Monto Esperado</th>
                        <th className="pb-2">Monto Real</th>
                        <th className="pb-2 text-right">Descuadre</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {shifts.map((s) => {
                        const openDate = s.openTime ? new Date(s.openTime.seconds * 1000).toLocaleString() : "";
                        const closeDate = s.closeTime ? new Date(s.closeTime.seconds * 1000).toLocaleString() : "Turno Activo";
                        const totalExpected = (s.expectedCash || 0) + (s.expectedElectronic || 0);
                        const totalActual = (s.actualCash || 0) + (s.actualElectronic || 0);
                        return (
                          <tr key={s.id} className="hover:bg-white/[0.01]">
                            <td className="py-3 font-semibold text-white/80">{s.openedBy}</td>
                            <td className="py-3 text-[10px]">
                              <span className="block text-emerald-400">A: {openDate}</span>
                              {s.closeTime && <span className="block text-white/40">C: {closeDate}</span>}
                            </td>
                            <td className="py-3">{formatCurrency(s.cashBase, businessConfig.currency)}</td>
                            <td className="py-3">{s.status === "open" ? "Abierto" : formatCurrency(totalExpected, businessConfig.currency)}</td>
                            <td className="py-3">{s.status === "open" ? "Abierto" : formatCurrency(totalActual, businessConfig.currency)}</td>
                            <td className={`py-3 text-right font-bold ${
                              s.discrepancy < 0 ? "text-pizza-red" : 
                              s.discrepancy > 0 ? "text-emerald-400" : "text-white/60"
                            }`}>
                              {s.status === "open" ? "-" : formatCurrency(s.discrepancy, businessConfig.currency)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: AUDITORIA LOGS */}
            {activeTab === "auditoria" && hasPermission(PERMISSIONS.VER_AUDITORIA) && (
              <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-4 text-left">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                  <h3 className="font-pizza-title font-bold text-sm uppercase text-white/70 flex items-center gap-2">
                    <ShieldAlert className="text-pizza-red" size={18} />
                    Bitácora de Auditoría en Tiempo Real
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {/* Buscador de Logs */}
                    <div className="relative w-full sm:w-60">
                      <Search className="absolute left-3 top-2.5 text-white/40" size={16} />
                      <input
                        type="text"
                        placeholder="Buscar por usuario o detalle..."
                        value={auditSearch}
                        onChange={(e) => setAuditSearch(e.target.value)}
                        className="w-full bg-[#181818] border border-white/5 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red/50"
                      />
                      {auditSearch && (
                        <button
                          onClick={() => setAuditSearch("")}
                          className="absolute right-2.5 top-2.5 text-white/40 hover:text-white text-xs cursor-pointer"
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {/* Selector de Acciones */}
                    <select
                      value={auditActionFilter}
                      onChange={(e) => setAuditActionFilter(e.target.value)}
                      className="bg-[#181818] border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pizza-red/50 w-full sm:w-auto font-mono text-[10px]"
                    >
                      <option value="all">Todas las acciones</option>
                      {auditActions.filter(act => act !== "all").map(act => (
                        <option key={act} value={act}>{act}</option>
                      ))}
                    </select>

                    <span className="text-[10px] text-white/40 font-semibold bg-white/5 px-2.5 py-2 rounded-xl hidden sm:inline-block">Monitoreo</span>
                    <button
                      onClick={handleExportAuditCSV}
                      className="flex items-center gap-1.5 bg-[#181818] border border-white/10 hover:bg-white/5 text-xs px-3.5 py-2 rounded-xl cursor-pointer transition-colors"
                    >
                      <Download size={14} className="text-pizza-gold" />
                      Exportar (CSV)
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                  {filteredAuditLogs.length === 0 ? (
                    <p className="text-center text-xs text-white/30 py-10">
                      {auditSearch || auditActionFilter !== "all" 
                        ? "Ningún evento coincide con los filtros de búsqueda." 
                        : "Sin eventos de auditoría registrados"}
                    </p>
                  ) : (
                    filteredAuditLogs.map((log) => {
                      const logDate = log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString() : "";
                      const isAlertAction = log.action?.includes("ELIMINAR") || log.action?.includes("SUSPENDER") || log.action?.includes("RECHAZAR");
                      return (
                        <div key={log.id} className="bg-[#181818] border border-white/5 rounded-xl p-3.5 flex justify-between items-start gap-4 text-xs hover:border-white/10 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase ${
                                isAlertAction 
                                  ? "bg-pizza-red/10 border-pizza-red/25 text-pizza-red animate-pulse-soft" 
                                  : "bg-pizza-gold/10 border-pizza-gold/25 text-pizza-gold"
                              }`}>
                                {log.action}
                              </span>
                              <span className="font-bold text-white/80">{log.userEmail}</span>
                            </div>
                            <p className="text-white/60">{log.details}</p>
                          </div>
                          <span className="text-[10px] text-white/30 font-mono shrink-0">{logDate}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: TIENDA ONLINE */}
            {activeTab === "tienda" && hasPermission(PERMISSIONS.CONFIGURAR_TIENDA) && (
              <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] text-left max-w-2xl mx-auto space-y-6">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Globe size={18} />
                  <h3 className="font-pizza-title font-bold text-sm uppercase">Parámetros de Tienda Online</h3>
                </div>

                <form onSubmit={handleSaveStoreStatus} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">Mensaje de Mantenimiento / Cierre de Tienda</label>
                    <textarea
                      value={storeStatusForm.maintenanceMessage}
                      onChange={(e) => setStoreStatusForm(prev => ({ ...prev, maintenanceMessage: e.target.value }))}
                      placeholder="Ej. 'Cerrado temporalmente por mantenimiento.' Dejar vacío para abrir tienda al público."
                      rows="2"
                      className="w-full bg-[#181818] border border-white/5 rounded-xl p-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-400"
                    />
                    <p className="text-[9px] text-white/40">Si el mensaje contiene texto, la tienda web mostrará el mensaje y bloqueará los pedidos.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Latitud GPS de Tienda</label>
                      <input
                        type="number"
                        step="0.000001"
                        required
                        value={storeStatusForm.baseLat}
                        onChange={(e) => setStoreStatusForm(prev => ({ ...prev, baseLat: e.target.value }))}
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Longitud GPS de Tienda</label>
                      <input
                        type="number"
                        step="0.000001"
                        required
                        value={storeStatusForm.baseLng}
                        onChange={(e) => setStoreStatusForm(prev => ({ ...prev, baseLng: e.target.value }))}
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>

                  {/* Mapa para ubicación de local */}
                  {hasMapboxToken && (
                    <div className="space-y-3 border-t border-white/5 pt-4">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">Ubicación del Local en Mapa</label>
                      
                      {/* Buscador de dirección */}
                      <div className="relative">
                        <input
                          type="text"
                          value={adminMapSearch}
                          onChange={handleAdminSearchChange}
                          placeholder="Busca la dirección de tu local para ubicarlo..."
                          className="w-full bg-[#181818] border border-white/5 rounded-xl px-4 py-2.5 pl-10 text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-400"
                        />
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
                          {loadingAdminMap ? (
                            <Loader2 size={14} className="animate-spin text-emerald-400" />
                          ) : (
                            <Search size={14} />
                          )}
                        </div>
                        {adminMapSearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdminMapSearch("");
                              setAdminMapSuggestions([]);
                              setIsAdminMapSearchOpen(false);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs cursor-pointer"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {/* Lista de sugerencias */}
                      {isAdminMapSearchOpen && (adminMapSuggestions.length > 0 || loadingAdminMap) && (
                        <div className="relative">
                          <div className="absolute z-50 w-full bg-[#181818] border border-white/10 rounded-xl shadow-2xl max-h-40 overflow-y-auto overflow-x-hidden backdrop-blur-xl">
                            {loadingAdminMap && adminMapSuggestions.length === 0 ? (
                              <div className="p-3 text-center text-[10px] text-white/50 flex items-center justify-center gap-1.5">
                                <Loader2 size={12} className="animate-spin text-pizza-gold" />
                                Buscando...
                              </div>
                            ) : (
                              <ul className="py-1">
                                {adminMapSuggestions.map((suggestion) => (
                                  <li
                                    key={suggestion.id}
                                    onClick={() => handleSelectAdminSuggestion(suggestion)}
                                    className="flex items-start gap-2 px-3.5 py-2 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 transition-colors text-xs text-left"
                                  >
                                    <MapPin size={12} className="text-pizza-gold shrink-0 mt-0.5" />
                                    <span className="text-white text-left line-clamp-2">
                                      {suggestion.placeName}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Contenedor del mapa */}
                      <div className="space-y-1">
                        <div 
                          ref={adminMapContainerRef} 
                          className="w-full h-48 rounded-2xl border border-white/5 relative overflow-hidden bg-black/40"
                          style={{ minHeight: "180px" }}
                        />
                        <div className="flex items-center gap-1.5 text-[9px] text-white/40 px-1">
                          <Info size={9} className="text-pizza-gold" />
                          <span>Puedes hacer clic en el mapa o arrastrar la pizza para fijar la ubicación exacta.</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Costo por KM Recorrido ({businessConfig.currency})</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={storeStatusForm.deliveryCostPerKm}
                        onChange={(e) => setStoreStatusForm(prev => ({ ...prev, deliveryCostPerKm: e.target.value }))}
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Radio de Entrega Máximo (KM)</label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={storeStatusForm.deliveryRange}
                        onChange={(e) => setStoreStatusForm(prev => ({ ...prev, deliveryRange: e.target.value }))}
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl py-3.5 text-xs transition-all cursor-pointer"
                  >
                    Guardar Parámetros de la Tienda
                  </button>
                </form>
              </div>
            )}

            {/* TAB CONTENT: CONFIGURACION GENERAL */}
            {activeTab === "configuracion" && hasPermission(PERMISSIONS.CONFIGURAR_TIENDA) && settingsForm && (
              <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] text-left max-w-2xl mx-auto space-y-6">
                <div className="flex items-center gap-2 text-pizza-gold">
                  <Settings size={18} />
                  <h3 className="font-pizza-title font-bold text-sm uppercase">Configuración Comercial de Facturación</h3>
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Nombre del Negocio</label>
                      <input
                        type="text"
                        required
                        value={settingsForm.name}
                        onChange={(e) => setSettingsForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">WhatsApp Despacho</label>
                      <input
                        type="text"
                        required
                        value={settingsForm.whatsappNumber}
                        onChange={(e) => setSettingsForm(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Logo del Negocio</label>
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                      <div className="flex-1 w-full space-y-2">
                        <div className="flex gap-3 items-center">
                          <input
                            type="text"
                            placeholder="URL del logo o sube un archivo..."
                            value={settingsForm.logoUrl || ""}
                            onChange={(e) => setSettingsForm(prev => ({ ...prev, logoUrl: e.target.value }))}
                            className="flex-1 bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pizza-gold/50"
                          />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                            id="logo-file-input"
                            disabled={uploadingLogo}
                          />
                          <label
                            htmlFor="logo-file-input"
                            className="bg-[#181818] border border-white/10 hover:bg-white/5 text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5"
                          >
                            {uploadingLogo ? (
                              <>
                                <Loader2 size={14} className="animate-spin text-pizza-red" />
                                Subiendo...
                              </>
                            ) : (
                              <>
                                <Download size={14} className="text-[#ffd79b] rotate-180" />
                                Subir Archivo
                              </>
                            )}
                          </label>
                        </div>
                        {uploadLogoError && (
                          <p className="text-[10px] text-red-500 font-medium">{uploadLogoError}</p>
                        )}
                      </div>
                      {settingsForm.logoUrl && (
                        <div className="w-16 h-16 rounded-2xl bg-pizza-dark overflow-hidden shrink-0 border border-white/10 flex items-center justify-center shadow-lg">
                          <img 
                            src={settingsForm.logoUrl} 
                            alt="Logo preview" 
                            className="w-full h-full object-cover" 
                            onError={(e) => { e.target.src = '/pwa-192x192.png'; }} 
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">QR de Yape / Plin (Método de Pago)</label>
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                      <div className="flex-1 w-full space-y-2">
                        <div className="flex gap-3 items-center">
                          <input
                            type="text"
                            placeholder="URL del QR o sube un archivo..."
                            value={settingsForm.yapeQrUrl || ""}
                            onChange={(e) => setSettingsForm(prev => ({ ...prev, yapeQrUrl: e.target.value }))}
                            className="flex-1 bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pizza-gold/50"
                          />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleQrUpload}
                            className="hidden"
                            id="qr-file-input"
                            disabled={uploadingQr}
                          />
                          <label
                            htmlFor="qr-file-input"
                            className="bg-[#181818] border border-white/10 hover:bg-white/5 text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5"
                          >
                            {uploadingQr ? (
                              <>
                                <Loader2 size={14} className="animate-spin text-pizza-red" />
                                Subiendo...
                              </>
                            ) : (
                              <>
                                <Download size={14} className="text-[#ffd79b] rotate-180" />
                                Subir Archivo
                              </>
                            )}
                          </label>
                        </div>
                        {uploadQrError && (
                          <p className="text-[10px] text-red-500 font-medium">{uploadQrError}</p>
                        )}
                      </div>
                      {settingsForm.yapeQrUrl && (
                        <div className="w-16 h-16 rounded-2xl bg-white overflow-hidden shrink-0 border border-white/10 flex items-center justify-center shadow-lg p-1">
                          <img 
                            src={settingsForm.yapeQrUrl} 
                            alt="QR preview" 
                            className="w-full h-full object-contain" 
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Dirección de Sede Central</label>
                    <input
                      type="text"
                      required
                      value={settingsForm.address}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Moneda (ISO)</label>
                      <input
                        type="text"
                        required
                        value={settingsForm.currency}
                        onChange={(e) => setSettingsForm(prev => ({ ...prev, currency: e.target.value }))}
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Nombre Impuesto (IGV / IVA)</label>
                      <input
                        type="text"
                        required
                        value={settingsForm.tax.taxName}
                        onChange={(e) => setSettingsForm(prev => ({ ...prev, tax: { ...prev.tax, taxName: e.target.value } }))}
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Tasa del Impuesto (%)</label>
                      <input
                        type="number"
                        required
                        value={settingsForm.tax.taxRate}
                        onChange={(e) => setSettingsForm(prev => ({ ...prev, tax: { ...prev.tax, taxRate: parseFloat(e.target.value || "0") } }))}
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Impuesto Activo</label>
                      <select
                        value={settingsForm.tax.taxEnabled.toString()}
                        onChange={(e) => setSettingsForm(prev => ({ ...prev, tax: { ...prev.tax, taxEnabled: e.target.value === "true" } }))}
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white"
                      >
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Incluido en Precio</label>
                      <select
                        value={settingsForm.tax.taxIncluded.toString()}
                        onChange={(e) => setSettingsForm(prev => ({ ...prev, tax: { ...prev.tax, taxIncluded: e.target.value === "true" } }))}
                        className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white"
                      >
                        <option value="true">Sí (Included)</option>
                        <option value="false">No (Adicionado)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-pizza-gold text-pizza-dark font-black rounded-xl py-3.5 text-xs transition-all cursor-pointer hover:bg-[#ffd79b]"
                  >
                    Guardar Configuración General
                  </button>
                </form>
              </div>
            )}

            {/* TAB CONTENT: SEO TAB */}
            {activeTab === "seo" && hasPermission(PERMISSIONS.CONFIGURAR_TIENDA) && (
              <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] text-left max-w-2xl mx-auto space-y-6">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Globe size={18} />
                  <h3 className="font-pizza-title font-bold text-sm uppercase">Optimización SEO (Google Meta-Tags)</h3>
                </div>

                <form onSubmit={handleSaveSeo} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Meta Título de Buscadores (Google)</label>
                    <input
                      type="text"
                      required
                      value={seoForm.metaTitle}
                      onChange={(e) => setSeoForm(prev => ({ ...prev, metaTitle: e.target.value }))}
                      placeholder={`Ej. '${businessConfig.name || "Pizza Hub"} - Las mejores pizzas artesanales a la leña'`}
                      className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Meta Descripción del Sitio Web</label>
                    <textarea
                      required
                      value={seoForm.metaDescription}
                      onChange={(e) => setSeoForm(prev => ({ ...prev, metaDescription: e.target.value }))}
                      placeholder="Meta descripción de hasta 160 caracteres para Google."
                      rows="3"
                      className="w-full bg-[#181818] border border-white/5 rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Palabras Clave (SEO Keywords)</label>
                    <input
                      type="text"
                      value={seoForm.keywords}
                      onChange={(e) => setSeoForm(prev => ({ ...prev, keywords: e.target.value }))}
                      placeholder="pizzas, delivery de pizza, trufa, artesanal (separadas por comas)"
                      className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl py-3.5 text-xs transition-all cursor-pointer"
                  >
                    Guardar Parámetros SEO
                  </button>
                </form>
              </div>
            )}

            {/* TAB CONTENT: MARKETING */}
            {activeTab === "marketing" && hasPermission(PERMISSIONS.CONFIGURAR_TIENDA) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
                
                {/* Coupon Manager */}
                <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-5">
                  <div className="flex items-center gap-2 text-pizza-red">
                    <Percent size={18} />
                    <h3 className="font-pizza-title font-bold text-sm uppercase">Cupones de Descuento</h3>
                  </div>

                  <form onSubmit={handleAddCoupon} className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={marketingForm.couponCode}
                      onChange={(e) => setMarketingForm(prev => ({ ...prev, couponCode: e.target.value }))}
                      placeholder="CÓDIGO (Ej. LUNES30)"
                      className="flex-1 bg-[#181818] border border-white/5 rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none"
                    />
                    <input
                      type="number"
                      required
                      value={marketingForm.couponDiscount}
                      onChange={(e) => setMarketingForm(prev => ({ ...prev, couponDiscount: e.target.value }))}
                      placeholder="%"
                      className="w-16 bg-[#181818] border border-white/5 rounded-xl px-2 py-2 text-xs text-white text-center focus:outline-none"
                    />
                    <button type="submit" className="bg-pizza-red text-white text-xs font-bold px-4 rounded-xl cursor-pointer">
                      Agregar
                    </button>
                  </form>

                  <div className="divide-y divide-white/5 max-h-60 overflow-y-auto pr-1">
                    {Object.entries(businessConfig.discounts?.coupons || {}).map(([code, discount]) => (
                      <div key={code} className="py-2.5 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-mono font-bold text-white bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[10px]">
                            {code}
                          </span>
                          <span className="ml-2 font-semibold text-white/70">Descuento: {discount}%</span>
                        </div>
                        <button
                          onClick={() => handleDeleteCoupon(code)}
                          className="text-[10px] font-bold text-pizza-red hover:underline cursor-pointer"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Auto Discounts Manager */}
                <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-5">
                  <div className="flex items-center gap-2 text-pizza-gold">
                    <Percent size={18} />
                    <h3 className="font-pizza-title font-bold text-sm uppercase">Reglas de Descuento Progresivo</h3>
                  </div>

                  <form onSubmit={handleAddAutoDiscount} className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={marketingForm.minAmountDiscount}
                      onChange={(e) => setMarketingForm(prev => ({ ...prev, minAmountDiscount: e.target.value }))}
                      placeholder="Monto Mínimo (USD)"
                      className="flex-1 bg-[#181818] border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                    <input
                      type="number"
                      required
                      value={marketingForm.discountPercentRule}
                      onChange={(e) => setMarketingForm(prev => ({ ...prev, discountPercentRule: e.target.value }))}
                      placeholder="Descuento %"
                      className="w-24 bg-[#181818] border border-white/5 rounded-xl px-2 py-2 text-xs text-white text-center focus:outline-none"
                    />
                    <button type="submit" className="bg-pizza-gold text-pizza-dark text-xs font-black px-4 rounded-xl cursor-pointer">
                      Agregar
                    </button>
                  </form>

                  <div className="divide-y divide-white/5 max-h-60 overflow-y-auto pr-1">
                    {(businessConfig.discounts?.autoDiscounts || []).map((rule, idx) => (
                      <div key={idx} className="py-2.5 flex justify-between items-center text-xs">
                        <span className="font-semibold text-white/70">
                          Compras de +{formatCurrency(rule.minAmount, businessConfig.currency)}: <strong className="text-pizza-gold">-{rule.discountPercent}% OFF</strong>
                        </span>
                        <button
                          onClick={() => handleDeleteAutoDiscount(idx)}
                          className="text-[10px] font-bold text-pizza-red hover:underline cursor-pointer"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: EVENTOS & MARKETING */}
            {activeTab === "eventos" && hasPermission(PERMISSIONS.CONFIGURAR_TIENDA) && (
              <div className="space-y-6">
                {/* Selector de sub-vistas */}
                <div className="flex justify-between items-center bg-[#121212] p-3.5 rounded-2xl border border-white/5 text-left">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEventTabSubView("lista_eventos")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 ${
                        eventTabSubView === "lista_eventos"
                          ? "bg-pizza-red text-white shadow-md shadow-pizza-red/15"
                          : "bg-white/5 text-white/60 hover:text-white"
                      }`}
                    >
                      Eventos Configurados
                    </button>
                    <button
                      onClick={() => setEventTabSubView("registros")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 ${
                        eventTabSubView === "registros"
                          ? "bg-pizza-red text-white shadow-md shadow-pizza-red/15"
                          : "bg-white/5 text-white/60 hover:text-white"
                      }`}
                    >
                      Pre-registros de Asistencia ({eventRegistrations.length})
                    </button>
                  </div>
                  
                  {eventTabSubView === "lista_eventos" ? (
                    <button
                      onClick={() => {
                        setCrudEvent(null);
                        setEventForm({
                          title: "",
                          description: "",
                          date: "",
                          time: "",
                          couponCode: "",
                          discountPercent: "15",
                          active: true,
                          bannerUrl: ""
                        });
                        setIsEventModalOpen(true);
                      }}
                      className="bg-pizza-gold text-pizza-dark hover:bg-pizza-gold/95 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-pizza-gold/15 border-0"
                    >
                      <Plus size={14} />
                      Crear Evento
                    </button>
                  ) : (
                    <button
                      onClick={handleExportRegistrationsCSV}
                      disabled={eventRegistrations.length === 0}
                      className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/15 border-0"
                    >
                      <Download size={14} />
                      Exportar CSV
                    </button>
                  )}
                </div>

                {/* Subvista: Lista de Eventos */}
                {eventTabSubView === "lista_eventos" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                    {eventsList.length === 0 ? (
                      <div className="col-span-full py-16 text-center text-white/40 text-xs italic bg-white/5 border border-dashed border-white/10 rounded-3xl">
                        No hay eventos creados todavía. Haz clic en "Crear Evento" para empezar.
                      </div>
                    ) : (
                      eventsList.map((event) => (
                        <div
                          key={event.id}
                          className={`relative rounded-3xl overflow-hidden border p-5 bg-gradient-to-br from-[#1c1c1c] to-[#121212] transition-all flex flex-col justify-between min-h-[220px] ${
                            event.active ? "border-pizza-gold/20 shadow-md shadow-pizza-gold/5" : "border-white/5 opacity-60"
                          }`}
                        >
                          {event.bannerUrl && (
                            <div 
                              className="absolute inset-0 bg-cover bg-center opacity-10 filter blur-xs pointer-events-none" 
                              style={{ backgroundImage: `url(${event.bannerUrl})` }} 
                            />
                          )}
                          
                          <div className="relative space-y-2.5">
                            <div className="flex justify-between items-center">
                              <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                event.active 
                                  ? "bg-green-500/10 text-green-400 border border-green-500/20" 
                                  : "bg-white/10 text-white/40 border border-white/5"
                              }`}>
                                {event.active ? "Activo" : "Borrador"}
                              </span>
                              <span className="text-[10px] text-white/50 font-semibold flex items-center gap-1">
                                📅 {event.date} | ⏰ {event.time}
                              </span>
                            </div>
                            
                            <div>
                              <h4 className="font-pizza-title text-base font-bold text-white leading-tight">
                                {event.title}
                              </h4>
                              <p className="text-[11px] text-white/60 line-clamp-3 mt-1 font-sans">
                                {event.description}
                              </p>
                            </div>
                            
                            {event.couponCode && (
                              <div className="bg-pizza-gold/10 border border-pizza-gold/25 rounded-xl p-2.5 flex justify-between items-center text-[10px]">
                                <span className="text-pizza-gold font-bold">🎟️ Cupón: {event.couponCode}</span>
                                <span className="text-white/70 font-semibold">{event.discountPercent}% Descuento</span>
                              </div>
                            )}
                          </div>

                          <div className="relative mt-4 pt-3.5 border-t border-white/5 flex justify-end gap-2 shrink-0">
                            <button
                              onClick={() => {
                                setCrudEvent(event);
                                setEventForm({
                                  title: event.title,
                                  description: event.description,
                                  date: event.date,
                                  time: event.time,
                                  couponCode: event.couponCode || "",
                                  discountPercent: event.discountPercent || "15",
                                  active: event.active !== false,
                                  bannerUrl: event.bannerUrl || ""
                                });
                                setIsEventModalOpen(true);
                              }}
                              className="bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors border-0 cursor-pointer"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteEvent(event.id, event.title)}
                              className="bg-pizza-red/10 border border-pizza-red/20 text-pizza-red hover:bg-pizza-red/20 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer border-0"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Subvista: Pre-registros */}
                {eventTabSubView === "registros" && (
                  <div className="glass-panel p-5 rounded-3xl border border-white/5 bg-[#121212] overflow-hidden text-left space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white/55 font-pizza-title">Lista General de Clientes Pre-registrados</h4>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-white/5 bg-black/20">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/5 text-white/40 uppercase text-[9px] tracking-wider font-extrabold">
                            <th className="px-4 py-3">Fecha</th>
                            <th className="px-4 py-3">Evento</th>
                            <th className="px-4 py-3">Cliente</th>
                            <th className="px-4 py-3">WhatsApp / Teléfono</th>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Cupón</th>
                            <th className="px-4 py-3 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-sans">
                          {eventRegistrations.length === 0 ? (
                            <tr>
                              <td colSpan="7" className="px-4 py-12 text-center text-white/30 italic">
                                No hay pre-registros de asistencia cargados en el sistema.
                              </td>
                            </tr>
                          ) : (
                            eventRegistrations.map((reg) => {
                              const regDate = reg.registeredAt ? new Date(reg.registeredAt.seconds * 1000).toLocaleString() : "";
                              return (
                                <tr key={reg.id} className="hover:bg-white/5 transition-colors">
                                  <td className="px-4 py-3 whitespace-nowrap text-white/50">{regDate}</td>
                                  <td className="px-4 py-3 font-semibold text-white">{reg.eventTitle}</td>
                                  <td className="px-4 py-3 font-bold text-pizza-gold">{reg.name}</td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <a
                                      href={`https://wa.me/${reg.phone.replace(/[^0-9]/g, "")}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-green-400 hover:underline flex items-center gap-1"
                                    >
                                      💬 {reg.phone}
                                    </a>
                                  </td>
                                  <td className="px-4 py-3 text-white/70">{reg.email}</td>
                                  <td className="px-4 py-3">
                                    <span className="bg-pizza-gold/10 text-pizza-gold border border-pizza-gold/20 px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                                      {reg.couponCode || "NINGUNO"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      onClick={() => handleDeleteRegistration(reg.id, reg.name)}
                                      className="text-pizza-red hover:text-red-400 font-bold hover:underline bg-transparent border-0 cursor-pointer"
                                    >
                                      Eliminar
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL DE CRUD PRODUCTOS (INVENTARIO) */}
      {isCrudModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#181818] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-left">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className="font-pizza-title text-sm font-bold uppercase text-white/70">
                {crudProduct ? `Editar Producto: ${crudProduct.name}` : "Agregar Nuevo Producto"}
              </h3>
              <button onClick={() => setIsCrudModalOpen(false)} className="p-1 rounded-full hover:bg-white/5 text-white/60 hover:text-white">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Nombre del Producto</label>
                  <input
                    type="text"
                    required
                    value={crudForm.name}
                    onChange={(e) => setCrudForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej. Pizza Pepperoni Real"
                    className="w-full bg-[#101010] border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">ID (Opcional)</label>
                  <input
                    type="text"
                    disabled={!!crudProduct}
                    value={crudForm.id}
                    onChange={(e) => setCrudForm(prev => ({ ...prev, id: e.target.value }))}
                    placeholder="Ej. pepperoni-real"
                    className="w-full bg-[#101010] border border-white/5 rounded-xl px-3 py-2 text-xs text-white disabled:opacity-40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-5 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Categoría</label>
                  <select
                    value={crudForm.category}
                    onChange={(e) => setCrudForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-[#101010] border border-white/5 rounded-xl px-2 py-2 text-[11px] text-white"
                  >
                    {categoriesListToUse.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Precio Base</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={crudForm.price}
                    onChange={(e) => setCrudForm(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="Ej. 18.00"
                    className="w-full bg-[#101010] border border-white/5 rounded-xl px-2 py-2 text-[11px] text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Dcto %</label>
                  <input
                    type="number"
                    value={crudForm.discount}
                    onChange={(e) => setCrudForm(prev => ({ ...prev, discount: e.target.value }))}
                    placeholder="0"
                    className="w-full bg-[#101010] border border-white/5 rounded-xl px-2 py-2 text-[11px] text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Costo COGS</label>
                  <input
                    type="number"
                    step="0.01"
                    value={crudForm.cost}
                    onChange={(e) => setCrudForm(prev => ({ ...prev, cost: e.target.value }))}
                    placeholder="Ej. 5.00"
                    className="w-full bg-[#101010] border border-white/5 rounded-xl px-2 py-2 text-[11px] text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Stock</label>
                  <input
                    type="number"
                    required
                    value={crudForm.stock}
                    onChange={(e) => setCrudForm(prev => ({ ...prev, stock: e.target.value }))}
                    placeholder="50"
                    className="w-full bg-[#101010] border border-white/5 rounded-xl px-2 py-2 text-[11px] text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Imagen del Producto</label>
                <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                  <input
                    type="text"
                    value={crudForm.imageUrl}
                    onChange={(e) => setCrudForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                    placeholder="Enlace de imagen o selecciona un archivo"
                    className="flex-1 bg-[#101010] border border-white/5 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <label className="bg-pizza-gold text-pizza-dark hover:bg-[#ffd79b] text-xs font-black px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 text-center select-none">
                    {uploadingImage ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Subiendo...
                      </>
                    ) : (
                      "Subir Archivo"
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingImage}
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                {uploadError && <p className="text-pizza-red text-[10px] mt-1 font-semibold">{uploadError}</p>}
                {crudForm.imageUrl && (
                  <div className="mt-2 w-20 h-20 rounded-xl bg-pizza-dark overflow-hidden border border-white/10 relative group">
                    <img src={crudForm.imageUrl} alt="Vista previa del producto" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Descripción</label>
                <textarea
                  value={crudForm.description}
                  onChange={(e) => setCrudForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detalle e ingredientes del producto..."
                  rows="2"
                  className="w-full bg-[#101010] border border-white/5 rounded-xl p-3 text-xs text-white"
                />
              </div>

              {/* Selector de modo de edición (Visual vs. Texto Raw) */}
              <div className="flex justify-between items-center border-t border-white/5 pt-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Opciones y Combos</span>
                <div className="flex bg-black/40 rounded-xl p-0.5 border border-white/5">
                  <button
                    type="button"
                    onClick={() => setEditorMode("visual")}
                    className={`text-[9px] font-extrabold uppercase px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                      editorMode === "visual"
                        ? "bg-pizza-gold text-pizza-dark font-black"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    Constructor Visual
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode("text")}
                    className={`text-[9px] font-extrabold uppercase px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                      editorMode === "text"
                        ? "bg-pizza-gold text-pizza-dark font-black"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    Editor Texto (Raw)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editorMode === "visual" ? (
                  <>
                    {/* Opciones y Tamaños (Constructor Visual) */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Opciones y Tamaños</label>
                      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {visualOptions.map((group) => (
                          <div key={group.id} className="bg-pizza-dark/40 border border-white/5 rounded-2xl p-3.5 space-y-2 text-left">
                            <div className="flex justify-between items-center gap-2">
                              <input
                                type="text"
                                value={group.name}
                                onChange={(e) => handleUpdateGroupName(group.id, e.target.value)}
                                className="bg-transparent border-b border-white/10 focus:border-pizza-gold text-[11px] font-black uppercase text-[#ffd79b] w-2/3 focus:outline-none py-0.5"
                                placeholder="Grupo (ej. Tamaño)"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveOptionGroup(group.id)}
                                className="text-white/30 hover:text-pizza-red p-1 rounded-lg hover:bg-white/5 transition-colors"
                                title="Eliminar Grupo"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            
                            {/* Pills container */}
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {group.values.map((val, valIdx) => (
                                <span key={valIdx} className="inline-flex items-center gap-1 bg-white/5 border border-white/5 text-[10px] text-white/80 px-2.5 py-1 rounded-full font-medium">
                                  {val}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOptionValue(group.id, valIdx)}
                                    className="text-white/40 hover:text-white font-bold ml-0.5 text-xs hover:scale-110 active:scale-95 transition-all"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                              {group.values.length === 0 && (
                                <span className="text-[10px] text-white/20 italic">Sin opciones asignadas</span>
                              )}
                            </div>

                            {/* Input para agregar opción rápida */}
                            <div className="flex gap-1.5 mt-2">
                              <input
                                type="text"
                                placeholder="Ej. Mediana o Familiar (+ $5.00)"
                                className="flex-1 bg-[#101010] border border-white/5 rounded-lg px-2.5 py-1 text-[10px] text-white focus:outline-none"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddOptionValue(group.id, e.target.value);
                                    e.target.value = "";
                                  }
                                }}
                                id={`new-opt-val-${group.id}`}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const input = document.getElementById(`new-opt-val-${group.id}`);
                                  if (input) {
                                    handleAddOptionValue(group.id, input.value);
                                    input.value = "";
                                  }
                                }}
                                className="bg-pizza-gold/20 text-[#ffd79b] hover:bg-pizza-gold/30 text-[10px] px-2.5 py-1 rounded-lg font-bold"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                        
                        <button
                          type="button"
                          onClick={handleAddOptionGroup}
                          className="w-full border border-dashed border-white/10 hover:border-white/25 text-white/50 hover:text-white/80 text-[10px] py-2 rounded-xl transition-all font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Plus size={12} />
                          Agregar Grupo de Opciones
                        </button>
                      </div>
                    </div>

                    {/* Ítems de Combo (Constructor Visual) */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Ítems del Combo</label>
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {visualCombos.map((combo) => (
                          <div key={combo.id} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={combo.value}
                              onChange={(e) => handleUpdateComboItem(combo.id, e.target.value)}
                              className="flex-1 bg-[#101010] border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-gold/50"
                              placeholder="Ej. Pizza 1 (Margherita/Diavola)"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveComboItem(combo.id)}
                              className="text-white/30 hover:text-pizza-red p-2.5 rounded-xl hover:bg-white/5 transition-colors shrink-0"
                              title="Eliminar Ítem"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        {visualCombos.length === 0 && (
                          <p className="text-[10px] text-white/20 italic text-center py-6">Este producto no es un combo</p>
                        )}
                        
                        <button
                          type="button"
                          onClick={handleAddComboItem}
                          className="w-full border border-dashed border-white/10 hover:border-white/25 text-white/50 hover:text-white/80 text-[10px] py-2 rounded-xl transition-all font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Plus size={12} />
                          Agregar Ítem al Combo
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Opciones y Tamaños (Formato Grupo: val1, val2)</label>
                      <textarea
                        value={crudForm.optionsText}
                        onChange={(e) => setCrudForm(prev => ({ ...prev, optionsText: e.target.value }))}
                        placeholder="Tamaño: Mediana, Familiar (+ $5.00)&#10;Masa: Tradicional, Fina, Borde Queso"
                        rows="6"
                        className="w-full bg-[#101010] border border-white/5 rounded-xl p-3 text-[10px] text-white font-mono leading-relaxed"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Ítems de Combo (Una opción por línea)</label>
                      <textarea
                        value={crudForm.comboItemsText}
                        onChange={(e) => setCrudForm(prev => ({ ...prev, comboItemsText: e.target.value }))}
                        placeholder="Pizza 1 (Margherita/Diavola)&#10;Pizza 2 (Margherita/Diavola)&#10;Bebida 1.5L"
                        rows="6"
                        className="w-full bg-[#101010] border border-white/5 rounded-xl p-3 text-[10px] text-white font-mono leading-relaxed"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="pt-4 border-t border-white/5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCrudModalOpen(false)}
                  className="bg-white/5 hover:bg-white/10 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-pizza-red hover:bg-pizza-red/90 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-pizza-red/10"
                >
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE REGISTRO DE EGRESOS (GASTOS) */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#181818] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col text-left animate-in fade-in zoom-in-95 duration-250">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className="font-pizza-title text-sm font-bold uppercase text-white/70 flex items-center gap-2">
                <TrendingUp size={16} className="text-pizza-red rotate-180" />
                Registrar Nuevo Gasto / Egreso
              </h3>
              <button 
                onClick={() => setIsExpenseModalOpen(false)} 
                className="p-1 rounded-full hover:bg-white/5 text-white/60 hover:text-white cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Descripción del Gasto</label>
                <input
                  type="text"
                  required
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Ej. Compra de 20kg de queso mozzarella"
                  className="w-full bg-[#101010] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red/50 focus:ring-1 focus:ring-pizza-red/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5 font-sans">Monto del Egreso ({businessConfig.currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="Ej. 120.50"
                    className="w-full bg-[#101010] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red/50 focus:ring-1 focus:ring-pizza-red/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Categoría</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-[#101010] border border-white/5 rounded-xl px-3 py-2.5 text-[11px] text-white focus:outline-none focus:border-pizza-red/50"
                  >
                    <option value="Insumos">Insumos</option>
                    <option value="Personal">Personal</option>
                    <option value="Servicios">Servicios</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Fecha del Gasto</label>
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full bg-[#101010] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pizza-red/50 focus:ring-1 focus:ring-pizza-red/20"
                />
                <p className="text-[9px] text-white/30 mt-1.5 leading-relaxed">
                  * Dejar vacío para usar la fecha y hora actuales en que se registra.
                </p>
              </div>

              <div className="pt-4 border-t border-white/5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="bg-white/5 hover:bg-white/10 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingExpense}
                  className="bg-pizza-red hover:bg-pizza-red/90 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-pizza-red/10 flex items-center gap-1.5"
                >
                  {isSavingExpense && <Loader2 size={12} className="animate-spin" />}
                  Registrar Egreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CRUD EVENTOS */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#181818] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col text-left animate-in fade-in zoom-in-95 duration-250">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h3 className="font-pizza-title text-sm font-bold uppercase text-white/70 flex items-center gap-2">
                <Calendar size={16} className="text-pizza-gold" />
                {crudEvent ? `Editar Evento: ${crudEvent.title}` : "Crear Nuevo Evento"}
              </h3>
              <button
                onClick={() => setIsEventModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/5 text-white/60 hover:text-white cursor-pointer transition-colors border-0 bg-transparent"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEvent} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5 font-pizza-title">Título del Evento</label>
                <input
                  type="text"
                  required
                  value={eventForm.title}
                  onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ej. Sábado de Pizza & Blues en Vivo"
                  className="w-full bg-[#101010] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pizza-gold/50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5 font-pizza-title">Descripción / Detalles</label>
                <textarea
                  required
                  value={eventForm.description}
                  onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe de qué trata el evento, qué se ofrecerá de comida o bebida, shows, etc."
                  rows="3"
                  className="w-full bg-[#101010] border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-pizza-gold/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5 font-pizza-title">Fecha del Evento</label>
                  <input
                    type="date"
                    required
                    value={eventForm.date}
                    onChange={(e) => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-[#101010] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pizza-gold/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5 font-pizza-title">Hora de Inicio</label>
                  <input
                    type="time"
                    required
                    value={eventForm.time}
                    onChange={(e) => setEventForm(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full bg-[#101010] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pizza-gold/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5 font-pizza-title">Código Cupón Promocional</label>
                  <input
                    type="text"
                    value={eventForm.couponCode}
                    onChange={(e) => setEventForm(prev => ({ ...prev, couponCode: e.target.value }))}
                    placeholder="Ej. BLUES15 (En mayúsculas)"
                    className="w-full bg-[#101010] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white uppercase focus:outline-none focus:border-pizza-gold/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5 font-pizza-title">Descuento del Cupón (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={eventForm.discountPercent}
                    onChange={(e) => setEventForm(prev => ({ ...prev, discountPercent: e.target.value }))}
                    placeholder="Ej. 15"
                    className="w-full bg-[#101010] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pizza-gold/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1 font-pizza-title">
                  Imagen / Banner del Evento
                </label>
                <p className="text-[9px] text-white/30 leading-tight">
                  Medidas sugeridas: <strong>1200 x 480 píxeles</strong> (proporción horizontal 2.5:1). Al subir, la imagen se comprimirá y optimizará automáticamente en la nube.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="flex flex-col items-center justify-center h-28 bg-[#101010] border border-dashed border-white/10 rounded-xl hover:border-pizza-gold/30 hover:bg-[#121212] transition-all cursor-pointer group text-center p-3 relative">
                      {uploadingEventBanner ? (
                        <div className="flex flex-col items-center gap-1.5 text-white/40">
                          <Loader2 size={20} className="animate-spin text-pizza-gold" />
                          <span className="text-[10px] font-bold font-pizza-title">Subiendo...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-white/50 group-hover:text-white/80 transition-colors">
                          <span className="text-xl">📷</span>
                          <span className="text-[10px] font-bold">Seleccionar Imagen</span>
                          <span className="text-[8px] text-white/30">WebP, JPG, PNG</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingEventBanner}
                        onChange={handleEventBannerUpload}
                        className="hidden"
                      />
                    </label>
                    {uploadEventBannerError && (
                      <p className="text-pizza-red text-[9px] font-semibold mt-1">{uploadEventBannerError}</p>
                    )}
                  </div>
                  
                  <div className="flex flex-col justify-between gap-2">
                    <div>
                      <label className="block text-[9px] text-white/50 font-bold uppercase tracking-wider mb-1">O pegar URL directa:</label>
                      <input
                        type="text"
                        value={eventForm.bannerUrl}
                        onChange={(e) => setEventForm(prev => ({ ...prev, bannerUrl: e.target.value }))}
                        placeholder="https://ejemplo.com/imagen.jpg"
                        className="w-full bg-[#101010] border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-gold/50"
                      />
                    </div>
                    {eventForm.bannerUrl && (
                      <div className="relative h-12 rounded-lg overflow-hidden border border-white/10 bg-black/20 flex items-center justify-between px-3 py-1.5">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <img 
                            src={eventForm.bannerUrl} 
                            alt="Vista previa banner" 
                            className="w-12 h-8 object-cover rounded border border-white/10 shrink-0" 
                          />
                          <span className="text-[9px] text-white/40 truncate font-mono">{eventForm.bannerUrl}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEventForm(prev => ({ ...prev, bannerUrl: "" }))}
                          className="text-pizza-red hover:text-red-400 font-bold text-[9px] shrink-0 hover:underline border-0 bg-transparent cursor-pointer"
                        >
                          Quitar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 text-left">
                <input
                  type="checkbox"
                  id="event-active-check"
                  checked={eventForm.active}
                  onChange={(e) => setEventForm(prev => ({ ...prev, active: e.target.checked }))}
                  className="w-4 h-4 rounded border-white/10 bg-[#101010] text-pizza-red focus:ring-pizza-red/20 focus:ring-opacity-50"
                />
                <label htmlFor="event-active-check" className="text-xs text-white/80 font-bold select-none cursor-pointer">
                  Publicar evento inmediatamente (Visible para clientes)
                </label>
              </div>

              <div className="pt-4 border-t border-white/5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="bg-white/5 hover:bg-white/10 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer border-0"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEvent}
                  className="bg-pizza-gold text-pizza-dark hover:bg-pizza-gold/90 disabled:opacity-50 text-xs font-black px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-pizza-gold/10 flex items-center gap-1.5 border-0"
                >
                  {savingEvent && <Loader2 size={12} className="animate-spin" />}
                  {crudEvent ? "Actualizar Evento" : "Crear Evento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Componente de Impresión oculto que se visualiza al llamar a window.print() */}
      {selectedOrderForPrint && (
        <TicketTemplate
          order={selectedOrderForPrint}
          totals={getSelectedOrderTotals()}
          config={businessConfig}
          printSize={printSize}
        />
      )}
    </div>
  );
};
