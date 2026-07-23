// 1. First, satisfy any side effects or global setups
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'

// 2. Initialize Aegis Observability dynamically (Graceful fallback for production builds)
try {
  import('@aegis/sentinel').then(mod => {
    const Aegis = mod.default || mod;
    if (Aegis && typeof Aegis.init === 'function') {
      Aegis.init({
        dsn: 'aegis_key_440b48244a824af916be2c79b1636852',
        environment: 'development',
        gatewayUrl: 'http://localhost:3001'
      });
      console.log('[Aegis] Initialized for Chinese App (HànPath)');
      (window as any).Aegis = Aegis;
    }
  }).catch(() => {
    /* Aegis Sentinel is optional for production builds */
  });
} catch {
  /* Ignore when not available */
}

// 3. Now import the rest of the app
import App from './App.tsx'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
