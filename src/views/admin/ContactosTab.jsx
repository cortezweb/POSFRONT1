import { Download, Search } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";

// Sección "contactos" del panel de administración
export const ContactosTab = ({
  businessConfig,
  customerSearch,
  filteredCustomers,
  handleExportCustomersCSV,
  setCustomerSearch
}) => (
  <div className="space-y-6">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">Directorio de Clientes Recurrentes</h3>

      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
        {/* Buscador de Clientes */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 text-white/40" size={16} />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o dirección..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="w-full bg-[#181818] border border-white/5 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-gold/50"
          />
          {customerSearch && (
            <button
              onClick={() => setCustomerSearch("")}
              className="absolute right-2.5 top-2.5 text-white/40 hover:text-white text-xs cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        <button
          onClick={handleExportCustomersCSV}
          className="flex items-center justify-center gap-1.5 bg-[#181818] border border-white/10 hover:bg-white/5 text-xs px-4 py-2.5 rounded-xl cursor-pointer w-full sm:w-auto"
        >
          <Download size={14} className="text-[#ffd79b]" />
          Exportar Directorio (CSV)
        </button>
      </div>
    </div>

    <div className="glass-panel overflow-x-auto rounded-3xl border border-white/5 bg-[#121212]">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-white/5 bg-white/5 text-[10px] uppercase font-bold text-white/50 tracking-wider">
            <th className="py-4 px-6">Cliente</th>
            <th className="py-4 px-6">Teléfono / WhatsApp</th>
            <th className="py-4 px-6">Dirección de Envío</th>
            <th className="py-4 px-6">Frecuencia</th>
            <th className="py-4 px-6">Monto Histórico</th>
            <th className="py-4 px-6 text-right">Último Pedido</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {filteredCustomers.map((c, idx) => (
            <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
              <td className="py-4 px-6 font-bold text-white text-sm">{c.name}</td>
              <td className="py-4 px-6 font-mono text-white/70">{c.phone}</td>
              <td className="py-4 px-6 text-white/50 max-w-xs truncate">{c.address}</td>
              <td className="py-4 px-6 font-bold">{c.totalOrders} pedidos</td>
              <td className="py-4 px-6 font-bold text-pizza-gold">
                {formatCurrency(c.totalSpent, businessConfig.currency)}
              </td>
              <td className="py-4 px-6 text-white/40 text-right">
                {c.lastOrderDate ? new Date(c.lastOrderDate.seconds * 1000).toLocaleDateString() : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
