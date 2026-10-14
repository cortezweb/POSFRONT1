import { Download, FileText } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";

// Sección "turnos" del panel de administración
export const TurnosTab = ({
  businessConfig,
  handleExportShiftsCSV,
  shifts
}) => (
  <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-4 text-left">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
      <h3 className="font-pizza-title font-bold text-sm uppercase text-white/70 flex items-center gap-2">
        <FileText className="text-pizza-gold" size={18} />
        Historial de Turnos y Cierres (Reportes Z)
      </h3>

      <button
        onClick={handleExportShiftsCSV}
        className="flex items-center gap-1.5 bg-[#181818] border border-white/10 hover:bg-white/5 text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-colors animate-fade-in"
      >
        <Download size={14} className="text-pizza-gold" />
        Exportar Reportes Z (CSV)
      </button>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-white/5 text-[9px] uppercase font-bold text-white/40 pb-2">
            <th className="pb-2">Cajero</th>
            <th className="pb-2">Apertura / Cierre</th>
            <th className="pb-2">Monto Base</th>
            <th className="pb-2">Monto Esperado</th>
            <th className="pb-2">Monto Real</th>
            <th className="pb-2 text-right">Descuadre</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {shifts.map((s) => {
            const openDate = s.openTime ? new Date(s.openTime.seconds * 1000).toLocaleString() : "";
            const closeDate = s.closeTime ? new Date(s.closeTime.seconds * 1000).toLocaleString() : "Turno Activo";
            const totalExpected = (s.expectedCash || 0) + (s.expectedElectronic || 0);
            const totalActual = (s.actualCash || 0) + (s.actualElectronic || 0);
            return (
              <tr key={s.id} className="hover:bg-white/[0.01]">
                <td className="py-3 font-semibold text-white/80">{s.openedBy}</td>
                <td className="py-3 text-[10px]">
                  <span className="block text-emerald-400">A: {openDate}</span>
                  {s.closeTime && <span className="block text-white/40">C: {closeDate}</span>}
                </td>
                <td className="py-3">{formatCurrency(s.cashBase, businessConfig.currency)}</td>
                <td className="py-3">{s.status === "open" ? "Abierto" : formatCurrency(totalExpected, businessConfig.currency)}</td>
                <td className="py-3">{s.status === "open" ? "Abierto" : formatCurrency(totalActual, businessConfig.currency)}</td>
                <td className={`py-3 text-right font-bold ${
                  s.discrepancy < 0 ? "text-pizza-red" :
                  s.discrepancy > 0 ? "text-emerald-400" : "text-white/60"
                }`}>
                  {s.status === "open" ? "-" : formatCurrency(s.discrepancy, businessConfig.currency)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);
