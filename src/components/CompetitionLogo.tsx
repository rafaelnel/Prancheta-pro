import React, { useState } from 'react';
import { Trophy } from 'lucide-react';
import {
  COMPETITION_LOGO_LABELS,
  CompetitionLogoKey,
  getCompetitionLogoUrl,
} from '../data/competitionLogoAssets';

interface CompetitionLogoProps {
  competition: CompetitionLogoKey;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'w-4 h-4 rounded-[4px]',
  sm: 'w-6 h-6 rounded-md',
  md: 'w-9 h-9 rounded-xl',
  lg: 'w-12 h-12 rounded-2xl',
};

const ICON_FALLBACK_SIZES: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'w-2.5 h-2.5',
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export const CompetitionLogo: React.FC<CompetitionLogoProps> = ({
  competition,
  size = 'sm',
  className = '',
}) => {
  const [failed, setFailed] = useState(false);
  const src = getCompetitionLogoUrl(competition);
  const alt = COMPETITION_LOGO_LABELS[competition] || competition;

  if (failed) {
    return (
      <span
        aria-label={alt}
        className={`${SIZE_CLASSES[size]} inline-flex items-center justify-center bg-[#1c202c] border border-white/15 text-[#b5ff00] shrink-0 ${className}`}
      >
        <Trophy className={ICON_FALLBACK_SIZES[size]} />
      </span>
    );
  }

  return (
    <span
      className={`${SIZE_CLASSES[size]} inline-flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-black/20 shadow-sm bg-[#0b0c10] ${className}`}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover select-none"
      />
    </span>
  );
};
