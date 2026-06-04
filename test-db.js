/* eslint-disable no-undef */
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from "fs";

// Leer y parsear el archivo .env manualmente para Node
const envContent = fs.readFileSync(".env", "utf8");
const config = {};
envContent.split("\n").forEach(line => {
  const match = line.match(/^\s*VITE_FIREBASE_([A-Z_]+)\s*=\s*(.+)$/);
  if (match) {
    // Mapear nombres de variables VITE_FIREBASE_X a las claves de firebaseConfig
    const key = match[1];
    let configKey = "";
    if (key === "API_KEY") configKey = "apiKey";
    else if (key === "AUTH_DOMAIN") configKey = "authDomain";
    else if (key === "PROJECT_ID") configKey = "projectId";
    else if (key === "STORAGE_BUCKET") configKey = "storageBucket";
    else if (key === "MESSAGING_SENDER_ID") configKey = "messagingSenderId";
    else if (key === "APP_ID") configKey = "appId";
    
    if (configKey) {
      config[configKey] = match[2].trim();
    }
  }
});

console.log("Configuración Firebase cargada en Node:", config);

const app = initializeApp(config);
const db = getFirestore(app);

console.log("Intentando escribir un documento de prueba en Firestore...");

// Establecer un timeout de 15 segundos para no quedar colgado si no conecta
const timeout = setTimeout(() => {
  console.error("❌ ERROR: El llamado a Firestore ha excedido los 15 segundos. Es probable que:");
  console.error("1. No hayas creado la base de datos Firestore en tu consola de Firebase (Firestore Database > Crear base de datos).");
  console.error("2. Tengas problemas de conexión de red o bloqueo de puertos (ej. proxy/firewall).");
  process.exit(1);
}, 15000);

try {
  await setDoc(doc(db, "test_collection", "test_doc"), {
    message: "Hola desde script de prueba",
    timestamp: new Date()
  });
  clearTimeout(timeout);
  console.log("✅ ¡ÉXITO! Se pudo escribir en Firestore sin problemas.");
  process.exit(0);
} catch (error) {
  clearTimeout(timeout);
  console.error("❌ ERROR al escribir en Firestore:", error);
  process.exit(1);
}
