/**
 * Formatea un monto numérico a formato de moneda local.
 */
export const formatCurrency = (amount, currency = "USD") => {
  try {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  } catch (e) {
    // Fallback para símbolos o códigos de moneda no estándar (ej: "Bs", "S/.", "$")
    const formatted = new Intl.NumberFormat("es-PE", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
    return `${currency} ${formatted}`;
  }
};

/**
 * Genera el mensaje de texto estructurado y codificado para enviar por WhatsApp.
 */
export const formatWhatsAppMessage = (order, totals, config) => {
  const currency = config.currency || "USD";
  const taxName = config.tax?.taxName || "Impuesto";
  const taxEnabled = config.tax?.taxEnabled || false;

  let message = `🌶️ *NUEVO PEDIDO - ${config.name || "Sabor Boliviano"}* 🌶️\n`;
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

/**
 * Analiza un ítem de combo para determinar si contiene opciones elegibles entre paréntesis.
 * Ejemplo: "Pizza 1 (Margherita/Diavola)" -> { name: "Pizza 1", options: ["Margherita", "Diavola"], isSelection: true }
 * Ejemplo: "Bebida 1.5L" -> { name: "Bebida 1.5L", options: [], isSelection: false }
 */
export const parseComboItem = (itemText) => {
  if (!itemText) return { name: "", options: [], isSelection: false };
  const regex = /^([^(]+)\(([^)]+)\)$/;
  const match = itemText.trim().match(regex);
  if (match) {
    const name = match[1].trim();
    const optionsString = match[2];
    // Split by '/' or ','
    const options = optionsString.split(/[/,]+/).map(o => o.trim()).filter(Boolean);
    return { name, options, isSelection: options.length > 0 };
  }
  return { name: itemText.trim(), options: [], isSelection: false };
};

/**
 * Obtiene el ajuste de precio de un valor de opción.
 * Ejemplo: "Familiar (+ $5.00)" o "Familiar (+$5.00)" o "Mediana (+3.00)" -> 5.00 o 3.00
 */
export const getOptionPriceAdjustment = (optionValue) => {
  if (!optionValue) return 0;
  const regex = /\(\+\s*\$?\s*([0-9.]+)\)/;
  const match = optionValue.match(regex);
  if (match) {
    const val = parseFloat(match[1]);
    return isNaN(val) ? 0 : val;
  }
  return 0;
};

/**
 * Calcula el precio final de un producto teniendo en cuenta el descuento y el ajuste de precio de las opciones seleccionadas.
 */
export const getProductPriceWithExtras = (product, optsSelected) => {
  if (!product) return 0;
  let optionExtra = 0;
  if (product.options && optsSelected) {
    Object.entries(optsSelected).forEach(([groupName, selectedVal]) => {
      optionExtra += getOptionPriceAdjustment(selectedVal);
    });
  }
  const discount = product.discount || 0;
  const baseWithExtra = product.price + optionExtra;
  return discount > 0 
    ? baseWithExtra * (1 - discount / 100) 
    : baseWithExtra;
};
