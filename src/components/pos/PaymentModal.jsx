import { useState, useEffect } from "react";
import { onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { rCol, rDoc } from "../../firebase/tenant";
import { formatCurrency } from "../../utils/formatters";
import { Receipt, X, Check, Loader2, Plus, CheckCircle2 } from "lucide-react";
import { RECEIPT_TYPES, PAY_METHODS } from "../../utils/payments";

const GENERIC_CUSTOMER = { id: "", name: "Clientes Varios", docType: "CI/NIT", docNumber: "0" };
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Ventana "Procesar pago": cliente, comprobante, descuento y uno o varios métodos de pago.
 * onConfirm recibe el resumen del pago y se encarga de registrar la venta.
 */
export const PaymentModal = ({ amountDue, businessConfig, title = "Procesar pago", subtitle, defaultCustomerName, onClose, onConfirm }) => {
  const currency = businessConfig?.currency || "BOB";
  const taxRate = Number(businessConfig?.tax?.taxRate ?? 13);
  const qrUrl = businessConfig?.yapeQrUrl;

  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: defaultCustomerName || "", docType: "CI", docNumber: "", phone: "" });
  const [receiptType, setReceiptType] = useState("nota");
  const [serie, setSerie] = useState("NV001");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [methods, setMethods] = useState(["cash"]);
  const [amounts, setAmounts] = useState({});
  const [refs, setRefs] = useState({});
  const [exact, setExact] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return onSnapshot(rCol("customers"), (snap) => {
      setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || "").localeCompare(b.name || "")));
    }, () => {});
  }, []);

  const discount = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const total = round2(amountDue * (1 - discount / 100));
  const taxBase = round2(total / (1 + taxRate / 100));
  const taxAmount = round2(total - taxBase);

  const single = methods.length === 1;
  const amountFor = (m) => {
    if (single) {
      if (exact || amounts[m] === undefined || amounts[m] === "") return total;
      return Number(amounts[m]) || 0;
    }
    return Number(amounts[m]) || 0;
  };
  const sumPayments = round2(methods.reduce((n, m) => n + amountFor(m), 0));
  const change = methods.includes("cash") ? Math.max(0, round2(sumPayments - total)) : 0;
  const missing = Math.max(0, round2(total - sumPayments));

  const customer = customers.find((c) => c.id === customerId) || GENERIC_CUSTOMER;

  const toggleMethod = (m) => {
    setError("");
    setMethods((prev) => {
      if (prev.includes(m)) return prev.length === 1 ? prev : prev.filter((x) => x !== m);
      return [...prev, m];
    });
  };

  const setQuickCash = (value) => {
    setExact(value === "exact");
    if (value !== "exact") setAmounts((a) => ({ ...a, [methods.includes("cash") ? "cash" : methods[0]]: String(value) }));
  };

  const handleReceiptType = (t) => {
    setReceiptType(t.id);
    setSerie(t.series[0]);
  };

  const handleSaveCustomer = async () => {
    if (!newCustomer.name.trim()) return setError("Escribe el nombre del cliente.");
    const id = `${newCustomer.docNumber || Date.now()}`.replace(/[^a-zA-Z0-9-]/g, "") || String(Date.now());
    try {
      await setDoc(rDoc("customers", id), { ...newCustomer, name: newCustomer.name.trim(), createdAt: serverTimestamp() }, { merge: true });
      setCustomerId(id);
      setShowNewCustomer(false);
      setError("");
    } catch (err) {
      console.error("Error al guardar cliente:", err);
      setError("No se pudo guardar el cliente.");
    }
  };

  const handleConfirm = async () => {
    setError("");
    if (receiptType === "factura" && (!customer.docNumber || customer.docNumber === "0")) {
      return setError("Para factura elige o registra un cliente con NIT/CI.");
    }
    if (missing > 0) return setError(`Faltan ${formatCurrency(missing, currency)} para completar el pago.`);
    // Lo que cada método realmente cubre (el vuelto sale del efectivo)
    let remaining = total;
    const nonCash = methods.filter((m) => m !== "cash");
    const ordered = [...nonCash, ...methods.filter((m) => m === "cash")];
    const payments = ordered.map((m) => {
      const applied = Math.min(amountFor(m), remaining);
      remaining = round2(remaining - applied);
      return { method: m, amount: round2(applied), received: round2(amountFor(m)), reference: refs[m] || "" };
    }).filter((p) => p.amount > 0 || methods.length === 1);

    setSaving(true);
    try {
      await onConfirm({
        customer: { id: customer.id, name: customer.name, docType: customer.docType || "CI/NIT", docNumber: customer.docNumber || "0" },
        receiptType,
        serie,
        discountPercent: discount,
        payments,
        change,
        total,
        taxBase,
        taxAmount
      });
    } catch (err) {
      console.error("Error al finalizar la venta:", err);
      setError(err.message || "No se pudo registrar la venta.");
      setSaving(false);
    }
  };

  const labelCls = "block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5";
  const fieldCls = "w-full bg-[#121212] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-pizza-red/60";
  const cashTarget = methods.includes("cash") ? "cash" : methods[0];
  const quick = [20, 50, 100, 200].filter((v) => v >= total * 0.2);

  return (
    <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="w-full sm:max-w-md max-h-[96vh] bg-[#181818] border border-white/10 sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col text-left">
        {/* Encabezado */}
        <div className="flex items-center justify-between p-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pizza-red/10 text-pizza-red flex items-center justify-center"><Receipt size={20} /></div>
            <div>
              <h3 className="font-pizza-title text-base font-bold leading-tight">{title}</h3>
              <p className="text-[11px] text-white/40">{subtitle || businessConfig?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-white cursor-pointer" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-4">
          {/* Cliente */}
          <div>
            <label className={labelCls}>Cliente</label>
            <div className="flex gap-2">
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={fieldCls}>
                <option value="">Clientes Varios (CI/NIT: 0)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.docNumber ? ` (${c.docType || "CI"}: ${c.docNumber})` : ""}</option>
                ))}
              </select>
              <button type="button" onClick={() => setShowNewCustomer((v) => !v)} className="shrink-0 flex items-center gap-1 px-3 rounded-xl border border-pizza-red/40 text-pizza-red text-xs font-bold hover:bg-pizza-red/10 cursor-pointer">
                <Plus size={13} /> Nuevo
              </button>
            </div>
            {showNewCustomer && (
              <div className="mt-2 p-3 rounded-2xl bg-[#121212] border border-white/5 space-y-2">
                <input value={newCustomer.name} onChange={(e) => setNewCustomer((c) => ({ ...c, name: e.target.value }))} placeholder="Nombre o razón social" className={fieldCls} />
                <div className="grid grid-cols-3 gap-2">
                  <select value={newCustomer.docType} onChange={(e) => setNewCustomer((c) => ({ ...c, docType: e.target.value }))} className={fieldCls}>
                    {["CI", "NIT", "CEX", "PAS"].map((d) => <option key={d}>{d}</option>)}
                  </select>
                  <input value={newCustomer.docNumber} onChange={(e) => setNewCustomer((c) => ({ ...c, docNumber: e.target.value }))} placeholder="Número" className={`${fieldCls} col-span-2`} />
                </div>
                <input value={newCustomer.phone} onChange={(e) => setNewCustomer((c) => ({ ...c, phone: e.target.value }))} placeholder="Teléfono (opcional)" className={fieldCls} />
                <button type="button" onClick={handleSaveCustomer} className="w-full bg-pizza-red hover:bg-pizza-red/90 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer">Guardar cliente</button>
              </div>
            )}
          </div>

          {/* Comprobante */}
          <div>
            <label className={labelCls}>Comprobante</label>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#121212] border border-white/5">
              {RECEIPT_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleReceiptType(t)}
                  className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${receiptType === t.id ? "bg-pizza-red text-white shadow" : "text-white/60 hover:text-white"}`}
                >
                  {t.label}
                  {t.badge && <span className={`text-[8px] font-black px-1 py-0.5 rounded ${receiptType === t.id ? "bg-white/25" : "bg-pizza-red/15 text-pizza-red"}`}>{t.badge}</span>}
                </button>
              ))}
            </div>
            {receiptType === "factura" && (
              <p className="text-[10px] text-amber-400 mt-1.5">La factura se registra en el sistema; el envío electrónico al SIAT todavía no está conectado.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Serie</label>
              <select value={serie} onChange={(e) => setSerie(e.target.value)} className={fieldCls}>
                {RECEIPT_TYPES.find((t) => t.id === receiptType).series.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Descuento</label>
              <div className="flex rounded-xl overflow-hidden border border-white/10">
                <span className="bg-pizza-red text-white text-xs font-black px-3 flex items-center">%</span>
                <input type="number" min="0" max="100" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} className="w-full bg-[#121212] px-3 py-2.5 text-xs text-white text-right focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Métodos de pago */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                Métodos de pago <span className="bg-pizza-red text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center">{methods.length}</span>
              </span>
              <span className="text-[10px] text-white/40">Puedes combinar varios</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PAY_METHODS.map(({ id, label, icon: Icon, tint }) => {
                const on = methods.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleMethod(id)}
                    className={`relative rounded-2xl border-2 py-3 flex flex-col items-center gap-1.5 cursor-pointer transition-all ${on ? "border-pizza-red bg-pizza-red/5" : "border-white/5 bg-[#121212] hover:border-white/15"}`}
                  >
                    {on && <CheckCircle2 size={14} className="absolute top-2 right-2 text-pizza-red" />}
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${tint}`}><Icon size={18} /></span>
                    <span className="text-xs font-bold">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Montos */}
          <div className="space-y-2">
            {methods.map((m) => {
              const meta = PAY_METHODS.find((x) => x.id === m);
              return (
                <div key={m} className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-white/40 mb-1">{m === "cash" ? "Monto recibido" : `Monto ${meta.label}`}</label>
                    <div className="flex items-center bg-[#121212] border border-white/10 rounded-xl px-3">
                      <span className="text-[11px] text-white/40">{currency === "BOB" ? "Bs." : currency}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        value={single && exact ? total.toFixed(2) : amounts[m] ?? ""}
                        onChange={(e) => { setExact(false); setAmounts((a) => ({ ...a, [m]: e.target.value })); }}
                        className="w-full bg-transparent py-2.5 text-right text-sm font-bold text-white focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-white/40 mb-1">N° Op / Ref.</label>
                    <input
                      value={refs[m] || ""}
                      onChange={(e) => setRefs((r) => ({ ...r, [m]: e.target.value }))}
                      disabled={m === "cash"}
                      placeholder={m === "cash" ? "—" : "Opcional"}
                      className={`${fieldCls} disabled:opacity-40`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {methods.includes("qr") && qrUrl && (
            <div className="flex justify-center">
              <img src={qrUrl} alt="QR de pago" className="w-32 h-32 bg-white rounded-xl p-1.5 object-contain" />
            </div>
          )}

          {single && (
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1.5">Billetes rápidos</span>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setQuickCash("exact")} className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border ${exact ? "bg-pizza-red text-white border-pizza-red" : "bg-[#121212] border-white/10 text-white/70"}`}>Exacto</button>
                {quick.map((v) => (
                  <button key={v} type="button" onClick={() => setQuickCash(v)} className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border ${!exact && Number(amounts[cashTarget]) === v ? "bg-pizza-red text-white border-pizza-red" : "bg-[#121212] border-white/10 text-white/70"}`}>
                    {currency === "BOB" ? "Bs." : currency} {v}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 mt-2 text-xs text-pizza-red font-semibold cursor-pointer select-none">
                <input type="checkbox" checked={exact} onChange={(e) => setExact(e.target.checked)} className="accent-[var(--color-pizza-red)] w-4 h-4" />
                Pago exacto
              </label>
            </div>
          )}

          {/* Resumen */}
          <div className="rounded-2xl bg-[#121212] border border-white/5 p-4 space-y-1.5 text-xs">
            <div className="flex justify-between text-white/50"><span>Op. Gravadas</span><span>{formatCurrency(taxBase, currency)}</span></div>
            <div className="flex justify-between text-white/50"><span>I.V.A. ({taxRate}%) / Impuestos</span><span>{formatCurrency(taxAmount, currency)}</span></div>
            {discount > 0 && (
              <div className="flex justify-between text-pizza-red"><span>Descuento ({discount}%)</span><span>-{formatCurrency(round2(amountDue - total), currency)}</span></div>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t border-white/5">
              <span className="text-sm font-bold">Total a pagar</span>
              <span className="text-xl font-black">{formatCurrency(total, currency)}</span>
            </div>
            <div className="flex justify-between text-white/50"><span>Suma de pagos</span><span className="font-bold text-pizza-red">{formatCurrency(sumPayments, currency)}</span></div>
            {change > 0 && <div className="flex justify-between font-bold text-emerald-400"><span>Cambio</span><span>{formatCurrency(change, currency)}</span></div>}
            {missing > 0 && <div className="flex justify-between font-bold text-amber-400"><span>Falta</span><span>{formatCurrency(missing, currency)}</span></div>}
          </div>
          {error && <p className="text-xs text-red-400 font-semibold">{error}</p>}
        </div>

        {/* Pie */}
        <div className="p-4 border-t border-white/5 grid grid-cols-[1fr_2fr] gap-3">
          <button type="button" onClick={onClose} className="py-3 rounded-xl border border-white/10 text-sm font-bold text-white/70 hover:bg-white/5 cursor-pointer">Cancelar</button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="py-3 rounded-xl bg-pizza-red hover:bg-pizza-red/90 disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-pizza-red/20 cursor-pointer"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving ? "Registrando..." : "Finalizar venta"}
          </button>
        </div>
      </div>
    </div>
  );
};
