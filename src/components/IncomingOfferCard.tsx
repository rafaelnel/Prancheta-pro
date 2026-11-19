import React from 'react';
import { Eye, Lock } from 'lucide-react';
import { IncomingOfferAction } from '../engine/aiMarketEngine';
import { calculatePlayerOverall } from '../engine/matchEngine';
import { getPlayerPotentialCeiling } from '../engine/transferEngine';
import { Club, IncomingTransferOffer, Player } from '../types/football';
import { formatCompactBRL } from '../utils/formatters';
import { ClubBadge } from './ClubBadge';
import { PlayerJersey, PlayerOvrBadge } from './PlayerJersey';
import { StarRating } from './StarRating';

interface IncomingOfferCardProps {
  offer: IncomingTransferOffer;
  userClub: Club;
  squad: Player[];
  seasonYear?: number;
  disabled?: boolean;
  disabledReason?: string;
  variant?: 'default' | 'autosim' | 'inbox';
  onResolve: (offerId: string, action: IncomingOfferAction) => void;
  onInspectPlayer?: (player: Player) => void;
}

export const IncomingOfferCard: React.FC<IncomingOfferCardProps> = ({
  offer,
  userClub,
  squad,
  seasonYear = 2026,
  disabled = false,
  disabledReason,
  variant = 'default',
  onResolve,
  onInspectPlayer,
}) => {
  const livePlayer = squad.find((p) => p.id === offer.playerId) || null;
  const isLoan = offer.dealType === 'LOAN';

  const ovr = livePlayer
    ? calculatePlayerOverall(livePlayer.attributes, livePlayer.position)
    : offer.playerOvr;
  const age = livePlayer?.age ?? offer.playerAge;
  const stars = livePlayer?.potentialStars ?? offer.playerPotentialStars;
  const potentialOvr = livePlayer
    ? getPlayerPotentialCeiling(livePlayer, ovr)
    : offer.playerPotentialOvr ??
      Math.min(
        96,
        Math.max(ovr, ovr + Math.max(0, Math.round((stars - 2.5) * 4)))
      );
  const growthRoom = Math.max(0, potentialOvr - ovr);
  const marketValue = livePlayer?.marketValue ?? offer.playerMarketValue ?? 0;
  const salary = livePlayer?.salary ?? offer.playerSalary ?? 0;
  const isStarter = livePlayer?.isStarter ?? offer.playerIsStarter ?? false;
  const contractYearsRemaining = livePlayer
    ? livePlayer.contractYearsRemaining ??
      (livePlayer.contractEndYear
        ? Math.max(1, livePlayer.contractEndYear - seasonYear + 1)
        : 2)
    : offer.playerContractYearsRemaining ?? null;

  const samePositionPlayers = squad.filter(
    (p) => p.position === offer.playerPosition
  );
  const samePosCount = samePositionPlayers.length;
  const otherPosOptions = Math.max(0, samePosCount - (livePlayer ? 1 : 0));

  const buyDiffPct =
    !isLoan && marketValue > 0
      ? Math.round(((offer.offeredFee - marketValue) / marketValue) * 100)
      : null;

  const diffToneClass =
    buyDiffPct === null
      ? 'text-sky-300'
      : buyDiffPct >= 10
      ? 'text-[#b5ff00]'
      : buyDiffPct >= 0
      ? 'text-emerald-300'
      : buyDiffPct >= -10
      ? 'text-amber-300'
      : 'text-rose-400';

  const diffLabel =
    buyDiffPct === null
      ? `Empréstimo · ${Math.round(offer.wageShareCovered * 100)}% sal.`
      : buyDiffPct > 0
      ? `+${buyDiffPct}% acima do valor`
      : buyDiffPct < 0
      ? `${buyDiffPct}% abaixo do valor`
      : 'No valor de mercado';

  const wageSavedOnLoan = Math.round(salary * offer.wageShareCovered);
  const stepUnit = isLoan ? 50_000 : 250_000;
  const counter15Fee =
    Math.round((offer.offeredFee * 1.15) / stepUnit) * stepUnit;
  const counter30Fee =
    Math.round((offer.offeredFee * 1.3) / stepUnit) * stepUnit;

  const isCompact = variant === 'autosim' || variant === 'inbox';

  const borderClass =
    variant === 'autosim'
      ? 'bg-[#0b0c10] border border-amber-400/50 rounded-2xl'
      : variant === 'inbox'
      ? 'bg-[#0b0c10] border border-[#b5ff00]/35 rounded-2xl'
      : 'bg-[#0b0c10] border border-white/[0.09] rounded-2xl';

  return (
    <div
      data-testid="incoming-offer-card"
      className={`${borderClass} ${isCompact ? 'p-3.5 space-y-3' : 'p-4 space-y-3.5'}`}
    >
      {/* Top Identity & Proposal Headline */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <PlayerJersey
            number={livePlayer?.number ?? 10}
            variant="club"
            customColor={userClub.primaryColor}
            size="sm"
          />
          <PlayerOvrBadge
            ovr={ovr}
            position={offer.playerPosition}
            size="md"
            tone={isStarter ? 'lime' : 'dark'}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display text-base sm:text-lg font-extrabold uppercase tracking-tight text-white leading-none truncate">
                {offer.playerName}
              </span>
              <StarRating
                stars={stars}
                size="xs"
                showNumeric={false}
              />
              <span className="text-[11px] font-mono text-zinc-400">
                {age}a ·{' '}
                <strong className={isStarter ? 'text-[#b5ff00]' : 'text-zinc-200'}>
                  {isStarter ? 'Titular' : 'Reserva'}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-1 flex-wrap">
              <ClubBadge
                clubId={offer.fromClubId}
                abbr={offer.fromClubAbbr}
                name={offer.fromClubName}
                primaryColor={offer.fromClubPrimaryColor}
                size="xs"
              />
              <span className="text-zinc-200 font-semibold">
                {offer.fromClubName}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {isLoan
                  ? `Empréstimo (${Math.round(offer.wageShareCovered * 100)}% salário)`
                  : 'Compra Definitiva'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-zinc-500">{offer.createdAtDate}</span>
            </div>
          </div>
        </div>

        <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-start gap-1 shrink-0">
          <div className="font-mono font-extrabold text-lg sm:text-xl text-[#b5ff00] tabular-nums leading-none">
            {formatCompactBRL(offer.offeredFee)}
          </div>
          <div className={`text-[11px] font-mono font-bold tabular-nums ${diffToneClass}`}>
            {diffLabel}
          </div>
        </div>
      </div>

      {/* Key Decision Analysis Strip: Market Value, Potential, Squad Depth & Role, Salary & Contract */}
      <div
        className={`grid gap-2 pt-2.5 border-t border-white/[0.07] ${
          variant === 'inbox' ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'
        }`}
      >
        <div className="bg-[#14171f] border border-white/[0.06] rounded-xl px-2.5 py-2">
          <div className="text-[10px] font-mono text-zinc-400">
            Valor de Mercado
          </div>
          <div className="font-mono text-sm font-extrabold text-white tabular-nums mt-0.5">
            {marketValue > 0 ? formatCompactBRL(marketValue) : '—'}
          </div>
          <div className={`text-[10px] font-mono tabular-nums mt-0.5 ${diffToneClass}`}>
            {isLoan
              ? marketValue > 0
                ? `Taxa: ${Math.round((offer.offeredFee / marketValue) * 100)}% do passe`
                : 'Cessão por 1 ano'
              : buyDiffPct !== null
              ? offer.offeredFee === marketValue
                ? 'Igual ao mercado'
                : `${offer.offeredFee > marketValue ? '+' : ''}${formatCompactBRL(
                    offer.offeredFee - marketValue
                  )}`
              : 'Comparativo'}
          </div>
        </div>

        <div className="bg-[#14171f] border border-white/[0.06] rounded-xl px-2.5 py-2">
          <div className="text-[10px] font-mono text-zinc-400">
            Potencial & Teto
          </div>
          <div className="font-mono text-sm font-extrabold text-white tabular-nums mt-0.5 flex items-baseline gap-1.5">
            <span>
              {ovr} →{' '}
              <span className={growthRoom >= 4 ? 'text-[#b5ff00]' : 'text-zinc-200'}>
                {potentialOvr}
              </span>
            </span>
            <span className="text-[11px] text-amber-300 font-bold">{stars}★</span>
          </div>
          <div
            className={`text-[10px] font-mono tabular-nums mt-0.5 ${
              growthRoom >= 5
                ? 'text-[#b5ff00]'
                : growthRoom >= 2
                ? 'text-zinc-300'
                : 'text-zinc-500'
            }`}
          >
            {growthRoom >= 5
              ? `+${growthRoom} OVR de margem (alta)`
              : growthRoom >= 2
              ? `+${growthRoom} OVR de margem`
              : 'Próximo do teto técnico'}
          </div>
        </div>

        <div className="bg-[#14171f] border border-white/[0.06] rounded-xl px-2.5 py-2">
          <div className="text-[10px] font-mono text-zinc-400">
            Elenco & Reposição
          </div>
          <div className="font-mono text-sm font-extrabold text-white tabular-nums mt-0.5">
            {isStarter ? 'Titular' : 'Reserva'} · {offer.playerPosition}
          </div>
          <div
            className={`text-[10px] font-mono mt-0.5 ${
              otherPosOptions === 0
                ? 'text-rose-400 font-semibold'
                : otherPosOptions === 1 && isStarter
                ? 'text-amber-300'
                : 'text-zinc-400'
            }`}
          >
            {otherPosOptions === 0
              ? `Sem outro ${offer.playerPosition} no elenco`
              : `${otherPosOptions} ${
                  otherPosOptions === 1 ? 'opção restante' : 'opções restantes'
                } na posição`}
          </div>
        </div>

        <div className="bg-[#14171f] border border-white/[0.06] rounded-xl px-2.5 py-2">
          <div className="text-[10px] font-mono text-zinc-400">
            Salário & Contrato
          </div>
          <div className="font-mono text-sm font-extrabold text-white tabular-nums mt-0.5">
            {salary > 0 ? `${formatCompactBRL(salary)}/mês` : '—'}
          </div>
          <div
            className={`text-[10px] font-mono mt-0.5 ${
              contractYearsRemaining === 1
                ? 'text-amber-300 font-semibold'
                : 'text-zinc-400'
            }`}
          >
            {isLoan && wageSavedOnLoan > 0
              ? `Economiza ${formatCompactBRL(wageSavedOnLoan)}/mês`
              : contractYearsRemaining !== null
              ? contractYearsRemaining <= 1
                ? 'Último ano de contrato!'
                : `Contrato: ${contractYearsRemaining} anos`
              : 'Vínculo ativo'}
          </div>
        </div>
      </div>

      {/* Rationale + Season Form + Optional Inspect Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-zinc-300">
        <p className="leading-snug">
          {offer.rationale}
          {livePlayer && livePlayer.seasonStats.matches > 0 && (
            <span className="text-zinc-400 font-mono tabular-nums">
              {' '}
              · Temporada: {livePlayer.seasonStats.matches}J,{' '}
              {livePlayer.seasonStats.goals}G, {livePlayer.seasonStats.assists}A
              (nota {livePlayer.seasonStats.avgRating.toFixed(2)})
            </span>
          )}
        </p>

        {livePlayer && onInspectPlayer && (
          <button
            type="button"
            onClick={() => onInspectPlayer(livePlayer)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#b5ff00] hover:underline whitespace-nowrap shrink-0 self-start sm:self-center cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Ver Ficha</span>
          </button>
        )}
      </div>

      {/* Decision Action Buttons */}
      {disabled && disabledReason ? (
        <div className="flex items-start gap-2 rounded-xl bg-rose-950/35 border border-rose-500/35 px-3 py-2 text-[11px] text-rose-200">
          <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
          <span>{disabledReason}</span>
        </div>
      ) : (
        <div
          className={`grid gap-1.5 ${
            variant === 'inbox' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'
          }`}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => onResolve(offer.id, 'ACCEPT')}
            className="py-2 px-2.5 rounded-xl bg-[#b5ff00] hover:bg-[#c8ff33] disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-[#090a0f] text-[11px] font-extrabold transition-colors whitespace-nowrap cursor-pointer"
          >
            Aceitar ({formatCompactBRL(offer.offeredFee)})
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onResolve(offer.id, 'COUNTER_15')}
            className="py-2 px-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer"
          >
            +15% ({formatCompactBRL(counter15Fee)})
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onResolve(offer.id, 'COUNTER_30')}
            className="py-2 px-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] disabled:opacity-40 disabled:cursor-not-allowed text-amber-300 text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer"
          >
            +30% ({formatCompactBRL(counter30Fee)})
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onResolve(offer.id, 'REJECT')}
            className="py-2 px-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-40 disabled:cursor-not-allowed border border-rose-500/35 text-rose-300 text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer"
          >
            Recusar
          </button>
        </div>
      )}
    </div>
  );
};
