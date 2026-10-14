import { useState, useEffect } from "react";
import { db, firebaseConfig } from "../firebase/config";
import { collection, doc, onSnapshot, query, orderBy, setDoc, updateDoc, serverTimestamp, Timestamp, getDoc } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { logoutUser } from "../firebase/auth";
import { normalizeSlug } from "../firebase/tenant";
import { PERMISSIONS } from "../utils/permissionsConfig";
import { PLANS, getRestaurantStatus, toDate } from "../utils/restaurantStatus";
import { Building2, Plus, LogOut, Loader2, ExternalLink, Power, CalendarClock, Search } from "lucide-react";

const emptyForm = { name: "", slug: "", plan: "trial", adminEmail: "", adminPassword: "", whatsappNumber: "" };

// Panel del dueño de GloryChef: alta y control de restaurantes clientes
export const SuperAdminView = ({ user, onLogout }) => {
  const [restaurants, setRestaurants] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const q = query(collection(db, "restaurants"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setRestaurants(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => setError(`No se pudo cargar la lista: ${err.message}`));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    const slug = normalizeSlug(form.slug || form.name);
    if (slug.length < 2) return setError("El identificador debe tener al menos 2 letras o números.");
    if (form.adminPassword.length < 6) return setError("La contraseña del admin debe tener al menos 6 caracteres.");

    setCreating(true);
    let secondaryApp;
    try {
      if ((await getDoc(doc(db, "restaurants", slug))).exists()) {
        throw new Error(`Ya existe un restaurante con el identificador "${slug}".`);
      }

      // 1. Cuenta del administrador del restaurante (sin cerrar la sesión del dueño)
      secondaryApp = initializeApp(firebaseConfig, `SuperAdmin-${Date.now()}`);
      const cred = await createUserWithEmailAndPassword(getAuth(secondaryApp), form.adminEmail.trim(), form.adminPassword);

      // 2. Ficha del restaurante
      const trialDays = PLANS[form.plan]?.days;
      await setDoc(doc(db, "restaurants", slug), {
        name: form.name.trim(),
        slug,
        plan: form.plan,
        active: true,
        ownerEmail: form.adminEmail.trim(),
        trialEndsAt: trialDays ? Timestamp.fromDate(new Date(Date.now() + trialDays * 86400000)) : null,
        createdAt: serverTimestamp(),
        createdBy: user.email
      });

      // 3. Configuración inicial
      await setDoc(doc(db, "restaurants", slug, "config", "settings"), {
        name: form.name.trim(),
        whatsappNumber: form.whatsappNumber.trim(),
        currency: "BOB",
        logoUrl: "",
        brandColor: "#ff5200",
        serviceModes: { delivery: true, pickup: true, dineIn: true, tableNumbers: 10, tableLabel: "Mesa" }
      });

      // 4. Rol del administrador
      await setDoc(doc(db, "users", cred.user.uid), {
        email: form.adminEmail.trim(),
        role: "admin",
        restaurantId: slug,
        permissions: Object.values(PERMISSIONS),
        disabled: false
      });

      setForm(emptyForm);
      alert(`Restaurante "${form.name}" creado.\nAdmin: ${form.adminEmail}\nMenú: ${window.location.origin}/?r=${slug}`);
    } catch (err) {
      console.error("Error creando restaurante:", err);
      setError(err.code === "auth/email-already-in-use" ? "Ese correo ya tiene una cuenta." : err.message);
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp).catch(() => {});
      setCreating(false);
    }
  };

  const toggleActive = (r) => updateDoc(doc(db, "restaurants", r.id), { active: r.active === false });

  const changePlan = (r, plan) => {
    const trialDays = PLANS[plan]?.days;
    return updateDoc(doc(db, "restaurants", r.id), {
      plan,
      trialEndsAt: trialDays ? Timestamp.fromDate(new Date(Date.now() + trialDays * 86400000)) : null
    });
  };

  const extendTrial = (r, days) => {
    const base = Math.max(Date.now(), toDate(r.trialEndsAt)?.getTime() || 0);
    return updateDoc(doc(db, "restaurants", r.id), { trialEndsAt: Timestamp.fromDate(new Date(base + days * 86400000)) });
  };

  const handleLogout = async () => {
    await logoutUser();
    onLogout();
  };

  const filtered = restaurants.filter((r) =>
    `${r.name} ${r.slug} ${r.ownerEmail || ""}`.toLowerCase().includes(search.toLowerCase())
  );
  const activeCount = restaurants.filter((r) => getRestaurantStatus(r, now).ok).length;

  const inputCls = "w-full bg-[#181818] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red/50";
  const labelCls = "block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5";

  return (
    <div className="min-h-screen bg-pizza-dark text-white">
      <header className="bg-pizza-red px-4 md:px-8 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xl">👨‍🍳</div>
          <div>
            <h1 className="font-pizza-title font-bold text-white leading-tight">GloryChef</h1>
            <span className="text-[10px] text-white/80">Panel del dueño · {user.email}</span>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer">
          <LogOut size={14} /> Salir
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="glass-panel rounded-3xl p-6 space-y-4 h-fit">
          <div className="flex items-center gap-2 text-pizza-red">
            <Plus size={18} />
            <h2 className="font-pizza-title font-bold text-sm uppercase">Nuevo restaurante</h2>
          </div>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className={labelCls}>Nombre</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej. Pollos Don Juan" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Identificador (dirección del menú)</label>
              <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder={normalizeSlug(form.name) || "pollos-don-juan"} className={inputCls} />
              <p className="text-[10px] text-white/40 mt-1">Menú: ?r={normalizeSlug(form.slug || form.name) || "..."}</p>
            </div>
            <div>
              <label className={labelCls}>WhatsApp</label>
              <input value={form.whatsappNumber} onChange={(e) => setForm((f) => ({ ...f, whatsappNumber: e.target.value }))} placeholder="+591..." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Plan</label>
              <select value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))} className={inputCls}>
                {Object.entries(PLANS).map(([k, p]) => <option key={k} value={k}>{p.label}{p.days ? ` (${p.days} días)` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Correo del administrador</label>
              <input required type="email" value={form.adminEmail} onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Contraseña inicial</label>
              <input required type="password" minLength={6} value={form.adminPassword} onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))} className={inputCls} />
            </div>
            {error && <p className="text-[11px] text-red-400 font-medium">{error}</p>}
            <button type="submit" disabled={creating} className="w-full flex items-center justify-center gap-2 bg-pizza-red hover:bg-pizza-red/90 disabled:opacity-60 text-white font-bold text-xs py-3 rounded-xl cursor-pointer">
              {creating && <Loader2 size={14} className="animate-spin" />}
              {creating ? "Creando..." : "Crear restaurante"}
            </button>
          </form>
        </section>

        <section className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-panel rounded-2xl p-4">
              <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Restaurantes</span>
              <div className="text-2xl font-black mt-1">{restaurants.length}</div>
            </div>
            <div className="glass-panel rounded-2xl p-4">
              <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Con acceso activo</span>
              <div className="text-2xl font-black mt-1 text-emerald-400">{activeCount}</div>
            </div>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar restaurante..." className={`${inputCls} pl-9`} />
          </div>

          {filtered.length === 0 && (
            <div className="glass-panel rounded-2xl p-8 text-center text-xs text-white/50">
              <Building2 size={28} className="mx-auto mb-2 text-white/30" />
              Todavía no hay restaurantes. Crea el primero con el formulario.
            </div>
          )}

          {filtered.map((r) => {
            const status = getRestaurantStatus(r, now);
            return (
              <div key={r.id} className="glass-panel rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm truncate">{r.name}</h3>
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${status.ok ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50 truncate">{r.slug} · {r.ownerEmail || "sin admin"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select value={r.plan || "trial"} onChange={(e) => changePlan(r, e.target.value)} className="bg-[#181818] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white cursor-pointer">
                    {Object.entries(PLANS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
                  </select>
                  {r.plan === "trial" && (
                    <button onClick={() => extendTrial(r, 7)} title="Extender prueba 7 días" className="flex items-center gap-1 bg-white/5 hover:bg-white/10 rounded-lg px-2.5 py-1.5 text-[11px] cursor-pointer">
                      <CalendarClock size={12} /> +7 días
                    </button>
                  )}
                  <a href={`/?r=${r.slug}`} target="_blank" rel="noreferrer" title="Abrir menú" className="flex items-center gap-1 bg-white/5 hover:bg-white/10 rounded-lg px-2.5 py-1.5 text-[11px]">
                    <ExternalLink size={12} /> Menú
                  </a>
                  <button onClick={() => toggleActive(r)} className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold cursor-pointer ${r.active === false ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25" : "bg-red-500/15 text-red-400 hover:bg-red-500/25"}`}>
                    <Power size={12} /> {r.active === false ? "Activar" : "Suspender"}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
};
