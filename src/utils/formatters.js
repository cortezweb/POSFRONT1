/**
 * Formatea un monto numérico a formato de moneda local.
 */
export const formatCurrency = (amount, currency = "USD") => {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
};

/**
 * Genera el mensaje de texto estructurado y codificado para enviar por WhatsApp.
 */
export const formatWhatsAppMessage = (order, totals, config) => {
  const currency = config.currency || "USD";
  const taxName = config.tax?.taxName || "Impuesto";
  const taxEnabled = config.tax?.taxEnabled || false;

  let message = `🍕 *NUEVO PEDIDO - ${config.name || "Pizza Hub"}* 🍕\n`;
  message += `=============================\n`;
  message += `*Orden:* #${order.orderNumber}\n`;
  message += `*Cliente:* ${order.customerName}\n`;
  message += `*Teléfono:* ${order.customerPhone}\n`;
  
  let serviceText;
  if (order.serviceMode === "delivery") {
    serviceText = "🚀 Delivery a domicilio";
  } else if (order.serviceMode === "pickup") {
    serviceText = "🥡 Recojo en local";
  } else {
    serviceText = `🍽️ Consumo en local (Mesa ${order.tableNumber})`;
  }
  message += `*Tipo de Servicio:* ${serviceText}\n`;

  if (order.serviceMode === "delivery") {
    message += `*Dirección:* ${order.customerAddress}\n`;
    if (order.distanceKm) {
      message += `*Distancia:* ${order.distanceKm.toFixed(1)} km\n`;
    }
  }

  message += `=============================\n`;
  message += `*DETALLE DE PRODUCTOS:*\n`;

  order.items.forEach((item) => {
    message += `• ${item.quantity}x ${item.name} (${formatCurrency(item.price, currency)})\n`;
    
    // Modificadores / Opciones
    if (item.optionsSelected && Object.keys(item.optionsSelected).length > 0) {
      const opts = Object.entries(item.optionsSelected)
        .map(([key, val]) => `${key}: ${val}`)
        .join(", ");
      message += `  _[${opts}]_\n`;
    }

    // Artículos de combos
    if (item.comboItems && item.comboItems.length > 0) {
      message += `  _Combo: ${item.comboItems.join(" + ")}_\n`;
    }
  });

  message += `=============================\n`;
  message += `*Subtotal:* ${formatCurrency(totals.subtotal, currency)}\n`;
  
  if (totals.totalDiscount > 0) {
    message += `*Descuentos:* -${formatCurrency(totals.totalDiscount, currency)}\n`;
  }
  
  if (taxEnabled && !config.tax?.taxIncluded) {
    message += `*${taxName} (${config.tax.taxRate}%):* ${formatCurrency(totals.taxAmount, currency)}\n`;
  }
  
  if (order.serviceMode === "delivery") {
    message += `*Envío:* ${formatCurrency(totals.shippingCost, currency)}\n`;
  }
  
  message += `*TOTAL NETO:* ${formatCurrency(totals.total, currency)}\n`;
  message += `=============================\n`;
  
  let paymentText;
  if (order.paymentMethod === "cash") {
    paymentText = "💵 Efectivo";
  } else if (order.paymentMethod === "yape") {
    paymentText = "📱 Yape / Plin";
  } else {
    paymentText = "💳 Transferencia Bancaria";
  }
  message += `*Método de Pago:* ${paymentText}\n`;
  message += `=============================\n`;
  message += `_¡Tu pedido ha sido registrado en el sistema! Gracias por tu compra._`;

  return encodeURIComponent(message);
};
