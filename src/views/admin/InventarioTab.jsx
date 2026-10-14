import { useState } from "react";
import { updateDoc, increment } from "firebase/firestore";
import { rDoc } from "../../firebase/tenant";
import { Download, Edit2, Plus, Search, Trash2, Minus, LayoutGrid, List, Package, AlertTriangle, PackageX, Wallet, ImageOff } from "lucide-react";
import { HasPermission } from "../../components/HasPermission";
import { PERMISSIONS } from "../../utils/permissionsConfig";
import { formatCurrency } from "../../utils/formatters";

const LOW_STOCK = 5;

// Sección "inventario": catálogo del menú con stock, costos y margen
export const InventarioTab = ({
  businessConfig,
  categoriesListToUse,
  filteredInventory,
  productsList,
  handleDeleteProduct,
  handleExportInventoryCSV,
  handleOpenAddProduct,
  handleOpenEditProduct,
  inventoryCategory,
  inventorySearch,
  role,
  setInventoryCategory,
  setInventorySearch
}) => {
  const [stockFilter, setStockFilter] = useState("all");
  const [view, setView] = useState("list");
  const [sortBy, setSortBy] = useState("name");
  const cur = businessConfig.currency;
  const money = (n) => formatCurrency(n, cur);
  const catName = (id) => categoriesListToUse.find((c) => c.id === id)?.name || id || "—";

  const all = productsList || filteredInventory;
  const tracked = all.filter((p) => p.stock !== undefined && p.stock !== null);
  const outCount = tracked.filter((p) => p.stock <= 0).length;
  const lowCount = tracked.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK).length;
  const stockValue = tracked.reduce((n, p) => n + Math.max(0, p.stock) * Number(p.cost || 0), 0);
  const withCost = all.filter((p) => Number(p.cost) > 0 && Number(p.price) > 0);
  const avgMargin = withCost.length ? withCost.reduce((n, p) => n + (1 - Number(p.cost) / Number(p.price)), 0) / withCost.length * 100 : null;

  const finalPrice = (p) => Number(p.price || 0) * (1 - Number(p.discount || 0) / 100);
  const marginOf = (p) => (Number(p.cost) > 0 && finalPrice(p) > 0 ? (1 - Number(p.cost) / finalPrice(p)) * 100 : null);

  const items = filteredInventory
    .filter((p) => {
      if (stockFilter === "out") return p.stock !== undefined && p.stock <= 0;
      if (stockFilter === "low") return p.stock !== undefined && p.stock > 0 && p.stock <= LOW_STOCK;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "stock") return (a.stock ?? 9999) - (b.stock ?? 9999);
      if (sortBy === "price") return finalPrice(b) - finalPrice(a);
      if (sortBy === "margin") return (marginOf(b) ?? -999) - (marginOf(a) ?? -999);
      return (a.name || "").localeCompare(b.name || "");
    });

  const adjustStock = async (p, delta) => {
    try {
      await updateDoc(rDoc("products", p.id), { stock: increment(delta) });
    } catch (err) {
      console.error("Error al ajustar stock:", err);
      alert("No se pudo ajustar el stock.");
    }
  };

  const setStock = async (p) => {
    const value = window.prompt(`Stock actual de "${p.name}":`, String(p.stock ?? 0));
    if (value === null) return;
    const n = parseInt(value, 10);
    if (Number.isNaN(n) || n < 0) return alert("Ingresa un número válido.");
    try {
      await updateDoc(rDoc("products", p.id), { stock: n });
    } catch (err) {
      console.error("Error al fijar stock:", err);
    }
  };

  const stockBadge = (p) => {
    if (p.stock === undefined || p.stock === null) return <span className="text-white/30 text-[11px]">Sin control</span>;
    const cls = p.stock <= 0 ? "bg-red-500/15 text-red-400 border-red-500/25" : p.stock <= LOW_STOCK ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
    return (
      <button onClick={() => setStock(p)} className={`font-bold px-2.5 py-1 rounded-lg border text-[11px] cursor-pointer ${cls}`} title="Cambiar stock">
        {p.stock <= 0 ? "Agotado" : `${p.stock} u.`}
      </button>
    );
  };

  const stockStepper = (p) => (
    <HasPermission role={role} permission={PERMISSIONS.EDITAR_PRODUCTO} fallback={stockBadge(p)}>
      <div className="flex items-center gap-1">
        <button onClick={() => adjustStock(p, -1)} disabled={!p.stock || p.stock <= 0} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center disabled:opacity-30 cursor-pointer" aria-label={`Restar stock de ${p.name}`}><Minus size={12} /></button>
        {stockBadge(p)}
        <button onClick={() => adjustStock(p, 1)} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer" aria-label={`Sumar stock de ${p.name}`}><Plus size={12} /></button>
      </div>
    </HasPermission>
  );

  const actions = (p) => (
    <div className="flex justify-end gap-1.5">
      <HasPermission role={role} permission={PERMISSIONS.EDITAR_PRODUCTO}>
        <button onClick={() => handleOpenEditProduct(p)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer" title="Editar" aria-label={`Editar ${p.name}`}><Edit2 size={13} /></button>
      </HasPermission>
      <HasPermission role={role} permission={PERMISSIONS.ELIMINAR_PRODUCTO}>
        <button onClick={() => handleDeleteProduct(p.id)} className="p-2 bg-pizza-red/10 hover:bg-pizza-red/20 text-pizza-red rounded-lg cursor-pointer" title="Eliminar" aria-label={`Eliminar ${p.name}`}><Trash2 size={13} /></button>
      </HasPermission>
    </div>
  );

  const thumb = (p, size = "w-12 h-12") => (
    <div className={`${size} rounded-xl bg-pizza-dark overflow-hidden shrink-0 border border-white/5 flex items-center justify-center`}>
      {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" /> : <ImageOff size={16} className="text-white/20" />}
    </div>
  );

  const priceCell = (p) => (
    <div>
      <span className="font-bold">{money(finalPrice(p))}</span>
      {p.discount > 0 && <span className="block text-[10px] text-white/40 line-through">{money(p.price)}</span>}
    </div>
  );

  const marginCell = (p) => {
    const m = marginOf(p);
    if (m === null) return <span className="text-white/30 text-[11px]">Sin costo</span>;
    return (
      <div>
        <span className={`font-bold ${m < 30 ? "text-amber-400" : "text-emerald-400"}`}>{m.toFixed(0)}%</span>
        <span className="block text-[10px] text-white/40">Costo {money(p.cost)}</span>
      </div>
    );
  };

  const chip = (active) => `px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer ${active ? "bg-pizza-red text-white border-pizza-red" : "bg-[#181818] border-white/5 text-white/60 hover:bg-white/5"}`;

  return (
    <div className="space-y-5 text-left">
      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Package, label: "Productos", value: all.length, cls: "" },
          { icon: AlertTriangle, label: "Stock bajo", value: lowCount, cls: lowCount ? "text-amber-400" : "", onClick: () => setStockFilter("low") },
          { icon: PackageX, label: "Agotados", value: outCount, cls: outCount ? "text-red-400" : "", onClick: () => setStockFilter("out") },
          { icon: Wallet, label: "Valor en stock (costo)", value: money(stockValue), cls: "text-emerald-400", sub: avgMargin !== null ? `Margen promedio ${avgMargin.toFixed(0)}%` : "Carga costos para ver el margen" }
        ].map(({ icon: Icon, label, value, cls, sub, onClick }) => (
          <button key={label} onClick={onClick} disabled={!onClick} className="glass-panel rounded-2xl p-4 text-left disabled:cursor-default cursor-pointer">
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider flex items-center gap-1.5"><Icon size={12} /> {label}</span>
            <div className={`text-2xl font-black mt-1 ${cls}`}>{value}</div>
            {sub && <span className="text-[10px] text-white/40">{sub}</span>}
          </button>
        ))}
      </div>

      {/* Barra de herramientas */}
      <div className="glass-panel rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" size={14} />
              <input
                type="text"
                placeholder="Buscar por nombre o código..."
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                className="w-full bg-[#181818] border border-white/5 rounded-xl pl-9 pr-8 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-pizza-red/50"
              />
              {inventorySearch && (
                <button onClick={() => setInventorySearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-sm cursor-pointer" aria-label="Limpiar búsqueda">×</button>
              )}
            </div>
            <select value={inventoryCategory} onChange={(e) => setInventoryCategory(e.target.value)} className="bg-[#181818] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white">
              <option value="all">Todas las categorías</option>
              {categoriesListToUse.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-[#181818] border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white">
              <option value="name">Ordenar: Nombre</option>
              <option value="stock">Ordenar: Menos stock</option>
              <option value="price">Ordenar: Mayor precio</option>
              <option value="margin">Ordenar: Mayor margen</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportInventoryCSV} className="flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-xs px-4 py-2.5 rounded-xl font-bold cursor-pointer">
              <Download size={14} /> CSV
            </button>
            <HasPermission role={role} permission={PERMISSIONS.CREAR_PRODUCTO}>
              <button onClick={handleOpenAddProduct} className="flex items-center gap-1.5 bg-pizza-red hover:bg-pizza-red/90 text-white text-xs px-4 py-2.5 rounded-xl font-bold cursor-pointer shadow-lg shadow-pizza-red/20">
                <Plus size={14} /> Nuevo producto
              </button>
            </HasPermission>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button onClick={() => setStockFilter("all")} className={chip(stockFilter === "all")}>Todos</button>
            <button onClick={() => setStockFilter("low")} className={chip(stockFilter === "low")}>Stock bajo ({lowCount})</button>
            <button onClick={() => setStockFilter("out")} className={chip(stockFilter === "out")}>Agotados ({outCount})</button>
          </div>
          <div className="hidden md:flex gap-1 p-1 rounded-xl bg-[#181818] border border-white/5">
            <button onClick={() => setView("list")} className={`p-2 rounded-lg cursor-pointer ${view === "list" ? "bg-pizza-red text-white" : "text-white/50"}`} aria-label="Ver como lista"><List size={14} /></button>
            <button onClick={() => setView("grid")} className={`p-2 rounded-lg cursor-pointer ${view === "grid" ? "bg-pizza-red text-white" : "text-white/50"}`} aria-label="Ver como tarjetas"><LayoutGrid size={14} /></button>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="glass-panel rounded-2xl py-16 text-center text-xs text-white/40">
          <Package size={28} className="mx-auto mb-2 text-white/20" />
          No hay productos con estos filtros.
        </div>
      ) : (
        <>
          {/* Tabla (escritorio) */}
          <div className={`glass-panel rounded-2xl overflow-x-auto ${view === "list" ? "hidden md:block" : "hidden"}`}>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/5 text-[10px] uppercase font-bold text-white/40 tracking-wider">
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Precio</th>
                  <th className="py-3 px-4">Margen</th>
                  <th className="py-3 px-4">Stock</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {thumb(p)}
                        <div className="min-w-0">
                          <span className="font-bold block text-sm truncate max-w-[260px]">{p.name}</span>
                          <span className="text-[10px] text-white/40 font-mono">{p.id}</span>
                          {p.discount > 0 && <span className="ml-2 text-[9px] font-black text-pizza-red">-{p.discount}%</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4"><span className="bg-white/5 border border-white/10 px-2 py-1 rounded-md text-[10px] font-semibold">{catName(p.category)}</span></td>
                    <td className="py-3 px-4">{priceCell(p)}</td>
                    <td className="py-3 px-4">{marginCell(p)}</td>
                    <td className="py-3 px-4">{stockStepper(p)}</td>
                    <td className="py-3 px-4">{actions(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tarjetas (móvil o vista de tarjetas) */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 ${view === "list" ? "md:hidden" : ""}`}>
            {items.map((p) => (
              <div key={p.id} className="glass-panel rounded-2xl p-3 flex flex-col gap-3">
                <div className="flex gap-3">
                  {thumb(p, "w-16 h-16")}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm leading-tight">{p.name}</p>
                    <p className="text-[10px] text-white/40">{catName(p.category)}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {priceCell(p)}
                      {marginCell(p)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-2">
                  {stockStepper(p)}
                  {actions(p)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
