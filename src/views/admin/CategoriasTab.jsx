import { Edit2, Tag, Trash2 } from "lucide-react";

// Sección "categorias" del panel de administración
export const CategoriasTab = ({
  categoriesListToUse,
  categoryForm,
  handleDeleteCategory,
  handleSaveCategory,
  setCategoryForm
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left animate-in fade-in zoom-in-95 duration-200">

    {/* Crear/Editar Categoría Form */}
    <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-5 h-fit">
      <div className="flex items-center gap-2 text-pizza-red">
        <Tag size={18} />
        <h3 className="font-pizza-title font-bold text-sm uppercase">Gestionar Categoría</h3>
      </div>

      <form onSubmit={handleSaveCategory} className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Nombre de la Categoría</label>
          <input
            type="text"
            required
            value={categoryForm.name}
            onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Ej. Postres, Ensaladas"
            className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red/50"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">ID Personalizado (Opcional)</label>
          <input
            type="text"
            value={categoryForm.id}
            onChange={(e) => setCategoryForm(prev => ({ ...prev, id: e.target.value }))}
            placeholder="Ej. postres (Autogenerado si está vacío)"
            className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red/50"
          />
        </div>

        <button type="submit" className="w-full bg-pizza-red text-white text-xs font-bold py-3 rounded-xl cursor-pointer hover:bg-pizza-red/90 transition-all shadow-md shadow-pizza-red/10">
          Guardar Categoría
        </button>
      </form>
    </div>

    {/* Tabla de Categorías */}
    <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-4">
      <h3 className="font-pizza-title font-bold text-sm uppercase text-white/70">Categorías Registradas</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/5 text-[9px] uppercase font-bold text-white/40 pb-2">
              <th className="pb-2">ID</th>
              <th className="pb-2">Nombre</th>
              <th className="pb-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {categoriesListToUse.map((cat) => (
              <tr key={cat.id} className="hover:bg-white/[0.01]">
                <td className="py-3 font-mono text-white/50">{cat.id}</td>
                <td className="py-3 font-semibold text-white/80">{cat.name}</td>
                <td className="py-3 text-right">
                  <button
                    onClick={() => setCategoryForm({ id: cat.id, name: cat.name })}
                    className="p-1.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-lg transition-colors cursor-pointer mr-1.5"
                    title="Editar"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
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
