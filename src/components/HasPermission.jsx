import React from "react";
import { usePermissions } from "../hooks/usePermissions";

/**
 * Componente protector para renderizar elementos condicionalmente basados en el rol y permisos específicos.
 * 
 * @param {object} props
 * @param {string} props.role - El rol del usuario activo (ej. admin, cashier, cook).
 * @param {string[]} [props.permissions] - Array opcional de permisos personalizados de la base de datos.
 * @param {string} props.permission - El identificador del permiso a validar.
 * @param {React.ReactNode} props.children - El contenido a renderizar si se aprueba el permiso.
 * @param {React.ReactNode} [props.fallback=null] - Contenido opcional si el usuario no tiene permiso.
 */
export function HasPermission({ role, permissions, permission, children, fallback = null }) {
  const { hasPermission } = usePermissions(role, permissions);
  return hasPermission(permission) ? <>{children}</> : fallback;
}
