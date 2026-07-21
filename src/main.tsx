// 1. First, satisfy any side effects or global setups
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'

// 2. Initialize Aegis Observability immediately
import Aegis from '@aegis/sentinel'

console.log('[Aegis Debug] main.tsx executing...');

try {
  console.log('[Aegis Debug] Calling Aegis.init...');
  Aegis.init({
    dsn: 'aegis_key_440b48244a824af916be2c79b1636852',
    gatewayUrl: 'http://localhost:3001'
  });
  console.log('[Aegis Debug] Aegis.init finished successfully.');
} catch (err) {
  console.error('[Aegis Debug] Aegis.init FAILED:', err);
}

// Global debug access
(window as any).Aegis = Aegis;

// 3. Now import the rest of the app
import App from './App.tsx'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
