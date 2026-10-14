import { DollarSign, Download, Package, Percent, Plus, Trash2, TrendingUp } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";

// Sección "finanzas" del panel de administración
export const FinanzasTab = ({
  businessConfig,
  completedOrders,
  downloadCSV,
  expenses,
  financesPeriod,
  handleDeleteExpense,
  logAuditEvent,
  productsList,
  setFinancesPeriod,
  setIsExpenseModalOpen,
  user
}) => {
  const getFinanceFilteredData = () => {
    const now = new Date();
    let startDate = new Date(0); // Epoch start (Histórico)

    if (financesPeriod === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (financesPeriod === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (financesPeriod === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (financesPeriod === "year") {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    // Filtrar órdenes completadas
    const filteredOrders = completedOrders.filter(o => {
      if (!o.createdAt) return false;
      const orderDate = o.createdAt.seconds
        ? new Date(o.createdAt.seconds * 1000)
        : new Date(o.createdAt);
      return orderDate >= startDate;
    });

    // Filtrar egresos
    const filteredExpenses = expenses.filter(e => {
      if (!e.date) return false;
      const expDate = e.date.seconds
        ? new Date(e.date.seconds * 1000)
        : new Date(e.date);
      return expDate >= startDate;
    });

    return { filteredOrders, filteredExpenses };
  };

  const getFinanceChartData = () => {
    const now = new Date();
    let bins = [];

    if (financesPeriod === "today") {
      for (let i = 0; i < 6; i++) {
        const hStart = i * 4;
        const dStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hStart, 0, 0);
        const dEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hStart + 4, 0, 0);
        bins.push({ start: dStart, end: dEnd, label: `${hStart}:00`, income: 0, expense: 0 });
      }
    } else if (financesPeriod === "week") {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        const dEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
        const label = d.toLocaleDateString("es-ES", { weekday: "short" });
        bins.push({ start: dStart, end: dEnd, label: label, income: 0, expense: 0 });
      }
    } else if (financesPeriod === "month") {
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const step = Math.ceil(lastDay / 5);
      for (let i = 0; i < 5; i++) {
        const startDay = i * step + 1;
        const endDay = Math.min((i + 1) * step, lastDay);
        const dStart = new Date(now.getFullYear(), now.getMonth(), startDay, 0, 0, 0);
        const dEnd = new Date(now.getFullYear(), now.getMonth(), endDay, 23, 59, 59);
        bins.push({ start: dStart, end: dEnd, label: `${startDay}-${endDay}`, income: 0, expense: 0 });
      }
    } else if (financesPeriod === "year") {
      const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      for (let i = 0; i < 6; i++) {
        const mStart = i * 2;
        const dStart = new Date(now.getFullYear(), mStart, 1, 0, 0, 0);
        const dEnd = new Date(now.getFullYear(), mStart + 1, 31, 23, 59, 59);
        bins.push({ start: dStart, end: dEnd, label: `${monthNames[mStart]}-${monthNames[mStart+1]}`, income: 0, expense: 0 });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i * 6, 1);
        const dStart = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0);
        const dEnd = new Date(d.getFullYear(), d.getMonth() + 5, 31, 23, 59, 59);
        bins.push({ start: dStart, end: dEnd, label: `${d.getFullYear() % 100} S${i%2+1}`, income: 0, expense: 0 });
      }
    }

    const { filteredOrders: finOrders, filteredExpenses: finExpenses } = getFinanceFilteredData();

    finOrders.forEach(o => {
      const orderDate = o.createdAt?.seconds
        ? new Date(o.createdAt.seconds * 1000)
        : new Date(o.createdAt || 0);
      const bin = bins.find(b => orderDate >= b.start && orderDate <= b.end);
      if (bin) {
        bin.income += o.total || 0;
      }
    });

    finExpenses.forEach(e => {
      const expDate = e.date?.seconds
        ? new Date(e.date.seconds * 1000)
        : new Date(e.date || 0);
      const bin = bins.find(b => expDate >= b.start && expDate <= b.end);
      if (bin) {
        bin.expense += e.amount || 0;
      }
    });

    return bins;
  };

  const { filteredOrders: finOrders, filteredExpenses: finExpenses } = getFinanceFilteredData();
  const totalIncomes = finOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalExpenses = finExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netProfit = totalIncomes - totalExpenses;
  const profitMargin = totalIncomes > 0 ? (netProfit / totalIncomes) * 100 : 0;

  const chartBins = getFinanceChartData();
  const maxVal = Math.max(...chartBins.map(b => Math.max(b.income, b.expense)), 50);

  const svgWidth = 600;
  const svgHeight = 200;
  const padLeft = 50;
  const padRight = 20;
  const padTop = 20;
  const padBot = 30;

  const getSvgCoords = (val, idx) => {
    const x = padLeft + (idx / (chartBins.length - 1)) * (svgWidth - padLeft - padRight);
    const y = svgHeight - padBot - (val / maxVal) * (svgHeight - padTop - padBot);
    return { x, y };
  };

  let incomePoints = "";
  let expensePoints = "";
  let incomeAreaPath = `M ${padLeft} ${svgHeight - padBot} `;
  let expenseAreaPath = `M ${padLeft} ${svgHeight - padBot} `;

  chartBins.forEach((b, idx) => {
    const incCoords = getSvgCoords(b.income, idx);
    const expCoords = getSvgCoords(b.expense, idx);

    incomePoints += `${incCoords.x},${incCoords.y} `;
    expensePoints += `${expCoords.x},${expCoords.y} `;

    incomeAreaPath += `L ${incCoords.x} ${incCoords.y} `;
    expenseAreaPath += `L ${expCoords.x} ${expCoords.y} `;

    if (idx === chartBins.length - 1) {
      incomeAreaPath += `L ${incCoords.x} ${svgHeight - padBot} Z`;
      expenseAreaPath += `L ${expCoords.x} ${svgHeight - padBot} Z`;
    }
  });

  const productProfitability = {};
  finOrders.forEach(order => {
    if (!order.items) return;
    order.items.forEach(item => {
      const name = item.name;
      const qty = item.quantity || 0;
      const price = item.price || 0;
      const totalItemRevenue = qty * price;

      const matchedProd = productsList.find(p => p.name === name || p.id === item.productId);
      const unitCost = matchedProd ? (matchedProd.cost || 0) : 0;
      const totalItemCost = qty * unitCost;

      if (!productProfitability[name]) {
        productProfitability[name] = {
          name: name,
          quantity: 0,
          revenue: 0,
          cost: 0,
          unitPrice: matchedProd ? matchedProd.price : price,
          unitCost: unitCost
        };
      }
      productProfitability[name].quantity += qty;
      productProfitability[name].revenue += totalItemRevenue;
      productProfitability[name].cost += totalItemCost;
    });
  });

  const profitabilityList = Object.values(productProfitability).map(p => {
    const net = p.revenue - p.cost;
    const margin = p.revenue > 0 ? (net / p.revenue) * 100 : 0;
    return { ...p, net, margin };
  }).sort((a, b) => b.revenue - a.revenue);

  const starProduct = profitabilityList.length > 0
    ? [...profitabilityList].sort((a, b) => b.quantity - a.quantity)[0]
    : null;

  const mostProfitableProduct = profitabilityList.length > 0
    ? [...profitabilityList].sort((a, b) => b.net - a.net)[0]
    : null;

  const unifiedTransactions = [
    ...finOrders.map(o => ({
      id: o.id,
      type: "ingreso",
      description: `Pedido #${o.orderNumber || ""} - ${o.customerName || "Cliente"}`,
      category: "Venta",
      amount: o.total || 0,
      date: o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000) : new Date(o.createdAt || 0),
      createdBy: o.serviceMode === "delivery" ? "Delivery" : o.serviceMode === "pickup" ? "Retiro" : "Mesa"
    })),
    ...finExpenses.map(e => ({
      id: e.id,
      type: "egreso",
      description: e.description,
      category: e.category,
      amount: e.amount || 0,
      date: e.date?.seconds ? new Date(e.date.seconds * 1000) : new Date(e.date || 0),
      createdBy: e.createdBy
    }))
  ].sort((a, b) => b.date - a.date);

  const handleExportFinancesCSV = () => {
    const headers = ["Fecha", "Tipo", "Categoria", "Descripcion", "Monto", "Usuario / Canal"];
    const rows = unifiedTransactions.map(t => [
      t.date.toLocaleString(),
      t.type.toUpperCase(),
      t.category,
      t.description,
      t.amount.toFixed(2),
      t.createdBy
    ]);
    downloadCSV(`reporte_financiero_${financesPeriod}.csv`, headers, rows);
    logAuditEvent(user.email, "EXPORTAR_CSV_FINANZAS", `Exporto reporte financiero (${financesPeriod}) a CSV`);
  };

  return (
    <div className="space-y-6">
      {/* Cabecera y botón exportar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">Resultados Financieros y Balance</h3>
        <div className="flex gap-2">
          <button
            onClick={handleExportFinancesCSV}
            className="flex items-center gap-1.5 bg-[#181818] border border-white/10 hover:bg-white/5 text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-colors"
          >
            <Download size={14} className="text-pizza-gold" />
            Exportar Reporte (CSV)
          </button>
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex items-center gap-1.5 bg-pizza-gold text-pizza-dark font-black hover:bg-[#ffd79b] text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-all"
          >
            <Plus size={14} />
            Registrar Egreso
          </button>
        </div>
      </div>

      {/* Filtro de Períodos */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: "today", label: "Hoy" },
          { id: "week", label: "Últimos 7 Días" },
          { id: "month", label: "Este Mes" },
          { id: "year", label: "Este Año" },
          { id: "all", label: "Histórico" }
        ].map((period) => (
          <button
            key={period.id}
            onClick={() => setFinancesPeriod(period.id)}
            className={`text-xs px-4 py-2 rounded-xl transition-all cursor-pointer ${
              financesPeriod === period.id
                ? "bg-pizza-gold text-pizza-dark font-bold"
                : "bg-white/5 border border-white/5 hover:bg-white/10 text-white/80"
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      <div className="space-y-6 text-left">
        {/* Tarjetas KPI */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tarjeta 1: Ingresos */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#121212] relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Total Ingresos</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <TrendingUp size={16} />
              </div>
            </div>
            <h2 className="text-2xl font-black text-white mt-3">
              {formatCurrency(totalIncomes, businessConfig.currency)}
            </h2>
            <div className="text-[10px] text-white/40 mt-1 flex justify-between">
              <span>{finOrders.length} Ventas</span>
              <span className="text-emerald-400 font-bold">100% Entrante</span>
            </div>
          </div>

          {/* Tarjeta 2: Egresos */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#121212] relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Total Egresos</span>
              <div className="p-2 rounded-lg bg-pizza-red/10 text-pizza-red">
                <TrendingUp size={16} className="rotate-180" />
              </div>
            </div>
            <h2 className="text-2xl font-black text-white mt-3">
              {formatCurrency(totalExpenses, businessConfig.currency)}
            </h2>
            <div className="text-[10px] text-white/40 mt-1 flex justify-between">
              <span>{finExpenses.length} Gastos</span>
              <span className="text-pizza-red font-bold">Saliente</span>
            </div>
          </div>

          {/* Tarjeta 3: Utilidad Neta */}
          <div className={`glass-panel p-5 rounded-2xl border border-white/5 bg-[#121212] relative overflow-hidden`}>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Utilidad Neta</span>
              <div className={`p-2 rounded-lg ${netProfit >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-pizza-red/10 text-pizza-red"}`}>
                <DollarSign size={16} />
              </div>
            </div>
            <h2 className={`text-2xl font-black mt-3 ${netProfit >= 0 ? "text-emerald-400" : "text-pizza-red"}`}>
              {formatCurrency(netProfit, businessConfig.currency)}
            </h2>
            <p className="text-[10px] text-white/40 mt-1">Balance neto en caja</p>
          </div>

          {/* Tarjeta 4: Margen de Utilidad */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#121212] relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Margen de Beneficio</span>
              <div className="p-2 rounded-lg bg-pizza-gold/10 text-pizza-gold">
                <Percent size={16} />
              </div>
            </div>
            <h2 className="text-2xl font-black text-pizza-gold mt-3">
              {profitMargin.toFixed(1)}%
            </h2>
            <p className="text-[10px] text-white/40 mt-1">Retorno sobre ingresos</p>
          </div>
        </div>

        {/* Fila 2: Gráfico y Resumen de Productos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel del Gráfico */}
          <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-1">Tendencia de Ingresos vs. Egresos</h4>
              <p className="text-[10px] text-white/40 mb-4">Visualización cronológica agrupada del período activo</p>
            </div>

            {chartBins.length > 1 && maxVal > 50 ? (
              <div className="w-full overflow-x-auto">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full min-w-[450px] overflow-visible">
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-line-income)" stopOpacity="0.15"/>
                      <stop offset="100%" stopColor="var(--chart-line-income)" stopOpacity="0"/>
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-line-expense)" stopOpacity="0.15"/>
                      <stop offset="100%" stopColor="var(--chart-line-expense)" stopOpacity="0"/>
                    </linearGradient>
                  </defs>

                  {/* Líneas de fondo (Grilla) */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                    const y = padTop + ratio * (svgHeight - padTop - padBot);
                    const valLabel = (maxVal * (1 - ratio)).toFixed(0);
                    return (
                      <g key={i}>
                        <line x1={padLeft} y1={y} x2={svgWidth - padRight} y2={y} stroke="var(--chart-grid)" strokeWidth="0.5" strokeDasharray="3,3" />
                        <text x={padLeft - 8} y={y + 3} textAnchor="end" fill="var(--chart-text)" className="text-[9px] font-bold">{valLabel}</text>
                      </g>
                    );
                  })}

                  {/* Líneas y áreas de gráfico */}
                  {incomePoints && (
                    <>
                      <path d={incomeAreaPath} fill="url(#incomeGrad)" />
                      <polyline fill="none" stroke="var(--chart-line-income)" strokeWidth="2.5" points={incomePoints} />
                    </>
                  )}
                  {expensePoints && (
                    <>
                      <path d={expenseAreaPath} fill="url(#expenseGrad)" />
                      <polyline fill="none" stroke="var(--chart-line-expense)" strokeWidth="2.5" points={expensePoints} />
                    </>
                  )}

                  {/* Puntos interactivos / círculos */}
                  {chartBins.map((b, idx) => {
                    const inc = getSvgCoords(b.income, idx);
                    const exp = getSvgCoords(b.expense, idx);
                    return (
                      <g key={idx}>
                        {/* Círculo Ingresos */}
                        <circle cx={inc.x} cy={inc.y} r="4" className="fill-emerald-500 stroke-white stroke-2 hover:scale-150 cursor-pointer transition-all" />
                        {/* Círculo Egresos */}
                        <circle cx={exp.x} cy={exp.y} r="4" className="fill-red-500 stroke-white stroke-2 hover:scale-150 cursor-pointer transition-all" />

                        {/* Etiquetas del eje X */}
                        <text x={inc.x} y={svgHeight - 10} textAnchor="middle" fill="var(--chart-text)" className="text-[9px] font-bold">
                          {b.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-xs text-white/30">
                Sin suficientes transacciones para graficar
              </div>
            )}

            <div className="flex gap-4 justify-center text-[10px] mt-2 border-t border-white/5 pt-3">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Ingresos (Ventas)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Egresos (Gastos)</span>
            </div>
          </div>

          {/* Productos Destacados */}
          <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] flex flex-col justify-between">
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/60">Destacados Financieros</h4>

              {starProduct ? (
                <div className="border border-white/5 rounded-xl p-3.5 bg-white/[0.02] flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-pizza-gold/10 text-pizza-gold">
                    <Package size={18} />
                  </div>
                  <div className="text-left">
                    <span className="block text-[8px] font-bold text-white/30 uppercase tracking-widest">Producto más Vendido</span>
                    <span className="block text-xs font-bold text-white truncate max-w-[140px]">{starProduct.name}</span>
                    <span className="block text-[10px] text-white/50">{starProduct.quantity} unidades vendidas</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-white/20">No hay ventas registradas</p>
              )}

              {mostProfitableProduct ? (
                <div className="border border-white/5 rounded-xl p-3.5 bg-white/[0.02] flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <TrendingUp size={18} />
                  </div>
                  <div className="text-left">
                    <span className="block text-[8px] font-bold text-white/30 uppercase tracking-widest">Mayor Margen Neto</span>
                    <span className="block text-xs font-bold text-white truncate max-w-[140px]">{mostProfitableProduct.name}</span>
                    <span className="block text-[10px] text-emerald-400 font-bold">+{formatCurrency(mostProfitableProduct.net, businessConfig.currency)} neto</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-6 text-[10px] text-white/30 border-t border-white/5 pt-3 leading-relaxed">
              💡 Para calcular utilidades netas reales por producto, asegúrate de asignarle su respectivo <strong>Costo COGS</strong> en el CRUD de inventario.
            </div>
          </div>
        </div>

        {/* Rentabilidad de Productos */}
        <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-4">Rentabilidad por Producto del Catálogo</h4>

          {profitabilityList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] font-bold text-white/40 uppercase tracking-wider">
                    <th className="py-2.5">Producto</th>
                    <th className="py-2.5 text-center">Unidades</th>
                    <th className="py-2.5 text-right">Precio Venta</th>
                    <th className="py-2.5 text-right">Costo COGS</th>
                    <th className="py-2.5 text-right">Ingreso Bruto</th>
                    <th className="py-2.5 text-right">Costo Total</th>
                    <th className="py-2.5 text-right">Utilidad Neta</th>
                    <th className="py-2.5 text-right">Margen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {profitabilityList.map((p, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 font-semibold text-white">{p.name}</td>
                      <td className="py-2.5 text-center font-bold text-white/70">{p.quantity}</td>
                      <td className="py-2.5 text-right text-white/60">{formatCurrency(p.unitPrice, businessConfig.currency)}</td>
                      <td className="py-2.5 text-right text-white/40">{p.unitCost > 0 ? formatCurrency(p.unitCost, businessConfig.currency) : "-"}</td>
                      <td className="py-2.5 text-right text-white/80">{formatCurrency(p.revenue, businessConfig.currency)}</td>
                      <td className="py-2.5 text-right text-white/40">{p.cost > 0 ? formatCurrency(p.cost, businessConfig.currency) : "-"}</td>
                      <td className={`py-2.5 text-right font-bold ${p.net >= 0 ? "text-emerald-400" : "text-pizza-red"}`}>
                        {formatCurrency(p.net, businessConfig.currency)}
                      </td>
                      <td className={`py-2.5 text-right font-black ${p.margin > 50 ? "text-emerald-400" : p.margin > 20 ? "text-pizza-gold" : "text-white/60"}`}>
                        {p.margin.toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-white/30">
              No hay órdenes completadas registradas en el período seleccionado.
            </div>
          )}
        </div>

        {/* Transacciones Recientes (Libro Diario) y Egresos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Libro Diario Unificado */}
          <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-4">Libro de Transacciones Diario</h4>

              {unifiedTransactions.length > 0 ? (
                <div className="overflow-y-auto max-h-[300px] pr-2 space-y-2.5">
                  {unifiedTransactions.map((t, idx) => (
                    <div key={t.id || idx} className="flex justify-between items-center border-b border-white/5 pb-2.5 last:border-b-0">
                      <div className="text-left space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            t.type === "ingreso"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-pizza-red/10 text-pizza-red"
                          }`}>
                            {t.type}
                          </span>
                          <span className="text-[10px] text-white/40">{t.date.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</span>
                        </div>
                        <p className="text-xs font-bold text-white/80">{t.description}</p>
                        <p className="text-[9px] text-white/30">Categoría: {t.category} • Por: {t.createdBy}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-bold ${
                          t.type === "ingreso" ? "text-emerald-400" : "text-pizza-red"
                        }`}>
                          {t.type === "ingreso" ? "+" : "-"}{formatCurrency(t.amount, businessConfig.currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-xs text-white/30">
                  No se encontraron transacciones en este período.
                </div>
              )}
            </div>
          </div>

          {/* Listado / Administración rápida de Egresos */}
          <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-4 font-pizza-title flex justify-between items-center">
                <span>Gastos Registrados</span>
                <span className="text-[10px] font-normal text-white/40">Periodo actual</span>
              </h4>

              {finExpenses.length > 0 ? (
                <div className="overflow-y-auto max-h-[300px] pr-2 space-y-2.5 text-left">
                  {finExpenses.map((exp) => {
                    const expDate = exp.date?.seconds
                      ? new Date(exp.date.seconds * 1000)
                      : new Date(exp.date || 0);
                    return (
                      <div key={exp.id} className="border-b border-white/5 pb-2.5 flex justify-between items-center group">
                        <div>
                          <p className="text-xs font-bold text-white">{exp.description}</p>
                          <div className="flex gap-2 items-center text-[9px] text-white/40 mt-0.5">
                            <span className="font-semibold text-pizza-gold">{exp.category}</span>
                            <span>•</span>
                            <span>{expDate.toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-pizza-red">
                            -{formatCurrency(exp.amount, businessConfig.currency)}
                          </span>
                          <button
                            onClick={() => handleDeleteExpense(exp.id, exp.description, exp.amount)}
                            className="p-1 text-white/20 hover:text-pizza-red hover:bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                            title="Eliminar gasto"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 text-xs text-white/30">
                  Sin gastos en el período actual
                </div>
              )}
            </div>

            <div className="mt-4">
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="w-full bg-[#181818] border border-white/10 hover:bg-white/5 text-white/80 font-bold rounded-xl py-2.5 text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                Nuevo Gasto / Egreso
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
