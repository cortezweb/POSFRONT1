export const PERMISSIONS = {
  // Pedidos
  VER_PEDIDOS: "pedidos:ver",
  
  // POS
  ACCESO_POS: "pos:acceso",
  
  // Ventas e Informes
  VER_VENTAS: "ventas:ver",

  // Clientes
  VER_CLIENTES: "clientes:ver",

  // Personal
  VER_PERSONAL: "personal:ver",
  CREAR_PERSONAL: "personal:crear",
  EDITAR_PERSONAL: "personal:editar",
  
  // Catálogo/Inventario
  VER_INVENTARIO: "inventario:ver",
  CREAR_PRODUCTO: "inventario:crear",
  EDITAR_PRODUCTO: "inventario:editar",
  ELIMINAR_PRODUCTO: "inventario:eliminar",
  
  // Categorías
  CREAR_CATEGORIA: "categorias:crear",
  ELIMINAR_CATEGORIA: "categorias:eliminar",

  // Caja y Turnos
  VER_CAJA: "caja:ver",
  ABRIR_TURNO: "caja:abrir",
  CERRAR_TURNO: "caja:cerrar",
  VER_HISTORIAL_TURNOS: "turnos:ver",

  // Mesas
  VER_MESAS: "mesas:ver",
  EDITAR_MESAS: "mesas:editar",
  
  // Finanzas e Ingresos/Egresos
  VER_FINANZAS: "finanzas:ver",
  REGISTRAR_GASTO: "finanzas:registrar_gasto",
  ELIMINAR_GASTO: "finanzas:eliminar_gasto",

  // Auditoría y Tienda / Config
  VER_AUDITORIA: "auditoria:ver",
  CONFIGURAR_TIENDA: "tienda:configurar",

  // Cocina
  ACCESO_COCINA: "cocina:acceso"
};

export const ROLES_PERMISSIONS = {
  admin: Object.values(PERMISSIONS), // Admin central tiene todos los permisos
  cashier: [
    PERMISSIONS.VER_PEDIDOS,
    PERMISSIONS.ACCESO_POS,
    PERMISSIONS.VER_INVENTARIO,
    PERMISSIONS.VER_CAJA,
    PERMISSIONS.ABRIR_TURNO,
    PERMISSIONS.CERRAR_TURNO,
    PERMISSIONS.VER_HISTORIAL_TURNOS,
    PERMISSIONS.VER_CLIENTES,
    PERMISSIONS.VER_MESAS,
    PERMISSIONS.EDITAR_MESAS // Permitir cambiar estado de mesa (libre/ocupada)
  ],
  cook: [
    PERMISSIONS.VER_PEDIDOS,
    PERMISSIONS.VER_INVENTARIO,
    PERMISSIONS.ACCESO_COCINA
  ]
};
