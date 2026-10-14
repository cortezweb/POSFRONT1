import { Lock } from "lucide-react";
import { PERMISSIONS, ROLES_PERMISSIONS } from "../../utils/permissionsConfig";

// Sección "personal" del panel de administración
export const PersonalTab = ({
  handleChangeRole,
  handleRegisterStaff,
  handleToggleSuspend,
  setEditingPermissionsList,
  setEditingPermissionsUser,
  setStaffEmail,
  setStaffPassword,
  setStaffPermissions,
  setStaffRole,
  staffEmail,
  staffPassword,
  staffPermissions,
  staffRegistering,
  staffRole,
  usersList
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">

    {/* Form Creation */}
    <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-5 h-fit">
      <div className="flex items-center gap-2 text-pizza-red">
        <Lock size={18} />
        <h3 className="font-pizza-title font-bold text-sm uppercase">Registrar Personal</h3>
      </div>

      <form onSubmit={handleRegisterStaff} className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Correo del Empleado</label>
          <input
            type="email"
            required
            value={staffEmail}
            onChange={(e) => setStaffEmail(e.target.value)}
            placeholder="empleado@pizzeriahub.com"
            className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Contraseña</label>
          <input
            type="password"
            required
            value={staffPassword}
            onChange={(e) => setStaffPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-pizza-red"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5">Rol en Pizzería</label>
          <select
            value={staffRole}
            onChange={(e) => {
              const val = e.target.value;
              setStaffRole(val);
              setStaffPermissions(ROLES_PERMISSIONS[val] || []);
            }}
            className="w-full bg-[#181818] border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-white"
          >
            <option value="cashier">Cajero / POS</option>
            <option value="cook">Cocinero / Producción</option>
            <option value="admin">Administrador Central</option>
          </select>
        </div>

        <div className="space-y-2 pt-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">
            Permisos del Personal
          </label>
          <div className="bg-[#181818] border border-white/5 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2.5">
            {Object.entries(PERMISSIONS).map(([key, value]) => {
              const isChecked = staffPermissions.includes(value);
              return (
                <label key={key} className="flex items-center gap-2 text-[10px] text-white/70 hover:text-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setStaffPermissions(prev => [...prev, value]);
                      } else {
                        setStaffPermissions(prev => prev.filter(p => p !== value));
                      }
                    }}
                    className="accent-pizza-red cursor-pointer"
                  />
                  <span>{key.replace(/_/g, " ")}</span>
                </label>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={staffRegistering}
          className="w-full bg-pizza-red hover:bg-pizza-red/90 text-white rounded-xl py-3 font-bold text-xs transition-all cursor-pointer disabled:opacity-40"
        >
          {staffRegistering ? "Creando en Auth..." : "Registrar Personal"}
        </button>
      </form>
    </div>

    {/* Users List */}
    <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-white/5 bg-[#121212] space-y-4">
      <h3 className="font-pizza-title font-bold text-sm uppercase text-white/70">Equipo y Personal Activo</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/5 text-[9px] uppercase font-bold text-white/40 pb-2">
              <th className="pb-2">Email</th>
              <th className="pb-2">Rol Asignado</th>
              <th className="pb-2">Estado</th>
              <th className="pb-2 text-right">Gestión</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {usersList.map((usr) => (
              <tr key={usr.uid} className="hover:bg-white/[0.01]">
                <td className="py-3.5 font-semibold text-white/80">{usr.email}</td>
                <td className="py-3.5">
                  <select
                    value={usr.role}
                    onChange={(e) => handleChangeRole(usr, e.target.value)}
                    className="bg-[#181818] border border-white/5 text-white text-[10px] rounded px-2 py-1 font-bold"
                  >
                    <option value="cashier">Cajero</option>
                    <option value="cook">Cocinero</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="py-3.5">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                    usr.disabled
                      ? "bg-red-500/10 border-red-500/20 text-red-400"
                      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  }`}>
                    {usr.disabled ? "Suspendido" : "Activo"}
                  </span>
                </td>
                <td className="py-3.5 text-right flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPermissionsUser(usr);
                      setEditingPermissionsList(usr.permissions || ROLES_PERMISSIONS[usr.role] || []);
                    }}
                    className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#181818] hover:bg-white/5 text-white/80 transition-colors cursor-pointer"
                    title="Personalizar permisos de este usuario"
                  >
                    Permisos 🔐
                  </button>
                  <button
                    onClick={() => handleToggleSuspend(usr)}
                    className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                      usr.disabled
                        ? "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400"
                        : "bg-red-500/10 border-red-500/20 hover:bg-red-500/20 text-red-400"
                    }`}
                  >
                    {usr.disabled ? "Habilitar" : "Suspender"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);
