// Forma de una mesa: la elegida o una automática según la cantidad de personas
export const tableShapeFor = (table) => {
  if (table.shape) return table.shape;
  const cap = Number(table.capacity || 4);
  if (cap <= 2) return "round";
  if (cap <= 4) return "square";
  return "rect";
};
