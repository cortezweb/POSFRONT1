import { Edit2, Table, Trash2 } from "lucide-react";

// Sección "mesas" del panel de administración
export const MesasTab = ({
  editingTable,
  handleDeleteTable,
  handleSaveTable,
  handleToggleTableStatus,
  setEditingTable,
  setTableCapacityForm,
  setTableNameForm,
  tableCapacityForm,
  tableNameForm,
  tablesList
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left animate-in fade-in zoom-in-95 duration-200">

    {/* Formulario de Mesa */}
    <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-5 h-fit">
      <div className="flex items-center gap-2 text-pizza-red">
        <Table size={18} />
        <h3 className="font-pizza-title font-bold text-sm uppercase">
          {editingTable ? "Editar Mesa" : "Gestionar Mesa"}
        </h3>
      </div>

      <form onSubmit={handleSaveTable} className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Nombre / Identificador de Mesa</label>
          <input
            type="text"
            required
            value={tableNameForm}
            onChange={(e) => setTableNameForm(e.target.value)}
            placeholder="Ej. Mesa 1, Terraza 5, Barra VIP"
            className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red/50"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Capacidad (Personas)</label>
          <input
            type="number"
            min="1"
            required
            value={tableCapacityForm}
            onChange={(e) => setTableCapacityForm(e.target.value)}
            placeholder="Ej. 4"
            className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pizza-red/50"
          />
        </div>

        <button type="submit" className="w-full bg-pizza-red text-white text-xs font-bold py-3 rounded-xl cursor-pointer hover:bg-pizza-red/90 transition-all shadow-md shadow-pizza-red/10">
          {editingTable ? "Guardar Cambios" : "Agregar Mesa"}
        </button>
        {editingTable && (
          <button type="button" onClick={() => { setEditingTable(null); setTableNameForm(""); setTableCapacityForm("4"); }} className="w-full bg-white/5 border border-white/10 text-white text-xs font-bold py-2 rounded-xl cursor-pointer hover:bg-white/10 transition-all mt-2">
            Cancelar Edición
          </button>
        )}
      </form>
    </div>

    {/* Tabla de Mesas */}
    <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-4">
      <h3 className="font-pizza-title font-bold text-sm uppercase text-white/70">Mesas y Estado de Ocupación</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/5 text-[9px] uppercase font-bold text-white/40 pb-2">
              <th className="pb-2">ID</th>
              <th className="pb-2">Nombre</th>
              <th className="pb-2">Capacidad</th>
              <th className="pb-2">Estado</th>
              <th className="pb-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {tablesList.map((t) => (
              <tr key={t.id} className="hover:bg-white/[0.01]">
                <td className="py-3 font-mono text-white/50">{t.id}</td>
                <td className="py-3 font-semibold text-white/80">{t.name}</td>
                <td className="py-3 text-white/60">{t.capacity} personas</td>
                <td className="py-3">
                  <button
                    type="button"
                    onClick={() => handleToggleTableStatus(t)}
                    className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase border cursor-pointer transition-colors ${
                      t.status === "ocupada"
                        ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/25"
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25"
                    }`}
                  >
                    {t.status === "ocupada" ? "Ocupada" : "Libre"}
                  </button>
                </td>
                <td className="py-3 text-right">
                  <button
                    type="button"
                    onClick={() => { setEditingTable(t); setTableNameForm(t.name); setTableCapacityForm(t.capacity.toString()); }}
                    className="p-1.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-lg transition-colors cursor-pointer mr-1.5"
                    title="Editar"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTable(t.id, t.name)}
                    className="p-1.5 bg-pizza-red/10 hover:bg-pizza-red/20 text-pizza-red rounded-lg transition-colors cursor-pointer"
                    title="Eliminar"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);
