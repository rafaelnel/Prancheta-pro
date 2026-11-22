import { MoraleState } from '../types/football';

export type CurrencyCode = 'BRL' | 'EUR';
export const EUR_TO_BRL_RATE = 6.0;
export const USD_TO_BRL_RATE = 5.5;
const CURRENCY_STORAGE_KEY = 'brasileirao_manager_currency_v1';

function loadInitialCurrency(): CurrencyCode {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
      if (saved === 'EUR' || saved === 'BRL') return saved;
    }
  } catch {
    // ignore storage access issues
  }
  return 'BRL';
}

let activeCurrency: CurrencyCode = loadInitialCurrency();

export function getActiveCurrency(): CurrencyCode {
  return activeCurrency;
}

export function setActiveCurrency(next: CurrencyCode): void {
  activeCurrency = next;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, next);
    }
  } catch {
    // ignore storage access issues
  }
}

export function convertBrlToCurrency(
  valueBrl: number,
  currency: CurrencyCode = activeCurrency
): number {
  return currency === 'EUR' ? valueBrl / EUR_TO_BRL_RATE : valueBrl;
}

export function formatBRL(
  valueBrl: number,
  currency: CurrencyCode = activeCurrency
): string {
  const converted = convertBrlToCurrency(valueBrl, currency);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(converted);
}

export function formatCompactBRL(
  valueBrl: number,
  currency: CurrencyCode = activeCurrency
): string {
  const converted = convertBrlToCurrency(valueBrl, currency);
  const prefix = currency === 'EUR' ? '€' : 'R$';
  const sign = converted < 0 ? '-' : '';
  const abs = Math.abs(converted);

  if (abs === 0) {
    return `${prefix} 0`;
  }
  if (abs >= 1_000_000_000) {
    const billions = abs / 1_000_000_000;
    return `${sign}${prefix} ${billions.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}Bi`;
  }
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    return `${sign}${prefix} ${millions.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}M`;
  }
  if (abs >= 1_000) {
    const thousands = Math.round(abs / 1_000);
    return `${sign}${prefix} ${thousands.toLocaleString('pt-BR')} mil`;
  }
  return formatBRL(valueBrl, currency);
}

export const formatCurrency = formatBRL;
export const formatCompactCurrency = formatCompactBRL;

export function getAttributeColorClass(value: number): string {
  if (value >= 16) return 'text-[#b5ff00] font-bold';
  if (value >= 13) return 'text-[#d9ff7a] font-medium';
  if (value >= 10) return 'text-amber-300 font-normal';
  return 'text-zinc-400 font-normal';
}

export function getConditionColor(condition: number): {
  text: string;
  bar: string;
  label: string;
} {
  if (condition >= 88) {
    return {
      text: 'text-[#b5ff00]',
      bar: 'bg-[#b5ff00]',
      label: 'Pleno',
    };
  }
  if (condition >= 75) {
    return {
      text: 'text-amber-400',
      bar: 'bg-amber-500',
      label: 'Desgaste',
    };
  }
  return {
    text: 'text-rose-400',
    bar: 'bg-rose-500',
    label: 'Fadiga Alta',
  };
}

export function getMoraleColor(morale: MoraleState): string {
  switch (morale) {
    case 'Exuberante':
      return 'text-[#b5ff00]';
    case 'Muito Alta':
      return 'text-[#d9ff7a]';
    case 'Bom':
      return 'text-zinc-200';
    case 'Regular':
      return 'text-amber-400';
    case 'Baixa':
      return 'text-rose-400';
  }
}

export function formatCalendarDate(
  dayOffset: number,
  seasonYear: number = 2026
): string {
  const baseUtc = Date.UTC(seasonYear, 0, 28) + dayOffset * 86_400_000;
  const baseDate = new Date(baseUtc);
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const months = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ];
  const dayName = days[baseDate.getUTCDay()];
  const dayNum = String(baseDate.getUTCDate()).padStart(2, '0');
  const monthName = months[baseDate.getUTCMonth()];
  const year = baseDate.getUTCFullYear();
  return `${dayName}, ${dayNum} ${monthName} ${year}`;
}

export function getContrastTextColor(hexColor: string): string {
  const clean = hexColor.replace('#', '');
  if (clean.length !== 6) return '#ffffff';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#090a0f' : '#ffffff';
}

