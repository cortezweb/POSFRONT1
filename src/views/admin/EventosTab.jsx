import { Download, Plus } from "lucide-react";

// Sección "eventos" del panel de administración
export const EventosTab = ({
  eventRegistrations,
  eventTabSubView,
  eventsList,
  handleDeleteEvent,
  handleDeleteRegistration,
  handleExportRegistrationsCSV,
  setCrudEvent,
  setEventForm,
  setEventTabSubView,
  setIsEventModalOpen
}) => (
  <div className="space-y-6">
    {/* Selector de sub-vistas */}
    <div className="flex justify-between items-center bg-[#121212] p-3.5 rounded-2xl border border-white/5 text-left">
      <div className="flex gap-2">
        <button
          onClick={() => setEventTabSubView("lista_eventos")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 ${
            eventTabSubView === "lista_eventos"
              ? "bg-pizza-red text-white shadow-md shadow-pizza-red/15"
              : "bg-white/5 text-white/60 hover:text-white"
          }`}
        >
          Eventos Configurados
        </button>
        <button
          onClick={() => setEventTabSubView("registros")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 ${
            eventTabSubView === "registros"
              ? "bg-pizza-red text-white shadow-md shadow-pizza-red/15"
              : "bg-white/5 text-white/60 hover:text-white"
          }`}
        >
          Pre-registros de Asistencia ({eventRegistrations.length})
        </button>
      </div>

      {eventTabSubView === "lista_eventos" ? (
        <button
          onClick={() => {
            setCrudEvent(null);
            setEventForm({
              title: "",
              description: "",
              date: "",
              time: "",
              couponCode: "",
              discountPercent: "15",
              active: true,
              bannerUrl: ""
            });
            setIsEventModalOpen(true);
          }}
          className="bg-pizza-gold text-pizza-dark hover:bg-pizza-gold/95 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-pizza-gold/15 border-0"
        >
          <Plus size={14} />
          Crear Evento
        </button>
      ) : (
        <button
          onClick={handleExportRegistrationsCSV}
          disabled={eventRegistrations.length === 0}
          className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/15 border-0"
        >
          <Download size={14} />
          Exportar CSV
        </button>
      )}
    </div>

    {/* Subvista: Lista de Eventos */}
    {eventTabSubView === "lista_eventos" && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
        {eventsList.length === 0 ? (
          <div className="col-span-full py-16 text-center text-white/40 text-xs italic bg-white/5 border border-dashed border-white/10 rounded-3xl">
            No hay eventos creados todavía. Haz clic en "Crear Evento" para empezar.
          </div>
        ) : (
          eventsList.map((event) => (
            <div
              key={event.id}
              className={`relative rounded-3xl overflow-hidden border p-5 bg-gradient-to-br from-[#1c1c1c] to-[#121212] transition-all flex flex-col justify-between min-h-[220px] ${
                event.active ? "border-pizza-gold/20 shadow-md shadow-pizza-gold/5" : "border-white/5 opacity-60"
              }`}
            >
              {event.bannerUrl && (
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-10 filter blur-xs pointer-events-none"
                  style={{ backgroundImage: `url(${event.bannerUrl})` }}
                />
              )}

              <div className="relative space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    event.active
                      ? "bg-green-500/10 text-green-400 border border-green-500/20"
                      : "bg-white/10 text-white/40 border border-white/5"
                  }`}>
                    {event.active ? "Activo" : "Borrador"}
                  </span>
                  <span className="text-[10px] text-white/50 font-semibold flex items-center gap-1">
                    📅 {event.date} | ⏰ {event.time}
                  </span>
                </div>

                <div>
                  <h4 className="font-pizza-title text-base font-bold text-white leading-tight">
                    {event.title}
                  </h4>
                  <p className="text-[11px] text-white/60 line-clamp-3 mt-1 font-sans">
                    {event.description}
                  </p>
                </div>

                {event.couponCode && (
                  <div className="bg-pizza-gold/10 border border-pizza-gold/25 rounded-xl p-2.5 flex justify-between items-center text-[10px]">
                    <span className="text-pizza-gold font-bold">🎟️ Cupón: {event.couponCode}</span>
                    <span className="text-white/70 font-semibold">{event.discountPercent}% Descuento</span>
                  </div>
                )}
              </div>

              <div className="relative mt-4 pt-3.5 border-t border-white/5 flex justify-end gap-2 shrink-0">
                <button
                  onClick={() => {
                    setCrudEvent(event);
                    setEventForm({
                      title: event.title,
                      description: event.description,
                      date: event.date,
                      time: event.time,
                      couponCode: event.couponCode || "",
                      discountPercent: event.discountPercent || "15",
                      active: event.active !== false,
                      bannerUrl: event.bannerUrl || ""
                    });
                    setIsEventModalOpen(true);
                  }}
                  className="bg-white/5 hover:bg-white/10 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors border-0 cursor-pointer"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDeleteEvent(event.id, event.title)}
                  className="bg-pizza-red/10 border border-pizza-red/20 text-pizza-red hover:bg-pizza-red/20 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer border-0"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    )}

    {/* Subvista: Pre-registros */}
    {eventTabSubView === "registros" && (
      <div className="glass-panel p-5 rounded-3xl border border-white/5 bg-[#121212] overflow-hidden text-left space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-white/55 font-pizza-title">Lista General de Clientes Pre-registrados</h4>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-black/20">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/5 text-white/40 uppercase text-[9px] tracking-wider font-extrabold">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">WhatsApp / Teléfono</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Cupón</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-sans">
              {eventRegistrations.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-white/30 italic">
                    No hay pre-registros de asistencia cargados en el sistema.
                  </td>
                </tr>
              ) : (
                eventRegistrations.map((reg) => {
                  const regDate = reg.registeredAt ? new Date(reg.registeredAt.seconds * 1000).toLocaleString() : "";
                  return (
                    <tr key={reg.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-white/50">{regDate}</td>
                      <td className="px-4 py-3 font-semibold text-white">{reg.eventTitle}</td>
                      <td className="px-4 py-3 font-bold text-pizza-gold">{reg.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <a
                          href={`https://wa.me/${reg.phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-400 hover:underline flex items-center gap-1"
                        >
                          💬 {reg.phone}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-white/70">{reg.email}</td>
                      <td className="px-4 py-3">
                        <span className="bg-pizza-gold/10 text-pizza-gold border border-pizza-gold/20 px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                          {reg.couponCode || "NINGUNO"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteRegistration(reg.id, reg.name)}
                          className="text-pizza-red hover:text-red-400 font-bold hover:underline bg-transparent border-0 cursor-pointer"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
);
