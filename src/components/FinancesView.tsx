import React from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
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
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Saldo em Caixa Disponível</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1.5">
            {formatCompactBRL(club.cashBalance)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono tabular-nums">
            Exato: {formatBRL(club.cashBalance)}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Folha Salarial Mensal</span>
            <Building2 className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1.5">
            {formatCompactBRL(totalMonthlyPayroll)}{' '}
            <span className="text-xs font-normal text-slate-400">
              / {formatCompactBRL(club.wageBudget)}
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${Math.min(100, wageUsagePct)}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Resultado Operacional / Mês</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums mt-1.5 ${
              monthlyNetResult >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            +{formatCompactBRL(monthlyNetResult)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Superávit operacional recorrente
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Patrimônio de Elenco (22 Atletas)</span>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-400 mt-1.5">
            {formatCompactBRL(totalSquadValuation)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Confiança Financeira da Diretoria: {club.boardConfidence}%
          </div>
        </div>
      </div>

      {/* Main Split: Monthly Cashflow Breakdown + Squad Payroll Ledger */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Cashflow Breakdown (6 cols) */}
        <div className="xl:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 pb-2.5 border-b border-slate-800 flex items-center justify-between">
              <span>Receitas Mensais Recorrentes</span>
              <span className="font-mono tabular-nums text-emerald-400">
                +{formatBRL(totalMonthlyRevenue)}
              </span>
            </h3>
            <div className="divide-y divide-slate-800/60 mt-2">
              {revenueItems.map((item, i) => (
                <div
                  key={i}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-medium text-slate-200">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {item.note}
                    </div>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-emerald-400">
                    +{formatCompactBRL(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-100 pb-2.5 border-b border-slate-800 flex items-center justify-between">
              <span>Despesas Operacionais Mensais</span>
              <span className="font-mono tabular-nums text-rose-400">
                -{formatBRL(totalMonthlyExpense)}
              </span>
            </h3>
            <div className="divide-y divide-slate-800/60 mt-2">
              {expenseItems.map((item, i) => (
                <div
                  key={i}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-medium text-slate-200">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {item.note}
                    </div>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-rose-400">
                    -{formatCompactBRL(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Squad Salary & Market Value Ledger (6 cols) */}
        <div className="xl:col-span-6 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              Folha Salarial e Valor de Mercado por Atleta
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Ordenado por maior salário
            </span>
          </div>

          <div className="overflow-y-auto max-h-[420px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] text-slate-400">
                  <th className="py-2.5 px-4 font-medium">Atleta</th>
                  <th className="py-2.5 px-2 font-medium">Pos</th>
                  <th className="py-2.5 px-2 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium text-right">
                    Valor de Mercado
                  </th>
                  <th className="py-2.5 px-4 font-medium text-right">
                    Salário Mensal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                {sortedBySalary.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="py-2 px-4 font-sans font-medium text-slate-200">
                      #{p.number} {p.name}
                    </td>
                    <td className="py-2 px-2 text-slate-400">{p.position}</td>
                    <td className="py-2 px-2 font-sans">
                      <span
                        className={
                          p.isStarter ? 'text-emerald-400' : 'text-slate-500'
                        }
                      >
                        {p.isStarter ? 'Titular' : 'Reserva'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">
                      {formatCompactBRL(p.marketValue)}
                    </td>
                    <td className="py-2 px-4 text-right font-semibold text-emerald-400">
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
