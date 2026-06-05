import { useState, useEffect, useRef } from "react";
import { db } from "../firebase/config";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { calculateDistance } from "../utils/mapboxService";
import { formatCurrency } from "../utils/formatters";
import { 
  Clock, CheckCircle2, MapPin, Truck, UtensilsCrossed, ChevronLeft, 
  Phone, AlertTriangle, Loader2, Volume2, VolumeX, ShieldCheck, Home
} from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export const OrderTrackingView = ({ orderId, onBack }) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [businessConfig, setBusinessConfig] = useState(null);
  
  // Sonido de alerta al cambiar de estado
  const [isMuted, setIsMuted] = useState(false);
  const prevStatusRef = useRef(null);

  // Referencias para el mapa de Mapbox
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const routeLayerAddedRef = useRef(false);

  // Cargar configuración global del negocio
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, "config", "settings"));
        if (configDoc.exists()) {
          setBusinessConfig(configDoc.data());
        }
      } catch (err) {
        console.error("Error al cargar configuración de negocio:", err);
      }
    };
    fetchConfig();
  }, []);

  // Suscribirse a los cambios del pedido
  useEffect(() => {
    if (!orderId) {
      setError("ID de pedido no especificado.");
      setLoading(false);
      return;
    }

    const docRef = doc(db, "orders", orderId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const orderData = { id: docSnap.id, ...docSnap.data() };
        setOrder(orderData);
        
        // Sonido si el estado progresa
        if (prevStatusRef.current && prevStatusRef.current !== orderData.status) {
          playAlertSound();
        }
        prevStatusRef.current = orderData.status;
      } else {
        setError("El pedido no existe o fue cancelado.");
      }
      setLoading(false);
    }, (err) => {
      console.error("Error en suscripción de pedido:", err);
      setError("Error al conectar con la base de datos.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [orderId]);

  // Inicializar y actualizar Mapa de Mapbox
  useEffect(() => {
    if (loading || !order || !businessConfig || order.serviceMode !== "delivery") return;
    
    // Obtener token
    const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
    if (!token || token.includes("PLACEHOLDER")) {
      console.warn("Token de Mapbox no disponible o es un placeholder.");
      return;
    }

    const businessLocation = businessConfig.shipping?.businessLocation || { lat: -12.046374, lng: -77.031002 };
    const customerCoords = order.customerCoords;

    if (!customerCoords) return;

    // Inicializar mapa si no existe
    if (!mapRef.current && mapContainerRef.current) {
      mapboxgl.accessToken = token;
      
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/dark-v11", // Estilo oscuro que combina con el tema
        center: [businessLocation.lng, businessLocation.lat],
        zoom: 13,
        attributionControl: false
      });

      // Añadir controles básicos
      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      mapRef.current = map;

      // Evento Load del Mapa para agregar la ruta
      map.on("load", async () => {
        // Marcador Pizzería (Origen)
        const elStore = document.createElement("div");
        elStore.className = "store-map-marker";
        elStore.innerHTML = `<div style="background-color: #e23636; border: 2px solid white; border-radius: 50%; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 0 10px rgba(226, 54, 54, 0.6); animation: pulse 2s infinite;">🍕</div>`;
        new mapboxgl.Marker(elStore)
          .setLngLat([businessLocation.lng, businessLocation.lat])
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<h3><b>${businessConfig.name || "Pizza Hub"}</b></h3><p>Ubicación del Local</p>`))
          .addTo(map);

        // Marcador Cliente (Destino)
        const elClient = document.createElement("div");
        elClient.className = "client-map-marker";
        elClient.innerHTML = `<div style="background-color: #ffd79b; border: 2px solid #161616; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 0 8px rgba(255, 215, 155, 0.8);">🏠</div>`;
        new mapboxgl.Marker(elClient)
          .setLngLat([customerCoords.lng, customerCoords.lat])
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<h3><b>Tu Dirección</b></h3><p>${order.customerName}</p>`))
          .addTo(map);

        // Dibujar ruta física
        try {
          const { coordinates: routeCoords } = await calculateDistance(businessLocation, customerCoords);
          if (routeCoords && routeCoords.length > 0) {
            map.addSource("route", {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: routeCoords
                }
              }
            });

            map.addLayer({
              id: "route",
              type: "line",
              source: "route",
              layout: {
                "line-join": "round",
                "line-cap": "round"
              },
              paint: {
                "line-color": "#e23636", // pizza-red
                "line-width": 4,
                "line-opacity": 0.85
              }
            });

            routeLayerAddedRef.current = true;

            // Ajustar el zoom para ver ambos marcadores
            const bounds = new mapboxgl.LngLatBounds();
            bounds.extend([businessLocation.lng, businessLocation.lat]);
            bounds.extend([customerCoords.lng, customerCoords.lat]);
            map.fitBounds(bounds, { padding: 50, duration: 1500 });
          }
        } catch (err) {
          console.error("Error al trazar ruta en el mapa:", err);
        }
      });
    }

    return () => {
      // No destruimos el mapa al instante para evitar parpadeos si se actualiza la orden
    };
  }, [loading, order, businessConfig]);

  const playAlertSound = () => {
    if (isMuted) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        
        // Tono ascendente
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        gain2.gain.setValueAtTime(0.3, audioCtx.currentTime);
        osc2.start();
        setTimeout(() => osc2.stop(), 250);
      }, 150);
    } catch (e) {
      console.warn("Error con sonido sintetizado:", e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-pizza-dark text-white flex flex-col items-center justify-center gap-3">
        <Loader2 size={36} className="animate-spin text-pizza-red" />
        <span className="text-sm text-white/50 tracking-wider">Cargando estado del pedido en vivo...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-pizza-dark text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle size={48} className="text-pizza-red mb-4 animate-pulse" />
        <h2 className="text-2xl font-bold font-pizza-title mb-2">Error de Seguimiento</h2>
        <p className="text-sm text-white/60 max-w-sm mb-8">{error || "Pedido no encontrado."}</p>
        <button
          onClick={onBack}
          className="bg-pizza-red hover:bg-pizza-red/90 text-white rounded-2xl px-6 py-3 text-xs font-bold transition-all cursor-pointer"
        >
          Volver al Menú
        </button>
      </div>
    );
  }

  // Definir pasos de acuerdo al estado
  const getSteps = () => {
    const isDelivery = order.serviceMode === "delivery";
    const isPickup = order.serviceMode === "pickup";
    
    let thirdStepLabel = "Servido en Mesa";
    let thirdStepIcon = <UtensilsCrossed size={20} />;
    
    if (isDelivery) {
      thirdStepLabel = "En Camino";
      thirdStepIcon = <Truck size={20} />;
    } else if (isPickup) {
      thirdStepLabel = "Listo para Recojo";
      thirdStepIcon = <ShieldCheck size={20} />;
    }

    return [
      {
        key: "pending_approval",
        label: "Confirmando Orden",
        desc: "Estamos verificando los detalles de tu pedido.",
        icon: <Clock size={20} />
      },
      {
        key: "preparing",
        label: "En Preparación",
        desc: "Nuestros pizzaiolos están armando tu orden a la leña.",
        icon: <UtensilsCrossed size={20} />
      },
      {
        key: "ready",
        label: thirdStepLabel,
        desc: isDelivery 
          ? "El repartidor va rumbo a tu ubicación." 
          : isPickup 
          ? "Tu pedido está listo en mostrador. ¡Pasa por él!" 
          : "Tus platos están siendo servidos en tu mesa.",
        icon: thirdStepIcon
      },
      {
        key: "completed",
        label: "Completado",
        desc: "¡Que disfrutes tu deliciosa pizza! ¡Buen provecho!",
        icon: <CheckCircle2 size={20} />
      }
    ];
  };

  const steps = getSteps();
  
  // Determinar índice activo
  const getActiveStepIndex = () => {
    if (order.status === "pending_approval") return 0;
    if (order.status === "preparing") return 1;
    if (order.status === "ready") return 2;
    if (order.status === "completed") return 3;
    return -1; // Rechazado u otro
  };

  const activeIndex = getActiveStepIndex();
  const currency = businessConfig?.currency || "USD";

  return (
    <div className="min-h-screen bg-pizza-dark text-white flex flex-col">
      {/* Cabecera */}
      <header className="bg-[#161616] border-b border-white/5 px-6 py-4 flex justify-between items-center sticky top-0 z-30">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 bg-[#181818] border border-white/10 hover:bg-white/5 text-white/80 text-xs font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer"
        >
          <ChevronLeft size={16} />
          Volver al Menú
        </button>
        
        <div className="text-center">
          <h1 className="font-pizza-title text-lg font-bold text-white tracking-wide">
            Seguimiento de Orden
          </h1>
          <p className="text-[10px] text-white/40 font-mono uppercase">ID: #{order.id.slice(-6)}</p>
        </div>

        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
            isMuted 
              ? "bg-[#e23636]/10 border-[#e23636]/20 text-[#e23636] hover:bg-[#e23636]/20" 
              : "bg-[#ffd79b]/10 border-[#ffd79b]/20 text-[#ffd79b] hover:bg-[#ffd79b]/20"
          }`}
          title={isMuted ? "Activar sonido" : "Silenciar sonido"}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </header>

      {/* Grid Principal */}
      <main className="flex-1 p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto w-full">
        
        {/* LADO IZQUIERDO: DETALLES Y STEPPER */}
        <div className="lg:col-span-7 space-y-6 flex flex-col justify-start">
          
          {/* Tarjeta de bienvenida / Estado Actual */}
          <div className="bg-[#181818] border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden text-left">
            <div className="absolute top-0 right-0 w-32 h-32 bg-pizza-red/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[10px] bg-pizza-red/10 border border-pizza-red/20 text-pizza-red px-2.5 py-1 rounded-md uppercase font-black tracking-wider">
                  Orden #{order.orderNumber}
                </span>
                <h2 className="text-2xl font-black mt-2 text-white font-pizza-title">
                  {order.status === "rejected" ? "Pedido Rechazado" : steps[activeIndex]?.label || "Estado Desconocido"}
                </h2>
              </div>
              <div className="text-right">
                <span className="text-xs text-white/40 block">Total a Pagar</span>
                <span className="text-xl font-black text-pizza-gold">
                  {formatCurrency(order.total, currency)}
                </span>
              </div>
            </div>

            {order.status === "rejected" ? (
              <div className="bg-pizza-red/10 border border-pizza-red/20 rounded-2xl p-4 text-xs text-pizza-red/90 leading-relaxed">
                Lo sentimos, tu pedido no pudo ser aprobado por la tienda en este momento. Por favor contáctanos al WhatsApp de soporte para más detalles.
              </div>
            ) : (
              <p className="text-xs text-white/60 leading-relaxed">
                {steps[activeIndex]?.desc}
              </p>
            )}
          </div>

          {/* STEPPER VISUAL */}
          {order.status !== "rejected" && (
            <div className="bg-[#181818] border border-white/5 rounded-3xl p-6 shadow-xl text-left space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">Estado del Pedido</h3>
              
              <div className="relative pl-8 space-y-8 before:content-[''] before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-[2px] before:bg-white/10">
                {steps.map((step, idx) => {
                  const isCompleted = idx < activeIndex;
                  const isActive = idx === activeIndex;
                  const isPending = idx > activeIndex;

                  return (
                    <div key={step.key} className="relative group">
                      {/* Nodo indicador */}
                      <div className={`absolute -left-[33px] top-0.5 w-[32px] h-[32px] rounded-full border-2 flex items-center justify-center transition-all ${
                        isCompleted 
                          ? "bg-emerald-500 border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                          : isActive 
                          ? "bg-pizza-red border-pizza-red text-white shadow-[0_0_12px_rgba(226,54,54,0.5)] animate-pulse" 
                          : "bg-pizza-dark/80 border-white/10 text-white/30"
                      }`}>
                        {isCompleted ? <CheckCircle2 size={16} /> : step.icon}
                      </div>

                      {/* Contenido del paso */}
                      <div className="pl-2">
                        <h4 className={`text-sm font-extrabold transition-colors ${
                          isActive ? "text-pizza-red text-base" : isCompleted ? "text-emerald-400" : "text-white/40"
                        }`}>
                          {step.label}
                        </h4>
                        <p className={`text-xs mt-1 transition-colors ${
                          isActive ? "text-white/70" : isCompleted ? "text-white/50" : "text-white/30"
                        }`}>
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* RESUMEN DEL PEDIDO */}
          <div className="bg-[#181818] border border-white/5 rounded-3xl p-6 shadow-xl text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">Detalle de tu Compra</h3>
            <div className="divide-y divide-white/5 max-h-60 overflow-y-auto pr-2 space-y-3">
              {order.items?.map((item, idx) => (
                <div key={item.cartId || idx} className="pt-3 first:pt-0 flex justify-between items-start text-xs">
                  <div className="space-y-1">
                    <span className="font-extrabold text-white">
                      {item.quantity}x {item.name}
                    </span>
                    {item.optionsSelected && Object.keys(item.optionsSelected).length > 0 && (
                      <div className="text-[10px] text-[#ffd79b] leading-tight pl-2 border-l border-[#ffd79b]/40">
                        {Object.entries(item.optionsSelected).map(([k, v]) => (
                          <div key={k}>{k}: {v}</div>
                        ))}
                      </div>
                    )}
                    {item.comboItems && item.comboItems.length > 0 && (
                      <div className="text-[10px] text-pizza-red font-medium">
                        Combo: {item.comboItems.join(" + ")}
                      </div>
                    )}
                  </div>
                  <span className="font-black text-white/80">
                    {formatCurrency(item.price * item.quantity, currency)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-white/5 mt-4 pt-4 space-y-2 text-xs">
              <div className="flex justify-between text-white/60">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal, currency)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-pizza-red font-semibold">
                  <span>Descuentos</span>
                  <span>-{formatCurrency(order.discountAmount, currency)}</span>
                </div>
              )}
              {order.serviceMode === "delivery" && order.shippingCost > 0 && (
                <div className="flex justify-between text-white/60">
                  <span>Envío ({order.distanceKm?.toFixed(1)} km)</span>
                  <span>{formatCurrency(order.shippingCost, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black border-t border-white/5 pt-2 text-white">
                <span>Total</span>
                <span className="text-pizza-gold">{formatCurrency(order.total, currency)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* LADO DERECHO: MAPA O DETALLES DE SERVICIO */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* MAPA DE DELIVERY */}
          {order.serviceMode === "delivery" && (
            <div className="bg-[#181818] border border-white/5 rounded-3xl overflow-hidden shadow-xl flex flex-col h-[380px] lg:h-[480px]">
              <div className="bg-[#161616] px-5 py-3 border-b border-white/5 flex justify-between items-center text-left">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white/80">Ruta de Reparto</h3>
                  <span className="text-[10px] text-white/40 block">Distancia de entrega estimada: {order.distanceKm?.toFixed(1)} km</span>
                </div>
                <Truck size={18} className="text-pizza-red" />
              </div>
              <div ref={mapContainerRef} className="flex-1 w-full h-full relative" />
            </div>
          )}

          {/* DETALLES DE SERVICIO Y CONTACTO */}
          <div className="bg-[#181818] border border-white/5 rounded-3xl p-6 shadow-xl text-left space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">Datos del Servicio</h3>
            
            <div className="space-y-4">
              <div className="flex gap-3 text-xs items-start">
                <div className="p-2 rounded-xl bg-white/5 border border-white/5 text-[#ffd79b]">
                  <MapPin size={16} />
                </div>
                <div>
                  <span className="font-bold text-white/40 block uppercase text-[9px]">Ubicación</span>
                  <span className="font-semibold text-white/90">
                    {order.serviceMode === "delivery" 
                      ? order.customerAddress 
                      : order.serviceMode === "pickup" 
                      ? "Retiro en Local (Av. del Sabor 789)" 
                      : `Consumo en Salón - Mesa #${order.tableNumber}`}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 text-xs items-center">
                <div className="p-2 rounded-xl bg-white/5 border border-white/5 text-[#ffd79b]">
                  <Phone size={16} />
                </div>
                <div>
                  <span className="font-bold text-white/40 block uppercase text-[9px]">Contacto</span>
                  <span className="font-semibold text-white/90">{order.customerName} ({order.customerPhone})</span>
                </div>
              </div>
              
              {businessConfig && (
                <div className="bg-pizza-dark/80 rounded-2xl p-4 border border-white/5 text-xs text-white/60 text-center space-y-2">
                  <p>¿Tienes dudas sobre tu pedido? ¡Escríbenos directamente!</p>
                  <a
                    href={`https://wa.me/${businessConfig.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(
                      `Hola, consulto por mi orden #${order.orderNumber} a nombre de ${order.customerName}.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl transition-all"
                  >
                    <Phone size={12} />
                    WhatsApp de Soporte
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};
