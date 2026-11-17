import React from 'react';
import {
  Wallet,
  TrendingUp,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { Club, Player } from '../types/football';
import { formatBRL, formatCompactBRL } from '../utils/formatters';

interface FinancesViewProps {
  club: Club;
  squad: Player[];
}

export const FinancesView: React.FC<FinancesViewProps> = ({ club, squad }) => {
  const totalMonthlyPayroll = squad.reduce((acc, p) => acc + p.salary, 0);
  const totalSquadValuation = squad.reduce((acc, p) => acc + p.marketValue, 0);
  const wageUsagePct = Math.round(
    (totalMonthlyPayroll / club.wageBudget) * 100
  );

  const sortedBySalary = [...squad].sort((a, b) => b.salary - a.salary);

  const revenueItems = [
    {
      label: 'Cota de Transmissão (TV & Streaming)',
      amount: 4200000,
      note: 'Repasse mensal fixo Série A',
    },
    {
      label: 'Bilheteria e Sócio-Torcedor (Arena Parque Industrial)',
      amount: 3800000,
      note: 'Média de 41.200 pagantes/jogo',
    },
    {
      label: 'Patrocínio Master & Fornecedor Esportivo',
      amount: 2650000,
      note: 'Contrato vigente até Dez/2027',
    },
    {
      label: 'Licenciamento & Hospitalidade Corporativa',
      amount: 890000,
      note: 'Camarotes e lojas oficiais',
    },
  ];

  const expenseItems = [
    {
      label: 'Folha Salarial do Elenco Profissional (22 Atletas)',
      amount: totalMonthlyPayroll,
      note: `${wageUsagePct}% do orçamento aprovado`,
    },
    {
      label: 'Comissão Técnica, Olheiros e Departamento Médico',
      amount: 1150000,
      note: 'Equipe multidisciplinar',
    },
    {
      label: 'Manutenção da Arena e Centro de Treinamento',
      amount: 920000,
      note: 'Gramado híbrido e logística',
    },
    {
      label: 'Categorias de Base (Sub-20 / Sub-17)',
      amount: 640000,
      note: 'Formação de atletas',
    },
  ];

  const totalMonthlyRevenue = revenueItems.reduce(
    (acc, i) => acc + i.amount,
    0
  );
  const totalMonthlyExpense = expenseItems.reduce(
    (acc, i) => acc + i.amount,
    0
  );
  const monthlyNetResult = totalMonthlyRevenue - totalMonthlyExpense;

  return (
    <div className="space-y-5">
      {/* Editorial Section Header */}
      <div className="pb-2 border-b border-white/[0.07]">
        <span className="block text-xs sm:text-sm font-normal text-zinc-400 tracking-wide">
          Explorar balanço patrimonial
        </span>
        <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-[0.95] mt-0.5">
          FINANÇAS
        </h2>
      </div>

      {/* Top KPI Cards (Lime / White / Dark Surface Discipline) */}
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
            <span>Resultado Operacional / Mês</span>
            <TrendingUp className="w-4 h-4 text-[#b5ff00]" />
          </div>
          <div
            className={`font-display text-4xl font-extrabold tabular-nums mt-1.5 leading-none ${
              monthlyNetResult >= 0 ? 'text-[#b5ff00]' : 'text-rose-400'
            }`}
          >
            +{formatCompactBRL(monthlyNetResult)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1.5">
            Superávit operacional recorrente
          </div>
        </div>

        <div className="bg-[#14171f] border border-white/[0.07] rounded-[24px] p-5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Patrimônio de Elenco (22 Atletas)</span>
            <ShieldCheck className="w-4 h-4 text-[#b5ff00]" />
          </div>
          <div className="font-display text-4xl font-extrabold tabular-nums text-white mt-1.5 leading-none">
            {formatCompactBRL(totalSquadValuation)}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1.5">
            Confiança da Diretoria: {club.boardConfidence}%
          </div>
        </div>
      </div>

      {/* Main Split: Monthly Cashflow Breakdown + Squad Payroll Ledger */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Cashflow Breakdown (6 cols) */}
        <div className="xl:col-span-6 bg-[#14171f] border border-white/[0.07] rounded-[28px] p-5 space-y-5">
          <div>
            <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white pb-2.5 border-b border-white/[0.07] flex items-center justify-between">
              <span>Receitas Mensais Recorrentes</span>
              <span className="font-mono text-sm tabular-nums text-[#b5ff00]">
                +{formatBRL(totalMonthlyRevenue)}
              </span>
            </h3>
            <div className="divide-y divide-white/[0.05] mt-2">
              {revenueItems.map((item, i) => (
                <div
                  key={i}
                  className="py-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-white">{item.label}</div>
                    <div className="text-[11px] text-zinc-400">{item.note}</div>
                  </div>
                  <span className="font-mono tabular-nums font-bold text-[#b5ff00]">
                    +{formatCompactBRL(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white pb-2.5 border-b border-white/[0.07] flex items-center justify-between">
              <span>Despesas Operacionais Mensais</span>
              <span className="font-mono text-sm tabular-nums text-rose-400">
                -{formatBRL(totalMonthlyExpense)}
              </span>
            </h3>
            <div className="divide-y divide-white/[0.05] mt-2">
              {expenseItems.map((item, i) => (
                <div
                  key={i}
                  className="py-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-white">{item.label}</div>
                    <div className="text-[11px] text-zinc-400">{item.note}</div>
                  </div>
                  <span className="font-mono tabular-nums font-bold text-rose-400">
                    -{formatCompactBRL(item.amount)}
                  </span>
                </div>
              ))}
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

          <div className="overflow-y-auto max-h-[420px]">
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
                      {formatBRL(p.salary)}
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
