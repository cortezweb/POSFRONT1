import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validar que las variables de entorno estén presentes y tengan un formato adecuado
const isConfigValid = 
  firebaseConfig.apiKey && 
  firebaseConfig.projectId && 
  !firebaseConfig.apiKey.includes("PLACEHOLDER") &&
  firebaseConfig.apiKey !== "undefined" &&
  firebaseConfig.apiKey !== "";

let app = null;
let db = null;
let auth = null;
let storage = null;
let firebaseError = null;

if (isConfigValid) {
  try {
    app = initializeApp(firebaseConfig);
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
    auth = getAuth(app);
    storage = getStorage(app);
  } catch (error) {
    console.error("Error al inicializar Firebase:", error);
    firebaseError = error;
  }
} else {
  firebaseError = new Error("Las variables de entorno de Firebase no están configuradas o contienen valores placeholder.");
}

export { app, db, auth, storage, firebaseError };
export default app;
