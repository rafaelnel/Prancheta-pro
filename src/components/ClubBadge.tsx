import React, { useState } from 'react';
import { getContrastTextColor } from '../utils/formatters';
import {
  REAL_BADGE_CLUB_IDS,
  getClubBadgeUrl,
} from '../data/clubBadgeAssets';

export { REAL_BADGE_CLUB_IDS };

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
  const badgeSrc =
    clubId && !failed ? getClubBadgeUrl(clubId, import.meta.env.BASE_URL) : null;

  if (badgeSrc && clubId) {
    return (
      <div
        className={`${sizeClass} shrink-0 flex items-center justify-center select-none ${className}`}
        title={name || abbr}
      >
        <img
          src={badgeSrc}
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
