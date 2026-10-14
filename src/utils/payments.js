import { Banknote, QrCode, CreditCard, Landmark } from "lucide-react";

// Comprobantes y métodos de pago del POS

export const RECEIPT_TYPES = [
  { id: "nota", label: "Nota de venta", series: ["NV001"] },
  { id: "boleta", label: "Boleta", series: ["B001"] },
  { id: "factura", label: "Factura", series: ["F001"], badge: "SIAT" }
];

export const PAY_METHODS = [
  { id: "cash", label: "Efectivo", icon: Banknote, tint: "bg-sky-500/15 text-sky-400" },
  { id: "qr", label: "QR Simple", icon: QrCode, tint: "bg-violet-500/15 text-violet-400" },
  { id: "card", label: "Tarjeta", icon: CreditCard, tint: "bg-fuchsia-500/15 text-fuchsia-400" },
  { id: "transfer", label: "Transferencia", icon: Landmark, tint: "bg-cyan-500/15 text-cyan-400" }
];

export const payMethodLabel = (id) =>
  PAY_METHODS.find((m) => m.id === id)?.label || (id === "yape" ? "QR" : id === "mixed" ? "Mixto" : id === "transfer" ? "Transferencia" : id || "");
