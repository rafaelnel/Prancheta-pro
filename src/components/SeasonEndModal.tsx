import React from 'react';
import {
  Trophy,
  Award,
  Globe2,
  ArrowUpCircle,
  ArrowDownCircle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  X,
  ArrowRight,
  Star,
  Zap,
} from 'lucide-react';
import { Club, SeasonEndReport } from '../types/football';
import { formatCompactBRL } from '../utils/formatters';
import { ClubBadge } from './ClubBadge';

interface SeasonEndModalProps {
  isOpen: boolean;
  report: SeasonEndReport | null;
  userClub: Club;
  clubs: Club[];
  expiringContracts?: import('../types/football').Player[];
  onGoToContracts?: () => void;
  onClose: () => void;
  onStartNextSeason: () => void;
}

export const SeasonEndModal: React.FC<SeasonEndModalProps> = ({
  isOpen,
  report,
  userClub,
  clubs,
  expiringContracts = [],
  onGoToContracts,
  onClose,
  onStartNextSeason,
}) => {
  if (!isOpen || !report) return null;

  const clubMap = new Map(clubs.map((c) => [c.id, c]));
  const nextYear = report.seasonYear + 1;

  const getClub = (id: string | null | undefined) =>
    id ? clubMap.get(id) || null : null;

  const championsCards = [
    {
      competition: `Brasileirão Série A ${report.seasonYear}`,
      club: getClub(report.serieAChampionId),
      fallbackName: report.serieAChampionName,
      accent: 'bg-[#b5ff00] text-[#090a0f]',
      Icon: Trophy,
    },
    {
      competition: `Brasileirão Série B ${report.seasonYear}`,
      club: getClub(report.serieBChampionId),
      fallbackName: report.serieBChampionName,
      accent: 'bg-white text-[#090a0f]',
      Icon: ArrowUpCircle,
    },
    {
      competition: `Copa do Brasil ${report.seasonYear}`,
      club: getClub(report.cdbChampionId),
      fallbackName: report.cdbChampionName || 'Não concluída',
      accent: 'bg-amber-400 text-[#090a0f]',
      Icon: Award,
    },
    {
      competition: `Copa Libertadores ${report.seasonYear}`,
      club: getClub(report.libChampionId),
      fallbackName: report.libChampionName || 'Não concluída',
      accent: 'bg-sky-400 text-[#090a0f]',
      Icon: Globe2,
    },
    ...(report.uclChampionName
      ? [
          {
            competition: `UEFA Champions League ${report.seasonYear}`,
            club: getClub(report.uclChampionId),
            fallbackName: report.uclChampionName,
            accent: 'bg-indigo-400 text-[#090a0f]',
            Icon: Trophy,
          },
        ]
      : []),
    ...(report.mundialChampionName
      ? [
          {
            competition: `Mundial de Clubes ${report.seasonYear}`,
            club: getClub(report.mundialChampionId),
            fallbackName: report.mundialChampionName,
            accent: 'bg-yellow-400 text-[#090a0f]',
            Icon: Award,
          },
        ]
      : []),
    ...(report.superMundialChampionName
      ? [
          {
            competition: `Super Mundial FIFA ${report.seasonYear}`,
            club: getClub(report.superMundialChampionId),
            fallbackName: report.superMundialChampionName,
            accent: 'bg-purple-400 text-[#090a0f]',
            Icon: Globe2,
          },
        ]
      : []),
  ];

  const userSummaryStatus = report.userPromoted
    ? 'Acesso histórico conquistado para a Série A!'
    : report.userRelegated
    ? 'Rebaixamento para a Série B na próxima temporada.'
    : report.userFinalDivision === 'A' && report.userFinalRank === 1
    ? 'Campeão Brasileiro da Série A!'
    : report.userQualifiedLibertadores
    ? 'Classificação garantida para a Copa Libertadores!'
    : `Permanência assegurada na Série ${report.userFinalDivision}.`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`Fim da Temporada ${report.seasonYear}`}
    >
      <div className="w-full max-w-5xl bg-[#111319] border border-white/15 rounded-[28px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Hero Header */}
        <div className="px-5 sm:px-7 py-5 bg-gradient-to-r from-[#b5ff00] to-[#91d800] text-[#090a0f] flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <ClubBadge
              clubId={userClub.id}
              abbr={userClub.abbr}
              name={userClub.name}
              primaryColor={userClub.primaryColor}
              size="lg"
              surface="light"
            />
            <div className="min-w-0">
              <div className="text-[11px] font-mono font-extrabold uppercase tracking-wider opacity-80">
                Encerramento Oficial · Temporada {report.seasonYear}
              </div>
              <h2 className="font-display text-2xl sm:text-4xl font-extrabold uppercase tracking-tight leading-none truncate">
                FIM DE TEMPORADA {report.seasonYear}
              </h2>
              <p className="text-xs sm:text-sm font-bold mt-1 opacity-90 truncate">
                {userClub.shortName}: {report.userFinalRank}º na Série{' '}
                {report.userFinalDivision} ({report.userFinalPoints} pts) ·{' '}
                {userSummaryStatus}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar resumo de fim de temporada"
            className="w-9 h-9 rounded-full bg-[#090a0f]/15 hover:bg-[#090a0f]/25 flex items-center justify-center text-[#090a0f] shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {/* 1. User Campaign & Prize Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-[#14171f] border border-white/[0.08] rounded-2xl p-4">
              <div className="text-[11px] font-mono uppercase text-zinc-400">
                Desempenho do {userClub.shortName}
              </div>
              <div className="font-display text-2xl font-extrabold text-white mt-1 tabular-nums">
                {report.userFinalRank}º Lugar · {report.userFinalPoints} pts
              </div>
              <div className="text-xs text-[#b5ff00] font-semibold mt-1">
                Série {report.userFinalDivision} {report.seasonYear}
              </div>
            </div>

            <div className="bg-[#14171f] border border-white/[0.08] rounded-2xl p-4">
              <div className="text-[11px] font-mono uppercase text-zinc-400">
                Premiação Final da Liga
              </div>
              <div
                className={`font-display text-2xl font-extrabold mt-1 tabular-nums ${
                  report.userSeasonPrize > 0 ? 'text-[#b5ff00]' : 'text-zinc-400'
                }`}
              >
                {report.userSeasonPrize > 0
                  ? `+${formatCompactBRL(report.userSeasonPrize)}`
                  : formatCompactBRL(0)}
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                {report.userSeasonPrize > 0
                  ? `Creditada na virada para ${nextYear}`
                  : 'Rebaixamento na Série A: sem bônus por colocação'}
              </div>
            </div>

            <div className="bg-[#14171f] border border-white/[0.08] rounded-2xl p-4">
              <div className="text-[11px] font-mono uppercase text-zinc-400">
                Vaga Continental {nextYear}
              </div>
              <div className="font-display text-2xl font-extrabold text-white mt-1">
                {report.userQualifiedLibertadores
                  ? 'Copa Libertadores'
                  : 'Copa do Brasil & Liga'}
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                {report.userQualifiedLibertadores
                  ? 'Classificado entre os 8 representantes brasileiros'
                  : 'Participação nacional assegurada'}
              </div>
            </div>
          </div>

          {/* 2. 4 Official Champions */}
          <div className="space-y-2.5">
            <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#b5ff00]" />
              <span>Campeões da Temporada {report.seasonYear}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {championsCards.map((item) => {
                const Icon = item.Icon;
                return (
                  <div
                    key={item.competition}
                    className="bg-[#14171f] border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono uppercase text-zinc-400">
                        {item.competition}
                      </span>
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${item.accent}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.club && (
                        <ClubBadge
                          clubId={item.club.id}
                          abbr={item.club.abbr}
                          name={item.club.name}
                          primaryColor={item.club.primaryColor}
                          size="sm"
                        />
                      )}
                      <div className="font-display text-lg font-extrabold uppercase tracking-tight text-white truncate">
                        {item.club?.shortName || item.fallbackName}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Individual Season Awards */}
          <div className="space-y-2.5">
            <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>Destaques Individuais</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-[#0b0c10] border border-white/[0.08] rounded-2xl p-4">
                <div className="text-[10px] font-mono uppercase text-[#b5ff00] font-bold">
                  Artilheiro da Temporada
                </div>
                {report.awards.topScorer ? (
                  <>
                    <div className="font-display text-xl font-extrabold text-white mt-1 truncate">
                      {report.awards.topScorer.playerName}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5 flex items-center justify-between">
                      <span>
                        {report.awards.topScorer.clubName} ·{' '}
                        {report.awards.topScorer.position}
                      </span>
                      <span className="font-mono font-extrabold text-[#b5ff00] tabular-nums">
                        {report.awards.topScorer.value} gols
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-zinc-500 mt-1">Sem registros</div>
                )}
              </div>

              <div className="bg-[#0b0c10] border border-white/[0.08] rounded-2xl p-4">
                <div className="text-[10px] font-mono uppercase text-sky-400 font-bold">
                  Líder de Assistências
                </div>
                {report.awards.topAssist ? (
                  <>
                    <div className="font-display text-xl font-extrabold text-white mt-1 truncate">
                      {report.awards.topAssist.playerName}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5 flex items-center justify-between">
                      <span>
                        {report.awards.topAssist.clubName} ·{' '}
                        {report.awards.topAssist.position}
                      </span>
                      <span className="font-mono font-extrabold text-sky-400 tabular-nums">
                        {report.awards.topAssist.value} assists
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-zinc-500 mt-1">Sem registros</div>
                )}
              </div>

              <div className="bg-[#0b0c10] border border-white/[0.08] rounded-2xl p-4">
                <div className="text-[10px] font-mono uppercase text-amber-400 font-bold">
                  Craque da Temporada (Nota Média)
                </div>
                {report.awards.bestPlayer ? (
                  <>
                    <div className="font-display text-xl font-extrabold text-white mt-1 truncate">
                      {report.awards.bestPlayer.playerName}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5 flex items-center justify-between">
                      <span>
                        {report.awards.bestPlayer.clubName} · OVR{' '}
                        {report.awards.bestPlayer.ovr}
                      </span>
                      <span className="font-mono font-extrabold text-amber-300 tabular-nums">
                        {report.awards.bestPlayer.value.toFixed(2)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-zinc-500 mt-1">Sem registros</div>
                )}
              </div>
            </div>
          </div>

          {/* 4. Promotion / Relegation / Libertadores Qualifiers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="bg-[#14171f] border border-emerald-500/25 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#b5ff00]">
                <ArrowUpCircle className="w-4 h-4" />
                <span>Promovidos para a Série A ({nextYear})</span>
              </div>
              <div className="space-y-1.5">
                {report.promotedClubIds.map((cid, idx) => {
                  const c = clubMap.get(cid);
                  return (
                    <div
                      key={cid}
                      className="flex items-center gap-2 text-xs bg-[#0b0c10] rounded-xl px-2.5 py-1.5"
                    >
                      <span className="font-mono text-[#b5ff00] font-bold">
                        {idx + 1}º
                      </span>
                      {c && (
                        <ClubBadge
                          clubId={c.id}
                          abbr={c.abbr}
                          name={c.name}
                          primaryColor={c.primaryColor}
                          size="xs"
                        />
                      )}
                      <span className="font-semibold text-white truncate">
                        {c?.shortName || cid}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#14171f] border border-rose-500/25 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
                <ArrowDownCircle className="w-4 h-4" />
                <span>Rebaixados para a Série B ({nextYear})</span>
              </div>
              <div className="space-y-1.5">
                {report.relegatedClubIds.map((cid, idx) => {
                  const c = clubMap.get(cid);
                  return (
                    <div
                      key={cid}
                      className="flex items-center gap-2 text-xs bg-[#0b0c10] rounded-xl px-2.5 py-1.5"
                    >
                      <span className="font-mono text-rose-400 font-bold">
                        {17 + idx}º
                      </span>
                      {c && (
                        <ClubBadge
                          clubId={c.id}
                          abbr={c.abbr}
                          name={c.name}
                          primaryColor={c.primaryColor}
                          size="xs"
                        />
                      )}
                      <span className="font-semibold text-white truncate">
                        {c?.shortName || cid}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#14171f] border border-sky-500/25 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                <Globe2 className="w-4 h-4" />
                <span>Vagas na Libertadores ({nextYear})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {report.libertadoresQualifiedBrIds.map((cid) => {
                  const c = clubMap.get(cid);
                  const isUser = cid === userClub.id;
                  return (
                    <span
                      key={cid}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                        isUser
                          ? 'bg-[#b5ff00]/20 border-[#b5ff00] text-[#b5ff00]'
                          : 'bg-[#0b0c10] border-white/[0.08] text-zinc-200'
                      }`}
                    >
                      {c && (
                        <ClubBadge
                          clubId={c.id}
                          abbr={c.abbr}
                          name={c.name}
                          primaryColor={c.primaryColor}
                          size="xs"
                        />
                      )}
                      <span>{c?.shortName || cid}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 5. Evolution / Regression Preview if available */}
          {report.userEvolutionHighlights.length > 0 && (
            <div className="bg-[#14171f] border border-white/[0.07] rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Sparkles className="w-4 h-4 text-[#b5ff00]" />
                <span>Projeção de Evolução / Regressão no Elenco</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {report.userEvolutionHighlights.slice(0, 6).map((evo) => (
                  <div
                    key={evo.playerId}
                    className={`rounded-xl px-3 py-2 flex items-center justify-between text-xs transition-colors border ${
                      evo.exceededExpectations
                        ? 'bg-amber-950/25 border-amber-400/40'
                        : evo.developmentStatus === 'DECLINIO_TECNICO'
                        ? 'bg-rose-950/20 border-rose-500/30'
                        : 'bg-[#0b0c10] border-white/[0.06]'
                    }`}
                    title={evo.reasonNote}
                  >
                    <div className="min-w-0 pr-1.5">
                      <div className="font-semibold text-white truncate flex items-center gap-1">
                        {evo.exceededExpectations && (
                          <Zap className="w-3 h-3 text-amber-300 shrink-0" />
                        )}
                        <span className="truncate">{evo.playerName}</span>
                        <span className="text-zinc-400 font-mono text-[10px]">({evo.position})</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate flex items-center gap-1">
                        <span>
                          {evo.oldAge}→{evo.newAge}a · {evo.potentialStars}★
                        </span>
                        {evo.growthMultiplier !== undefined && evo.growthMultiplier > 0 && (
                          <span className="font-mono text-zinc-400 text-[9px]" title={`Multiplicador de desempenho: ${evo.growthMultiplier.toFixed(2)}x`}>
                            · {evo.growthMultiplier.toFixed(1)}x
                          </span>
                        )}
                        {evo.exceededExpectations && (
                          <span className="text-amber-300 font-bold">
                            · Superou Teto
                          </span>
                        )}
                        {evo.developmentStatus === 'ESTAGNADO' && evo.deltaOvr === 0 && (
                          <span className="text-zinc-500">
                            · Sem minutos
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`font-mono font-extrabold tabular-nums flex items-center gap-0.5 ml-2 shrink-0 ${
                        evo.exceededExpectations
                          ? 'text-amber-300'
                          : evo.deltaOvr > 0
                          ? 'text-[#b5ff00]'
                          : evo.deltaOvr < 0
                          ? 'text-rose-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      {evo.exceededExpectations ? (
                        <Zap className="w-3 h-3 text-amber-300" />
                      ) : evo.deltaOvr > 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : evo.deltaOvr < 0 ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : (
                        <span className="text-zinc-500">▬</span>
                      )}
                      {evo.deltaOvr > 0 ? `+${evo.deltaOvr}` : evo.deltaOvr} ({evo.newOvr})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. Youth Academy Intake (Safras da Base) if available */}
          {report.promotedYouthRegens && report.promotedYouthRegens.length > 0 && (
            <div className="bg-[#14171f] border border-[#b5ff00]/25 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#b5ff00]">
                <span>Nova Safra Captada na Base (Sub-17 & Sub-20)</span>
                <span className="text-[11px] font-mono text-zinc-400">
                  {report.promotedYouthRegens.length} jovens talentos
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {report.promotedYouthRegens.map((reg) => (
                  <div
                    key={reg.id}
                    className="bg-[#0b0c10] border border-white/[0.06] rounded-xl px-3 py-2 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">
                        {reg.name} ({reg.position})
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {reg.age} anos · Potencial {reg.potentialStars}★
                      </div>
                    </div>
                    <span className="font-mono font-extrabold text-[#b5ff00] ml-2">
                      OVR {reg.ovr}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* 7. Expiring Contracts Alert before Season Rollover */}
          {expiringContracts.length > 0 && (
            <div className="bg-amber-950/35 border border-amber-400/45 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 text-xs">
                <div className="font-bold text-amber-300">
                  ⚠️ {expiringContracts.length} contrato(s) vencendo ao fim de{' '}
                  {report.seasonYear}
                </div>
                <div className="text-zinc-200 leading-relaxed">
                  Atletas sem renovação sairão livres na virada para {nextYear}:{' '}
                  <strong className="text-white">
                    {expiringContracts
                      .slice(0, 5)
                      .map((p) => p.name)
                      .join(', ')}
                    {expiringContracts.length > 5
                      ? ` e mais ${expiringContracts.length - 5}`
                      : ''}
                  </strong>
                  .
                </div>
              </div>
              {onGoToContracts && (
                <button
                  type="button"
                  onClick={onGoToContracts}
                  className="px-4 py-2 rounded-full text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-[#090a0f] transition-colors whitespace-nowrap shrink-0"
                >
                  Renovar Contratos Agora
                </button>
              )}
            </div>
          )}

          {/* 8. Veterans Considering Retirement Notice */}
          {report.thinkingRetirementNames &&
            report.thinkingRetirementNames.length > 0 && (
              <div className="bg-[#14171f] border border-amber-400/35 rounded-2xl p-4 text-xs space-y-1">
                <div className="font-bold text-amber-300">
                  ⏳ Veteranos avaliando aposentadoria na virada para {nextYear}
                </div>
                <div className="text-zinc-300 leading-relaxed">
                  Jogadores de linha a partir dos 35 anos e goleiros a partir dos 40 anos podem anunciar aposentadoria ao encerrar o ano (menor chance para quem segue jogando em alto OVR):{' '}
                  <strong className="text-white">
                    {report.thinkingRetirementNames.join(', ')}
                  </strong>
                  .
                </div>
              </div>
            )}
        </div>

        {/* Footer CTA */}
        <div className="px-5 sm:px-7 py-4 bg-[#0b0c10] border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-zinc-400">
            A virada de ano atualiza idades (+1), contratos/empréstimos, evolução,
            safra da base Sub-20, patrocínios e tabela de 38 rodadas.
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full text-xs font-bold bg-[#14171f] hover:bg-white/[0.08] text-zinc-200 border border-white/10 transition-colors"
            >
              Revisar Tabelas {report.seasonYear}
            </button>
            <button
              type="button"
              onClick={onStartNextSeason}
              className="px-6 py-2.5 rounded-full text-xs sm:text-sm font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center gap-2 shadow-lg"
            >
              <span>Iniciar Nova Temporada {nextYear}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
