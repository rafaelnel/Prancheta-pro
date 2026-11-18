import React, { createContext, useCallback, useContext, useState } from 'react';
import {
  CurrencyCode,
  EUR_TO_BRL_RATE,
  getActiveCurrency,
  setActiveCurrency,
} from './formatters';

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (next: CurrencyCode) => void;
  toggleCurrency: () => void;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'BRL',
  setCurrency: () => {},
  toggleCurrency: () => {},
});

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() =>
    getActiveCurrency()
  );

  const setCurrency = useCallback((next: CurrencyCode) => {
    setActiveCurrency(next);
    setCurrencyState(next);
  }, []);

  const toggleCurrency = useCallback(() => {
    setCurrencyState((prev) => {
      const next: CurrencyCode = prev === 'BRL' ? 'EUR' : 'BRL';
      setActiveCurrency(next);
      return next;
    });
  }, []);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, toggleCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export function useCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext);
}

export const CurrencyToggle: React.FC<{
  compact?: boolean;
}> = ({ compact = false }) => {
  const { currency, setCurrency } = useCurrency();

  return (
    <div
      role="group"
      aria-label="Selecionar moeda de exibição"
      title={`Moeda de exibição (1 € = R$ ${EUR_TO_BRL_RATE.toFixed(2).replace('.', ',')})`}
      className="inline-flex items-center rounded-full bg-[#14171f] border border-white/10 p-0.5 shrink-0 select-none"
    >
      <button
        type="button"
        onClick={() => setCurrency('BRL')}
        aria-pressed={currency === 'BRL'}
        className={`rounded-full font-mono font-extrabold transition-colors whitespace-nowrap ${
          compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-[11px]'
        } ${
          currency === 'BRL'
            ? 'bg-[#b5ff00] text-[#090a0f] shadow-sm'
            : 'text-zinc-400 hover:text-white'
        }`}
      >
        R${!compact && ' BRL'}
      </button>
      <button
        type="button"
        onClick={() => setCurrency('EUR')}
        aria-pressed={currency === 'EUR'}
        className={`rounded-full font-mono font-extrabold transition-colors whitespace-nowrap ${
          compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-[11px]'
        } ${
          currency === 'EUR'
            ? 'bg-[#b5ff00] text-[#090a0f] shadow-sm'
            : 'text-zinc-400 hover:text-white'
        }`}
      >
        €{!compact && ' EUR'}
      </button>
    </div>
  );
};
