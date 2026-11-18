import React from 'react';
import { Star } from 'lucide-react';
import { PotentialStars } from '../types/football';
import { assignPotentialStars } from '../engine/economyAndEvolution';
import { Player } from '../types/football';

interface StarRatingProps {
  stars?: PotentialStars;
  player?: Player;
  ovr?: number;
  clubReputation?: number;
  size?: 'xs' | 'sm';
  showNumeric?: boolean;
}

export function resolvePlayerStars(
  player: Player,
  ovr: number,
  clubReputation: number = 78
): PotentialStars {
  return (
    player.potentialStars ??
    assignPotentialStars(ovr, player.age, clubReputation, player.id)
  );
}

export const StarRating: React.FC<StarRatingProps> = ({
  stars,
  player,
  ovr = 75,
  clubReputation = 78,
  size = 'xs',
  showNumeric = false,
}) => {
  const value: PotentialStars =
    stars ??
    (player
      ? resolvePlayerStars(player, ovr, clubReputation)
      : 3);

  const iconCls = size === 'sm' ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5';

  return (
    <span
      className="inline-flex items-center gap-0.5 whitespace-nowrap"
      title={`Potencial: ${value} de 5 estrelas`}
      aria-label={`Potencial ${value} de 5 estrelas`}
    >
      {[1, 2, 3, 4, 5].map((idx) => {
        const isFull = idx <= value;
        const isHalf = !isFull && idx - 0.5 <= value;
        if (isFull) {
          return (
            <Star
              key={idx}
              className={`${iconCls} text-amber-400 fill-amber-400 shrink-0`}
            />
          );
        }
        if (isHalf) {
          return (
            <span
              key={idx}
              className={`relative inline-flex items-center justify-center ${iconCls} shrink-0`}
            >
              <Star className={`${iconCls} text-zinc-600`} />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: '50%' }}
              >
                <Star className={`${iconCls} text-amber-400 fill-amber-400`} />
              </span>
            </span>
          );
        }
        return (
          <Star
            key={idx}
            className={`${iconCls} text-zinc-600 shrink-0`}
          />
        );
      })}
      {showNumeric && (
        <span className="ml-1 text-[10px] font-mono font-bold text-amber-300 tabular-nums">
          {value}★
        </span>
      )}
    </span>
  );
};
