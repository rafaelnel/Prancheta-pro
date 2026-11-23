export type NaturalPosition =
  | 'GOL'
  | 'ZAG'
  | 'LD'
  | 'LE'
  | 'VOL'
  | 'MC'
  | 'MEI'
  | 'PD'
  | 'PE'
  | 'ATA';

export type PositionSector = 'GOL' | 'DEF' | 'MEI' | 'ATA';

export type MoraleState =
  | 'Exuberante'
  | 'Muito Alta'
  | 'Bom'
  | 'Regular'
  | 'Baixa';

export type TacticalDuty = 'Defender' | 'Apoiar' | 'Atacar';

export type FormationType = '4-3-3' | '4-2-3-1' | '4-4-2' | '3-5-2';

export type MentalityType = 'Cautelosa' | 'Equilibrada' | 'Ofensiva';
export type DefensiveLineType = 'Baixa' | 'Padrão' | 'Alta';
export type PressingIntensityType = 'Contida' | 'Moderada' | 'Extrema';
export type PassingStyleType = 'Curto e Apoiado' | 'Misto' | 'Direto Vertical';

export interface TechnicalAttributes {
  passe: number;
  finalizacao: number;
  drible: number;
  desarme: number;
  primeiroToque: number;
  cruzamento: number;
}

export interface MentalAttributes {
  decisoes: number;
  visaoDeJogo: number;
  compostura: number;
  semBola: number;
  posicionamento: number;
  indiceDeTrabalho: number;
}

export interface PhysicalAttributes {
  velocidade: number;
  aceleracao: number;
  resistencia: number;
  forca: number;
  impulsao: number;
  agilidade: number;
}

export interface PlayerAttributes
  extends TechnicalAttributes,
    MentalAttributes,
    PhysicalAttributes {}

export type AttributeKey = keyof PlayerAttributes;

export interface TacticalRoleDefinition {
  id: string;
  name: string;
  shortCode: string;
  sector: PositionSector;
  allowedDuties: TacticalDuty[];
  description: string;
  keyAttributes: AttributeKey[];
  secondaryAttributes: AttributeKey[];
}

export type PotentialStars = 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5;

export type InjurySeverity = 'LEVE' | 'MODERADA' | 'GRAVE' | 'MUITO_GRAVE';

export interface InMatchInjuryRecord {
  playerId: string;
  playerName: string;
  team: 'HOME' | 'AWAY';
  minute: number;
  injuryType: string;
  severity: InjurySeverity;
  days: number;
  wasFatigued: boolean;
}

export interface PlayerSeasonStats {
  matches: number;
  goals: number;
  assists: number;
  yellowCards: number;
  avgRating: number;
}

export interface Player {
  id: string;
  number: number;
  name: string;
  age: number;
  nationality: string;
  position: NaturalPosition;
  sector: PositionSector;
  condition: number; // 0 to 100%
  morale: MoraleState;
  marketValue: number; // in BRL
  salary: number; // monthly in BRL
  potentialStars?: PotentialStars;
  basePotentialOvr?: number;
  dynamicCeilingOvr?: number;
  attributes: PlayerAttributes;
  isStarter: boolean;
  slotIndex: number | null; // 0..10 for starters, null for bench
  assignedRole: string; // TacticalRoleDefinition.id
  assignedDuty: TacticalDuty;
  injured: boolean;
  injuryNote?: string;
  injuryType?: string;
  injurySeverity?: InjurySeverity;
  injuryDaysRemaining?: number;
  injuryTotalDays?: number;
  consecutiveMatches?: number;
  seasonStats: PlayerSeasonStats;
  contractType?: 'DEFINITIVO' | 'EMPRESTADO';
  contractYearsRemaining?: number; // 1 = expires at end of current season; 2 = eligible for early renewal
  contractEndYear?: number;
  loanDurationYears?: 1 | 2;
  contractRenewalStatus?: 'PENDENTE' | 'RENOVADO' | 'RECUSADO';
  loanOriginClubId?: string;
  loanOriginClubName?: string;
  wageSharePaid?: number;
  purchaseOptionFee?: number;
  loanDestinationClubName?: string;
  isRegen?: boolean;
  regenBatchYear?: number;
  isTransferListed?: boolean;
  isLoanListed?: boolean;
  marketListingReason?: string;
  recentOvrDelta?: number;
  exceededExpectations?: boolean;
  breakoutBonusOvr?: number;
  growthMultiplier?: number;
  developmentStatus?:
    | 'SUPEROU_EXPECTATIVAS'
    | 'EVOLUCAO_NORMAL'
    | 'ESTAGNADO'
    | 'DECLINIO_TECNICO'
    | 'REGRESSAO_FISICA';
}

export type ContractFlexibility = 'Alta' | 'Média' | 'Baixa';

export interface ContractRenewalExpectation {
  playerId: string;
  currentOvr: number;
  recentOvrDelta: number;
  fairMarketValue: number;
  currentSalary: number;
  desiredSalary: number;
  salaryDeltaPct: number;
  desiredAddYears: 1 | 2 | 3;
  flexibility: ContractFlexibility;
  flexibilityScore: number; // 0..100
  isExpiringFinalYear: boolean; // contractYearsRemaining <= 1
  canRenewEarly: boolean; // contractYearsRemaining === 2 (ano anterior ao vencimento)
  demandReason: string;
}

export interface ContractRenewalOutcome {
  outcome: 'ACEITA' | 'CONTRAPROPOSTA' | 'RECUSADA';
  headline: string;
  summary: string;
  factors: string[];
  offeredSalary: number;
  offeredAddYears: 1 | 2 | 3;
  counterSalary?: number;
  counterAddYears?: 1 | 2 | 3;
  updatedPlayer?: Player;
  expectation: ContractRenewalExpectation;
}

export interface FormationSlot {
  slotIndex: number; // 0..10
  label: NaturalPosition;
  sector: PositionSector;
  defaultRole: string;
  defaultDuty: TacticalDuty;
  x: number; // 0..100 (left to right on horizontal pitch, or bottom to top)
  y: number; // 0..100
}

export interface TeamInstructions {
  mentality: MentalityType;
  defensiveLine: DefensiveLineType;
  pressingIntensity: PressingIntensityType;
  passingStyle: PassingStyleType;
}

export interface OpponentStarPlayer {
  name: string;
  position: NaturalPosition;
  overall: number;
  highlightAttribute: string;
}

export type CompetitionType =
  | 'BRASILEIRAO'
  | 'COPA_DO_BRASIL'
  | 'LIBERTADORES'
  | 'CHAMPIONS_LEAGUE'
  | 'MUNDIAL'
  | 'SUPER_MUNDIAL';

export type CopaDoBrasilStage =
  | '3ª Fase'
  | 'Oitavas'
  | 'Quartas'
  | 'Semifinal'
  | 'Final';

export type LibertadoresKnockoutStage =
  | 'Oitavas'
  | 'Quartas'
  | 'Semifinal'
  | 'Final';

export type LibertadoresStage = 'Grupos' | LibertadoresKnockoutStage;

export type LibertadoresGroupName =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H';

export type ChampionsKnockoutStage =
  | 'Oitavas'
  | 'Quartas'
  | 'Semifinal'
  | 'Final';

export type MundialStage = 'Semifinal' | 'Final';

export type SuperMundialGroupName = 'A' | 'B' | 'C' | 'D';

export type SuperMundialKnockoutStage = 'Quartas' | 'Semifinal' | 'Final';

export type SuperMundialStage = 'Grupos' | SuperMundialKnockoutStage;

export type ClubDivision =
  | 'A'
  | 'B'
  | 'LIB'
  | 'UCL'
  | 'PL'
  | 'LALIGA'
  | 'BUNDESLIGA'
  | 'SERIE_A_IT'
  | 'LIGUE_1'
  | 'LIGA_PORTUGAL'
  | 'WORLD';
export type PlayableDivision =
  | 'A'
  | 'B'
  | 'PL'
  | 'LALIGA'
  | 'BUNDESLIGA'
  | 'SERIE_A_IT'
  | 'LIGUE_1'
  | 'LIGA_PORTUGAL';

export interface Club {
  id: string;
  division: ClubDivision;
  country?: string;
  countryCode?: string;
  name: string;
  shortName: string;
  abbr: string;
  city: string;
  state: string;
  primaryColor: string;
  secondaryColor: string;
  stadium: string;
  capacity: number;
  stadiumRenovationLevel?: number; // 0 to 4 (comfort, structure & modernization level)
  ticketPriceMultiplier?: number; // 0.70 to 1.80 (1.00 = reference regional ticket price)
  reputation: number; // 1 to 100
  overallAttack: number; // 60 to 99 scale
  overallMidfield: number; // 60 to 99 scale
  overallDefense: number; // 60 to 99 scale
  cashBalance: number;
  wageBudget: number;
  boardConfidence: number; // 0 to 100%
  formation: FormationType;
  instructions: TeamInstructions;
  starPlayers: OpponentStarPlayer[];
  recentTitles?: string[];
}

export interface StandingsRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: ('V' | 'E' | 'D')[];
}

export interface RoundFixture {
  id: string;
  division?: ClubDivision;
  competition?: CompetitionType;
  stageLabel?: string;
  groupName?: LibertadoresGroupName;
  roundNumber: number;
  homeClubId: string;
  awayClubId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  homePenalties?: number | null;
  awayPenalties?: number | null;
  winnerClubId?: string | null;
  homeXG?: number;
  awayXG?: number;
  played: boolean;
  isUserMatch: boolean;
}

export interface CopaDoBrasilState {
  participantIds: string[];
  currentStage: CopaDoBrasilStage;
  fixturesByStage: Record<CopaDoBrasilStage, RoundFixture[]>;
  eliminatedIds: string[];
  championClubId: string | null;
}

export interface LibertadoresGroup {
  name: LibertadoresGroupName;
  clubIds: string[];
  standings: StandingsRow[];
  fixtures: RoundFixture[];
}

export interface LibertadoresState {
  participantIds: string[];
  currentPhase: LibertadoresStage;
  groupRound: number; // 1..6 during group stage
  groups: LibertadoresGroup[];
  knockoutFixtures: Record<LibertadoresKnockoutStage, RoundFixture[]>;
  eliminatedIds: string[];
  championClubId: string | null;
}

export interface ChampionsLeagueState {
  seasonYear: number;
  participantIds: string[];
  currentStage: ChampionsKnockoutStage;
  fixturesByStage: Record<ChampionsKnockoutStage, RoundFixture[]>;
  eliminatedIds: string[];
  quarterfinalistIds: string[];
  semifinalistIds: string[];
  runnerUpClubId: string | null;
  championClubId: string | null;
}

export interface MundialState {
  seasonYear: number;
  isSeeded: boolean;
  participantIds: string[];
  uefaChampionId: string | null;
  conmebolChampionId: string | null;
  globalClubIds: string[];
  currentStage: MundialStage;
  fixturesByStage: Record<MundialStage, RoundFixture[]>;
  eliminatedIds: string[];
  runnerUpClubId: string | null;
  championClubId: string | null;
}

export interface SuperMundialGroup {
  name: SuperMundialGroupName;
  clubIds: string[];
  standings: StandingsRow[];
  fixtures: RoundFixture[];
}

export interface SuperMundialState {
  editionYear: number;
  isActiveThisSeason: boolean;
  nextEditionYear: number;
  participantIds: string[];
  uefaQualifiedIds: string[];
  conmebolQualifiedIds: string[];
  globalQualifiedIds: string[];
  currentPhase: SuperMundialStage;
  groupRound: number; // 1..3 during group stage
  groups: SuperMundialGroup[];
  knockoutFixtures: Record<SuperMundialKnockoutStage, RoundFixture[]>;
  eliminatedIds: string[];
  runnerUpClubId: string | null;
  championClubId: string | null;
}

export interface SeasonCalendarStep {
  index: number;
  competition: CompetitionType;
  leagueRound?: number;
  copaStage?: CopaDoBrasilStage;
  libStage?: LibertadoresStage;
  libGroupRound?: number;
  uclStage?: ChampionsKnockoutStage;
  mundialStage?: MundialStage;
  superMundialStage?: SuperMundialStage;
  superMundialGroupRound?: number;
  dayOffset?: number;
  label: string;
}

export type NavigationTab =
  | 'inbox'
  | 'squad'
  | 'tactics'
  | 'match'
  | 'market'
  | 'youth'
  | 'calendar'
  | 'competitions'
  | 'finances';

export interface InboxMessage {
  id: string;
  date: string;
  sender: string;
  senderRole: string;
  subject: string;
  category:
    | 'Tática'
    | 'Departamento Médico'
    | 'Diretoria'
    | 'Olheiro'
    | 'Mercado'
    | 'Imprensa'
    | 'Pós-Jogo';
  priority: 'normal' | 'warning' | 'danger' | 'positive';
  body: string[];
  bulletPoints?: string[];
  read: boolean;
  actionLabel?: string;
  actionTargetTab?: NavigationTab;
  relatedPlayerId?: string;
  relatedOfferId?: string;
}

export type MarketLeagueScope =
  | 'SERIE_A'
  | 'SERIE_B'
  | 'LIBERTADORES'
  | 'INTERNACIONAL'
  | 'LIVRES';

export interface MarketClubProfile {
  id: string;
  name: string;
  shortName: string;
  abbr: string;
  country: string;
  leagueName: string;
  scope: MarketLeagueScope;
  primaryColor: string;
  reputation: number;
  avgStrength: number;
}

export type TransferDealMode = 'BUY' | 'LOAN' | 'FREE';
export type TransferOfferTier =
  | 'PADRAO'
  | 'BONUS_15'
  | 'AGRESSIVA_30'
  | 'FORTE_50';
export type TransferDifficultyLevel =
  | 'Fácil'
  | 'Moderada'
  | 'Difícil'
  | 'Muito Difícil';

export interface MarketPlayerListing {
  player: Player;
  ovr: number;
  originClub: MarketClubProfile | null;
  scope: MarketLeagueScope;
  isClubStarter: boolean;
  buyFee: number;
  loanFee: number;
  loanAvailable: boolean;
  isTransferListed?: boolean;
  isLoanListed?: boolean;
  listingReason?: string;
}

export interface TransferEvaluation {
  level: TransferDifficultyLevel;
  resistanceScore: number;
  acceptanceChance: number;
  clubGapNote: string;
  playerGapNote: string;
  playerWillingnessChance: number;
  playerAmbitionNote: string;
  moneyInfluenceNote: string;
  willHardRejectByPlayer: boolean;
  effectiveFee: number;
  effectiveSalary: number;
  projectedCash: number;
  projectedPayroll: number;
  projectedWagePct: number;
  canAffordCash: boolean;
  fitsWageBudget: boolean;
  isBlocked: boolean;
  blockReason: string | null;
}

export type TransferOutcomeStatus = 'ACEITA' | 'CONTRAPROPOSTA' | 'RECUSADA';

export interface TransferCounterOffer {
  source: 'CLUBE' | 'JOGADOR' | 'AMBOS';
  counterFee: number;
  counterSalary: number;
  counterLoanWageShare?: 0.5 | 0.75 | 1.0;
  summary: string;
}

export interface PlayerNegotiationState {
  playerId: string;
  attemptsCount: number;
  maxAttempts: number;
  blockedUntilAbsDay: number | null;
  blockedUntilDateLabel?: string;
  blockedReason?: string;
  lastAttemptAbsDay: number;
}

export interface TransferAttemptResult {
  id: string;
  listing: MarketPlayerListing;
  dealMode: TransferDealMode;
  offerTier: TransferOfferTier;
  offerMultiplier?: number;
  salaryOfferMult: number;
  loanWageShare: 0.5 | 0.75 | 1.0;
  contractYears?: 2 | 3 | 4;
  loanDurationYears?: 1 | 2;
  outcome: TransferOutcomeStatus;
  rejectedBy?: 'CLUBE' | 'JOGADOR' | 'ORCAMENTO';
  headline: string;
  summary: string;
  factors: string[];
  offeredFee: number;
  offeredSalary: number;
  evaluation: TransferEvaluation;
  counterOffer?: TransferCounterOffer;
  signedPlayer?: Player | null;
  negotiationBlockedUntilLabel?: string;
  negotiationAttemptsCount?: number;
  negotiationMaxAttempts?: number;
}

export type TransferRecordType =
  | 'COMPRA'
  | 'LIVRE'
  | 'EMPRESTIMO_IN'
  | 'VENDA'
  | 'EMPRESTIMO_OUT';

export interface TransferRecord {
  id: string;
  date: string;
  type: TransferRecordType;
  status: 'CONCLUIDA' | 'RECUSADA' | 'CONTRAPROPOSTA';
  playerName: string;
  position: NaturalPosition;
  ovr: number;
  counterpartyClubName: string;
  feeAmount: number;
  monthlySalaryImpact: number;
  note: string;
  isAiTransfer?: boolean;
  fromClubName?: string;
  toClubName?: string;
  dealType?: 'COMPRA' | 'EMPRESTIMO';
  durationYears?: number;
}

export interface WatchedPlayerEntry {
  playerId: string;
  playerName: string;
  position: NaturalPosition;
  addedAtDate: string;
  addedYear: number;
  addedOvr: number;
  addedMarketValue: number;
  addedSalary: number;
  addedAge: number;
  addedClubName: string;
  addedScope: MarketLeagueScope;
}

export type MatchEventType =
  | 'GOL'
  | 'DEFESA'
  | 'CHUTE_FORA'
  | 'TRAVE'
  | 'CARTAO_AMARELO'
  | 'SUBSTITUICAO'
  | 'PASSE_CHAVE'
  | 'DESARME'
  | 'LESAO'
  | 'INICIO'
  | 'INTERVALO'
  | 'FIM';

export interface MatchEvent {
  id: string;
  minute: number;
  type: MatchEventType;
  team: 'HOME' | 'AWAY' | 'NEUTRAL';
  text: string;
  scorerName?: string;
  assistName?: string;
  playerId?: string;
  xGAdded?: number;
  injuryType?: string;
  injuryDays?: number;
  injurySeverity?: InjurySeverity;
}

export interface PitchTokenState {
  id: string;
  number: number;
  ovr?: number;
  name: string;
  shortName: string;
  team: 'HOME' | 'AWAY';
  sector: PositionSector;
  baseX: number; // 0..100 horizontal pitch coordinate
  baseY: number; // 0..100 vertical pitch coordinate
  x: number;
  y: number;
  hasBall: boolean;
  roleCode: string;
  condition: number;
  rating: number;
  injuredInMatch?: boolean;
}

export type MatchPhase =
  | 'PRE_MATCH'
  | 'FIRST_HALF'
  | 'HALF_TIME'
  | 'SECOND_HALF'
  | 'FULL_TIME';

export interface LiveMatchState {
  roundNumber: number;
  fixtureId: string;
  competition?: CompetitionType;
  competitionLabel?: string;
  isKnockout?: boolean;
  homePenalties?: number | null;
  awayPenalties?: number | null;
  winnerClubId?: string | null;
  minute: number;
  subTick: number; // 0..3 within a minute for smooth 2D movement
  isRunning: boolean;
  speed: 1 | 2 | 4;
  phase: MatchPhase;
  homeClubId: string;
  awayClubId: string;
  isUserHome: boolean;
  homeGoals: number;
  awayGoals: number;
  homePossessionTicks: number;
  awayPossessionTicks: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeXG: number;
  awayXG: number;
  homeCorners: number;
  awayCorners: number;
  homePasses: number;
  awayPasses: number;
  homeFouls: number;
  awayFouls: number;
  ballX: number;
  ballY: number;
  ballTargetX: number;
  ballTargetY: number;
  ballCarrierTeam: 'HOME' | 'AWAY';
  ballCarrierNumber: number;
  ballCarrierName: string;
  activeZone: 'DEF_HOME' | 'MIDFIELD' | 'DEF_AWAY';
  lastActionLabel: string;
  events: MatchEvent[];
  homeTokens: PitchTokenState[];
  awayTokens: PitchTokenState[];
  substitutionsMade: number;
  maxSubstitutions: number;
  roundProcessed: boolean;
  inMatchInjuries?: InMatchInjuryRecord[];
}

export interface SponsorshipContract {
  sponsorName: string;
  tierLabel: string;
  annualValue: number;
  monthlyInstallment: number;
  basisNote: string;
  seasonYear: number;
}

export type YouthInvestmentTier = 'BASICO' | 'ESTRUTURADO' | 'AVANCADO' | 'ELITE';

export type YouthFocusSector = 'EQUILIBRADO' | PositionSector;

export interface YouthRegenReportItem {
  id: string;
  name: string;
  age: number;
  position: NaturalPosition;
  sector: PositionSector;
  ovr: number;
  potentialStars: PotentialStars;
  basePotentialOvr?: number;
  dynamicCeilingOvr?: number;
  marketValue: number;
  salary: number;
  highlightNote: string;
}

export interface YouthAcademyState {
  investmentTier: YouthInvestmentTier;
  focusSector: YouthFocusSector;
  monthlyCost: number;
  accumulatedSeasonInvestment: number;
  monthsInvestedThisSeason: number;
  lastGraduatedRegens: YouthRegenReportItem[];
  youthRoster?: Player[];
}

export interface ClubFinanceLedger {
  seasonYear: number;
  seasonGateRevenue: number;
  seasonTransferIncome: number;
  seasonTransferSpend: number;
  seasonPrizeRevenue: number;
  seasonSponsorshipRevenue: number;
  seasonPayrollExpense?: number;
  seasonOperationalExpense: number;
  seasonYouthAcademySpend?: number;
  seasonStadiumRenovationSpend?: number;
  lastMatchGateRevenue: number;
  lastMatchAttendance: number;
  sponsorshipContract: SponsorshipContract;
  youthAcademy?: YouthAcademyState;
}

export interface IncomingTransferOffer {
  id: string;
  createdAtDate: string;
  fromClubId: string;
  fromClubName: string;
  fromClubAbbr: string;
  fromClubPrimaryColor: string;
  fromClubReputation: number;
  playerId: string;
  playerName: string;
  playerPosition: NaturalPosition;
  playerOvr: number;
  playerAge: number;
  playerPotentialStars: PotentialStars;
  playerMarketValue?: number;
  playerSalary?: number;
  playerPotentialOvr?: number;
  playerIsStarter?: boolean;
  playerContractYearsRemaining?: number;
  dealType: 'BUY' | 'LOAN';
  offeredFee: number;
  wageShareCovered: number; // 0..1 (for loan)
  expiresDayOffset: number;
  negotiationStep: 0 | 1 | 2; // 0=initial, 1=+15%, 2=+30%
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  rationale: string;
}

export interface SeasonAwardPlayer {
  playerId: string;
  playerName: string;
  clubId: string;
  clubName: string;
  position: NaturalPosition;
  ovr: number;
  value: number;
}

export interface SeasonAwardsSummary {
  topScorer: SeasonAwardPlayer | null;
  topAssist: SeasonAwardPlayer | null;
  bestPlayer: SeasonAwardPlayer | null;
}

export interface PlayerEvolutionReportItem {
  playerId: string;
  playerName: string;
  position: NaturalPosition;
  shirtNumber?: number;
  oldAge: number;
  newAge: number;
  oldOvr: number;
  newOvr: number;
  deltaOvr: number;
  oldPotentialStars?: PotentialStars;
  potentialStars: PotentialStars;
  oldMarketValue?: number;
  newMarketValue?: number;
  matchesPlayed?: number;
  goals?: number;
  assists?: number;
  avgRating?: number;
  isLoanedOut?: boolean;
  reasonNote: string;
  exceededExpectations?: boolean;
  breakoutBonusOvr?: number;
  growthMultiplier?: number;
  formerCeiling?: number;
  starsPromoted?: boolean;
  developmentStatus?:
    | 'SUPEROU_EXPECTATIVAS'
    | 'EVOLUCAO_NORMAL'
    | 'ESTAGNADO'
    | 'DECLINIO_TECNICO'
    | 'REGRESSAO_FISICA';
}

export interface NewSeasonEvolutionReport {
  fromYear: number;
  toYear: number;
  clubId: string;
  clubName: string;
  items: PlayerEvolutionReportItem[];
  retiredPlayers: RetiredPlayerReportItem[];
  squadAvgOvrBefore: number;
  squadAvgOvrAfter: number;
}

export interface RetiredPlayerReportItem {
  playerId: string;
  playerName: string;
  position: NaturalPosition;
  ageAtRetirement: number;
  lastOvr: number;
  matchesPlayed: number;
  reasonNote: string;
}

export interface SeasonEndReport {
  seasonYear: number;
  serieAChampionId: string;
  serieAChampionName: string;
  serieBChampionId: string;
  serieBChampionName: string;
  cdbChampionId: string | null;
  cdbChampionName: string | null;
  libChampionId: string | null;
  libChampionName: string | null;
  uclChampionId?: string | null;
  uclChampionName?: string | null;
  mundialChampionId?: string | null;
  mundialChampionName?: string | null;
  superMundialChampionId?: string | null;
  superMundialChampionName?: string | null;
  premierLeagueChampionId?: string | null;
  premierLeagueChampionName?: string | null;
  laLigaChampionId?: string | null;
  laLigaChampionName?: string | null;
  bundesligaChampionId?: string | null;
  bundesligaChampionName?: string | null;
  serieAItChampionId?: string | null;
  serieAItChampionName?: string | null;
  ligue1ChampionId?: string | null;
  ligue1ChampionName?: string | null;
  ligaPortugalChampionId?: string | null;
  ligaPortugalChampionName?: string | null;
  userFinalDivision: PlayableDivision;
  userFinalRank: number;
  userFinalPoints: number;
  userSeasonPrize: number;
  userPromoted: boolean;
  userRelegated: boolean;
  userQualifiedLibertadores: boolean;
  userQualifiedChampionsLeague?: boolean;
  relegatedClubIds: string[];
  promotedClubIds: string[];
  libertadoresQualifiedBrIds: string[];
  awards: SeasonAwardsSummary;
  userEvolutionHighlights: PlayerEvolutionReportItem[];
  promotedYouthRegens?: YouthRegenReportItem[];
  expiringContractsCount?: number;
  expiredPlayerNames?: string[];
  returnedLoanNames?: string[];
  retiredPlayers?: RetiredPlayerReportItem[];
  thinkingRetirementNames?: string[];
  starterOvrHistory?: SeasonStarterOvrPoint[];
}

export interface SeasonStarterOvrPoint {
  id: string;
  label: string;
  periodTitle: string;
  starterAvgOvr: number;
  avgRating: number;
  deltaOvr: number;
  matchesCount: number;
}

export interface SeasonArchiveEntry {
  year: number;
  serieAChampionId: string;
  serieAChampionName: string;
  serieBChampionId: string;
  serieBChampionName: string;
  cdbChampionId: string | null;
  cdbChampionName: string | null;
  libChampionId: string | null;
  libChampionName: string | null;
  uclChampionId?: string | null;
  uclChampionName?: string | null;
  mundialChampionId?: string | null;
  mundialChampionName?: string | null;
  superMundialChampionId?: string | null;
  superMundialChampionName?: string | null;
  topScorerName: string;
  topScorerClubName: string;
  topScorerGoals: number;
  topAssistName: string;
  topAssistClubName: string;
  topAssistCount: number;
  bestPlayerName: string;
  bestPlayerClubName: string;
  bestPlayerRating: number;
  premierLeagueChampionId?: string | null;
  premierLeagueChampionName?: string | null;
  laLigaChampionId?: string | null;
  laLigaChampionName?: string | null;
  bundesligaChampionId?: string | null;
  bundesligaChampionName?: string | null;
  serieAItChampionId?: string | null;
  serieAItChampionName?: string | null;
  ligue1ChampionId?: string | null;
  ligue1ChampionName?: string | null;
  ligaPortugalChampionId?: string | null;
  ligaPortugalChampionName?: string | null;
  userClubName: string;
  userDivision: PlayableDivision;
  userRank: number;
  userPoints: number;
}

export interface MatchHistoryRecord {
  id: string;
  fixtureId: string;
  seasonYear: number;
  dateLabel: string;
  competition: CompetitionType;
  competitionLabel: string;
  roundNumber: number;
  homeClubId: string;
  awayClubId: string;
  homeGoals: number;
  awayGoals: number;
  homePenalties?: number | null;
  awayPenalties?: number | null;
  winnerClubId?: string | null;
  isKnockout?: boolean;
  userStarterAvgOvr?: number;
  userStarterAvgRating?: number;
  userMatchAvgRating?: number;
}

export type CareerSlotIndex = 1 | 2 | 3 | 4;

export interface CareerSaveData {
  version: number;
  slotIndex: CareerSlotIndex;
  managerName: string;
  userClubId: string;
  division: PlayableDivision;
  clubName: string;
  clubShortName: string;
  clubAbbr: string;
  clubPrimaryColor: string;
  currentYear?: number;
  currentRound: number;
  seasonStepIndex?: number;
  activeCompetition?: CompetitionType;
  dayOffset: number;
  isMatchDay: boolean;
  userRank: number;
  cashBalance: number;
  boardConfidence: number;
  savedAt: string;
  clubs: Club[];
  squad: Player[];
  aiSquads?: Record<string, Player[]>;
  standings: StandingsRow[];
  fixtures: RoundFixture[];
  secondaryStandings?: StandingsRow[];
  secondaryFixtures?: RoundFixture[];
  copaDoBrasil?: CopaDoBrasilState;
  libertadores?: LibertadoresState;
  championsLeague?: ChampionsLeagueState;
  mundial?: MundialState;
  superMundial?: SuperMundialState;
  accumulatedUclChampions?: string[];
  accumulatedLibChampions?: string[];
  messages: InboxMessage[];
  matchState: LiveMatchState;
  matchHistory?: MatchHistoryRecord[];
  freeAgents?: Player[];
  loanedOutPlayers?: Player[];
  transferHistory?: TransferRecord[];
  transferredOutClubPlayerIds?: string[];
  watchedPlayers?: WatchedPlayerEntry[];
  pendingOffers?: IncomingTransferOffer[];
  financeLedger?: ClubFinanceLedger;
  youthAcademy?: YouthAcademyState;
  seasonHistory?: SeasonArchiveEntry[];
  seasonEndReport?: SeasonEndReport | null;
  newSeasonEvolutionReport?: NewSeasonEvolutionReport | null;
  midSeasonEvolutionProcessedYear?: number;
  negotiationStates?: Record<string, PlayerNegotiationState>;
  globalScaleVersion?: number;
}


