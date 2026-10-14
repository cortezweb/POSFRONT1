import { createPortal } from "react-dom";
import { formatCurrency } from "../utils/formatters";

const serviceLabel = (o) =>
  o.serviceMode === "delivery" ? "DELIVERY" : o.serviceMode === "pickup" ? "PARA LLEVAR" : `MESA ${o.tableNumber}`;

const fmtTime = (ts) => {
  const d = ts?.seconds ? new Date(ts.seconds * 1000) : new Date();
  return d.toLocaleString("es-BO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/**
 * Comanda para cocina: sin precios, letra grande, notas destacadas.
 * Se imprime al enviar un pedido desde el POS.
 */
export const KitchenTicket = ({ order, printSize = "80mm" }) => {
  if (!order) return null;
  return createPortal(
    <div id="print-ticket-container" className={`print-doc print-doc-${printSize === "58mm" ? "58" : "80"}`}>
      <div className="doc-center doc-title">COMANDA</div>
      <div className="doc-center doc-big">#{order.orderNumber}</div>
      <div className="doc-center doc-service">{serviceLabel(order)}</div>
      <div className="doc-row doc-small">
        <span>{fmtTime(order.createdAt)}</span>
        <span>{order.waiterName || ""}</span>
      </div>
      {order.customerName && <div className="doc-small">Cliente: {order.customerName}</div>}
      <div className="doc-sep" />
      {order.items.map((item, i) => (
        <div key={item.cartId || i} className="doc-item">
          <div className="doc-item-name">
            <strong>{item.quantity}</strong> × {item.name}
          </div>
          {item.optionsSelected && Object.keys(item.optionsSelected).length > 0 && (
            <div className="doc-item-sub">
              {Object.entries(item.optionsSelected).map(([k, v]) => `${k}: ${v}`).join(" · ")}
            </div>
          )}
          {item.comboItems?.length > 0 && <div className="doc-item-sub">Combo: {item.comboItems.join(" + ")}</div>}
          {item.note && <div className="doc-note">⚠ {item.note}</div>}
        </div>
      ))}
      {order.orderNote && (
        <>
          <div className="doc-sep" />
          <div className="doc-note">NOTA: {order.orderNote}</div>
        </>
      )}
      <div className="doc-sep" />
      <div className="doc-center doc-small">
        {order.items.reduce((n, i) => n + i.quantity, 0)} producto(s)
      </div>
    </div>,
    document.body
  );
};

/**
 * Precuenta: resumen con precios de todos los pedidos abiertos de una mesa.
 * No es comprobante de pago.
 */
export const PreBillTicket = ({ bill, config, printSize = "80mm" }) => {
  if (!bill) return null;
  const currency = config?.currency || "BOB";
  const tipRate = Number(config?.suggestedTipPercent ?? 10);
  const tip = Math.round(bill.total * tipRate) / 100;

  return createPortal(
    <div id="print-ticket-container" className={`print-doc print-doc-${printSize === "58mm" ? "58" : "80"}`}>
      <div className="doc-center doc-title">{config?.name || "GloryChef"}</div>
      {config?.address && <div className="doc-center doc-small">{config.address}</div>}
      <div className="doc-sep" />
      <div className="doc-center doc-big">PRECUENTA</div>
      <div className="doc-center doc-service">{bill.tableNumber ? `MESA ${bill.tableNumber}` : ""}</div>
      <div className="doc-row doc-small">
        <span>{fmtTime()}</span>
        <span>Pedidos: {bill.orderNumbers.map((n) => `#${n}`).join(", ")}</span>
      </div>
      <div className="doc-sep" />
      {bill.items.map((item, i) => (
        <div key={i} className="doc-row">
          <span className="doc-grow">{item.quantity} × {item.name}</span>
          <span>{formatCurrency(item.price * item.quantity, currency)}</span>
        </div>
      ))}
      <div className="doc-sep" />
      <div className="doc-row"><span>Subtotal</span><span>{formatCurrency(bill.subtotal, currency)}</span></div>
      {bill.discount > 0 && (
        <div className="doc-row"><span>Descuento</span><span>-{formatCurrency(bill.discount, currency)}</span></div>
      )}
      <div className="doc-row doc-total"><span>TOTAL</span><span>{formatCurrency(bill.total, currency)}</span></div>
      {tipRate > 0 && (
        <div className="doc-row doc-small">
          <span>Propina sugerida ({tipRate}%)</span>
          <span>{formatCurrency(tip, currency)}</span>
        </div>
      )}
      <div className="doc-sep" />
      <div className="doc-center doc-small">Documento no válido como comprobante de pago</div>
      <div className="doc-center doc-small">¡Gracias por su visita!</div>
    </div>,
    document.body
  );
};
