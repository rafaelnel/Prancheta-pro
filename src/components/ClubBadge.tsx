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
  // UEFA Champions League (16 clubes)
  'real-madrid',
  'man-city',
  'barcelona',
  'bayern',
  'psg',
  'liverpool',
  'arsenal',
  'inter-milan',
  'chelsea',
  'atletico-madrid',
  'borussia-dortmund',
  'ac-milan',
  'juventus',
  'bayer-leverkusen',
  'benfica',
  'sporting',
  // CONMEBOL Libertadores (24 clubes estrangeiros)
  'river-plate',
  'boca-juniors',
  'racing-club',
  'estudiantes-lp',
  'rosario-central',
  'penarol',
  'nacional-uru',
  'atletico-nacional',
  'santa-fe',
  'junior-barranquilla',
  'ldu-quito',
  'ind-del-valle',
  'barcelona-sc',
  'cerro-porteno',
  'libertad',
  'olimpia',
  'colo-colo',
  'u-de-chile',
  'universitario',
  'alianza-lima',
  'bolivar',
  'the-strongest',
  'dep-tachira',
  'carabobo',
  // Mundial / Super Mundial (4 clubes globais)
  'al-hilal',
  'inter-miami',
  'monterrey',
  'al-ahly',
]);

const SVG_BADGE_CLUB_IDS = new Set<string>([
  'chelsea',
  'ac-milan',
  'juventus',
  'bayer-leverkusen',
  'benfica',
  'river-plate',
  'boca-juniors',
  'racing-club',
  'estudiantes-lp',
  'rosario-central',
  'penarol',
  'nacional-uru',
  'atletico-nacional',
  'santa-fe',
  'junior-barranquilla',
  'ldu-quito',
  'ind-del-valle',
  'barcelona-sc',
  'cerro-porteno',
  'libertad',
  'olimpia',
  'colo-colo',
  'u-de-chile',
  'universitario',
  'alianza-lima',
  'bolivar',
  'the-strongest',
  'dep-tachira',
  'carabobo',
  'al-hilal',
  'inter-miami',
  'monterrey',
  'al-ahly',
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
  className = '',
}) => {
  const [failedClubId, setFailedClubId] = useState<string | null>(null);
  const sizeClass = SIZE_CLASSES[size];
  const failed = Boolean(clubId && failedClubId === clubId);
  const hasRealBadge = Boolean(clubId && REAL_BADGE_CLUB_IDS.has(clubId) && !failed);

  if (hasRealBadge && clubId) {
    const ext = SVG_BADGE_CLUB_IDS.has(clubId) ? 'svg' : 'png';
    const src = `${import.meta.env.BASE_URL}badges/${clubId}.${ext}`;

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
          onError={() => setFailedClubId(clubId)}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} flex items-center justify-center font-display font-extrabold shrink-0 border border-white/20 select-none ${className}`}
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
