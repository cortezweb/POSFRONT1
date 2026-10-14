import { DollarSign } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";

// Sección "caja" del panel de administración
export const CajaTab = ({
  activeShift,
  actualCash,
  actualElectronic,
  businessConfig,
  cashBase,
  getShiftExpectedTotals,
  handleCloseShift,
  handleOpenShift,
  setActualCash,
  setActualElectronic,
  setCashBase
}) => (
  <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] text-left max-w-md mx-auto space-y-6">
    <div className="flex items-center gap-2 text-pizza-gold">
      <DollarSign size={18} />
      <h3 className="font-pizza-title font-bold text-sm uppercase">Control de Caja Registradora</h3>
    </div>

    {!activeShift ? (
      // Shift Closed: Form to Open
      <form onSubmit={handleOpenShift} className="space-y-4">
        <div className="bg-pizza-red/10 border border-pizza-red/20 rounded-xl p-3.5 text-[11px] text-[#ffd79b] leading-relaxed">
          ⚠️ <strong>Turno Cerrado.</strong> Registra el saldo inicial en caja (efectivo base) para aperturar un nuevo turno de ventas.
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Monto Inicial en Efectivo</label>
          <input
            type="number"
            step="0.01"
            required
            value={cashBase}
            onChange={(e) => setCashBase(e.target.value)}
            placeholder="Ej. 100.00"
            className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-gold"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-pizza-gold text-pizza-dark font-black rounded-xl py-3 text-xs transition-all cursor-pointer hover:bg-[#ffd79b]"
        >
          Abrir Turno de Caja
        </button>
      </form>
    ) : (
      // Shift Open: Form to Close
      <div className="space-y-5">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 text-[11px] text-emerald-400 space-y-1">
          <p>📢 <strong>Turno Abierto</strong></p>
          <p><strong>Cajero:</strong> {activeShift.openedBy}</p>
          <p><strong>Apertura:</strong> {new Date(activeShift.openTime.seconds * 1000).toLocaleString()}</p>
        </div>

        {/* Expected dynamic shift calculations */}
        {(() => {
          const exp = getShiftExpectedTotals();
          const totalCashExpected = activeShift.cashBase + exp.cash;
          return (
            <div className="space-y-3 pt-2 border-t border-white/5 text-xs">
              <div className="flex justify-between">
                <span className="text-white/40">Efectivo Base:</span>
                <span className="font-bold">{formatCurrency(activeShift.cashBase, businessConfig.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Ventas en Efectivo:</span>
                <span className="font-bold text-emerald-400">+{formatCurrency(exp.cash, businessConfig.currency)}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-white/40">Ventas Yape/Transf.:</span>
                <span className="font-bold text-emerald-400">+{formatCurrency(exp.electronic, businessConfig.currency)}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-pizza-gold pt-1">
                <span>Esperado en Caja:</span>
                <span>{formatCurrency(totalCashExpected + exp.electronic, businessConfig.currency)}</span>
              </div>
            </div>
          );
        })()}

        {/* Close shift form */}
        <form onSubmit={handleCloseShift} className="space-y-4 pt-4 border-t border-white/5">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">Cierre de Caja (Reporte Z)</h4>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] text-white/40 font-bold mb-1">Efectivo Real</label>
              <input
                type="number"
                step="0.01"
                required
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                placeholder="Ej. 150.00"
                className="w-full bg-[#181818] border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[9px] text-white/40 font-bold mb-1">Tarjeta / Yape Real</label>
              <input
                type="number"
                step="0.01"
                required
                value={actualElectronic}
                onChange={(e) => setActualElectronic(e.target.value)}
                placeholder="Ej. 50.00"
                className="w-full bg-[#181818] border border-white/5 rounded-lg p-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-pizza-red text-white font-bold rounded-xl py-3 text-xs transition-all cursor-pointer hover:bg-pizza-red/90"
          >
            Cerrar Turno (Reporte Z)
          </button>
        </form>
      </div>
    )}
  </div>
);
