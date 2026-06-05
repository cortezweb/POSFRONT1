import { ROLES_PERMISSIONS } from "../utils/permissionsConfig";

/**
 * Hook para validar permisos de un usuario según su rol y permisos personalizados.
 * 
 * @param {string} userRole - El rol principal del usuario (ej. admin, cashier, cook).
 * @param {string[]|null|undefined} userCustomPermissions - Array de permisos configurados a medida para este usuario.
 */
export function usePermissions(userRole, userCustomPermissions) {
  /**
   * Verifica si el usuario tiene el permiso solicitado.
   * Prioriza los permisos personalizados si existen; de lo contrario, evalúa según el rol.
   * 
   * @param {string} permission - El permiso a evaluar.
   * @returns {boolean} True si tiene acceso, false en caso contrario.
   */
  const hasPermission = (permission) => {
    const allowedPermissions = Array.isArray(userCustomPermissions)
      ? userCustomPermissions
      : (ROLES_PERMISSIONS[userRole] || []);
    return allowedPermissions.includes(permission);
  };

  /**
   * Verifica si posee al menos uno de los permisos provistos.
   * 
   * @param {string[]} permissionsArray - Lista de permisos a evaluar.
   * @returns {boolean} True si posee al menos un permiso.
   */
  const hasAnyPermission = (permissionsArray) => {
    const allowedPermissions = Array.isArray(userCustomPermissions)
      ? userCustomPermissions
      : (ROLES_PERMISSIONS[userRole] || []);
    return permissionsArray.some(p => allowedPermissions.includes(p));
  };

  return { hasPermission, hasAnyPermission };
}
