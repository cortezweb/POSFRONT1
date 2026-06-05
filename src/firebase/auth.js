import { auth, db } from "./config";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

/**
 * Inicia sesión de un usuario de personal y retorna su información junto con su rol.
 */
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Obtener rol desde Firestore
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.disabled === true) {
        await signOut(auth);
        throw new Error("Su cuenta de personal ha sido suspendida. Contacte al administrador.");
      }
      return { user, role: userData.role, permissions: userData.permissions || null };
    } else {
      throw new Error("El usuario no tiene un rol configurado en la colección 'users'.");
    }
  } catch (error) {
    console.error("Error en loginUser:", error);
    throw error;
  }
};

/**
 * Cierra la sesión activa.
 */
export const logoutUser = () => signOut(auth);

/**
 * Retorna el rol del usuario especificado por su UID.
 */
export const getUserRole = async (uid) => {
  try {
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      return userDoc.data().role;
    }
    return null;
  } catch (error) {
    console.error("Error al obtener rol del usuario:", error);
    return null;
  }
};

/**
 * Retorna los datos completos de un usuario de la colección 'users'.
 */
export const getUserData = async (uid) => {
  try {
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      return userDoc.data();
    }
    return null;
  } catch (error) {
    console.error("Error al obtener datos completos del usuario:", error);
    return null;
  }
};
