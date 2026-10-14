import { Check, Loader2, MessageSquare, Printer, Search, X } from "lucide-react";
import { formatCurrency } from "../../utils/formatters";

// Sección "pedidos" del panel de administración
export const PedidosTab = ({
  archivedOrders,
  businessConfig,
  filterStatus,
  filteredActiveOrders,
  handleAuthorize,
  handleMarkCompleted,
  handleReject,
  handleShareDeliveryWhatsApp,
  loading,
  orderSearch,
  orderServiceMode,
  pendingOrders,
  preparingOrders,
  readyOrders,
  setFilterStatus,
  setOrderSearch,
  setOrderServiceMode,
  triggerPrint
}) => (
  <div className="space-y-6">
    {/* Stats */}
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
      <div
        onClick={() => setFilterStatus("pending_approval")}
        className={`glass-panel p-4 rounded-2xl border cursor-pointer transition-all ${
          filterStatus === "pending_approval"
            ? "border-[#ffd79b] bg-[#ffd79b]/5 shadow-lg shadow-[#ffd79b]/5"
            : "border-white/5 hover:border-white/15"
        }`}
      >
        <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Por Aprobar</span>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl font-black text-[#ffd79b]">{pendingOrders.length}</span>
          {pendingOrders.length > 0 && (
            <span className="text-[9px] text-pizza-red font-bold animate-pulse-soft">Revisar</span>
          )}
        </div>
      </div>

      <div
        onClick={() => setFilterStatus("preparing")}
        className={`glass-panel p-4 rounded-2xl border cursor-pointer transition-all ${
          filterStatus === "preparing"
            ? "border-pizza-red bg-pizza-red/5 shadow-lg shadow-pizza-red/5"
            : "border-white/5 hover:border-white/15"
        }`}
      >
        <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">En Cocina</span>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl font-black text-pizza-red">{preparingOrders.length}</span>
          <span className="text-[10px] text-white/50">Cocinando</span>
        </div>
      </div>

      <div
        onClick={() => setFilterStatus("ready")}
        className={`glass-panel p-4 rounded-2xl border cursor-pointer transition-all ${
          filterStatus === "ready"
            ? "border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/5"
            : "border-white/5 hover:border-white/15"
        }`}
      >
        <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Listos para Entrega</span>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl font-black text-emerald-400">{readyOrders.length}</span>
          <span className="text-[10px] text-white/50">Listo</span>
        </div>
      </div>

      <div
        onClick={() => setFilterStatus("archived")}
        className={`glass-panel p-4 rounded-2xl border cursor-pointer transition-all ${
          filterStatus === "archived"
            ? "border-white/40 bg-white/5"
            : "border-white/5 hover:border-white/15"
        }`}
      >
        <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Historial / Archivados</span>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl font-black text-white/70">{archivedOrders.length}</span>
          <span className="text-[10px] text-white/50">Cerrados</span>
        </div>
      </div>
    </section>

    {/* Pedidos Grid */}
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 print:hidden">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/50">
          Pedidos: {
            filterStatus === "pending_approval" ? "Pendientes de Autorización" :
            filterStatus === "preparing" ? "En Preparación en Cocina" :
            filterStatus === "ready" ? "Listos para despacho/servicio" : "Historial Completo / Cancelados"
          }
        </h3>

        {/* Buscador y Filtros de Pedidos */}
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 text-white/40" size={16} />
            <input
              type="text"
              placeholder="Buscar por orden, cliente, tlf..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              className="w-full bg-[#181818] border border-white/5 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-gold/50"
            />
            {orderSearch && (
              <button
                onClick={() => setOrderSearch("")}
                className="absolute right-2.5 top-2.5 text-white/40 hover:text-white text-xs cursor-pointer"
              >
                ×
              </button>
            )}
          </div>
          <select
            value={orderServiceMode}
            onChange={(e) => setOrderServiceMode(e.target.value)}
            className="bg-[#181818] border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pizza-gold/50"
          >
            <option value="all">Todas las modalidades</option>
            <option value="delivery">🚀 Delivery</option>
            <option value="pickup">🥡 Recojo</option>
            <option value="dinein">🍽️ Mesa</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-white/40 flex items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin text-pizza-red" />
          Cargando pedidos...
        </div>
      ) : filteredActiveOrders.length === 0 ? (
        <div className="glass-panel py-20 text-center rounded-3xl border border-white/5 text-white/35 text-sm">
          {orderSearch || orderServiceMode !== "all"
            ? "Ningún pedido coincide con los filtros aplicados."
            : "No hay órdenes registradas con este estado."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:hidden">
          {filteredActiveOrders.map((order) => {
            const dateText = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleTimeString() : "";
            const authDateText = order.authorizedAt ? new Date(order.authorizedAt.seconds * 1000).toLocaleTimeString() : "";

            return (
              <div
                key={order.id}
                className="bg-[#141414] border border-white/5 hover:border-white/10 rounded-3xl p-5 shadow-lg flex flex-col justify-between"
              >
                <div>
                  {/* Header Tarjeta */}
                  <div className="flex justify-between items-start border-b border-white/5 pb-3 mb-4">
                    <div>
                      <span className="text-sm font-black text-[#ffd79b]">Orden #{order.orderNumber}</span>
                      <span className="block text-[10px] text-white/40">{dateText}</span>
                      {order.authorizedAt && (
                        <span className="block text-[9px] text-[#ffd79b]/80">Aprobado: {authDateText}</span>
                      )}
                    </div>
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                      order.status === "pending_approval"
                        ? "bg-[#ffd79b]/10 border-[#ffd79b]/20 text-[#ffd79b]"
                        : order.status === "preparing"
                        ? "bg-pizza-red/10 border-pizza-red/20 text-pizza-red"
                        : order.status === "ready"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : order.status === "completed"
                        ? "bg-white/10 border-white/10 text-white/60"
                        : "bg-red-500/15 border-red-500/20 text-red-400"
                    }`}>
                      {order.status === "pending_approval" ? "Autorizar" :
                       order.status === "preparing" ? "Cocinando" :
                       order.status === "ready" ? "Listo" :
                       order.status === "completed" ? "Entregado" : "Rechazado"}
                    </span>
                  </div>

                  {/* Customer info */}
                  <div className="text-xs space-y-1 mb-4 text-left">
                    <p><strong>Cliente:</strong> {order.customerName}</p>
                    <p><strong>Teléfono:</strong> {order.customerPhone}</p>
                    <p><strong>Servicio:</strong> {
                      order.serviceMode === "delivery" ? "🚀 Delivery" :
                      order.serviceMode === "pickup" ? "🥡 Recojo" : `🍽️ Mesa ${order.tableNumber}`
                    }</p>
                    {order.serviceMode === "delivery" && (
                      <p className="line-clamp-2"><strong>Dirección:</strong> {order.customerAddress}</p>
                    )}
                    <p><strong>Pago:</strong> {
                      order.paymentMethod === "cash" ? "💵 Efectivo" :
                      order.paymentMethod === "yape" ? "📱 Yape/Plin" : "💳 Transferencia"
                    }</p>
                  </div>

                  {/* Details */}
                  <div className="border-t border-b border-white/5 py-3 mb-4 space-y-2 text-xs text-left">
                    <span className="block text-[9px] font-bold uppercase tracking-widest text-white/30">Detalle de Compra</span>
                    {order.items.map((item, idx) => (
                      <div key={item.cartId || idx} className="flex flex-col">
                        <div className="flex justify-between font-medium">
                          <span className="text-white">{item.quantity}x {item.name}</span>
                          <span className="text-white/60">
                            {formatCurrency(item.price * item.quantity, businessConfig.currency)}
                          </span>
                        </div>
                        {item.optionsSelected && Object.keys(item.optionsSelected).length > 0 && (
                          <span className="text-[10px] text-white/40 pl-3">
                            Opciones: {Object.entries(item.optionsSelected).map(([k, v]) => `${k}: ${v}`).join(", ")}
                          </span>
                        )}
                        {item.comboItems && item.comboItems.length > 0 && (
                          <span className="text-[10px] text-pizza-gold/80 pl-3">
                            Combo: {item.comboItems.join(" + ")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer card */}
                <div>
                  <div className="flex justify-between items-baseline mb-4 bg-black/40 rounded-xl p-3 border border-white/5 text-xs">
                    <span className="text-white/40">Total Cobrado:</span>
                    <span className="text-base font-black text-pizza-gold">
                      {formatCurrency(order.total, businessConfig.currency)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {order.status === "pending_approval" && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleReject(order)}
                          className="bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 text-red-400 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                        >
                          <X size={14} />
                          Rechazar
                        </button>
                        <button
                          onClick={() => handleAuthorize(order)}
                          className="bg-pizza-red hover:bg-pizza-red/95 text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md shadow-pizza-red/15"
                        >
                          <Check size={14} />
                          Autorizar
                        </button>
                      </div>
                    )}

                    {order.status === "ready" && (
                      <button
                        onClick={() => handleMarkCompleted(order)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5"
                      >
                        <Check size={14} />
                        Completar (Entregar)
                      </button>
                    )}

                    {order.serviceMode === "delivery" && order.status !== "pending_approval" && (
                      <button
                        onClick={() => handleShareDeliveryWhatsApp(order)}
                        className="bg-emerald-600/10 border border-emerald-500/25 hover:bg-emerald-600/20 text-emerald-400 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5"
                      >
                        <MessageSquare size={14} className="text-emerald-400" />
                        Repartidor (WhatsApp)
                      </button>
                    )}

                    {order.status !== "pending_approval" && (
                      <button
                        onClick={() => triggerPrint(order)}
                        className="bg-[#202020] border border-white/5 hover:bg-white/5 text-white py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5"
                      >
                        <Printer size={14} className="text-[#ffd79b]" />
                        Reimprimir Ticket
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
);
