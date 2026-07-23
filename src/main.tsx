// 1. First, satisfy any side effects or global setups
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'

// 2. Initialize Aegis Observability immediately
import Aegis from '@aegis/sentinel'

try {
  Aegis.init({
    dsn: 'aegis_key_440b48244a824af916be2c79b1636852',
    environment: 'development',
    gatewayUrl: 'http://localhost:3001'
  });
  console.log('[Aegis] Initialized for Chinese App (HànPath)');
} catch (err) {
  console.error('[Aegis] Init error:', err);
}

(window as any).Aegis = Aegis;

// 3. Now import the rest of the app
import App from './App.tsx'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
