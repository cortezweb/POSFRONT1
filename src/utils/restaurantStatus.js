// Planes y estado de acceso de cada restaurante cliente

export const PLANS = {
  trial: { label: "Prueba", days: 14 },
  basic: { label: "Básico" },
  pro: { label: "Pro" },
  chain: { label: "Cadena" },
  demo: { label: "Demo" }
};

export const toDate = (value) => (value?.toDate ? value.toDate() : value ? new Date(value) : null);

/** Estado de un restaurante para el panel y para bloquear el acceso del personal. */
export const getRestaurantStatus = (r, now = Date.now()) => {
  if (!r) return { ok: true, label: "Sin ficha" };
  if (r.active === false) return { ok: false, label: "Suspendido" };
  const ends = toDate(r.trialEndsAt);
  if (r.plan === "trial" && ends && ends.getTime() < now) return { ok: false, label: "Prueba vencida" };
  if (r.plan === "trial" && ends) {
    const days = Math.ceil((ends.getTime() - now) / 86400000);
    return { ok: true, label: `Prueba: ${days} día${days === 1 ? "" : "s"}` };
  }
  return { ok: true, label: "Activo" };
};
