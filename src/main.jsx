import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Registrar Service Worker de la PWA
import { registerSW } from 'virtual:pwa-register'

if ('serviceWorker' in navigator) {
  registerSW({
    onNeedRefresh() {
      if (confirm('Nueva versión disponible. ¿Deseas recargar la aplicación?')) {
        window.location.reload();
      }
    },
    onOfflineReady() {
      console.log('Aplicación lista para funcionar offline.');
    },
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
