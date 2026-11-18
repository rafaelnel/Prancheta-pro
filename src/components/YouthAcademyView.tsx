import React, { useState } from 'react';
import {
  GraduationCap,
  ShieldAlert,
  Award,
  CheckCircle2,
  ArrowUpRight,
  Eye,
  UserMinus,
  Clock,
  Sparkles,
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
  const [sectorFilter, setSectorFilter] = useState<'ALL' | 'ELIGIBLE_16' | PositionSector>('ALL');
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
      text: `${player.name} (${player.position}, ${player.age} anos) foi promovido ao elenco profissional do ${club.shortName}!`,
    });
  };

  const handleReleaseClick = (player: Player) => {
    onReleaseYouthPlayer(player.id);
    setFeedbackBanner({
      type: 'info',
      text: `${player.name} (${player.position}) foi liberado das categorias de base Sub-20.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-white/[0.07]">
        <div>
          <span className="block text-xs sm:text-sm font-normal text-zinc-400 tracking-wide">
            Investimento realista, probabilidades reais de estrelas e transição Sub-20 → Profissional (16+ anos) · {seasonYear}
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-[0.95] mt-0.5">
            BASE & SUB-20 ({youthRoster.length})
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 bg-[#14171f] border border-white/[0.08] rounded-2xl px-4 py-2.5">
            <GraduationCap className="w-5 h-5 text-[#b5ff00]" />
            <div>
              <div className="text-[10px] font-mono text-zinc-400 uppercase">
                Investido na Temporada
              </div>
              <div className="font-mono font-bold text-white text-sm tabular-nums">
                {formatCompactBRL(academy.accumulatedSeasonInvestment)}{' '}
                <span className="text-zinc-400 font-normal">
                  ({academy.monthsInvestedThisSeason}m)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-[#b5ff00]/15 border border-[#b5ff00]/40 rounded-2xl px-4 py-2.5">
            <Sparkles className="w-4 h-4 text-[#b5ff00]" />
            <div>
              <div className="text-[10px] font-mono text-[#b5ff00] uppercase font-bold">
                Aptos a Subir (16+ anos)
              </div>
              <div className="font-mono font-extrabold text-white text-sm tabular-nums">
                {eligibleCount} de {youthRoster.length} atletas na base
              </div>
            </div>
          </div>
        </div>
      </div>

      {feedbackBanner && (
        <div
          className={`rounded-2xl border px-4 py-3 flex items-center justify-between gap-3 text-xs ${
            feedbackBanner.type === 'success'
              ? 'bg-[#b5ff00]/15 border-[#b5ff00]/50 text-white'
              : 'bg-[#14171f] border-white/15 text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-[#b5ff00] shrink-0" />
            <span>{feedbackBanner.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-zinc-400 hover:text-white font-bold"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Main Configuration Grid: Monthly Investment Tiers + Focus Sector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tier Selector (8 cols) */}
        <div className="lg:col-span-8 bg-[#14171f] border border-white/[0.07] rounded-[28px] p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
                Estrutura & Investimento Mensal na Base
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Valores mensais compatíveis com a realidade do futebol brasileiro e taxas reais de revelação (sem inflar o time apenas com 5★).
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#b5ff00] shrink-0">
              Custo atual: {formatBRL(currentTierConfig.monthlyCost)}/mês
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {YOUTH_TIERS.map((t) => {
              const isSelected = academy.investmentTier === t.tier;
              const probs = t.starProbabilities;

              return (
                <button
                  key={t.tier}
                  type="button"
                  onClick={() => onUpdateAcademySettings(t.tier, academy.focusSector)}
                  className={`text-left p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 relative ${
                    isSelected
                      ? 'bg-[#b5ff00]/15 border-[#b5ff00] shadow-md ring-1 ring-[#b5ff00]'
                      : 'bg-[#0b0c10] border-white/[0.08] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-display text-base font-extrabold uppercase text-white">
                        {t.label}
                      </div>
                      <div className="text-[11px] text-[#b5ff00] font-mono font-bold mt-0.5">
                        {formatBRL(t.monthlyCost)} / mês{' '}
                        <span className="text-zinc-400 font-normal">
                          (~{formatCompactBRL(t.annualEstimate)}/ano)
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="w-6 h-6 rounded-full bg-[#b5ff00] text-[#090a0f] flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {t.description}
                  </p>

                  {/* Realistic Star Probability Breakdown Bar */}
                  <div className="bg-[#14171f]/90 border border-white/[0.06] rounded-xl p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span>CHANCE REAL POR SAFRA:</span>
                      <span className="text-white font-bold">
                        {t.minRegens} a {t.maxRegens} jovens · OVR {t.minOvr}–{t.maxOvr}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px]">
                      <div className="bg-[#0b0c10] rounded-lg py-1 px-1 text-zinc-400">
                        <div className="text-[9px] text-zinc-500">1–2★ Base</div>
                        <div className="font-bold text-zinc-300">{probs.star1_2}%</div>
                      </div>
                      <div className="bg-[#0b0c10] rounded-lg py-1 px-1 text-zinc-200">
                        <div className="text-[9px] text-zinc-400">3★ Útil</div>
                        <div className="font-bold text-white">{probs.star3}%</div>
                      </div>
                      <div className="bg-[#0b0c10] rounded-lg py-1 px-1 text-amber-300">
                        <div className="text-[9px] text-amber-400/80">4★ Destaque</div>
                        <div className="font-bold">{probs.star4}%</div>
                      </div>
                      <div className="bg-[#0b0c10] rounded-lg py-1 px-1 text-[#b5ff00]">
                        <div className="text-[9px] text-[#b5ff00]/80">5★ Joia</div>
                        <div className="font-bold">{probs.star5}%</div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Focus Sector & Rules Summary (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] p-5 sm:p-6 space-y-4">
            <div>
              <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
                Setor Prioritário de Olheiros
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                75% das novas captações da temporada virão do setor escolhido abaixo para suprir carências do seu elenco.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(
                [
                  { id: 'EQUILIBRADO', label: 'Equilibrado (Todos)' },
                  { id: 'GOL', label: 'Goleiros (GOL)' },
                  { id: 'DEF', label: 'Defesa (ZAG / LAT)' },
                  { id: 'MEI', label: 'Meio-Campo (VOL / MEI)' },
                  { id: 'ATA', label: 'Ataque (PD / PE / ATA)' },
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
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#b5ff00] text-[#090a0f] shadow-sm'
                        : 'bg-[#0b0c10] text-zinc-300 border border-white/[0.08] hover:border-white/20'
                    }`}
                  >
                    <span>{sec.label}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {!canAfford && (
              <div className="bg-rose-500/15 border border-rose-500/30 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-rose-200">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>
                  O saldo em caixa ({formatCompactBRL(club.cashBalance)}) está abaixo da parcela mensal ({formatCompactBRL(currentTierConfig.monthlyCost)}). Reduza o nível para evitar bloqueio mensal.
                </span>
              </div>
            )}
          </div>

          <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] p-5 space-y-2.5 text-xs text-zinc-300">
            <div className="flex items-center justify-between">
              <span className="font-display text-base font-extrabold uppercase text-white">
                Regras de Transição (Sub-20)
              </span>
              <Award className="w-4 h-4 text-[#b5ff00]" />
            </div>
            <ul className="space-y-1.5 text-[11px] text-zinc-400 leading-relaxed list-disc pl-4">
              <li>
                <strong className="text-white">Promoção a partir dos 16 anos:</strong>{' '}
                Os atletas captados ficam no elenco Sub-20 abaixo e só sobem ao time principal quando você decidir promovê-los (mínimo 16 anos).
              </li>
              <li>
                <strong className="text-white">Maturação Sub-17 (15 anos):</strong>{' '}
                Jovens de 15 anos permanecem em formação na base e ganham +1 ano e evolução técnica na virada de temporada.
              </li>
              <li>
                <strong className="text-white">Bolsa-Atleta Sub-20:</strong>{' '}
                Salários de base são ~65% menores que contratos seniores, ajudando no controle da folha salarial.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Interactive U-20 Squad Table (Promote 16+ to Senior Team) */}
      <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden">
        <div className="p-5 border-b border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl font-extrabold uppercase tracking-tight text-white">
              Plantel da Base · Sub-17 & Sub-20 ({youthRoster.length} Atletas)
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Avalie os 18 atributos das promessas e promova ao elenco profissional os jogadores a partir de 16 anos que vão ajudar a equipe.
            </p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
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
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
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
          <div className="p-8 text-center text-xs text-zinc-400 font-mono">
            Nenhum jovem encontrado neste filtro. Novas safras de atletas chegam à Base na virada de cada temporada de acordo com o investimento mensal.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.07] bg-[#0b0c10]/60 text-[11px] text-zinc-400">
                  <th className="py-3 px-4 font-medium">Jovem Promessa</th>
                  <th className="py-3 px-2 font-medium">Idade / Categoria</th>
                  <th className="py-3 px-2 font-medium">Pos</th>
                  <th className="py-3 px-2 font-medium text-right">OVR Atual</th>
                  <th className="py-3 px-3 font-medium">Potencial (Teto)</th>
                  <th className="py-3 px-2 font-medium text-right" title="Passe">PAS</th>
                  <th className="py-3 px-2 font-medium text-right" title="Finalização">FIN</th>
                  <th className="py-3 px-2 font-medium text-right" title="Drible">DRI</th>
                  <th className="py-3 px-2 font-medium text-right" title="Desarme">DES</th>
                  <th className="py-3 px-2 font-medium text-right" title="Velocidade">VEL</th>
                  <th className="py-3 px-3 font-medium text-right">Valor / Bolsa</th>
                  <th className="py-3 px-4 font-medium text-right">Decisão Técnica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {filteredRoster.map((player) => {
                  const ovr = calculatePlayerOverall(
                    player.attributes,
                    player.position
                  );
                  const canPromote = player.age >= 16;

                  return (
                    <tr
                      key={player.id}
                      className="hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => onInspectPlayer(player)}
                          className="font-semibold text-white hover:text-[#b5ff00] text-left transition-colors"
                        >
                          {player.name}
                        </button>
                        <div className="text-[11px] text-zinc-400">
                          Safra {player.regenBatchYear || seasonYear} · {player.nationality}
                        </div>
                      </td>

                      <td className="py-3 px-2 whitespace-nowrap">
                        <div className="font-mono font-bold text-white">
                          {player.age} anos
                        </div>
                        {canPromote ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#b5ff00]">
                            ● Sub-20 (Apto 16+)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-300">
                            <Clock className="w-3 h-3" />
                            Sub-17 (Sobe aos 16a)
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-2 font-mono font-bold text-white">
                        {player.position}
                      </td>

                      <td className="py-3 px-2 text-right font-mono tabular-nums font-bold text-[#b5ff00]">
                        {ovr}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <StarRating
                            player={player}
                            ovr={ovr}
                            clubReputation={club.reputation}
                            size="xs"
                          />
                          <span className="text-[11px] font-mono text-zinc-400">
                            ({player.potentialStars ?? 3}★)
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-2 text-right font-mono tabular-nums text-zinc-300">
                        {player.attributes.passe}
                      </td>
                      <td className="py-3 px-2 text-right font-mono tabular-nums text-zinc-300">
                        {player.attributes.finalizacao}
                      </td>
                      <td className="py-3 px-2 text-right font-mono tabular-nums text-zinc-300">
                        {player.attributes.drible}
                      </td>
                      <td className="py-3 px-2 text-right font-mono tabular-nums text-zinc-300">
                        {player.attributes.desarme}
                      </td>
                      <td className="py-3 px-2 text-right font-mono tabular-nums text-zinc-300">
                        {player.attributes.velocidade}
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="text-white font-semibold">
                          {formatCompactBRL(player.marketValue)}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {formatCompactBRL(player.salary)}/mês
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onInspectPlayer(player)}
                            className="px-2.5 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] text-white text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap"
                          >
                            <Eye className="w-3 h-3 text-[#b5ff00]" />
                            <span>Atributos</span>
                          </button>

                          <button
                            type="button"
                            disabled={!canPromote}
                            onClick={() => handlePromoteClick(player)}
                            title={
                              canPromote
                                ? `Promover ${player.name} ao elenco profissional`
                                : 'Apenas atletas com 16 anos ou mais podem subir ao profissional'
                            }
                            className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold flex items-center gap-1 whitespace-nowrap transition-colors ${
                              canPromote
                                ? 'bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] shadow-sm'
                                : 'bg-zinc-800/80 text-zinc-500 cursor-not-allowed'
                            }`}
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>
                              {canPromote ? 'Subir p/ Profissional' : 'Aguardar 16a'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReleaseClick(player)}
                            title="Dispensar jovem da base Sub-20"
                            className="p-1.5 rounded-full bg-[#0b0c10] hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 border border-white/10 transition-colors"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
