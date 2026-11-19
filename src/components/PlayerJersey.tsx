import React from 'react';
import { NaturalPosition } from '../types/football';

export type JerseyVariant = 'lime' | 'white' | 'dark' | 'club';
export type JerseySize = 'xs' | 'sm' | 'md' | 'lg';
export type JerseyHighlight = 'none' | 'selected' | 'dropTarget' | 'out';

interface PlayerJerseyProps {
  number?: number | string;
  ovr?: number;
  variant?: JerseyVariant;
  customColor?: string;
  size?: JerseySize;
  highlight?: JerseyHighlight;
  className?: string;
}

function getContrastInk(hex?: string): string {
  if (!hex || !hex.startsWith('#')) return '#090a0f';
  const clean = hex.slice(1);
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.56 ? '#090a0f' : '#ffffff';
}

const SIZE_CLASSES: Record<
  JerseySize,
  { box: string; numberText: string; ovrPill: string }
> = {
  xs: {
    box: 'w-7 h-7',
    numberText: 'text-[9px]',
    ovrPill: '-top-1 -right-1.5 px-1 text-[8px]',
  },
  sm: {
    box: 'w-9 h-9',
    numberText: 'text-[10px]',
    ovrPill: '-top-1 -right-1.5 px-1 text-[9px]',
  },
  md: {
    box: 'w-11 h-11',
    numberText: 'text-xs',
    ovrPill: '-top-1.5 -right-2 px-1.5 py-[1px] text-[10px]',
  },
  lg: {
    box: 'w-14 h-14',
    numberText: 'text-sm',
    ovrPill: '-top-1.5 -right-2 px-1.5 py-0.5 text-[11px]',
  },
};

export const PlayerJersey: React.FC<PlayerJerseyProps> = ({
  number,
  ovr,
  variant = 'lime',
  customColor,
  size = 'md',
  highlight = 'none',
  className = '',
}) => {
  const fill =
    variant === 'lime'
      ? '#b5ff00'
      : variant === 'white'
      ? '#ffffff'
      : variant === 'dark'
      ? '#1d222e'
      : customColor || '#b5ff00';

  const ink =
    variant === 'dark'
      ? '#ffffff'
      : variant === 'club'
      ? getContrastInk(fill)
      : '#090a0f';

  const stroke = variant === 'dark' ? '#b5ff00' : '#090a0f';
  const collarStroke = variant === 'dark' ? '#b5ff00' : '#090a0f';
  const sizing = SIZE_CLASSES[size];

  const highlightRing =
    highlight === 'dropTarget'
      ? 'ring-2 sm:ring-4 ring-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.55)]'
      : highlight === 'selected'
      ? 'ring-2 sm:ring-4 ring-[#b5ff00]/60 shadow-[0_0_18px_rgba(181,255,0,0.35)]'
      : highlight === 'out'
      ? 'ring-2 ring-rose-400 shadow-[0_0_14px_rgba(244,63,94,0.4)]'
      : '';

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-xl shrink-0 ${sizing.box} ${highlightRing} ${className}`}
    >
      <svg
        viewBox="0 0 36 32"
        className="w-full h-full overflow-visible drop-shadow"
        aria-hidden="true"
      >
        <path
          d="M11 2 L25 2 L34 9 L29 15 L25 12 L25 30 L11 30 L11 12 L7 15 L2 9 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M14.5 2 Q18 6.8 21.5 2"
          fill="none"
          stroke={collarStroke}
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
      {number !== undefined && number !== null && (
        <span
          className={`absolute inset-0 flex items-center justify-center font-mono font-extrabold tabular-nums pt-[3px] leading-none pointer-events-none ${sizing.numberText}`}
          style={{ color: ink }}
        >
          {number}
        </span>
      )}
      {typeof ovr === 'number' && (
        <span
          className={`absolute rounded-md bg-[#090a0f] border border-[#b5ff00]/80 font-mono font-extrabold tabular-nums text-[#b5ff00] leading-tight shadow-md pointer-events-none ${sizing.ovrPill}`}
        >
          {Math.round(ovr)}
        </span>
      )}
    </div>
  );
};

interface PlayerOvrBadgeProps {
  ovr: number;
  position: NaturalPosition | string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  tone?: 'dark' | 'lime' | 'amber' | 'rose';
  className?: string;
}

export const PlayerOvrBadge: React.FC<PlayerOvrBadgeProps> = ({
  ovr,
  position,
  size = 'md',
  tone = 'dark',
  className = '',
}) => {
  const sizeStyles =
    size === 'xs'
      ? 'w-8 h-8 rounded-lg'
      : size === 'sm'
      ? 'w-9 h-9 rounded-xl'
      : size === 'md'
      ? 'w-10 h-10 rounded-xl'
      : 'w-12 h-12 rounded-2xl';

  const ovrTextStyles =
    size === 'xs'
      ? 'text-[11px]'
      : size === 'sm'
      ? 'text-xs sm:text-sm'
      : size === 'md'
      ? 'text-sm sm:text-base'
      : 'font-display text-xl sm:text-2xl';

  const posTextStyles =
    size === 'xs'
      ? 'text-[8px]'
      : size === 'sm'
      ? 'text-[9px]'
      : size === 'md'
      ? 'text-[9px]'
      : 'text-[10px]';

  const toneStyles =
    tone === 'lime'
      ? 'bg-[#b5ff00] text-[#090a0f] border-[#b5ff00]'
      : tone === 'amber'
      ? 'bg-amber-400 text-[#090a0f] border-amber-400'
      : tone === 'rose'
      ? 'bg-rose-500 text-white border-rose-500'
      : 'bg-[#0b0c10] border-white/[0.12]';

  return (
    <div
      className={`border flex flex-col items-center justify-center shrink-0 shadow-sm ${sizeStyles} ${toneStyles} ${className}`}
    >
      <span
        className={`font-mono tabular-nums font-extrabold leading-none ${ovrTextStyles} ${
          tone === 'dark' ? 'text-[#b5ff00]' : ''
        }`}
      >
        {Math.round(ovr)}
      </span>
      <span
        className={`font-mono font-bold mt-0.5 leading-none uppercase ${posTextStyles} ${
          tone === 'dark' ? 'text-zinc-300' : 'opacity-85'
        }`}
      >
        {position}
      </span>
    </div>
  );
};

interface PitchJerseySvgProps {
  cx: number;
  cy: number;
  number: number;
  ovr?: number;
  shortName: string;
  team: 'HOME' | 'AWAY';
  hasBall: boolean;
}

export const PitchJerseySvg: React.FC<PitchJerseySvgProps> = ({
  cx,
  cy,
  number,
  ovr,
  shortName,
  team,
  hasBall,
}) => {
  const isHome = team === 'HOME';
  const fill = isHome ? '#b5ff00' : '#ffffff';
  const ringStroke = isHome ? '#ffffff' : '#b5ff00';
  const nameFill = isHome ? '#b5ff00' : 'rgba(255,255,255,0.92)';

  return (
    <g
      style={{
        transform: `translate(${cx}px, ${cy}px)`,
        transition: 'transform 220ms linear',
      }}
    >
      {hasBall && (
        <circle
          r="24"
          fill="none"
          stroke={ringStroke}
          strokeWidth="2.4"
          strokeDasharray="4 3"
        />
      )}
      <g transform="translate(-17, -16)">
        <path
          d="M10.5 2 L23.5 2 L32 8.5 L27.5 14 L23.5 11.2 L23.5 28.5 L10.5 28.5 L10.5 11.2 L6.5 14 L2 8.5 Z"
          fill={fill}
          stroke="#090a0f"
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
        <path
          d="M13.5 2 Q17 6.2 20.5 2"
          fill="none"
          stroke="#090a0f"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      <text
        textAnchor="middle"
        dy="4.5"
        fill="#090a0f"
        fontSize="11"
        fontFamily="JetBrains Mono, monospace"
        fontWeight="800"
      >
        {number}
      </text>
      {typeof ovr === 'number' && (
        <g transform="translate(12, -16)">
          <rect
            x="-9"
            y="-6"
            width="18"
            height="12"
            rx="4"
            fill="#090a0f"
            stroke="#b5ff00"
            strokeWidth="1.2"
          />
          <text
            textAnchor="middle"
            dy="3"
            fill="#b5ff00"
            fontSize="8.2"
            fontFamily="JetBrains Mono, monospace"
            fontWeight="800"
          >
            {Math.round(ovr)}
          </text>
        </g>
      )}
      <text
        textAnchor="middle"
        dy="24"
        fill={nameFill}
        fontSize="9.8"
        fontWeight="700"
        style={{ paintOrder: 'stroke', stroke: '#090a0f', strokeWidth: '2.5px' }}
      >
        {shortName}
      </text>
    </g>
  );
};
