// Marca blanca: aplica el color, logo y nombre del restaurante activo a toda la app.

const DEFAULT_ICON = "/favicon.svg";
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const setLink = (rel, href) => {
  let link = document.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
};

export const applyBranding = (config = {}) => {
  const root = document.documentElement;
  const color = HEX_RE.test(config.brandColor || "") ? config.brandColor : null;

  if (color) {
    // Las utilidades de Tailwind (bg-pizza-red, text-pizza-red, /opacidades) leen estas variables
    root.style.setProperty("--color-pizza-red", color);
    root.style.setProperty("--color-pizza-gold", `color-mix(in srgb, ${color} 70%, black)`);
  } else {
    root.style.removeProperty("--color-pizza-red");
    root.style.removeProperty("--color-pizza-gold");
  }

  const icon = config.logoUrl || DEFAULT_ICON;
  setLink("icon", icon);
  setLink("apple-touch-icon", config.logoUrl || "/pwa-192x192.png");

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute("content", color || "#131313");
};
