import React from "react";
import { createPortal } from "react-dom";
import { formatCurrency } from "../utils/formatters";

/**
 * Componente de Ticket para Impresión en diferentes tamaños.
 * Se monta con id="print-ticket-container" para que @media print lo haga visible.
 */
export const TicketTemplate = ({ order, totals, config, printSize = "80mm" }) => {
  if (!order) return null;

  const currency = config?.currency || "USD";
  const sizeClass = `print-size-${printSize}`;
  const orderDate = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleString() : new Date().toLocaleString();
  const authDate = order.authorizedAt ? new Date(order.authorizedAt.seconds * 1000).toLocaleString() : null;

  // URL del QR de fidelización (menú digital de la pizzería)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin)}`;

  return createPortal(
    <div id="print-ticket-container" className={sizeClass}>
      <div className="ticket-card">
        {/* Encabezado */}
        <div className="ticket-header">
          <div className="ticket-logo-wrapper">
            <img 
              src={config?.logoUrl || "/pwa-192x192.png"} 
              alt="Logo" 
              className="ticket-logo" 
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          </div>
          <h1 className="company-name">{config?.name || "Pizza Hub & Co."}</h1>
          <p className="company-slogan">¡El verdadero sabor a la leña!</p>
          <p className="company-info">{config?.address || "Av. del Sabor 789, Ciudad Pizza"}</p>
          <p className="company-info">Telf/WhatsApp: {config?.whatsappNumber || "+51 999 999 999"}</p>
          {config?.tax?.taxEnabled && (
            <p className="company-tax-info">Boleta de Venta Simplificada</p>
          )}
        </div>

        {/* Número de Orden Destacado */}
        <div className="ticket-badge-container">
          <div className="ticket-badge">
            <h2>ORDEN #{order.orderNumber}</h2>
          </div>
        </div>

        {/* Información de la Orden */}
        <div className="ticket-info">
          <div className="info-row">
            <span className="info-label">Fecha/Hora:</span>
            <span className="info-val">{orderDate}</span>
          </div>
          {authDate && (
            <div className="info-row">
              <span className="info-label">Autorizado:</span>
              <span className="info-val">{authDate}</span>
            </div>
          )}
          <div className="info-divider"></div>
          <div className="info-row">
            <span className="info-label">Cliente:</span>
            <span className="info-val">{order.customerName}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Teléfono:</span>
            <span className="info-val">{order.customerPhone}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Servicio:</span>
            <span className="info-val font-bold">
              {order.serviceMode === "delivery"
                ? "🚀 Delivery"
                : order.serviceMode === "pickup"
                ? "🥡 Recojo en Local"
                : `🍽️ Mesa ${order.tableNumber}`}
            </span>
          </div>
          
          {order.serviceMode === "delivery" && (
            <div className="info-row address-row">
              <span className="info-label">Dirección:</span>
              <span className="info-val">{order.customerAddress}</span>
            </div>
          )}
          
          <div className="info-row">
            <span className="info-label">Método Pago:</span>
            <span className="info-val">
              {order.paymentMethod === "cash"
                ? "💵 Efectivo"
                : order.paymentMethod === "yape"
                ? "📱 Yape/Plin"
                : "💳 Transferencia"}
            </span>
          </div>
        </div>

        {/* Tabla de Artículos */}
        <table className="ticket-table">
          <thead>
            <tr>
              <th className="item-qty">Cant</th>
              <th className="item-name">Descripción</th>
              <th className="item-price">Importe</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => (
              <React.Fragment key={item.cartId || idx}>
                <tr className="item-row">
                  <td className="item-qty">{item.quantity}</td>
                  <td className="item-name">
                    <span className="product-title">{item.name}</span>
                    {item.discount > 0 && (
                      <span className="product-discount">
                        (-{item.discount}%)
                      </span>
                    )}
                  </td>
                  <td className="item-price">
                    {formatCurrency(item.price * item.quantity, currency)}
                  </td>
                </tr>
                {/* Detalles de Opciones */}
                {item.optionsSelected && Object.keys(item.optionsSelected).length > 0 && (
                  <tr className="details-row">
                    <td></td>
                    <td colSpan="2" className="item-details">
                      {Object.entries(item.optionsSelected)
                        .map(([k, v]) => `+ ${k}: ${v}`)
                        .join(", ")}
                    </td>
                  </tr>
                )}
                {/* Detalles de Combos */}
                {item.comboItems && item.comboItems.length > 0 && (
                  <tr className="details-row">
                    <td></td>
                    <td colSpan="2" className="item-details">
                      Combo: {item.comboItems.join(" + ")}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className="ticket-totals">
          <div className="ticket-total-row">
            <span>Subtotal:</span>
            <span>{formatCurrency(totals.subtotal, currency)}</span>
          </div>
          
          {totals.totalDiscount > 0 && (
            <div className="ticket-total-row discount-row">
              <span>Descuentos:</span>
              <span>-{formatCurrency(totals.totalDiscount, currency)}</span>
            </div>
          )}

          {config?.tax?.taxEnabled && (
            <div className="ticket-total-row">
              <span>{config.tax.taxName} ({config.tax.taxRate}%):</span>
              <span>
                {config.tax.taxIncluded ? "Incluido" : formatCurrency(totals.taxAmount, currency)}
              </span>
            </div>
          )}

          {order.serviceMode === "delivery" && (
            <div className="ticket-total-row">
              <span>Costo Envío:</span>
              <span>{formatCurrency(totals.shippingCost, currency)}</span>
            </div>
          )}

          <div className="ticket-total-row grand-total">
            <span>TOTAL A PAGAR:</span>
            <span>{formatCurrency(totals.total, currency)}</span>
          </div>
        </div>

        {/* Pie de página con QR */}
        <div className="ticket-footer">
          <p className="thanks-msg">🍕 ¡Gracias por su preferencia! 🍕</p>
          <p className="no-tax-note">Comprobante sin valor tributario</p>
          <div className="qr-container">
            <img src={qrUrl} alt="QR Code" className="ticket-qr" />
            <p className="qr-label">Escanea para ver nuestro menú digital</p>
          </div>
          <p className="dev-credit">Desarrollado con ❤️ para Pizzerías</p>
        </div>
      </div>
    </div>,
    document.body
  );
};
