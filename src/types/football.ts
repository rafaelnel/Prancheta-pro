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
  seasonStats: PlayerSeasonStats;
  contractType?: 'DEFINITIVO' | 'EMPRESTADO';
  loanOriginClubId?: string;
  loanOriginClubName?: string;
  wageSharePaid?: number;
  purchaseOptionFee?: number;
  loanDestinationClubName?: string;
  isRegen?: boolean;
  regenBatchYear?: number;
  isTransferListed?: boolean;
  isLoanListed?: boolean;
  recentOvrDelta?: number;
  exceededExpectations?: boolean;
  breakoutBonusOvr?: number;
  developmentStatus?:
    | 'SUPEROU_EXPECTATIVAS'
    | 'EVOLUCAO_NORMAL'
    | 'ESTAGNADO'
    | 'DECLINIO_TECNICO'
    | 'REGRESSAO_FISICA';
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

export type CompetitionType = 'BRASILEIRAO' | 'COPA_DO_BRASIL' | 'LIBERTADORES';

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

export interface Club {
  id: string;
  division: 'A' | 'B' | 'LIB';
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
  division?: 'A' | 'B' | 'LIB';
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

export interface SeasonCalendarStep {
  index: number;
  competition: CompetitionType;
  leagueRound?: number;
  copaStage?: CopaDoBrasilStage;
  libStage?: LibertadoresStage;
  libGroupRound?: number;
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
export type TransferOfferTier = 'PADRAO' | 'BONUS_15' | 'AGRESSIVA_30';
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
}

export interface TransferEvaluation {
  level: TransferDifficultyLevel;
  resistanceScore: number;
  acceptanceChance: number;
  clubGapNote: string;
  playerGapNote: string;
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
  status: 'CONCLUIDA' | 'RECUSADA';
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
}

export interface PitchTokenState {
  id: string;
  number: number;
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
  seasonOperationalExpense: number;
  seasonYouthAcademySpend?: number;
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
  oldAge: number;
  newAge: number;
  oldOvr: number;
  newOvr: number;
  deltaOvr: number;
  potentialStars: PotentialStars;
  reasonNote: string;
  exceededExpectations?: boolean;
  formerCeiling?: number;
  starsPromoted?: boolean;
  developmentStatus?:
    | 'SUPEROU_EXPECTATIVAS'
    | 'EVOLUCAO_NORMAL'
    | 'ESTAGNADO'
    | 'DECLINIO_TECNICO'
    | 'REGRESSAO_FISICA';
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
  userFinalDivision: 'A' | 'B';
  userFinalRank: number;
  userFinalPoints: number;
  userSeasonPrize: number;
  userPromoted: boolean;
  userRelegated: boolean;
  userQualifiedLibertadores: boolean;
  relegatedClubIds: string[];
  promotedClubIds: string[];
  libertadoresQualifiedBrIds: string[];
  awards: SeasonAwardsSummary;
  userEvolutionHighlights: PlayerEvolutionReportItem[];
  promotedYouthRegens?: YouthRegenReportItem[];
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
  topScorerName: string;
  topScorerClubName: string;
  topScorerGoals: number;
  topAssistName: string;
  topAssistClubName: string;
  topAssistCount: number;
  bestPlayerName: string;
  bestPlayerClubName: string;
  bestPlayerRating: number;
  userClubName: string;
  userDivision: 'A' | 'B';
  userRank: number;
  userPoints: number;
}

export type CareerSlotIndex = 1 | 2 | 3 | 4;

export interface CareerSaveData {
  version: number;
  slotIndex: CareerSlotIndex;
  managerName: string;
  userClubId: string;
  division: 'A' | 'B';
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
  messages: InboxMessage[];
  matchState: LiveMatchState;
  freeAgents?: Player[];
  loanedOutPlayers?: Player[];
  transferHistory?: TransferRecord[];
  transferredOutClubPlayerIds?: string[];
  pendingOffers?: IncomingTransferOffer[];
  financeLedger?: ClubFinanceLedger;
  youthAcademy?: YouthAcademyState;
  seasonHistory?: SeasonArchiveEntry[];
  seasonEndReport?: SeasonEndReport | null;
  midSeasonEvolutionProcessedYear?: number;
}


