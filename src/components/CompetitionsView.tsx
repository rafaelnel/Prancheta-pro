import React, { useState } from 'react';
import { Trophy, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { USER_CLUB_ID } from '../data/initialDatabase';
import { Club, RoundFixture, StandingsRow } from '../types/football';

interface CompetitionsViewProps {
  standings: StandingsRow[];
  clubs: Club[];
  fixtures: RoundFixture[];
  currentRound: number;
}

export const CompetitionsView: React.FC<CompetitionsViewProps> = ({
  standings,
  clubs,
  fixtures,
  currentRound,
}) => {
  const [selectedRound, setSelectedRound] = useState<number>(currentRound);
  const clubMap = new Map(clubs.map((c) => [c.id, c]));

  const roundMatches = fixtures.filter((f) => f.roundNumber === selectedRound);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      {/* Left: Complete 20-Club Standings Table (8 cols) */}
      <div className="xl:col-span-8 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              Liga Nacional Série A — Classificação Oficial (20 Clubes)
            </h2>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="text-emerald-400">■ 1º–4º Copa Continental</span>
            <span className="text-sky-400">■ 5º–8º Sul-Americana</span>
            <span className="text-rose-400">■ 17º–20º Zona de Rebaixamento</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] text-slate-400">
                <th className="py-2.5 px-3 font-medium">Pos</th>
                <th className="py-2.5 px-3 font-medium">Clube</th>
                <th className="py-2.5 px-2.5 font-medium text-right">P</th>
                <th className="py-2.5 px-2.5 font-medium text-right">J</th>
                <th className="py-2.5 px-2.5 font-medium text-right">V</th>
                <th className="py-2.5 px-2.5 font-medium text-right">E</th>
                <th className="py-2.5 px-2.5 font-medium text-right">D</th>
                <th className="py-2.5 px-2.5 font-medium text-right">GP</th>
                <th className="py-2.5 px-2.5 font-medium text-right">GC</th>
                <th className="py-2.5 px-2.5 font-medium text-right">SG</th>
                <th className="py-2.5 px-2.5 font-medium text-right">%</th>
                <th className="py-2.5 px-3 font-medium text-right">
                  Últimos 5
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
              {standings.map((row, idx) => {
                const pos = idx + 1;
                const club = clubMap.get(row.clubId);
                const isUser = row.clubId === USER_CLUB_ID;
                const pct =
                  row.played > 0
                    ? Math.round((row.points / (row.played * 3)) * 100)
                    : 0;

                const posColor =
                  pos <= 4
                    ? 'text-emerald-400 font-bold'
                    : pos <= 8
                    ? 'text-sky-400 font-semibold'
                    : pos >= 17
                    ? 'text-rose-400 font-semibold'
                    : 'text-slate-400';

                return (
                  <tr
                    key={row.clubId}
                    className={
                      isUser
                        ? 'bg-emerald-950/50 text-emerald-100 font-semibold'
                        : 'hover:bg-slate-800/40 text-slate-300'
                    }
                  >
                    <td className={`py-2 px-3 ${posColor}`}>{pos}º</td>
                    <td className="py-2 px-3 font-sans">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{
                            backgroundColor: club?.primaryColor || '#10b981',
                          }}
                        />
                        <span className="truncate max-w-[180px]">
                          {club?.name || row.clubId}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {club?.state}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-2.5 text-right font-bold text-slate-100">
                      {row.points}
                    </td>
                    <td className="py-2 px-2.5 text-right text-slate-400">
                      {row.played}
                    </td>
                    <td className="py-2 px-2.5 text-right text-slate-300">
                      {row.won}
                    </td>
                    <td className="py-2 px-2.5 text-right text-slate-400">
                      {row.drawn}
                    </td>
                    <td className="py-2 px-2.5 text-right text-slate-400">
                      {row.lost}
                    </td>
                    <td className="py-2 px-2.5 text-right text-slate-300">
                      {row.goalsFor}
                    </td>
                    <td className="py-2 px-2.5 text-right text-slate-400">
                      {row.goalsAgainst}
                    </td>
                    <td
                      className={`py-2 px-2.5 text-right font-semibold ${
                        row.goalDifference > 0
                          ? 'text-emerald-400'
                          : row.goalDifference < 0
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {row.goalDifference > 0
                        ? `+${row.goalDifference}`
                        : row.goalDifference}
                    </td>
                    <td className="py-2 px-2.5 text-right text-slate-400">
                      {pct}%
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {row.form.map((res, fIdx) => (
                          <span
                            key={fIdx}
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
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: Round Fixtures & Results Browser (4 cols) */}
      <div className="xl:col-span-4 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-100">
              Jogos da {selectedRound}ª Rodada
            </h3>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedRound((r) => Math.max(6, r - 1))}
              disabled={selectedRound <= 6}
              aria-label="Rodada anterior"
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono px-2 text-slate-300">
              R{selectedRound}
            </span>
            <button
              onClick={() => setSelectedRound((r) => Math.min(19, r + 1))}
              disabled={selectedRound >= 19}
              aria-label="Próxima rodada"
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-2.5 divide-y divide-slate-800/50">
          {roundMatches.map((fix) => {
            const home = clubMap.get(fix.homeClubId);
            const away = clubMap.get(fix.awayClubId);

            return (
              <div
                key={fix.id}
                className={`pt-2.5 first:pt-0 rounded-lg px-3 py-2 ${
                  fix.isUserMatch
                    ? 'bg-emerald-950/40 border border-emerald-500/40'
                    : 'bg-slate-950/40 border border-slate-800/70'
                }`}
              >
                <div className="grid grid-cols-7 items-center text-xs">
                  <div className="col-span-3 font-medium text-slate-200 truncate">
                    {home?.shortName}
                  </div>
                  <div className="col-span-1 text-center font-mono tabular-nums font-bold text-slate-100">
                    {fix.played
                      ? `${fix.homeGoals} - ${fix.awayGoals}`
                      : 'vs'}
                  </div>
                  <div className="col-span-3 font-medium text-slate-200 text-right truncate">
                    {away?.shortName}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-mono">
                  <span>{home?.stadium}</span>
                  <span>
                    {fix.played &&
                    fix.homeXG !== undefined &&
                    fix.awayXG !== undefined
                      ? `xG: ${fix.homeXG.toFixed(2)} - ${fix.awayXG.toFixed(2)}`
                      : 'A realizar'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
