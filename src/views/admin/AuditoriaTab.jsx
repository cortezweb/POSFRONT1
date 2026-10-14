import { Download, Search, ShieldAlert } from "lucide-react";

// Sección "auditoria" del panel de administración
export const AuditoriaTab = ({
  auditActionFilter,
  auditActions,
  auditSearch,
  filteredAuditLogs,
  handleExportAuditCSV,
  setAuditActionFilter,
  setAuditSearch
}) => (
  <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-4 text-left">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
      <h3 className="font-pizza-title font-bold text-sm uppercase text-white/70 flex items-center gap-2">
        <ShieldAlert className="text-pizza-red" size={18} />
        Bitácora de Auditoría en Tiempo Real
      </h3>

      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
        {/* Buscador de Logs */}
        <div className="relative w-full sm:w-60">
          <Search className="absolute left-3 top-2.5 text-white/40" size={16} />
          <input
            type="text"
            placeholder="Buscar por usuario o detalle..."
            value={auditSearch}
            onChange={(e) => setAuditSearch(e.target.value)}
            className="w-full bg-[#181818] border border-white/5 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red/50"
          />
          {auditSearch && (
            <button
              onClick={() => setAuditSearch("")}
              className="absolute right-2.5 top-2.5 text-white/40 hover:text-white text-xs cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        {/* Selector de Acciones */}
        <select
          value={auditActionFilter}
          onChange={(e) => setAuditActionFilter(e.target.value)}
          className="bg-[#181818] border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pizza-red/50 w-full sm:w-auto font-mono text-[10px]"
        >
          <option value="all">Todas las acciones</option>
          {auditActions.filter(act => act !== "all").map(act => (
            <option key={act} value={act}>{act}</option>
          ))}
        </select>

        <span className="text-[10px] text-white/40 font-semibold bg-white/5 px-2.5 py-2 rounded-xl hidden sm:inline-block">Monitoreo</span>
        <button
          onClick={handleExportAuditCSV}
          className="flex items-center gap-1.5 bg-[#181818] border border-white/10 hover:bg-white/5 text-xs px-3.5 py-2 rounded-xl cursor-pointer transition-colors"
        >
          <Download size={14} className="text-pizza-gold" />
          Exportar (CSV)
        </button>
      </div>
    </div>

    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
      {filteredAuditLogs.length === 0 ? (
        <p className="text-center text-xs text-white/30 py-10">
          {auditSearch || auditActionFilter !== "all"
            ? "Ningún evento coincide con los filtros de búsqueda."
            : "Sin eventos de auditoría registrados"}
        </p>
      ) : (
        filteredAuditLogs.map((log) => {
          const logDate = log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString() : "";
          const isAlertAction = log.action?.includes("ELIMINAR") || log.action?.includes("SUSPENDER") || log.action?.includes("RECHAZAR");
          return (
            <div key={log.id} className="bg-[#181818] border border-white/5 rounded-xl p-3.5 flex justify-between items-start gap-4 text-xs hover:border-white/10 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase ${
                    isAlertAction
                      ? "bg-pizza-red/10 border-pizza-red/25 text-pizza-red animate-pulse-soft"
                      : "bg-pizza-gold/10 border-pizza-gold/25 text-pizza-gold"
                  }`}>
                    {log.action}
                  </span>
                  <span className="font-bold text-white/80">{log.userEmail}</span>
                </div>
                <p className="text-white/60">{log.details}</p>
              </div>
              <span className="text-[10px] text-white/30 font-mono shrink-0">{logDate}</span>
            </div>
          );
        })
      )}
    </div>
  </div>
);
