import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  ArrowUpRight,
  Eye,
  UserMinus,
  Clock,
} from 'lucide-react';
import {
  Club,
  Player,
  PositionSector,
  YouthAcademyState,
  YouthInvestmentTier,
  YouthFocusSector,
} from '../types/football';
import { YOUTH_TIERS } from '../engine/youthAcademyEngine';
import { calculatePlayerOverall } from '../engine/playerOverall';
import { formatCompactBRL, formatBRL } from '../utils/formatters';
import { StarRating } from './StarRating';
import { PlayerJersey, PlayerOvrBadge } from './PlayerJersey';

interface YouthAcademyViewProps {
  club: Club;
  academy: YouthAcademyState;
  seasonYear: number;
  onUpdateAcademySettings: (
    tier: YouthInvestmentTier,
    focus: YouthFocusSector
  ) => void;
  onPromoteYouthPlayer: (playerId: string) => void;
  onReleaseYouthPlayer: (playerId: string) => void;
  onInspectPlayer: (player: Player) => void;
}

export const YouthAcademyView: React.FC<YouthAcademyViewProps> = ({
  club,
  academy,
  seasonYear,
  onUpdateAcademySettings,
  onPromoteYouthPlayer,
  onReleaseYouthPlayer,
  onInspectPlayer,
}) => {
  const [sectorFilter, setSectorFilter] = useState<
    'ALL' | 'ELIGIBLE_16' | PositionSector
  >('ALL');
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'info';
    text: string;
  } | null>(null);

  const currentTierConfig =
    YOUTH_TIERS.find((t) => t.tier === academy.investmentTier) || YOUTH_TIERS[1];

  const canAfford = club.cashBalance >= currentTierConfig.monthlyCost;
  const youthRoster = academy.youthRoster || [];
  const eligibleCount = youthRoster.filter((p) => p.age >= 16).length;

  const filteredRoster = youthRoster.filter((p) => {
    if (sectorFilter === 'ELIGIBLE_16') return p.age >= 16;
    if (sectorFilter !== 'ALL') return p.sector === sectorFilter;
    return true;
  });

  const handlePromoteClick = (player: Player) => {
    if (player.age < 16) return;
    onPromoteYouthPlayer(player.id);
    setFeedbackBanner({
      type: 'success',
      text: `${player.name} (${player.position}, ${player.age} anos) promovido ao profissional.`,
    });
  };

  const handleReleaseClick = (player: Player) => {
    onReleaseYouthPlayer(player.id);
    setFeedbackBanner({
      type: 'info',
      text: `${player.name} (${player.position}) dispensado da base.`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-3 border-b border-white/[0.07]">
        <div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-white leading-none">
            BASE & SUB-20
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-400 mt-1.5 tabular-nums">
            <span>{seasonYear}</span>
            <span aria-hidden="true">·</span>
            <span>{youthRoster.length} atletas</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#b5ff00] font-semibold">
              {eligibleCount} aptos (16+)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
          <div className="text-left sm:text-right">
            <div className="text-[10px] text-zinc-500 uppercase">Investido</div>
            <div className="font-bold text-white">
              {formatCompactBRL(academy.accumulatedSeasonInvestment)}{' '}
              <span className="text-zinc-400 font-normal">
                ({academy.monthsInvestedThisSeason}m)
              </span>
            </div>
          </div>
          <div className="h-6 w-px bg-white/[0.08] hidden sm:block" />
          <div className="text-left sm:text-right">
            <div className="text-[10px] text-zinc-500 uppercase">Mensal</div>
            <div className="font-bold text-[#b5ff00]">
              {formatBRL(currentTierConfig.monthlyCost)}
            </div>
          </div>
        </div>
      </div>

      {feedbackBanner && (
        <div
          className={`rounded-xl border px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs ${
            feedbackBanner.type === 'success'
              ? 'bg-[#b5ff00]/12 border-[#b5ff00]/40 text-white'
              : 'bg-[#14171f] border-white/15 text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#b5ff00] shrink-0" />
            <span>{feedbackBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-zinc-400 hover:text-white font-semibold shrink-0"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Compact Config Strip: Investment Tiers + Focus Sector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Investment Tiers (8 cols) */}
        <div className="lg:col-span-8 bg-[#14171f] border border-white/[0.07] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-extrabold uppercase tracking-tight text-white">
              Investimento Mensal
            </h3>
            <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
              ~{formatCompactBRL(currentTierConfig.annualEstimate)}/ano
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {YOUTH_TIERS.map((t) => {
              const isSelected = academy.investmentTier === t.tier;
              const probs = t.starProbabilities;

              return (
                <button
                  key={t.tier}
                  type="button"
                  onClick={() =>
                    onUpdateAcademySettings(t.tier, academy.focusSector)
                  }
                  className={`text-left p-3 rounded-xl border transition-colors flex flex-col justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-[#b5ff00]/12 border-[#b5ff00]'
                      : 'bg-[#0b0c10] border-white/[0.07] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-display text-sm font-extrabold uppercase text-white truncate">
                      {t.shortLabel}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#b5ff00] shrink-0" />
                    )}
                  </div>

                  <div className="font-mono text-xs font-bold text-[#b5ff00] tabular-nums">
                    {formatCompactBRL(t.monthlyCost)}/mês
                  </div>

                  <div className="text-[10px] font-mono text-zinc-400 tabular-nums">
                    {t.minRegens}–{t.maxRegens} jovens · OVR {t.minOvr}–{t.maxOvr}
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-1.5 border-t border-white/[0.06] font-mono text-[10px] tabular-nums">
                    <span className="text-zinc-400">3★+ {Math.round(probs.star3_3_5 + probs.star4_4_5 + probs.star5)}%</span>
                    <span className="text-amber-300 text-right">4–4,5★ {probs.star4_4_5}%</span>
                    <span className="text-zinc-500">1–2,5★ {probs.star1_2_5}%</span>
                    <span className="text-[#b5ff00] text-right font-bold">5★ {probs.star5}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Focus Sector (4 cols) */}
        <div className="lg:col-span-4 bg-[#14171f] border border-white/[0.07] rounded-2xl p-4 space-y-3">
          <h3 className="font-display text-base font-extrabold uppercase tracking-tight text-white">
            Foco de Captação
          </h3>

          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                { id: 'EQUILIBRADO', label: 'Equilibrado' },
                { id: 'GOL', label: 'Goleiros' },
                { id: 'DEF', label: 'Defesa' },
                { id: 'MEI', label: 'Meio-Campo' },
                { id: 'ATA', label: 'Ataque' },
              ] as const
            ).map((sec) => {
              const isSelected = academy.focusSector === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() =>
                    onUpdateAcademySettings(academy.investmentTier, sec.id)
                  }
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left flex items-center justify-between cursor-pointer ${
                    sec.id === 'EQUILIBRADO' ? 'col-span-2' : ''
                  } ${
                    isSelected
                      ? 'bg-[#b5ff00] text-[#090a0f] font-bold'
                      : 'bg-[#0b0c10] text-zinc-300 border border-white/[0.07] hover:border-white/20'
                  }`}
                >
                  <span className="whitespace-nowrap">{sec.label}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>

          {!canAfford && (
            <div className="bg-rose-500/12 border border-rose-500/30 rounded-xl p-2.5 flex items-start gap-2 text-[11px] text-rose-200">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>
                Caixa ({formatCompactBRL(club.cashBalance)}) abaixo da parcela mensal ({formatCompactBRL(currentTierConfig.monthlyCost)}).
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Youth Roster Table */}
      <div className="bg-[#14171f] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="px-4 py-3.5 border-b border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
            Plantel da Base ({youthRoster.length})
          </h3>

          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { id: 'ALL', label: `Todos (${youthRoster.length})` },
                { id: 'ELIGIBLE_16', label: `Aptos 16+ (${eligibleCount})` },
                { id: 'GOL', label: 'GOL' },
                { id: 'DEF', label: 'DEF' },
                { id: 'MEI', label: 'MEI' },
                { id: 'ATA', label: 'ATA' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSectorFilter(tab.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  sectorFilter === tab.id
                    ? 'bg-[#b5ff00] text-[#090a0f]'
                    : 'bg-[#0b0c10] text-zinc-400 hover:text-white border border-white/[0.07]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredRoster.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-400 font-mono">
            Nenhum atleta neste filtro.
          </div>
        ) : (
          <>
            {/* Mobile Compact Youth Cards (< md) */}
            <div className="md:hidden divide-y divide-white/[0.06]">
              {filteredRoster.map((player) => {
                const ovr = calculatePlayerOverall(
                  player.attributes,
                  player.position
                );
                const canPromote = player.age >= 16;
                const delta = player.recentOvrDelta ?? 0;

                return (
                  <div key={player.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <PlayerJersey
                          number={player.number}
                          variant={canPromote ? 'lime' : 'white'}
                          size="sm"
                        />
                        <PlayerOvrBadge
                          ovr={ovr}
                          position={player.position}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => onInspectPlayer(player)}
                              className="font-bold text-sm text-white hover:text-[#b5ff00] text-left truncate"
                            >
                              {player.name}
                            </button>
                            <span className="text-xs font-mono font-bold text-zinc-200 tabular-nums">
                              · {player.age}a
                            </span>
                            {delta > 0 && (
                              <span className="text-[11px] font-mono font-bold text-[#b5ff00] tabular-nums">
                                +{delta}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <StarRating
                              stars={player.potentialStars}
                              player={player}
                              ovr={ovr}
                              clubReputation={club.reputation}
                              size="xs"
                            />
                            <span className="text-[11px] font-mono text-amber-300 font-bold tabular-nums">
                              {player.potentialStars ?? 3}★
                            </span>
                            <span className="text-[11px] font-mono text-zinc-400">
                              · {canPromote ? 'Sub-20' : 'Sub-17'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono tabular-nums shrink-0">
                        <div className="text-xs font-bold text-white">
                          {formatCompactBRL(player.marketValue)}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {formatCompactBRL(player.salary)}/mês
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onInspectPlayer(player)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/[0.07] text-white text-[11px] font-semibold flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3 text-[#b5ff00]" />
                        <span>Perfil</span>
                      </button>
                      <button
                        type="button"
                        disabled={!canPromote}
                        onClick={() => handlePromoteClick(player)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1 ${
                          canPromote
                            ? 'bg-[#b5ff00] text-[#090a0f]'
                            : 'bg-zinc-800/80 text-zinc-500 cursor-not-allowed'
                        }`}
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>{canPromote ? 'Promover' : '16a+'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReleaseClick(player)}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/12 hover:bg-rose-500/22 text-rose-300 border border-rose-500/30 text-[11px] font-bold flex items-center gap-1"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        <span>Dispensar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Analytical Table (md+) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.07] bg-[#0b0c10]/60 text-[11px] text-zinc-400">
                    <th className="py-2.5 px-4 font-medium">Atleta · OVR · Posição</th>
                    <th className="py-2.5 px-2 font-medium">Base</th>
                    <th className="py-2.5 px-3 font-medium">Potencial</th>
                    <th className="py-2.5 px-2 font-medium text-right" title="Passe">PAS</th>
                    <th className="py-2.5 px-2 font-medium text-right" title="Finalização">FIN</th>
                    <th className="py-2.5 px-2 font-medium text-right" title="Drible">DRI</th>
                    <th className="py-2.5 px-2 font-medium text-right" title="Desarme">DES</th>
                    <th className="py-2.5 px-2 font-medium text-right" title="Velocidade">VEL</th>
                    <th className="py-2.5 px-3 font-medium text-right">Valor / Bolsa</th>
                    <th className="py-2.5 px-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {filteredRoster.map((player) => {
                    const ovr = calculatePlayerOverall(
                      player.attributes,
                      player.position
                    );
                    const canPromote = player.age >= 16;
                    const delta = player.recentOvrDelta ?? 0;

                    return (
                      <tr
                        key={player.id}
                        className="hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <PlayerJersey
                              number={player.number}
                              variant={canPromote ? 'lime' : 'white'}
                              size="sm"
                            />
                            <PlayerOvrBadge
                              ovr={ovr}
                              position={player.position}
                              size="md"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => onInspectPlayer(player)}
                                  className="font-bold text-sm text-white hover:text-[#b5ff00] text-left transition-colors truncate"
                                >
                                  {player.name}
                                </button>
                                <span className="font-mono font-bold text-xs text-zinc-200 tabular-nums shrink-0">
                                  {player.age} anos
                                </span>
                                {delta > 0 && (
                                  <span className="font-mono font-bold text-[11px] text-[#b5ff00] tabular-nums shrink-0">
                                    +{delta} OVR
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-2 whitespace-nowrap font-mono text-[11px]">
                          {canPromote ? (
                            <span className="text-[#b5ff00] font-semibold">
                              Sub-20
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-300">
                              <Clock className="w-3 h-3" />
                              Sub-17
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <StarRating
                              stars={player.potentialStars}
                              player={player}
                              ovr={ovr}
                              clubReputation={club.reputation}
                              size="xs"
                            />
                            <span className="text-[11px] font-mono text-amber-300 font-bold tabular-nums">
                              {player.potentialStars ?? 3}★
                            </span>
                          </div>
                        </td>

                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-zinc-300">
                          {player.attributes.passe}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-zinc-300">
                          {player.attributes.finalizacao}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-zinc-300">
                          {player.attributes.drible}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-zinc-300">
                          {player.attributes.desarme}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-zinc-300">
                          {player.attributes.velocidade}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <div className="text-white font-semibold">
                            {formatCompactBRL(player.marketValue)}
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            {formatCompactBRL(player.salary)}/mês
                          </div>
                        </td>

                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onInspectPlayer(player)}
                              className="px-2.5 py-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.14] text-white text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                            >
                              <Eye className="w-3 h-3 text-[#b5ff00]" />
                              <span>Perfil</span>
                            </button>

                            <button
                              type="button"
                              disabled={!canPromote}
                              onClick={() => handlePromoteClick(player)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1 whitespace-nowrap transition-colors ${
                                canPromote
                                  ? 'bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] cursor-pointer'
                                  : 'bg-zinc-800/80 text-zinc-500 cursor-not-allowed'
                              }`}
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              <span>{canPromote ? 'Promover' : '16a+'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleReleaseClick(player)}
                              title="Dispensar da base"
                              className="px-2.5 py-1.5 rounded-lg bg-rose-500/12 hover:bg-rose-500/22 text-rose-300 border border-rose-500/30 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap transition-colors cursor-pointer"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                              <span>Dispensar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
