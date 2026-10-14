import { useState, useEffect } from "react";
import { onSnapshot, query, orderBy, limit, addDoc, deleteDoc, updateDoc, increment, serverTimestamp, Timestamp } from "firebase/firestore";
import { rCol, rDoc } from "../../firebase/tenant";
import { formatCurrency } from "../../utils/formatters";
import { Plus, Trash2, ShoppingCart, Truck, Search, Loader2, PackagePlus, X } from "lucide-react";

const UNITS = ["unid.", "caja", "paquete", "botella", "kg", "litro", "docena"];
const CATEGORIES = ["Bebidas", "Descartables", "Insumos de cocina", "Limpieza", "Otros"];
const PAY = [["cash", "Efectivo"], ["transfer", "Transferencia"], ["qr", "QR"], ["credit", "Crédito"]];

const emptyLine = () => ({ key: Math.random().toString(36).slice(2), name: "", productId: "", quantity: "1", unit: "unid.", unitCost: "", category: "Bebidas" });
const today = () => new Date().toISOString().slice(0, 10);
const toMs = (ts) => (ts?.seconds ? ts.seconds * 1000 : 0);

// Sección "compras": registro de compras de insumos (bebidas, descartables, etc.)
export const ComprasTab = ({ productsList, businessConfig, user, logAuditEvent, canRegister }) => {
  const cur = businessConfig?.currency || "BOB";
  const money = (n) => formatCurrency(n, cur);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState(() => today().slice(0, 7));
  const [form, setForm] = useState({ supplier: "", docNumber: "", date: today(), paymentMethod: "cash", notes: "", addToStock: true, lines: [emptyLine()] });

  useEffect(() => {
    const q = query(rCol("purchases"), orderBy("date", "desc"), limit(500));
    return onSnapshot(q, (snap) => {
      setPurchases(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Error al cargar compras:", err);
      setLoading(false);
    });
  }, []);

  const suppliers = [...new Set(purchases.map((p) => p.supplier).filter(Boolean))];
  const lineTotal = (l) => (Number(l.quantity) || 0) * (Number(l.unitCost) || 0);
  const formTotal = form.lines.reduce((n, l) => n + lineTotal(l), 0);

  const setLine = (key, patch) => setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  const pickProduct = (key, productId) => {
    const p = productsList.find((x) => x.id === productId);
    setLine(key, p ? { productId, name: p.name } : { productId });
  };

  const resetForm = () => setForm({ supplier: "", docNumber: "", date: today(), paymentMethod: "cash", notes: "", addToStock: true, lines: [emptyLine()] });

  const handleSave = async (e) => {
    e.preventDefault();
    const lines = form.lines.filter((l) => l.name.trim() && Number(l.quantity) > 0);
    if (lines.length === 0) return alert("Agrega al menos un producto con nombre y cantidad.");
    if (formTotal <= 0) return alert("Ingresa el costo de los productos.");
    setSaving(true);
    try {
      const date = Timestamp.fromDate(new Date(`${form.date}T12:00:00`));
      const items = lines.map((l) => ({
        name: l.name.trim(),
        productId: l.productId || "",
        quantity: Number(l.quantity),
        unit: l.unit,
        unitCost: Number(l.unitCost) || 0,
        total: Math.round(lineTotal(l) * 100) / 100,
        category: l.category || "Otros"
      }));
      const total = Math.round(formTotal * 100) / 100;

      // La compra también se registra como gasto para que aparezca en Finanzas
      const expenseRef = await addDoc(rCol("expenses"), {
        description: `Compra${form.supplier ? ` a ${form.supplier}` : ""}${form.docNumber ? ` (${form.docNumber})` : ""}`,
        category: "Compras",
        amount: total,
        date: date.toDate(),
        createdBy: user.email
      });

      await addDoc(rCol("purchases"), {
        supplier: form.supplier.trim(),
        docNumber: form.docNumber.trim(),
        date,
        paymentMethod: form.paymentMethod,
        notes: form.notes.trim(),
        items,
        total,
        stockAdded: form.addToStock,
        expenseId: expenseRef.id,
        createdBy: user.email,
        createdAt: serverTimestamp()
      });

      // Sumar al stock los productos del menú que se compraron (ej. gaseosas)
      if (form.addToStock) {
        await Promise.all(items.filter((i) => i.productId).map((i) =>
          updateDoc(rDoc("products", i.productId), { stock: increment(i.quantity) }).catch(() => {})
        ));
      }
      await logAuditEvent(user.email, "REGISTRAR_COMPRA", `Compra ${form.supplier || ""} por ${money(total)}`);
      resetForm();
      setShowForm(false);
    } catch (err) {
      console.error("Error al registrar compra:", err);
      alert("No se pudo registrar la compra.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`¿Eliminar la compra${p.supplier ? ` a ${p.supplier}` : ""} por ${money(p.total)}? También se quitará el gasto${p.stockAdded ? " y se descontará el stock agregado" : ""}.`)) return;
    try {
      await deleteDoc(rDoc("purchases", p.id));
      if (p.expenseId) await deleteDoc(rDoc("expenses", p.expenseId)).catch(() => {});
      if (p.stockAdded) {
        await Promise.all((p.items || []).filter((i) => i.productId).map((i) =>
          updateDoc(rDoc("products", i.productId), { stock: increment(-i.quantity) }).catch(() => {})
        ));
      }
      await logAuditEvent(user.email, "ELIMINAR_COMPRA", `Compra ${p.supplier || ""} por ${money(p.total)}`);
    } catch (err) {
      console.error("Error al eliminar compra:", err);
      alert("No se pudo eliminar la compra.");
    }
  };

  const term = search.trim().toLowerCase();
  const visible = purchases.filter((p) => {
    const d = new Date(toMs(p.date)).toISOString().slice(0, 7);
    if (monthFilter && d !== monthFilter) return false;
    if (!term) return true;
    return [p.supplier, p.docNumber, ...(p.items || []).map((i) => i.name)].some((v) => String(v || "").toLowerCase().includes(term));
  });
  const monthTotal = visible.reduce((n, p) => n + Number(p.total || 0), 0);
  const byCategory = visible.flatMap((p) => p.items || []).reduce((acc, i) => {
    acc[i.category || "Otros"] = (acc[i.category || "Otros"] || 0) + Number(i.total || 0);
    return acc;
  }, {});
  const bySupplier = visible.reduce((acc, p) => {
    const k = p.supplier || "Sin proveedor";
    acc[k] = (acc[k] || 0) + Number(p.total || 0);
    return acc;
  }, {});
  const topSupplier = Object.entries(bySupplier).sort((a, b) => b[1] - a[1])[0];

  const inputCls = "w-full bg-[#181818] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-pizza-red/50";
  const labelCls = "block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5";

  return (
    <div className="space-y-5 text-left animate-in fade-in duration-200">
      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-panel rounded-2xl p-4">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Gastado en compras</span>
          <div className="text-2xl font-black mt-1 text-pizza-red">{money(monthTotal)}</div>
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Compras registradas</span>
          <div className="text-2xl font-black mt-1">{visible.length}</div>
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Proveedor principal</span>
          <div className="text-sm font-black mt-1 truncate">{topSupplier ? topSupplier[0] : "—"}</div>
          {topSupplier && <div className="text-[11px] text-white/50">{money(topSupplier[1])}</div>}
        </div>
        <div className="glass-panel rounded-2xl p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Por categoría</span>
          {Object.keys(byCategory).length === 0 && <div className="text-xs text-white/40">Sin compras</div>}
          {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs"><span className="text-white/60">{k}</span><span className="font-bold">{money(v)}</span></div>
          ))}
        </div>
      </div>

      {/* Barra de acciones */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar proveedor o producto..." className={`${inputCls} pl-9`} />
          </div>
          <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className={`${inputCls} max-w-[160px]`} />
        </div>
        {canRegister && (
          <button onClick={() => setShowForm(true)} className="flex items-center justify-center gap-2 bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl px-5 py-3 text-xs font-bold shadow-lg shadow-pizza-red/20 cursor-pointer">
            <Plus size={15} /> Registrar compra
          </button>
        )}
      </div>

      {/* Lista de compras */}
      <div className="space-y-3">
        {loading ? (
          <div className="glass-panel rounded-2xl py-16 text-center text-xs text-white/40 flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin text-pizza-red" /> Cargando compras...</div>
        ) : visible.length === 0 ? (
          <div className="glass-panel rounded-2xl py-16 text-center text-xs text-white/40">
            <ShoppingCart size={28} className="mx-auto mb-2 text-white/20" />
            No hay compras en este mes. Registra las compras de bebidas, vasos, servilletas e insumos.
          </div>
        ) : visible.map((p) => (
          <div key={p.id} className="glass-panel rounded-2xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pizza-red/10 text-pizza-red flex items-center justify-center"><Truck size={18} /></div>
                <div>
                  <h4 className="text-sm font-bold">{p.supplier || "Sin proveedor"}</h4>
                  <p className="text-[11px] text-white/40">
                    {new Date(toMs(p.date)).toLocaleDateString("es-BO", { day: "2-digit", month: "short", year: "numeric" })}
                    {p.docNumber ? ` · Doc. ${p.docNumber}` : ""} · {PAY.find(([k]) => k === p.paymentMethod)?.[1] || p.paymentMethod}
                    {p.stockAdded ? " · Stock actualizado" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black">{money(p.total)}</span>
                {canRegister && (
                  <button onClick={() => handleDelete(p)} className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 cursor-pointer" aria-label="Eliminar compra"><Trash2 size={14} /></button>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(p.items || []).map((i, idx) => (
                <span key={idx} className="text-[11px] bg-[#181818] border border-white/5 rounded-lg px-2.5 py-1">
                  {i.quantity} {i.unit} · {i.name} <span className="text-white/40">({money(i.total)})</span>
                </span>
              ))}
            </div>
            {p.notes && <p className="text-[11px] text-white/50 mt-2">{p.notes}</p>}
          </div>
        ))}
      </div>

      {/* Formulario de compra */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
          <form onSubmit={handleSave} className="w-full sm:max-w-3xl max-h-[95vh] bg-[#181818] text-white border border-white/10 sm:rounded-3xl rounded-t-3xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pizza-red/10 text-pizza-red flex items-center justify-center"><PackagePlus size={20} /></div>
                <div>
                  <h3 className="font-pizza-title font-bold text-base">Registrar compra</h3>
                  <p className="text-[11px] text-white/40">Bebidas, descartables, insumos y todo lo que compra el restaurante</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-white/5 text-white/60 cursor-pointer" aria-label="Cerrar"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Proveedor</label>
                  <input list="suppliers-list" value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} placeholder="Ej. Distribuidora CBN" className={inputCls} />
                  <datalist id="suppliers-list">{suppliers.map((s) => <option key={s} value={s} />)}</datalist>
                </div>
                <div>
                  <label className={labelCls}>Fecha</label>
                  <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>N° factura / nota</label>
                  <input value={form.docNumber} onChange={(e) => setForm((f) => ({ ...f, docNumber: e.target.value }))} placeholder="Opcional" className={inputCls} />
                </div>
              </div>

              {/* Líneas */}
              <div>
                <label className={labelCls}>Productos comprados</label>
                <div className="space-y-2">
                  {form.lines.map((l) => (
                    <div key={l.key} className="grid grid-cols-12 gap-2 items-center bg-[#121212] border border-white/5 rounded-xl p-2">
                      <div className="col-span-12 sm:col-span-4 space-y-1">
                        <input value={l.name} onChange={(e) => setLine(l.key, { name: e.target.value, productId: "" })} placeholder="Ej. Coca-Cola 2L, vasos 12oz" className={inputCls} />
                        <select value={l.productId} onChange={(e) => pickProduct(l.key, e.target.value)} className={`${inputCls} py-1.5 text-[11px]`}>
                          <option value="">No es del menú (insumo)</option>
                          {productsList.map((p) => <option key={p.id} value={p.id}>Del menú: {p.name}{p.stock !== undefined ? ` (stock ${p.stock})` : ""}</option>)}
                        </select>
                      </div>
                      <select value={l.category} onChange={(e) => setLine(l.key, { category: e.target.value })} className={`${inputCls} col-span-6 sm:col-span-2`}>
                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                      <input type="number" min="0" step="any" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} className={`${inputCls} col-span-3 sm:col-span-1 text-center`} aria-label="Cantidad" />
                      <select value={l.unit} onChange={(e) => setLine(l.key, { unit: e.target.value })} className={`${inputCls} col-span-3 sm:col-span-2`}>
                        {UNITS.map((u) => <option key={u}>{u}</option>)}
                      </select>
                      <input type="number" min="0" step="any" value={l.unitCost} onChange={(e) => setLine(l.key, { unitCost: e.target.value })} placeholder="Costo c/u" className={`${inputCls} col-span-6 sm:col-span-2 text-right`} />
                      <div className="col-span-6 sm:col-span-1 flex items-center justify-end gap-1">
                        <span className="text-[11px] font-bold">{money(lineTotal(l))}</span>
                        {form.lines.length > 1 && (
                          <button type="button" onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((x) => x.key !== l.key) }))} className="p-1 text-white/40 hover:text-red-400 cursor-pointer" aria-label="Quitar línea"><X size={13} /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))} className="mt-2 flex items-center gap-1.5 text-xs font-bold text-pizza-red hover:underline cursor-pointer">
                  <Plus size={13} /> Agregar otro producto
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Forma de pago</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PAY.map(([k, label]) => (
                      <button key={k} type="button" onClick={() => setForm((f) => ({ ...f, paymentMethod: k }))} className={`py-2 rounded-lg text-[10px] font-bold border cursor-pointer ${form.paymentMethod === k ? "bg-pizza-red/10 border-pizza-red text-pizza-red" : "bg-[#121212] border-white/5 text-white/60"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Notas</label>
                  <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Opcional" className={inputCls} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer select-none">
                <input type="checkbox" checked={form.addToStock} onChange={(e) => setForm((f) => ({ ...f, addToStock: e.target.checked }))} className="w-4 h-4 accent-[var(--color-pizza-red)]" />
                Sumar al stock los productos que son del menú (ej. gaseosas que se venden)
              </label>
            </div>

            <div className="p-4 border-t border-white/5 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-white/40">Total de la compra</span>
                <div className="text-xl font-black">{money(formTotal)}</div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-3 rounded-xl border border-white/10 text-xs font-bold text-white/70 hover:bg-white/5 cursor-pointer">Cancelar</button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-pizza-red hover:bg-pizza-red/90 disabled:opacity-60 text-white text-xs font-bold cursor-pointer">
                  {saving && <Loader2 size={14} className="animate-spin" />} Guardar compra
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
