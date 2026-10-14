import { useState, useEffect, useMemo, useRef } from "react";
import { rCol, rDoc, getRestaurantId } from "../firebase/tenant";
import { db, firebaseConfig, storage } from "../firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { compressImage } from "../utils/imageCompressor";
import { searchAddress } from "../utils/mapboxService";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { seedDatabase } from "../utils/dbSeeder";

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
import { 
  collection, query, onSnapshot, doc, updateDoc, setDoc, deleteDoc, addDoc,
  serverTimestamp, orderBy, increment, where 
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { formatCurrency } from "../utils/formatters";
import { logoutUser } from "../firebase/auth";
import { SoundNotification } from "../components/SoundNotification";
import { TicketTemplate } from "../components/TicketTemplate";
import { POSView } from "./POSView";
import { CookView } from "./CookView";
import { PanelLeft, LayoutGrid, Wallet, Clock, ChevronDown, CheckCircle2, X, Settings, LogOut, Loader2, ClipboardList, Users, DollarSign, Package, ShieldAlert, Globe, Percent, BarChart3, Plus, Trash2, Menu, Lock, FileText, Search, Store, Sun, Moon, ChevronsLeft, TrendingUp, Tag, Table, ChefHat, Calendar } from "lucide-react";

import { usePermissions } from "../hooks/usePermissions";
import { useTheme } from "../hooks/useTheme";
import { useCart } from "../context/CartContext";
import { PLANS, getRestaurantStatus, toDate } from "../utils/restaurantStatus";
import { PERMISSIONS } from "../utils/permissionsConfig";
import { PedidosTab } from "./admin/PedidosTab";
import { VentasTab } from "./admin/VentasTab";
import { FinanzasTab } from "./admin/FinanzasTab";
import { InventarioTab } from "./admin/InventarioTab";
import { CategoriasTab } from "./admin/CategoriasTab";
import { MesasTab } from "./admin/MesasTab";
import { ContactosTab } from "./admin/ContactosTab";
import { PersonalTab } from "./admin/PersonalTab";
import { CajaTab } from "./admin/CajaTab";
import { TurnosTab } from "./admin/TurnosTab";
import { AuditoriaTab } from "./admin/AuditoriaTab";
import { TiendaTab } from "./admin/TiendaTab";
import { ConfiguracionTab } from "./admin/ConfiguracionTab";
import { SeoTab } from "./admin/SeoTab";
import { MarketingTab } from "./admin/MarketingTab";
import { EventosTab } from "./admin/EventosTab";
import { migrateLegacyData, hasLegacyData } from "../utils/migrateToTenant";

export const AdminView = ({ user, role, permissions, onLogout }) => {
  const { hasPermission } = usePermissions(role, permissions);
  const [activeTab, setActiveTab] = useState("pedidos");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { setServiceMode: setCartServiceMode, setTableNumber: setCartTableNumber } = useCart();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [restaurantInfo, setRestaurantInfo] = useState(null);
  const [zonesList, setZonesList] = useState([]);
  const [nowMs] = useState(() => Date.now());

  // Ficha del restaurante (plan y vencimiento) para la barra superior
  useEffect(() => {
    return onSnapshot(doc(db, "restaurants", getRestaurantId()), (snap) => {
      setRestaurantInfo(snap.exists() ? snap.data() : null);
    }, () => setRestaurantInfo(null));
  }, []);

  // Lugares del local (Salón, Terraza...)
  useEffect(() => {
    return onSnapshot(rCol("zones"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
      setZonesList(list);
    }, (err) => console.error("Error al cargar lugares:", err));
  }, []);
  const [legacyDataPending, setLegacyDataPending] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationLog, setMigrationLog] = useState([]);

  // Detectar datos del formato anterior (un solo restaurante) para ofrecer migrarlos
  useEffect(() => {
    if (role !== "admin") return;
    let cancelled = false;
    hasLegacyData().then((pending) => {
      if (!cancelled) setLegacyDataPending(pending);
    });
    return () => { cancelled = true; };
  }, [role]);

  const handleMigrateLegacy = async () => {
    if (!window.confirm("Se copiarán tus datos actuales al nuevo formato de varios restaurantes. Los datos originales no se borran. ¿Continuar?")) return;
    setMigrating(true);
    setMigrationLog([]);
    try {
      await migrateLegacyData({
        restaurantName: businessConfig.name,
        onProgress: (msg) => setMigrationLog((prev) => [...prev, msg])
      });
      setLegacyDataPending(false);
      alert("Migración completada. La página se recargará.");
      window.location.reload();
    } catch (err) {
      console.error("Error en la migración:", err);
      alert(`Error en la migración: ${err.message}`);
    } finally {
      setMigrating(false);
    }
  };
  const [railExpanded, setRailExpanded] = useState(() => {
    try { return localStorage.getItem("pos-rail-expanded") === "1"; } catch { return false; }
  });
  const toggleRail = () => {
    setRailExpanded((v) => {
      try { localStorage.setItem("pos-rail-expanded", v ? "0" : "1"); } catch { /* ignorar */ }
      return !v;
    });
  };
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
  const [uploadingHomeBanner, setUploadingHomeBanner] = useState(false);
  const [uploadHomeBannerError, setUploadHomeBannerError] = useState("");
  const [bannerProductSearch, setBannerProductSearch] = useState("");

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

  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedDatabase = async () => {
    if (!window.confirm("¿Está seguro de que desea restablecer la base de datos con el Menú Boliviano? Esto eliminará todos los productos existentes y configurará las categorías y el negocio con los valores por defecto bolivianos.")) {
      return;
    }
    
    setIsSeeding(true);
    try {
      const res = await seedDatabase();
      if (res.success) {
        alert("¡Base de datos sembrada con éxito!\n\nLogs:\n" + res.logs.join("\n"));
        window.location.reload();
      } else {
        alert("Error al sembrar la base de datos:\n" + res.error + "\n\nLogs:\n" + res.logs.join("\n"));
      }
    } catch (err) {
      alert("Error inesperado al sembrar: " + err.message);
    } finally {
      setIsSeeding(false);
    }
  };

  const [visualOptions, setVisualOptions] = useState([]);
  const [visualCombos, setVisualCombos] = useState([]);
  const [editorMode, setEditorMode] = useState("visual"); // 'visual' | 'text'

  // Configuración del negocio leída para el ticket y administración
  const [businessConfig, setBusinessConfig] = useState({
    name: "GloryChef",
    whatsappNumber: "+59177777777",
    address: "Av. Hernando Siles 456, Sucre, Bolivia",
    currency: "BOB",
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
    category: "platos",
    imageUrl: "",
    optionsText: "", // "Tamaño: Mediana, Familiar\nMasa: Tradicional, Fina"
    comboItemsText: "" // line separated
  });

  // Inicializar constructor visual desde los strings de crudForm
  const initializeVisualEditor = (optsText, combosText) => {
    const parsedOpts = [];
    if (optsText?.trim()) {
      optsText.split("\n").forEach((line, idx) => {
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
    if (combosText?.trim()) {
      combosText.split("\n").forEach((item, idx) => {
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
  };

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
      { id: "platos", name: "Platos Principales" },
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
      await addDoc(rCol("logs"), {
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
    const docRef = rDoc("config", "settings");
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
      markerEl.innerHTML = "🌶️";

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
    const q = query(rCol("orders"), orderBy("createdAt", "desc"));
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
    const q = query(rCol("products"), orderBy("name", "asc"));
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

  // Suscribirse a logs de auditoría
  useEffect(() => {
    const q = query(rCol("logs"), orderBy("timestamp", "desc"));
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
    const unsubscribe = onSnapshot(query(collection(db, "users"), where("restaurantId", "==", getRestaurantId())), (snapshot) => {
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

  // Permisos por defecto se sincronizan directamente en el onChange del select

  // Suscribirse a turnos de caja
  useEffect(() => {
    const q = query(rCol("shifts"), orderBy("openTime", "desc"));
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
    const q = query(rCol("expenses"), orderBy("date", "desc"));
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
    const q = query(rCol("events"), orderBy("date", "asc"));
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
    const q = query(rCol("event_registrations"), orderBy("registeredAt", "desc"));
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
      const orderRef = rDoc("orders", order.id);
      await updateDoc(orderRef, {
        status: "preparing",
        authorizedBy: user.uid,
        authorizedAt: serverTimestamp(),
        // Pedido web en mesa: queda en la cuenta abierta de la mesa hasta cobrar
        ...(order.serviceMode === "dinein" && !order.paymentStatus ? { paymentStatus: "pending" } : {})
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
        const orderRef = rDoc("orders", order.id);
        await updateDoc(orderRef, {
          status: "rejected",
          rejectedBy: user.uid,
          rejectedAt: serverTimestamp()
        });
        
        // Restaurar stock
        if (order.items) {
          for (const item of order.items) {
            const prodRef = rDoc("products", item.id);
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
      const orderRef = rDoc("orders", order.id);
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
        restaurantId: getRestaurantId(),
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
      // Lo que sigue sin cobrar (cuentas abiertas en mesa) todavía no entra a la caja
      if (o.paymentStatus === "pending") return false;
      const paidTime = o.paidAt?.seconds || oTime;
      return paidTime >= openTimeSeconds && (o.status === "completed" || o.status === "preparing" || o.status === "ready");
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
      await addDoc(rCol("shifts"), {
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
      const shiftRef = rDoc("shifts", activeShift.id);
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
      category: "platos",
      imageUrl: "",
      optionsText: "",
      comboItemsText: ""
    });
    initializeVisualEditor("", "");
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
    initializeVisualEditor(optsText, combosText);
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
        await setDoc(rDoc("products", crudProduct.id), productPayload, { merge: true });
        await logAuditEvent(user.email, "EDITAR_PRODUCTO", `Producto editado: ${crudForm.name}`);
      } else {
        // ADD
        const newId = crudForm.id.trim() || crudForm.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        if (!newId) {
          alert("ID de producto inválido.");
          return;
        }
        await setDoc(rDoc("products", newId), { id: newId, ...productPayload });
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
        await deleteDoc(rDoc("products", prodId));
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
        createdBy: user.email || "admin@posvcard.com"
      };
      await addDoc(rCol("expenses"), payload);
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
        await deleteDoc(rDoc("expenses", expenseId));
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

  // Manejar subida de Banner de Inicio (Cloudinary -> Storage -> Base64)
  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingHomeBanner(true);
    setUploadHomeBannerError("");

    try {
      // 1. Comprimir imagen localmente (WebP) a tamaño adecuado para Banner (1200px)
      const compressedBlob = await compressImage(file, 1200, 0.85);
      const compressedFile = new File([compressedBlob], `home_banner_${Date.now()}.webp`, { type: "image/webp" });

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
            setSettingsForm((prev) => ({ ...prev, homeBannerUrl: secureUrl }));
            setUploadingHomeBanner(false);
            return;
          }
        } catch (cloudinaryErr) {
          console.warn("Fallo subida de Banner a Cloudinary, intentando Firebase Storage...", cloudinaryErr);
        }
      }

      // B. Intentar con Firebase Storage
      if (storage) {
        try {
          const { ref: fRef, uploadBytes: fUploadBytes } = await import("firebase/storage");
          const bannerRef = fRef(storage, `banners/home_banner_${Date.now()}.webp`);
          await fUploadBytes(bannerRef, compressedFile);
          const downloadURL = await getDownloadURL(bannerRef);
          setSettingsForm((prev) => ({ ...prev, homeBannerUrl: downloadURL }));
          setUploadingHomeBanner(false);
          return;
        } catch (firebaseStorageErr) {
          console.warn("Fallo subida de Banner a Firebase Storage, recurriendo a Base64...", firebaseStorageErr);
        }
      }

      // C. Fallback: Guardar como Base64 en Firestore
      const reader = new FileReader();
      reader.readAsDataURL(compressedBlob);
      reader.onloadend = () => {
        const base64data = reader.result;
        setSettingsForm((prev) => ({ ...prev, homeBannerUrl: base64data }));
        setUploadingHomeBanner(false);
      };
      reader.onerror = (readErr) => {
        throw readErr;
      };

    } catch (err) {
      console.error("Error al procesar subida de banner:", err);
      setUploadHomeBannerError(err.message || "Error al procesar el archivo del banner.");
      setUploadingHomeBanner(false);
    }
  };

  // Guardar Cambios Configuración General
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!settingsForm) return;
    try {
      const configRef = rDoc("config", "settings");
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
      const configRef = rDoc("config", "settings");
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
      const configRef = rDoc("config", "settings");
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
      const configRef = rDoc("config", "settings");
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
        const configRef = rDoc("config", "settings");
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
      const configRef = rDoc("config", "settings");
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
        const configRef = rDoc("config", "settings");
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
      await setDoc(rDoc("categories", catId), {
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
      await deleteDoc(rDoc("categories", catId));
      await logAuditEvent(user.email, "ELIMINAR_CATEGORIA", `Categoría eliminada: ${catId}`);
      alert("Categoría eliminada.");
    } catch (err) {
      console.error("Error al eliminar categoría:", err);
      alert("Error al eliminar categoría.");
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
        await updateDoc(rDoc("events", crudEvent.id), eventData);
        await logAuditEvent(user.email, "ACTUALIZAR_EVENTO", `Evento actualizado: ${eventForm.title}`);
      } else {
        // Crear nuevo evento
        await addDoc(rCol("events"), eventData);
        await logAuditEvent(user.email, "CREAR_EVENTO", `Evento creado: ${eventForm.title}`);
      }

      // Si el evento tiene código de cupón y porcentaje de descuento, registrar el cupón en la config global
      if (eventForm.couponCode.trim() && discountVal > 0) {
        const configRef = rDoc("config", "settings");
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
        await deleteDoc(rDoc("events", id));
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
        await deleteDoc(rDoc("event_registrations", id));
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

  // Cuentas abiertas por mesa (pedidos en mesa sin cobrar)
  const openByTable = orders
    .filter((o) => o.serviceMode === "dinein" && o.paymentStatus === "pending" && o.status !== "rejected" && o.status !== "cancelled")
    .reduce((acc, o) => {
      const key = o.tableNumber;
      if (!acc[key]) acc[key] = { orders: [], total: 0, openedAt: Infinity };
      acc[key].orders.push(o);
      acc[key].total += Number(o.total || 0);
      acc[key].openedAt = Math.min(acc[key].openedAt, o.createdAt?.seconds || Infinity);
      return acc;
    }, {});

  const handleTakeTableOrder = (table) => {
    setCartServiceMode("dinein");
    setCartTableNumber(table.name);
    setActiveTab("pos");
  };

  const planStatus = getRestaurantStatus(restaurantInfo, nowMs);
  const planDateValue = toDate(restaurantInfo?.nextPaymentAt) || toDate(restaurantInfo?.trialEndsAt);
  const planDate = planDateValue ? planDateValue.toLocaleDateString("es-BO", { day: "numeric", month: "short", year: "numeric" }) : "";
  const shiftOpenDate = toDate(activeShift?.openTime);
  const shiftOpenLabel = shiftOpenDate ? shiftOpenDate.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" }) : "";

  // Redirigir a la primera pestaña permitida si la seleccionada actualmente no está autorizada
  useEffect(() => {
    if (tabsList.length > 0 && !tabsList.find(t => t.id === activeTab)) {
      const firstId = tabsList[0].id;
      const t = setTimeout(() => {
        setActiveTab(firstId);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [tabsList, activeTab]);

  return (
    <div data-theme={theme} className="admin-shell min-h-screen bg-pizza-dark text-white flex print:bg-white print:text-black">

      {/* Barra lateral (escritorio): compacta con iconos o expandida con nombres */}
      <aside className={`hidden md:flex ${railExpanded ? "w-60" : "w-[68px]"} shrink-0 sticky top-0 h-screen z-40 flex-col justify-between py-4 bg-pizza-red shadow-lg shadow-black/20 transition-[width] duration-200 overflow-hidden print:hidden`}>
        <div className="flex flex-col gap-4 min-h-0 w-full">
          <div className={`flex items-center gap-3 px-3 ${railExpanded ? "" : "justify-center"}`}>
            <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-md shrink-0">
              {businessConfig.logoUrl ? (
                <img 
                  src={businessConfig.logoUrl} 
                  alt="Logo" 
                  className="w-full h-full object-cover" 
                  onError={(e) => { e.target.style.display = 'none'; }} 
                />
              ) : (
                <span className="text-2xl">🌶️</span>
              )}
            </div>
            {railExpanded && (
              <div className="min-w-0">
                <h2 className="font-pizza-title font-bold text-sm text-white leading-tight truncate">
                  {businessConfig.name || "GloryChef"}
                </h2>
                <span className="text-[10px] text-white/80 block truncate">
                  {role === "admin" ? "Panel Administrador" : role === "cashier" ? "Panel Cajero" : "Panel Cocina"}
                </span>
              </div>
            )}
          </div>

          <div className="px-3">
            <button
              onClick={toggleRail}
              title={railExpanded ? "Ocultar nombres" : "Mostrar nombres"}
              aria-label={railExpanded ? "Contraer menú" : "Expandir menú"}
              aria-expanded={railExpanded}
              className={`h-10 w-full flex items-center gap-3 rounded-xl bg-white/15 text-white hover:bg-white/25 transition-all cursor-pointer ${railExpanded ? "px-3" : "justify-center"}`}
            >
              {railExpanded ? <ChevronsLeft size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
              {railExpanded && <span className="text-xs font-semibold">Ocultar menú</span>}
            </button>
          </div>

          <nav className="flex flex-col gap-1.5 overflow-y-auto w-full px-3 [scrollbar-width:none]">
            {tabsList.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  title={railExpanded ? undefined : t.label}
                  aria-label={t.label}
                  className={`h-11 shrink-0 flex items-center gap-3 rounded-xl transition-all cursor-pointer ${railExpanded ? "w-full px-3" : "w-11 mx-auto justify-center"} ${
                    activeTab === t.id
                      ? "bg-white/25 text-white shadow-inner font-bold"
                      : "text-white/80 hover:bg-white/15 hover:text-white font-semibold"
                  }`}
                >
                  <Icon size={20} strokeWidth={1.75} className="shrink-0" />
                  {railExpanded && <span className="text-xs tracking-wide truncate">{t.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col gap-1.5 pt-3 px-3">
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
            aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            className={`h-11 flex items-center gap-3 rounded-xl text-white/80 hover:bg-white/15 hover:text-white transition-all cursor-pointer ${railExpanded ? "w-full px-3" : "w-11 mx-auto justify-center"}`}
          >
            {theme === "dark" ? <Sun size={20} strokeWidth={1.75} className="shrink-0" /> : <Moon size={20} strokeWidth={1.75} className="shrink-0" />}
            {railExpanded && <span className="text-xs font-semibold">{theme === "dark" ? "Modo Claro" : "Modo Oscuro"}</span>}
          </button>
          <button
            onClick={handleLogoutClick}
            title="Cerrar Sesión"
            aria-label="Cerrar Sesión"
            className={`h-11 flex items-center gap-3 rounded-xl text-white/80 hover:bg-white/15 hover:text-white transition-all cursor-pointer ${railExpanded ? "w-full px-3" : "w-11 mx-auto justify-center"}`}
          >
            <LogOut size={20} strokeWidth={1.75} className="shrink-0" />
            {railExpanded && <span className="text-xs font-semibold">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
      
      {/* Barra superior: negocio, plan, accesos rápidos, caja y usuario */}
      <header className="bg-pizza-dark/95 backdrop-blur-xl border-b border-white/5 px-3 md:px-5 py-2.5 flex items-center justify-between gap-3 z-40 shrink-0 sticky top-0 print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => (window.matchMedia("(min-width: 768px)").matches ? toggleRail() : setMobileMenuOpen(true))}
            aria-label="Mostrar u ocultar menú"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer shrink-0"
          >
            <PanelLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className="font-pizza-title font-extrabold text-sm uppercase truncate leading-tight">
              {businessConfig.name || "GloryChef"}
            </div>
            <div className="text-[10px] text-white/40 font-mono truncate">
              {businessConfig.taxId ? `${businessConfig.taxIdLabel || "NIT"} ${businessConfig.taxId}` : tabsList.find(t => t.id === activeTab)?.label}
            </div>
          </div>
          {restaurantInfo && (
            <div className={`hidden lg:flex items-center gap-3 rounded-xl border px-3 py-1 shrink-0 ${planStatus.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
              <div className="leading-tight">
                <div className="text-[10px] font-black uppercase tracking-wider">{PLANS[restaurantInfo.plan]?.label || restaurantInfo.plan || "Plan"}</div>
                <div className={`text-[10px] font-bold flex items-center gap-1 ${planStatus.ok ? "text-emerald-400" : "text-red-400"}`}>
                  <CheckCircle2 size={10} /> {planStatus.label === "Activo" ? "Al día" : planStatus.label}
                </div>
              </div>
              {planDate && (
                <div className="leading-tight border-l border-white/10 pl-3">
                  <div className="text-[9px] text-white/40">{restaurantInfo.plan === "trial" ? "Vence" : "Próximo"}</div>
                  <div className="text-[11px] font-bold">{planDate}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Accesos rápidos */}
        <nav className="hidden md:flex items-center gap-1">
          {[["pos", "POS", Store], ["mesas", "Mesas", LayoutGrid], ["cocina", "Comandas", ChefHat]]
            .filter(([id]) => tabsList.some((t) => t.id === id))
            .map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === id ? "bg-pizza-red/10 text-pizza-red" : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {tabsList.some((t) => t.id === "caja") && (
            <button
              onClick={() => setActiveTab("caja")}
              className={`hidden sm:flex items-center rounded-xl border overflow-hidden cursor-pointer transition-all ${activeShift ? "border-emerald-500/30 hover:border-emerald-500/60" : "border-amber-500/30 hover:border-amber-500/60"}`}
              title="Ir a Arqueo de Caja"
            >
              <div className="px-3 py-1 leading-tight text-left">
                <div className="text-[9px] font-black uppercase tracking-wider text-white/50 flex items-center gap-1"><Wallet size={10} /> Mi caja</div>
                <div className={`text-xs font-black ${activeShift ? "text-emerald-400" : "text-amber-400"}`}>
                  {activeShift ? formatCurrency((activeShift.cashBase || 0) + getShiftExpectedTotals().cash, businessConfig.currency) : "Cerrada"}
                </div>
              </div>
              <div className="px-3 py-1 leading-tight text-left border-l border-white/10 hidden lg:block">
                <div className="text-[9px] font-black uppercase tracking-wider text-white/50 flex items-center gap-1"><Clock size={10} /> Apertura</div>
                <div className="text-xs font-bold">{activeShift ? shiftOpenLabel : "Abrir caja"}</div>
              </div>
            </button>
          )}
          <SoundNotification pendingCount={pendingOrders.length} isMuted={isMuted} setIsMuted={setIsMuted} />

          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl border border-white/10 hover:bg-white/5 pl-1 pr-2 py-1 cursor-pointer"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              <span className="w-8 h-8 rounded-lg bg-pizza-red text-white font-black text-sm flex items-center justify-center uppercase">
                {(user.email || "?")[0]}
              </span>
              <span className="hidden md:block text-left leading-tight max-w-[140px]">
                <span className="block text-xs font-bold truncate">{user.displayName || user.email?.split("@")[0]}</span>
                <span className="block text-[10px] text-white/50">{role === "admin" ? "Administrador" : role === "cashier" ? "Cajero" : "Cocinero"}</span>
              </span>
              <ChevronDown size={14} className="text-white/50 hidden md:block" />
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div role="menu" className="absolute right-0 mt-2 w-56 z-50 bg-[#181818] border border-white/10 rounded-2xl shadow-2xl p-2">
                  <div className="px-3 py-2 border-b border-white/5 mb-1">
                    <div className="text-xs font-bold truncate">{user.email}</div>
                    <div className="text-[10px] text-white/50">{role === "admin" ? "Administrador" : role === "cashier" ? "Cajero" : "Cocinero"}</div>
                  </div>
                  <button role="menuitem" onClick={() => { toggleTheme(); setUserMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:bg-white/5 cursor-pointer">
                    {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />} {theme === "dark" ? "Modo claro" : "Modo oscuro"}
                  </button>
                  <button role="menuitem" onClick={handleLogoutClick} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-pizza-red hover:bg-pizza-red/10 cursor-pointer">
                    <LogOut size={14} /> Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Menú lateral desplegable (hamburguesa) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex print:hidden">
          <div className="fixed inset-0 bg-black/75" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] h-full bg-pizza-dark flex flex-col justify-between p-6 border-r border-white/10 z-10 shadow-2xl">
            <div className="space-y-6 overflow-y-auto pr-1 flex-1">
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
                    <span className="text-3xl">🌶️</span>
                  )}
                  <div>
                    <h2 className="font-pizza-title font-bold leading-none text-base">
                      {businessConfig.name || "GloryChef"}
                    </h2>
                    <span className="text-[10px] text-white/50 block mt-1">
                      {role === "admin" ? "Panel Administrador" : role === "cashier" ? "Panel Cajero" : "Panel Cocina"}
                    </span>
                    <span className="text-[10px] text-white/40 block">{user.email}</span>
                  </div>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar menú" className="p-1 text-white/60 hover:text-white cursor-pointer">
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

            <div className="pt-4 mt-4 border-t border-white/5 space-y-2">
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 font-bold text-xs py-3 rounded-xl hover:bg-white/10 cursor-pointer"
              >
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                {theme === "dark" ? "Modo Claro" : "Modo Oscuro"}
              </button>
              <button
                onClick={handleLogoutClick}
                className="w-full flex items-center justify-center gap-2 bg-pizza-red/10 border border-pizza-red/20 text-pizza-red font-bold text-xs py-3 rounded-xl hover:bg-pizza-red/25 cursor-pointer"
              >
                <LogOut size={14} />
                Cerrar Sesión
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Right Pane Content */}
      <main className="flex-1 overflow-y-auto bg-[#161616] p-4 md:p-8 print:p-0">

        {legacyDataPending && (
          <div className="max-w-6xl mx-auto mb-6 glass-panel rounded-2xl p-4 border border-[#ffd79b]/35 flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
            <div>
              <h3 className="text-sm font-bold text-[#ffd79b]">Actualización a varios restaurantes</h3>
              <p className="text-xs text-white/60 mt-1">
                Encontramos datos guardados en el formato anterior. Cópialos a tu restaurante para seguir viéndolos. Los originales no se borran.
              </p>
              {migrationLog.length > 0 && (
                <p className="text-[10px] text-white/40 mt-2">{migrationLog[migrationLog.length - 1]}</p>
              )}
            </div>
            <button
              onClick={handleMigrateLegacy}
              disabled={migrating}
              className="shrink-0 flex items-center justify-center gap-2 bg-pizza-red hover:bg-pizza-red/90 disabled:opacity-60 text-white font-bold text-xs px-5 py-3 rounded-xl cursor-pointer"
            >
              {migrating && <Loader2 size={14} className="animate-spin" />}
              {migrating ? "Migrando..." : "Migrar mis datos"}
            </button>
          </div>
        )}
        
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
                <p className="text-xs text-white/50">Módulo del sistema de administración {businessConfig.name || "GloryChef"}</p>
              </div>

              <div className="flex items-center gap-3">
                {activeTab === "pedidos" && (
                  <>
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
              <PedidosTab
                archivedOrders={archivedOrders}
                businessConfig={businessConfig}
                filterStatus={filterStatus}
                filteredActiveOrders={filteredActiveOrders}
                handleAuthorize={handleAuthorize}
                handleMarkCompleted={handleMarkCompleted}
                handleReject={handleReject}
                handleShareDeliveryWhatsApp={handleShareDeliveryWhatsApp}
                loading={loading}
                orderSearch={orderSearch}
                orderServiceMode={orderServiceMode}
                pendingOrders={pendingOrders}
                preparingOrders={preparingOrders}
                readyOrders={readyOrders}
                setFilterStatus={setFilterStatus}
                setOrderSearch={setOrderSearch}
                setOrderServiceMode={setOrderServiceMode}
                triggerPrint={triggerPrint}
              />
            )}

            {/* TAB CONTENT: VENTAS REPORT */}
            {activeTab === "ventas" && hasPermission(PERMISSIONS.VER_VENTAS) && (
              <VentasTab
                averageTicket={averageTicket}
                businessConfig={businessConfig}
                completedOrders={completedOrders}
                handleExportSalesCSV={handleExportSalesCSV}
                hoveredHourPoint={hoveredHourPoint}
                hoveredProductIndex={hoveredProductIndex}
                modeCounts={modeCounts}
                payCounts={payCounts}
                salesByHour={salesByHour}
                setHoveredHourPoint={setHoveredHourPoint}
                setHoveredProductIndex={setHoveredProductIndex}
                topProducts={topProducts}
                totalSalesRevenue={totalSalesRevenue}
              />
            )}

            {/* TAB CONTENT: RESULTADOS FINANCIEROS */}
            {activeTab === "finanzas" && hasPermission(PERMISSIONS.VER_FINANZAS) && <FinanzasTab
                businessConfig={businessConfig}
                completedOrders={completedOrders}
                downloadCSV={downloadCSV}
                expenses={expenses}
                financesPeriod={financesPeriod}
                handleDeleteExpense={handleDeleteExpense}
                logAuditEvent={logAuditEvent}
                productsList={productsList}
                setFinancesPeriod={setFinancesPeriod}
                setIsExpenseModalOpen={setIsExpenseModalOpen}
                user={user}
              />}

            {/* TAB CONTENT: INVENTARIO CRUD */}
            {activeTab === "inventario" && hasPermission(PERMISSIONS.VER_INVENTARIO) && (
              <InventarioTab
                businessConfig={businessConfig}
                categoriesListToUse={categoriesListToUse}
                filteredInventory={filteredInventory}
                handleDeleteProduct={handleDeleteProduct}
                handleExportInventoryCSV={handleExportInventoryCSV}
                handleOpenAddProduct={handleOpenAddProduct}
                handleOpenEditProduct={handleOpenEditProduct}
                inventoryCategory={inventoryCategory}
                inventorySearch={inventorySearch}
                role={role}
                setInventoryCategory={setInventoryCategory}
                setInventorySearch={setInventorySearch}
              />
            )}

            {/* TAB CONTENT: CATEGORIAS CRUD */}
            {activeTab === "categorias" && hasPermission(PERMISSIONS.VER_INVENTARIO) && (
              <CategoriasTab
                categoriesListToUse={categoriesListToUse}
                categoryForm={categoryForm}
                handleDeleteCategory={handleDeleteCategory}
                handleSaveCategory={handleSaveCategory}
                setCategoryForm={setCategoryForm}
              />
            )}

            {/* TAB CONTENT: GESTION DE MESAS */}
            {activeTab === "mesas" && hasPermission(PERMISSIONS.VER_MESAS) && (
              <MesasTab
                tablesList={tablesList}
                zonesList={zonesList}
                openByTable={openByTable}
                currency={businessConfig.currency}
                user={user}
                logAuditEvent={logAuditEvent}
                onTakeOrder={handleTakeTableOrder}
              />
            )}

            {/* TAB CONTENT: CONTACTOS CLIENTES */}
            {activeTab === "contactos" && hasPermission(PERMISSIONS.VER_CLIENTES) && (
              <ContactosTab
                businessConfig={businessConfig}
                customerSearch={customerSearch}
                filteredCustomers={filteredCustomers}
                handleExportCustomersCSV={handleExportCustomersCSV}
                setCustomerSearch={setCustomerSearch}
              />
            )}

            {/* TAB CONTENT: GESTION DE PERSONAL */}
            {activeTab === "personal" && hasPermission(PERMISSIONS.VER_PERSONAL) && (
              <PersonalTab
                handleChangeRole={handleChangeRole}
                handleRegisterStaff={handleRegisterStaff}
                handleToggleSuspend={handleToggleSuspend}
                setEditingPermissionsList={setEditingPermissionsList}
                setEditingPermissionsUser={setEditingPermissionsUser}
                setStaffEmail={setStaffEmail}
                setStaffPassword={setStaffPassword}
                setStaffPermissions={setStaffPermissions}
                setStaffRole={setStaffRole}
                staffEmail={staffEmail}
                staffPassword={staffPassword}
                staffPermissions={staffPermissions}
                staffRegistering={staffRegistering}
                staffRole={staffRole}
                usersList={usersList}
              />
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
              <CajaTab
                activeShift={activeShift}
                actualCash={actualCash}
                actualElectronic={actualElectronic}
                businessConfig={businessConfig}
                cashBase={cashBase}
                getShiftExpectedTotals={getShiftExpectedTotals}
                handleCloseShift={handleCloseShift}
                handleOpenShift={handleOpenShift}
                setActualCash={setActualCash}
                setActualElectronic={setActualElectronic}
                setCashBase={setCashBase}
              />
            )}

            {/* TAB CONTENT: HISTORIAL DE TURNOS */}
            {activeTab === "turnos" && hasPermission(PERMISSIONS.VER_HISTORIAL_TURNOS) && (
              <TurnosTab
                businessConfig={businessConfig}
                handleExportShiftsCSV={handleExportShiftsCSV}
                shifts={shifts}
              />
            )}

            {/* TAB CONTENT: AUDITORIA LOGS */}
            {activeTab === "auditoria" && hasPermission(PERMISSIONS.VER_AUDITORIA) && (
              <AuditoriaTab
                auditActionFilter={auditActionFilter}
                auditActions={auditActions}
                auditSearch={auditSearch}
                filteredAuditLogs={filteredAuditLogs}
                handleExportAuditCSV={handleExportAuditCSV}
                setAuditActionFilter={setAuditActionFilter}
                setAuditSearch={setAuditSearch}
              />
            )}

            {/* TAB CONTENT: TIENDA ONLINE */}
            {activeTab === "tienda" && hasPermission(PERMISSIONS.CONFIGURAR_TIENDA) && (
              <TiendaTab
                adminMapContainerRef={adminMapContainerRef}
                adminMapSearch={adminMapSearch}
                adminMapSuggestions={adminMapSuggestions}
                businessConfig={businessConfig}
                handleAdminSearchChange={handleAdminSearchChange}
                handleSaveStoreStatus={handleSaveStoreStatus}
                handleSelectAdminSuggestion={handleSelectAdminSuggestion}
                hasMapboxToken={hasMapboxToken}
                isAdminMapSearchOpen={isAdminMapSearchOpen}
                loadingAdminMap={loadingAdminMap}
                setAdminMapSearch={setAdminMapSearch}
                setAdminMapSuggestions={setAdminMapSuggestions}
                setIsAdminMapSearchOpen={setIsAdminMapSearchOpen}
                setStoreStatusForm={setStoreStatusForm}
                storeStatusForm={storeStatusForm}
              />
            )}

            {/* TAB CONTENT: CONFIGURACION GENERAL */}
            {activeTab === "configuracion" && hasPermission(PERMISSIONS.CONFIGURAR_TIENDA) && settingsForm && (
              <ConfiguracionTab
                bannerProductSearch={bannerProductSearch}
                handleBannerUpload={handleBannerUpload}
                handleLogoUpload={handleLogoUpload}
                handleQrUpload={handleQrUpload}
                handleSaveSettings={handleSaveSettings}
                handleSeedDatabase={handleSeedDatabase}
                isSeeding={isSeeding}
                productsList={productsList}
                setBannerProductSearch={setBannerProductSearch}
                setSettingsForm={setSettingsForm}
                settingsForm={settingsForm}
                uploadHomeBannerError={uploadHomeBannerError}
                uploadLogoError={uploadLogoError}
                uploadQrError={uploadQrError}
                uploadingHomeBanner={uploadingHomeBanner}
                uploadingLogo={uploadingLogo}
                uploadingQr={uploadingQr}
              />
            )}

            {/* TAB CONTENT: SEO TAB */}
            {activeTab === "seo" && hasPermission(PERMISSIONS.CONFIGURAR_TIENDA) && (
              <SeoTab
                businessConfig={businessConfig}
                handleSaveSeo={handleSaveSeo}
                seoForm={seoForm}
                setSeoForm={setSeoForm}
              />
            )}

            {/* TAB CONTENT: MARKETING */}
            {activeTab === "marketing" && hasPermission(PERMISSIONS.CONFIGURAR_TIENDA) && (
              <MarketingTab
                businessConfig={businessConfig}
                handleAddAutoDiscount={handleAddAutoDiscount}
                handleAddCoupon={handleAddCoupon}
                handleDeleteAutoDiscount={handleDeleteAutoDiscount}
                handleDeleteCoupon={handleDeleteCoupon}
                marketingForm={marketingForm}
                setMarketingForm={setMarketingForm}
              />
            )}

            {/* TAB CONTENT: EVENTOS & MARKETING */}
            {activeTab === "eventos" && hasPermission(PERMISSIONS.CONFIGURAR_TIENDA) && (
              <EventosTab
                eventRegistrations={eventRegistrations}
                eventTabSubView={eventTabSubView}
                eventsList={eventsList}
                handleDeleteEvent={handleDeleteEvent}
                handleDeleteRegistration={handleDeleteRegistration}
                handleExportRegistrationsCSV={handleExportRegistrationsCSV}
                setCrudEvent={setCrudEvent}
                setEventForm={setEventForm}
                setEventTabSubView={setEventTabSubView}
                setIsEventModalOpen={setIsEventModalOpen}
              />
            )}
          </div>
        )}
      </main>
      </div>

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
                    placeholder="Ej. Pique Macho Tradicional"
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
                              placeholder="Ej. Salteña 1 (Picante/Medio/Dulce)"
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
                        placeholder="Tamaño: Mediano, Familiar (+ BOB 20.00)&#10;Picante: Con locoto picante, Sin locoto (Suave)"
                        rows="6"
                        className="w-full bg-[#101010] border border-white/5 rounded-xl p-3 text-[10px] text-white font-mono leading-relaxed"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Ítems de Combo (Una opción por línea)</label>
                      <textarea
                        value={crudForm.comboItemsText}
                        onChange={(e) => setCrudForm(prev => ({ ...prev, comboItemsText: e.target.value }))}
                        placeholder="Salteña 1 (Picante/Medio/Dulce)&#10;Salteña 2 (Picante/Medio/Dulce)&#10;Mocochinchi Frio"
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
                  placeholder="Ej. Peña Folclórica & Pique Macho"
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
