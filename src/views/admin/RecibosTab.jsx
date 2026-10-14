import { useState, useEffect } from "react";
import { onSnapshot, query, orderBy, limit, updateDoc, serverTimestamp } from "firebase/firestore";
import { rCol, rDoc } from "../../firebase/tenant";
import { formatCurrency } from "../../utils/formatters";
import { payMethodLabel } from "../../utils/payments";
import { RECEIPT_TITLES } from "../../utils/receiptPdf";
import { SaleReceiptModal } from "../../components/pos/SaleReceiptModal";
import { TicketTemplate } from "../../components/TicketTemplate";
import { Search, Receipt, Download, Ban, Loader2, FileText } from "lucide-react";

const PERIODS = [
  { id: "today", label: "Hoy" },
  { id: "week", label: "7 días" },
  { id: "month", label: "Este mes" },
  { id: "all", label: "Todo" }
];

const toMs = (ts) => (ts?.seconds ? ts.seconds * 1000 : ts instanceof Date ? ts.getTime() : 0);

const periodStart = (period, now) => {
  const d = new Date(now);
  if (period === "today") return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (period === "week") return now - 7 * 86400000;
  if (period === "month") return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  return 0;
};

// Convierte una venta guardada al formato del recibo
const saleToReceipt = (s) => ({
  receiptNumber: s.receiptNumber,
  receiptType: s.receiptType,
  createdAtMs: toMs(s.createdAt),
  customer: { ...(s.customer || {}), phone: s.customer?.phone || s.customerPhone || "", address: s.customerAddress || "" },
  customerPhone: s.customerPhone || "",
  serviceMode: s.serviceMode,
  tableNumber: s.tableNumber,
  items: s.items || [],
  subtotal: (s.items || []).reduce((n, i) => n + i.price * i.quantity, 0),
  discount: Math.max(0, Math.round(((s.grossTotal || s.total) - s.total) * 100) / 100),
  taxBase: s.taxBase || 0,
  taxAmount: s.taxAmount || 0,
  shippingCost: 0,
  total: s.total || 0,
  payments: s.payments || [],
  change: s.change || 0,
  primaryMethod: s.primaryMethod || s.payments?.[0]?.method || ""
});

// Sección "recibos": historial de comprobantes emitidos en el POS
export const RecibosTab = ({ businessConfig, canVoid, user, logAuditEvent }) => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("today");
  const [typeFilter, setTypeFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [printJob, setPrintJob] = useState(null);
  const [now] = useState(() => Date.now());
  const cur = businessConfig?.currency || "BOB";
  const money = (n) => formatCurrency(n, cur);

  useEffect(() => {
    const q = query(rCol("sales"), orderBy("createdAt", "desc"), limit(500));
    return onSnapshot(q, (snap) => {
      setSales(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Error al cargar recibos:", err);
      setLoading(false);
    });
  }, []);

  const from = periodStart(period, now);
  const term = search.trim().toLowerCase();
  const filtered = sales.filter((s) => {
    if (toMs(s.createdAt) < from) return false;
    if (typeFilter !== "all" && s.receiptType !== typeFilter) return false;
    if (methodFilter !== "all" && !(s.payments || []).some((p) => p.method === methodFilter)) return false;
    if (!term) return true;
    return [s.receiptNumber, s.customer?.name, s.customer?.docNumber, s.tableNumber, ...(s.orderNumbers || [])]
      .some((v) => String(v || "").toLowerCase().includes(term));
  });
  const valid = filtered.filter((s) => s.status !== "void");
  const totalSold = valid.reduce((n, s) => n + Number(s.total || 0), 0);
  const byMethod = valid.reduce((acc, s) => {
    (s.payments || []).forEach((p) => { acc[p.method] = (acc[p.method] || 0) + Number(p.amount || 0); });
    return acc;
  }, {});

  const handlePrint = (sale, size) => {
    const r = saleToReceipt(sale);
    setPrintJob({
      size,
      order: {
        orderNumber: r.receiptNumber,
        receiptType: r.receiptType,
        customerName: r.customer.name,
        customerPhone: r.customer.phone,
        customerDoc: r.customer.docNumber && r.customer.docNumber !== "0" ? `${r.customer.docType} ${r.customer.docNumber}` : "",
        serviceMode: r.serviceMode,
        tableNumber: r.tableNumber,
        paymentMethod: r.primaryMethod,
        items: r.items,
        subtotal: r.subtotal,
        discountAmount: r.discount,
        taxAmount: r.taxAmount,
        shippingCost: 0,
        total: r.total,
        createdAt: { seconds: Math.floor(r.createdAtMs / 1000) }
      }
    });
    setTimeout(() => window.print(), 250);
  };

  const handleVoid = async (sale) => {
    const reason = window.prompt(`¿Anular ${sale.receiptNumber}? Escribe el motivo:`);
    if (!reason) return;
    try {
      await updateDoc(rDoc("sales", sale.id), { status: "void", voidReason: reason, voidedAt: serverTimestamp(), voidedBy: user.email });
      await Promise.all((sale.orderIds || []).map((id) =>
        updateDoc(rDoc("orders", id), { status: "cancelled", voidedSaleId: sale.id, cancelledAt: serverTimestamp() }).catch(() => {})
      ));
      await logAuditEvent(user.email, "ANULAR_VENTA", `${sale.receiptNumber}: ${reason}`);
      setSelected(null);
    } catch (err) {
      console.error("Error al anular la venta:", err);
      alert("No se pudo anular la venta.");
    }
  };

  const downloadCsv = () => {
    const rows = [["Número", "Fecha", "Tipo", "Cliente", "Documento", "Mesa", "Métodos", "Total", "Estado"]];
    filtered.forEach((s) => rows.push([
      s.receiptNumber,
      new Date(toMs(s.createdAt)).toLocaleString("es-BO"),
      RECEIPT_TITLES[s.receiptType] || s.receiptType,
      s.customer?.name || "",
      s.customer?.docNumber || "",
      s.tableNumber || "",
      (s.payments || []).map((p) => payMethodLabel(p.method)).join(" + "),
      Number(s.total || 0).toFixed(2),
      s.status === "void" ? "Anulada" : "Válida"
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const bom = String.fromCharCode(0xfeff); // para que Excel lea bien las tildes
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `recibos-${period}.csv`;
    a.click();
  };

  const chip = (active) => `shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer ${active ? "bg-pizza-red text-white border-pizza-red" : "bg-[#181818] border-white/5 text-white/60 hover:bg-white/5"}`;

  return (
    <div className="space-y-5 text-left animate-in fade-in duration-200">
      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-panel rounded-2xl p-4">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Comprobantes</span>
          <div className="text-2xl font-black mt-1">{valid.length}</div>
          {filtered.length !== valid.length && <span className="text-[10px] text-red-400">{filtered.length - valid.length} anulado(s)</span>}
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Total vendido</span>
          <div className="text-2xl font-black mt-1 text-emerald-400">{money(totalSold)}</div>
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Ticket promedio</span>
          <div className="text-2xl font-black mt-1">{money(valid.length ? totalSold / valid.length : 0)}</div>
        </div>
        <div className="glass-panel rounded-2xl p-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Por método</span>
          {Object.keys(byMethod).length === 0 && <div className="text-xs text-white/40">Sin cobros</div>}
          {Object.entries(byMethod).map(([m, v]) => (
            <div key={m} className="flex justify-between text-xs"><span className="text-white/60">{payMethodLabel(m)}</span><span className="font-bold">{money(v)}</span></div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="glass-panel rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por número, cliente, CI/NIT o mesa..." className="w-full bg-[#181818] border border-white/5 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-pizza-red/50" />
          </div>
          <button onClick={downloadCsv} disabled={filtered.length === 0} className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold disabled:opacity-40 cursor-pointer">
            <Download size={14} /> Exportar CSV
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => <button key={p.id} onClick={() => setPeriod(p.id)} className={chip(period === p.id)}>{p.label}</button>)}
          <span className="w-px bg-white/10 mx-1" />
          {[["all", "Todos"], ["nota", "Notas"], ["boleta", "Boletas"], ["factura", "Facturas"]].map(([id, label]) => (
            <button key={id} onClick={() => setTypeFilter(id)} className={chip(typeFilter === id)}>{label}</button>
          ))}
          <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="bg-[#181818] border border-white/5 rounded-xl px-3 py-2 text-xs text-white cursor-pointer">
            <option value="all">Todos los métodos</option>
            {["cash", "qr", "card", "transfer"].map((m) => <option key={m} value={m}>{payMethodLabel(m)}</option>)}
          </select>
        </div>
      </div>

      {/* Lista */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-white/40 flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin text-pizza-red" /> Cargando recibos...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-white/40">
            <Receipt size={28} className="mx-auto mb-2 text-white/20" />
            No hay recibos en este periodo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase font-bold text-white/40 border-b border-white/5">
                  <th className="text-left px-4 py-3">Comprobante</th>
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Cliente</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Pago</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((s) => {
                  const isVoid = s.status === "void";
                  return (
                    <tr key={s.id} onClick={() => setSelected(s)} className={`cursor-pointer hover:bg-white/5 ${isVoid ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="font-bold font-mono">{s.receiptNumber}</div>
                        <div className="text-[10px] text-white/40">{RECEIPT_TITLES[s.receiptType] || s.receiptType}{isVoid ? " · ANULADA" : ""}</div>
                      </td>
                      <td className="px-4 py-3 text-white/60 whitespace-nowrap">{new Date(toMs(s.createdAt)).toLocaleString("es-BO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{s.customer?.name || "Clientes Varios"}</div>
                        <div className="text-[10px] text-white/40">{s.tableNumber ? `Mesa ${s.tableNumber}` : s.customer?.docNumber && s.customer.docNumber !== "0" ? `${s.customer.docType} ${s.customer.docNumber}` : ""}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-white/60">{(s.payments || []).map((p) => payMethodLabel(p.method)).join(" + ")}</td>
                      <td className={`px-4 py-3 text-right font-black ${isVoid ? "line-through" : ""}`}>{money(s.total)}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <button onClick={() => handlePrint(s)} className="p-2 rounded-lg hover:bg-white/10 text-white/60 cursor-pointer" title="Reimprimir ticket" aria-label="Reimprimir ticket"><FileText size={14} /></button>
                          {canVoid && !isVoid && (
                            <button onClick={() => handleVoid(s)} className="p-2 rounded-lg hover:bg-red-500/15 text-red-400 cursor-pointer" title="Anular venta" aria-label="Anular venta"><Ban size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <SaleReceiptModal
          receipt={saleToReceipt(selected)}
          businessConfig={businessConfig}
          onPrint={(kind) => handlePrint(selected, kind === "letter" ? "letter" : undefined)}
          onClose={() => setSelected(null)}
        />
      )}

      {printJob && (
        <TicketTemplate
          order={printJob.order}
          totals={{ subtotal: printJob.order.subtotal, totalDiscount: printJob.order.discountAmount, taxAmount: printJob.order.taxAmount, shippingCost: 0, total: printJob.order.total }}
          config={businessConfig}
          printSize={printJob.size || "80mm"}
        />
      )}
    </div>
  );
};
