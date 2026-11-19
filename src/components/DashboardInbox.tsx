import React from 'react';
import {
  Mail,
  MailOpen,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Trophy,
  UserCheck,
  MapPin,
  Sliders,
  Play,
  Target,
  AlertTriangle,
  FastForward,
} from 'lucide-react';
import {
  Club,
  CompetitionType,
  InboxMessage,
  IncomingTransferOffer,
  LibertadoresState,
  NavigationTab,
  Player,
  RoundFixture,
  StandingsRow,
} from '../types/football';
import { IncomingOfferAction } from '../engine/aiMarketEngine';
import { getTransferWindowStatus } from '../engine/transferEngine';
import { formatCompactBRL } from '../utils/formatters';
import { calculateTeamTacticalRatings } from '../engine/matchEngine';
import {
  generateOpponentScoutingSummary,
  resolveOpponentStandingsContext,
} from '../engine/opponentScout';
import { ClubBadge } from './ClubBadge';
import { PlayerOvrBadge } from './PlayerJersey';
import { IncomingOfferCard } from './IncomingOfferCard';

interface DashboardInboxProps {
  messages: InboxMessage[];
  onMarkMessageRead: (id: string) => void;
  onNavigate: (tab: NavigationTab) => void;
  onInspectPlayer: (player: Player) => void;
  onQuickSwapFatiguedPlayer: () => void;
  userClub: Club;
  nextFixture: RoundFixture | undefined;
  opponentClub: Club | undefined;
  standings: StandingsRow[];
  secondaryStandings?: StandingsRow[];
  libertadores?: LibertadoresState;
  clubs: Club[];
  squad: Player[];
  currentRound: number;
  activeCompetition?: CompetitionType;
  competitionLabel?: string;
  isMatchDay: boolean;
  onGoToMatch: () => void;
  onQuickSimulateMatch?: () => void;
  pendingOffers?: IncomingTransferOffer[];
  dayOffset?: number;
  seasonYear?: number;
  onResolveIncomingOffer?: (
    offerId: string,
    action: IncomingOfferAction
  ) => void;
}

export const DashboardInbox: React.FC<DashboardInboxProps> = ({
  messages,
  onMarkMessageRead,
  onNavigate,
  onInspectPlayer,
  onQuickSwapFatiguedPlayer,
  userClub,
  nextFixture,
  opponentClub,
  standings,
  secondaryStandings,
  libertadores,
  clubs,
  squad,
  currentRound,
  activeCompetition = 'BRASILEIRAO',
  competitionLabel,
  isMatchDay,
  onGoToMatch,
  onQuickSimulateMatch,
  pendingOffers = [],
  dayOffset = 0,
  seasonYear = 2026,
  onResolveIncomingOffer,
}) => {
  const windowStatus = getTransferWindowStatus(dayOffset);
  const [selectedMsgId, setSelectedMsgId] = React.useState<string>(
    messages[0]?.id || ''
  );
  const [mobileReadingOpen, setMobileReadingOpen] =
    React.useState<boolean>(false);
  const [matchCardTab, setMatchCardTab] = React.useState<'PROJECTION' | 'SCOUT'>(
    'PROJECTION'
  );

  const selectedMessage =
    messages.find((m) => m.id === selectedMsgId) || messages[0];

  const handleSelectMessage = (id: string) => {
    setSelectedMsgId(id);
    onMarkMessageRead(id);
    setMobileReadingOpen(true);
  };

  const userRatings = calculateTeamTacticalRatings(
    squad,
    userClub.formation,
    userClub.instructions
  );

  const clubMap = new Map(clubs.map((c) => [c.id, c]));
  const userStandingIndex = standings.findIndex(
    (s) => s.clubId === userClub.id
  );
  const opponentStandingIndex = opponentClub
    ? standings.findIndex((s) => s.clubId === opponentClub.id)
    : -1;

  const opponentScoutReport = React.useMemo(() => {
    if (!opponentClub) return null;
    const { table, label } = resolveOpponentStandingsContext({
      opponentClub,
      userClub,
      activeCompetition,
      standings,
      secondaryStandings,
      libertadores,
    });
    return generateOpponentScoutingSummary({
      opponentClub,
      userClub,
      opponentTable: table,
      tableLabel: label,
      userSquad: squad,
      nextFixture,
    });
  }, [
    opponentClub,
    userClub,
    activeCompetition,
    standings,
    secondaryStandings,
    libertadores,
    squad,
    nextFixture,
  ]);

  // Dynamic medical quick-swap resolution for any club
  const relatedFatiguedPlayer = selectedMessage?.relatedPlayerId
    ? squad.find((p) => p.id === selectedMessage.relatedPlayerId)
    : undefined;
  const healthySubstituteCandidate = relatedFatiguedPlayer
    ? squad.find(
        (p) =>
          !p.isStarter &&
          !p.injured &&
          p.sector === relatedFatiguedPlayer.sector &&
          p.condition >= 85
      ) || squad.find((p) => !p.isStarter && !p.injured)
    : undefined;

  // Compute match probability tiles (Home / Draw / Away) based on tactical ratings
  const userOverall =
    (userRatings.attack + userRatings.midfield + userRatings.defense) / 3;
  const oppOverall = opponentClub
    ? (opponentClub.overallAttack +
        opponentClub.overallMidfield +
        opponentClub.overallDefense) /
      3
    : 15;
  const diff =
    userOverall -
    oppOverall +
    (nextFixture?.homeClubId === userClub.id ? 2.0 : -0.9);
  const userWinProb = Math.min(68, Math.max(22, Math.round(44 + diff * 2.1)));
  const drawProb = 24;
  const oppWinProb = Math.max(10, 100 - userWinProb - drawProb);

  const resolvedCompLabel =
    competitionLabel ||
    `Brasileirão Série ${userClub.division} · ${currentRound}ª Rodada`;

  const shortCompLabel =
    activeCompetition === 'COPA_DO_BRASIL'
      ? `COPA DO BRASIL · ${nextFixture?.stageLabel || 'MATA-MATA'}`
      : activeCompetition === 'LIBERTADORES'
      ? `LIBERTADORES · ${nextFixture?.stageLabel || 'GRUPOS'}`
      : `SÉRIE ${userClub.division} · R${currentRound}`;

  const unreadCount = messages.filter((m) => !m.read).length;

  const renderComparisonBar = (
    label: string,
    userVal: number,
    oppVal: number
  ) => {
    const userAdvantage = userVal >= oppVal;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span
            className={`font-mono tabular-nums font-bold ${
              userAdvantage ? 'text-[#b5ff00]' : 'text-zinc-300'
            }`}
          >
            {Math.round(userVal)}
          </span>
          <span className="text-zinc-400 text-[11px]">{label} (60–99)</span>
          <span
            className={`font-mono tabular-nums font-bold ${
              !userAdvantage ? 'text-amber-400' : 'text-zinc-300'
            }`}
          >
            {Math.round(oppVal)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 h-2">
          <div className="bg-[#0b0c10] rounded-l-full overflow-hidden flex justify-end">
            <div
              className="bg-[#b5ff00] h-full rounded-l-full"
              style={{ width: `${Math.min(100, Math.max(8, (userVal / 99) * 100))}%` }}
            />
          </div>
          <div className="bg-[#0b0c10] rounded-r-full overflow-hidden">
            <div
              className="bg-zinc-200 h-full rounded-r-full"
              style={{ width: `${Math.min(100, Math.max(8, (oppVal / 99) * 100))}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Clean Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-white/[0.07]">
        <div>
          <span className="block text-xs sm:text-sm font-normal text-zinc-400 tracking-wide">
            Comando técnico · Próximo compromisso & comunicação interna
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-[0.95] mt-0.5">
            CENTRAL DO CLUBE
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('tactics')}
            className="px-3.5 py-2 rounded-full text-xs font-bold bg-[#14171f] hover:bg-white/[0.08] text-zinc-200 border border-white/10 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Sliders className="w-3.5 h-3.5 text-[#b5ff00]" />
            <span>Prancheta ({userClub.formation})</span>
          </button>
          <button
            type="button"
            onClick={onGoToMatch}
            className="px-4 py-2 rounded-full text-xs font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Ir para o Jogo ({currentRound}ªR)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Unified Match Ticket + Integrated Opponent Scout + G-6 Standings (5 cols) */}
        <div className="xl:col-span-5 space-y-6">
          {opponentClub && nextFixture && (
            <div className="rounded-[28px] overflow-hidden border border-white/10 shadow-2xl bg-[#14171f]">
              {/* Upper Half: Electric Lime Gradient Header with Club Badges & Black VS Circle */}
              <div className="bg-gradient-to-b from-[#b5ff00] to-[#8fd400] px-5 pt-5 pb-6 text-[#090a0f] relative">
                <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase tracking-wider text-[#090a0f]/75 mb-3">
                  <span className="truncate pr-2">{resolvedCompLabel}</span>
                  <span className="shrink-0">
                    {isMatchDay ? 'HOJE · DIA DE JOGO' : 'PRÓXIMO CONFRONTO'}
                  </span>
                </div>

                <div className="grid grid-cols-3 items-center text-center">
                  {/* User Club */}
                  <div className="flex flex-col items-center">
                    <ClubBadge
                      clubId={userClub.id}
                      abbr={userClub.abbr}
                      name={userClub.name}
                      primaryColor={userClub.primaryColor}
                      size="lg"
                      surface="light"
                    />
                    <div className="font-display font-extrabold text-base uppercase tracking-tight leading-tight mt-2 text-[#090a0f]">
                      {userClub.shortName}
                    </div>
                    <div className="text-[11px] font-mono font-bold text-[#090a0f]/75">
                      {userStandingIndex + 1}º · {userClub.formation}
                    </div>
                  </div>

                  {/* Center VS Circle */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-11 h-11 rounded-full bg-[#0b0c10] text-white font-display font-extrabold text-sm flex items-center justify-center shadow-md">
                      VS
                    </div>
                    <div className="text-[11px] font-semibold text-[#090a0f]/80 mt-1.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>
                        {nextFixture.homeClubId === userClub.id
                          ? 'Casa'
                          : 'Fora'}
                      </span>
                    </div>
                  </div>

                  {/* Opponent Club */}
                  <div className="flex flex-col items-center">
                    <ClubBadge
                      clubId={opponentClub.id}
                      abbr={opponentClub.abbr}
                      name={opponentClub.name}
                      primaryColor={opponentClub.primaryColor}
                      size="lg"
                      surface="light"
                    />
                    <div className="font-display font-extrabold text-base uppercase tracking-tight leading-tight mt-2 text-[#090a0f]">
                      {opponentClub.shortName}
                    </div>
                    <div className="text-[11px] font-mono font-bold text-[#090a0f]/75">
                      {opponentClub.countryCode
                        ? `${opponentClub.countryCode} · ${opponentClub.formation}`
                        : opponentStandingIndex >= 0
                        ? `${opponentStandingIndex + 1}º · ${opponentClub.formation}`
                        : `Série ${opponentClub.division} · ${opponentClub.formation}`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Lower Half: Crisp Light Ticket Stub with Kickoff Time & Metadata */}
              <div className="bg-gradient-to-b from-white to-zinc-200 px-5 py-3.5 text-[#090a0f] flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                    Competição
                  </div>
                  <div className="font-display font-extrabold text-sm sm:text-base uppercase tracking-tight text-[#090a0f]">
                    {shortCompLabel}
                  </div>
                </div>

                <div className="text-center px-3 border-x border-zinc-300/80">
                  <div className="font-display font-extrabold text-2xl sm:text-3xl leading-none tracking-tight text-[#090a0f] tabular-nums">
                    {activeCompetition === 'BRASILEIRAO' ? '16:00' : '21:30'}
                  </div>
                  <div className="text-[11px] font-medium text-zinc-600 mt-0.5 truncate max-w-[130px] sm:max-w-none">
                    {nextFixture.homeClubId === userClub.id
                      ? userClub.stadium
                      : opponentClub.stadium}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                    Favoritismo
                  </div>
                  <div className="font-display font-extrabold text-sm sm:text-base uppercase tracking-tight text-[#090a0f] tabular-nums">
                    1X2 {userClub.abbr}
                  </div>
                </div>
              </div>

              {/* Integrated Match Card Body with Sub-Tabs: Projeção & 1X2 | Raio-X do Adversário */}
              <div className="p-4 sm:p-5 space-y-4 bg-[#14171f]">
                {opponentScoutReport && (
                  <div className="grid grid-cols-2 gap-1 bg-[#0b0c10] p-1 rounded-xl border border-white/[0.07]">
                    <button
                      type="button"
                      onClick={() => setMatchCardTab('PROJECTION')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                        matchCardTab === 'PROJECTION'
                          ? 'bg-[#b5ff00] text-[#090a0f] font-extrabold'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span>Comparativo & 1X2</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchCardTab('SCOUT')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                        matchCardTab === 'SCOUT'
                          ? 'bg-[#b5ff00] text-[#090a0f] font-extrabold'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <Target className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Raio-X & Pontos Fracos (
                        {opponentScoutReport.weaknesses.length})
                      </span>
                    </button>
                  </div>
                )}

                {matchCardTab === 'PROJECTION' || !opponentScoutReport ? (
                  <>
                    {/* 3-Tile Probability Strip */}
                    <div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-[#b5ff00] text-[#090a0f] rounded-2xl p-3 flex flex-col justify-between min-h-[64px]">
                          <span className="text-[10px] font-mono font-bold uppercase opacity-75">
                            Vitória {userClub.abbr}
                          </span>
                          <span className="font-display text-2xl font-extrabold tabular-nums leading-none">
                            {userWinProb}%
                          </span>
                        </div>
                        <div className="bg-white text-[#090a0f] rounded-2xl p-3 flex flex-col justify-between min-h-[64px]">
                          <span className="text-[10px] font-mono font-bold uppercase text-zinc-500">
                            Empate
                          </span>
                          <span className="font-display text-2xl font-extrabold tabular-nums leading-none">
                            {drawProb}%
                          </span>
                        </div>
                        <div className="bg-[#d9ff7a] text-[#090a0f] rounded-2xl p-3 flex flex-col justify-between min-h-[64px]">
                          <span className="text-[10px] font-mono font-bold uppercase opacity-75">
                            Vitória {opponentClub.abbr}
                          </span>
                          <span className="font-display text-2xl font-extrabold tabular-nums leading-none">
                            {oppWinProb}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Strength Comparison Bars */}
                    <div className="space-y-2.5 pt-2 border-t border-white/[0.07]">
                      {renderComparisonBar(
                        'Poder Ofensivo',
                        userRatings.attack,
                        opponentClub.overallAttack
                      )}
                      {renderComparisonBar(
                        'Domínio de Meio-Campo',
                        userRatings.midfield,
                        opponentClub.overallMidfield
                      )}
                      {renderComparisonBar(
                        'Solidez Defensiva',
                        userRatings.defense,
                        opponentClub.overallDefense
                      )}
                    </div>

                    {/* Key Opponent Players */}
                    <div className="pt-2 border-t border-white/[0.07]">
                      <div className="text-xs text-zinc-400 mb-2">
                        Destaques do {opponentClub.shortName} (Mentalidade{' '}
                        <strong className="text-white">
                          {opponentClub.instructions.mentality}
                        </strong>
                        ):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {opponentClub.starPlayers.slice(0, 2).map((sp, i) => (
                          <div
                            key={i}
                            className="bg-[#0b0c10] border border-white/[0.06] rounded-xl px-3 py-2 flex items-center gap-2.5 text-xs"
                          >
                            <PlayerOvrBadge
                              ovr={Math.round(sp.overall)}
                              position={sp.position}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-zinc-100 truncate">
                                {sp.name}
                              </div>
                              <div className="text-[11px] text-zinc-400 truncate">
                                {sp.highlightAttribute}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    {/* Compact Opponent Campaign Row */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-[#0b0c10] border border-white/[0.06] rounded-xl p-2.5">
                        <div className="text-[10px] font-mono uppercase text-zinc-400">
                          Campanha
                        </div>
                        <div className="font-mono text-xs font-bold text-white mt-0.5 tabular-nums">
                          {opponentScoutReport.won}V · {opponentScoutReport.drawn}E ·{' '}
                          {opponentScoutReport.lost}D
                        </div>
                      </div>
                      <div className="bg-[#0b0c10] border border-white/[0.06] rounded-xl p-2.5">
                        <div className="text-[10px] font-mono uppercase text-zinc-400">
                          Gols (Pró/Contra)
                        </div>
                        <div className="font-mono text-xs font-bold text-white mt-0.5 tabular-nums">
                          <span className="text-[#b5ff00]">
                            {opponentScoutReport.goalsFor}
                          </span>
                          /{opponentScoutReport.goalsAgainst} (SG{' '}
                          {opponentScoutReport.goalDifference >= 0
                            ? `+${opponentScoutReport.goalDifference}`
                            : opponentScoutReport.goalDifference}
                          )
                        </div>
                      </div>
                      <div className="bg-[#0b0c10] border border-white/[0.06] rounded-xl p-2.5">
                        <div className="text-[10px] font-mono uppercase text-zinc-400">
                          Forma Recente
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          {opponentScoutReport.recentForm.length > 0 ? (
                            opponentScoutReport.recentForm.map((res, idx) => (
                              <span
                                key={idx}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold ${
                                  res === 'V'
                                    ? 'bg-[#b5ff00]/20 text-[#b5ff00]'
                                    : res === 'E'
                                    ? 'bg-amber-400/20 text-amber-300'
                                    : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {res}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] font-mono text-zinc-400">
                              Estreia
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Analytical Summary */}
                    <div className="bg-[#0b0c10]/80 border border-white/[0.07] rounded-xl p-3 text-xs text-zinc-200 leading-relaxed">
                      {opponentScoutReport.summary}
                    </div>

                    {/* Weaknesses List */}
                    <div className="space-y-2">
                      {opponentScoutReport.weaknesses.map((wk) => (
                        <div
                          key={wk.id}
                          className="bg-[#0b0c10] border border-white/[0.07] rounded-xl p-3 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              {wk.title}
                            </span>
                            <span
                              className={`text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                                wk.severity === 'alta'
                                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                  : 'bg-amber-400/15 text-amber-300 border-amber-400/30'
                              }`}
                            >
                              {wk.severity === 'alta' ? 'Prioridade' : 'Atenção'}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-snug">
                            {wk.evidence}
                          </p>
                          <p className="text-[11px] text-[#b5ff00] font-medium leading-snug">
                            Sugestão: {wk.exploitationTip}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="text-[11px] text-zinc-300 bg-[#0b0c10] border border-[#b5ff00]/25 rounded-xl px-3 py-2">
                      Recomendação da comissão:{' '}
                      <strong className="text-[#b5ff00]">
                        {opponentScoutReport.tacticalRecommendation}
                      </strong>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 pt-1 border-t border-white/[0.07]">
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={onGoToMatch}
                      className="py-3 px-4 rounded-2xl text-xs font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shadow-md"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Assistir Jogo 2D</span>
                    </button>
                    {onQuickSimulateMatch ? (
                      <button
                        onClick={onQuickSimulateMatch}
                        className="py-3 px-4 rounded-2xl text-xs font-extrabold bg-white hover:bg-zinc-200 text-[#090a0f] transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shadow-md"
                      >
                        <FastForward className="w-3.5 h-3.5" />
                        <span>Simular Rápido</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onNavigate('tactics')}
                        className="py-3 px-4 rounded-2xl text-xs font-bold bg-[#0b0c10] hover:bg-white/[0.08] text-zinc-100 border border-white/10 transition-colors whitespace-nowrap"
                      >
                        Ajustar Prancheta
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mini League Table Summary */}
          <div className="bg-[#14171f] border border-white/[0.07] rounded-[24px] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#b5ff00]" />
                <h3 className="font-display text-lg font-extrabold uppercase tracking-tight text-white">
                  Resumo da Tabela (G-6)
                </h3>
              </div>
              <button
                onClick={() => onNavigate('competitions')}
                className="text-xs text-[#b5ff00] hover:underline font-semibold transition-colors"
              >
                Ver 20 Clubes →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.07] text-[11px] text-zinc-400 bg-[#0b0c10]/60">
                    <th className="py-2.5 px-3 font-medium">#</th>
                    <th className="py-2.5 px-2 font-medium">Clube</th>
                    <th className="py-2.5 px-2 font-medium text-right">P</th>
                    <th className="py-2.5 px-2 font-medium text-right">J</th>
                    <th className="py-2.5 px-2 font-medium text-right">V</th>
                    <th className="py-2.5 px-2 font-medium text-right">SG</th>
                    <th className="py-2.5 px-3 font-medium text-right">
                      Forma
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05] font-mono tabular-nums">
                  {standings.slice(0, 6).map((row, index) => {
                    const club = clubMap.get(row.clubId);
                    const isUser = row.clubId === userClub.id;
                    const isOpponent = row.clubId === opponentClub?.id;
                    return (
                      <tr
                        key={row.clubId}
                        className={
                          isUser
                            ? 'bg-[#b5ff00]/10 text-[#b5ff00] font-semibold'
                            : isOpponent
                            ? 'bg-white/[0.05] text-white'
                            : 'hover:bg-white/[0.03] text-zinc-300'
                        }
                      >
                        <td className="py-2.5 px-3 text-zinc-400">
                          {index + 1}
                        </td>
                        <td className="py-2.5 px-2 font-sans max-w-[160px]">
                          <div className="flex items-center gap-2 min-w-0">
                            <ClubBadge
                              clubId={club?.id || row.clubId}
                              abbr={club?.abbr}
                              name={club?.name}
                              primaryColor={club?.primaryColor}
                              size="xs"
                            />
                            <span className="truncate">
                              {club?.shortName || row.clubId}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-white">
                          {row.points}
                        </td>
                        <td className="py-2.5 px-2 text-right text-zinc-400">
                          {row.played}
                        </td>
                        <td className="py-2.5 px-2 text-right text-zinc-400">
                          {row.won}
                        </td>
                        <td className="py-2.5 px-2 text-right text-zinc-300">
                          {row.goalDifference > 0
                            ? `+${row.goalDifference}`
                            : row.goalDifference}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="inline-flex items-center gap-1">
                            {row.form.slice(-3).map((res, idx) => (
                              <span
                                key={idx}
                                className={`text-[10px] font-bold ${
                                  res === 'V'
                                    ? 'text-[#b5ff00]'
                                    : res === 'E'
                                    ? 'text-amber-400'
                                    : 'text-rose-400'
                                }`}
                              >
                                {res}
                              </span>
                            ))}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Coaching Inbox (7 columns on xl) */}
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#b5ff00]" />
                <h3 className="font-display text-lg font-extrabold uppercase tracking-tight text-white">
                  Caixa de Entrada da Comissão Técnica
                </h3>
              </div>
              <span className="text-xs text-zinc-400 font-mono tabular-nums">
                {unreadCount} não lidas · {messages.length} msgs
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-[460px] md:min-h-[540px]">
              {/* Message List (Hidden on mobile when reading a selected message) */}
              <div
                className={`${
                  mobileReadingOpen ? 'hidden md:block' : 'block'
                } md:col-span-5 border-b md:border-b-0 md:border-r border-white/[0.07] divide-y divide-white/[0.05] overflow-y-auto max-h-[460px] md:max-h-[580px]`}
              >
                {messages.map((msg) => {
                  const isSelected = selectedMessage?.id === msg.id;
                  return (
                    <button
                      key={msg.id}
                      onClick={() => handleSelectMessage(msg.id)}
                      className={`w-full text-left p-4 transition-colors flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-white/[0.08]'
                          : 'hover:bg-white/[0.03] bg-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span
                          className={`font-semibold ${
                            msg.priority === 'warning'
                              ? 'text-amber-400'
                              : msg.priority === 'danger'
                              ? 'text-rose-400'
                              : msg.priority === 'positive'
                              ? 'text-[#b5ff00]'
                              : 'text-zinc-400'
                          }`}
                        >
                          {msg.category}
                        </span>
                        <span className="text-zinc-400 font-mono tabular-nums">
                          {msg.date.split('·')[0]}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        {!msg.read ? (
                          <Mail className="w-3.5 h-3.5 text-[#b5ff00] shrink-0 mt-0.5" />
                        ) : (
                          <MailOpen className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                        )}
                        <span
                          className={`text-xs line-clamp-2 ${
                            !msg.read
                              ? 'font-bold text-white'
                              : 'font-normal text-zinc-300'
                          }`}
                        >
                          {msg.subject}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 pl-5 truncate">
                        {msg.sender} · {msg.senderRole}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Message Reading Pane */}
              <div
                className={`${
                  mobileReadingOpen ? 'flex' : 'hidden md:flex'
                } md:col-span-7 p-4 sm:p-6 flex-col justify-between bg-[#0b0c10]/40`}
              >
                {selectedMessage ? (
                  <div className="space-y-4">
                    {/* Mobile Back to List Button */}
                    <button
                      type="button"
                      onClick={() => setMobileReadingOpen(false)}
                      className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.08] text-xs font-bold text-[#b5ff00] mb-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Voltar para lista ({messages.length})</span>
                    </button>

                    <div className="pb-4 border-b border-white/[0.07]">
                      <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
                        <span>
                          {selectedMessage.category} ·{' '}
                          {selectedMessage.senderRole}
                        </span>
                        <span className="font-mono tabular-nums">
                          {selectedMessage.date}
                        </span>
                      </div>
                      <h4 className="text-base sm:text-lg font-bold text-white leading-snug">
                        {selectedMessage.subject}
                      </h4>
                      <div className="text-xs text-[#b5ff00] font-medium mt-1">
                        Remetente: {selectedMessage.sender}
                      </div>
                    </div>

                    <div className="space-y-3 text-xs sm:text-sm text-zinc-300 leading-relaxed">
                      {selectedMessage.body.map((paragraph, i) => (
                        <p key={i}>{paragraph}</p>
                      ))}
                    </div>

                    {selectedMessage.bulletPoints &&
                      selectedMessage.bulletPoints.length > 0 && (
                        <div className="bg-[#0b0c10] border border-white/[0.07] rounded-2xl p-4 space-y-2">
                          <div className="text-xs font-bold text-white">
                            Pontos de Atenção da Comissão:
                          </div>
                          <ul className="space-y-1.5 text-xs text-zinc-300">
                            {selectedMessage.bulletPoints.map((pt, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-[#b5ff00] font-mono font-bold">
                                  ·
                                </span>
                                <span>{pt}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                ) : null}

              {/* Contextual Action Footer inside Inbox Message */}
              {selectedMessage && (
                <div className="pt-4 mt-5 border-t border-white/[0.07] space-y-3">
                  {selectedMessage.relatedOfferId &&
                    onResolveIncomingOffer &&
                    (() => {
                      const matchedOffer = pendingOffers.find(
                        (o) => o.id === selectedMessage.relatedOfferId
                      );
                      if (!matchedOffer) return null;
                      if (matchedOffer.status !== 'PENDING') {
                        return (
                          <div className="rounded-xl bg-[#0b0c10] border border-white/10 px-3 py-2 text-xs text-zinc-300 font-mono">
                            Proposta{' '}
                            {matchedOffer.status === 'ACCEPTED'
                              ? 'aceita'
                              : matchedOffer.status === 'EXPIRED'
                              ? 'expirada (janela encerrada)'
                              : 'recusada'}{' '}
                            ({formatCompactBRL(matchedOffer.offeredFee)}).
                          </div>
                        );
                      }
                      return (
                        <IncomingOfferCard
                          offer={matchedOffer}
                          userClub={userClub}
                          squad={squad}
                          seasonYear={seasonYear}
                          variant="inbox"
                          disabled={!windowStatus.isOpen}
                          disabledReason={
                            !windowStatus.isOpen
                              ? `Janela de transferências fechada — ${windowStatus.description}`
                              : undefined
                          }
                          onResolve={onResolveIncomingOffer}
                          onInspectPlayer={onInspectPlayer}
                        />
                      );
                    })()}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {relatedFatiguedPlayer && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => onInspectPlayer(relatedFatiguedPlayer)}
                          className="px-3.5 py-2 rounded-full text-xs font-semibold bg-white/[0.08] hover:bg-white/[0.14] text-white transition-colors whitespace-nowrap"
                        >
                          Ver Ficha de {relatedFatiguedPlayer.name.split(' ')[0]}
                        </button>
                        {relatedFatiguedPlayer.isStarter ? (
                          <button
                            onClick={onQuickSwapFatiguedPlayer}
                            className="px-3.5 py-2 rounded-full text-xs font-bold bg-amber-400 hover:bg-amber-300 text-[#090a0f] transition-colors flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Poupar {relatedFatiguedPlayer.name.split(' ')[0]}{' '}
                            {healthySubstituteCandidate
                              ? `(Escalar ${healthySubstituteCandidate.name})`
                              : ''}
                          </button>
                        ) : (
                          <span className="text-xs text-[#b5ff00] font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {relatedFatiguedPlayer.name} já foi poupado do time titular
                          </span>
                        )}
                      </div>
                    )}

                    {selectedMessage.actionLabel &&
                      selectedMessage.actionTargetTab && (
                        <button
                          onClick={() =>
                            onNavigate(selectedMessage.actionTargetTab!)
                          }
                          className="ml-auto px-4 py-2 rounded-full text-xs font-bold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <span>{selectedMessage.actionLabel}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};
