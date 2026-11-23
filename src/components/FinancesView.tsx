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
  Users,
  Hammer,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Club, ClubFinanceLedger, Player } from '../types/football';
import {
  getEffectivePayroll,
  getPlayerPaidSalary,
} from '../engine/transferEngine';
import {
  STADIUM_RENOVATION_TIERS,
  calculateMatchGateRevenue,
  calculateOperationalCost,
  clampTicketPriceMultiplier,
  createInitialFinanceLedger,
  getClubStadiumRenovationLevel,
  getNextStadiumRenovationQuote,
  getStadiumRenovationTierInfo,
} from '../engine/economyAndEvolution';
import { formatBRL, formatCompactBRL } from '../utils/formatters';

interface FinancesViewProps {
  club: Club;
  squad: Player[];
  loanedOutPlayers?: Player[];
  financeLedger?: ClubFinanceLedger;
  seasonYear?: number;
  userRank?: number;
  onUpdateTicketPriceMultiplier?: (multiplier: number) => void;
  onRenovateStadium?: () => void;
}

const TICKET_PRICE_PRESETS: Array<{ mult: number; label: string; tag: string }> = [
  { mult: 0.75, label: '-25%', tag: 'Popular' },
  { mult: 0.85, label: '-15%', tag: 'Acessível' },
  { mult: 1.0, label: 'Padrão', tag: 'Referência' },
  { mult: 1.15, label: '+15%', tag: 'Moderado' },
  { mult: 1.3, label: '+30%', tag: 'Alto' },
  { mult: 1.5, label: '+50%', tag: 'Premium' },
  { mult: 1.75, label: '+75%', tag: 'Máximo' },
];

export const FinancesView: React.FC<FinancesViewProps> = ({
  club,
  squad,
  loanedOutPlayers = [],
  financeLedger,
  seasonYear = 2026,
  userRank = 6,
  onUpdateTicketPriceMultiplier,
  onRenovateStadium,
}) => {
  const ledger =
    financeLedger || createInitialFinanceLedger(club, squad, seasonYear);
  const totalMonthlyPayroll = getEffectivePayroll(squad, loanedOutPlayers);
  const annualPayrollProjection = totalMonthlyPayroll * 12;
  const totalSquadValuation = squad.reduce((acc, p) => acc + p.marketValue, 0);
  const isInDebt = club.cashBalance < 0;

  const sortedBySalary = [...squad].sort(
    (a, b) => getPlayerPaidSalary(b) - getPlayerPaidSalary(a)
  );

  const sponsor = ledger.sponsorshipContract;
  const monthlySponsorOpCost = calculateOperationalCost(sponsor.monthlyInstallment);
  const netMonthlySponsor = sponsor.monthlyInstallment - monthlySponsorOpCost;
  const monthlyFixedNet = netMonthlySponsor - totalMonthlyPayroll;
  const payrollExceedsSponsor = totalMonthlyPayroll > netMonthlySponsor;

  // Stadium & Ticket Price Simulation
  const currentRenovationLevel = getClubStadiumRenovationLevel(club);
  const currentTierInfo = getStadiumRenovationTierInfo(currentRenovationLevel);
  const nextRenovationQuote = getNextStadiumRenovationQuote(club);
  const activeTicketMultiplier = clampTicketPriceMultiplier(
    club.ticketPriceMultiplier ?? 1.0
  );

  const matchProjection = calculateMatchGateRevenue({
    club,
    rank: userRank,
    totalTeams: 20,
    competition: 'BRASILEIRAO',
    isHome: true,
    ticketPriceMultiplierOverride: activeTicketMultiplier,
    stadiumRenovationLevelOverride: currentRenovationLevel,
  });

  const referenceProjection = calculateMatchGateRevenue({
    club,
    rank: userRank,
    totalTeams: 20,
    competition: 'BRASILEIRAO',
    isHome: true,
    ticketPriceMultiplierOverride: 1.0,
    stadiumRenovationLevelOverride: currentRenovationLevel,
  });

  const nextLevelProjection = nextRenovationQuote.nextTier
    ? calculateMatchGateRevenue({
        club,
        rank: userRank,
        totalTeams: 20,
        competition: 'BRASILEIRAO',
        isHome: true,
        ticketPriceMultiplierOverride: activeTicketMultiplier,
        stadiumRenovationLevelOverride: nextRenovationQuote.nextTier.level,
        capacityOverride: nextRenovationQuote.projectedCapacity,
      })
    : null;

  const netMatchGate =
    matchProjection.gateRevenue -
    calculateOperationalCost(matchProjection.gateRevenue);
  const attendanceDeltaVsRef =
    matchProjection.attendance - referenceProjection.attendance;
  const priceDeltaPct = Math.round((activeTicketMultiplier - 1.0) * 100);

  const threeRevenuePillars = [
    {
      id: 'gate',
      label: '1. Renda de Estádio (Bilheteria)',
      amount: ledger.seasonGateRevenue,
      note:
        ledger.lastMatchGateRevenue > 0
          ? `Último jogo em casa (${club.stadium}): ${ledger.lastMatchAttendance.toLocaleString(
              'pt-BR'
            )} pagantes (${formatCompactBRL(ledger.lastMatchGateRevenue)} bruto · 30% custo operacional)`
          : `Mandos de campo em ${club.stadium} conforme ingresso (${formatBRL(
              matchProjection.effectiveTicketPrice
            )}) e ocupação (30% custo operacional)`,
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
      label: `3. Patrocínios Anuais (${sponsor.sponsorName})`,
      amount: ledger.seasonSponsorshipRevenue,
      note: `${sponsor.tierLabel} · ${formatCompactBRL(
        sponsor.annualValue
      )}/ano (${formatCompactBRL(sponsor.monthlyInstallment)}/mês bruto · ${formatCompactBRL(
        netMonthlySponsor
      )}/mês líq.) · ${sponsor.basisNote}`,
      Icon: Handshake,
    },
  ];

  const totalThreePillarsRevenue =
    ledger.seasonGateRevenue +
    ledger.seasonTransferIncome +
    ledger.seasonSponsorshipRevenue;
  const totalSeasonInflow =
    totalThreePillarsRevenue + ledger.seasonPrizeRevenue;
  const payrollSpend = ledger.seasonPayrollExpense || 0;
  const youthSpend = ledger.seasonYouthAcademySpend || 0;
  const stadiumSpend = ledger.seasonStadiumRenovationSpend || 0;
  const totalSeasonOutflow =
    payrollSpend +
    ledger.seasonTransferSpend +
    ledger.seasonOperationalExpense +
    youthSpend +
    stadiumSpend;

  return (
    <div className="space-y-5">
      {/* Editorial Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-2 border-b border-white/[0.07]">
        <div>
          <span className="block text-xs sm:text-sm font-normal text-zinc-400 tracking-wide">
            Orçamento, Gestão de Estádio & Ingressos · Temporada {ledger.seasonYear}
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-white leading-[0.95] mt-0.5">
            FINANÇAS & ESTÁDIO
          </h2>
        </div>

        <div className="text-xs font-mono text-zinc-400">
          Patrocinador Master:{' '}
          <strong className="text-[#b5ff00]">{sponsor.sponsorName}</strong>
        </div>
      </div>

      {/* Debt Alert Banner if cashBalance < 0 */}
      {isInDebt && (
        <div
          data-testid="finances-debt-alert"
          className="rounded-2xl bg-rose-950/50 border border-rose-500/45 px-4 py-3 text-xs text-rose-200 flex flex-wrap items-center justify-between gap-2"
        >
          <div>
            <strong className="text-rose-100 uppercase font-mono">
              Alerta de Dívida Ativa:
            </strong>{' '}
            O clube está com saldo negativo ({formatCompactBRL(club.cashBalance)}). Salários e custos operacionais acima das receitas aumentam a dívida mensalmente e reduzem a confiança da diretoria.
          </div>
          <span className="font-mono font-bold text-rose-300 tabular-nums shrink-0">
            Folha anual: {formatCompactBRL(annualPayrollProjection)}/ano
          </span>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div
          className={`rounded-[24px] p-5 shadow-lg ${
            isInDebt
              ? 'bg-rose-600 text-white'
              : 'bg-[#b5ff00] text-[#090a0f]'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold uppercase font-mono opacity-85">
            <span>{isInDebt ? 'Saldo em Dívida' : 'Saldo em Caixa Disponível'}</span>
            <Wallet className="w-4 h-4" />
          </div>
          <div className="font-display text-4xl font-extrabold tabular-nums mt-1.5 leading-none">
            {formatCompactBRL(club.cashBalance)}
          </div>
          <div className="text-[11px] opacity-85 mt-1.5 font-mono tabular-nums font-semibold">
            Exato: {formatBRL(club.cashBalance)}
          </div>
        </div>

        <div className="bg-white text-[#090a0f] rounded-[24px] p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold uppercase font-mono text-zinc-500">
            <span>Folha Salarial Mensal</span>
            <Building2 className="w-4 h-4 text-[#090a0f]" />
          </div>
          <div className="font-display text-4xl font-extrabold tabular-nums mt-1.5 leading-none">
            {formatCompactBRL(totalMonthlyPayroll)}
            <span className="text-xs font-mono font-bold text-emerald-700 ml-1.5 uppercase">
              Sem Limite
            </span>
          </div>
          <div className="text-[11px] mt-2 font-mono tabular-nums text-zinc-600">
            Projeção anual: <strong>{formatCompactBRL(annualPayrollProjection)}</strong>/ano
          </div>
          <div
            className={`text-[10px] mt-1 font-semibold ${
              payrollExceedsSponsor ? 'text-rose-600' : 'text-emerald-700'
            }`}
          >
            {payrollExceedsSponsor
              ? `Folha supera patrocínio líquido (-30% op.) em ${formatCompactBRL(
                  Math.abs(monthlyFixedNet)
                )}/mês (depende de bilheteria/vendas)`
              : `Patrocínio líquido (-30% op.) cobre 100% da folha (+${formatCompactBRL(
                  monthlyFixedNet
                )}/mês livres)`}
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

      {/* Stadium Management: Ticket Pricing vs Attendance Elasticity & Renovations */}
      <section
        data-testid="stadium-management-panel"
        className="bg-[#14171f] border border-white/[0.08] rounded-[28px] p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 pb-4 border-b border-white/[0.07]">
          <div>
            <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-2">
              <span className="text-[#b5ff00] font-semibold">
                Gestão do Estádio & Bilheteria
              </span>
              <span aria-hidden="true">·</span>
              <span>{currentTierInfo.shortLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-zinc-200">
                Capacidade atual: {club.capacity.toLocaleString('pt-BR')} lugares
              </span>
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white mt-1">
              {club.stadium} — {currentTierInfo.name}
            </h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-3xl">
              {currentTierInfo.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums shrink-0">
            <div>
              <span className="block text-[10px] text-zinc-400">
                Retenção de Torcida (Conforto)
              </span>
              <strong className="text-sm text-[#b5ff00]">
                {Math.round(currentTierInfo.priceRetentionShield * 100)}% menos desistência
              </strong>
            </div>
            <div>
              <span className="block text-[10px] text-zinc-400">
                Renda Líquida Est./Jogo (-30% op.)
              </span>
              <strong className="text-sm text-white">
                {formatCompactBRL(netMatchGate)}/jogo
              </strong>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left 7 Cols: Ticket Price Policy & Attendance Correlation */}
          <div className="xl:col-span-7 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-display text-lg font-extrabold uppercase tracking-tight text-white">
                  Política de Preço de Ingresso vs Público no Estádio
                </h4>
                <p className="text-xs text-zinc-400">
                  Subir o ingresso reduz a presença de público, mas reformas no estádio valorizam a experiência e impedem a desistência do torcedor.
                </p>
              </div>
              <div className="text-right font-mono tabular-nums shrink-0">
                <div className="text-lg font-extrabold text-[#b5ff00]">
                  {formatBRL(matchProjection.effectiveTicketPrice)}
                </div>
                <div className="text-[11px] text-zinc-400">
                  Ref. {formatBRL(matchProjection.referenceTicketPrice)} (
                  {priceDeltaPct > 0 ? `+${priceDeltaPct}%` : `${priceDeltaPct}%`})
                </div>
              </div>
            </div>

            {/* Interactive Slider + Quick Presets */}
            <div className="bg-[#0b0c10] border border-white/[0.07] rounded-2xl p-4 space-y-3.5">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-zinc-400">Ingresso Popular (-30%)</span>
                <span className="font-bold text-white">
                  Ajuste atual:{' '}
                  <span className="text-[#b5ff00]">
                    {Math.round(activeTicketMultiplier * 100)}% do valor base
                  </span>
                </span>
                <span className="text-zinc-400">Ingresso Elite (+80%)</span>
              </div>

              <input
                type="range"
                aria-label="Multiplicador do valor do ingresso"
                data-testid="ticket-price-slider"
                min={0.7}
                max={1.8}
                step={0.05}
                value={activeTicketMultiplier}
                onChange={(e) =>
                  onUpdateTicketPriceMultiplier?.(parseFloat(e.target.value))
                }
                className="w-full h-2.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#b5ff00]"
              />

              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                {TICKET_PRICE_PRESETS.map((preset) => {
                  const isSelected =
                    Math.abs(activeTicketMultiplier - preset.mult) < 0.02;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => onUpdateTicketPriceMultiplier?.(preset.mult)}
                      className={`min-h-[42px] px-2 py-1.5 rounded-xl text-[11px] font-mono font-bold transition-colors flex flex-col items-center justify-center cursor-pointer ${
                        isSelected
                          ? 'bg-[#b5ff00] text-[#090a0f]'
                          : 'bg-[#14171f] text-zinc-300 hover:text-white border border-white/[0.07]'
                      }`}
                    >
                      <span>{preset.label}</span>
                      <span
                        className={`text-[9px] font-sans font-normal ${
                          isSelected ? 'text-[#090a0f]/80' : 'text-zinc-400'
                        }`}
                      >
                        {preset.tag}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Correlation Telemetry: Attendance, Occupancy, Retention & Gross/Net Gate */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono tabular-nums">
              <div className="bg-[#0b0c10] border border-white/[0.07] rounded-2xl p-3.5">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-sans">
                  <span>Público Estimado / Jogo</span>
                  <Users className="w-3.5 h-3.5 text-[#b5ff00]" />
                </div>
                <div
                  data-testid="projected-attendance-value"
                  className="text-xl font-extrabold text-white mt-1"
                >
                  {matchProjection.attendance.toLocaleString('pt-BR')}
                </div>
                <div
                  className={`text-[11px] mt-0.5 ${
                    attendanceDeltaVsRef > 0
                      ? 'text-[#b5ff00]'
                      : attendanceDeltaVsRef < 0
                      ? 'text-amber-300'
                      : 'text-zinc-400'
                  }`}
                >
                  Ocupação: {Math.round(matchProjection.occupancyRate * 100)}% (
                  {attendanceDeltaVsRef > 0
                    ? `+${attendanceDeltaVsRef.toLocaleString('pt-BR')}`
                    : attendanceDeltaVsRef < 0
                    ? attendanceDeltaVsRef.toLocaleString('pt-BR')
                    : 'estável'}{' '}
                  vs preço padrão)
                </div>
              </div>

              <div className="bg-[#0b0c10] border border-white/[0.07] rounded-2xl p-3.5">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-sans">
                  <span>Fidelização pelo Estádio</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#b5ff00]" />
                </div>
                <div
                  data-testid="fan-retention-saved"
                  className="text-xl font-extrabold text-[#b5ff00] mt-1"
                >
                  +{matchProjection.fanRetentionSavedCount.toLocaleString('pt-BR')}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5 font-sans">
                  {currentRenovationLevel > 0
                    ? `Torcedores retidos pelo estádio Nível ${currentRenovationLevel}`
                    : 'Reforme o estádio p/ segurar público com ingresso caro'}
                </div>
              </div>

              <div className="bg-[#0b0c10] border border-white/[0.07] rounded-2xl p-3.5">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-sans">
                  <span>Bilheteria Bruta / Jogo</span>
                  <Ticket className="w-3.5 h-3.5 text-[#b5ff00]" />
                </div>
                <div
                  data-testid="projected-gate-revenue"
                  className="text-xl font-extrabold text-white mt-1"
                >
                  {formatCompactBRL(matchProjection.gateRevenue)}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  Líq. (-30% op.):{' '}
                  <strong className="text-[#b5ff00]">
                    {formatCompactBRL(netMatchGate)}
                  </strong>
                </div>
              </div>
            </div>

            {priceDeltaPct >= 20 && currentRenovationLevel === 0 && (
              <div className="rounded-xl bg-amber-950/40 border border-amber-500/35 px-3.5 py-2.5 text-xs text-amber-200 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Com ingresso <strong>+{priceDeltaPct}%</strong> acima do padrão em um estádio sem reformas (Nível 0), cerca de{' '}
                  <strong>{Math.round(matchProjection.rawPriceDropPct * 100)}%</strong> dos torcedores desistem da compra. Modernizar o estádio reduz essa desistência e amplia a capacidade total.
                </span>
              </div>
            )}
          </div>

          {/* Right 5 Cols: Stadium Expansion & Renovation Project */}
          <div className="xl:col-span-5 bg-[#0b0c10] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Hammer className="w-4 h-4 text-[#b5ff00]" />
                  <h4 className="font-display text-lg font-extrabold uppercase tracking-tight text-white">
                    Obras de Reforma & Expansão
                  </h4>
                </div>
                <span className="text-xs font-mono text-zinc-400 tabular-nums">
                  Etapa {currentRenovationLevel}/4
                </span>
              </div>

              {/* 4-Step Progress Track */}
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {STADIUM_RENOVATION_TIERS.map((tier) => {
                  const isCompleted = tier.level <= currentRenovationLevel;
                  const isCurrent = tier.level === currentRenovationLevel;
                  return (
                    <div
                      key={tier.level}
                      className={`rounded-xl px-2 py-2 border text-center transition-colors ${
                        isCurrent
                          ? 'bg-[#b5ff00]/15 border-[#b5ff00] text-white'
                          : isCompleted
                          ? 'bg-white/[0.06] border-white/15 text-zinc-200'
                          : 'bg-[#14171f] border-white/[0.05] text-zinc-500'
                      }`}
                    >
                      <div className="font-mono text-[10px] font-bold">
                        Nível {tier.level}
                      </div>
                      <div className="text-[10px] truncate mt-0.5">
                        {tier.level === 0
                          ? 'Base'
                          : `+${(tier.capacityAdded / 1000).toFixed(1)}k`}
                      </div>
                    </div>
                  );
                })}
              </div>

              {nextRenovationQuote.nextTier ? (
                <div className="pt-2 space-y-2.5">
                  <div>
                    <div className="text-xs text-zinc-400">Próximo projeto disponível:</div>
                    <div className="font-display text-xl font-extrabold uppercase text-white mt-0.5">
                      {nextRenovationQuote.nextTier.name}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      {nextRenovationQuote.nextTier.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1 font-mono tabular-nums text-xs">
                    <div className="bg-[#14171f] border border-white/[0.06] rounded-xl p-2.5">
                      <span className="block text-[10px] text-zinc-400 font-sans">
                        Nova Capacidade
                      </span>
                      <strong className="text-white text-sm">
                        {nextRenovationQuote.projectedCapacity.toLocaleString('pt-BR')}
                      </strong>
                      <span className="block text-[10px] text-[#b5ff00]">
                        +{nextRenovationQuote.capacityGain.toLocaleString('pt-BR')} lugares
                      </span>
                    </div>

                    <div className="bg-[#14171f] border border-white/[0.06] rounded-xl p-2.5">
                      <span className="block text-[10px] text-zinc-400 font-sans">
                        Proteção contra Desistência
                      </span>
                      <strong className="text-[#b5ff00] text-sm">
                        {Math.round(
                          nextRenovationQuote.nextTier.priceRetentionShield * 100
                        )}
                        % retenção
                      </strong>
                      {nextLevelProjection && (
                        <span className="block text-[10px] text-zinc-300">
                          Est. {nextLevelProjection.attendance.toLocaleString('pt-BR')}{' '}
                          pagantes/jogo
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-xs text-zinc-300 space-y-1">
                  <div className="font-bold text-[#b5ff00]">
                    Estádio no Nível Máximo (Padrão Elite Internacional)
                  </div>
                  <p className="text-zinc-400">
                    Todas as expansões estruturais e setores de hospitalidade foram concluídos. Sua torcida apresenta máxima fidelização mesmo em jogos com ingressos valorizados.
                  </p>
                </div>
              )}
            </div>

            {nextRenovationQuote.nextTier && (
              <div className="pt-3 border-t border-white/[0.07] space-y-2">
                <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="text-zinc-400 font-sans">
                    Custo da Obra à Vista:
                  </span>
                  <strong className="text-base text-white">
                    {formatCompactBRL(nextRenovationQuote.cost)}
                  </strong>
                </div>

                {!nextRenovationQuote.canAfford && nextRenovationQuote.blockReason && (
                  <div className="text-[11px] text-rose-300">
                    {nextRenovationQuote.blockReason}
                  </div>
                )}

                <button
                  type="button"
                  data-testid="renovate-stadium-btn"
                  disabled={!nextRenovationQuote.canUpgrade}
                  onClick={() => onRenovateStadium?.()}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#b5ff00] hover:bg-[#c8ff33] disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-[#090a0f] text-xs font-extrabold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Hammer className="w-4 h-4 shrink-0" />
                  <span>
                    Reformar & Ampliar Estádio (+
                    {nextRenovationQuote.capacityGain.toLocaleString('pt-BR')} lug. ·{' '}
                    {formatCompactBRL(nextRenovationQuote.cost)})
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Split: 3 Clear Revenue Pillars & Expenses + Squad Payroll Ledger */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* 3 Revenue Pillars Breakdown (6 cols) */}
        <div className="xl:col-span-6 bg-[#14171f] border border-white/[0.07] rounded-[28px] p-5 space-y-5">
          <div>
            <h3 className="font-display text-xl font-extrabold uppercase tracking-tight text-white pb-2.5 border-b border-white/[0.07] flex items-center justify-between">
              <span>Receitas da Temporada ({ledger.seasonYear})</span>
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
                        Premiações Esportivas (Copas & Liga)
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Bônus acumulados de Copa do Brasil, Libertadores e Brasileirão
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
              <span>Saídas & Custos Mensais</span>
              <span className="font-mono text-sm tabular-nums text-rose-400">
                -{formatCompactBRL(totalSeasonOutflow)}
              </span>
            </h3>
            <div className="divide-y divide-white/[0.05] mt-2 text-xs">
              <div className="py-3 flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-white">
                    Folha Salarial Paga na Temporada
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {squad.length} atletas ativos
                    {loanedOutPlayers.length > 0
                      ? ` + ${loanedOutPlayers.length} cedido(s)`
                      : ''}{' '}
                    · {formatCompactBRL(totalMonthlyPayroll)}/mês (teto sem limite)
                  </div>
                </div>
                <span className="font-mono tabular-nums font-bold text-rose-400">
                  -{formatCompactBRL(payrollSpend)}
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

              {stadiumSpend > 0 && (
                <div className="py-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-white">
                      Obras & Reformas no Estádio ({club.stadium})
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Ampliação de arquibancadas e modernização de conforto ({currentTierInfo.shortLabel})
                    </div>
                  </div>
                  <span className="font-mono tabular-nums font-bold text-rose-400">
                    -{formatCompactBRL(stadiumSpend)}
                  </span>
                </div>
              )}

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
                    Custo Operacional (30% Patrocínio & Ingressos)
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    30% automático sobre toda receita de patrocínio e bilheteria (aplicado a todos os clubes)
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
                  <th className="py-3 px-2 font-medium">Escalação</th>
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
                            : 'text-zinc-300'
                        }
                      >
                        {p.isStarter ? 'Escalado' : 'Elenco'}
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
