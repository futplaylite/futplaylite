export type UserRole = 'player' | 'coach' | 'admin' | 'moderator';
export type AccountStatus = 'ativa' | 'suspensa' | 'encerrada';
export type PlayerPosition = 'goleiro' | 'defensor' | 'meio-campista' | 'atacante' | 'multiplas';
export type DominantFoot = 'direito' | 'esquerdo' | 'ambos';
export type ProfileVisibility = 'publico' | 'restrito' | 'privado';
export type DivisionName = 'Bronze' | 'Prata' | 'Ouro' | 'Platina' | 'Diamante';

export type MatchFormat = '5v5' | '6v6' | '7v7' | '11v11' | 'personalizado';
export type TeamModality =
  | 'society'
  | 'futsal'
  | 'futebol_areia'
  | 'futebol_campo';

export type MatchStatus =
  | 'rascunho'
  | 'partida_cadastrada'
  | 'escalacao_confirmada'
  | 'em_andamento'
  | 'resultado_enviado'
  | 'aguardando_confirmacoes'
  | 'validada'
  | 'contestada'
  | 'analise_moderacao'
  | 'anulada'
  | 'cancelada';

export type ParticipationStatus =
  | 'convidado'
  | 'confirmado'
  | 'participou'
  | 'nao_compareceu'
  | 'removido';

export type MatchEventType =
  | 'gol'
  | 'assistencia'
  | 'mvp'
  | 'super_capa'
  | 'capa_goleiro'
  | 'cartao_amarelo'
  | 'cartao_azul'
  | 'cartao_vermelho'
  | 'defesa_dificil'
  | 'acao_defensiva';

export type ConfirmationType = 'concordancia' | 'contestacao' | 'abstencao';

export type DisputeReasonCode =
  | 'placar_incorreto'
  | 'escalacao_irregular'
  | 'gols_divergentes'
  | 'partida_inexistente'
  | 'suspeita_conluio'
  | 'outro';

export interface User {
  id: string;
  email: string;
  whatsappNumber?: string;
  avatarUrl?: string;
  teamName?: string;
  teamCity?: string;
  teamCrestUrl?: string;
  teamModality?: TeamModality;
  teamInviteCode?: string;
  isTeamOwner?: boolean;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
}

export interface City {
  id: string;
  name: string;
  stateCode: string;
  regionName: string;
  countryCode: string;
  slug: string;
  status: 'em_preparacao' | 'ativa' | 'desativada';
}

export interface Division {
  id: string;
  name: DivisionName;
  tier: 1 | 2 | 3 | 4 | 5;
  minRating: number;
  maxRating: number | null;
  minMatchesRequired: number;
  rulesetVersion: string;
}

export interface PlayerProfile {
  id: string;
  userId: string;
  displayName: string;
  fullNamePrivate?: string; // Privado (LGPD - nunca exposto em perfil público)
  whatsappNumber?: string;
  avatarUrl?: string;
  teamName?: string;
  teamCity?: string;
  teamCrestUrl?: string;
  teamModality?: TeamModality;
  teamInviteCode?: string;
  isTeamOwner?: boolean;
  avatarColor: string;
  cityId: string;
  neighborhood: string;
  position: PlayerPosition;
  dominantFoot: DominantFoot;
  profileVisibility: ProfileVisibility;
  currentRating: number;
  ratingUncertainty: number; // 15 a 100
  isProvisional: boolean;
  currentDivisionId: string;
  totalValidatedMatches: number;
  experimentalPositionScore: number | null; // 0-100 experimental (Seção 3.3)
  badges: string[];
  skills?: PlayerSkillRatings;
  overallStars?: number; // 1.0 a 5.0
  createdAt: string;
  updatedAt: string;
}

export interface PlayerSkillRatings {
  finalizacao: number; // 1 a 5
  marcacao: number;    // 1 a 5
  passe: number;       // 1 a 5
  raca: number;        // 1 a 5
  drible: number;      // 1 a 5
  totalVotes?: number;
  lastRatedAt?: string;
}

export interface Season {
  id: string;
  cityId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  gracePeriodEndsAt: string;
  durationWeeks: number;
  rulesetVersion: string;
  status: 'planejada' | 'ativa' | 'tolerancia' | 'encerrada' | 'arquivada';
}

export interface SeasonEntry {
  id: string;
  seasonId: string;
  playerId: string;
  divisionId: string;
  seasonPoints: number;
  pendingPoints: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
  mvpCount: number;
  superCapas?: number;
  goalkeeperCapas?: number;
  capaEfficiencyPct?: number;
  yellowCards?: number;
  blueCards?: number;
  redCards?: number;
  cleanSheets: number;
  defensiveActions: number;
  status: 'provisorio' | 'elegivel' | 'suspenso' | 'encerrado';
  updatedAt: string;
}

export interface MatchPlayer {
  id: string;
  matchId: string;
  playerId: string;
  teamSide: 'home' | 'away';
  isCaptain: boolean;
  positionPlayed: Exclude<PlayerPosition, 'multiplas'>;
  participationStatus: ParticipationStatus;
  minutesPlayed: number;
  confirmedAt?: string;
}

export interface MatchEvent {
  id: string;
  matchId: string;
  resultVersionId: string;
  playerId: string;
  eventType: MatchEventType;
  eventMinute?: number;
  recordedBy: string;
  verificationStatus: 'pendente' | 'validado' | 'rejeitado';
  createdAt: string;
}

export interface MatchResultVersion {
  id: string;
  matchId: string;
  versionNumber: number;
  homeScore: number;
  awayScore: number;
  mvpPlayerId?: string;
  submittedBy: string;
  validationStatus: 'pendente' | 'validado' | 'contestado' | 'substituido' | 'anulado';
  validatedBy?: string;
  validatedAt?: string;
  correctionReason?: string;
  createdAt: string;
}

export interface ResultConfirmation {
  id: string;
  matchId: string;
  resultVersionId: string;
  userId: string;
  playerId: string;
  teamSide: 'home' | 'away';
  confirmationType: ConfirmationType;
  comment?: string;
  createdAt: string;
}

export interface Dispute {
  id: string;
  matchId: string;
  resultVersionId: string;
  openedBy: string;
  reasonCode: DisputeReasonCode;
  description: string;
  status: 'aberta' | 'em_analise' | 'resolvida' | 'rejeitada';
  assignedModerator?: string;
  resolutionReason?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface EvidenceFile {
  id: string;
  matchId: string;
  resultVersionId?: string;
  uploadedBy: string;
  evidenceType: 'foto_sumula' | 'foto_placar' | 'registro_escalacao' | 'video_lance';
  title: string;
  privateUrlToken: string;
  isPrivate: boolean;
  createdAt: string;
}

export interface FraudSignal {
  id: string;
  code:
    | 'FREQUENCIA_ATIPICA_MESMO_GRUPO'
    | 'CONFLITO_CONFIRMACOES'
    | 'AUTO_CONFIRMACAO_BLOQUEADA'
    | 'ESCALACAO_ALTERADA_POS_INICIO'
    | 'TENTATIVA_PARTIDA_DUPLICADA';
  severity: 'baixa' | 'media' | 'alta';
  description: string;
  detectedAt: string;
}

export interface Match {
  id: string;
  cityId: string;
  seasonId: string;
  createdBy: string;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  lineupFrozenAt?: string;
  venueName: string;
  neighborhood: string;
  format: MatchFormat;
  homeTeamName: string;
  awayTeamName: string;
  homeCaptainId: string;
  awayCaptainId: string;
  status: MatchStatus;
  officialHomeScore?: number;
  officialAwayScore?: number;
  activeResultVersionId?: string;
  rulesetVersion: string;
  fraudHold: boolean;
  fraudSignals: FraudSignal[];
  createdAt: string;
  updatedAt: string;
}

export interface PointBreakdown {
  participation: number; // +5
  resultBonus: number; // +15 vitória, +5 empate, 0 derrota
  goalsPoints: number; // 3 * G
  assistsPoints: number; // 2 * A
  mvpPoints: number; // 3 * M
  goalsCount: number;
  assistsCount: number;
  isMvp: boolean;
  total: number;
}

export interface PointTransaction {
  id: string;
  playerId: string;
  seasonId: string;
  matchId: string;
  sourceResultVersionId: string;
  transactionType: 'credito' | 'reversao' | 'ajuste_administrativo';
  pointsDelta: number;
  breakdown: PointBreakdown;
  reasonCode: string;
  createdBy: string;
  createdAt: string;
}

export interface PlayerRatingLog {
  id: string;
  playerId: string;
  matchId: string;
  resultVersionId: string;
  operationType: 'aplicacao' | 'reversao';
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  uncertaintyBefore: number;
  uncertaintyAfter: number;
  kFactor: number;
  expectedScore: number;
  actualScore: number;
  teamAvgRating: number;
  opponentAvgRating: number;
  algorithmVersion: string;
  calculationStatus: 'aplicado' | 'revertido';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorUserId: string;
  actorName: string;
  actorRole: UserRole;
  actionType: string;
  entityType: string;
  entityId: string;
  reason: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  createdAt: string;
}

export interface HomologationTestResult {
  id: string;
  code: string;
  title: string;
  criteriaRef: string;
  passed: boolean;
  details: string;
  formulaCheck?: string;
  executedAt: string;
}
