import { useSyncExternalStore } from "react";
import { collection, doc } from "firebase/firestore";
import { db } from "./config";

/**
 * Multi-restaurante (multi-tenant).
 * Cada restaurante guarda sus datos en restaurants/{restaurantId}/{colección}.
 * Los usuarios del personal siguen en la colección global "users" con su campo restaurantId.
 *
 * Cómo se elige el restaurante:
 * 1. Personal logueado: el restaurantId de su documento en "users".
 * 2. Menú público: ?r=slug en la URL, o el subdominio (slug.VITE_ROOT_DOMAIN).
 * 3. Si no hay nada: VITE_DEFAULT_RESTAURANT_ID (por defecto "glorychef", el demo).
 */
export const DEFAULT_RESTAURANT_ID = import.meta.env.VITE_DEFAULT_RESTAURANT_ID || "glorychef";
const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || "";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}$/;

export const normalizeSlug = (value) =>
  (value || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

export const resolveRestaurantFromUrl = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = normalizeSlug(params.get("r"));
    if (SLUG_RE.test(fromQuery)) return fromQuery;

    const host = window.location.hostname;
    if (ROOT_DOMAIN && host.endsWith(`.${ROOT_DOMAIN}`)) {
      const sub = normalizeSlug(host.slice(0, -(ROOT_DOMAIN.length + 1)));
      if (SLUG_RE.test(sub) && sub !== "www" && sub !== "app") return sub;
    }
  } catch {
    // sin window (pruebas) o URL inválida
  }
  return DEFAULT_RESTAURANT_ID;
};

let currentRestaurantId = resolveRestaurantFromUrl();
const listeners = new Set();

export const getRestaurantId = () => currentRestaurantId;

export const setRestaurantId = (id) => {
  const next = SLUG_RE.test(id || "") ? id : DEFAULT_RESTAURANT_ID;
  if (next === currentRestaurantId) return;
  currentRestaurantId = next;
  listeners.forEach((l) => l());
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Hook para volver a suscribirse cuando cambia el restaurante activo. */
export const useRestaurantId = () => useSyncExternalStore(subscribe, getRestaurantId, getRestaurantId);

/** Colección del restaurante activo: restaurants/{id}/{name} */
export const rCol = (name) => collection(db, "restaurants", currentRestaurantId, name);

/** Documento del restaurante activo: restaurants/{id}/{name}/{docId} */
export const rDoc = (name, docId) => doc(db, "restaurants", currentRestaurantId, name, docId);
