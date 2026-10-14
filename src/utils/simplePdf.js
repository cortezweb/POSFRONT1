// Generador mínimo de PDF (texto, líneas y rectángulos) sin dependencias.
// Coordenadas en puntos, con origen arriba a la izquierda.

const HELVETICA_WIDTHS = {
  " ": 278, ".": 278, ",": 278, ":": 278, "/": 278, "-": 333, "(": 333, ")": 333, "#": 556, "%": 889,
  "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556, "8": 556, "9": 556,
  B: 667, S: 667, T: 611, I: 278, i: 222, l: 222, j: 222, f: 278, t: 278, r: 333, m: 833, w: 722, W: 944, M: 833
};

const charWidth = (ch, font) => {
  if (font === "mono") return 600;
  if (HELVETICA_WIDTHS[ch] !== undefined) return HELVETICA_WIDTHS[ch];
  if (/[A-Z]/.test(ch)) return 700;
  return 540;
};

export const textWidth = (str, size, font = "regular") =>
  [...String(str)].reduce((n, ch) => n + charWidth(ch, font), 0) * size / 1000 * (font === "bold" ? 1.06 : 1);

// Texto a WinAnsi con escapes de PDF (tildes y ñ incluidas)
const encode = (str) =>
  [...String(str)].map((ch) => {
    if (ch === "(" || ch === ")" || ch === "\\") return `\\${ch}`;
    const code = ch.charCodeAt(0);
    if (code < 128) return ch;
    if (ch === "€") return "\\200";
    if (code <= 255) return `\\${code.toString(8).padStart(3, "0")}`;
    return "?";
  }).join("");

const hexToRgb = (hex = "#000000") => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((v) => v.toFixed(3)).join(" ");
};

const FONTS = { regular: "F1", bold: "F2", mono: "F3", monoBold: "F4" };

export const createPdf = ({ width, height }) => {
  const ops = [];
  const y = (top) => (height - top).toFixed(2);

  const doc = {
    width,
    height,
    text(x, top, str, { size = 10, font = "regular", align = "left", color = "#000000" } = {}) {
      const w = textWidth(str, size, font);
      const left = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
      ops.push(`BT ${hexToRgb(color)} rg /${FONTS[font]} ${size} Tf ${left.toFixed(2)} ${y(top)} Td (${encode(str)}) Tj ET`);
      return doc;
    },
    rect(x, top, w, h, color = "#000000") {
      ops.push(`${hexToRgb(color)} rg ${x.toFixed(2)} ${(height - top - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
      return doc;
    },
    line(x1, top1, x2, top2, { color = "#000000", width: lw = 0.6, dash = false } = {}) {
      ops.push(`${hexToRgb(color)} RG ${lw} w ${dash ? "[2 2] 0 d" : "[] 0 d"} ${x1.toFixed(2)} ${y(top1)} m ${x2.toFixed(2)} ${y(top2)} l S`);
      return doc;
    },
    toBlob() {
      const content = ops.join("\n");
      const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width.toFixed(2)} ${height.toFixed(2)}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R /F4 7 0 R >> >> /Contents 8 0 R >>`,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>",
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
      ];
      let pdf = "%PDF-1.4\n";
      const offsets = [];
      objects.forEach((obj, i) => {
        offsets.push(pdf.length);
        pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
      });
      const xref = pdf.length;
      pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
      offsets.forEach((o) => { pdf += `${String(o).padStart(10, "0")} 00000 n \n`; });
      pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
      return new Blob([pdf], { type: "application/pdf" });
    }
  };
  return doc;
};

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
