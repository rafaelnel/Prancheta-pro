import React, { useState } from 'react';
import { getContrastTextColor } from '../utils/formatters';

export const REAL_BADGE_CLUB_IDS = new Set<string>([
  // Série A 2026 (20 clubes)
  'flamengo',
  'palmeiras',
  'botafogo',
  'cruzeiro',
  'corinthians',
  'atletico-mg',
  'internacional',
  'sao-paulo',
  'bahia',
  'fluminense',
  'gremio',
  'vasco',
  'santos',
  'bragantino',
  'athletico-pr',
  'coritiba',
  'vitoria',
  'mirassol',
  'chapecoense',
  'remo',
  // Série B 2026 (20 clubes)
  'fortaleza',
  'sport',
  'ceara',
  'juventude',
  'goias',
  'novorizontino',
  'criciuma',
  'cuiaba',
  'america-mg',
  'atletico-go',
  'ponte-preta',
  'nautico',
  'londrina',
  'sao-bernardo',
  'vila-nova',
  'avai',
  'operario-pr',
  'crb',
  'botafogo-sp',
  'athletic-mg',
]);

export type ClubBadgeSize = 'xs' | 'sm' | 'md' | 'lg' | 'header';

interface ClubBadgeProps {
  clubId?: string | null;
  abbr?: string;
  name?: string;
  primaryColor?: string;
  size?: ClubBadgeSize;
  surface?: 'dark' | 'light';
  className?: string;
}

const SIZE_CLASSES: Record<ClubBadgeSize, string> = {
  xs: 'w-5 h-5 text-[8px] rounded-md',
  sm: 'w-7 h-7 text-[10px] rounded-lg',
  md: 'w-10 h-10 text-xs rounded-xl',
  lg: 'w-14 h-14 text-xl rounded-2xl',
  header: 'w-7 h-7 lg:w-9 lg:h-9 text-xs lg:text-sm rounded-xl',
};

export const ClubBadge: React.FC<ClubBadgeProps> = ({
  clubId,
  abbr = 'CLB',
  name,
  primaryColor = '#27272a',
  size = 'md',
  surface = 'dark',
  className = '',
}) => {
  const [failed, setFailed] = useState(false);
  const sizeClass = SIZE_CLASSES[size];
  const hasRealBadge = Boolean(clubId && REAL_BADGE_CLUB_IDS.has(clubId) && !failed);

  if (hasRealBadge && clubId) {
    const src = `${import.meta.env.BASE_URL}badges/${clubId}.png`;
    const shadowClass =
      surface === 'dark'
        ? '[filter:drop-shadow(0_0_1px_rgba(255,255,255,0.42))_drop-shadow(0_2px_4px_rgba(0,0,0,0.55))]'
        : '[filter:drop-shadow(0_2px_4px_rgba(0,0,0,0.28))]';

    return (
      <div
        className={`${sizeClass} shrink-0 flex items-center justify-center select-none ${className}`}
        title={name || abbr}
      >
        <img
          src={src}
          alt={name ? `Escudo ${name}` : abbr}
          loading="lazy"
          draggable={false}
          onError={() => setFailed(true)}
          className={`w-full h-full object-contain ${shadowClass}`}
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} flex items-center justify-center font-display font-extrabold shrink-0 shadow border border-white/20 select-none ${className}`}
      style={{
        backgroundColor: primaryColor,
        color: getContrastTextColor(primaryColor),
      }}
      title={name || abbr}
    >
      {abbr}
    </div>
  );
};
