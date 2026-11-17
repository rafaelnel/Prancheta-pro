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
} from 'lucide-react';
import { Club, SeasonEndReport } from '../types/football';
import { formatCompactBRL } from '../utils/formatters';
import { ClubBadge } from './ClubBadge';

interface SeasonEndModalProps {
  isOpen: boolean;
  report: SeasonEndReport | null;
  userClub: Club;
  clubs: Club[];
  onClose: () => void;
  onStartNextSeason: () => void;
}

export const SeasonEndModal: React.FC<SeasonEndModalProps> = ({
  isOpen,
  report,
  userClub,
  clubs,
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
              <div className="font-display text-2xl font-extrabold text-[#b5ff00] mt-1 tabular-nums">
                +{formatCompactBRL(report.userSeasonPrize)}
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                Creditada na virada para {nextYear}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                    className="bg-[#0b0c10] border border-white/[0.06] rounded-xl px-3 py-2 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">
                        {evo.playerName} ({evo.position})
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {evo.oldAge}→{evo.newAge} anos · {evo.potentialStars}★
                      </div>
                    </div>
                    <span
                      className={`font-mono font-extrabold tabular-nums flex items-center gap-0.5 ml-2 ${
                        evo.deltaOvr >= 0 ? 'text-[#b5ff00]' : 'text-rose-400'
                      }`}
                    >
                      {evo.deltaOvr >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {evo.deltaOvr >= 0 ? `+${evo.deltaOvr}` : evo.deltaOvr} (
                      {evo.newOvr})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="px-5 sm:px-7 py-4 bg-[#0b0c10] border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-zinc-400">
            A virada de ano atualiza idades (+1), evolução/regressão por
            desempenho e estrelas, patrocínios e tabela de 38 rodadas.
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
