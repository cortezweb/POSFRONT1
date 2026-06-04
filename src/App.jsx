import { useState, useEffect } from "react";
import { auth } from "./firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { getUserRole } from "./firebase/auth";
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
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [currentPath, setCurrentPath] = useState(window.location.hash || "#/");

  // Suscribirse a cambios en la autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoadingAuth(true);
      if (currentUser) {
        setUser(currentUser);
        try {
          const userRole = await getUserRole(currentUser.uid);
          setRole(userRole);
        } catch (e) {
          console.error("Error al recuperar el rol del usuario:", e);
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
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
        if (role === "admin") {
          return <AdminView user={user} onLogout={handleLogout} />;
        } else if (role === "cashier") {
          return <POSView user={user} onLogout={handleLogout} />;
        } else if (role === "cook") {
          return <CookView user={user} onLogout={handleLogout} />;
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

  return (
    <CartProvider>
      {renderView()}
    </CartProvider>
  );
}

export default App;
