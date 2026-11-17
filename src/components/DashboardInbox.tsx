import React, { useState } from 'react';
import {
  Mail,
  MailOpen,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Shield,
  Swords,
  Trophy,
  UserCheck,
  Calendar,
  MapPin,
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
import { USER_CLUB_ID } from '../data/initialDatabase';

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
  const [selectedMsgId, setSelectedMsgId] = useState<string>(
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
    (s) => s.clubId === USER_CLUB_ID
  );
  const opponentStandingIndex = opponentClub
    ? standings.findIndex((s) => s.clubId === opponentClub.id)
    : -1;

  // Check if Caio Vinícius (p6) is still starter
  const caioInStartingXI = squad.find((p) => p.id === 'p6')?.isStarter ?? false;

  const renderComparisonBar = (
    label: string,
    userVal: number,
    oppVal: number
  ) => {
    const userAdvantage = userVal >= oppVal;
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span
            className={`font-mono tabular-nums font-semibold ${
              userAdvantage ? 'text-emerald-400' : 'text-slate-300'
            }`}
          >
            {userVal.toFixed(1)}
          </span>
          <span className="text-slate-400">{label} (1-20)</span>
          <span
            className={`font-mono tabular-nums font-semibold ${
              !userAdvantage ? 'text-amber-400' : 'text-slate-300'
            }`}
          >
            {oppVal.toFixed(1)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 h-2">
          <div className="bg-slate-800 rounded-l overflow-hidden flex justify-end">
            <div
              className="bg-emerald-500 h-full rounded-l"
              style={{ width: `${(userVal / 20) * 100}%` }}
            />
          </div>
          <div className="bg-slate-800 rounded-r overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-r"
              style={{ width: `${(oppVal / 20) * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      {/* Left + Center: Interactive Inbox (7 columns on xl) */}
      <div className="xl:col-span-7 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <Mail className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              Caixa de Entrada da Comissão Técnica
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono tabular-nums">
            {messages.filter((m) => !m.read).length} não lidas ·{' '}
            {messages.length} mensagens
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-[460px]">
          {/* Message List */}
          <div className="md:col-span-5 border-b md:border-b-0 md:border-r border-slate-800 divide-y divide-slate-800/70 overflow-y-auto max-h-[520px]">
            {messages.map((msg) => {
              const isSelected = selectedMessage?.id === msg.id;
              return (
                <button
                  key={msg.id}
                  onClick={() => handleSelectMessage(msg.id)}
                  className={`w-full text-left p-3.5 transition-colors flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-slate-800/90'
                      : 'hover:bg-slate-800/40 bg-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span
                      className={`font-medium ${
                        msg.priority === 'warning'
                          ? 'text-amber-400'
                          : msg.priority === 'danger'
                          ? 'text-rose-400'
                          : msg.priority === 'positive'
                          ? 'text-emerald-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {msg.category}
                    </span>
                    <span className="text-slate-400 font-mono tabular-nums">
                      {msg.date.split('·')[0]}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    {!msg.read ? (
                      <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <MailOpen className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    )}
                    <span
                      className={`text-xs line-clamp-2 ${
                        !msg.read
                          ? 'font-semibold text-slate-100'
                          : 'font-normal text-slate-300'
                      }`}
                    >
                      {msg.subject}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 pl-5 truncate">
                    {msg.sender} · {msg.senderRole}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Message Reading Pane */}
          <div className="md:col-span-7 p-5 flex flex-col justify-between bg-slate-950/25">
            {selectedMessage ? (
              <div className="space-y-4">
                <div className="pb-3.5 border-b border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>
                      {selectedMessage.category} · {selectedMessage.senderRole}
                    </span>
                    <span className="font-mono tabular-nums">
                      {selectedMessage.date}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-100 leading-snug">
                    {selectedMessage.subject}
                  </h3>
                  <div className="text-xs text-emerald-400 mt-1">
                    Remetente: {selectedMessage.sender}
                  </div>
                </div>

                <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                  {selectedMessage.body.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>

                {selectedMessage.bulletPoints &&
                  selectedMessage.bulletPoints.length > 0 && (
                    <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-300">
                        Pontos de Atenção da Comissão:
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {selectedMessage.bulletPoints.map((pt, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-emerald-400 font-mono">·</span>
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
              <div className="pt-4 mt-5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                {selectedMessage.relatedPlayerId === 'p6' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const p = squad.find(
                          (pl) => pl.id === selectedMessage.relatedPlayerId
                        );
                        if (p) onInspectPlayer(p);
                      }}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors whitespace-nowrap"
                    >
                      Ver Ficha de Caio Vinícius
                    </button>
                    {caioInStartingXI ? (
                      <button
                        onClick={onQuickSwapFatiguedPlayer}
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Poupar Caio (Escalar Aníbal Moreno)
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Aníbal Moreno já escalado como titular
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
                      className="ml-auto px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 whitespace-nowrap"
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

      {/* Right Column: Next Opponent Comparison Card + League Table Summary (5 columns on xl) */}
      <div className="xl:col-span-5 space-y-5">
        {/* Next Opponent Comparison Card */}
        {opponentClub && nextFixture && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-slate-100">
                  Próximo Adversário · {currentRound}ª Rodada
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {isMatchDay ? 'HOJE · DIA DE JOGO' : 'Em preparação'}
              </span>
            </div>

            {/* Teams Header */}
            <div className="grid grid-cols-3 items-center text-center bg-slate-950/60 border border-slate-800 rounded-lg p-3.5">
              <div>
                <div
                  className="w-9 h-9 mx-auto rounded-lg flex items-center justify-center font-bold font-mono text-xs text-slate-950 mb-1"
                  style={{ backgroundColor: userClub.primaryColor }}
                >
                  {userClub.abbr}
                </div>
                <div className="text-xs font-bold text-slate-100 truncate">
                  {userClub.shortName}
                </div>
                <div className="text-[11px] text-emerald-400 font-mono tabular-nums">
                  {userStandingIndex + 1}º lugar · {userClub.formation}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-mono text-slate-400">VS</div>
                <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  <span className="truncate">
                    {nextFixture.homeClubId === USER_CLUB_ID ? 'Casa' : 'Fora'}
                  </span>
                </div>
              </div>

              <div>
                <div
                  className="w-9 h-9 mx-auto rounded-lg flex items-center justify-center font-bold font-mono text-xs text-white mb-1"
                  style={{ backgroundColor: opponentClub.primaryColor }}
                >
                  {opponentClub.abbr}
                </div>
                <div className="text-xs font-bold text-slate-100 truncate">
                  {opponentClub.shortName}
                </div>
                <div className="text-[11px] text-amber-400 font-mono tabular-nums">
                  {opponentStandingIndex + 1}º lugar · {opponentClub.formation}
                </div>
              </div>
            </div>

            {/* Strength Comparison Bars */}
            <div className="space-y-2.5 pt-1">
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
            <div className="pt-2 border-t border-slate-800">
              <div className="text-xs text-slate-400 mb-2">
                Destaques do {opponentClub.shortName} (Mentalidade{' '}
                <strong className="text-slate-200">
                  {opponentClub.instructions.mentality}
                </strong>
                ):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {opponentClub.starPlayers.slice(0, 2).map((sp, i) => (
                  <div
                    key={i}
                    className="bg-slate-950/60 border border-slate-800/80 rounded-lg px-3 py-2 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">
                        {sp.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {sp.position} · {sp.highlightAttribute}
                      </div>
                    </div>
                    <span className="font-mono tabular-nums font-bold text-amber-400">
                      {sp.overall.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 pt-1">
              <button
                onClick={() => onNavigate('tactics')}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors whitespace-nowrap"
              >
                Ajustar Prancheta
              </button>
              <button
                onClick={onGoToMatch}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap"
              >
                Ir para o Jogo ({currentRound}ª Rodada)
              </button>
            </div>
          </div>
        )}

        {/* Mini League Table Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/40">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-slate-100">
                Resumo da Tabela (G-6)
              </h2>
            </div>
            <button
              onClick={() => onNavigate('competitions')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              Ver 20 Clubes →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400 bg-slate-950/30">
                  <th className="py-2.5 px-3 font-medium">#</th>
                  <th className="py-2.5 px-2 font-medium">Clube</th>
                  <th className="py-2.5 px-2 font-medium text-right">P</th>
                  <th className="py-2.5 px-2 font-medium text-right">J</th>
                  <th className="py-2.5 px-2 font-medium text-right">V</th>
                  <th className="py-2.5 px-2 font-medium text-right">SG</th>
                  <th className="py-2.5 px-3 font-medium text-right">Forma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                {standings.slice(0, 6).map((row, index) => {
                  const club = clubMap.get(row.clubId);
                  const isUser = row.clubId === USER_CLUB_ID;
                  const isOpponent = row.clubId === opponentClub?.id;
                  return (
                    <tr
                      key={row.clubId}
                      className={
                        isUser
                          ? 'bg-emerald-950/40 text-emerald-200 font-semibold'
                          : isOpponent
                          ? 'bg-amber-950/25 text-amber-200'
                          : 'hover:bg-slate-800/40 text-slate-300'
                      }
                    >
                      <td className="py-2 px-3 text-slate-400">{index + 1}</td>
                      <td className="py-2 px-2 font-sans truncate max-w-[140px]">
                        {club?.shortName || row.clubId}
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-slate-100">
                        {row.points}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-400">
                        {row.played}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-400">
                        {row.won}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-300">
                        {row.goalDifference > 0
                          ? `+${row.goalDifference}`
                          : row.goalDifference}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="inline-flex items-center gap-1">
                          {row.form.slice(-3).map((res, idx) => (
                            <span
                              key={idx}
                              className={`text-[10px] font-bold ${
                                res === 'V'
                                  ? 'text-emerald-400'
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
    </div>
  );
};
