import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { CurrencyProvider } from './utils/CurrencyContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <CurrencyProvider>
    <App />
  </CurrencyProvider>
);
