import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Globe2, X } from 'lucide-react';
import { Club, NaturalPosition, TransferDealMode } from '../types/football';
import { formatCompactBRL } from '../utils/formatters';
import { ClubBadge } from './ClubBadge';
import { PlayerJersey, PlayerOvrBadge } from './PlayerJersey';
import { StarRating } from './StarRating';

export interface MarketDealTransitionPayload {
  id: string;
  direction: 'INCOMING' | 'OUTGOING';
  dealMode: TransferDealMode | 'LOAN_OUT' | 'SELL_OUT';
  playerName: string;
  playerNumber: number;
  position: NaturalPosition;
  age: number;
  ovr: number;
  potentialStars: 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5;
  fromClub: {
    id: string;
    abbr: string;
    name: string;
    primaryColor: string;
  } | null;
  toClub: {
    id: string;
    abbr: string;
    name: string;
    primaryColor: string;
  };
  fee: number;
  monthlySalary: number;
  durationYears: number;
  wageShareCovered?: number;
}

interface MarketDealTransitionModalProps {
  deal: MarketDealTransitionPayload | null;
  userClub: Club;
  onCompleteDismiss: () => void;
}

const AUTO_DISMISS_MS = 3200;
const EXIT_ANIMATION_MS = 220;

export const MarketDealTransitionModal: React.FC<MarketDealTransitionModalProps> = ({
  deal,
  userClub,
  onCompleteDismiss,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    setIsClosing(false);
    setIsPaused(false);
  }, [deal?.id]);

  const triggerClose = () => {
    setIsClosing(true);
  };

  useEffect(() => {
    if (!deal || isClosing || isPaused) return;
    const timer = window.setTimeout(() => {
      setIsClosing(true);
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [deal, isClosing, isPaused]);

  useEffect(() => {
    if (!deal || !isClosing) return;
    const timer = window.setTimeout(() => {
      onCompleteDismiss();
    }, EXIT_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [deal, isClosing, onCompleteDismiss]);

  useEffect(() => {
    if (!deal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsClosing(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deal]);

  if (!deal) return null;

  const isOutgoing = deal.direction === 'OUTGOING';
  const headlineTag = isOutgoing
    ? deal.dealMode === 'LOAN_OUT'
      ? 'EMPRÉSTIMO CONFIRMADO'
      : 'VENDA OFICIALIZADA'
    : deal.dealMode === 'LOAN'
    ? 'EMPRÉSTIMO OFICIALIZADO'
    : deal.dealMode === 'FREE'
    ? 'PASSE LIVRE ASSINADO'
    : 'CONTRATAÇÃO OFICIALIZADA';

  const modalityLabel = isOutgoing
    ? deal.dealMode === 'LOAN_OUT'
      ? `Empréstimo (${deal.durationYears}a)`
      : 'Venda Definitiva'
    : deal.dealMode === 'LOAN'
    ? `Empréstimo (${deal.durationYears}a)`
    : deal.dealMode === 'FREE'
    ? `Passe Livre (${deal.durationYears}a)`
    : `Compra (${deal.durationYears}a)`;

  const jerseyColor = isOutgoing
    ? deal.toClub.primaryColor
    : userClub.primaryColor;

  const wageSaved =
    isOutgoing && deal.dealMode === 'LOAN_OUT'
      ? Math.round(deal.monthlySalary * (deal.wageShareCovered ?? 1))
      : deal.monthlySalary;

  return (
    <div
      data-testid="deal-accepted-transition"
      role="dialog"
      aria-modal="true"
      aria-label={`${headlineTag}: ${deal.playerName}`}
      onClick={triggerClose}
      className={`fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md ${
        isClosing ? 'animate-market-backdrop-out' : 'animate-market-backdrop-in'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className={`relative w-full max-w-lg rounded-[26px] bg-[#101219] border border-[#b5ff00]/45 shadow-[0_24px_80px_rgba(0,0,0,0.75)] overflow-hidden ${
          isClosing ? 'animate-market-deal-card-out' : 'animate-market-deal-card-in'
        }`}
      >
        {/* Specular celebratory light sweep */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-[#b5ff00]/16 to-transparent animate-market-sheen-sweep"
        />

        {/* Subtle top radial accent wash */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#b5ff00]/12 to-transparent"
        />

        {/* Header */}
        <div className="relative px-5 pt-5 pb-4 border-b border-white/[0.08] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#b5ff00]/15 border border-[#b5ff00]/40 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-[#b5ff00]" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-mono font-extrabold uppercase tracking-[0.18em] text-[#b5ff00]">
                {headlineTag}
              </div>
              <div className="text-xs text-zinc-400 truncate">
                {isOutgoing
                  ? `Acordo fechado com ${deal.toClub.name}`
                  : `Novo reforço integrado ao elenco do ${userClub.shortName}`}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={triggerClose}
            aria-label="Fechar celebração da contratação"
            className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="relative p-5 sm:p-6 space-y-5">
          {/* Club Transfer Bridge */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 py-1">
            <div className="flex flex-col items-center gap-1.5 min-w-[84px] animate-market-crest-pop">
              {deal.fromClub ? (
                <>
                  <ClubBadge
                    clubId={deal.fromClub.id}
                    abbr={deal.fromClub.abbr}
                    name={deal.fromClub.name}
                    primaryColor={deal.fromClub.primaryColor}
                    size="lg"
                  />
                  <span className="text-[11px] font-semibold text-zinc-400 text-center truncate max-w-[110px]">
                    {deal.fromClub.name}
                  </span>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-zinc-300">
                    <Globe2 className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-400 text-center">
                    Agente Livre
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-col items-center gap-1 animate-market-arrow-glide">
              <div className="w-10 h-10 rounded-full bg-[#b5ff00]/15 border border-[#b5ff00]/45 flex items-center justify-center text-[#b5ff00]">
                <ArrowRight className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                #{deal.playerNumber}
              </span>
            </div>

            <div className="flex flex-col items-center gap-1.5 min-w-[84px] animate-market-crest-pop">
              <ClubBadge
                clubId={deal.toClub.id}
                abbr={deal.toClub.abbr}
                name={deal.toClub.name}
                primaryColor={deal.toClub.primaryColor}
                size="lg"
              />
              <span className="text-[11px] font-bold text-white text-center truncate max-w-[110px]">
                {deal.toClub.name}
              </span>
            </div>
          </div>

          {/* Player Showcase Card */}
          <div className="bg-[#14171f] border border-white/[0.08] rounded-2xl p-4 flex items-center gap-3.5 animate-market-crest-pop">
            <PlayerJersey
              number={deal.playerNumber}
              variant="club"
              customColor={jerseyColor}
              size="md"
            />
            <PlayerOvrBadge
              ovr={deal.ovr}
              position={deal.position}
              size="lg"
              tone="lime"
            />
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white leading-none truncate">
                {deal.playerName}
              </h3>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <StarRating
                  stars={deal.potentialStars}
                  size="xs"
                  showNumeric={false}
                />
                <span className="text-xs font-mono text-zinc-400 tabular-nums">
                  {deal.age} anos · {deal.position}
                </span>
              </div>
            </div>
          </div>

          {/* Tabular Deal Metrics */}
          <div className="grid grid-cols-3 gap-2.5 bg-[#0b0c10] border border-white/[0.07] rounded-2xl p-3.5 text-center">
            <div>
              <div className="text-[10px] font-mono uppercase text-zinc-400">
                Modalidade
              </div>
              <div className="text-xs font-extrabold text-white mt-1 tabular-nums">
                {modalityLabel}
              </div>
            </div>

            <div className="border-x border-white/[0.07] px-2">
              <div className="text-[10px] font-mono uppercase text-zinc-400">
                {isOutgoing ? 'Receita' : 'Valor'}
              </div>
              <div className="text-xs font-mono font-extrabold text-[#b5ff00] mt-1 tabular-nums">
                {deal.fee === 0
                  ? 'Sem Custo'
                  : `${isOutgoing ? '+' : ''}${formatCompactBRL(deal.fee)}`}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase text-zinc-400">
                {isOutgoing ? 'Alívio Folha' : 'Salário Mensal'}
              </div>
              <div className="text-xs font-mono font-extrabold text-white mt-1 tabular-nums">
                {wageSaved > 0 ? `${formatCompactBRL(wageSaved)}/mês` : '—'}
              </div>
            </div>
          </div>

          {/* Immediate Dismiss Action */}
          <button
            type="button"
            onClick={triggerClose}
            className="w-full py-3 px-5 rounded-xl bg-[#b5ff00] hover:bg-[#c8ff33] active:scale-[0.99] text-[#090a0f] text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Continuar no Mercado</span>
          </button>
        </div>
      </div>
    </div>
  );
};
