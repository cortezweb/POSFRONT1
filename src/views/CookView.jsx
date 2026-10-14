import { useState, useEffect, useRef } from "react";
import { rCol, rDoc } from "../firebase/tenant";
import { query, where, onSnapshot, updateDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { logoutUser } from "../firebase/auth";
import { useCart } from "../context/CartContext";
import {
  LogOut, Check, Loader2, Clock, Volume2, VolumeX, Play, Maximize2, Minimize2,
  Undo2, AlertTriangle, ChefHat, StickyNote
} from "lucide-react";

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "dinein", label: "🍽️ Mesa" },
  { id: "pickup", label: "🥡 Llevar" },
  { id: "delivery", label: "🛵 Delivery" }
];

const serviceBadge = (o) =>
  o.serviceMode === "delivery" ? "🛵 Delivery" : o.serviceMode === "pickup" ? "🥡 Para llevar" : `🍽️ Mesa ${o.tableNumber}`;

const startSeconds = (o) => o.sentToKitchenAt?.seconds || o.approvedAt?.seconds || o.authorizedAt?.seconds || o.createdAt?.seconds || 0;

const fmtElapsed = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

export const CookView = ({ user, onLogout, isEmbedded = false }) => {
  const { businessConfig } = useCart();
  const warnMin = Number(businessConfig?.kdsWarnMinutes || 10);
  const lateMin = Number(businessConfig?.kdsLateMinutes || 20);

  const [orders, setOrders] = useState([]);
  const [readyOrders, setReadyOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem("kds_muted") === "true"; } catch { return false; }
  });

  const isInitial = useRef(true);
  const mutedRef = useRef(muted);

  useEffect(() => {
    mutedRef.current = muted;
    try { localStorage.setItem("kds_muted", muted ? "true" : "false"); } catch { /* ignorar */ }
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
      playBeep(now, 587.33, 0.2);
      playBeep(now, 880.0, 0.2);
      playBeep(now + 0.25, 587.33, 0.35);
      playBeep(now + 0.25, 880.0, 0.35);
    } catch (err) {
      console.warn("No se pudo reproducir el sonido de cocina:", err);
    }
  };

  // Reloj de la pantalla (cada 15 s)
  useEffect(() => {
    const interval = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 15000);
    return () => clearInterval(interval);
  }, []);

  // Pedidos en preparación, el más antiguo primero
  useEffect(() => {
    const q = query(rCol("orders"), where("status", "==", "preparing"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ords = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      ords.sort((a, b) => startSeconds(a) - startSeconds(b));
      if (isInitial.current) {
        isInitial.current = false;
      } else if (snapshot.docChanges().some((c) => c.type === "added") && !mutedRef.current) {
        playKitchenAlert();
      }
      setOrders(ords);
      setLoading(false);
    }, (error) => {
      console.error("Error al cargar pedidos en Cocina:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Últimos pedidos listos (para poder devolverlos a cocina)
  useEffect(() => {
    const q = query(rCol("orders"), where("status", "==", "ready"));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.preparedAt?.seconds || 0) - (a.preparedAt?.seconds || 0));
      setReadyOrders(list.slice(0, 8));
    }, (error) => console.error("Error al cargar pedidos listos:", error));
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const handleLogoutClick = async () => {
    await logoutUser();
    onLogout();
  };

  const handleMarkReady = async (orderId) => {
    try {
      await updateDoc(rDoc("orders", orderId), { status: "ready", preparedAt: serverTimestamp() });
    } catch (err) {
      console.error("Error al marcar pedido como listo:", err);
      alert("Error al actualizar estado.");
    }
  };

  const handleRecall = async (orderId) => {
    try {
      await updateDoc(rDoc("orders", orderId), { status: "preparing", preparedAt: null });
    } catch (err) {
      console.error("Error al devolver pedido a cocina:", err);
    }
  };

  // Tachar o destachar un plato (se guarda para que todas las pantallas lo vean)
  const toggleItemDone = async (order, index) => {
    const items = order.items.map((it, i) => (i === index ? { ...it, kdsDone: !it.kdsDone } : it));
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, items } : o)));
    try {
      await updateDoc(rDoc("orders", order.id), { items });
    } catch (err) {
      console.error("Error al marcar plato:", err);
    }
  };

  const visibleOrders = orders.filter((o) => filter === "all" || (o.serviceMode || "dinein") === filter);
  const elapsedOf = (o) => Math.max(0, nowSec - startSeconds(o));
  const lateCount = orders.filter((o) => elapsedOf(o) >= lateMin * 60).length;
  const avgMin = orders.length ? Math.round(orders.reduce((n, o) => n + elapsedOf(o), 0) / orders.length / 60) : 0;
  const counts = FILTERS.reduce((acc, f) => {
    acc[f.id] = f.id === "all" ? orders.length : orders.filter((o) => (o.serviceMode || "dinein") === f.id).length;
    return acc;
  }, {});

  return (
    <div className={isEmbedded ? "w-full h-full bg-pizza-dark text-white flex flex-col" : "min-h-screen bg-pizza-dark text-white flex flex-col"}>
      {/* Cabecera */}
      <header className="bg-[#161616] border-b border-white/5 px-4 md:px-6 py-3 flex flex-wrap justify-between items-center sticky top-0 z-30 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pizza-red/15 text-pizza-red flex items-center justify-center">
            <ChefHat size={22} />
          </div>
          <div>
            <h1 className="font-pizza-title text-base md:text-lg font-bold leading-tight">Cocina</h1>
            <p className="text-[10px] text-white/50">{user.email}</p>
          </div>
        </div>

        {/* Indicadores */}
        <div className="flex items-center gap-2">
          <div className="bg-[#181818] border border-white/5 rounded-xl px-3 py-1.5 text-center">
            <div className="text-lg font-black leading-none">{orders.length}</div>
            <div className="text-[9px] uppercase font-bold text-white/40 tracking-wider">En cola</div>
          </div>
          <div className={`border rounded-xl px-3 py-1.5 text-center ${lateCount > 0 ? "bg-red-500/10 border-red-500/30" : "bg-[#181818] border-white/5"}`}>
            <div className={`text-lg font-black leading-none ${lateCount > 0 ? "text-red-400" : ""}`}>{lateCount}</div>
            <div className="text-[9px] uppercase font-bold text-white/40 tracking-wider">Demorados</div>
          </div>
          <div className="bg-[#181818] border border-white/5 rounded-xl px-3 py-1.5 text-center">
            <div className="text-lg font-black leading-none">{avgMin}′</div>
            <div className="text-[9px] uppercase font-bold text-white/40 tracking-wider">Promedio</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMuted(!muted)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${muted ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}`}
            title={muted ? "Activar sonido" : "Silenciar"}
            aria-label={muted ? "Activar sonido" : "Silenciar"}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button onClick={playKitchenAlert} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer" title="Probar sonido" aria-label="Probar sonido">
            <Play size={16} />
          </button>
          <button onClick={toggleFullscreen} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer" title="Pantalla completa" aria-label="Pantalla completa">
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          {!isEmbedded && (
            <button onClick={handleLogoutClick} className="flex items-center gap-1.5 bg-pizza-red/10 border border-pizza-red/20 hover:bg-pizza-red/20 text-pizza-red text-xs font-bold py-2.5 px-3 rounded-xl cursor-pointer">
              <LogOut size={14} /> Salir
            </button>
          )}
        </div>
      </header>

      {/* Filtros */}
      <div className="px-4 md:px-6 pt-4 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              filter === f.id ? "bg-pizza-red text-white border-pizza-red" : "bg-[#181818] border-white/5 text-white/60 hover:bg-white/5"
            }`}
          >
            {f.label} <span className="opacity-70">({counts[f.id]})</span>
          </button>
        ))}
      </div>

      <main className="flex-1 p-4 md:p-6">
        {loading ? (
          <div className="py-20 text-center text-sm text-white/40 flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin text-pizza-red" />
            Cargando pedidos...
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="glass-panel py-24 text-center rounded-3xl text-white/40 text-sm">
            <ChefHat size={36} className="mx-auto mb-3 text-white/20" />
            ¡Cocina al día! No hay pedidos pendientes.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start">
            {visibleOrders.map((order) => {
              const secs = elapsedOf(order);
              const level = secs >= lateMin * 60 ? "late" : secs >= warnMin * 60 ? "warn" : "ok";
              const doneCount = order.items.filter((i) => i.kdsDone).length;
              const allDone = doneCount === order.items.length;
              const strip = level === "late" ? "bg-red-500" : level === "warn" ? "bg-amber-500" : "bg-emerald-500";
              const timeCls = level === "late" ? "bg-red-500/15 text-red-400 animate-pulse-soft" : level === "warn" ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400";

              return (
                <article
                  key={order.id}
                  className={`bg-[#181818] rounded-2xl overflow-hidden shadow-xl flex flex-col border-2 ${level === "late" ? "border-red-500/50" : "border-white/5"}`}
                >
                  <div className={`h-1.5 ${strip}`} />
                  <div className="p-4 flex justify-between items-start gap-2 border-b border-white/5">
                    <div>
                      <div className="text-2xl font-black leading-none">#{order.orderNumber}</div>
                      <div className="text-sm font-bold mt-1">{serviceBadge(order)}</div>
                      {order.customerName && order.serviceMode !== "dinein" && (
                        <div className="text-[11px] text-white/50">{order.customerName}</div>
                      )}
                    </div>
                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-black tabular-nums ${timeCls}`}>
                      {level === "late" ? <AlertTriangle size={13} /> : <Clock size={13} />}
                      {fmtElapsed(secs)}
                    </div>
                  </div>

                  <ul className="p-3 space-y-1.5">
                    {order.items.map((item, idx) => (
                      <li key={item.cartId || idx}>
                        <button
                          onClick={() => toggleItemDone(order, idx)}
                          className={`w-full text-left rounded-xl px-3 py-2.5 border transition-all cursor-pointer ${
                            item.kdsDone ? "bg-emerald-500/10 border-emerald-500/20 opacity-60" : "bg-pizza-dark/60 border-white/5 hover:border-white/15"
                          }`}
                        >
                          <div className={`flex items-start gap-2 text-base font-extrabold ${item.kdsDone ? "line-through" : ""}`}>
                            <span className="text-pizza-red min-w-[1.75rem]">{item.quantity}×</span>
                            <span className="flex-1">{item.name}</span>
                            {item.kdsDone && <Check size={16} className="text-emerald-400 shrink-0 mt-1" />}
                          </div>
                          {item.optionsSelected && Object.keys(item.optionsSelected).length > 0 && (
                            <div className="text-xs text-white/60 pl-9 mt-0.5">
                              {Object.entries(item.optionsSelected).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                            </div>
                          )}
                          {item.comboItems?.length > 0 && (
                            <div className="text-xs text-white/60 pl-9 mt-0.5">Combo: {item.comboItems.join(" + ")}</div>
                          )}
                          {item.note && (
                            <div className="mt-1.5 ml-9 text-xs font-bold text-amber-400 bg-amber-500/10 rounded-lg px-2 py-1 flex items-center gap-1">
                              <StickyNote size={11} /> {item.note}
                            </div>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>

                  {order.orderNote && (
                    <div className="mx-3 mb-3 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                      📝 {order.orderNote}
                    </div>
                  )}

                  <div className="p-3 pt-0 mt-auto">
                    <button
                      onClick={() => handleMarkReady(order.id)}
                      className={`w-full rounded-xl py-3.5 font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        allDone ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "bg-pizza-red hover:bg-pizza-red/90 text-white"
                      }`}
                    >
                      <Check size={16} />
                      Listo {order.items.length > 1 && <span className="opacity-80 font-semibold">({doneCount}/{order.items.length})</span>}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Listos recientes */}
      {readyOrders.length > 0 && (
        <footer className="border-t border-white/5 bg-[#161616] px-4 md:px-6 py-3 flex items-center gap-3 overflow-x-auto">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider shrink-0">Listos</span>
          {readyOrders.map((o) => (
            <div key={o.id} className="shrink-0 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl pl-3 pr-1 py-1">
              <span className="text-xs font-black text-emerald-400">#{o.orderNumber}</span>
              <span className="text-[10px] text-white/50">{serviceBadge(o)}</span>
              <button onClick={() => handleRecall(o.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white cursor-pointer" title="Devolver a cocina" aria-label={`Devolver pedido ${o.orderNumber} a cocina`}>
                <Undo2 size={13} />
              </button>
            </div>
          ))}
        </footer>
      )}
    </div>
  );
};
