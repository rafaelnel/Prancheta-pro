import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import { BootGate } from './BootGate';
import { CurrencyProvider } from './utils/CurrencyContext';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    registerSW({ immediate: true });
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const registration of registrations) {
          registration.unregister().catch(() => undefined);
        }
      })
      .catch(() => undefined);
  }
}

createRoot(document.getElementById('root')!).render(
  <CurrencyProvider>
    <BootGate />
  </CurrencyProvider>
);
