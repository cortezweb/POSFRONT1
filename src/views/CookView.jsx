import { useState, useEffect, useRef } from "react";
import { db } from "../firebase/config";
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { logoutUser } from "../firebase/auth";
import { LogOut, ClipboardList, Check, Loader2, Clock, Volume2, VolumeX, Play } from "lucide-react";

export const CookView = ({ user, onLogout, isEmbedded = false }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeTick, setTimeTick] = useState(0);
  const [muted, setMuted] = useState(() => {
    return localStorage.getItem("kds_muted") === "true";
  });

  const isInitial = useRef(true);
  const mutedRef = useRef(muted);

  useEffect(() => {
    mutedRef.current = muted;
    localStorage.setItem("kds_muted", muted ? "true" : "false");
  }, [muted]);

  const playKitchenAlert = () => {
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
        gain.gain.linearRampToValueAtTime(0.35, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(time);
        osc.stop(time + duration);
      };

      const now = ctx.currentTime;
      // Primer tono dual (Re5 + La5)
      playBeep(now, 587.33, 0.2);
      playBeep(now, 880.00, 0.2);
      
      // Segundo tono dual despues de un silencio de 50ms
      playBeep(now + 0.25, 587.33, 0.35);
      playBeep(now + 0.25, 880.00, 0.35);
    } catch (err) {
      console.warn("No se pudo reproducir el sonido de cocina:", err);
    }
  };

  // Intervalo para actualizar el tiempo relativo de los pedidos cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Escuchar órdenes en estado 'preparing' en tiempo real, de la más antigua a la más reciente (FIFO)
  useEffect(() => {
    const q = query(
      collection(db, "orders"),
      where("status", "==", "preparing"),
      orderBy("createdAt", "asc") // Las más viejas primero
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ords = [];
      snapshot.forEach((doc) => {
        ords.push({ id: doc.id, ...doc.data() });
      });

      if (isInitial.current) {
        isInitial.current = false;
      } else {
        const newAdded = snapshot.docChanges().some(change => change.type === "added");
        if (newAdded && !mutedRef.current) {
          playKitchenAlert();
        }
      }

      setOrders(ords);
      setLoading(false);
    }, (error) => {
      console.error("Error al cargar pedidos en Cocina:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogoutClick = async () => {
    await logoutUser();
    onLogout();
  };

  const handleMarkReady = async (orderId) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: "ready",
        preparedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error al marcar pedido como listo:", err);
      alert("Error al actualizar estado.");
    }
  };

  const getElapsedTime = (createdAt) => {
    if (!createdAt) return "";
    const createdDate = new Date(createdAt.seconds * 1000);
    const now = new Date();
    const diffMs = now - createdDate;
    const diffMins = Math.floor(diffMs / 1000 / 60);
    return `${diffMins} min`;
  };

  return (
    <div className={isEmbedded ? "w-full h-full bg-pizza-dark text-white flex flex-col" : "min-h-screen bg-pizza-dark text-white flex flex-col"}>
      {/* Cabecera Cocina */}
      <header className={`bg-[#161616] border-b border-white/5 px-6 py-4 flex flex-wrap justify-between items-center sticky top-0 z-30 gap-3 ${isEmbedded ? "md:px-4 py-3" : ""}`}>
        {/* Ocultar sección de título/logo si es embedded y en móvil, o mostrarla compacta en desktop */}
        <div className={`items-center gap-3 ${isEmbedded ? "hidden md:flex" : "flex"}`}>
          <span className="text-2xl md:text-3xl">👨‍🍳</span>
          <div>
            <h1 className="font-pizza-title text-base md:text-xl font-bold flex items-center gap-2">
              Pantalla de Cocina (KDS)
              <span className="bg-[#ffd79b]/10 text-[#ffd79b] border border-[#ffd79b]/20 text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                Kitchen
              </span>
            </h1>
            <p className="text-[10px] text-white/50">Panel en Tiempo Real ({user.email})</p>
          </div>
        </div>

        {/* Mostrar título compacto en móvil si es embedded */}
        {isEmbedded && (
          <div className="flex md:hidden items-center gap-1.5">
            <span className="text-xl">👨‍🍳</span>
            <span className="font-pizza-title text-sm font-bold">Cocina KDS</span>
          </div>
        )}

        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={() => setMuted(!muted)}
            className={`flex items-center gap-1.5 border text-[10px] md:text-xs font-bold py-1.5 px-2.5 md:py-2 md:px-3.5 rounded-xl transition-all cursor-pointer ${
              muted 
                ? "bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20" 
                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20"
            }`}
            title={muted ? "Activar sonido de alerta" : "Silenciar alertas"}
          >
            {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            <span className="hidden sm:inline">{muted ? "Alertas Silenciadas" : "Alertas Activas"}</span>
            <span className="sm:hidden">{muted ? "Silenciado" : "Activo"}</span>
          </button>

          <button
            onClick={playKitchenAlert}
            className="flex items-center gap-1.5 bg-[#ffd79b]/10 border border-[#ffd79b]/20 hover:bg-[#ffd79b]/20 text-[#ffd79b] text-[10px] md:text-xs font-bold py-1.5 px-2.5 md:py-2 md:px-3.5 rounded-xl transition-all cursor-pointer animate-pulse"
            title="Probar sonido y activar audio del navegador"
          >
            <Play size={10} fill="currentColor" />
            <span className="hidden sm:inline">Probar Sonido</span>
            <span className="sm:hidden">Probar</span>
          </button>

          {!isEmbedded && (
            <button
              onClick={handleLogoutClick}
              className="flex items-center gap-1.5 bg-pizza-red/10 border border-pizza-red/20 hover:bg-pizza-red/20 text-pizza-red text-xs font-bold py-2 px-4 rounded-xl transition-all cursor-pointer"
            >
              <LogOut size={14} />
              Cerrar Sesión
            </button>
          )}
        </div>
      </header>

      {/* Grid de órdenes en preparación */}
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 flex items-center gap-2">
            <ClipboardList size={16} className="text-pizza-red" />
            Cola de Pedidos por Preparar: <strong className="text-pizza-red">{orders.length}</strong>
          </h3>
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm text-white/40 flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin text-pizza-red" />
            Conectando a la línea de fuego...
          </div>
        ) : orders.length === 0 ? (
          <div className="glass-panel py-24 text-center rounded-3xl border border-white/5 text-white/30 text-sm">
            🥗 ¡Cocina al día! No hay pedidos pendientes de preparar por el momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {orders.map((order, idx) => {
              const minutesElapsed = order.createdAt ? getElapsedTime(order.createdAt) : "";

              return (
                <div
                  key={order.id}
                  className="bg-[#181818] border-2 border-white/5 hover:border-pizza-red/35 rounded-3xl overflow-hidden shadow-xl flex flex-col justify-between"
                >
                  {/* Tarjeta Cabecera */}
                  <div className="bg-[#1a1a1a] border-b border-white/5 p-4 flex justify-between items-center">
                    <div>
                      <span className="text-lg font-black text-[#ffd79b]">Orden #{order.orderNumber}</span>
                      <span className="block text-[10px] text-white/40">Posición: #{idx + 1} en cola</span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 bg-pizza-red/10 border border-pizza-red/20 px-3 py-1 rounded-full text-xs text-pizza-red font-bold">
                      <Clock size={12} />
                      Hace {minutesElapsed}
                    </div>
                  </div>

                  {/* Detalle de Productos a Preparar */}
                  <div className="p-5 flex-1 text-left space-y-4">
                    {/* Indicación de modo de entrega */}
                    <div className="flex justify-between items-center text-[10px] uppercase font-bold text-white/50 border-b border-white/5 pb-2">
                      <span>Servicio: {
                        order.serviceMode === "delivery" ? "🚀 Delivery" :
                        order.serviceMode === "pickup" ? "🥡 Recojo" : `🍽️ Mesa ${order.tableNumber}`
                      }</span>
                      {order.tableNumber && <span>Mesa: {order.tableNumber}</span>}
                    </div>

                    <div className="space-y-3">
                      {order.items.map((item, itemIdx) => (
                        <div key={item.cartId || itemIdx} className="bg-pizza-dark/60 rounded-xl p-3 border border-white/5">
                          <div className="flex justify-between items-start">
                            <span className="text-sm font-extrabold text-white">
                              {item.quantity}x {item.name}
                            </span>
                          </div>
                          
                          {/* Modificadores */}
                          {item.optionsSelected && Object.keys(item.optionsSelected).length > 0 && (
                            <div className="text-[11px] text-[#ffd79b] mt-1.5 pl-2 border-l-2 border-[#ffd79b]/40 leading-snug space-y-0.5">
                              {Object.entries(item.optionsSelected).map(([k, v]) => (
                                <div key={k}>
                                  <strong className="text-white/40">{k}:</strong> {v}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Items de combo */}
                          {item.comboItems && item.comboItems.length > 0 && (
                            <div className="text-[11px] text-pizza-red mt-2 pl-2 border-l-2 border-pizza-red/40 leading-snug">
                              <strong>Combo:</strong> {item.comboItems.join(" + ")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Botón de listado */}
                  <div className="p-4 bg-[#1a1a1a]/40 border-t border-white/5">
                    <button
                      onClick={() => handleMarkReady(order.id)}
                      className="w-full bg-pizza-red hover:bg-pizza-red/90 text-white rounded-2xl py-3.5 font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-pizza-red/10"
                    >
                      <Check size={16} />
                      Listo para Despacho
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
