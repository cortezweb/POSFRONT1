import { formatCurrency } from "../../utils/formatters";
import { payMethodLabel } from "../../utils/payments";
import { buildA4Pdf, buildTicketPdf, buildWhatsAppText } from "../../utils/receiptPdf";
import { downloadBlob } from "../../utils/simplePdf";
import { Receipt, X, FileText, Printer, MessageCircle, Download, CheckCircle2 } from "lucide-react";

/**
 * Ventana "Recibo de venta" que aparece al finalizar una venta.
 * onPrint(size) imprime el comprobante en el tamaño pedido ("letter" o el de ticket).
 */
export const SaleReceiptModal = ({ receipt, businessConfig, onPrint, onClose }) => {
  if (!receipt) return null;
  const cur = businessConfig?.currency || "BOB";
  const money = (n) => formatCurrency(n, cur);
  const paid = receipt.payments.reduce((n, p) => n + Number(p.amount || 0), 0) + Number(receipt.change || 0);
  const fileBase = receipt.receiptNumber.replace(/[^a-zA-Z0-9-]/g, "");
  const customer = receipt.customer || {};

  const handleWhatsApp = () => {
    const suggested = (customer.phone || receipt.customerPhone || "").replace(/\D/g, "");
    const phone = window.prompt("Número de WhatsApp del cliente (con código de país, ej. 59170000000). Déjalo vacío para elegir el contacto en WhatsApp:", suggested);
    if (phone === null) return;
    const text = encodeURIComponent(buildWhatsAppText(receipt, businessConfig));
    const digits = phone.replace(/\D/g, "");
    window.open(digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`, "_blank", "noopener");
  };

  const actions = [
    { label: "Comprobante", icon: FileText, cls: "bg-blue-600 hover:bg-blue-700", onClick: () => onPrint("letter"), title: "Imprimir comprobante tamaño carta" },
    { label: "Imprimir", icon: Printer, cls: "bg-neutral-800 hover:bg-neutral-900 border border-white/10", onClick: () => onPrint("ticket"), title: "Imprimir ticket en la impresora térmica" },
    { label: "WhatsApp", icon: MessageCircle, cls: "bg-green-500 hover:bg-green-600", onClick: handleWhatsApp, title: "Enviar el detalle por WhatsApp" },
    { label: "Ticket", icon: Download, cls: "bg-orange-500 hover:bg-orange-600", onClick: () => downloadBlob(buildTicketPdf(receipt, businessConfig), `ticket-${fileBase}.pdf`), title: "Descargar ticket 80 mm en PDF" },
    { label: "PDF", icon: Download, cls: "bg-red-600 hover:bg-red-700", onClick: () => downloadBlob(buildA4Pdf(receipt, businessConfig), `comprobante-${fileBase}.pdf`), title: "Descargar comprobante A4 en PDF" }
  ];

  return (
    <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="w-full sm:max-w-3xl max-h-[96vh] bg-[#181818] text-white border border-white/10 sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col text-left">
        {/* Encabezado */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center"><Receipt size={20} /></div>
            <div>
              <h3 className="font-pizza-title text-lg font-bold leading-tight">Recibo de venta</h3>
              <p className="text-xs text-white/50">Comprobante generado correctamente</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/5 cursor-pointer" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-5">
          {/* Izquierda: resumen y acciones */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-3">
              <p className="text-[11px] font-bold text-white/70 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Resumen de pago</p>
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold">Total</span>
                <span className="text-2xl font-black text-emerald-400">{money(receipt.total)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-white/5 pt-2">
                <span className="text-white/60">Pagado</span>
                <span className="font-bold">{money(paid)}</span>
              </div>
              {receipt.change > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Cambio</span>
                  <span className="font-bold text-emerald-400">{money(receipt.change)}</span>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#121212] p-4">
              <p className="text-[11px] font-bold text-white/60 mb-3">Acciones</p>
              <div className="grid grid-cols-2 gap-2">
                {actions.map(({ label, icon: Icon, cls, onClick, title }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    title={title}
                    className={`${cls} text-white rounded-xl py-3 text-[11px] font-black uppercase tracking-wide flex items-center justify-center gap-2 shadow cursor-pointer transition-colors`}
                  >
                    <Icon size={15} /> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Derecha: cliente, productos y totales */}
          <div className="rounded-2xl border border-white/5 bg-[#121212] p-4 space-y-4">
            <div className="rounded-xl border border-white/5 bg-[#181818] p-3">
              <p className="text-[11px] font-bold text-white/70 mb-2">Datos del cliente</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="block text-[10px] text-white/40">Nombre</span>
                  <span className="font-semibold">{customer.name || "Clientes Varios"}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-white/40">Documento</span>
                  <span className="font-semibold">{customer.docNumber && customer.docNumber !== "0" ? `${customer.docType || ""} ${customer.docNumber}` : "0"}</span>
                </div>
                {(customer.address || receipt.tableNumber) && (
                  <div className="col-span-2">
                    <span className="block text-[10px] text-white/40">{customer.address ? "Dirección" : "Servicio"}</span>
                    <span className="font-semibold">{customer.address || `Mesa ${receipt.tableNumber}`}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-white/5">
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 bg-pizza-red text-white text-xs font-bold px-3 py-2.5">
                <span>Producto</span><span className="w-10 text-center">Cant.</span><span className="w-20 text-right">Subtotal</span>
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-white/5">
                {receipt.items.map((it, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-4 items-center px-3 py-2.5 text-xs">
                    <span>
                      {it.name}
                      {it.note && <span className="block text-[10px] text-amber-400">{it.note}</span>}
                    </span>
                    <span className="w-10 flex justify-center"><span className="bg-emerald-500/15 text-emerald-400 font-bold rounded-md px-2 py-0.5">{it.quantity}</span></span>
                    <span className="w-20 text-right font-semibold">{money(it.price * it.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-[#181818] p-3 space-y-1.5 text-xs">
              {receipt.discount > 0 && (
                <div className="flex justify-between text-pizza-red"><span>Descuento</span><span>-{money(receipt.discount)}</span></div>
              )}
              <div className="flex justify-between font-bold text-sm">
                <span>Total</span><span className="text-emerald-400">{money(receipt.total)}</span>
              </div>
              {receipt.payments.map((p, i) => (
                <div key={i} className="flex justify-between text-white/50">
                  <span>{payMethodLabel(p.method)}{p.reference ? ` · ${p.reference}` : ""}</span>
                  <span>{money(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pie */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-white/5">
          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Venta registrada · {receipt.receiptNumber}
          </span>
          <button onClick={onClose} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl cursor-pointer">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
