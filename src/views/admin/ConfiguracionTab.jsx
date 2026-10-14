import { Check, Download, Image, Loader2, Search, Settings, ShieldAlert, X } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";

// Sección "configuracion" del panel de administración
export const ConfiguracionTab = ({
  bannerProductSearch,
  handleBannerUpload,
  handleLogoUpload,
  handleQrUpload,
  handleSaveSettings,
  handleSeedDatabase,
  isSeeding,
  productsList,
  setBannerProductSearch,
  setSettingsForm,
  settingsForm,
  uploadHomeBannerError,
  uploadLogoError,
  uploadQrError,
  uploadingHomeBanner,
  uploadingLogo,
  uploadingQr
}) => (
  <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] text-left max-w-2xl mx-auto space-y-6">
    <div className="flex items-center gap-2 text-pizza-gold">
      <Settings size={18} />
      <h3 className="font-pizza-title font-bold text-sm uppercase">Configuración Comercial de Facturación</h3>
    </div>

    <form onSubmit={handleSaveSettings} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Nombre del Negocio</label>
          <input
            type="text"
            required
            value={settingsForm.name}
            onChange={(e) => setSettingsForm(prev => ({ ...prev, name: e.target.value }))}
            className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">WhatsApp Despacho</label>
          <input
            type="text"
            required
            value={settingsForm.whatsappNumber}
            onChange={(e) => setSettingsForm(prev => ({ ...prev, whatsappNumber: e.target.value }))}
            className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Logo del Negocio</label>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1 w-full space-y-2">
            <div className="flex gap-3 items-center">
              <input
                type="text"
                placeholder="URL del logo o sube un archivo..."
                value={settingsForm.logoUrl || ""}
                onChange={(e) => setSettingsForm(prev => ({ ...prev, logoUrl: e.target.value }))}
                className="flex-1 bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pizza-gold/50"
              />
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                id="logo-file-input"
                disabled={uploadingLogo}
              />
              <label
                htmlFor="logo-file-input"
                className="bg-[#181818] border border-white/10 hover:bg-white/5 text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5"
              >
                {uploadingLogo ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-pizza-red" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Download size={14} className="text-[#ffd79b] rotate-180" />
                    Subir Archivo
                  </>
                )}
              </label>
            </div>
            {uploadLogoError && (
              <p className="text-[10px] text-red-500 font-medium">{uploadLogoError}</p>
            )}
          </div>
          {settingsForm.logoUrl && (
            <div className="w-16 h-16 rounded-2xl bg-pizza-dark overflow-hidden shrink-0 border border-white/10 flex items-center justify-center shadow-lg">
              <img
                src={settingsForm.logoUrl}
                alt="Logo preview"
                className="w-full h-full object-cover"
                onError={(e) => { e.target.src = '/pwa-192x192.png'; }}
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Color de la Marca</label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="color"
            value={settingsForm.brandColor || "#ff5200"}
            onChange={(e) => setSettingsForm(prev => ({ ...prev, brandColor: e.target.value }))}
            className="w-12 h-10 rounded-xl bg-transparent border border-white/10 cursor-pointer"
            aria-label="Elegir color de la marca"
          />
          {["#ff5200", "#16a34a", "#dc2626", "#2563eb", "#7c3aed", "#db2777", "#0d9488", "#ca8a04"].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSettingsForm(prev => ({ ...prev, brandColor: c }))}
              className={`w-8 h-8 rounded-full border-2 cursor-pointer ${ (settingsForm.brandColor || "#ff5200") === c ? "border-white/80 scale-110" : "border-transparent" }`}
              style={{ backgroundColor: c }}
              aria-label={`Usar color ${c}`}
            />
          ))}
          <span className="text-[10px] text-white/40">Se aplica a botones, menú lateral y al menú de clientes.</span>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">QR de Yape / Plin (Método de Pago)</label>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1 w-full space-y-2">
            <div className="flex gap-3 items-center">
              <input
                type="text"
                placeholder="URL del QR o sube un archivo..."
                value={settingsForm.yapeQrUrl || ""}
                onChange={(e) => setSettingsForm(prev => ({ ...prev, yapeQrUrl: e.target.value }))}
                className="flex-1 bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pizza-gold/50"
              />
              <input
                type="file"
                accept="image/*"
                onChange={handleQrUpload}
                className="hidden"
                id="qr-file-input"
                disabled={uploadingQr}
              />
              <label
                htmlFor="qr-file-input"
                className="bg-[#181818] border border-white/10 hover:bg-white/5 text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5"
              >
                {uploadingQr ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-pizza-red" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Download size={14} className="text-[#ffd79b] rotate-180" />
                    Subir Archivo
                  </>
                )}
              </label>
            </div>
            {uploadQrError && (
              <p className="text-[10px] text-red-500 font-medium">{uploadQrError}</p>
            )}
          </div>
          {settingsForm.yapeQrUrl && (
            <div className="w-16 h-16 rounded-2xl bg-white overflow-hidden shrink-0 border border-white/10 flex items-center justify-center shadow-lg p-1">
              <img
                src={settingsForm.yapeQrUrl}
                alt="QR preview"
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Dirección de Sede Central</label>
        <input
          type="text"
          required
          value={settingsForm.address}
          onChange={(e) => setSettingsForm(prev => ({ ...prev, address: e.target.value }))}
          className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Moneda (ISO)</label>
          <input
            type="text"
            required
            value={settingsForm.currency}
            onChange={(e) => setSettingsForm(prev => ({ ...prev, currency: e.target.value }))}
            className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Nombre Impuesto (IGV / IVA)</label>
          <input
            type="text"
            required
            value={settingsForm.tax.taxName}
            onChange={(e) => setSettingsForm(prev => ({ ...prev, tax: { ...prev.tax, taxName: e.target.value } }))}
            className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Tasa del Impuesto (%)</label>
          <input
            type="number"
            required
            value={settingsForm.tax.taxRate}
            onChange={(e) => setSettingsForm(prev => ({ ...prev, tax: { ...prev.tax, taxRate: parseFloat(e.target.value || "0") } }))}
            className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Impuesto Activo</label>
          <select
            value={settingsForm.tax.taxEnabled.toString()}
            onChange={(e) => setSettingsForm(prev => ({ ...prev, tax: { ...prev.tax, taxEnabled: e.target.value === "true" } }))}
            className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white"
          >
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Incluido en Precio</label>
          <select
            value={settingsForm.tax.taxIncluded.toString()}
            onChange={(e) => setSettingsForm(prev => ({ ...prev, tax: { ...prev.tax, taxIncluded: e.target.value === "true" } }))}
            className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white"
          >
            <option value="true">Sí (Included)</option>
            <option value="false">No (Adicionado)</option>
          </select>
        </div>
      </div>

      {/* Banner de Inicio */}
      <div className="border-t border-white/5 pt-4 space-y-4">
        <div className="flex items-center gap-2 text-pizza-gold">
          <Image size={18} />
          <h4 className="font-pizza-title font-bold text-xs uppercase">Banner de la Página de Inicio</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Título y Subtítulo del Banner */}
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Título del Banner (Opcional)</label>
              <input
                type="text"
                placeholder="Ej. ¡2x1 en Platos Típicos! (Dejar vacío para el nombre del producto)"
                value={settingsForm.homeBannerTitle || ""}
                onChange={(e) => setSettingsForm(prev => ({ ...prev, homeBannerTitle: e.target.value }))}
                className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pizza-gold/50"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Subtítulo del Banner (Opcional)</label>
              <textarea
                placeholder="Ej. Pide cualquier pique macho familiar y la segunda es gratis. (Dejar vacío para descripción de producto)"
                value={settingsForm.homeBannerSubtitle || ""}
                onChange={(e) => setSettingsForm(prev => ({ ...prev, homeBannerSubtitle: e.target.value }))}
                rows="2"
                className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pizza-gold/50 resize-none"
              />
            </div>
          </div>

          {/* Imagen del Banner */}
          <div className="space-y-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">Imagen del Banner</label>
            <div className="flex gap-3 items-center">
              <input
                type="text"
                placeholder="URL de la imagen o sube un archivo..."
                value={settingsForm.homeBannerUrl || ""}
                onChange={(e) => setSettingsForm(prev => ({ ...prev, homeBannerUrl: e.target.value }))}
                className="flex-1 bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pizza-gold/50"
              />
              <input
                type="file"
                accept="image/*"
                onChange={handleBannerUpload}
                className="hidden"
                id="home-banner-file-input"
                disabled={uploadingHomeBanner}
              />
              <label
                htmlFor="home-banner-file-input"
                className="bg-[#181818] border border-white/10 hover:bg-white/5 text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 shrink-0"
              >
                {uploadingHomeBanner ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-pizza-red" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Download size={14} className="text-[#ffd79b] rotate-180" />
                    Subir
                  </>
                )}
              </label>
            </div>
            {uploadHomeBannerError && (
              <p className="text-[10px] text-red-500 font-medium mt-1">{uploadHomeBannerError}</p>
            )}
          </div>
        </div>

        {/* Selector Visual de Producto Vinculado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/5 pt-4">
          <div className="space-y-2.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">Vincular a un Producto (Opcional)</label>

            {/* Buscador interno */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={13} />
              <input
                type="text"
                placeholder="Filtrar productos..."
                value={bannerProductSearch}
                onChange={(e) => setBannerProductSearch(e.target.value)}
                className="w-full bg-[#181818] border border-white/5 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-gold/50"
              />
            </div>

            {/* Listado Visual */}
            <div className="bg-[#101010] border border-white/5 rounded-xl max-h-40 overflow-y-auto p-1.5 space-y-1 scrollbar-thin">
              <button
                type="button"
                onClick={() => setSettingsForm(prev => ({ ...prev, homeBannerProductId: "" }))}
                className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer border ${
                  !settingsForm.homeBannerProductId
                    ? "bg-pizza-gold/10 text-pizza-gold font-bold border-pizza-gold/30"
                    : "hover:bg-white/5 text-white/60 border-transparent"
                }`}
              >
                <span>-- No vincular a ningún producto --</span>
                {!settingsForm.homeBannerProductId && <Check size={12} />}
              </button>

              {productsList
                .filter(prod =>
                  prod.name?.toLowerCase().includes(bannerProductSearch.toLowerCase()) ||
                  prod.category?.toLowerCase().includes(bannerProductSearch.toLowerCase())
                )
                .map((prod) => {
                  const isSelected = settingsForm.homeBannerProductId === prod.id;
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => setSettingsForm(prev => ({ ...prev, homeBannerProductId: prod.id }))}
                      className={`w-full flex items-center gap-2.5 text-left p-1.5 rounded-lg text-xs transition-colors cursor-pointer border ${
                        isSelected
                          ? "bg-pizza-gold/10 text-pizza-gold font-bold border-pizza-gold/30"
                          : "hover:bg-white/5 text-white/70 border-transparent"
                      }`}
                    >
                      <img
                        src={prod.imageUrl}
                        alt={prod.name}
                        className="w-8 h-8 rounded-lg object-cover bg-black/25 shrink-0 border border-white/5"
                        onError={(e) => { e.target.src = '/pwa-192x192.png'; }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-semibold">{prod.name}</p>
                        <p className="text-[9px] text-white/40 truncate uppercase">{prod.category} • {formatCurrency(prod.price, settingsForm.currency)}</p>
                      </div>
                      {isSelected && <Check size={12} className="shrink-0 mr-1" />}
                    </button>
                  );
                })}
            </div>

            {/* Acciones del Producto Vinculado */}
            {settingsForm.homeBannerProductId && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const selectedProd = productsList.find(p => p.id === settingsForm.homeBannerProductId);
                    if (selectedProd && selectedProd.imageUrl) {
                      setSettingsForm(prev => ({ ...prev, homeBannerUrl: selectedProd.imageUrl }));
                    }
                  }}
                  className="bg-pizza-gold/10 hover:bg-pizza-gold/20 text-[#ffd79b] text-[10px] font-bold px-3 py-1.5 rounded-lg border border-pizza-gold/20 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Image size={10} />
                  Usar Imagen de Producto
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsForm(prev => ({ ...prev, homeBannerProductId: "" }))}
                  className="bg-white/5 hover:bg-white/10 text-white/60 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <X size={10} />
                  Quitar Vínculo
                </button>
              </div>
            )}
          </div>

          {/* Vista Previa del Banner */}
          <div className="flex flex-col justify-end space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40">Vista Previa del Banner</label>
            <div className="relative rounded-2xl overflow-hidden border border-white/10 w-full h-32 bg-black/40 flex items-center justify-center">
              {settingsForm.homeBannerUrl ? (
                <img
                  src={settingsForm.homeBannerUrl}
                  alt="Banner preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[10px] text-white/20 italic">No hay imagen cargada para el banner</span>
              )}
              <div className="absolute top-2 right-2 bg-pizza-dark/80 backdrop-blur-md px-2 py-0.5 rounded text-[8px] text-white/80 border border-white/5">
                Previsualización
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-pizza-gold text-pizza-dark font-black rounded-xl py-3.5 text-xs transition-all cursor-pointer hover:bg-[#ffd79b]"
      >
        Guardar Configuración General
      </button>
    </form>

    <div className="border-t border-white/5 pt-5 mt-4 space-y-3">
      <div className="flex items-center gap-2 text-red-500">
        <ShieldAlert size={16} />
        <h4 className="font-pizza-title font-bold text-xs uppercase">Mantenimiento de Base de Datos</h4>
      </div>
      <p className="text-[10px] text-white/50">
        Restablece la base de datos de Firestore cargando el menú completo de platos típicos bolivianos (Pique Macho, Silpancho, Sajta, Salteñas, bebidas, etc.), las categorías y configuraciones por defecto. Esta acción reemplazará los productos existentes.
      </p>
      <button
        type="button"
        disabled={isSeeding}
        onClick={handleSeedDatabase}
        className="w-full bg-red-600/10 border border-red-500/20 hover:bg-red-600/20 text-red-400 font-bold rounded-xl py-3 text-xs transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isSeeding ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Restableciendo base de datos...
          </>
        ) : (
          <>
            <ShieldAlert size={14} />
            Restablecer Base de Datos (Menú Boliviano)
          </>
        )}
      </button>
    </div>
  </div>
);
