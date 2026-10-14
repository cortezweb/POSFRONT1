import { Percent } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";

// Sección "marketing" del panel de administración
export const MarketingTab = ({
  businessConfig,
  handleAddAutoDiscount,
  handleAddCoupon,
  handleDeleteAutoDiscount,
  handleDeleteCoupon,
  marketingForm,
  setMarketingForm
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">

    {/* Coupon Manager */}
    <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-5">
      <div className="flex items-center gap-2 text-pizza-red">
        <Percent size={18} />
        <h3 className="font-pizza-title font-bold text-sm uppercase">Cupones de Descuento</h3>
      </div>

      <form onSubmit={handleAddCoupon} className="flex gap-2">
        <input
          type="text"
          required
          value={marketingForm.couponCode}
          onChange={(e) => setMarketingForm(prev => ({ ...prev, couponCode: e.target.value }))}
          placeholder="CÓDIGO (Ej. LUNES30)"
          className="flex-1 bg-[#181818] border border-white/5 rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none"
        />
        <input
          type="number"
          required
          value={marketingForm.couponDiscount}
          onChange={(e) => setMarketingForm(prev => ({ ...prev, couponDiscount: e.target.value }))}
          placeholder="%"
          className="w-16 bg-[#181818] border border-white/5 rounded-xl px-2 py-2 text-xs text-white text-center focus:outline-none"
        />
        <button type="submit" className="bg-pizza-red text-white text-xs font-bold px-4 rounded-xl cursor-pointer">
          Agregar
        </button>
      </form>

      <div className="divide-y divide-white/5 max-h-60 overflow-y-auto pr-1">
        {Object.entries(businessConfig.discounts?.coupons || {}).map(([code, discount]) => (
          <div key={code} className="py-2.5 flex justify-between items-center text-xs">
            <div>
              <span className="font-mono font-bold text-white bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[10px]">
                {code}
              </span>
              <span className="ml-2 font-semibold text-white/70">Descuento: {discount}%</span>
            </div>
            <button
              onClick={() => handleDeleteCoupon(code)}
              className="text-[10px] font-bold text-pizza-red hover:underline cursor-pointer"
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>
    </div>

    {/* Auto Discounts Manager */}
    <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-5">
      <div className="flex items-center gap-2 text-pizza-gold">
        <Percent size={18} />
        <h3 className="font-pizza-title font-bold text-sm uppercase">Reglas de Descuento Progresivo</h3>
      </div>

      <form onSubmit={handleAddAutoDiscount} className="flex gap-2">
        <input
          type="number"
          step="0.01"
          required
          value={marketingForm.minAmountDiscount}
          onChange={(e) => setMarketingForm(prev => ({ ...prev, minAmountDiscount: e.target.value }))}
          placeholder="Monto Mínimo (USD)"
          className="flex-1 bg-[#181818] border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
        />
        <input
          type="number"
          required
          value={marketingForm.discountPercentRule}
          onChange={(e) => setMarketingForm(prev => ({ ...prev, discountPercentRule: e.target.value }))}
          placeholder="Descuento %"
          className="w-24 bg-[#181818] border border-white/5 rounded-xl px-2 py-2 text-xs text-white text-center focus:outline-none"
        />
        <button type="submit" className="bg-pizza-gold text-pizza-dark text-xs font-black px-4 rounded-xl cursor-pointer">
          Agregar
        </button>
      </form>

      <div className="divide-y divide-white/5 max-h-60 overflow-y-auto pr-1">
        {(businessConfig.discounts?.autoDiscounts || []).map((rule, idx) => (
          <div key={idx} className="py-2.5 flex justify-between items-center text-xs">
            <span className="font-semibold text-white/70">
              Compras de +{formatCurrency(rule.minAmount, businessConfig.currency)}: <strong className="text-pizza-gold">-{rule.discountPercent}% OFF</strong>
            </span>
            <button
              onClick={() => handleDeleteAutoDiscount(idx)}
              className="text-[10px] font-bold text-pizza-red hover:underline cursor-pointer"
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>
    </div>
  </div>
);
