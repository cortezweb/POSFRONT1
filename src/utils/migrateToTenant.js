import { db } from "../firebase/config";
import { collection, doc, getDocs, getDoc, writeBatch, serverTimestamp, setDoc, query, limit } from "firebase/firestore";
import { getRestaurantId } from "../firebase/tenant";

// Colecciones que antes vivían en la raíz de Firestore (un solo restaurante)
export const LEGACY_COLLECTIONS = [
  "orders", "products", "categories", "tables", "shifts",
  "expenses", "logs", "events", "event_registrations", "config"
];

const BATCH_LIMIT = 400;

/**
 * Copia los datos del sistema anterior (colecciones en la raíz) a
 * restaurants/{restaurantId}/... y asigna el restaurante a los usuarios sin uno.
 * No borra nada: los datos originales quedan como respaldo.
 */
export const migrateLegacyData = async ({ restaurantName, onProgress } = {}) => {
  const rid = getRestaurantId();
  const report = [];
  const log = (msg) => {
    report.push(msg);
    onProgress?.(msg);
  };

  for (const name of LEGACY_COLLECTIONS) {
    const snap = await getDocs(collection(db, name));
    if (snap.empty) {
      log(`${name}: sin datos`);
      continue;
    }
    let batch = writeBatch(db);
    let pending = 0;
    for (const d of snap.docs) {
      batch.set(doc(db, "restaurants", rid, name, d.id), d.data(), { merge: true });
      pending++;
      if (pending >= BATCH_LIMIT) {
        await batch.commit();
        batch = writeBatch(db);
        pending = 0;
      }
    }
    if (pending > 0) await batch.commit();
    log(`${name}: ${snap.size} documentos copiados`);
  }

  // Usuarios del personal sin restaurante asignado → este restaurante
  const usersSnap = await getDocs(collection(db, "users"));
  let assigned = 0;
  const userBatch = writeBatch(db);
  usersSnap.forEach((u) => {
    if (!u.data().restaurantId) {
      userBatch.update(u.ref, { restaurantId: rid });
      assigned++;
    }
  });
  if (assigned > 0) await userBatch.commit();
  log(`usuarios: ${assigned} asignados a "${rid}"`);

  // Ficha del restaurante
  const restaurantRef = doc(db, "restaurants", rid);
  const existing = await getDoc(restaurantRef);
  if (!existing.exists()) {
    await setDoc(restaurantRef, {
      name: restaurantName || rid,
      slug: rid,
      plan: "demo",
      active: true,
      createdAt: serverTimestamp()
    });
    log(`restaurante "${rid}" creado`);
  }

  return report;
};

/** true si todavía hay datos en el formato anterior y este restaurante no tiene productos. */
export const hasLegacyData = async () => {
  try {
    const rid = getRestaurantId();
    const [legacy, current] = await Promise.all([
      getDocs(query(collection(db, "products"), limit(1))),
      getDocs(query(collection(db, "restaurants", rid, "products"), limit(1)))
    ]);
    return !legacy.empty && current.empty;
  } catch {
    return false;
  }
};
