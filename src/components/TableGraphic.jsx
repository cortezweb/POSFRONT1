// Dibujo de una mesa vista desde arriba, con una silla por persona.
// El color sigue al texto (currentColor), así el estado se pinta con clases de Tailwind.
import { tableShapeFor } from "../utils/tables";

const chairPositions = (shape, n, w, h, cx, cy) => {
  const pts = [];
  if (shape === "round") {
    const r = Math.min(w, h) / 2 + 13;
    for (let i = 0; i < n; i++) {
      const a = (-Math.PI / 2) + (i * 2 * Math.PI) / n;
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), rot: (a * 180) / Math.PI + 90 });
    }
    return pts;
  }
  // Mesas cuadradas/rectangulares: sillas arriba y abajo, y en las cabeceras si sobran
  const baseEnds = shape === "square" ? (n >= 4 ? 2 : n === 3 ? 1 : 0) : (n % 2 === 1 ? 1 : n >= 6 ? 2 : 0);
  const ends = Math.min(baseEnds, n);
  const sides = n - ends;
  const top = Math.ceil(sides / 2);
  const bottom = sides - top;
  const place = (count, y, rot) => {
    for (let i = 0; i < count; i++) {
      const x = cx - w / 2 + (w * (i + 1)) / (count + 1);
      pts.push({ x, y, rot });
    }
  };
  place(top, cy - h / 2 - 11, 0);
  place(bottom, cy + h / 2 + 11, 180);
  if (ends >= 1) pts.push({ x: cx - w / 2 - 11, y: cy, rot: 270 });
  if (ends >= 2) pts.push({ x: cx + w / 2 + 11, y: cy, rot: 90 });
  return pts;
};

export const TableGraphic = ({ table, className = "", label }) => {
  const shape = tableShapeFor(table);
  const cap = Math.max(1, Math.min(16, Number(table.capacity || 4)));
  const isRect = shape === "rect";
  const W = isRect ? 40 + Math.ceil(cap / 2) * 22 : 120;
  const H = isRect ? 104 : 120;
  const viewW = Math.max(W, 120);
  const cx = viewW / 2;
  const cy = H / 2;
  const tw = shape === "round" ? 56 : shape === "square" ? 54 : W - 40;
  const th = shape === "round" ? 56 : shape === "square" ? 54 : 44;
  const chairs = chairPositions(shape, cap, tw, th, cx, cy);

  return (
    <svg viewBox={`0 0 ${viewW} ${H}`} className={className} role="img" aria-label={`${table.name}, ${cap} personas`}>
      {chairs.map((c, i) => (
        <rect
          key={i}
          x={c.x - 9}
          y={c.y - 6}
          width="18"
          height="12"
          rx="4"
          fill="currentColor"
          opacity="0.45"
          transform={`rotate(${c.rot} ${c.x} ${c.y})`}
        />
      ))}
      {shape === "round" ? (
        <circle cx={cx} cy={cy} r={tw / 2} fill="currentColor" opacity="0.9" />
      ) : (
        <rect x={cx - tw / 2} y={cy - th / 2} width={tw} height={th} rx="10" fill="currentColor" opacity="0.9" />
      )}
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">
        {label ?? table.name}
      </text>
    </svg>
  );
};
