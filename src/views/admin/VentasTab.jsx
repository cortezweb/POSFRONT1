import { Download } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";

// Sección "ventas" del panel de administración
export const VentasTab = ({
  averageTicket,
  businessConfig,
  completedOrders,
  handleExportSalesCSV,
  hoveredHourPoint,
  hoveredProductIndex,
  modeCounts,
  payCounts,
  salesByHour,
  setHoveredHourPoint,
  setHoveredProductIndex,
  topProducts,
  totalSalesRevenue
}) => (
  <div className="space-y-6">
    {/* Export sales & General metrics */}
    <div className="flex justify-between items-center">
      <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">Métricas Financieras de Facturación</h3>
      <button
        onClick={handleExportSalesCSV}
        className="flex items-center gap-1.5 bg-[#181818] border border-white/10 hover:bg-white/5 text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-colors"
      >
        <Download size={14} className="text-[#ffd79b]" />
        Exportar Ventas (CSV)
      </button>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="glass-panel p-6 rounded-3xl border border-white/5 text-left bg-black/15">
        <span className="text-xs font-semibold uppercase text-white/40 tracking-wider">Total Facturado</span>
        <h2 className="text-3xl font-black text-pizza-gold mt-1">
          {formatCurrency(totalSalesRevenue, businessConfig.currency)}
        </h2>
        <p className="text-[10px] text-white/40 mt-1">Ventas completadas de la base de datos</p>
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-white/5 text-left bg-black/15">
        <span className="text-xs font-semibold uppercase text-white/40 tracking-wider">Pedidos Concluidos</span>
        <h2 className="text-3xl font-black text-white mt-1">
          {completedOrders.length}
        </h2>
        <p className="text-[10px] text-white/40 mt-1">Transacciones procesadas</p>
      </div>

      <div className="glass-panel p-6 rounded-3xl border border-white/5 text-left bg-black/15">
        <span className="text-xs font-semibold uppercase text-white/40 tracking-wider">Ticket Promedio</span>
        <h2 className="text-3xl font-black text-emerald-400 mt-1">
          {formatCurrency(averageTicket, businessConfig.currency)}
        </h2>
        <p className="text-[10px] text-white/40 mt-1">Facturación promedio por cliente</p>
      </div>
    </div>

    {/* CSS visual charts */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chart 1: Service Mode Distribution */}
      <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] text-left">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-5">Distribución por Tipo de Servicio</h3>

        {totalSalesRevenue === 0 ? (
          <p className="text-xs text-white/30 text-center py-10">Sin datos de ventas para mostrar</p>
        ) : (
          <div className="space-y-4">
            {/* Stacked bar */}
            <div className="w-full h-7 rounded-lg overflow-hidden flex bg-white/5 border border-white/5 shadow-inner">
              {Object.entries(modeCounts).map(([mode, amt]) => {
                const pct = totalSalesRevenue > 0 ? (amt / totalSalesRevenue) * 100 : 0;
                if (pct === 0) return null;
                const color =
                  mode === "delivery" ? "bg-pizza-red" :
                  mode === "pickup" ? "bg-pizza-gold" : "bg-emerald-500";
                return (
                  <div
                    key={mode}
                    style={{ width: `${pct}%` }}
                    className={`${color} h-full transition-all duration-300 relative group`}
                    title={`${mode}: ${pct.toFixed(1)}%`}
                  />
                );
              })}
            </div>
            {/* Detailed Metrics */}
            <div className="grid grid-cols-3 gap-4 pt-2">
              {[
                { key: "delivery", label: "🛵 Delivery", colorClass: "text-pizza-red" },
                { key: "pickup", label: "🥡 Recojo", colorClass: "text-pizza-gold" },
                { key: "dinein", label: "🍽️ Mesa", colorClass: "text-emerald-600" }
              ].map((item) => {
                const amt = modeCounts[item.key] || 0;
                const pct = totalSalesRevenue > 0 ? (amt / totalSalesRevenue) * 100 : 0;
                return (
                  <div key={item.key} className="space-y-0.5">
                    <span className={`text-[10px] font-bold ${item.colorClass}`}>{item.label}</span>
                    <span className="block text-sm font-black">{formatCurrency(amt, businessConfig.currency)}</span>
                    <span className="block text-[9px] text-white/40 font-medium">{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Chart 2: Payment Method Distribution */}
      <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] text-left">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-5">Distribución por Método de Pago</h3>

        {totalSalesRevenue === 0 ? (
          <p className="text-xs text-white/30 text-center py-10">Sin datos de ventas para mostrar</p>
        ) : (
          <div className="space-y-4">
            {[
              { key: "cash", label: "💵 Efectivo en Caja", color: "bg-pizza-gold" },
              { key: "yape", label: "📱 Yape / Plin", color: "bg-pizza-red" },
              { key: "transfer", label: "💳 Transferencia Bancaria", color: "bg-blue-500" }
            ].map((method) => {
              const amt = payCounts[method.key] || 0;
              const pct = totalSalesRevenue > 0 ? (amt / totalSalesRevenue) * 100 : 0;
              return (
                <div key={method.key} className="space-y-1">
                  <div className="flex justify-between items-baseline text-[10px] font-bold">
                    <span className="text-white/60">{method.label}</span>
                    <span className="text-white/80">
                      {formatCurrency(amt, businessConfig.currency)} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full ${method.color} rounded-full transition-all duration-300`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>

    {/* Graficos SVG interactivos */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      {/* Line Chart: Ventas por Hora */}
      <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] text-left relative group">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-5">Volumen de Ventas por Hora</h3>

        {totalSalesRevenue === 0 ? (
          <p className="text-xs text-white/30 text-center py-10">Sin datos de ventas para mostrar</p>
        ) : (() => {
          const width = 500;
          const height = 200;
          const paddingLeft = 45;
          const paddingRight = 20;
          const paddingTop = 20;
          const paddingBottom = 35;

          const chartWidth = width - paddingLeft - paddingRight;
          const chartHeight = height - paddingTop - paddingBottom;

          const maxSales = Math.max(...salesByHour.map(h => h.total), 10);

          // Y-axis ticks (4 divisions)
          const yTicks = [0, maxSales * 0.25, maxSales * 0.5, maxSales * 0.75, maxSales];

          // Generate SVG path for line
          let points = [];
          salesByHour.forEach((h, index) => {
            const x = paddingLeft + (index / 23) * chartWidth;
            const y = (paddingTop + chartHeight) - (h.total / maxSales) * chartHeight;
            points.push({ x, y, hour: h.hour, total: h.total, count: h.count });
          });

          const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          const areaPath = points.length > 0
            ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
            : '';

          return (
            <div className="relative">
              <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
                <defs>
                  {/* Area Gradient */}
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-line-sales)" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="var(--chart-line-sales)" stopOpacity="0" />
                  </linearGradient>
                  {/* Line Gradient */}
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--chart-line-sales)" />
                    <stop offset="100%" stopColor="var(--chart-line-sales-end)" />
                  </linearGradient>
                </defs>

                {/* Y-Axis Grid Lines & Labels */}
                {yTicks.map((val, idx) => {
                  const y = (paddingTop + chartHeight) - (val / maxSales) * chartHeight;
                  return (
                    <g key={idx}>
                      <line
                        x1={paddingLeft}
                        y1={y}
                        x2={width - paddingRight}
                        y2={y}
                        stroke="var(--chart-grid)"
                        strokeDasharray="4 4"
                        strokeWidth="1"
                      />
                      <text
                        x={paddingLeft - 8}
                        y={y + 3}
                        fill="var(--chart-text)"
                        fontSize="8.5"
                        fontWeight="bold"
                        textAnchor="end"
                      >
                        {formatCurrency(val, businessConfig.currency).split('.')[0]}
                      </text>
                    </g>
                  );
                })}

                {/* X-Axis Labels (every 4 hours: 0, 4, 8, 12, 16, 20, 23) */}
                {salesByHour.map((h, idx) => {
                  if (idx % 4 !== 0 && idx !== 23) return null;
                  const x = paddingLeft + (idx / 23) * chartWidth;
                  const y = paddingTop + chartHeight + 14;
                  return (
                    <text
                      key={idx}
                      x={x}
                      y={y}
                      fill="var(--chart-text)"
                      fontSize="8.5"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {`${h.hour.toString().padStart(2, '0')}:00`}
                    </text>
                  );
                })}

                {/* Area under the line */}
                {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}

                {/* Main Line */}
                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke="url(#lineGrad)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Hover guideline */}
                {hoveredHourPoint && (
                  <line
                    x1={hoveredHourPoint.x}
                    y1={paddingTop}
                    x2={hoveredHourPoint.x}
                    y2={paddingTop + chartHeight}
                    stroke="var(--chart-hover-line)"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Data Points */}
                {points.map((p, idx) => {
                  const isHovered = hoveredHourPoint && hoveredHourPoint.hour === p.hour;
                  if (p.total === 0 && !isHovered) return null;

                  return (
                    <circle
                      key={idx}
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 6 : 3.5}
                      fill={isHovered ? "var(--chart-line-sales-end)" : "var(--chart-line-sales)"}
                      stroke={isHovered ? "#ffffff" : "rgba(255,255,255,0.8)"}
                      strokeWidth={isHovered ? 2 : 1}
                      className="transition-all duration-150 cursor-pointer"
                      onMouseEnter={() => setHoveredHourPoint(p)}
                      onMouseLeave={() => setHoveredHourPoint(null)}
                    />
                  );
                })}
              </svg>

              {/* Tooltip Overlay */}
              {hoveredHourPoint && (
                <div
                  className="absolute z-10 bg-white border border-black/10 rounded-xl p-2.5 shadow-2xl pointer-events-none text-xs space-y-0.5 text-left transition-all duration-100"
                  style={{
                    left: `${((hoveredHourPoint.x - 20) / width) * 100}%`,
                    top: `${((hoveredHourPoint.y - 75) / height) * 100}%`,
                    transform: 'translateX(-40%)',
                    minWidth: '120px'
                  }}
                >
                  <p className="font-bold text-pizza-gold">{hoveredHourPoint.hour.toString().padStart(2, '0')}:00 hrs</p>
                  <p className="text-black/80 font-medium">Ventas: <span className="font-black text-black">{formatCurrency(hoveredHourPoint.total, businessConfig.currency)}</span></p>
                  <p className="text-black/50 text-[10px] font-medium">Pedidos: <span className="font-bold text-black/70">{hoveredHourPoint.count}</span></p>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Horizontal Bar Chart: Top 5 Products */}
      <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] text-left relative group">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/70 mb-5">Top 5 Productos Más Vendidos</h3>

        {topProducts.length === 0 ? (
          <p className="text-xs text-white/30 text-center py-10">Sin datos de productos vendidos</p>
        ) : (() => {
          const width = 500;
          const height = 200;
          const paddingLeft = 110;
          const paddingRight = 60;
          const paddingTop = 15;
          const paddingBottom = 15;

          const chartWidth = width - paddingLeft - paddingRight;
          const chartHeight = height - paddingTop - paddingBottom;

          const barHeight = 20;
          const barSpacing = (chartHeight - (5 * barHeight)) / 4;

          const maxQty = Math.max(...topProducts.map(p => p.quantity), 1);

          return (
            <div className="relative">
              <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
                <defs>
                  {/* Bar Gradient */}
                  <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--chart-bar-start)" />
                    <stop offset="100%" stopColor="var(--chart-bar-end)" />
                  </linearGradient>
                </defs>

                {topProducts.map((p, idx) => {
                  const y = paddingTop + idx * (barHeight + barSpacing);
                  const w = (p.quantity / maxQty) * chartWidth;
                  const isHovered = hoveredProductIndex === idx;

                  return (
                    <g
                      key={idx}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredProductIndex(idx)}
                      onMouseLeave={() => setHoveredProductIndex(null)}
                    >
                      {/* Product Name Label */}
                      <text
                        x={paddingLeft - 10}
                        y={y + barHeight / 2 + 3}
                        fill={isHovered ? "var(--color-pizza-gold)" : "#1a1c1c"}
                        fontSize="9.5"
                        fontWeight="bold"
                        textAnchor="end"
                        className="transition-colors duration-150"
                      >
                        {p.name.length > 18 ? `${p.name.substring(0, 16)}...` : p.name}
                      </text>

                      {/* Background track */}
                      <rect
                        x={paddingLeft}
                        y={y}
                        width={chartWidth}
                        height={barHeight}
                        fill="var(--chart-bg-track)"
                        rx="4"
                        ry="4"
                      />

                      {/* Product Bar */}
                      <rect
                        x={paddingLeft}
                        y={y}
                        width={Math.max(w, 4)}
                        height={barHeight}
                        fill="url(#barGrad)"
                        opacity={isHovered ? 1 : 0.85}
                        rx="4"
                        ry="4"
                        className="transition-all duration-200"
                      />

                      {/* Quantity label */}
                      <text
                        x={paddingLeft + w + 8}
                        y={y + barHeight / 2 + 3}
                        fill={isHovered ? "var(--color-pizza-gold)" : "var(--chart-text)"}
                        fontSize="9.5"
                        fontWeight="black"
                        textAnchor="start"
                        className="transition-colors duration-150"
                      >
                        {p.quantity} uds
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Tooltip Overlay */}
              {hoveredProductIndex !== null && topProducts[hoveredProductIndex] && (
                <div
                  className="absolute z-10 bg-white border border-black/10 rounded-xl p-2.5 shadow-2xl pointer-events-none text-xs space-y-0.5 text-left transition-all duration-100"
                  style={{
                    left: `${(paddingLeft + (topProducts[hoveredProductIndex].quantity / maxQty) * chartWidth) / width * 100}%`,
                    top: `${(paddingTop + hoveredProductIndex * (barHeight + barSpacing) - 35) / height * 100}%`,
                    transform: 'translateX(-50%)',
                    minWidth: '130px'
                  }}
                >
                  <p className="font-bold text-pizza-gold">{topProducts[hoveredProductIndex].name}</p>
                  <p className="text-black/80 font-medium">Cantidad: <span className="font-black text-black">{topProducts[hoveredProductIndex].quantity} uds</span></p>
                  <p className="text-black/80 font-medium">Ingresos: <span className="font-black text-emerald-600">{formatCurrency(topProducts[hoveredProductIndex].revenue, businessConfig.currency)}</span></p>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  </div>
);
