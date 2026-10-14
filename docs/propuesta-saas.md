# Cómo convertir el sistema en un SaaS para restaurantes

Revisión hecha sobre el código actual (rama `claude/project-thread-vo69wc`). Las mejoras están ordenadas por prioridad: lo de la sección 1 es obligatorio antes de cobrarle a un segundo restaurante.

---

## 1. Obligatorio para vender (base técnica)

### 1.1 Multi-restaurante (multi-tenant)
**Hoy:** todo vive en colecciones globales (`orders`, `products`, `categories`, `tables`, `shifts`...) y una sola configuración en `config/settings`. Solo puede existir **un** restaurante por proyecto de Firebase.

**Propuesta:**
- Estructura `restaurants/{restaurantId}/orders`, `.../products`, `.../settings`, etc.
- Cada usuario guarda `restaurantId` y su rol en *custom claims* de Firebase Auth.
- El menú del cliente se abre por subdominio o ruta: `saborboliviano.tuapp.com` o `tuapp.com/r/sabor-boliviano`.
- Un contexto `RestaurantContext` en React que entregue el `restaurantId` a todas las consultas.

### 1.2 Seguridad
- **Reglas de Firestore y Storage:** no están en el repositorio. Hay que versionarlas (`firestore.rules`, `storage.rules`) y que cada restaurante solo pueda leer/escribir lo suyo.
- **Precios calculados en el navegador:** el total del pedido se calcula en `CartContext.jsx`; un cliente podría alterarlo. Validar precios y cupones en el servidor (Cloud Function o Railway) antes de aceptar el pedido.
- **Creación de personal desde el navegador:** `AdminView.jsx` crea usuarios con una segunda instancia de Firebase en el cliente. Moverlo a una Cloud Function con permisos de administrador (y asignar el rol con custom claims).
- **Ruta `#/test-bnb` pública:** el simulador de pagos está abierto a cualquiera. Quitarlo de producción o protegerlo.
- **Acceso secreto con 5 clics:** está bien como atajo, pero no es seguridad; la protección real deben ser las reglas.

### 1.3 Marca blanca
- El `manifest` de la PWA todavía dice "Pizza Hub". Generarlo dinámicamente con el nombre, logo y color de cada restaurante.
- Color de marca configurable (hoy `--color-pizza-red` está fijo en `index.css`). Renombrar los tokens `pizza-*` a nombres neutros (`brand`, `surface`...).

### 1.4 Suscripciones y alta de clientes
- Registro de restaurante con asistente (nombre, logo, moneda, primer menú, mesas).
- Planes (por ejemplo: Básico / Pro / Cadena) con límites por plan: usuarios, sucursales, pedidos online, módulos.
- Cobro recurrente: Stripe no opera directo en Bolivia; evaluar QR BNB/transferencia con activación manual al inicio, o Paddle / Lemon Squeezy para clientes internacionales.
- Período de prueba de 14 días y bloqueo suave cuando vence.

### 1.5 Código mantenible
- `AdminView.jsx` tiene **más de 6.000 líneas**. Dividirlo en un archivo por módulo (`pedidos`, `inventario`, `caja`, `reportes`, `configuración`...) y extraer la lógica de Firebase a *hooks* o servicios (`useOrders`, `productsService`).
- Router real (`react-router`) en lugar del `window.location.hash` manual.
- Pruebas automáticas mínimas (Vitest) para el cálculo de totales, permisos y cierre de caja.
- Corregir los errores de ESLint existentes y agregar CI (GitHub Actions) que compile y pruebe en cada cambio.

---

## 2. UI/UX que hacen que se venda solo

### Panel y POS
- **Diseño consistente:** hoy los colores están escritos a mano (`bg-[#181818]`, `text-white/40`...). Pasar a tokens de diseño (fondo, superficie, texto, borde, marca) para que modo claro/oscuro y marca blanca funcionen sin parches.
- **POS pensado para tablet táctil:** botones de mínimo 44 px, búsqueda rápida, favoritos, modificadores (sin cebolla, extra queso), dividir cuenta y unir mesas.
- **Mapa de mesas visual** con estado por color (libre, ocupada, pidiendo cuenta).
- **Pantalla de cocina (KDS):** tiempo transcurrido por pedido con colores, sonido, y marcar plato por plato.
- **Indicador de conexión** siempre visible: "Sin internet: 3 pedidos se enviarán al reconectar".
- **Atajos de teclado** para caja.
- **Estados vacíos y de carga** cuidados, mensajes de error claros en español.

### Menú del cliente
- Carga rápida: fotos optimizadas (ya se hace), *lazy loading* y fotos disponibles sin conexión.
- Pedido por QR en la mesa, sin instalar nada.
- Seguimiento del pedido en vivo (ya existe la base en `OrderTrackingView`).
- Multi-idioma (español/inglés) para zonas turísticas.

### Accesibilidad
- Contraste suficiente (especialmente en modo claro), etiquetas en botones de solo icono, navegación con teclado.

---

## 3. Funciones que suben el precio del plan

| Función | Por qué vende |
|---|---|
| Facturación electrónica SIN (Bolivia) | Obligatoria para muchos negocios; es la razón #1 para elegir un POS local. |
| Pagos QR (BNB / Simple) reales | Ya hay simulador; conectarlo al API real con webhook en servidor. |
| Multi-sucursal | Un dueño ve todas sus sucursales y reportes consolidados. |
| Inventario con recetas | Descontar insumos por plato vendido y alertas de stock bajo. |
| Reportes y exportación | Ventas por hora, plato, mesero; exportar a Excel/PDF. |
| Delivery propio + integraciones | Pedidos de PedidosYa / Yaigo en una sola pantalla. |
| Fidelización | Puntos, cupones y WhatsApp para avisar "tu pedido está listo". |
| Impresión de comandas | Impresoras térmicas por área (cocina, bar). |

---

## 4. Infraestructura recomendada para el SaaS

- **App:** React + Vite + Tailwind como PWA (actual).
- **Datos y login:** Firebase (Firestore con modo sin internet + Auth con custom claims).
- **Lógica segura:** Cloud Functions de Firebase (o Node en Railway) para pagos, validación de pedidos, creación de usuarios y facturación.
- **Fotos:** Cloudinary (una carpeta por restaurante).
- **Hosting:** Cloudflare Pages con subdominios por restaurante.
- **Monitoreo:** Sentry para errores y un panel interno para ver el estado de cada cliente.

---

## 5. Orden sugerido

1. Seguridad básica (reglas, quitar `#/test-bnb`, precios en servidor).
2. Dividir `AdminView.jsx` y pasar a tokens de diseño.
3. Multi-restaurante + marca blanca.
4. Registro de restaurantes, planes y cobro.
5. Facturación SIN y pagos QR reales.
6. Funciones Pro (multi-sucursal, recetas, integraciones).
