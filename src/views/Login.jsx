import { useState } from "react";
import { loginUser } from "../firebase/auth";
import { seedDatabase } from "../utils/dbSeeder";
import { Lock, Mail, Server, RefreshCw, AlertCircle, ArrowRight } from "lucide-react";

export const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [seedLogs, setSeedLogs] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Por favor ingresa correo y contraseña.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const data = await loginUser(email, password);
      onLoginSuccess(data.user, data.role);
    } catch (error) {
      setErrorMessage(
        error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential"
          ? "Credenciales incorrectas. Verifica el correo y la contraseña."
          : error.message
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    if (window.confirm("¿Deseas inicializar la base de datos con la configuración, productos y cuentas de prueba?")) {
      setSeeding(true);
      setSeedLogs(["Iniciando siembra..."]);
      try {
        const res = await seedDatabase();
        if (res.success) {
          setSeedLogs([...res.logs, "✅ Siembra finalizada con éxito."]);
        } else {
          setSeedLogs([...res.logs, `❌ Error: ${res.error}`]);
        }
      } catch (err) {
        setSeedLogs((prev) => [...prev, `❌ Error crítico: ${err.message}`]);
      } finally {
        setSeeding(false);
      }
    }
  };

  const fillCredentials = (roleEmail, rolePass) => {
    setEmail(roleEmail);
    setPassword(rolePass);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-pizza-charcoal text-white p-4 relative overflow-hidden">
      {/* Decorative pizza elements backgrounds */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-pizza-red/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-pizza-gold/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md glass-panel rounded-3xl p-8 shadow-2xl relative z-10 border border-white/10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-pizza-red/20 text-pizza-red mb-4">
            <Lock size={32} />
          </div>
          <h1 className="font-pizza-title text-3xl font-bold tracking-tight text-white mb-2">
            Panel de Acceso
          </h1>
          <p className="text-sm text-white/60">
            Ingresa a tu cuenta para gestionar el sistema POS
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 bg-pizza-red/20 border border-pizza-red/40 rounded-xl p-4 text-sm text-white flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-pizza-red" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
              Correo Electrónico
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@pizza.com"
                className="w-full bg-pizza-dark/80 border border-white/10 rounded-xl px-4 py-3 pl-10 text-white placeholder-white/30 focus:outline-none focus:border-pizza-red transition-all text-sm"
              />
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-pizza-dark/80 border border-white/10 rounded-xl px-4 py-3 pl-10 text-white placeholder-white/30 focus:outline-none focus:border-pizza-red transition-all text-sm"
              />
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl py-3.5 font-bold transition-all text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-pizza-red/20 disabled:opacity-55"
          >
            {loading ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Iniciando sesión...
              </>
            ) : (
              <>
                Ingresar al Sistema
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Cuentas de Acceso Rápido */}
        <div className="mt-8 pt-6 border-t border-white/5">
          <span className="block text-[11px] font-bold uppercase tracking-widest text-white/40 text-center mb-3">
            Accesos de Prueba Rápidos
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => fillCredentials("admin@posvcard.com", "admin123")}
              className="bg-white/5 hover:bg-white/10 text-xs py-2 px-1.5 rounded-lg text-white/80 transition-colors border border-white/5 cursor-pointer text-center font-medium"
            >
              Administrador
            </button>
            <button
              onClick={() => fillCredentials("cajero@posvcard.com", "cajero123")}
              className="bg-white/5 hover:bg-white/10 text-xs py-2 px-1.5 rounded-lg text-white/80 transition-colors border border-white/5 cursor-pointer text-center font-medium"
            >
              Cajero / POS
            </button>
            <button
              onClick={() => fillCredentials("cocinero@posvcard.com", "cocinero123")}
              className="bg-white/5 hover:bg-white/10 text-xs py-2 px-1.5 rounded-lg text-white/80 transition-colors border border-white/5 cursor-pointer text-center font-medium"
            >
              Cocinero
            </button>
          </div>
        </div>

        {/* Herramientas de Base de Datos */}
        <div className="mt-6 pt-5 border-t border-white/5 text-center">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="inline-flex items-center gap-2 bg-[#ffd79b]/10 hover:bg-[#ffd79b]/15 text-[#ffd79b] text-xs font-semibold py-2 px-4 rounded-xl border border-[#ffd79b]/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Server size={14} />
            {seeding ? "Sembrando..." : "Inicializar Base de Datos de Prueba"}
          </button>

          {seedLogs.length > 0 && (
            <div className="mt-4 text-left bg-black/40 border border-white/5 rounded-xl p-3 max-h-32 overflow-y-auto text-[10px] font-mono text-white/70 space-y-1">
              {seedLogs.map((log, idx) => (
                <div key={idx}>{log}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
