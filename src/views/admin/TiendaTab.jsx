import { Globe, Info, Loader2, MapPin, Search } from "lucide-react";

// Sección "tienda" del panel de administración
export const TiendaTab = ({
  adminMapContainerRef,
  adminMapSearch,
  adminMapSuggestions,
  businessConfig,
  handleAdminSearchChange,
  handleSaveStoreStatus,
  handleSelectAdminSuggestion,
  hasMapboxToken,
  isAdminMapSearchOpen,
  loadingAdminMap,
  setAdminMapSearch,
  setAdminMapSuggestions,
  setIsAdminMapSearchOpen,
  setStoreStatusForm,
  storeStatusForm
}) => (
  <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] text-left max-w-2xl mx-auto space-y-6">
    <div className="flex items-center gap-2 text-emerald-400">
      <Globe size={18} />
      <h3 className="font-pizza-title font-bold text-sm uppercase">Parámetros de Tienda Online</h3>
    </div>

    <form onSubmit={handleSaveStoreStatus} className="space-y-5">
      <div className="space-y-2">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">Mensaje de Mantenimiento / Cierre de Tienda</label>
        <textarea
          value={storeStatusForm.maintenanceMessage}
          onChange={(e) => setStoreStatusForm(prev => ({ ...prev, maintenanceMessage: e.target.value }))}
          placeholder="Ej. 'Cerrado temporalmente por mantenimiento.' Dejar vacío para abrir tienda al público."
          rows="2"
          className="w-full bg-[#181818] border border-white/5 rounded-xl p-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-400"
        />
        <p className="text-[9px] text-white/40">Si el mensaje contiene texto, la tienda web mostrará el mensaje y bloqueará los pedidos.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Latitud GPS de Tienda</label>
          <input
            type="number"
            step="0.000001"
            required
            value={storeStatusForm.baseLat}
            onChange={(e) => setStoreStatusForm(prev => ({ ...prev, baseLat: e.target.value }))}
            className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Longitud GPS de Tienda</label>
          <input
            type="number"
            step="0.000001"
            required
            value={storeStatusForm.baseLng}
            onChange={(e) => setStoreStatusForm(prev => ({ ...prev, baseLng: e.target.value }))}
            className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400"
          />
        </div>
      </div>

      {/* Mapa para ubicación de local */}
      {hasMapboxToken && (
        <div className="space-y-3 border-t border-white/5 pt-4">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">Ubicación del Local en Mapa</label>

          {/* Buscador de dirección */}
          <div className="relative">
            <input
              type="text"
              value={adminMapSearch}
              onChange={handleAdminSearchChange}
              placeholder="Busca la dirección de tu local para ubicarlo..."
              className="w-full bg-[#181818] border border-white/5 rounded-xl px-4 py-2.5 pl-10 text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-400"
            />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
              {loadingAdminMap ? (
                <Loader2 size={14} className="animate-spin text-emerald-400" />
              ) : (
                <Search size={14} />
              )}
            </div>
            {adminMapSearch && (
              <button
                type="button"
                onClick={() => {
                  setAdminMapSearch("");
                  setAdminMapSuggestions([]);
                  setIsAdminMapSearchOpen(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs cursor-pointer"
              >
                ×
              </button>
            )}
          </div>

          {/* Lista de sugerencias */}
          {isAdminMapSearchOpen && (adminMapSuggestions.length > 0 || loadingAdminMap) && (
            <div className="relative">
              <div className="absolute z-50 w-full bg-[#181818] border border-white/10 rounded-xl shadow-2xl max-h-40 overflow-y-auto overflow-x-hidden backdrop-blur-xl">
                {loadingAdminMap && adminMapSuggestions.length === 0 ? (
                  <div className="p-3 text-center text-[10px] text-white/50 flex items-center justify-center gap-1.5">
                    <Loader2 size={12} className="animate-spin text-pizza-gold" />
                    Buscando...
                  </div>
                ) : (
                  <ul className="py-1">
                    {adminMapSuggestions.map((suggestion) => (
                      <li
                        key={suggestion.id}
                        onClick={() => handleSelectAdminSuggestion(suggestion)}
                        className="flex items-start gap-2 px-3.5 py-2 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 transition-colors text-xs text-left"
                      >
                        <MapPin size={12} className="text-pizza-gold shrink-0 mt-0.5" />
                        <span className="text-white text-left line-clamp-2">
                          {suggestion.placeName}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Contenedor del mapa */}
          <div className="space-y-1">
            <div
              ref={adminMapContainerRef}
              className="w-full h-48 rounded-2xl border border-white/5 relative overflow-hidden bg-black/40"
              style={{ minHeight: "180px" }}
            />
            <div className="flex items-center gap-1.5 text-[9px] text-white/40 px-1">
              <Info size={9} className="text-pizza-gold" />
              <span>Puedes hacer clic en el mapa o arrastrar el marcador para fijar la ubicación exacta.</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Costo por KM Recorrido ({businessConfig.currency})</label>
          <input
            type="number"
            step="0.01"
            required
            value={storeStatusForm.deliveryCostPerKm}
            onChange={(e) => setStoreStatusForm(prev => ({ ...prev, deliveryCostPerKm: e.target.value }))}
            className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Radio de Entrega Máximo (KM)</label>
          <input
            type="number"
            step="0.1"
            required
            value={storeStatusForm.deliveryRange}
            onChange={(e) => setStoreStatusForm(prev => ({ ...prev, deliveryRange: e.target.value }))}
            className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400"
          />
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl py-3.5 text-xs transition-all cursor-pointer"
      >
        Guardar Parámetros de la Tienda
      </button>
    </form>
  </div>
);
