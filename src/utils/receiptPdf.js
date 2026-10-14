import { createPdf } from "./simplePdf";
import { formatCurrency } from "./formatters";
import { payMethodLabel } from "./payments";

export const RECEIPT_TITLES = { nota: "NOTA DE VENTA", boleta: "BOLETA DE VENTA", factura: "FACTURA" };

const fmtDate = (ms) =>
  new Date(ms || Date.now()).toLocaleString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const docLabel = (c) => (c?.docNumber && c.docNumber !== "0" ? `${c.docType || "CI/NIT"} ${c.docNumber}` : "CI/NIT 0");

// Corta un texto en líneas de hasta `max` caracteres
const wrap = (text, max) => {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let cur = "";
  words.forEach((w) => {
    if ((cur + " " + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  });
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
};

/** Comprobante tamaño A4 con encabezado, cliente, tabla de productos y totales. */
export const buildA4Pdf = (r, config = {}) => {
  const brand = config.brandColor || "#ff5200";
  const cur = config.currency || "BOB";
  const money = (n) => formatCurrency(n, cur);
  const W = 595.28;
  const H = 841.89;
  const M = 42;
  const pdf = createPdf({ width: W, height: H });

  // Encabezado
  pdf.rect(0, 0, W, 6, brand);
  pdf.text(M, 52, config.name || "GloryChef", { size: 20, font: "bold" });
  let y = 70;
  [config.taxId ? `${config.taxIdLabel || "NIT"} ${config.taxId}` : "", config.address, config.whatsappNumber ? `Tel. ${config.whatsappNumber}` : ""]
    .filter(Boolean)
    .forEach((line) => { pdf.text(M, y, line, { size: 9, color: "#555555" }); y += 13; });

  // Recuadro del comprobante
  const bx = W - M - 190;
  pdf.rect(bx, 34, 190, 64, "#f3f4f6");
  pdf.rect(bx, 34, 190, 20, brand);
  pdf.text(bx + 95, 48, RECEIPT_TITLES[r.receiptType] || "COMPROBANTE", { size: 10, font: "bold", align: "center", color: "#ffffff" });
  pdf.text(bx + 95, 74, r.receiptNumber, { size: 14, font: "bold", align: "center" });
  pdf.text(bx + 95, 90, fmtDate(r.createdAtMs), { size: 8, align: "center", color: "#555555" });

  // Cliente
  y = 130;
  pdf.rect(M, y, W - 2 * M, 62, "#f9fafb");
  pdf.text(M + 12, y + 18, "DATOS DEL CLIENTE", { size: 8, font: "bold", color: "#6b7280" });
  pdf.text(M + 12, y + 34, "Nombre", { size: 8, color: "#6b7280" });
  pdf.text(M + 12, y + 47, r.customer?.name || "Clientes Varios", { size: 10, font: "bold" });
  pdf.text(M + 260, y + 34, "Documento", { size: 8, color: "#6b7280" });
  pdf.text(M + 260, y + 47, docLabel(r.customer), { size: 10, font: "bold" });
  const extra = r.customer?.address || (r.tableNumber ? `Mesa ${r.tableNumber}` : r.customer?.phone || "");
  if (extra) {
    pdf.text(M + 390, y + 34, r.customer?.address ? "Dirección" : r.tableNumber ? "Servicio" : "Teléfono", { size: 8, color: "#6b7280" });
    pdf.text(M + 390, y + 47, extra.slice(0, 28), { size: 10, font: "bold" });
  }

  // Tabla
  y = 212;
  const colQty = W - M - 170;
  const colPrice = W - M - 90;
  const colSub = W - M - 10;
  pdf.rect(M, y, W - 2 * M, 22, "#1f2937");
  pdf.text(M + 12, y + 15, "Producto", { size: 9, font: "bold", color: "#ffffff" });
  pdf.text(colQty, y + 15, "Cant.", { size: 9, font: "bold", color: "#ffffff", align: "center" });
  pdf.text(colPrice, y + 15, "P. Unit.", { size: 9, font: "bold", color: "#ffffff", align: "right" });
  pdf.text(colSub, y + 15, "Subtotal", { size: 9, font: "bold", color: "#ffffff", align: "right" });
  y += 22;
  r.items.forEach((it, i) => {
    const lines = wrap(it.name, 55);
    const rowH = 12 + lines.length * 12 + (it.note ? 11 : 0);
    if (i % 2 === 1) pdf.rect(M, y, W - 2 * M, rowH, "#f9fafb");
    lines.forEach((ln, k) => pdf.text(M + 12, y + 16 + k * 12, ln, { size: 10 }));
    if (it.note) pdf.text(M + 12, y + 16 + lines.length * 12, `Nota: ${it.note}`, { size: 8, color: "#b45309" });
    pdf.text(colQty, y + 16, String(it.quantity), { size: 10, align: "center" });
    pdf.text(colPrice, y + 16, money(it.price), { size: 10, align: "right" });
    pdf.text(colSub, y + 16, money(it.price * it.quantity), { size: 10, font: "bold", align: "right" });
    y += rowH;
  });
  pdf.line(M, y + 4, W - M, y + 4, { color: "#d1d5db" });

  // Totales
  y += 22;
  const lx = W - M - 220;
  const row = (label, value, opts = {}) => {
    pdf.text(lx, y, label, { size: opts.size || 9, font: opts.bold ? "bold" : "regular", color: opts.color || "#374151" });
    pdf.text(W - M - 10, y, value, { size: opts.size || 9, font: opts.bold ? "bold" : "regular", align: "right", color: opts.color || "#111111" });
    y += opts.size ? opts.size + 8 : 15;
  };
  if (r.discount > 0) row("Descuento", `-${money(r.discount)}`, { color: "#dc2626" });
  row("Op. Gravadas", money(r.taxBase));
  row(`I.V.A. (${config.tax?.taxRate ?? 13}%)`, money(r.taxAmount));
  y += 4;
  pdf.rect(lx - 10, y - 14, 230, 26, "#f3f4f6");
  row("TOTAL", money(r.total), { bold: true, size: 13, color: brand });
  y += 4;
  r.payments.forEach((p) => row(`${payMethodLabel(p.method)}${p.reference ? ` (${p.reference})` : ""}`, money(p.amount)));
  if (r.change > 0) row("Cambio", money(r.change), { bold: true });

  // Pie
  pdf.line(M, H - 70, W - M, H - 70, { color: "#e5e7eb" });
  pdf.text(W / 2, H - 52, "¡Gracias por su preferencia!", { size: 10, font: "bold", align: "center" });
  pdf.text(W / 2, H - 38, r.receiptType === "factura" ? "Factura registrada en el sistema." : "Documento emitido por GloryChef POS.", { size: 8, align: "center", color: "#6b7280" });
  return pdf.toBlob();
};

/** Ticket de 80 mm en letra monoespaciada. */
export const buildTicketPdf = (r, config = {}) => {
  const cur = config.currency || "BOB";
  const money = (n) => formatCurrency(n, cur);
  const W = 226.77; // 80 mm
  const M = 10;
  const C = 34; // caracteres por línea aprox. con tamaño 8
  const lines = [];
  const center = (t, opts = {}) => lines.push({ t, align: "center", ...opts });
  const left = (t, opts = {}) => lines.push({ t, align: "left", ...opts });
  const pair = (a, b, opts = {}) => lines.push({ a, b, ...opts });
  const sep = () => lines.push({ sep: true });

  center(config.name || "GloryChef", { bold: true, size: 11 });
  if (config.taxId) center(`${config.taxIdLabel || "NIT"} ${config.taxId}`);
  if (config.address) wrap(config.address, C).forEach((l) => center(l));
  sep();
  center(RECEIPT_TITLES[r.receiptType] || "COMPROBANTE", { bold: true });
  center(r.receiptNumber, { bold: true, size: 10 });
  center(fmtDate(r.createdAtMs));
  sep();
  left(`Cliente: ${r.customer?.name || "Clientes Varios"}`);
  left(docLabel(r.customer));
  if (r.tableNumber) left(`Mesa: ${r.tableNumber}`);
  sep();
  r.items.forEach((it) => {
    wrap(`${it.quantity} x ${it.name}`, C).forEach((l, i, arr) =>
      i === arr.length - 1 ? pair(l, money(it.price * it.quantity)) : left(l));
    if (it.note) left(`  * ${it.note}`);
  });
  sep();
  if (r.discount > 0) pair("Descuento", `-${money(r.discount)}`);
  pair("Op. Gravadas", money(r.taxBase));
  pair("IVA", money(r.taxAmount));
  pair("TOTAL", money(r.total), { bold: true, size: 10 });
  r.payments.forEach((p) => pair(payMethodLabel(p.method), money(p.amount)));
  if (r.change > 0) pair("Cambio", money(r.change));
  sep();
  center("¡Gracias por su visita!");

  const lineH = (l) => (l.sep ? 8 : (l.size || 8) + 4);
  const H = 24 + lines.reduce((n, l) => n + lineH(l), 0);
  const pdf = createPdf({ width: W, height: H });
  let y = 16;
  lines.forEach((l) => {
    if (l.sep) {
      pdf.line(M, y - 2, W - M, y - 2, { dash: true, width: 0.5 });
    } else {
      const font = l.bold ? "monoBold" : "mono";
      const size = l.size || 8;
      if (l.a !== undefined) {
        pdf.text(M, y + size - 2, l.a, { size, font });
        pdf.text(W - M, y + size - 2, l.b, { size, font, align: "right" });
      } else {
        pdf.text(l.align === "center" ? W / 2 : M, y + size - 2, l.t, { size, font: l.bold ? "monoBold" : "mono", align: l.align });
      }
    }
    y += lineH(l);
  });
  return pdf.toBlob();
};

/** Texto para compartir por WhatsApp. */
export const buildWhatsAppText = (r, config = {}) => {
  const cur = config.currency || "BOB";
  const money = (n) => formatCurrency(n, cur);
  let msg = `*${config.name || "GloryChef"}*\n${RECEIPT_TITLES[r.receiptType] || "Comprobante"} *${r.receiptNumber}*\n${fmtDate(r.createdAtMs)}\n\n`;
  r.items.forEach((it) => { msg += `• ${it.quantity} x ${it.name} — ${money(it.price * it.quantity)}\n`; });
  msg += `\n*Total: ${money(r.total)}*\n`;
  r.payments.forEach((p) => { msg += `${payMethodLabel(p.method)}: ${money(p.amount)}\n`; });
  if (r.change > 0) msg += `Cambio: ${money(r.change)}\n`;
  msg += `\n¡Gracias por su preferencia!`;
  return msg;
};
