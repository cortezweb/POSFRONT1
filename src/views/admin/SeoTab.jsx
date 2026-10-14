import { Globe } from "lucide-react";

// Sección "seo" del panel de administración
export const SeoTab = ({
  businessConfig,
  handleSaveSeo,
  seoForm,
  setSeoForm
}) => (
  <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] text-left max-w-2xl mx-auto space-y-6">
    <div className="flex items-center gap-2 text-emerald-400">
      <Globe size={18} />
      <h3 className="font-pizza-title font-bold text-sm uppercase">Optimización SEO (Google Meta-Tags)</h3>
    </div>

    <form onSubmit={handleSaveSeo} className="space-y-4">
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Meta Título de Buscadores (Google)</label>
        <input
          type="text"
          required
          value={seoForm.metaTitle}
          onChange={(e) => setSeoForm(prev => ({ ...prev, metaTitle: e.target.value }))}
          placeholder={`Ej. '${businessConfig.name || "GloryChef"} - El verdadero sabor tradicional boliviano'`}
          className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400"
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Meta Descripción del Sitio Web</label>
        <textarea
          required
          value={seoForm.metaDescription}
          onChange={(e) => setSeoForm(prev => ({ ...prev, metaDescription: e.target.value }))}
          placeholder="Meta descripción de hasta 160 caracteres para Google."
          rows="3"
          className="w-full bg-[#181818] border border-white/5 rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-emerald-400"
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Palabras Clave (SEO Keywords)</label>
        <input
          type="text"
          value={seoForm.keywords}
          onChange={(e) => setSeoForm(prev => ({ ...prev, keywords: e.target.value }))}
          placeholder="comida boliviana, pique macho, salteñas, delivery (separadas por comas)"
          className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-400"
        />
      </div>

      <button
        type="submit"
        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl py-3.5 text-xs transition-all cursor-pointer"
      >
        Guardar Parámetros SEO
      </button>
    </form>
  </div>
);
