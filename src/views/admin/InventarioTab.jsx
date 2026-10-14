import { Download, Edit2, Plus, Search, Trash2 } from "lucide-react";
import { HasPermission } from "../../components/HasPermission";
import { PERMISSIONS } from "../../utils/permissionsConfig";
import { formatCurrency } from "../../utils/formatters";

// Sección "inventario" del panel de administración
export const InventarioTab = ({
  businessConfig,
  categoriesListToUse,
  filteredInventory,
  handleDeleteProduct,
  handleExportInventoryCSV,
  handleOpenAddProduct,
  handleOpenEditProduct,
  inventoryCategory,
  inventorySearch,
  role,
  setInventoryCategory,
  setInventorySearch
}) => (
  <div className="space-y-6">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">Catálogo de Productos del Menú</h3>

      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
        {/* Buscador de Inventario */}
        <div className="relative w-full sm:w-60">
          <Search className="absolute left-3 top-2.5 text-white/40" size={16} />
          <input
            type="text"
            placeholder="Buscar producto por nombre o ID..."
            value={inventorySearch}
            onChange={(e) => setInventorySearch(e.target.value)}
            className="w-full bg-[#181818] border border-white/5 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red/50"
          />
          {inventorySearch && (
            <button
              onClick={() => setInventorySearch("")}
              className="absolute right-2.5 top-2.5 text-white/40 hover:text-white text-xs cursor-pointer"
            >
              ×
            </button>
          )}
        </div>
        {/* Selector de Categorías de Inventario */}
        <select
          value={inventoryCategory}
          onChange={(e) => setInventoryCategory(e.target.value)}
          className="bg-[#181818] border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pizza-red/50 w-full sm:w-auto"
        >
          <option value="all">Todas las categorías</option>
          {categoriesListToUse.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        <button
          onClick={handleExportInventoryCSV}
          className="flex items-center justify-center gap-1.5 bg-[#181818] border border-white/10 hover:bg-white/5 text-xs px-4 py-2 rounded-xl cursor-pointer w-full sm:w-auto"
        >
          <Download size={14} className="text-[#ffd79b]" />
          Exportar Catálogo (CSV)
        </button>
        <HasPermission role={role} permission={PERMISSIONS.CREAR_PRODUCTO}>
          <button
            onClick={handleOpenAddProduct}
            className="flex items-center justify-center gap-1.5 bg-pizza-red hover:bg-pizza-red/90 text-xs px-4 py-2 rounded-xl font-bold cursor-pointer w-full sm:w-auto shrink-0"
          >
            <Plus size={14} />
            Agregar Producto
          </button>
        </HasPermission>
      </div>
    </div>

    {/* Table list */}
    <div className="glass-panel overflow-x-auto rounded-3xl border border-white/5 bg-[#121212]">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-white/5 bg-white/5 text-[10px] uppercase font-bold text-white/50 tracking-wider">
            <th className="py-4 px-6">Detalle</th>
            <th className="py-4 px-6">ID</th>
            <th className="py-4 px-6">Categoría</th>
            <th className="py-4 px-6">Precio Base</th>
            <th className="py-4 px-6">Stock</th>
            <th className="py-4 px-6">Descuento</th>
            <th className="py-4 px-6 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {filteredInventory.map((prod) => (
            <tr key={prod.id} className="hover:bg-white/[0.02] transition-colors">
              <td className="py-4 px-6 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-pizza-dark overflow-hidden shrink-0 border border-white/5">
                  <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <span className="font-bold text-white block text-sm">{prod.name}</span>
                  <span className="text-[10px] text-white/40 line-clamp-1 max-w-xs">{prod.description || "Sin descripción"}</span>
                </div>
              </td>
              <td className="py-4 px-6 font-mono text-white/50">{prod.id}</td>
              <td className="py-4 px-6">
                <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-[10px] font-semibold text-white/80 uppercase">
                  {prod.category}
                </span>
              </td>
              <td className="py-4 px-6 font-bold text-pizza-gold">
                {formatCurrency(prod.price, businessConfig.currency)}
              </td>
              <td className="py-4 px-6">
                {prod.stock !== undefined ? (
                  <span className={`font-bold px-2.5 py-0.5 rounded-md text-[10px] ${
                    prod.stock <= 0 ? "bg-pizza-red/15 border border-pizza-red/25 text-pizza-red" :
                    prod.stock <= 5 ? "bg-amber-500/15 border border-amber-500/25 text-amber-500" :
                    "bg-emerald-500/15 border border-emerald-500/25 text-emerald-400"
                  }`}>
                    {prod.stock} u.
                  </span>
                ) : (
                  <span className="text-white/30">-</span>
                )}
              </td>
              <td className="py-4 px-6">
                {prod.discount > 0 ? (
                  <span className="bg-pizza-red/10 border border-pizza-red/35 text-pizza-red text-[9px] font-black px-1.5 py-0.5 rounded">
                    -{prod.discount}% OFF
                  </span>
                ) : (
                  <span className="text-white/30">-</span>
                )}
              </td>
              <td className="py-4 px-6 text-right space-x-1.5 shrink-0">
                <HasPermission role={role} permission={PERMISSIONS.EDITAR_PRODUCTO}>
                  <button
                    onClick={() => handleOpenEditProduct(prod)}
                    className="p-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Editar"
                  >
                    <Edit2 size={13} />
                  </button>
                </HasPermission>
                <HasPermission role={role} permission={PERMISSIONS.ELIMINAR_PRODUCTO}>
                  <button
                    onClick={() => handleDeleteProduct(prod.id)}
                    className="p-2 bg-pizza-red/10 hover:bg-pizza-red/20 text-pizza-red rounded-lg transition-colors cursor-pointer"
                    title="Eliminar"
                  >
                    <Trash2 size={13} />
                  </button>
                </HasPermission>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
