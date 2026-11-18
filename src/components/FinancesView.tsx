import React from 'react';
import {
  Wallet,
  TrendingUp,
  ShieldCheck,
  Building2,
  Ticket,
  Handshake,
  ArrowLeftRight,
  Award,
} from 'lucide-react';
import { Club, ClubFinanceLedger, Player } from '../types/football';
import {
  getEffectivePayroll,
  getPlayerPaidSalary,
} from '../engine/transferEngine';
import { createInitialFinanceLedger } from '../engine/economyAndEvolution';
import { formatBRL, formatCompactBRL } from '../utils/formatters';

interface FinancesViewProps {
  club: Club;
  squad: Player[];
  loanedOutPlayers?: Player[];
  financeLedger?: ClubFinanceLedger;
  seasonYear?: number;
}

export const FinancesView: React.FC<FinancesViewProps> = ({
  club,
  squad,
  loanedOutPlayers = [],
  financeLedger,
  seasonYear = 2026,
}) => {
  const ledger =
    financeLedger || createInitialFinanceLedger(club, squad, seasonYear);
  const totalMonthlyPayroll = getEffectivePayroll(squad, loanedOutPlayers);
  const totalSquadValuation = squad.reduce((acc, p) => acc + p.marketValue, 0);
  const wageUsagePct = Math.round(
    (totalMonthlyPayroll / Math.max(1, club.wageBudget)) * 100
  );

  const sortedBySalary = [...squad].sort(
    (a, b) => getPlayerPaidSalary(b) - getPlayerPaidSalary(a)
  );

  const sponsor = ledger.sponsorshipContract;

  const threeRevenuePillars = [
    {
      id: 'gate',
      label: '1. Renda de Estádio (Bilheteria)',
      amount: ledger.seasonGateRevenue,
      note:
        ledger.lastMatchGateRevenue > 0
          ? `Último jogo em casa (${club.stadium}): ${ledger.lastMatchAttendance.toLocaleString(
              'pt-BR'
            )} pagantes (${formatCompactBRL(ledger.lastMatchGateRevenue)})`
          : `Mandos de campo em ${club.stadium} conforme reputação e fase na tabela`,
      Icon: Ticket,
    },
    {
      id: 'transfers',
      label: '2. Transações de Jogadores (Vendas & Empréstimos)',
      amount: ledger.seasonTransferIncome,
      note:
        ledger.seasonTransferSpend > 0
          ? `Investido em compras/taxas na temporada: -${formatCompactBRL(
              ledger.seasonTransferSpend
            )}`
          : 'Receitas acumuladas de vendas definitivas e empréstimos cedidos',
      Icon: ArrowLeftRight,
    },
    {
      id: 'sponsorship',
      label: `3. Patrocínios Automáticos (${sponsor.sponsorName})`,
      amount: ledger.seasonSponsorshipRevenue,
      note: `${sponsor.tierLabel} · ${formatCompactBRL(
        sponsor.annualValue
      )}/ano (${formatCompactBRL(sponsor.monthlyInstallment)}/mês) · ${
        sponsor.basisNote
      }`,
      Icon: Handshake,
    },
  ];

  const totalThreePillarsRevenue =
    ledger.seasonGateRevenue +
    ledger.seasonTransferIncome +
    ledger.seasonSponsorshipRevenue;
  const totalSeasonInflow =
    totalThreePillarsRevenue + ledger.seasonPrizeRevenue;
  const youthSpend = ledger.seasonYouthAcademySpend || 0;
  const totalSeasonOutflow =
    ledger.seasonTransferSpend + ledger.seasonOperationalExpense + youthSpend;

  return (
    <div className="space-y-5">
      {/* Editorial Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-2 border-b border-white/[0.07]">
        <div>
          <span className="block text-xs sm:text-sm font-normal text-zinc-400 tracking-wide">
            Orçamento, Patrocínio Dinâmico & Trava Anti-Inflação · Temporada{' '}
            {ledger.seasonYear}
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-[0.95] mt-0.5">
            FINANÇAS
          </h2>
        </div>

        <div className="text-xs font-mono text-zinc-400">
          Patrocinador Master:{' '}
          <strong className="text-[#b5ff00]">{sponsor.sponsorName}</strong>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#b5ff00] text-[#090a0f] rounded-[24px] p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold uppercase font-mono opacity-80">
            <span>Saldo em Caixa Disponível</span>
            <Wallet className="w-4 h-4" />
          </div>
          <div className="font-display text-4xl font-extrabold tabular-nums mt-1.5 leading-none">
            {formatCompactBRL(club.cashBalance)}
          </div>
          <div className="text-[11px] opacity-80 mt-1.5 font-mono tabular-nums font-semibold">
            Exato: {formatBRL(club.cashBalance)}
          </div>
        </div>

        <div className="bg-white text-[#090a0f] rounded-[24px] p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold uppercase font-mono text-zinc-500">
            <span>Folha Salarial Mensal</span>
            <Building2 className="w-4 h-4 text-[#090a0f]" />
          </div>
          <div className="font-display text-4xl font-extrabold tabular-nums mt-1.5 leading-none">
            {formatCompactBRL(totalMonthlyPayroll)}{' '}
            <span className="text-sm font-sans font-semibold text-zinc-500">
              / {formatCompactBRL(club.wageBudget)}
            </span>
          </div>
          <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden mt-2.5">
            <div
              className="h-full bg-[#090a0f]"
              style={{ width: `${Math.min(100, wageUsagePct)}%` }}
            />
          </div>
        </div>

        <div className="bg-[#14171f] border border-white/[0.07] rounded-[24px] p-5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Patrocínio Anual Vigente</span>
            <TrendingUp className="w-4 h-4 text-[#b5ff00]" />
          </div>
          <div className="font-display text-4xl font-extrabold tabular-nums text-[#b5ff00] mt-1.5 leading-none">
            {formatCompactBRL(sponsor.annualValue)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1.5 truncate">
            {sponsor.tierLabel} · {formatCompactBRL(sponsor.monthlyInstallment)}
            /mês
          </div>
        </div>

        <div className="bg-[#14171f] border border-white/[0.07] rounded-[24px] p-5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Patrimônio de Elenco ({squad.length} Atletas)</span>
            <ShieldCheck className="w-4 h-4 text-[#b5ff00]" />
          </div>
          <div className="font-display text-4xl font-extrabold tabular-nums text-white mt-1.5 leading-none">
            {formatCompactBRL(totalSquadValuation)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1.5">
            Confiança da Diretoria: {club.boardConfidence}% · Rep.{' '}
            {club.reputation}/99
          </div>
        </div>
      </div>

      {/* Main Split: 3 Clear Revenue Pillars & Anti-Inflation Guardrails + Squad Payroll Ledger */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* 3 Revenue Pillars Breakdown (6 cols) */}
        <div className="xl:col-span-6 bg-[#14171f] border border-white/[0.07] rounded-[28px] p-5 space-y-5">
          <div>
            <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white pb-2.5 border-b border-white/[0.07] flex items-center justify-between">
              <span>3 Pilares de Receita ({ledger.seasonYear})</span>
              <span className="font-mono text-sm tabular-nums text-[#b5ff00]">
                +{formatCompactBRL(totalSeasonInflow)}
              </span>
            </h3>
            <div className="divide-y divide-white/[0.05] mt-2">
              {threeRevenuePillars.map((pillar) => {
                const Icon = pillar.Icon;
                return (
                  <div
                    key={pillar.id}
                    className="py-3.5 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-[#b5ff00]/15 border border-[#b5ff00]/30 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="w-4 h-4 text-[#b5ff00]" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-white">
                          {pillar.label}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                          {pillar.note}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono tabular-nums font-bold text-[#b5ff00] shrink-0">
                      +{formatCompactBRL(pillar.amount)}
                    </span>
                  </div>
                );
              })}

              {ledger.seasonPrizeRevenue > 0 && (
                <div className="py-3.5 flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0 mt-0.5">
                      <Award className="w-4 h-4 text-amber-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-white">
                        Premiações por Fase (Copas & Liga)
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Bônus acumulados por avanços na temporada
                      </div>
                    </div>
                  </div>
                  <span className="font-mono tabular-nums font-bold text-amber-300 shrink-0">
                    +{formatCompactBRL(ledger.seasonPrizeRevenue)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white pb-2.5 border-b border-white/[0.07] flex items-center justify-between">
              <span>Saídas & Controle Anti-Inflação</span>
              <span className="font-mono text-sm tabular-nums text-rose-400">
                -{formatCompactBRL(totalSeasonOutflow)}
              </span>
            </h3>
            <div className="divide-y divide-white/[0.05] mt-2 text-xs">
              <div className="py-3 flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-white">
                    Folha Salarial Mensal Comprometida
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {squad.length} atletas ativos
                    {loanedOutPlayers.length > 0
                      ? ` + ${loanedOutPlayers.length} cedido(s) por empréstimo`
                      : ''}{' '}
                    ({wageUsagePct}% do teto)
                  </div>
                </div>
                <span className="font-mono tabular-nums font-bold text-white">
                  {formatCompactBRL(totalMonthlyPayroll)}/mês
                </span>
              </div>

              <div className="py-3 flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-white">
                    Investimento em Contratações ({ledger.seasonYear})
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Compras definitivas e taxas de empréstimo pagas
                  </div>
                </div>
                <span className="font-mono tabular-nums font-bold text-rose-400">
                  -{formatCompactBRL(ledger.seasonTransferSpend)}
                </span>
              </div>

              {youthSpend > 0 && (
                <div className="py-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-white">
                      Base & Categorias Sub-20 ({ledger.seasonYear})
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Custeio mensal acumulado em captação e formação de jovens
                    </div>
                  </div>
                  <span className="font-mono tabular-nums font-bold text-rose-400">
                    -{formatCompactBRL(youthSpend)}
                  </span>
                </div>
              )}

              <div className="py-3 flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-white">
                    Manutenção Estrutural & Trava Anti-Inflação
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Estádio, comissão técnica e ajuste econômico de virada de
                    ano
                  </div>
                </div>
                <span className="font-mono tabular-nums font-bold text-rose-400">
                  -{formatCompactBRL(ledger.seasonOperationalExpense)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Squad Salary & Market Value Ledger (6 cols) */}
        <div className="xl:col-span-6 bg-[#14171f] border border-white/[0.07] rounded-[28px] overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-white/[0.07] flex items-center justify-between">
            <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white">
              Folha Salarial e Valor por Atleta
            </h3>
            <span className="text-xs font-mono text-zinc-400">
              Ordenado por maior salário
            </span>
          </div>

          <div className="overflow-y-auto max-h-[460px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.07] bg-[#0b0c10]/60 text-[11px] text-zinc-400">
                  <th className="py-3 px-4 font-medium">Atleta</th>
                  <th className="py-3 px-2 font-medium">Pos</th>
                  <th className="py-3 px-2 font-medium">Status</th>
                  <th className="py-3 px-3 font-medium text-right">
                    Valor de Mercado
                  </th>
                  <th className="py-3 px-4 font-medium text-right">
                    Salário Mensal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] font-mono tabular-nums">
                {sortedBySalary.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.03]">
                    <td className="py-2.5 px-4 font-sans font-semibold text-white">
                      #{p.number} {p.name}
                    </td>
                    <td className="py-2.5 px-2 text-zinc-400">{p.position}</td>
                    <td className="py-2.5 px-2 font-sans">
                      <span
                        className={
                          p.isStarter
                            ? 'text-[#b5ff00] font-semibold'
                            : 'text-zinc-500'
                        }
                      >
                        {p.isStarter ? 'Titular' : 'Reserva'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-zinc-300">
                      {formatCompactBRL(p.marketValue)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-[#b5ff00]">
                      {formatBRL(getPlayerPaidSalary(p))}
                      {p.contractType === 'EMPRESTADO' && (
                        <span className="block text-[10px] font-normal text-zinc-400">
                          Emp. ({Math.round((p.wageSharePaid ?? 1) * 100)}%)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
