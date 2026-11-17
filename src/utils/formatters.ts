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
  if (value >= 16) return 'text-emerald-400 font-semibold';
  if (value >= 13) return 'text-emerald-200/90 font-medium';
  if (value >= 10) return 'text-amber-300 font-normal';
  return 'text-slate-400 font-normal';
}

export function getConditionColor(condition: number): {
  text: string;
  bar: string;
  label: string;
} {
  if (condition >= 88) {
    return {
      text: 'text-emerald-400',
      bar: 'bg-emerald-500',
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
      return 'text-emerald-400';
    case 'Muito Alta':
      return 'text-emerald-300';
    case 'Bom':
      return 'text-sky-300';
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
