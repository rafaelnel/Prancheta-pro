import React, { useEffect, useMemo } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Users,
  X,
  Zap,
  Eye,
} from 'lucide-react';
import {
  Club,
  NewSeasonEvolutionReport,
  Player,
  PlayerEvolutionReportItem,
} from '../types/football';
import { formatCompactBRL } from '../utils/formatters';
import { ClubBadge } from './ClubBadge';
import { PlayerJersey, PlayerOvrBadge } from './PlayerJersey';
import { StarRating } from './StarRating';

interface NewSeasonEvolutionModalProps {
  isOpen: boolean;
  report: NewSeasonEvolutionReport | null;
  userClub: Club;
  squad: Player[];
  onInspectPlayer: (player: Player) => void;
  onGoToSquad: () => void;
  onClose: () => void;
}

function getStatusMeta(item: PlayerEvolutionReportItem): {
  label: string;
  textClass: string;
} {
  if (
    item.exceededExpectations ||
    item.developmentStatus === 'SUPEROU_EXPECTATIVAS'
  ) {
    return { label: 'Superou Expectativas', textClass: 'text-amber-300' };
  }
  if (item.deltaOvr > 0) {
    return { label: 'Evoluiu', textClass: 'text-[#b5ff00]' };
  }
  if (item.developmentStatus === 'REGRESSAO_FISICA') {
    return { label: 'Regressão Física', textClass: 'text-rose-400' };
  }
  if (item.deltaOvr < 0 || item.developmentStatus === 'DECLINIO_TECNICO') {
    return { label: 'Regrediu', textClass: 'text-rose-400' };
  }
  if (item.developmentStatus === 'ESTAGNADO') {
    return { label: 'Estagnado', textClass: 'text-zinc-400' };
  }
  return { label: 'Sem alteração', textClass: 'text-zinc-400' };
}

export const NewSeasonEvolutionModal: React.FC<NewSeasonEvolutionModalProps> = ({
  isOpen,
  report,
  userClub,
  squad,
  onInspectPlayer,
  onGoToSquad,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const squadById = useMemo(
    () => new Map(squad.map((p) => [p.id, p])),
    [squad]
  );

  const allItems = useMemo(() => {
    const items = report?.items ?? [];
    return [...items].sort(
      (a, b) =>
        b.deltaOvr - a.deltaOvr ||
        Number(Boolean(b.exceededExpectations)) -
          Number(Boolean(a.exceededExpectations)) ||
        b.newOvr - a.newOvr
    );
  }, [report]);

  if (!isOpen || !report) return null;

  return (
    <div
      data-testid="new-season-evolution-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Relatório de Evolução da Temporada ${report.toYear}`}
      onClick={onClose}
      className="fixed inset-0 z-[55] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-market-backdrop-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[92vh] bg-[#0e1016] border border-white/[0.12] rounded-[26px] shadow-[0_28px_90px_rgba(0,0,0,0.82)] overflow-hidden flex flex-col animate-market-deal-card-in"
      >
        {/* Compact Header — direct to full player list */}
        <div className="relative px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/[0.08] bg-[#14171f] shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <ClubBadge
                clubId={userClub.id}
                abbr={userClub.abbr}
                name={userClub.name}
                primaryColor={userClub.primaryColor}
                size="md"
              />
              <div className="min-w-0">
                <div className="text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-[#b5ff00]">
                  Pré-Temporada {report.toYear} · {allItems.length} atletas
                </div>
                <h2 className="font-display text-lg sm:text-2xl font-extrabold uppercase tracking-tight text-white leading-tight mt-0.5 truncate">
                  Evolução do Elenco ({report.fromYear} → {report.toYear})
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar relatório de evolução"
              className="p-2 rounded-full bg-white/[0.07] hover:bg-white/[0.14] text-zinc-300 hover:text-white transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Full Scrollable Player Evolution List */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3.5 space-y-2">
          {allItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-zinc-400">
              Nenhum atleta registrado neste relatório.
            </div>
          ) : (
            allItems.map((item) => {
              const livePlayer = squadById.get(item.playerId) || null;
              const statusMeta = getStatusMeta(item);
              const starDelta =
                item.oldPotentialStars !== undefined &&
                item.oldPotentialStars !== item.potentialStars;
              const starRose =
                item.oldPotentialStars !== undefined &&
                item.potentialStars > item.oldPotentialStars;
              const valueDiff =
                item.oldMarketValue !== undefined &&
                item.newMarketValue !== undefined
                  ? item.newMarketValue - item.oldMarketValue
                  : null;

              const rowBorder = item.exceededExpectations
                ? 'border-amber-400/35 bg-amber-950/15'
                : item.deltaOvr > 0
                ? 'border-[#b5ff00]/25 bg-[#14171f]'
                : item.deltaOvr < 0
                ? 'border-rose-500/25 bg-rose-950/15'
                : 'border-white/[0.07] bg-[#14171f]/80';

              return (
                <div
                  key={item.playerId}
                  data-testid="evolution-report-row"
                  className={`rounded-2xl border px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${rowBorder}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <PlayerJersey
                      number={livePlayer?.number ?? item.shirtNumber ?? 10}
                      variant="club"
                      customColor={userClub.primaryColor}
                      size="sm"
                    />
                    <PlayerOvrBadge
                      ovr={item.newOvr}
                      position={item.position}
                      size="md"
                      tone={
                        item.deltaOvr > 0
                          ? 'lime'
                          : item.deltaOvr < 0
                          ? 'rose'
                          : 'dark'
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display text-base sm:text-lg font-extrabold uppercase tracking-tight text-white leading-none truncate">
                          {item.playerName}
                        </span>
                        {item.exceededExpectations && (
                          <Zap
                            className="w-3.5 h-3.5 text-amber-300 shrink-0"
                            aria-label="Superou expectativas"
                          />
                        )}
                        <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                          {item.oldAge}→{item.newAge}a
                        </span>
                        {item.isLoanedOut && (
                          <span className="text-[10px] font-mono font-bold text-sky-300">
                            · Emprestado
                          </span>
                        )}
                        <span
                          className={`text-[11px] font-semibold ${statusMeta.textClass}`}
                        >
                          · {statusMeta.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-zinc-400">
                        <StarRating
                          stars={item.potentialStars}
                          size="xs"
                          showNumeric={false}
                        />
                        {starDelta && (
                          <span
                            className={`font-mono font-bold tabular-nums ${
                              starRose ? 'text-[#b5ff00]' : 'text-amber-300'
                            }`}
                          >
                            ({item.oldPotentialStars}★ → {item.potentialStars}★)
                          </span>
                        )}
                        {item.matchesPlayed !== undefined &&
                          item.matchesPlayed > 0 && (
                            <span className="font-mono tabular-nums text-zinc-400">
                              · {item.matchesPlayed}J
                              {item.goals ? `, ${item.goals}G` : ''}
                              {item.assists ? `, ${item.assists}A` : ''}
                              {item.avgRating
                                ? ` · Nota ${item.avgRating.toFixed(2)}`
                                : ''}
                            </span>
                          )}
                      </div>

                      <p className="text-[11px] text-zinc-300 mt-1 leading-snug">
                        {item.reasonNote}
                      </p>
                    </div>
                  </div>

                  {/* Right Metrics: OVR transition + Market Value + Inspect */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 pl-1 sm:pl-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/[0.06]">
                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      <span className="text-xs text-zinc-400">
                        {item.oldOvr} →{' '}
                        <strong className="text-white text-sm">
                          {item.newOvr}
                        </strong>
                      </span>
                      <span
                        className={`inline-flex items-center gap-0.5 text-sm font-extrabold ${
                          item.deltaOvr > 0
                            ? 'text-[#b5ff00]'
                            : item.deltaOvr < 0
                            ? 'text-rose-400'
                            : 'text-zinc-400'
                        }`}
                      >
                        {item.deltaOvr > 0 ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : item.deltaOvr < 0 ? (
                          <ArrowDownRight className="w-4 h-4" />
                        ) : null}
                        {item.deltaOvr > 0
                          ? `+${item.deltaOvr}`
                          : item.deltaOvr === 0
                          ? '0'
                          : `${item.deltaOvr}`}
                      </span>
                    </div>

                    {item.newMarketValue !== undefined && (
                      <div className="text-[11px] font-mono text-zinc-400 tabular-nums">
                        {formatCompactBRL(item.newMarketValue)}
                        {valueDiff !== null && valueDiff !== 0 && (
                          <span
                            className={`ml-1 font-bold ${
                              valueDiff > 0 ? 'text-[#b5ff00]' : 'text-rose-400'
                            }`}
                          >
                            ({valueDiff > 0 ? '+' : ''}
                            {formatCompactBRL(valueDiff)})
                          </span>
                        )}
                      </div>
                    )}

                    {livePlayer && (
                      <button
                        type="button"
                        onClick={() => onInspectPlayer(livePlayer)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#b5ff00] hover:underline whitespace-nowrap cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Atributos</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Retired players summary block */}
          {report.retiredPlayers.length > 0 && (
            <div className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-950/20 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <Sparkles className="w-4 h-4" />
                <span>
                  Aposentadorias na Virada de Temporada (
                  {report.retiredPlayers.length})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {report.retiredPlayers.map((ret) => (
                  <div
                    key={ret.playerId}
                    className="bg-[#0b0c10] border border-white/[0.06] rounded-xl px-3 py-2 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">
                        {ret.playerName}{' '}
                        <span className="font-mono text-zinc-400 text-[10px]">
                          ({ret.position} · {ret.ageAtRetirement}a)
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {ret.reasonNote}
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-amber-300 tabular-nums shrink-0">
                      OVR {ret.lastOvr}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-4 sm:px-6 py-3.5 bg-[#0b0c10] border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="text-xs text-zinc-400">
            Você pode reabrir este relatório pela Central do Clube a qualquer
            momento.
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onGoToSquad}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#14171f] hover:bg-white/[0.08] text-zinc-200 border border-white/10 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Ir para o Elenco</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <span>Começar {report.toYear}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
