import React from 'react';
import {
  Mail,
  MailOpen,
  CheckCircle2,
  ArrowRight,
  Swords,
  Trophy,
  UserCheck,
  MapPin,
  Sliders,
  Users,
  Play,
} from 'lucide-react';
import {
  Club,
  InboxMessage,
  NavigationTab,
  Player,
  RoundFixture,
  StandingsRow,
} from '../types/football';
import { calculateTeamTacticalRatings } from '../engine/matchEngine';
import { getContrastTextColor } from '../utils/formatters';

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
  clubs: Club[];
  squad: Player[];
  currentRound: number;
  isMatchDay: boolean;
  onGoToMatch: () => void;
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
  clubs,
  squad,
  currentRound,
  isMatchDay,
  onGoToMatch,
}) => {
  const [selectedMsgId, setSelectedMsgId] = React.useState<string>(
    messages[0]?.id || ''
  );

  const selectedMessage =
    messages.find((m) => m.id === selectedMsgId) || messages[0];

  const handleSelectMessage = (id: string) => {
    setSelectedMsgId(id);
    onMarkMessageRead(id);
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

  // Other featured fixtures of the round for the reference-inspired dual-tone cards
  const otherClubs = clubs.filter(
    (c) => c.id !== userClub.id && c.id !== opponentClub?.id
  );
  const otherRoundFixtures =
    otherClubs.length >= 2
      ? [
          {
            home: otherClubs[0],
            away: otherClubs[1],
            time: '18:30',
          },
        ]
      : [];

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
    <div className="space-y-6">
      {/* Editorial Section Header + Matchday Preparation Stepper */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-2 border-b border-white/[0.07]">
        <div>
          <span className="block text-xs sm:text-sm font-normal text-zinc-400 tracking-wide">
            Explorar comando técnico
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-[0.95] mt-0.5">
            CENTRAL DO CLUBE
          </h2>
        </div>

        {/* Guided User Workflow Stepper (1. Inbox -> 2. Táticas/Elenco -> 3. Jogo 2D) */}
        <div
          className="flex flex-wrap items-center gap-1.5 bg-[#151821] p-1.5 rounded-full border border-white/[0.07]"
          aria-label="Fluxo de preparação da rodada"
        >
          <button
            onClick={() => onNavigate('inbox')}
            className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#b5ff00] text-[#090a0f] transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>1. Dossiê & Alertas</span>
          </button>
          <button
            onClick={() => onNavigate('tactics')}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Sliders className="w-3.5 h-3.5 text-[#b5ff00]" />
            <span>2. Prancheta ({userClub.formation})</span>
          </button>
          <button
            onClick={() => onNavigate('squad')}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Users className="w-3.5 h-3.5 text-[#b5ff00]" />
            <span>3. Elenco ({squad.length})</span>
          </button>
          <button
            onClick={onGoToMatch}
            className="px-4 py-1.5 rounded-full text-xs font-bold bg-white text-[#090a0f] hover:bg-[#b5ff00] transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>4. Jogo ao Vivo ({currentRound}ªR)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Reference-Inspired Dual-Tone Match Ticket Card + G-6 Standings (5 cols) */}
        <div className="xl:col-span-5 space-y-6">
          {opponentClub && nextFixture && (
            <div className="space-y-4">
              {/* Signature Dual-Tone Match Ticket Card (Exact visual motif from reference Screen 1) */}
              <div className="rounded-[28px] overflow-hidden border border-white/10 shadow-2xl bg-[#14171f]">
                {/* Upper Half: Electric Lime Gradient Header with Club Badges & Black VS Circle */}
                <div className="bg-gradient-to-b from-[#b5ff00] to-[#8fd400] px-5 pt-5 pb-6 text-[#090a0f] relative">
                  <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase tracking-wider text-[#090a0f]/75 mb-3">
                    <span>Brasileirão Série {userClub.division} · {currentRound}ª Rodada</span>
                    <span>
                      {isMatchDay ? 'HOJE · DIA DE JOGO' : 'PRÓXIMO CONFRONTO'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 items-center text-center">
                    {/* User Club */}
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 rounded-2xl bg-[#0b0c10] text-[#b5ff00] flex items-center justify-center font-display font-extrabold text-xl shadow-lg border-2 border-[#0b0c10]/20">
                        {userClub.abbr}
                      </div>
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
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center font-display font-extrabold text-xl shadow-lg border-2 border-white/30"
                        style={{
                          backgroundColor: opponentClub.primaryColor,
                          color: getContrastTextColor(opponentClub.primaryColor),
                        }}
                      >
                        {opponentClub.abbr}
                      </div>
                      <div className="font-display font-extrabold text-base uppercase tracking-tight leading-tight mt-2 text-[#090a0f]">
                        {opponentClub.shortName}
                      </div>
                      <div className="text-[11px] font-mono font-bold text-[#090a0f]/75">
                        {opponentStandingIndex + 1}º · {opponentClub.formation}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lower Half: Crisp Light Ticket Stub with Kickoff Time & Metadata */}
                <div className="bg-gradient-to-b from-white to-zinc-200 px-5 py-4 text-[#090a0f] flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                      Competição
                    </div>
                    <div className="font-display font-extrabold text-base uppercase tracking-tight text-[#090a0f]">
                      SÉRIE {userClub.division} · R{currentRound}
                    </div>
                  </div>

                  <div className="text-center px-3 border-x border-zinc-300/80">
                    <div className="font-display font-extrabold text-3xl leading-none tracking-tight text-[#090a0f] tabular-nums">
                      16:00
                    </div>
                    <div className="text-[11px] font-medium text-zinc-600 mt-0.5">
                      {userClub.stadium}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                      Favoritismo
                    </div>
                    <div className="font-display font-extrabold text-base uppercase tracking-tight text-[#090a0f] tabular-nums">
                      1X2 {userClub.abbr}
                    </div>
                  </div>
                </div>

                {/* Tactical Comparison & Probability Block inside Dark Card Base */}
                <div className="p-5 space-y-4 bg-[#14171f]">
                  {/* 3-Tile Probability Strip (Reference Screen 2 motif: Lime / White / Soft Lime) */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                      <span>Projeção Tática & Forma Recente</span>
                      <span className="font-mono text-[11px] text-zinc-300">
                        {userClub.abbr} vs {opponentClub.abbr}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-[#b5ff00] text-[#090a0f] rounded-2xl p-3 flex flex-col justify-between min-h-[68px]">
                        <span className="text-[10px] font-mono font-bold uppercase opacity-75">
                          Vitória {userClub.abbr}
                        </span>
                        <span className="font-display text-2xl font-extrabold tabular-nums leading-none">
                          {userWinProb}%
                        </span>
                      </div>
                      <div className="bg-white text-[#090a0f] rounded-2xl p-3 flex flex-col justify-between min-h-[68px]">
                        <span className="text-[10px] font-mono font-bold uppercase text-zinc-500">
                          Empate
                        </span>
                        <span className="font-display text-2xl font-extrabold tabular-nums leading-none">
                          {drawProb}%
                        </span>
                      </div>
                      <div className="bg-[#d9ff7a] text-[#090a0f] rounded-2xl p-3 flex flex-col justify-between min-h-[68px]">
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
                          className="bg-[#0b0c10] border border-white/[0.06] rounded-xl px-3 py-2 flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-zinc-100 truncate">
                              {sp.name}
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              {sp.position} · {sp.highlightAttribute}
                            </div>
                          </div>
                          <span className="font-mono tabular-nums font-bold text-[#b5ff00] ml-2">
                            {Math.round(sp.overall)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      onClick={() => onNavigate('tactics')}
                      className="py-3 px-4 rounded-2xl text-xs font-bold bg-[#0b0c10] hover:bg-white/[0.08] text-zinc-100 border border-white/10 transition-colors whitespace-nowrap"
                    >
                      Ajustar Prancheta
                    </button>
                    <button
                      onClick={onGoToMatch}
                      className="py-3 px-4 rounded-2xl text-xs font-extrabold bg-[#b5ff00] hover:bg-[#c8ff33] text-[#090a0f] transition-colors whitespace-nowrap shadow-md"
                    >
                      Ir para o Jogo ({currentRound}ªR)
                    </button>
                  </div>
                </div>
              </div>

              {/* Secondary Silver Match Ticket Card (Reference Screen 1 stacked card motif) */}
              {otherRoundFixtures[0] && (
                <div className="rounded-[24px] bg-gradient-to-b from-zinc-200 to-zinc-300 text-[#090a0f] p-4 shadow-lg flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-extrabold text-sm shrink-0"
                      style={{
                        backgroundColor:
                          otherRoundFixtures[0].home.primaryColor,
                        color: getContrastTextColor(
                          otherRoundFixtures[0].home.primaryColor
                        ),
                      }}
                    >
                      {otherRoundFixtures[0].home.abbr}
                    </div>
                    <div className="min-w-0">
                      <div className="font-display font-extrabold text-sm uppercase truncate">
                        {otherRoundFixtures[0].home.shortName}
                      </div>
                      <div className="text-[11px] text-zinc-600 font-mono">
                        Destaque da Rodada
                      </div>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-full bg-[#0b0c10] text-white font-display font-bold text-xs flex items-center justify-center shrink-0 mx-2">
                    VS
                  </div>

                  <div className="flex items-center gap-3 min-w-0 text-right">
                    <div className="min-w-0">
                      <div className="font-display font-extrabold text-sm uppercase truncate">
                        {otherRoundFixtures[0].away.shortName}
                      </div>
                      <div className="text-[11px] text-zinc-600 font-mono">
                        {otherRoundFixtures[0].time}
                      </div>
                    </div>
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-extrabold text-sm shrink-0"
                      style={{
                        backgroundColor:
                          otherRoundFixtures[0].away.primaryColor,
                        color: getContrastTextColor(
                          otherRoundFixtures[0].away.primaryColor
                        ),
                      }}
                    >
                      {otherRoundFixtures[0].away.abbr}
                    </div>
                  </div>
                </div>
              )}
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
                        <td className="py-2.5 px-2 font-sans truncate max-w-[140px]">
                          {club?.shortName || row.clubId}
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
        <div className="xl:col-span-7 bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-[#b5ff00]" />
              <h3 className="font-display text-lg font-extrabold uppercase tracking-tight text-white">
                Caixa de Entrada da Comissão Técnica
              </h3>
            </div>
            <span className="text-xs text-zinc-400 font-mono tabular-nums">
              {messages.filter((m) => !m.read).length} não lidas ·{' '}
              {messages.length} mensagens
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-[540px]">
            {/* Message List */}
            <div className="md:col-span-5 border-b md:border-b-0 md:border-r border-white/[0.07] divide-y divide-white/[0.05] overflow-y-auto max-h-[580px]">
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
            <div className="md:col-span-7 p-5 sm:p-6 flex flex-col justify-between bg-[#0b0c10]/40">
              {selectedMessage ? (
                <div className="space-y-4">
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
                <div className="pt-4 mt-5 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-2">
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
