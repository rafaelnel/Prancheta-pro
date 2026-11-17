import { MoraleState } from '../types/football';

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactBRL(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    const millions = value / 1_000_000;
    return `R$ ${millions.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}M`;
  }
  if (Math.abs(value) >= 1_000) {
    const thousands = value / 1_000;
    return `R$ ${thousands.toLocaleString('pt-BR', {
      maximumFractionDigits: 0,
    })} mil`;
  }
  return formatBRL(value);
}

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

export function formatCalendarDate(dayOffset: number): string {
  const baseDate = new Date(2026, 4, 16); // 16 May 2026
  baseDate.setDate(baseDate.getDate() + dayOffset);
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
  const dayName = days[baseDate.getDay()];
  const dayNum = String(baseDate.getDate()).padStart(2, '0');
  const monthName = months[baseDate.getMonth()];
  const year = baseDate.getFullYear();
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

