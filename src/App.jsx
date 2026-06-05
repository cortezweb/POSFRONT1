import { useState, useEffect } from "react";
import { auth, firebaseError } from "./firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { getUserRole, getUserData } from "./firebase/auth";
import { CartProvider } from "./context/CartContext";

// Vistas
import { ClientMenu } from "./views/ClientMenu";
import { Login } from "./views/Login";
import { POSView } from "./views/POSView";
import { AdminView } from "./views/AdminView";
import { CookView } from "./views/CookView";
import { OrderTrackingView } from "./views/OrderTrackingView";
import { TestBNBView } from "./views/TestBNBView";

import { Loader2 } from "lucide-react";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [currentPath, setCurrentPath] = useState(window.location.hash || "#/");

  // Suscribirse a cambios en la autenticación
  useEffect(() => {
    if (firebaseError || !auth) {
      setLoadingAuth(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoadingAuth(true);
      if (currentUser) {
        setUser(currentUser);
        try {
          const userData = await getUserData(currentUser.uid);
          if (userData) {
            setRole(userData.role);
            setPermissions(userData.permissions || null);
          } else {
            setRole(null);
            setPermissions(null);
          }
        } catch (e) {
          console.error("Error al recuperar el rol/permisos del usuario:", e);
          setRole(null);
          setPermissions(null);
        }
      } else {
        setUser(null);
        setRole(null);
        setPermissions(null);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // Control de Rutas por Hash
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPath(window.location.hash || "#/");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleLoginSuccess = (usr, rol) => {
    setUser(usr);
    setRole(rol);
    // Una vez logueado, permanece en #/login y se renderizará su vista del panel correspondiente
  };

  const handleLogout = () => {
    setUser(null);
    setRole(null);
    setPermissions(null);
    window.location.hash = "#/"; // Redirigir al cliente
  };

  // Renderizar de acuerdo al Path y Roles
  const renderView = () => {
    if (currentPath === "#/login") {
      if (loadingAuth) {
        return (
          <div className="min-h-screen bg-pizza-charcoal text-white flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="animate-spin text-pizza-red" />
            <span className="text-sm font-semibold tracking-wide text-white/50">Cargando credenciales...</span>
          </div>
        );
      }

      if (user) {
        if (role === "admin" || role === "cashier" || role === "cook") {
          return <AdminView user={user} role={role} permissions={permissions} onLogout={handleLogout} />;
        } else {
          return (
            <div className="min-h-screen bg-pizza-charcoal text-white flex flex-col items-center justify-center p-6 text-center">
              <span className="text-4xl mb-4">⚠️</span>
              <h2 className="text-xl font-bold mb-2">Usuario sin Rol Configurado</h2>
              <p className="text-sm text-white/60 max-w-sm mb-6">
                Este correo está registrado pero no tiene asignado un rol de personal válido (admin, cashier o cook) en Firestore.
              </p>
              <button
                onClick={handleLogout}
                className="bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl px-6 py-2.5 text-xs font-bold transition-all cursor-pointer"
              >
                Volver al Menú / Salir
              </button>
            </div>
          );
        }
      }

      // No logueado, mostrar pantalla de login
      return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    if (currentPath === "#/test-bnb") {
      return <TestBNBView />;
    }

    if (currentPath.startsWith("#/track/")) {
      const orderId = currentPath.substring("#/track/".length);
      return <OrderTrackingView orderId={orderId} onBack={() => { window.location.hash = user ? "#/login" : "#/"; }} />;
    }

    // Default: Menú Digital para Clientes
    return <ClientMenu />;
  };

  if (firebaseError) {
    return (
      <div className="min-h-screen bg-[#131313] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-[#1e1e1e] p-8 rounded-2xl border border-red-500/20 shadow-2xl space-y-6">
          <div className="text-red-500 flex justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-pizza-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-white">Configuración Pendiente</h2>
            <p className="text-sm text-gray-400">
              La aplicación no ha podido inicializar Firebase. Esto sucede porque las credenciales de la base de datos no están configuradas como variables de entorno en Vercel.
            </p>
          </div>
          <div className="bg-black/40 p-4 rounded-lg text-left text-xs font-mono overflow-x-auto text-red-400 border border-red-500/10">
            {firebaseError.message}
          </div>
          <div className="space-y-3 pt-2 text-left">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Cómo solucionarlo en Vercel:</h3>
            <ol className="text-xs text-gray-400 list-decimal list-inside space-y-1.5 leading-relaxed">
              <li>Ve a tu dashboard en <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">Vercel</a>.</li>
              <li>Entra a la configuración de este proyecto: <strong>Settings &gt; Environment Variables</strong>.</li>
              <li>Agrega las siguientes variables de entorno:
                <div className="grid grid-cols-2 gap-2 mt-2 p-2 bg-black/30 rounded border border-white/5 font-mono text-[10px] text-gray-300">
                  <div>VITE_FIREBASE_API_KEY</div>
                  <div>VITE_FIREBASE_AUTH_DOMAIN</div>
                  <div>VITE_FIREBASE_PROJECT_ID</div>
                  <div>VITE_FIREBASE_STORAGE_BUCKET</div>
                  <div>VITE_FIREBASE_MESSAGING_SENDER_ID</div>
                  <div>VITE_FIREBASE_APP_ID</div>
                  <div>VITE_MAPBOX_ACCESS_TOKEN</div>
                  <div>VITE_CLOUDINARY_CLOUD_NAME</div>
                  <div>VITE_CLOUDINARY_UPLOAD_PRESET</div>
                </div>
              </li>
              <li>Dirígete a la pestaña <strong>Deployments</strong>, haz clic en los tres puntos del último despliegue y selecciona <strong>Redeploy</strong> (marcando la opción de usar la caché existente).</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CartProvider>
      {renderView()}
    </CartProvider>
  );
}

export default App;
