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
  const [zoneFilter, setZoneFilter] = useState<'ALL' | 'G4' | 'SULA' | 'Z4'>(
    'ALL'
  );
  const clubMap = new Map(clubs.map((c) => [c.id, c]));

  const roundMatches = fixtures.filter((f) => f.roundNumber === selectedRound);

  const filteredStandings = standings
    .map((row, idx) => ({ row, pos: idx + 1 }))
    .filter(({ pos }) => {
      if (zoneFilter === 'G4') return pos <= 4;
      if (zoneFilter === 'SULA') return pos >= 5 && pos <= 12;
      if (zoneFilter === 'Z4') return pos >= 17;
      return true;
    });

  return (
    <div className="space-y-5">
      {/* Reference Screen 1 Exact Header: "Explorar / LIGAS" + League Filter Pills */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-2 border-b border-white/[0.07]">
        <div>
          <span className="block text-xs sm:text-sm font-normal text-zinc-400 tracking-wide">
            Explorar competições
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-[0.95] mt-0.5">
            LIGA NACIONAL
          </h2>
        </div>

        {/* Segmented Filter Pills (Reference Screen 1 motif) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'ALL', label: 'Série A (20 Clubes)' },
              { id: 'G4', label: 'G-4 Continental' },
              { id: 'SULA', label: 'Sul-Americana' },
              { id: 'Z4', label: 'Zona Z-4' },
            ] as const
          ).map((pill) => (
            <button
              key={pill.id}
              onClick={() => setZoneFilter(pill.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${
                zoneFilter === pill.id
                  ? 'bg-[#b5ff00] text-[#090a0f] shadow-sm'
                  : 'bg-[#151821] text-zinc-400 hover:text-white border border-white/[0.07]'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Complete 20-Club Standings Table (8 cols) */}
        <div className="xl:col-span-8 bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.07]">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-4 h-4 text-[#b5ff00]" />
              <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
                Classificação Oficial — Série A
              </h3>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-zinc-400">
              <span className="text-[#b5ff00] font-semibold">
                ■ 1º–4º Copa Continental
              </span>
              <span className="text-white font-semibold">
                ■ 5º–8º Sul-Americana
              </span>
              <span className="text-rose-400 font-semibold">
                ■ 17º–20º Rebaixamento
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.07] bg-[#0b0c10]/60 text-[11px] text-zinc-400">
                  <th className="py-3 px-3 font-medium">Pos</th>
                  <th className="py-3 px-3 font-medium">Clube</th>
                  <th className="py-3 px-2.5 font-medium text-right">P</th>
                  <th className="py-3 px-2.5 font-medium text-right">J</th>
                  <th className="py-3 px-2.5 font-medium text-right">V</th>
                  <th className="py-3 px-2.5 font-medium text-right">E</th>
                  <th className="py-3 px-2.5 font-medium text-right">D</th>
                  <th className="py-3 px-2.5 font-medium text-right">GP</th>
                  <th className="py-3 px-2.5 font-medium text-right">GC</th>
                  <th className="py-3 px-2.5 font-medium text-right">SG</th>
                  <th className="py-3 px-2.5 font-medium text-right">%</th>
                  <th className="py-3 px-3 font-medium text-right">
                    Últimos 5
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] font-mono tabular-nums">
                {filteredStandings.map(({ row, pos }) => {
                  const club = clubMap.get(row.clubId);
                  const isUser = row.clubId === USER_CLUB_ID;
                  const pct =
                    row.played > 0
                      ? Math.round((row.points / (row.played * 3)) * 100)
                      : 0;

                  const posColor =
                    pos <= 4
                      ? 'text-[#b5ff00] font-bold'
                      : pos <= 8
                      ? 'text-white font-semibold'
                      : pos >= 17
                      ? 'text-rose-400 font-semibold'
                      : 'text-zinc-400';

                  return (
                    <tr
                      key={row.clubId}
                      className={
                        isUser
                          ? 'bg-[#b5ff00]/12 text-[#b5ff00] font-semibold'
                          : 'hover:bg-white/[0.03] text-zinc-300'
                      }
                    >
                      <td className={`py-2.5 px-3 ${posColor}`}>{pos}º</td>
                      <td className="py-2.5 px-3 font-sans">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{
                              backgroundColor: club?.primaryColor || '#b5ff00',
                            }}
                          />
                          <span className="truncate max-w-[180px] text-white font-medium">
                            {club?.name || row.clubId}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {club?.state}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-bold text-white">
                        {row.points}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-zinc-400">
                        {row.played}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-zinc-300">
                        {row.won}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-zinc-400">
                        {row.drawn}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-zinc-400">
                        {row.lost}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-zinc-300">
                        {row.goalsFor}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-zinc-400">
                        {row.goalsAgainst}
                      </td>
                      <td
                        className={`py-2.5 px-2.5 text-right font-semibold ${
                          row.goalDifference > 0
                            ? 'text-[#b5ff00]'
                            : row.goalDifference < 0
                            ? 'text-rose-400'
                            : 'text-zinc-400'
                        }`}
                      >
                        {row.goalDifference > 0
                          ? `+${row.goalDifference}`
                          : row.goalDifference}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-zinc-400">
                        {pct}%
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {row.form.map((res, fIdx) => (
                            <span
                              key={fIdx}
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
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Round Fixtures & Results Browser styled as Match Cards (4 cols) */}
        <div className="xl:col-span-4 bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#b5ff00]" />
              <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
                Jogos da {selectedRound}ª Rodada
              </h3>
            </div>

            <div className="flex items-center gap-1 bg-[#0b0c10] p-1 rounded-full border border-white/[0.07]">
              <button
                onClick={() => setSelectedRound((r) => Math.max(6, r - 1))}
                disabled={selectedRound <= 6}
                aria-label="Rodada anterior"
                className="p-1.5 rounded-full hover:bg-white/10 disabled:opacity-40 text-white transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono font-bold px-2.5 text-[#b5ff00]">
                R{selectedRound}
              </span>
              <button
                onClick={() => setSelectedRound((r) => Math.min(19, r + 1))}
                disabled={selectedRound >= 19}
                aria-label="Próxima rodada"
                className="p-1.5 rounded-full hover:bg-white/10 disabled:opacity-40 text-white transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-2.5">
            {roundMatches.map((fix) => {
              const home = clubMap.get(fix.homeClubId);
              const away = clubMap.get(fix.awayClubId);

              return (
                <div
                  key={fix.id}
                  className={`rounded-2xl p-3.5 transition-colors ${
                    fix.isUserMatch
                      ? 'bg-gradient-to-r from-[#b5ff00] to-[#98db00] text-[#090a0f] shadow-md'
                      : 'bg-[#0b0c10] border border-white/[0.06] text-zinc-200'
                  }`}
                >
                  <div className="grid grid-cols-7 items-center text-xs">
                    <div className="col-span-3 font-bold truncate">
                      {home?.shortName}
                    </div>
                    <div
                      className={`col-span-1 text-center font-mono tabular-nums font-extrabold py-0.5 rounded-full text-[11px] ${
                        fix.isUserMatch
                          ? 'bg-[#090a0f] text-white'
                          : 'bg-white/[0.08] text-white'
                      }`}
                    >
                      {fix.played
                        ? `${fix.homeGoals}:${fix.awayGoals}`
                        : 'VS'}
                    </div>
                    <div className="col-span-3 font-bold text-right truncate">
                      {away?.shortName}
                    </div>
                  </div>
                  <div
                    className={`flex items-center justify-between text-[10px] mt-1.5 font-mono ${
                      fix.isUserMatch ? 'text-[#090a0f]/75 font-semibold' : 'text-zinc-400'
                    }`}
                  >
                    <span className="truncate">{home?.stadium}</span>
                    <span>
                      {fix.played &&
                      fix.homeXG !== undefined &&
                      fix.awayXG !== undefined
                        ? `xG: ${fix.homeXG.toFixed(2)} - ${fix.awayXG.toFixed(2)}`
                        : '16:00'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
