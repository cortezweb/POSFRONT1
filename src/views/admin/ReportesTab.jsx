import { useState } from "react";
import { formatCurrency } from "../../utils/formatters";
import { payMethodLabel } from "../../utils/payments";
import { Download, TrendingUp, TrendingDown, Minus, ShoppingBag, Receipt, Percent, Package } from "lucide-react";

const DAY = 86400000;
const PERIODS = [
  { id: "today", label: "Hoy" },
  { id: "yesterday", label: "Ayer" },
  { id: "7d", label: "7 días" },
  { id: "30d", label: "30 días" },
  { id: "month", label: "Este mes" },
  { id: "custom", label: "Rango" }
];
const SERVICE_LABELS = { dinein: "En mesa", pickup: "Para llevar", delivery: "Delivery" };

const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

const rangeFor = (period, now, custom) => {
  const today = startOfDay(now);
  switch (period) {
    case "today": return [today, now];
    case "yesterday": return [today - DAY, today];
    case "7d": return [today - 6 * DAY, now];
    case "30d": return [today - 29 * DAY, now];
    case "month": { const d = new Date(now); return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), now]; }
    default: {
      const from = custom.from ? new Date(`${custom.from}T00:00:00`).getTime() : today;
      const to = custom.to ? new Date(`${custom.to}T23:59:59`).getTime() : now;
      return [from, to];
    }
  }
};

const saleTime = (o) => (o.paidAt?.seconds || o.completedAt?.seconds || o.createdAt?.seconds || 0) * 1000;
const isSale = (o) => o.status !== "cancelled" && o.status !== "rejected" && (o.status === "completed" || o.paymentStatus === "paid");

const summarize = (orders) => {
  const revenue = orders.reduce((n, o) => n + Number(o.total || 0), 0);
  const discount = orders.reduce((n, o) => n + Number(o.discountAmount || 0), 0);
  const units = orders.reduce((n, o) => n + (o.items || []).reduce((m, i) => m + Number(i.quantity || 0), 0), 0);
  return { revenue, count: orders.length, avg: orders.length ? revenue / orders.length : 0, discount, units };
};

const Delta = ({ now, before }) => {
  if (!before) return <span className="text-[10px] text-white/40">Sin datos del periodo anterior</span>;
  const pct = ((now - before) / before) * 100;
  const Icon = pct > 0.5 ? TrendingUp : pct < -0.5 ? TrendingDown : Minus;
  const cls = pct > 0.5 ? "text-emerald-400" : pct < -0.5 ? "text-red-400" : "text-white/50";
  return <span className={`text-[11px] font-bold flex items-center gap-1 ${cls}`}><Icon size={12} /> {pct > 0 ? "+" : ""}{pct.toFixed(0)}% vs periodo anterior</span>;
};

// Barra horizontal con etiqueta y valor
const HBar = ({ label, value, max, display, sub }) => (
  <div className="space-y-1" title={`${label}: ${display}`}>
    <div className="flex justify-between text-xs gap-3">
      <span className="truncate font-semibold">{label}</span>
      <span className="shrink-0 font-bold">{display}{sub && <span className="text-white/40 font-normal"> · {sub}</span>}</span>
    </div>
    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
      <div className="h-full rounded-full bg-pizza-red" style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%` }} />
    </div>
  </div>
);

// Sección "ventas": reportes por periodo con comparación
export const ReportesTab = ({ orders, productsList, categoriesListToUse, businessConfig }) => {
  const cur = businessConfig?.currency || "BOB";
  const money = (n) => formatCurrency(n, cur);
  const [period, setPeriod] = useState("7d");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [hoverBar, setHoverBar] = useState(null);
  const [now] = useState(() => Date.now());

  const [from, to] = rangeFor(period, now, custom);
  const span = Math.max(DAY, to - from);
  const sales = orders.filter(isSale);
  const current = sales.filter((o) => { const t = saleTime(o); return t >= from && t <= to; });
  const previous = sales.filter((o) => { const t = saleTime(o); return t >= from - span && t < from; });
  const cur$ = summarize(current);
  const prev$ = summarize(previous);

  // Ventas por día (o por hora si el periodo es un solo día)
  const singleDay = to - from <= DAY + 1000;
  const buckets = [];
  if (singleDay) {
    for (let h = 0; h < 24; h++) buckets.push({ key: h, label: `${h}h`, value: 0, count: 0 });
    current.forEach((o) => { const b = buckets[new Date(saleTime(o)).getHours()]; b.value += Number(o.total || 0); b.count++; });
  } else {
    for (let t = startOfDay(from); t <= to; t += DAY) {
      buckets.push({ key: t, label: new Date(t).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit" }), value: 0, count: 0 });
    }
    current.forEach((o) => {
      const b = buckets.find((x) => x.key === startOfDay(saleTime(o)));
      if (b) { b.value += Number(o.total || 0); b.count++; }
    });
  }
  const maxBucket = Math.max(0, ...buckets.map((b) => b.value));
  const bestBucket = buckets.reduce((a, b) => (b.value > (a?.value || 0) ? b : a), null);

  // Productos y categorías
  const prodMap = {};
  current.forEach((o) => (o.items || []).forEach((i) => {
    const k = i.id || i.name;
    if (!prodMap[k]) prodMap[k] = { name: i.name, category: i.category, qty: 0, revenue: 0 };
    prodMap[k].qty += Number(i.quantity || 0);
    prodMap[k].revenue += Number(i.price || 0) * Number(i.quantity || 0);
  }));
  const products = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue);
  const productRevenue = products.reduce((n, p) => n + p.revenue, 0);
  const catMap = {};
  products.forEach((p) => {
    const name = categoriesListToUse.find((c) => c.id === p.category)?.name || p.category || "Sin categoría";
    catMap[name] = (catMap[name] || 0) + p.revenue;
  });
  const categories = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const soldIds = new Set(Object.keys(prodMap));
  const notSold = productsList.filter((p) => !soldIds.has(p.id) && !soldIds.has(p.name)).slice(0, 8);

  // Servicio, método de pago y personal
  const serviceMap = {};
  const payMap = {};
  const staffMap = {};
  current.forEach((o) => {
    const s = SERVICE_LABELS[o.serviceMode] || "Otro";
    serviceMap[s] = (serviceMap[s] || 0) + Number(o.total || 0);
    if (Array.isArray(o.payments) && o.payments.length) {
      o.payments.forEach((p) => { const k = payMethodLabel(p.method); payMap[k] = (payMap[k] || 0) + Number(p.amount || 0); });
    } else {
      const k = payMethodLabel(o.paymentMethod) || "Sin dato";
      payMap[k] = (payMap[k] || 0) + Number(o.total || 0);
    }
    const w = o.waiterName || (o.createdBy === "client" ? "Pedido web" : "Sin dato");
    staffMap[w] = (staffMap[w] || 0) + Number(o.total || 0);
  });
  const toSorted = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]);

  const exportCsv = () => {
    const rows = [["Orden", "Fecha", "Servicio", "Mesa", "Cliente", "Método", "Productos", "Descuento", "Total"]];
    current.forEach((o) => rows.push([
      o.orderNumber,
      new Date(saleTime(o)).toLocaleString("es-BO"),
      SERVICE_LABELS[o.serviceMode] || o.serviceMode || "",
      o.tableNumber || "",
      o.customerName || "",
      payMethodLabel(o.paymentMethod),
      (o.items || []).map((i) => `${i.quantity}x ${i.name}`).join(" | "),
      Number(o.discountAmount || 0).toFixed(2),
      Number(o.total || 0).toFixed(2)
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const bom = String.fromCharCode(0xfeff);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([bom + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `reporte-ventas-${period}.csv`;
    a.click();
  };

  const chip = (active) => `shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer ${active ? "bg-pizza-red text-white border-pizza-red" : "bg-[#181818] border-white/5 text-white/60 hover:bg-white/5"}`;
  const card = "glass-panel rounded-2xl p-5";

  return (
    <div className="space-y-5 text-left">
      {/* Filtros en una fila */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          {PERIODS.map((p) => <button key={p.id} onClick={() => setPeriod(p.id)} className={chip(period === p.id)}>{p.label}</button>)}
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="bg-[#181818] border border-white/5 rounded-xl px-3 py-2 text-xs text-white" aria-label="Desde" />
              <span className="text-white/40 text-xs">a</span>
              <input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="bg-[#181818] border border-white/5 rounded-xl px-3 py-2 text-xs text-white" aria-label="Hasta" />
            </div>
          )}
        </div>
        <button onClick={exportCsv} disabled={current.length === 0} className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold disabled:opacity-40 cursor-pointer">
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: TrendingUp, label: "Ventas", value: money(cur$.revenue), now: cur$.revenue, before: prev$.revenue },
          { icon: Receipt, label: "Pedidos", value: cur$.count, now: cur$.count, before: prev$.count },
          { icon: ShoppingBag, label: "Ticket promedio", value: money(cur$.avg), now: cur$.avg, before: prev$.avg },
          { icon: Package, label: "Productos vendidos", value: cur$.units, now: cur$.units, before: prev$.units }
        ].map(({ icon: Icon, label, value, now: n, before }) => (
          <div key={label} className={card}>
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider flex items-center gap-1.5"><Icon size={12} /> {label}</span>
            <div className="text-2xl font-black mt-1">{value}</div>
            <Delta now={n} before={before} />
          </div>
        ))}
      </div>

      {/* Ventas en el tiempo */}
      <div className={card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h3 className="text-sm font-bold">{singleDay ? "Ventas por hora" : "Ventas por día"}</h3>
          {bestBucket && bestBucket.value > 0 && (
            <span className="text-[11px] text-white/50">Mejor {singleDay ? "hora" : "día"}: <strong className="text-white">{bestBucket.label}</strong> con {money(bestBucket.value)}</span>
          )}
        </div>
        {cur$.count === 0 ? (
          <div className="h-48 flex items-center justify-center text-xs text-white/40">No hay ventas en este periodo.</div>
        ) : (
          <div className="relative">
            <div className="flex items-end gap-[2px] h-48 border-b border-white/10">
              {buckets.map((b) => (
                <div
                  key={b.key}
                  className="flex-1 h-full flex items-end cursor-default"
                  onMouseEnter={() => setHoverBar(b)}
                  onMouseLeave={() => setHoverBar(null)}
                >
                  <div
                    className={`w-full rounded-t-[4px] transition-colors ${hoverBar?.key === b.key ? "bg-pizza-red" : "bg-pizza-red/70"}`}
                    style={{ height: `${maxBucket > 0 ? Math.max(b.value > 0 ? 2 : 0, (b.value / maxBucket) * 100) : 0}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-[2px] mt-1.5">
              {buckets.map((b, i) => (
                <span key={b.key} className="flex-1 text-center text-[9px] text-white/40 truncate">
                  {buckets.length <= 16 || i % Math.ceil(buckets.length / 12) === 0 ? b.label : ""}
                </span>
              ))}
            </div>
            {hoverBar && (
              <div className="absolute top-0 right-0 bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl pointer-events-none">
                <div className="font-bold">{hoverBar.label}</div>
                <div>{money(hoverBar.value)} · {hoverBar.count} pedido(s)</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Productos más vendidos */}
        <div className={`${card} xl:col-span-2`}>
          <h3 className="text-sm font-bold mb-4">Productos más vendidos</h3>
          {products.length === 0 ? (
            <p className="text-xs text-white/40">Sin ventas en este periodo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase font-bold text-white/40 border-b border-white/5">
                    <th className="text-left py-2">#</th>
                    <th className="text-left py-2">Producto</th>
                    <th className="text-right py-2">Cant.</th>
                    <th className="text-right py-2">Ingresos</th>
                    <th className="text-left py-2 pl-4 w-1/3">Participación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {products.slice(0, 10).map((p, i) => {
                    const share = productRevenue ? (p.revenue / productRevenue) * 100 : 0;
                    return (
                      <tr key={p.name + i}>
                        <td className="py-2.5 text-white/40">{i + 1}</td>
                        <td className="py-2.5 font-semibold">{p.name}</td>
                        <td className="py-2.5 text-right">{p.qty}</td>
                        <td className="py-2.5 text-right font-bold">{money(p.revenue)}</td>
                        <td className="py-2.5 pl-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full bg-pizza-red" style={{ width: `${Math.max(2, share)}%` }} /></div>
                            <span className="text-[10px] text-white/50 w-9 text-right">{share.toFixed(0)}%</span>
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

        {/* Categorías */}
        <div className={card}>
          <h3 className="text-sm font-bold mb-4">Ventas por categoría</h3>
          <div className="space-y-3">
            {categories.length === 0 && <p className="text-xs text-white/40">Sin datos.</p>}
            {categories.map(([name, v]) => <HBar key={name} label={name} value={v} max={categories[0][1]} display={money(v)} />)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          ["Por tipo de servicio", toSorted(serviceMap)],
          ["Por método de pago", toSorted(payMap)],
          ["Por personal", toSorted(staffMap)]
        ].map(([title, rows]) => (
          <div key={title} className={card}>
            <h3 className="text-sm font-bold mb-4">{title}</h3>
            <div className="space-y-3">
              {rows.length === 0 && <p className="text-xs text-white/40">Sin datos.</p>}
              {rows.map(([k, v]) => (
                <HBar key={k} label={k} value={v} max={rows[0][1]} display={money(v)} sub={cur$.revenue ? `${((v / cur$.revenue) * 100).toFixed(0)}%` : ""} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className={card}>
          <h3 className="text-sm font-bold mb-1 flex items-center gap-2"><Percent size={14} /> Descuentos otorgados</h3>
          <div className="text-2xl font-black">{money(cur$.discount)}</div>
          <p className="text-[11px] text-white/40">{cur$.revenue ? `${((cur$.discount / (cur$.revenue + cur$.discount)) * 100).toFixed(1)}% de lo vendido antes de descuentos` : "Sin ventas"}</p>
        </div>
        <div className={card}>
          <h3 className="text-sm font-bold mb-2">Productos sin ventas en el periodo</h3>
          {notSold.length === 0 ? (
            <p className="text-xs text-white/40">Todos los productos tuvieron ventas.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {notSold.map((p) => <span key={p.id} className="text-[11px] bg-[#181818] border border-white/5 rounded-lg px-2.5 py-1">{p.name}</span>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
