import { useState } from "react";
import { setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { rDoc } from "../../firebase/tenant";
import { formatCurrency } from "../../utils/formatters";
import { TableGraphic } from "../../components/TableGraphic";
import { tableShapeFor } from "../../utils/tables";
import { Edit2, Trash2, Plus, MapPin, Users, ShoppingBag, X, Clock, Check } from "lucide-react";

const slugify = (text) =>
  text.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

const SHAPES = [
  { id: "auto", label: "Automática" },
  { id: "round", label: "Redonda" },
  { id: "square", label: "Cuadrada" },
  { id: "rect", label: "Rectangular" }
];

const emptyTableForm = { name: "", capacity: "4", zoneId: "", shape: "auto" };

// Sección "mesas": lugares (zonas) y mapa de mesas con su ocupación
export const MesasTab = ({
  tablesList,
  zonesList,
  openByTable,
  currency,
  user,
  logAuditEvent,
  onTakeOrder
}) => {
  const [activeZone, setActiveZone] = useState("all");
  const [zoneName, setZoneName] = useState("");
  const [editingZone, setEditingZone] = useState(null);
  const [tableForm, setTableForm] = useState(emptyTableForm);
  const [editingTable, setEditingTable] = useState(null);
  const [selected, setSelected] = useState(null);
  const [nowSec] = useState(() => Math.floor(Date.now() / 1000));

  const zoneById = Object.fromEntries(zonesList.map((z) => [z.id, z]));
  const visibleTables = tablesList.filter((t) =>
    activeZone === "all" ? true : activeZone === "none" ? !zoneById[t.zoneId] : t.zoneId === activeZone
  );
  const occupiedCount = tablesList.filter((t) => t.status === "ocupada" || openByTable[t.name]).length;
  const seats = tablesList.reduce((n, t) => n + Number(t.capacity || 0), 0);
  const unzoned = tablesList.filter((t) => !zoneById[t.zoneId]).length;

  // ---------- Lugares ----------
  const handleSaveZone = async (e) => {
    e.preventDefault();
    const name = zoneName.trim();
    if (!name) return;
    const id = editingZone ? editingZone.id : slugify(name) || Date.now().toString();
    try {
      await setDoc(rDoc("zones", id), { id, name, order: editingZone?.order ?? zonesList.length }, { merge: true });
      await logAuditEvent(user.email, editingZone ? "EDITAR_LUGAR" : "CREAR_LUGAR", `Lugar: ${name}`);
      setZoneName("");
      setEditingZone(null);
      setActiveZone(id);
    } catch (err) {
      console.error("Error al guardar lugar:", err);
      alert("Error al guardar el lugar.");
    }
  };

  const handleDeleteZone = async (zone) => {
    const count = tablesList.filter((t) => t.zoneId === zone.id).length;
    if (!window.confirm(`¿Eliminar "${zone.name}"?${count ? ` Sus ${count} mesa(s) quedarán sin lugar.` : ""}`)) return;
    try {
      await deleteDoc(rDoc("zones", zone.id));
      await Promise.all(tablesList.filter((t) => t.zoneId === zone.id).map((t) => updateDoc(rDoc("tables", t.id), { zoneId: "" })));
      await logAuditEvent(user.email, "ELIMINAR_LUGAR", `Lugar: ${zone.name}`);
      setActiveZone("all");
    } catch (err) {
      console.error("Error al eliminar lugar:", err);
      alert("Error al eliminar el lugar.");
    }
  };

  // ---------- Mesas ----------
  const startEditTable = (t) => {
    setEditingTable(t);
    setTableForm({ name: t.name, capacity: String(t.capacity || 4), zoneId: t.zoneId || "", shape: t.shape || "auto" });
    setSelected(null);
  };

  const cancelEditTable = () => {
    setEditingTable(null);
    setTableForm({ ...emptyTableForm, zoneId: activeZone !== "all" && activeZone !== "none" ? activeZone : "" });
  };

  const handleSaveTable = async (e) => {
    e.preventDefault();
    const name = tableForm.name.trim();
    if (!name) return alert("El nombre de la mesa es requerido.");
    if (!editingTable && tablesList.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      return alert(`Ya existe una mesa llamada "${name}".`);
    }
    const id = editingTable ? editingTable.id : slugify(name) || Date.now().toString();
    try {
      await setDoc(rDoc("tables", id), {
        id,
        name,
        capacity: Math.max(1, parseInt(tableForm.capacity, 10) || 4),
        zoneId: tableForm.zoneId || "",
        shape: tableForm.shape === "auto" ? null : tableForm.shape,
        status: editingTable ? editingTable.status || "libre" : "libre"
      }, { merge: true });
      await logAuditEvent(user.email, editingTable ? "EDITAR_MESA" : "CREAR_MESA", `Mesa: ${name} (ID: ${id})`);
      cancelEditTable();
    } catch (err) {
      console.error("Error al guardar mesa:", err);
      alert("Error al guardar mesa.");
    }
  };

  const handleToggleStatus = async (t) => {
    const next = t.status === "ocupada" ? "libre" : "ocupada";
    try {
      await updateDoc(rDoc("tables", t.id), { status: next });
      await logAuditEvent(user.email, "CAMBIAR_ESTADO_MESA", `Mesa ${t.name} cambiada a ${next}`);
      setSelected(null);
    } catch (err) {
      console.error("Error al cambiar estado de mesa:", err);
    }
  };

  const handleDeleteTable = async (t) => {
    if (!window.confirm(`¿Eliminar la mesa "${t.name}"?`)) return;
    try {
      await deleteDoc(rDoc("tables", t.id));
      await logAuditEvent(user.email, "ELIMINAR_MESA", `Mesa eliminada: ${t.name} (ID: ${t.id})`);
      setSelected(null);
    } catch (err) {
      console.error("Error al eliminar mesa:", err);
    }
  };

  const inputCls = "w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red/50";
  const labelCls = "block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5";

  const zoneTabs = [
    { id: "all", name: "Todas", count: tablesList.length },
    ...zonesList.map((z) => ({ id: z.id, name: z.name, count: tablesList.filter((t) => t.zoneId === z.id).length })),
    ...(unzoned > 0 && zonesList.length > 0 ? [{ id: "none", name: "Sin lugar", count: unzoned }] : [])
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 text-left animate-in fade-in zoom-in-95 duration-200">
      {/* Columna de gestión */}
      <div className="space-y-6">
        {/* Lugares */}
        <div className="glass-panel p-5 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 text-pizza-red">
            <MapPin size={18} />
            <h3 className="font-pizza-title font-bold text-sm uppercase">1. Lugares</h3>
          </div>
          <p className="text-[11px] text-white/40">Crea las zonas de tu local: Salón, Terraza, Segundo piso, Barra...</p>
          <form onSubmit={handleSaveZone} className="flex gap-2">
            <input value={zoneName} onChange={(e) => setZoneName(e.target.value)} placeholder="Ej. Terraza" className={inputCls} />
            <button type="submit" className="shrink-0 bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl px-3 cursor-pointer" aria-label={editingZone ? "Guardar lugar" : "Agregar lugar"}>
              {editingZone ? <Check size={16} /> : <Plus size={16} />}
            </button>
          </form>
          {editingZone && (
            <button type="button" onClick={() => { setEditingZone(null); setZoneName(""); }} className="text-[11px] text-white/50 hover:text-white cursor-pointer">
              Cancelar edición
            </button>
          )}
          <ul className="space-y-1.5">
            {zonesList.map((z) => (
              <li key={z.id} className="flex items-center justify-between bg-[#181818] border border-white/5 rounded-xl px-3 py-2">
                <span className="text-xs font-semibold">{z.name}</span>
                <span className="flex items-center gap-1">
                  <span className="text-[10px] text-white/40 mr-1">{tablesList.filter((t) => t.zoneId === z.id).length} mesas</span>
                  <button type="button" onClick={() => { setEditingZone(z); setZoneName(z.name); }} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 cursor-pointer" aria-label={`Editar ${z.name}`}>
                    <Edit2 size={12} />
                  </button>
                  <button type="button" onClick={() => handleDeleteZone(z)} className="p-1.5 rounded-lg hover:bg-pizza-red/15 text-pizza-red cursor-pointer" aria-label={`Eliminar ${z.name}`}>
                    <Trash2 size={12} />
                  </button>
                </span>
              </li>
            ))}
            {zonesList.length === 0 && <li className="text-[11px] text-white/30">Todavía no hay lugares.</li>}
          </ul>
        </div>

        {/* Mesa */}
        <div className="glass-panel p-5 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 text-pizza-red">
            <Users size={18} />
            <h3 className="font-pizza-title font-bold text-sm uppercase">{editingTable ? "Editar mesa" : "2. Mesas"}</h3>
          </div>
          <form onSubmit={handleSaveTable} className="space-y-3">
            <div>
              <label className={labelCls}>Nombre</label>
              <input required value={tableForm.name} onChange={(e) => setTableForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej. 5, T1, Barra 2" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Personas</label>
                <div className="flex items-center bg-[#181818] border border-white/5 rounded-xl">
                  <button type="button" onClick={() => setTableForm((f) => ({ ...f, capacity: String(Math.max(1, Number(f.capacity) - 1)) }))} className="px-3 py-2.5 text-white/60 hover:text-white cursor-pointer">−</button>
                  <input type="number" min="1" max="16" value={tableForm.capacity} onChange={(e) => setTableForm((f) => ({ ...f, capacity: e.target.value }))} className="w-full bg-transparent text-center text-xs font-bold text-white focus:outline-none" />
                  <button type="button" onClick={() => setTableForm((f) => ({ ...f, capacity: String(Math.min(16, Number(f.capacity) + 1)) }))} className="px-3 py-2.5 text-white/60 hover:text-white cursor-pointer">+</button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Lugar</label>
                <select value={tableForm.zoneId} onChange={(e) => setTableForm((f) => ({ ...f, zoneId: e.target.value }))} className={inputCls}>
                  <option value="">Sin lugar</option>
                  {zonesList.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Forma</label>
              <div className="grid grid-cols-4 gap-1.5">
                {SHAPES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setTableForm((f) => ({ ...f, shape: s.id }))}
                    className={`py-2 rounded-lg text-[9px] font-bold border cursor-pointer ${tableForm.shape === s.id ? "bg-pizza-red/10 border-pizza-red text-pizza-red" : "bg-[#181818] border-white/5 text-white/60"}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-center py-1 text-pizza-red">
              <TableGraphic
                table={{ name: tableForm.name || "?", capacity: tableForm.capacity, shape: tableForm.shape === "auto" ? null : tableForm.shape }}
                className="h-24 w-auto"
              />
            </div>
            <button type="submit" className="w-full bg-pizza-red text-white text-xs font-bold py-3 rounded-xl cursor-pointer hover:bg-pizza-red/90">
              {editingTable ? "Guardar cambios" : "Agregar mesa"}
            </button>
            {editingTable && (
              <button type="button" onClick={cancelEditTable} className="w-full bg-white/5 border border-white/10 text-white text-xs font-bold py-2 rounded-xl cursor-pointer hover:bg-white/10">
                Cancelar
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Mapa de mesas */}
      <div className="xl:col-span-3 glass-panel p-5 rounded-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-pizza-title font-bold text-sm uppercase">Mapa del local</h3>
            <p className="text-[11px] text-white/40">
              {occupiedCount} de {tablesList.length} mesas ocupadas · {seats} lugares
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-bold text-white/50">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Libre</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pizza-red" /> Ocupada</span>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {zoneTabs.map((z) => (
            <button
              key={z.id}
              onClick={() => setActiveZone(z.id)}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer ${activeZone === z.id ? "bg-pizza-red text-white border-pizza-red" : "bg-[#181818] border-white/5 text-white/60 hover:bg-white/5"}`}
            >
              {z.name} <span className="opacity-70">({z.count})</span>
            </button>
          ))}
        </div>

        {visibleTables.length === 0 ? (
          <div className="py-16 text-center text-xs text-white/40">
            No hay mesas aquí. Agrégalas con el formulario de la izquierda.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
            {visibleTables.map((t) => {
              const bill = openByTable[t.name];
              const occupied = t.status === "ocupada" || Boolean(bill);
              const minutes = bill?.openedAt ? Math.max(0, Math.floor((nowSec - bill.openedAt) / 60)) : null;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelected(t)}
                  className={`relative rounded-2xl border p-3 flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    occupied ? "bg-pizza-red/5 border-pizza-red/30 hover:border-pizza-red/60" : "bg-[#181818] border-white/5 hover:border-emerald-500/40"
                  }`}
                >
                  <TableGraphic
                    table={t}
                    label={t.name.replace(/^mesa\s*/i, "")}
                    className={`w-full ${tableShapeFor(t) === "rect" ? "h-20" : "h-24"} ${occupied ? "text-pizza-red" : "text-emerald-500"}`}
                  />
                  <span className="text-xs font-bold">{t.name}</span>
                  <span className="text-[10px] text-white/50 flex items-center gap-1">
                    <Users size={10} /> {t.capacity}
                    {zoneById[t.zoneId] && activeZone === "all" && <span>· {zoneById[t.zoneId].name}</span>}
                  </span>
                  {bill ? (
                    <span className="text-[11px] font-black text-pizza-red">
                      {formatCurrency(bill.total, currency)}
                      {minutes !== null && <span className="font-semibold text-white/40"> · {minutes} min</span>}
                    </span>
                  ) : (
                    <span className={`text-[10px] font-bold ${occupied ? "text-pizza-red" : "text-emerald-400"}`}>{occupied ? "Ocupada" : "Libre"}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Acciones de la mesa seleccionada */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-sm bg-[#181818] border border-white/10 rounded-3xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-base">{selected.name}</h3>
                <p className="text-[11px] text-white/50">
                  {selected.capacity} personas{zoneById[selected.zoneId] ? ` · ${zoneById[selected.zoneId].name}` : ""}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 text-white/60 hover:text-white cursor-pointer" aria-label="Cerrar"><X size={18} /></button>
            </div>
            {openByTable[selected.name] && (
              <div className="bg-pizza-dark/60 rounded-2xl p-3 text-xs space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Cuenta abierta</span>
                  <span className="text-pizza-red">{formatCurrency(openByTable[selected.name].total, currency)}</span>
                </div>
                <div className="text-white/50 flex items-center gap-1">
                  <Clock size={11} /> {openByTable[selected.name].orders.length} pedido(s). Cobra desde POS → Cuentas.
                </div>
              </div>
            )}
            <button onClick={() => { onTakeOrder(selected); setSelected(null); }} className="w-full flex items-center justify-center gap-2 bg-pizza-red hover:bg-pizza-red/90 text-white font-bold text-sm py-3 rounded-xl cursor-pointer">
              <ShoppingBag size={16} /> {openByTable[selected.name] ? "Agregar pedido" : "Tomar pedido"}
            </button>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => handleToggleStatus(selected)} className="bg-white/5 hover:bg-white/10 rounded-xl py-2.5 text-[11px] font-bold cursor-pointer">
                {selected.status === "ocupada" ? "Liberar" : "Ocupar"}
              </button>
              <button onClick={() => startEditTable(selected)} className="bg-white/5 hover:bg-white/10 rounded-xl py-2.5 text-[11px] font-bold cursor-pointer">Editar</button>
              <button onClick={() => handleDeleteTable(selected)} className="bg-pizza-red/10 hover:bg-pizza-red/20 text-pizza-red rounded-xl py-2.5 text-[11px] font-bold cursor-pointer">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
