import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AuditLog,
  City,
  Dispute,
  DisputeReasonCode,
  Division,
  DominantFoot,
  EvidenceFile,
  Match,
  MatchEvent,
  MatchFormat,
  MatchPlayer,
  MatchResultVersion,
  MonthlyPaymentRecord,
  PeladaMonthlyConfig,
  PlayerPosition,
  PlayerProfile,
  PlayerRatingLog,
  PeerEvaluation,
  PlayerAdminAdjustment,
  PlayerStatAdjustmentDiff,
  PointTransaction,
  ProfileVisibility,
  ResultConfirmation,
  Season,
  SeasonEntry,
  SumulaData,
  TeamModality,
  TeamTransaction,
  User,
  UserRole,
} from '../../types/league';
import {
  INITIAL_AUDIT_LOGS,
  INITIAL_CITIES,
  INITIAL_CONFIRMATIONS,
  INITIAL_DISPUTES,
  INITIAL_DIVISIONS,
  INITIAL_EVIDENCE_FILES,
  INITIAL_MATCH_EVENTS,
  INITIAL_MATCH_PLAYERS,
  INITIAL_MATCH_RESULTS,
  INITIAL_MATCHES,
  INITIAL_POINT_TRANSACTIONS,
  INITIAL_PROFILES,
  INITIAL_RATING_LOGS,
  INITIAL_SEASON_ENTRIES,
  INITIAL_SEASONS,
  INITIAL_USERS,
} from './initialData';
import {
  calculateExperimentalPositionScore,
  calculateMatchSeasonPoints,
} from '../engine/scoringEngine';
import {
  calculatePlayerEloUpdate,
  ELO_ALGORITHM_VERSION,
  resolveDivisionForPlayer,
} from '../engine/eloEngine';
import { inspectMatchForFraudSignals } from '../engine/antiFraud';
import { isSupabaseConfigured, supabaseService, supabase, generateUUID } from '../supabase';

const STORAGE_KEY = 'futplay_lite_planalto_ba_v3_clean';
const ACTIVE_USER_STORAGE_KEY = 'futplay_lite_active_user_id_v3';
const COMPLETED_FIRST_ACCESS_KEY = 'futplay_lite_completed_first_access_v3';

function getCompletedFirstAccessSet(): Set<string> {
  try {
    const raw = localStorage.getItem(COMPLETED_FIRST_ACCESS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed.map((v) => String(v).toLowerCase()));
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return new Set();
}

function markFirstAccessCompletedInStorage(
  userId?: string,
  email?: string,
  whatsappNumber?: string
) {
  try {
    const set = getCompletedFirstAccessSet();
    if (userId) set.add(userId.toLowerCase());
    if (email) set.add(email.trim().toLowerCase());
    const digits = (whatsappNumber || '').replace(/\D/g, '');
    if (digits) {
      set.add(digits);
      set.add(`${digits}@celular.futplay.com`);
    }
    localStorage.setItem(
      COMPLETED_FIRST_ACCESS_KEY,
      JSON.stringify(Array.from(set))
    );
  } catch {
    // Ignore storage write errors
  }
}

function unmarkFirstAccessCompletedInStorage(
  userId?: string,
  email?: string,
  whatsappNumber?: string
) {
  try {
    const set = getCompletedFirstAccessSet();
    if (userId) set.delete(userId.toLowerCase());
    if (email) set.delete(email.trim().toLowerCase());
    const digits = (whatsappNumber || '').replace(/\D/g, '');
    if (digits) {
      set.delete(digits);
      set.delete(`${digits}@celular.futplay.com`);
    }
    localStorage.setItem(
      COMPLETED_FIRST_ACCESS_KEY,
      JSON.stringify(Array.from(set))
    );
  } catch {
    // Ignore storage write errors
  }
}

export interface NotificationBanner {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

export interface SumulaStopwatchState {
  isActive: boolean;
  seconds: number;
  isRunning: boolean;
  title: string;
  start: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  open: (title?: string, initialSeconds?: number) => void;
  close: () => void;
  setSeconds: (secs: number) => void;
}

interface LeagueState {
  users: User[];
  cities: City[];
  divisions: Division[];
  seasons: Season[];
  profiles: PlayerProfile[];
  seasonEntries: SeasonEntry[];
  matches: Match[];
  matchPlayers: MatchPlayer[];
  matchResults: MatchResultVersion[];
  matchEvents: MatchEvent[];
  confirmations: ResultConfirmation[];
  disputes: Dispute[];
  evidenceFiles: EvidenceFile[];
  pointTransactions: PointTransaction[];
  ratingLogs: PlayerRatingLog[];
  auditLogs: AuditLog[];
  peerEvaluations: PeerEvaluation[];
  monthlyPayments: MonthlyPaymentRecord[];
  monthlyConfig: PeladaMonthlyConfig;
  teamTransactions: TeamTransaction[];
  playerAdjustments: PlayerAdminAdjustment[];
}

interface LeagueContextValue extends LeagueState {
  isCloudSyncReady: boolean;
  currentUser: User;
  currentPlayerProfile: PlayerProfile | undefined;
  selectedCityId: string;
  selectedSeasonId: string;
  notification: NotificationBanner | null;
  setSelectedCityId: (cityId: string) => void;
  setSelectedSeasonId: (seasonId: string) => void;
  switchActiveUser: (userId: string) => void;
  setActiveUserWithData: (user: User, profile?: PlayerProfile) => void;
  removeLocalUserSilently: (userId: string) => void;
  clearNotification: () => void;
  notify: (
    type: NotificationBanner['type'],
    title: string,
    message: string
  ) => void;
  registerNewAthlete: (params: {
    displayName: string;
    email?: string;
    whatsappNumber?: string;
    password?: string;
    cityId: string;
    neighborhood: string;
    position: PlayerPosition;
    dominantFoot: DominantFoot;
    profileVisibility: ProfileVisibility;
  }) => PlayerProfile | null;
  updateOwnProfile: (params: {
    displayName: string;
    neighborhood: string;
    position: PlayerPosition;
    dominantFoot: DominantFoot;
    profileVisibility: ProfileVisibility;
    avatarUrl?: string;
  }) => boolean;
  updateTeamInfo: (params: {
    teamName: string;
    teamCity?: string;
    teamCrestUrl?: string;
    teamModality?: TeamModality;
  }) => boolean;
  deleteUserAccount: (userId?: string) => Promise<boolean>;
  updatePlayerSkills: (
    playerId: string,
    skills: {
      finalizacao: number;
      marcacao: number;
      passe: number;
      raca: number;
      drible: number;
    },
    evaluatorId?: string
  ) => boolean;
  saveUserWhatsapp: (whatsappNumber: string) => boolean;
  saveOnboardingStep1: (params: {
    displayName: string;
    avatarUrl?: string;
  }) => boolean;
  saveOnboardingStep2: (params: {
    mode: 'create' | 'join';
    teamName: string;
    teamCity: string;
    teamCrestUrl?: string;
    teamModality: TeamModality;
    teamInviteCode?: string;
    position?: PlayerPosition;
  }) => boolean;
  saveOnboardingStep3: () => boolean;
  createCommunityMatch: (params: {
    venueName: string;
    neighborhood: string;
    scheduledAt: string;
    format: MatchFormat;
    homeTeamName: string;
    awayTeamName: string;
    homePlayerIds: string[];
    awayPlayerIds: string[];
    homeCaptainId: string;
    awayCaptainId: string;
  }) => Match | null;
  submitMatchScoreAndEvents: (params: {
    matchId: string;
    homeScore: number;
    awayScore: number;
    mvpPlayerId?: string;
    goalkeeperCapaPlayerId?: string;
    goalScorerIds: string[];
    assistPlayerIds: string[];
    yellowCardPlayerIds?: string[];
    blueCardPlayerIds?: string[];
    evidenceTitle?: string;
  }) => boolean;
  confirmMatchResult: (matchId: string, comment?: string) => boolean;
  contestMatchResult: (params: {
    matchId: string;
    reasonCode: DisputeReasonCode;
    description: string;
  }) => boolean;
  moderateMatchResolution: (params: {
    matchId: string;
    action: 'validate_current' | 'correct_and_validate' | 'annul_match';
    correctedHomeScore?: number;
    correctedAwayScore?: number;
    correctedMvpId?: string;
    moderatorReason: string;
  }) => boolean;
  attemptDirectManipulationAttack: () => void;
  resetDemoDatabase: () => void;
  sumulaStopwatch: SumulaStopwatchState;
  toggleMonthlyPayment: (
    playerId: string,
    yearMonth: string,
    isPaid: boolean,
    amount?: number
  ) => boolean;
  updateMonthlyConfig: (config: Partial<PeladaMonthlyConfig>) => boolean;
  finalizePeladaSumula: (sumula: SumulaData) => boolean;
  addTeamTransaction: (tx: Omit<TeamTransaction, 'id' | 'createdAt'>) => boolean;
  deleteTeamTransaction: (id: string) => boolean;
  refreshTeamTransactions: () => Promise<void>;
  refreshMonthlyData: () => Promise<void>;
  refreshLeagueData: () => Promise<void>;
  recordAuditLog: (params: {
    actionType: string;
    entityType: string;
    entityId: string;
    reason: string;
    actorUserId?: string;
    actorName?: string;
    actorRole?: UserRole;
    beforeData?: Record<string, unknown>;
    afterData?: Record<string, unknown>;
  }) => AuditLog;
  updatePlayerStatsManually: (params: {
    playerId: string;
    statsUpdates: Partial<SeasonEntry>;
    profileUpdates?: Partial<PlayerProfile>;
    reason: string;
    actorUserId?: string;
    actorName?: string;
  }) => boolean;
}

const LeagueContext = createContext<LeagueContextValue | null>(null);

export const DEFAULT_MONTHLY_CONFIG: PeladaMonthlyConfig = {
  monthlyAmount: 30,
  dueDay: 10,
  pixKey: '77988001122',
  pixKeyType: 'Celular',
  pixReceiverName: 'Rosália Esportes',
};

export function ensureAthleteAuditLogs(
  profiles: PlayerProfile[],
  existingLogs: AuditLog[] = []
): AuditLog[] {
  const existingKeys = new Set(
    (existingLogs || []).map((l) => `${l.actionType}_${l.actorUserId}`)
  );
  const createdLogs: AuditLog[] = [];

  for (const prof of profiles) {
    if (!prof.userId) continue;

    // 1. Log de Cadastro Inicial do Atleta
    const regKey = `ATHLETE_REGISTERED_${prof.userId}`;
    if (!existingKeys.has(regKey)) {
      const createdAt = prof.createdAt || new Date().toISOString();
      const retentionUntil = new Date(new Date(createdAt).getTime() + 180 * 24 * 60 * 60 * 1000).toISOString();
      const regLog: AuditLog = {
        id: `audit-cloud-reg-${prof.userId}`,
        actorUserId: prof.userId,
        actorName: prof.displayName || 'Atleta',
        actorRole: prof.isTeamOwner ? 'coach' : 'player',
        actionType: 'ATHLETE_REGISTERED',
        entityType: 'player_profiles',
        entityId: prof.id,
        reason: `Cadastro de atleta oficial na Liga de Planalto - BA (${prof.position || 'defensor'}, ${prof.neighborhood || 'Centro'}).`,
        afterData: {
          displayName: prof.displayName,
          teamName: prof.teamName,
          position: prof.position,
          initialRating: prof.currentRating || 1000,
          isProvisional: prof.isProvisional,
        },
        clientApp: 'FutPlay Lite PWA v1.0',
        legalRetentionPolicy: 'Marco Civil da Internet (Art. 15, Lei 12.965/2014) & LGPD',
        retentionUntil,
        createdAt,
      };
      createdLogs.push(regLog);
      existingKeys.add(regKey);
    }

    // 2. Log de Ingresso ou Criação de Equipe
    if (prof.teamName && prof.teamName.trim()) {
      const teamAction = prof.isTeamOwner ? 'TIME_CRIADO' : 'TIME_INGRESSOU';
      const teamKey = `${teamAction}_${prof.userId}`;
      if (!existingKeys.has(teamKey)) {
        const createdAt = prof.updatedAt || prof.createdAt || new Date().toISOString();
        const retentionUntil = new Date(new Date(createdAt).getTime() + 180 * 24 * 60 * 60 * 1000).toISOString();
        const teamLog: AuditLog = {
          id: `audit-cloud-team-${prof.userId}`,
          actorUserId: prof.userId,
          actorName: prof.displayName || 'Atleta',
          actorRole: prof.isTeamOwner ? 'coach' : 'player',
          actionType: teamAction,
          entityType: 'teams',
          entityId: prof.teamInviteCode || prof.teamName,
          reason: prof.isTeamOwner
            ? `Criou a equipe "${prof.teamName}" (${prof.teamModality || 'Society'}, ${prof.teamCity || 'Planalto - BA'}).`
            : `Ingressou no elenco da equipe "${prof.teamName}" (${prof.teamModality || 'Society'}, ${prof.teamCity || 'Planalto - BA'}).`,
          clientApp: 'FutPlay Lite PWA v1.0',
          legalRetentionPolicy: 'Marco Civil da Internet (Art. 15, Lei 12.965/2014) & LGPD',
          retentionUntil,
          createdAt,
        };
        createdLogs.push(teamLog);
        existingKeys.add(teamKey);
      }
    }
  }

  if (createdLogs.length === 0) return existingLogs;

  const combined = [...(existingLogs || []), ...createdLogs];
  combined.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return combined;
}

/**
 * Calcula com precisão a média geral e por quesito de todos os jogadores que avaliaram o atleta.
 * Garante que avaliações individuais ativas sejam unificadas e persistidas sem distorção.
 */
export function computeProfilesWithPeerEvaluations(
  profiles: PlayerProfile[],
  evaluations: PeerEvaluation[]
): PlayerProfile[] {
  if (!evaluations || evaluations.length === 0) return profiles;

  return profiles.map((prof) => {
    const targetEvals = evaluations.filter(
      (e) =>
        (e.targetPlayerId === prof.id || (prof.userId && e.targetPlayerId === prof.userId)) &&
        (e.finalizacao > 0 || e.marcacao > 0 || e.passe > 0 || e.raca > 0 || e.drible > 0)
    );
    if (targetEvals.length === 0) return prof;

    const totalVotes = targetEvals.length;
    const avgFin = Number(
      (targetEvals.reduce((acc, cur) => acc + (cur.finalizacao || 0), 0) / totalVotes).toFixed(1)
    );
    const avgMar = Number(
      (targetEvals.reduce((acc, cur) => acc + (cur.marcacao || 0), 0) / totalVotes).toFixed(1)
    );
    const avgPas = Number(
      (targetEvals.reduce((acc, cur) => acc + (cur.passe || 0), 0) / totalVotes).toFixed(1)
    );
    const avgRac = Number(
      (targetEvals.reduce((acc, cur) => acc + (cur.raca || 0), 0) / totalVotes).toFixed(1)
    );
    const avgDri = Number(
      (targetEvals.reduce((acc, cur) => acc + (cur.drible || 0), 0) / totalVotes).toFixed(1)
    );
    const overallStars = Number(
      ((avgFin + avgMar + avgPas + avgRac + avgDri) / 5).toFixed(1)
    );

    return {
      ...prof,
      skills: {
        finalizacao: avgFin,
        marcacao: avgMar,
        passe: avgPas,
        raca: avgRac,
        drible: avgDri,
        totalVotes,
        lastRatedAt: targetEvals[targetEvals.length - 1]?.updatedAt || prof.skills?.lastRatedAt,
      },
      overallStars,
    };
  });
}

function getInitialState(): LeagueState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: LeagueState = JSON.parse(saved);
      const rawProfiles: PlayerProfile[] = parsed.profiles || [];

      // Catálogo rápido de escudos salvos localmente
      let cachedCrests: Record<string, string> = {};
      try {
        const rawC = localStorage.getItem('futplay_team_crests_v1');
        if (rawC) cachedCrests = JSON.parse(rawC);
      } catch {}
      try {
        const rawTeams = localStorage.getItem('futplay_registered_teams_v1');
        if (rawTeams) {
          const parsedTeams = JSON.parse(rawTeams);
          if (Array.isArray(parsedTeams)) {
            parsedTeams.forEach((t: any) => {
              if (t.name && t.crestUrl) {
                const k = t.name.trim().toLowerCase();
                if (!cachedCrests[k]) cachedCrests[k] = t.crestUrl;
              }
            });
          }
        }
      } catch {}

      // Mescla com atletas base (INITIAL_PROFILES) caso algum tenha sido omitido no salvamento
      const existingProfileIds = new Set(rawProfiles.map((p) => p.id));
      const existingProfileNames = new Set(
        rawProfiles.map((p) => (p.displayName || '').trim().toUpperCase())
      );
      const missingInitialProfiles = INITIAL_PROFILES.filter(
        (ip) =>
          !existingProfileIds.has(ip.id) &&
          !existingProfileNames.has((ip.displayName || '').trim().toUpperCase())
      );

      const allProfilesSource = [...rawProfiles, ...missingInitialProfiles];

      // Mescla atletas de elenco dos times registrados em localStorage
      try {
        const rawTeams = localStorage.getItem('futplay_registered_teams_v1');
        if (rawTeams) {
          const parsedTeams = JSON.parse(rawTeams);
          if (Array.isArray(parsedTeams)) {
            parsedTeams.forEach((t: any) => {
              if (t.roster && Array.isArray(t.roster)) {
                t.roster.forEach((rm: any) => {
                  if (rm && rm.id && !existingProfileIds.has(rm.id)) {
                    allProfilesSource.push({
                      id: rm.id,
                      userId: rm.userId || rm.id,
                      displayName: rm.displayName || rm.name || 'Atleta',
                      avatarUrl: rm.avatarUrl,
                      avatarColor: '#126B46',
                      cityId: '11111111-1111-4111-8111-111111111101',
                      neighborhood: rm.neighborhood || 'Centro',
                      position: rm.position || 'atacante',
                      dominantFoot: rm.dominantFoot || 'direito',
                      profileVisibility: 'publico',
                      teamName: t.name,
                      teamCrestUrl: t.crestUrl,
                      teamInviteCode: t.inviteCode,
                      currentRating: rm.currentRating || 1000,
                      ratingUncertainty: 100,
                      isProvisional: true,
                      currentDivisionId: 'div-geral',
                      totalValidatedMatches: 0,
                      experimentalPositionScore: null,
                      badges: [],
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    } as PlayerProfile);
                    existingProfileIds.add(rm.id);
                  }
                });
              }
            });
          }
        }
      } catch {}

      let cleanProfiles: PlayerProfile[] = allProfilesSource
        .filter(
          (p) =>
            p.displayName.trim().toUpperCase() !== 'ADMIN' &&
            p.id !== 'a0000000-0000-4000-8000-000000000002' &&
            p.userId !== 'a0000000-0000-4000-8000-000000000001'
        )
        .map((p) => {
          const tKey = (p.teamName || '').trim().toLowerCase();
          return {
            ...p,
            teamCrestUrl: p.teamCrestUrl || (tKey ? cachedCrests[tKey] : undefined),
          };
        });

      const cleanUsers = (parsed.users || []).map((u) => {
        const tKey = (u.teamName || '').trim().toLowerCase();
        return {
          ...u,
          teamCrestUrl: u.teamCrestUrl || (tKey ? cachedCrests[tKey] : undefined),
        };
      });

      let transactions = parsed.teamTransactions || [];
      if (!transactions || transactions.length === 0) {
        try {
          const rawTx = localStorage.getItem('futplay_team_financial_transactions_v1');
          if (rawTx) transactions = JSON.parse(rawTx);
        } catch (e) {}
      }
      let payments = parsed.monthlyPayments || [];
      if (!payments || payments.length === 0) {
        try {
          const rawPay = localStorage.getItem('futplay_monthly_payments_v1');
          if (rawPay) payments = JSON.parse(rawPay);
        } catch (e) {}
      }

      let peerEvals: PeerEvaluation[] = parsed.peerEvaluations || [];
      try {
        const rawEvals = localStorage.getItem('futplay_peer_evaluations_v1');
        if (rawEvals) {
          const parsedRaw: PeerEvaluation[] = JSON.parse(rawEvals);
          if (Array.isArray(parsedRaw)) {
            const map = new Map<string, PeerEvaluation>();
            peerEvals.forEach((e) => map.set(`${e.evaluatorId}_${e.targetPlayerId}`, e));
            parsedRaw.forEach((e) => map.set(`${e.evaluatorId}_${e.targetPlayerId}`, e));
            peerEvals = Array.from(map.values());
          }
        }
      } catch {}

      cleanProfiles = computeProfilesWithPeerEvaluations(cleanProfiles, peerEvals);
      const initialLogs = ensureAthleteAuditLogs(cleanProfiles, parsed.auditLogs || []);

      return {
        ...parsed,
        users: cleanUsers,
        profiles: cleanProfiles,
        matches: parsed.matches || [],
        peerEvaluations: peerEvals,
        monthlyPayments: payments,
        monthlyConfig: parsed.monthlyConfig || DEFAULT_MONTHLY_CONFIG,
        teamTransactions: transactions,
        playerAdjustments: parsed.playerAdjustments || [],
        auditLogs: initialLogs,
      };
    }
  } catch (e) {
    console.warn('Falha ao ler estado salvo, usando dados iniciais:', e);
  }
  let initialTx: TeamTransaction[] = [];
  let initialPay: MonthlyPaymentRecord[] = [];
  let initialAdjustments: PlayerAdminAdjustment[] = [];
  let initialEvals: PeerEvaluation[] = [];
  try {
    const rawTx = localStorage.getItem('futplay_team_financial_transactions_v1');
    if (rawTx) initialTx = JSON.parse(rawTx);
    const rawPay = localStorage.getItem('futplay_monthly_payments_v1');
    if (rawPay) initialPay = JSON.parse(rawPay);
    const rawAdj = localStorage.getItem('futplay_player_adjustments_v1');
    if (rawAdj) initialAdjustments = JSON.parse(rawAdj);
    const rawEvals = localStorage.getItem('futplay_peer_evaluations_v1');
    if (rawEvals) initialEvals = JSON.parse(rawEvals);
  } catch (e) {}

  const initialProfiles = computeProfilesWithPeerEvaluations(INITIAL_PROFILES, initialEvals);

  return {
    users: INITIAL_USERS,
    cities: INITIAL_CITIES,
    divisions: INITIAL_DIVISIONS,
    seasons: INITIAL_SEASONS,
    profiles: initialProfiles,
    seasonEntries: INITIAL_SEASON_ENTRIES,
    matches: INITIAL_MATCHES,
    matchPlayers: INITIAL_MATCH_PLAYERS,
    matchResults: INITIAL_MATCH_RESULTS,
    matchEvents: INITIAL_MATCH_EVENTS,
    confirmations: INITIAL_CONFIRMATIONS,
    disputes: INITIAL_DISPUTES,
    evidenceFiles: INITIAL_EVIDENCE_FILES,
    pointTransactions: INITIAL_POINT_TRANSACTIONS,
    ratingLogs: INITIAL_RATING_LOGS,
    auditLogs: ensureAthleteAuditLogs(initialProfiles, INITIAL_AUDIT_LOGS),
    peerEvaluations: initialEvals,
    monthlyPayments: initialPay,
    monthlyConfig: DEFAULT_MONTHLY_CONFIG,
    teamTransactions: initialTx,
    playerAdjustments: initialAdjustments,
  };
}

export const LeagueProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isCloudSyncReady, setIsCloudSyncReady] = useState<boolean>(() => !isSupabaseConfigured());
  const [state, setState] = useState<LeagueState>(getInitialState);
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
      if (stored) return stored;
      return '';
    } catch {
      return '';
    }
  });
  const [selectedCityId, setSelectedCityId] = useState<string>('city-rosalia');
  const [selectedSeasonId, setSelectedSeasonId] =
    useState<string>('season-2026-2');
  const [notification, setNotification] = useState<NotificationBanner | null>(
    null
  );

  // Cronômetro da Súmula integrado ao Cabeçalho do App
  const [isStopwatchActive, setIsStopwatchActive] = useState<boolean>(false);
  const [stopwatchSeconds, setStopwatchSeconds] = useState<number>(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState<boolean>(false);
  const [stopwatchTitle, setStopwatchTitle] = useState<string>('Tempo de Jogo');

  useEffect(() => {
    let interval: any = null;
    if (isStopwatchActive && isStopwatchRunning) {
      interval = setInterval(() => {
        setStopwatchSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStopwatchActive, isStopwatchRunning]);

  const toggleStopwatch = () => {
    setIsStopwatchRunning((prev) => !prev);
  };

  const resetStopwatch = () => {
    setIsStopwatchRunning(false);
    setStopwatchSeconds(0);
  };

  const openSumulaStopwatch = (title = 'Tempo de Jogo', initialSeconds = 0) => {
    setIsStopwatchActive(true);
    setStopwatchTitle(title);
    if (initialSeconds > 0 && stopwatchSeconds === 0) {
      setStopwatchSeconds(initialSeconds);
    }
  };

  const closeSumulaStopwatch = () => {
    setIsStopwatchActive(false);
  };

  const sumulaStopwatch: SumulaStopwatchState = {
    isActive: isStopwatchActive,
    seconds: stopwatchSeconds,
    isRunning: isStopwatchRunning,
    title: stopwatchTitle,
    start: () => setIsStopwatchRunning(true),
    pause: () => setIsStopwatchRunning(false),
    toggle: toggleStopwatch,
    reset: resetStopwatch,
    open: openSumulaStopwatch,
    close: closeSumulaStopwatch,
    setSeconds: setStopwatchSeconds,
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Falha ao persistir estado no localStorage:', e);
    }
  }, [state]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_USER_STORAGE_KEY, currentUserId);
    } catch {
      // Ignore
    }
  }, [currentUserId]);

  // Trava para evitar execuções concorrentes simultâneas de refreshLeagueData
  const isRefreshingRef = useRef<boolean>(false);

  // Reconciliação robusta de súmulas de peladas do Supabase (inclusões, alterações e exclusões)
  const reconcileSumulas = (remoteSumulas: SumulaData[] | null) => {
    if (remoteSumulas === null) return;
    try {
      const ALL_KEY = 'futplay_todas_sumulas_peladas_v1';
      const ACTIVE_KEY = 'futplay_sumula_pelada_ativa_v1';
      const raw = localStorage.getItem(ALL_KEY);
      const localList: SumulaData[] = raw ? JSON.parse(raw) : [];
      const remoteIds = new Set(remoteSumulas.map((s) => s.id));
      const now = Date.now();

      // Mapa inicial com as súmulas que existem no banco remoto
      const resultMap = new Map<string, SumulaData>();
      for (const remote of remoteSumulas) {
        resultMap.set(remote.id, remote);
      }

      // Verifica itens locais: preserva rascunhos recém-criados (< 45s), remove os que foram excluídos na nuvem
      for (const loc of localList) {
        if (!remoteIds.has(loc.id)) {
          const ageMs = now - new Date(loc.lastUpdated || 0).getTime();
          if (ageMs < 45000 && loc.status === 'em_andamento') {
            resultMap.set(loc.id, loc);
          }
        } else {
          const rem = resultMap.get(loc.id);
          if (rem) {
            const locTime = new Date(loc.lastUpdated || 0).getTime();
            const remTime = new Date(rem.lastUpdated || 0).getTime();
            if (locTime > remTime) {
              resultMap.set(loc.id, loc);
            }
          }
        }
      }

      const mergedList = Array.from(resultMap.values()).sort((a, b) => {
        const tA = new Date(a.lastUpdated || a.matchDate || 0).getTime();
        const tB = new Date(b.lastUpdated || b.matchDate || 0).getTime();
        return tB - tA;
      });

      localStorage.setItem(ALL_KEY, JSON.stringify(mergedList));

      // Atualiza ou limpa a súmula ativa se a que estava ativa foi excluída
      const activeRaw = localStorage.getItem(ACTIVE_KEY);
      if (activeRaw) {
        try {
          const activeLocal: SumulaData = JSON.parse(activeRaw);
          if (!resultMap.has(activeLocal.id)) {
            const nextActive = mergedList.find((s) => s.status === 'em_andamento') || mergedList[0];
            if (nextActive) {
              localStorage.setItem(ACTIVE_KEY, JSON.stringify(nextActive));
            } else {
              localStorage.removeItem(ACTIVE_KEY);
            }
          }
        } catch {}
      } else if (mergedList.length > 0) {
        const newest = mergedList.find((s) => s.status === 'em_andamento') || mergedList[0];
        localStorage.setItem(ACTIVE_KEY, JSON.stringify(newest));
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('futplay_sumulas_changed', {
            detail: { count: mergedList.length },
          })
        );
      }
    } catch (err) {
      console.warn('Erro ao sincronizar súmulas com o armazenamento local:', err);
    }
  };

  // Sincronização centralizada e completa de dados com o Supabase
  const refreshLeagueData: LeagueContextValue['refreshLeagueData'] = async () => {
    if (!isSupabaseConfigured()) {
      setIsCloudSyncReady(true);
      return;
    }
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;

    try {
      const [
        remoteUsers,
        remoteProfiles,
        remoteSumulas,
        remotePayments,
        remoteTx,
        remoteCfg,
        remoteLogs,
        remoteEvals,
      ] = await Promise.all([
        supabaseService.getUsers(),
        supabaseService.getProfiles(),
        supabaseService.getPeladaSumulas(),
        supabaseService.getMonthlyPayments(),
        supabaseService.getTeamTransactions(),
        supabaseService.getMonthlyConfig(),
        supabaseService.getAuditLogs(),
        supabaseService.getPeerEvaluations(),
      ]);

      if (remoteSumulas !== null) {
        reconcileSumulas(remoteSumulas);
      }

      setState((prev) => {
        // 1. Catálogo unificado de escudos por nome de time (minúsculas)
        const crestCatalog = new Map<string, string>();
        try {
          const cachedCrests = localStorage.getItem('futplay_team_crests_v1');
          if (cachedCrests) {
            const parsed = JSON.parse(cachedCrests);
            Object.entries(parsed).forEach(([tName, cUrl]) => {
              if (typeof cUrl === 'string' && cUrl) crestCatalog.set(tName.trim().toLowerCase(), cUrl);
            });
          }
          const regTeams = localStorage.getItem('futplay_registered_teams_v1');
          if (regTeams) {
            const parsedTeams = JSON.parse(regTeams);
            if (Array.isArray(parsedTeams)) {
              parsedTeams.forEach((t: any) => {
                if (t.name && t.crestUrl) crestCatalog.set(t.name.trim().toLowerCase(), t.crestUrl);
              });
            }
          }
        } catch {}

        INITIAL_PROFILES.forEach((p) => {
          if (p.teamName && p.teamCrestUrl) crestCatalog.set(p.teamName.trim().toLowerCase(), p.teamCrestUrl);
        });
        prev.users.forEach((u) => {
          if (u.teamName && u.teamCrestUrl) crestCatalog.set(u.teamName.trim().toLowerCase(), u.teamCrestUrl);
        });
        prev.profiles.forEach((p) => {
          if (p.teamName && p.teamCrestUrl) crestCatalog.set(p.teamName.trim().toLowerCase(), p.teamCrestUrl);
        });
        if (remoteProfiles) {
          remoteProfiles.forEach((rp) => {
            if (rp.teamName && rp.teamCrestUrl) crestCatalog.set(rp.teamName.trim().toLowerCase(), rp.teamCrestUrl);
          });
        }

        // 2. Mescla USERS com integridade (preserva contas locais se não vierem da nuvem)
        let mergedUsers = prev.users;
        if (remoteUsers) {
          const localUserById = new Map(prev.users.map((u) => [u.id, u]));
          const localUserByEmail = new Map(
            prev.users.filter((u) => u.email).map((u) => [u.email.toLowerCase(), u])
          );
          const matchedUserIds = new Set<string>();

          const remoteMerged = remoteUsers.map((ru) => {
            const loc =
              localUserById.get(ru.id) ||
              (ru.email ? localUserByEmail.get(ru.email.toLowerCase()) : undefined);

            if (loc) matchedUserIds.add(loc.id);

            const team =
              (loc?.teamName && loc.teamName !== 'Meu Time' && loc.teamName !== 'Sem Time' ? loc.teamName : undefined) ||
              (ru.teamName && ru.teamName !== 'Meu Time' && ru.teamName !== 'Sem Time' ? ru.teamName : undefined) ||
              loc?.teamName ||
              ru.teamName ||
              '';

            const crest =
              loc?.teamCrestUrl ||
              ru.teamCrestUrl ||
              (team ? crestCatalog.get(team.toLowerCase()) : undefined);

            if (team && crest) crestCatalog.set(team.toLowerCase(), crest);

            const isOwner = loc?.isTeamOwner === true || ru.isTeamOwner === true;
            const role =
              loc?.role === 'admin' || ru.role === 'admin'
                ? 'admin'
                : loc?.role === 'coach' || ru.role === 'coach' || isOwner
                ? 'coach'
                : loc?.role || ru.role || 'player';

            return {
              ...loc,
              ...ru,
              id: loc?.id || ru.id,
              teamName: team || loc?.teamName || ru.teamName,
              teamCrestUrl: crest || loc?.teamCrestUrl || ru.teamCrestUrl,
              teamCity: loc?.teamCity || ru.teamCity,
              teamModality: loc?.teamModality || ru.teamModality,
              teamInviteCode: loc?.teamInviteCode || ru.teamInviteCode,
              isTeamOwner: isOwner,
              role: role as UserRole,
            };
          });

          const unmatchedUsers = prev.users.filter((u) => !matchedUserIds.has(u.id));
          mergedUsers = [...remoteMerged, ...unmatchedUsers];
        }

        // 3. Sincronização centralizada de avaliações de atletas (Scout / Peer Evaluations)
        let mergedPeerEvals: PeerEvaluation[] = [];
        const evalsMap = new Map<string, PeerEvaluation>();

        // a) Avaliações locais salvas no aparelho
        (prev.peerEvaluations || []).forEach((e) => {
          if (e && e.evaluatorId && e.targetPlayerId) {
            evalsMap.set(`${e.evaluatorId}_${e.targetPlayerId}`, e);
          }
        });
        try {
          const rawLocalEvals = localStorage.getItem('futplay_peer_evaluations_v1');
          if (rawLocalEvals) {
            const parsedLocal: PeerEvaluation[] = JSON.parse(rawLocalEvals);
            if (Array.isArray(parsedLocal)) {
              parsedLocal.forEach((e) => {
                if (e && e.evaluatorId && e.targetPlayerId) {
                  evalsMap.set(`${e.evaluatorId}_${e.targetPlayerId}`, e);
                }
              });
            }
          }
        } catch {}

        // b) Avaliações vindas da nuvem (Supabase)
        let needsUpload = false;
        if (remoteEvals && remoteEvals.length > 0) {
          remoteEvals.forEach((re) => {
            if (re && re.evaluatorId && re.targetPlayerId) {
              const key = `${re.evaluatorId}_${re.targetPlayerId}`;
              const local = evalsMap.get(key);
              if (!local) {
                evalsMap.set(key, re);
              } else {
                const localTime = new Date(local.updatedAt || local.createdAt || 0).getTime();
                const remoteTime = new Date(re.updatedAt || re.createdAt || 0).getTime();
                if (remoteTime >= localTime) {
                  evalsMap.set(key, re);
                } else {
                  needsUpload = true;
                }
              }
            }
          });
        } else if (evalsMap.size > 0) {
          needsUpload = true;
        }

        mergedPeerEvals = Array.from(evalsMap.values());

        // Se o aparelho tiver avaliações locais que ainda não foram para o Supabase, envia agora para a nuvem
        if (needsUpload && mergedPeerEvals.length > 0 && isSupabaseConfigured()) {
          mergedPeerEvals.forEach((ev) => {
            supabaseService.savePeerEvaluation(ev).catch(() => {});
          });
        }

        try {
          localStorage.setItem('futplay_peer_evaluations_v1', JSON.stringify(mergedPeerEvals));
        } catch {}

        // 4. Mescla PROFILES com integridade (garante que atletas locais NUNCA sejam apagados)
        let mergedProfiles = computeProfilesWithPeerEvaluations(prev.profiles, mergedPeerEvals);
        if (remoteProfiles) {
          const adminIds = new Set(
            mergedUsers
              .filter(
                (u) =>
                  u.role === 'admin' ||
                  (u.email && u.email.toLowerCase() === 'futplaylite@gmail.com') ||
                  u.id === 'a0000000-0000-4000-8000-000000000001'
              )
              .map((u) => u.id)
          );

          const filteredRemote = remoteProfiles.filter(
            (rp) =>
              !adminIds.has(rp.userId) &&
              rp.displayName.trim().toUpperCase() !== 'ADMIN' &&
              rp.id !== 'a0000000-0000-4000-8000-000000000002' &&
              rp.userId !== 'a0000000-0000-4000-8000-000000000001'
          );

          const localById = new Map<string, PlayerProfile>();
          const localByUserId = new Map<string, PlayerProfile>();
          const localByName = new Map<string, PlayerProfile>();

          prev.profiles
            .filter(
              (p) =>
                !adminIds.has(p.userId) &&
                p.displayName.trim().toUpperCase() !== 'ADMIN' &&
                p.id !== 'a0000000-0000-4000-8000-000000000002' &&
                p.userId !== 'a0000000-0000-4000-8000-000000000001'
            )
            .forEach((p) => {
              if (p.id) localById.set(p.id, p);
              if (p.userId) localByUserId.set(p.userId, p);
              const n = p.displayName.trim().toUpperCase();
              if (n) localByName.set(n, p);
            });

          const matchedLocalIds = new Set<string>();

          const remoteMerged: PlayerProfile[] = filteredRemote.map((rp) => {
            const loc =
              localById.get(rp.id) ||
              (rp.userId ? localByUserId.get(rp.userId) : undefined) ||
              localByName.get(rp.displayName.trim().toUpperCase());

            if (loc) matchedLocalIds.add(loc.id);

            const team =
              (loc?.teamName && loc.teamName !== 'Meu Time' && loc.teamName !== 'Sem Time' ? loc.teamName : undefined) ||
              (rp.teamName && rp.teamName !== 'Meu Time' && rp.teamName !== 'Sem Time' ? rp.teamName : undefined) ||
              loc?.teamName ||
              rp.teamName ||
              '';

            const crest =
              loc?.teamCrestUrl ||
              rp.teamCrestUrl ||
              (team ? crestCatalog.get(team.toLowerCase()) : undefined);

            if (team && crest) crestCatalog.set(team.toLowerCase(), crest);

            const isOwner = loc?.isTeamOwner === true || rp.isTeamOwner === true;

            return {
              ...loc,
              ...rp,
              id: loc?.id || rp.id,
              userId: loc?.userId || rp.userId,
              displayName: loc?.displayName || rp.displayName,
              teamName: team || loc?.teamName || rp.teamName,
              teamCrestUrl: crest || loc?.teamCrestUrl || rp.teamCrestUrl,
              teamCity: loc?.teamCity || rp.teamCity,
              teamModality: loc?.teamModality || rp.teamModality,
              teamInviteCode: loc?.teamInviteCode || rp.teamInviteCode,
              isTeamOwner: isOwner,
              skills: loc?.skills || rp.skills,
              overallStars: loc?.overallStars || rp.overallStars,
              createdAt: loc?.createdAt || rp.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as PlayerProfile;
          });

          // PRESERVA TODOS OS ATLETAS LOCAIS QUE NÃO VIERAM DO SUPABASE
          const unmatchedLocal: PlayerProfile[] = prev.profiles
            .filter((lp) => !matchedLocalIds.has(lp.id) && !adminIds.has(lp.userId))
            .map((lp) => {
              const team = (lp.teamName || '').trim();
              const crest = lp.teamCrestUrl || (team ? crestCatalog.get(team.toLowerCase()) : undefined);
              return {
                ...lp,
                teamCrestUrl: crest || lp.teamCrestUrl,
              };
            });

          const mergedPool: PlayerProfile[] = [...remoteMerged, ...unmatchedLocal];
          const poolIds = new Set(mergedPool.map((p) => p.id));
          const poolNames = new Set(mergedPool.map((p) => (p.displayName || '').trim().toUpperCase()));

          INITIAL_PROFILES.forEach((ip) => {
            if (!poolIds.has(ip.id) && !poolNames.has((ip.displayName || '').trim().toUpperCase())) {
              mergedPool.push(ip);
              poolIds.add(ip.id);
            }
          });

          mergedProfiles = computeProfilesWithPeerEvaluations(
            mergedPool,
            mergedPeerEvals
          );
        }

        // 4. Salva catálogo de escudos atualizado sem sobrescrever o existente
        try {
          const rawExisting = localStorage.getItem('futplay_team_crests_v1');
          const existingObj: Record<string, string> = rawExisting ? JSON.parse(rawExisting) : {};
          const mergedCrests: Record<string, string> = { ...existingObj };
          crestCatalog.forEach((url, name) => {
            if (url && name) mergedCrests[name] = url;
          });
          localStorage.setItem('futplay_team_crests_v1', JSON.stringify(mergedCrests));
        } catch {}

        // 5. Marca contas remotas confirmadas no Supabase como primeiro acesso concluído APENAS se já possuem time, são donos ou administradores
        if (remoteUsers) {
          remoteUsers.forEach((ru) => {
            const hasTeam = Boolean(
              (ru.teamName && ru.teamName !== 'Meu Time' && ru.teamName !== 'Sem Time') ||
              ru.teamInviteCode
            );
            if (ru.role === 'admin' || ru.isTeamOwner || ru.role === 'coach' || hasTeam) {
              markFirstAccessCompletedInStorage(ru.id, ru.email, ru.whatsappNumber);
            }
          });
        }

        // 6. Reconstrução e sincronização centralizada de TIMES REGISTRADOS (futplay_registered_teams_v1)
        try {
          const rawTeams = localStorage.getItem('futplay_registered_teams_v1');
          const existingTeams: any[] = rawTeams ? JSON.parse(rawTeams) : [];
          const teamsByCode = new Map<string, any>();

          existingTeams.forEach((t) => {
            if (t && t.inviteCode) {
              const code = t.inviteCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
              if (code) teamsByCode.set(code, t);
            }
          });

          const modalityLabelMap: Record<string, string> = {
            society: 'Society',
            futsal: 'Futsal',
            futebol_areia: 'Futebol de Areia',
            futebol_campo: 'Futebol de Campo',
          };

          const allEntities = [...mergedProfiles, ...mergedUsers];
          allEntities.forEach((entity: any) => {
            const tName = (entity.teamName || '').trim();
            const tCode = (entity.teamInviteCode || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            if (!tName || tName === 'Meu Time' || tName === 'Sem Time' || !tCode) return;

            const existing = teamsByCode.get(tCode);
            const crest = entity.teamCrestUrl || crestCatalog.get(tName.toLowerCase()) || existing?.crestUrl;
            const modality = (entity.teamModality || existing?.modality || 'society') as TeamModality;
            const city = entity.teamCity || existing?.city || 'Planalto - BA';

            const isOwner = Boolean(entity.isTeamOwner || entity.role === 'coach');
            let ownerUserId = existing?.ownerUserId;
            let ownerName = existing?.ownerName;

            if (isOwner) {
              ownerUserId = entity.userId || entity.id;
              ownerName = entity.displayName || entity.email?.split('@')[0] || ownerName;
            }

            const updatedTeam = {
              id: existing?.id || `custom-${tCode}`,
              inviteCode: tCode,
              name: tName,
              city,
              neighborhood: existing?.neighborhood || 'Centro',
              foundedYear: existing?.foundedYear || '2026',
              crestUrl: crest,
              crestColor: existing?.crestColor || '#1D4ED8',
              modality,
              modalityLabel: modalityLabelMap[modality] || 'Society',
              ownerName: ownerName || 'Comissão Técnica',
              ownerUserId: ownerUserId || undefined,
              roster: existing?.roster || [],
            };

            teamsByCode.set(tCode, updatedTeam);
          });

          // Monta o elenco (roster) completo para cada time a partir de mergedProfiles
          teamsByCode.forEach((team, code) => {
            const teamProfiles = mergedProfiles.filter((p) => {
              const pCode = (p.teamInviteCode || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
              const pName = (p.teamName || '').trim().toLowerCase();
              return pCode === code || pName === team.name.trim().toLowerCase();
            });

            if (!team.ownerUserId && teamProfiles.length > 0) {
              const ownerProf = teamProfiles.find((p) => p.isTeamOwner) || teamProfiles[0];
              team.ownerUserId = ownerProf.userId || ownerProf.id;
              team.ownerName = ownerProf.displayName;
            }

            team.roster = teamProfiles;
          });

          const syncedTeams = Array.from(teamsByCode.values());
          localStorage.setItem('futplay_registered_teams_v1', JSON.stringify(syncedTeams));
        } catch (teamSyncErr) {
          console.warn('Erro ao sincronizar times registrados:', teamSyncErr);
        }

        // 7. Sincroniza mensalidades remotas
        let mergedPayments = prev.monthlyPayments || [];
        if (remotePayments) {
          const payMap = new Map<string, MonthlyPaymentRecord>();
          remotePayments.forEach((p) => payMap.set(p.id, p));
          (prev.monthlyPayments || []).forEach((locP) => {
            if (!payMap.has(locP.id)) payMap.set(locP.id, locP);
          });
          mergedPayments = Array.from(payMap.values());
          try {
            localStorage.setItem('futplay_monthly_payments_v1', JSON.stringify(mergedPayments));
          } catch {}
        }

        // 8. Sincroniza transações financeiras remotas
        let mergedTx = prev.teamTransactions || [];
        if (remoteTx) {
          const txMap = new Map<string, TeamTransaction>();
          remoteTx.forEach((tx) => txMap.set(tx.id, tx));
          (prev.teamTransactions || []).forEach((locTx) => {
            if (!txMap.has(locTx.id)) txMap.set(locTx.id, locTx);
          });
          mergedTx = Array.from(txMap.values()).sort((a, b) => {
            const tA = new Date(a.date || a.createdAt || 0).getTime();
            const tB = new Date(b.date || b.createdAt || 0).getTime();
            return tB - tA;
          });
          try {
            localStorage.setItem('futplay_team_financial_transactions_v1', JSON.stringify(mergedTx));
          } catch {}
        }

        // 9. Sincroniza logs de auditoria remotos
        let mergedLogs = prev.auditLogs || [];
        if (remoteLogs && remoteLogs.length > 0) {
          const logMap = new Map<string, AuditLog>();
          remoteLogs.forEach((l) => logMap.set(l.id, l));
          (prev.auditLogs || []).forEach((l) => {
            if (!logMap.has(l.id)) logMap.set(l.id, l);
          });
          mergedLogs = Array.from(logMap.values()).sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          );
        }

        const enrichedAuditLogs = ensureAthleteAuditLogs(mergedProfiles, mergedLogs);
        const next = {
          ...prev,
          users: mergedUsers,
          profiles: mergedProfiles,
          peerEvaluations: mergedPeerEvals,
          auditLogs: enrichedAuditLogs,
          monthlyPayments: mergedPayments,
          teamTransactions: mergedTx,
          monthlyConfig: remoteCfg || prev.monthlyConfig,
        };

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {}

        return next;
      });
    } catch (err) {
      console.warn('Erro ao atualizar dados da liga com o Supabase:', err);
    } finally {
      isRefreshingRef.current = false;
      setIsCloudSyncReady(true);
    }
  };

  // Dispara a sincronização imediatamente na montagem com trava de carregamento e ao voltar à aba
  useEffect(() => {
    let isMounted = true;
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        setIsCloudSyncReady(true);
      }
    }, 4500);

    refreshLeagueData().finally(() => {
      if (isMounted) {
        clearTimeout(safetyTimeout);
        setIsCloudSyncReady(true);
      }
    });

    const handleFocusOrVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshLeagueData();
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, []);

  // Escuta em tempo real eventos na nuvem do Supabase (inclusão, alteração e EXCLUSÃO instantânea de súmulas para todos os aparelhos logados)
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;

    const channel = supabase
      .channel('futplay_pelada_sumulas_realtime_v1')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pelada_sumulas' },
        (payload) => {
          try {
            const ALL_KEY = 'futplay_todas_sumulas_peladas_v1';
            const ACTIVE_KEY = 'futplay_sumula_pelada_ativa_v1';
            const raw = localStorage.getItem(ALL_KEY);
            let list: SumulaData[] = raw ? JSON.parse(raw) : [];

            if (payload.eventType === 'DELETE') {
              const deletedId = (payload.old as { id?: string })?.id;
              if (!deletedId) return;

              list = list.filter((s) => s.id !== deletedId);
              localStorage.setItem(ALL_KEY, JSON.stringify(list));

              const activeRaw = localStorage.getItem(ACTIVE_KEY);
              if (activeRaw) {
                try {
                  const active: SumulaData = JSON.parse(activeRaw);
                  if (active.id === deletedId) {
                    if (list.length > 0) {
                      localStorage.setItem(ACTIVE_KEY, JSON.stringify(list[0]));
                    } else {
                      localStorage.removeItem(ACTIVE_KEY);
                    }
                  }
                } catch {}
              }

              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('futplay_sumulas_changed', {
                    detail: { deletedId, count: list.length },
                  })
                );
              }
            } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newRow = payload.new as { data?: unknown; id?: string };
              if (newRow && newRow.id === 'audit_logs_ledger_v1' && newRow.data) {
                const auditData = newRow.data as { logs?: AuditLog[] };
                if (Array.isArray(auditData.logs)) {
                  setState((prev) => {
                    const map = new Map<string, AuditLog>();
                    auditData.logs!.forEach((l) => map.set(l.id, l));
                    (prev.auditLogs || []).forEach((l) => {
                      if (!map.has(l.id)) map.set(l.id, l);
                    });
                    const list = Array.from(map.values());
                    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                    return { ...prev, auditLogs: list };
                  });
                }
              } else if (newRow && newRow.data) {
                const updatedSumula = newRow.data as SumulaData;
                const idx = list.findIndex((s) => s.id === updatedSumula.id);
                if (idx >= 0) {
                  list[idx] = updatedSumula;
                } else {
                  list.unshift(updatedSumula);
                }
                localStorage.setItem(ALL_KEY, JSON.stringify(list));

                if (typeof window !== 'undefined') {
                  window.dispatchEvent(
                    new CustomEvent('futplay_sumulas_changed', {
                      detail: { savedId: updatedSumula.id, count: list.length },
                    })
                  );
                }
              }
            }
          } catch (err) {
            console.warn('Erro ao processar alteração realtime em súmulas:', err);
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Listener entre abas do mesmo navegador para atualizar finanças e mensalidades em tempo real
  useEffect(() => {
    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === 'futplay_team_financial_transactions_v1' && e.newValue) {
        try {
          const updated: TeamTransaction[] = JSON.parse(e.newValue);
          if (Array.isArray(updated)) {
            setState((prev) => ({ ...prev, teamTransactions: updated }));
          }
        } catch {}
      }
      if (e.key === 'futplay_monthly_payments_v1' && e.newValue) {
        try {
          const updatedPay: MonthlyPaymentRecord[] = JSON.parse(e.newValue);
          if (Array.isArray(updatedPay)) {
            setState((prev) => ({ ...prev, monthlyPayments: updatedPay }));
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageSync);
    return () => {
      window.removeEventListener('storage', handleStorageSync);
    };
  }, []);

  const refreshTeamTransactions: LeagueContextValue['refreshTeamTransactions'] = async () => {
    if (!isSupabaseConfigured()) return;
    const remoteTx = await supabaseService.getTeamTransactions();
    if (!remoteTx) return;
    setState((prev) => {
      const mergedMap = new Map<string, TeamTransaction>();
      remoteTx.forEach((tx) => mergedMap.set(tx.id, tx));

      const now = Date.now();
      (prev.teamTransactions || []).forEach((locTx) => {
        if (!mergedMap.has(locTx.id)) {
          const ageMs = now - new Date(locTx.createdAt || 0).getTime();
          if (ageMs < 60000) {
            mergedMap.set(locTx.id, locTx);
          }
        }
      });

      const mergedList = Array.from(mergedMap.values()).sort((a, b) => {
        const tA = new Date(a.date || a.createdAt || 0).getTime();
        const tB = new Date(b.date || b.createdAt || 0).getTime();
        return tB - tA;
      });

      try {
        localStorage.setItem('futplay_team_financial_transactions_v1', JSON.stringify(mergedList));
      } catch {}

      return {
        ...prev,
        teamTransactions: mergedList,
      };
    });
  };

  const refreshMonthlyData: LeagueContextValue['refreshMonthlyData'] = async () => {
    if (!isSupabaseConfigured()) return;
    const [remotePayments, remoteCfg] = await Promise.all([
      supabaseService.getMonthlyPayments(),
      supabaseService.getMonthlyConfig(),
      refreshTeamTransactions(),
    ]);

    setState((prev) => {
      let nextPayments = prev.monthlyPayments || [];
      if (remotePayments) {
        const mergedMap = new Map<string, MonthlyPaymentRecord>();
        remotePayments.forEach((p) => mergedMap.set(p.id, p));

        const now = Date.now();
        (prev.monthlyPayments || []).forEach((locP) => {
          const remP = mergedMap.get(locP.id);
          const locTime = new Date(locP.updatedAt || locP.paidAt || 0).getTime();
          if (!remP) {
            if (now - locTime < 60000) {
              mergedMap.set(locP.id, locP);
            }
          } else {
            const remTime = new Date(remP.updatedAt || remP.paidAt || 0).getTime();
            if (locTime > remTime) {
              mergedMap.set(locP.id, locP);
            }
          }
        });

        nextPayments = Array.from(mergedMap.values());
        try {
          localStorage.setItem('futplay_monthly_payments_v1', JSON.stringify(nextPayments));
        } catch {}
      }

      return {
        ...prev,
        monthlyPayments: nextPayments,
        monthlyConfig: remoteCfg || prev.monthlyConfig,
      };
    });
  };

  const notify = (
    type: NotificationBanner['type'],
    title: string,
    message: string
  ) => {
    setNotification({
      id: `notif-${Date.now()}`,
      type,
      title,
      message,
    });
  };

  const clearNotification = () => setNotification(null);

  const rawCurrentUser: User =
    (currentUserId ? state.users.find((u) => u.id === currentUserId) : undefined) ||
    state.users[0] ||
    ({
      id: '',
      email: '',
      role: 'player',
      status: 'ativa',
      createdAt: new Date().toISOString(),
      onboardingCompleted: false,
      onboardingStep: 1,
    } as User);
  const completedSet = getCompletedFirstAccessSet();

  const digits = (rawCurrentUser.whatsappNumber || '').replace(/\D/g, '');
  const hasLinkedTeam = Boolean(
    (rawCurrentUser.teamName &&
      rawCurrentUser.teamName !== 'Meu Time' &&
      rawCurrentUser.teamName !== 'Sem Time') ||
      rawCurrentUser.teamInviteCode
  );

  const isOwnerOrCoach = Boolean(rawCurrentUser.isTeamOwner || rawCurrentUser.role === 'coach');
  const isAdminUser = rawCurrentUser.role === 'admin';

  // Um usuário só pula o onboarding se for admin, dono de time/treinador, ou tiver time vinculado.
  // Atletas sem time DEVEM passar pelos passos iniciais (escolher foto/nome e entrar no time com código)
  const isAlreadyCompleted =
    Boolean(rawCurrentUser.id) &&
    (isAdminUser ||
      isOwnerOrCoach ||
      hasLinkedTeam ||
      (rawCurrentUser.onboardingCompleted === true &&
        (rawCurrentUser.onboardingStep || 1) >= 4 &&
        (completedSet.has(rawCurrentUser.id.toLowerCase()) ||
          (rawCurrentUser.email && completedSet.has(rawCurrentUser.email.toLowerCase())) ||
          (digits && (completedSet.has(digits) || completedSet.has(`${digits}@celular.futplay.com`))))));

  const currentUser: User = isAlreadyCompleted
    ? {
        ...rawCurrentUser,
        role:
          rawCurrentUser.role === 'admin'
            ? 'admin'
            : isOwnerOrCoach
            ? 'coach'
            : rawCurrentUser.role || 'player',
        onboardingCompleted: true,
        onboardingStep: 4,
      }
    : {
        ...rawCurrentUser,
        onboardingCompleted: false,
        onboardingStep: rawCurrentUser.onboardingStep || 1,
      };

  // Contas de administradores nunca participam de jogos e não aparecem em nenhuma lista de atletas
  const adminUserIds = useMemo(() => {
    const ids = new Set<string>();
    state.users.forEach((u) => {
      if (
        u.role === 'admin' ||
        (u.email && u.email.toLowerCase() === 'futplaylite@gmail.com') ||
        u.id === 'a0000000-0000-4000-8000-000000000001'
      ) {
        ids.add(u.id);
      }
    });
    return ids;
  }, [state.users]);

  const athleteProfiles = useMemo(() => {
    return state.profiles.filter(
      (p) =>
        !adminUserIds.has(p.userId) &&
        p.displayName.trim().toUpperCase() !== 'ADMIN' &&
        p.id !== 'a0000000-0000-4000-8000-000000000002' &&
        p.userId !== 'a0000000-0000-4000-8000-000000000001'
    );
  }, [state.profiles, adminUserIds]);

  const athleteSeasonEntries = useMemo(() => {
    const adminProfileIds = new Set(
      state.profiles
        .filter(
          (p) =>
            adminUserIds.has(p.userId) ||
            p.displayName.trim().toUpperCase() === 'ADMIN' ||
            p.id === 'a0000000-0000-4000-8000-000000000002' ||
            p.userId === 'a0000000-0000-4000-8000-000000000001'
        )
        .map((p) => p.id)
    );
    return state.seasonEntries.filter((se) => !adminProfileIds.has(se.playerId));
  }, [state.seasonEntries, state.profiles, adminUserIds]);

  const currentPlayerProfile =
    currentUser.role === 'admin'
      ? undefined
      : athleteProfiles.find((p: PlayerProfile) => p.userId === currentUser.id);

  const recordAuditLog: LeagueContextValue['recordAuditLog'] = (params) => {
    const now = new Date().toISOString();
    const actorUser = params.actorUserId
      ? state.users.find((u) => u.id === params.actorUserId) || currentUser
      : currentUser;
    const actorProf = params.actorUserId
      ? state.profiles.find(
          (p) => p.userId === params.actorUserId || p.id === params.actorUserId
        ) || currentPlayerProfile
      : currentPlayerProfile;

    const newLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actorUserId: params.actorUserId || actorUser?.id || 'sistema',
      actorName:
        params.actorName ||
        actorProf?.displayName ||
        actorUser?.email?.split('@')[0] ||
        'Usuário',
      actorRole: params.actorRole || actorUser?.role || 'player',
      actionType: params.actionType,
      entityType: params.entityType,
      entityId: params.entityId,
      reason: params.reason,
      beforeData: params.beforeData,
      afterData: params.afterData,
      clientApp: 'FutPlay Lite PWA v1.0',
      legalRetentionPolicy: 'Marco Civil da Internet (Art. 15, Lei 12.965/2014) & LGPD',
      retentionUntil: new Date(new Date(now).getTime() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
    };

    setState((prev) => ({
      ...prev,
      auditLogs: [newLog, ...(prev.auditLogs || [])],
    }));

    if (isSupabaseConfigured()) {
      supabaseService.recordAuditLogInSupabase(newLog).catch(() => {});
    }

    return newLog;
  };

  const switchActiveUser = (userId: string) => {
    const target = state.users.find((u) => u.id === userId);
    if (target) {
      const hasTeam = Boolean(
        (target.teamName && target.teamName !== 'Meu Time' && target.teamName !== 'Sem Time') ||
        target.teamInviteCode
      );
      if (target.role === 'admin' || target.isTeamOwner || target.role === 'coach' || hasTeam) {
        markFirstAccessCompletedInStorage(target.id, target.email, target.whatsappNumber);
      }
      setCurrentUserId(target.id);
      try {
        localStorage.setItem(ACTIVE_USER_STORAGE_KEY, target.id);
      } catch {
        // Ignore
      }
      const prof = state.profiles.find((p) => p.userId === target.id);
      const now = new Date().toISOString();
      const loginLog: AuditLog = {
        id: `audit-login-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        actorUserId: target.id,
        actorName: prof ? prof.displayName : target.email || 'Usuário',
        actorRole: target.role,
        actionType: 'LOGIN_SESSAO',
        entityType: 'users',
        entityId: target.id,
        reason: `Sessão ativa alternada para ${prof ? prof.displayName : target.email} (${target.role.toUpperCase()}).`,
        createdAt: now,
      };

      setState((prev) => ({
        ...prev,
        auditLogs: [loginLog, ...(prev.auditLogs || [])],
      }));

      notify(
        'info',
        `Sessão alternada: ${prof ? prof.displayName : 'Moderador Oficial'}`,
        `Papel ativo no servidor: ${target.role.toUpperCase()} (${target.email})`
      );
    }
  };

  const setActiveUserWithData = (user: User, profile?: PlayerProfile) => {
    const now = new Date().toISOString();
    const loginLog: AuditLog = {
      id: `audit-login-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actorUserId: user.id,
      actorName: profile?.displayName || user.email || 'Usuário',
      actorRole: user.role,
      actionType: 'LOGIN_SESSAO',
      entityType: 'users',
      entityId: user.id,
      reason: `Login realizado por ${profile?.displayName || user.email} (${user.role.toUpperCase()}).`,
      createdAt: now,
    };

    setState((prev) => {
      const userIdx = prev.users.findIndex((u) => u.id === user.id);
      const newUsers = [...prev.users];
      const prevU = userIdx >= 0 ? newUsers[userIdx] : undefined;
      const isOwner = user.isTeamOwner !== undefined
        ? user.isTeamOwner
        : (prevU ? prevU.isTeamOwner : Boolean(profile?.isTeamOwner));

      const effectiveRole: UserRole =
        user.role === 'admin'
          ? 'admin'
          : isOwner || user.role === 'coach'
          ? 'coach'
          : user.role || 'player';

      const finalTeamName = user.teamName || profile?.teamName || prevU?.teamName;
      const finalTeamCode = user.teamInviteCode || profile?.teamInviteCode || prevU?.teamInviteCode;
      const hasTeam = Boolean(
        (finalTeamName && finalTeamName !== 'Meu Time' && finalTeamName !== 'Sem Time') ||
        finalTeamCode
      );

      // Conclui onboarding APENAS se for admin, dono de time, já tiver time vinculado,
      // ou se o usuário já tiver completado explicitamente os passos antes
      const isCompleted =
        effectiveRole === 'admin' ||
        isOwner ||
        hasTeam ||
        (user.onboardingCompleted === true && (user.onboardingStep || 1) >= 4) ||
        (prevU?.onboardingCompleted === true && (prevU?.onboardingStep || 1) >= 4);

      const finalOnboardingCompleted = isCompleted;
      const finalOnboardingStep = isCompleted
        ? 4
        : (user.onboardingStep || prevU?.onboardingStep || 1);

      if (finalOnboardingCompleted) {
        markFirstAccessCompletedInStorage(user.id, user.email, user.whatsappNumber);
      } else {
        unmarkFirstAccessCompletedInStorage(user.id, user.email, user.whatsappNumber);
      }

      const updatedUser: User = {
        ...(prevU || {}),
        ...user,
        role: effectiveRole,
        teamName: finalTeamName,
        teamCrestUrl: user.teamCrestUrl || profile?.teamCrestUrl || prevU?.teamCrestUrl,
        teamCity: user.teamCity || profile?.teamCity || prevU?.teamCity,
        teamModality: user.teamModality || profile?.teamModality || prevU?.teamModality,
        teamInviteCode: finalTeamCode,
        isTeamOwner: isOwner,
        onboardingCompleted: finalOnboardingCompleted,
        onboardingStep: finalOnboardingStep,
      };

      if (userIdx >= 0) {
        newUsers[userIdx] = updatedUser;
      } else {
        newUsers.push(updatedUser);
      }

      let newProfiles = [...prev.profiles];
      if (profile) {
        const profIdx = newProfiles.findIndex(
          (p) => p.id === profile.id || p.userId === user.id
        );
        if (profIdx >= 0) {
          const prevP = newProfiles[profIdx];
          newProfiles[profIdx] = {
            ...prevP,
            ...profile,
            teamName: profile.teamName || prevP.teamName,
            teamCrestUrl: profile.teamCrestUrl || prevP.teamCrestUrl,
            teamCity: profile.teamCity || prevP.teamCity,
            teamModality: profile.teamModality || prevP.teamModality,
            teamInviteCode: profile.teamInviteCode || prevP.teamInviteCode,
            isTeamOwner: profile.isTeamOwner !== undefined ? profile.isTeamOwner : (isOwner || prevP.isTeamOwner),
          };
        } else {
          newProfiles.push({
            ...profile,
            isTeamOwner: profile.isTeamOwner !== undefined ? profile.isTeamOwner : isOwner,
          });
        }
      }

      return {
        ...prev,
        users: newUsers,
        profiles: newProfiles,
        auditLogs: [loginLog, ...(prev.auditLogs || [])],
      };
    });

    setCurrentUserId(user.id);
    try {
      localStorage.setItem(ACTIVE_USER_STORAGE_KEY, user.id);
    } catch {
      // Ignore
    }
  };

  // Remove um usuário apenas da memória local (sem notificação e sem tocar no Supabase).
  // Usado para descartar contas antigas que ficaram só no aparelho e nunca chegaram ao banco.
  const removeLocalUserSilently = (userId: string) => {
    if (!userId) return;
    setState((prev) => {
      const prof = prev.profiles.find((p) => p.userId === userId);
      return {
        ...prev,
        users: prev.users.filter((u) => u.id !== userId),
        profiles: prev.profiles.filter((p) => p.userId !== userId),
        seasonEntries: prev.seasonEntries.filter(
          (se) => !prof || se.playerId !== prof.id
        ),
      };
    });
  };

  // RF-001, RF-002, RF-003: Cadastro de Novo Atleta na Liga Municipal
  const registerNewAthlete: LeagueContextValue['registerNewAthlete'] = (
    params
  ) => {
    const trimmedName = params.displayName.trim();
    if (trimmedName.length < 2) {
      notify(
        'error',
        'Apelido inválido',
        'O apelido esportivo deve ter pelo menos 2 caracteres.'
      );
      return null;
    }

    const nameUpper = trimmedName.toUpperCase();
    const isConflict = state.profiles.some(
      (p) => p.displayName.trim().toUpperCase() === nameUpper
    );
    if (isConflict) {
      notify(
        'error',
        'Apelido indisponível',
        `O apelido "${trimmedName}" já está em uso por outro atleta na liga. Por favor, escolha outro apelido ou adicione seu sobrenome.`
      );
      return null;
    }

    const now = new Date().toISOString();
    const newUserId = generateUUID();
    const newPlayerId = generateUUID();

    const isFirstUser = state.users.length === 0;

    const newUser: User = {
      id: newUserId,
      email: params.email?.trim() || `${trimmedName.toLowerCase().replace(/\s+/g, '')}@futplay.com`,
      whatsappNumber: params.whatsappNumber?.trim() || undefined,
      role: 'player',
      isTeamOwner: false,
      teamName: undefined,
      teamCity: 'Planalto - BA',
      status: 'ativa',
      createdAt: now,
      onboardingStep: 1,
      onboardingCompleted: false,
    };

    // Garante que uma nova conta SEMPRE passe pelos passos de primeiro acesso
    unmarkFirstAccessCompletedInStorage(
      newUserId,
      newUser.email,
      newUser.whatsappNumber
    );

    const targetCityId = params.cityId || selectedCityId || '11111111-1111-4111-8111-111111111101';
    const targetDivisionId = '22222222-2222-4222-8222-222222222201';

    const newProfile: PlayerProfile = {
      id: newPlayerId,
      userId: newUserId,
      displayName: trimmedName,
      fullNamePrivate: trimmedName,
      whatsappNumber: params.whatsappNumber?.trim() || undefined,
      avatarColor: '#126B46',
      cityId: targetCityId,
      neighborhood: params.neighborhood.trim() || 'Centro',
      position: params.position,
      dominantFoot: params.dominantFoot,
      profileVisibility: params.profileVisibility || 'publico',
      currentRating: 1000, // Valor inicial oficial (Seção 3.2)
      ratingUncertainty: 100,
      isProvisional: true, // Classificação provisória (Seção 2.3 / CA-021)
      currentDivisionId: targetDivisionId,
      totalValidatedMatches: 0,
      isTeamOwner: false,
      teamName: undefined,
      teamCity: 'Planalto - BA',
      experimentalPositionScore: null,
      badges: ['Estreante Planalto'],
      createdAt: now,
      updatedAt: now,
    };

    const activeSeason =
      state.seasons.find(
        (s) => s.cityId === targetCityId && s.status === 'ativa'
      ) || state.seasons[0];

    const newSeasonEntry: SeasonEntry = {
      id: generateUUID(),
      seasonId: activeSeason?.id || '33333333-3333-4333-8333-333333333301',
      playerId: newPlayerId,
      divisionId: targetDivisionId,
      seasonPoints: 0,
      pendingPoints: 0,
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals: 0,
      assists: 0,
      mvpCount: 0,
      cleanSheets: 0,
      defensiveActions: 0,
      status: 'provisorio',
      updatedAt: now,
    };

    const newAudit: AuditLog = {
      id: `audit-${Date.now()}`,
      actorUserId: newUserId,
      actorName: trimmedName,
      actorRole: 'player',
      actionType: 'ATHLETE_REGISTERED',
      entityType: 'player_profiles',
      entityId: newPlayerId,
      reason: 'Cadastro inicial de atleta na Liga Municipal.',
      afterData: {
        displayName: trimmedName,
        cityId: targetCityId,
      },
      createdAt: now,
    };

    setState((prev) => ({
      ...prev,
      users: [...prev.users, newUser],
      profiles: [...prev.profiles, newProfile],
      seasonEntries: [...prev.seasonEntries, newSeasonEntry],
      auditLogs: [newAudit, ...prev.auditLogs],
    }));

    // Sincroniza diretamente com o Supabase para persistência multi-dispositivo
    if (isSupabaseConfigured()) {
      supabaseService.recordAuditLogInSupabase(newAudit).catch(() => {});
      supabaseService
        .registerAthleteInSupabase({
          user: newUser,
          profile: newProfile,
          password: params.password,
        })
        .then((res) => {
          if (!res.success) {
            console.warn('Aviso ao sincronizar atleta com Supabase:', res.error);
          }
        });
    }

    setCurrentUserId(newUserId);
    notify(
      'success',
      'Bem-vindo ao FutPlay Lite!',
      `${trimmedName} ingressou oficialmente na temporada!`
    );
    return newProfile;
  };

  // CA-005, CA-006: Atualizar apenas dados editáveis do próprio perfil
  const updateOwnProfile: LeagueContextValue['updateOwnProfile'] = (params) => {
    if (!currentPlayerProfile) {
      notify(
        'error',
        'Perfil não encontrado',
        'Apenas contas de atleta possuem perfil esportivo editável.'
      );
      return false;
    }

    const trimmedName = params.displayName.trim();
    if (trimmedName.length < 2) {
      notify(
        'error',
        'Apelido inválido',
        'O apelido esportivo deve ter pelo menos 2 caracteres.'
      );
      return false;
    }

    // Validação de unicidade do apelido
    const nameUpper = trimmedName.toUpperCase();
    const isConflict = state.profiles.some(
      (p) =>
        p.id !== currentPlayerProfile.id &&
        p.displayName.trim().toUpperCase() === nameUpper
    );

    if (isConflict) {
      notify(
        'error',
        'Apelido já em uso',
        `O apelido "${trimmedName}" já está cadastrado por outro atleta na liga. Por favor, escolha outro apelido ou adicione seu sobrenome.`
      );
      return false;
    }

    const now = new Date().toISOString();
    const finalAvatar =
      params.avatarUrl !== undefined
        ? params.avatarUrl
        : currentPlayerProfile.avatarUrl;

    const profLog: AuditLog = {
      id: `audit-prof-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actorUserId: currentUser.id,
      actorName: trimmedName,
      actorRole: currentUser.role,
      actionType: 'PERFIL_ATUALIZADO',
      entityType: 'player_profiles',
      entityId: currentPlayerProfile.id,
      reason: `Atleta ${trimmedName} atualizou seus dados cadastrais (${params.position}, ${params.neighborhood}).`,
      createdAt: now,
    };

    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? {
              ...u,
              avatarUrl: finalAvatar,
            }
          : u
      ),
      profiles: prev.profiles.map((p) =>
        p.id === currentPlayerProfile.id
          ? {
              ...p,
              displayName: trimmedName,
              avatarUrl: finalAvatar,
              neighborhood: params.neighborhood.trim() || p.neighborhood,
              position: params.position,
              dominantFoot: params.dominantFoot,
              profileVisibility: params.profileVisibility,
              updatedAt: now,
            }
          : p
      ),
      auditLogs: [profLog, ...(prev.auditLogs || [])],
    }));

    if (isSupabaseConfigured() && currentUser?.id) {
      supabaseService.updateProfile(currentUser.id, {
        displayName: trimmedName,
        avatarUrl: finalAvatar,
        position: params.position,
        dominantFoot: params.dominantFoot,
        profileVisibility: params.profileVisibility,
      });
    }

    notify(
      'success',
      'Perfil atualizado com sucesso!',
      'Suas alterações foram salvas e sincronizadas.'
    );
    return true;
  };

  const updateTeamInfo: LeagueContextValue['updateTeamInfo'] = (params) => {
    const trimmedTeam = params.teamName.trim();
    if (trimmedTeam.length < 2) {
      notify(
        'error',
        'Nome inválido',
        'O nome da equipe deve ter no mínimo 2 caracteres.'
      );
      return false;
    }

    const trimmedCity = params.teamCity?.trim() || 'Planalto - BA';
    const oldTeamName = (currentUser.teamName || currentPlayerProfile?.teamName || '').trim();
    const now = new Date().toISOString();

    setState((prev) => {
      const updatedUsers = prev.users.map((u) => {
        if (u.id === currentUser.id) {
          return {
            ...u,
            teamName: trimmedTeam,
            teamCity: trimmedCity,
            teamCrestUrl: params.teamCrestUrl !== undefined ? params.teamCrestUrl : u.teamCrestUrl,
            teamModality: params.teamModality || u.teamModality || 'society',
            isTeamOwner: true,
            role: (u.role === 'admin' ? 'admin' : 'coach') as UserRole,
          };
        }
        if (
          oldTeamName &&
          u.teamName &&
          u.teamName.trim().toLowerCase() === oldTeamName.toLowerCase()
        ) {
          return {
            ...u,
            teamName: trimmedTeam,
            teamCity: trimmedCity,
            teamCrestUrl: params.teamCrestUrl !== undefined ? params.teamCrestUrl : u.teamCrestUrl,
            teamModality: params.teamModality || u.teamModality,
          };
        }
        return u;
      });

      const updatedProfiles = prev.profiles.map((p) => {
        if (p.userId === currentUser.id) {
          return {
            ...p,
            teamName: trimmedTeam,
            teamCity: trimmedCity,
            teamCrestUrl: params.teamCrestUrl !== undefined ? params.teamCrestUrl : p.teamCrestUrl,
            teamModality: params.teamModality || p.teamModality || 'society',
            isTeamOwner: true,
            updatedAt: now,
          };
        }
        if (
          oldTeamName &&
          p.teamName &&
          p.teamName.trim().toLowerCase() === oldTeamName.toLowerCase()
        ) {
          return {
            ...p,
            teamName: trimmedTeam,
            teamCity: trimmedCity,
            teamCrestUrl: params.teamCrestUrl !== undefined ? params.teamCrestUrl : p.teamCrestUrl,
            teamModality: params.teamModality || p.teamModality,
            updatedAt: now,
          };
        }
        return p;
      });

      const teamLog: AuditLog = {
        id: `audit-team-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        actorUserId: currentUser.id,
        actorName: currentPlayerProfile?.displayName || currentUser.email || 'Treinador',
        actorRole: currentUser.role,
        actionType: 'TIME_ATUALIZADO',
        entityType: 'teams',
        entityId: currentUser.id,
        reason: `Equipe atualizada para "${trimmedTeam}" (${trimmedCity}).`,
        createdAt: now,
      };

      return {
        ...prev,
        users: updatedUsers,
        profiles: updatedProfiles,
        auditLogs: [teamLog, ...(prev.auditLogs || [])],
      };
    });

    if (params.teamCrestUrl) {
      try {
        const rawCrests = localStorage.getItem('futplay_team_crests_v1');
        const crestMap = rawCrests ? JSON.parse(rawCrests) : {};
        crestMap[trimmedTeam.toLowerCase()] = params.teamCrestUrl;
        if (oldTeamName) crestMap[oldTeamName.toLowerCase()] = params.teamCrestUrl;
        localStorage.setItem('futplay_team_crests_v1', JSON.stringify(crestMap));

        const rawTeams = localStorage.getItem('futplay_registered_teams_v1');
        if (rawTeams) {
          const teamsList = JSON.parse(rawTeams);
          if (Array.isArray(teamsList)) {
            const updated = teamsList.map((t: any) => {
              if (
                (t.name && t.name.toLowerCase() === trimmedTeam.toLowerCase()) ||
                (oldTeamName && t.name && t.name.toLowerCase() === oldTeamName.toLowerCase())
              ) {
                return { ...t, name: trimmedTeam, crestUrl: params.teamCrestUrl };
              }
              return t;
            });
            localStorage.setItem('futplay_registered_teams_v1', JSON.stringify(updated));
          }
        }
      } catch {}
    }

    if (isSupabaseConfigured() && currentUser?.id) {
      supabaseService.updateProfile(currentUser.id, {
        teamName: trimmedTeam,
        teamCity: trimmedCity,
        teamCrestUrl: params.teamCrestUrl,
        teamModality: params.teamModality,
        isTeamOwner: true,
      });
    }

    notify(
      'success',
      'Time Atualizado com Sucesso!',
      `A equipe oficial agora é "${trimmedTeam}".`
    );
    return true;
  };

  // Exclusão de Conta de Atleta ou Treinador (Direito de eliminação / LGPD / Admin)
  const deleteUserAccount: LeagueContextValue['deleteUserAccount'] = async (targetUserId) => {
    const userIdToDelete = targetUserId || currentUserId;
    if (!userIdToDelete) return false;

    const profileToDelete = state.profiles.find((p) => p.userId === userIdToDelete || p.id === userIdToDelete);
    const userToDelete = state.users.find((u) => u.id === userIdToDelete || (profileToDelete && u.id === profileToDelete.userId));
    const effectiveUserId = userToDelete?.id || profileToDelete?.userId || userIdToDelete;

    // 1. Sincroniza exclusão no Supabase PRIMEIRO (aguardando conclusão antes de eventual reload)
    if (isSupabaseConfigured()) {
      try {
        await supabaseService.deleteUser(
          effectiveUserId,
          userToDelete?.email,
          userToDelete?.whatsappNumber
        );
      } catch (err) {
        console.warn('Erro ao excluir no Supabase:', err);
      }
    }

    // 2. Remove senhas, credenciais locais e histórico de primeiro acesso
    unmarkFirstAccessCompletedInStorage(
      effectiveUserId,
      userToDelete?.email,
      userToDelete?.whatsappNumber
    );
    try {
      const stored = JSON.parse(localStorage.getItem('futplay_user_passwords') || '{}');
      delete stored[effectiveUserId];
      delete stored[userIdToDelete];
      if (profileToDelete) {
        delete stored[profileToDelete.id];
        delete stored[profileToDelete.userId];
      }
      if (userToDelete?.whatsappNumber) {
        delete stored[userToDelete.whatsappNumber.replace(/\D/g, '')];
      }
      if (userToDelete?.email) {
        delete stored[userToDelete.email.toLowerCase()];
      }
      localStorage.setItem('futplay_user_passwords', JSON.stringify(stored));
    } catch {
      // Ignore
    }

    // 3. Se o usuário excluído for o ativo, limpa as sessões locais de login
    const isCurrentActive = effectiveUserId === currentUserId || userIdToDelete === currentUserId;
    if (isCurrentActive) {
      setCurrentUserId('');
      try {
        localStorage.removeItem('futplay_lite_auth_session_v1');
        localStorage.removeItem('futplay_lite_auth_session_v2');
        localStorage.removeItem('futplay_lite_auth_session_v3');
        localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
      } catch {
        // Ignore
      }
    }

    // 4. Remove o usuário e perfil do estado da liga e persiste imediatamente no localStorage
    setState((prev) => {
      const remainingUsers = prev.users.filter(
        (u) => u.id !== effectiveUserId && u.id !== userIdToDelete && (!profileToDelete || u.id !== profileToDelete.userId)
      );
      const remainingProfiles = prev.profiles.filter(
        (p) => p.userId !== effectiveUserId && p.userId !== userIdToDelete && (!profileToDelete || p.id !== profileToDelete.id)
      );
      const remainingSeasonEntries = prev.seasonEntries.filter(
        (se) => !profileToDelete || se.playerId !== profileToDelete.id
      );

      const now = new Date().toISOString();
      const delLog: AuditLog = {
        id: `audit-del-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        actorUserId: currentUser.id || 'sistema',
        actorName: currentPlayerProfile?.displayName || currentUser.email || 'Administrador',
        actorRole: currentUser.role || 'admin',
        actionType: 'CONTA_EXCLUIDA',
        entityType: 'users',
        entityId: effectiveUserId,
        reason: `Exclusão permanente de conta: ${profileToDelete?.displayName || userToDelete?.email || effectiveUserId} (${profileToDelete?.role === 'coach' || profileToDelete?.isTeamOwner ? 'Treinador' : 'Atleta'}).`,
        createdAt: now,
      };

      const nextState: LeagueState = {
        ...prev,
        users: remainingUsers,
        profiles: remainingProfiles,
        seasonEntries: remainingSeasonEntries,
        auditLogs: [delLog, ...(prev.auditLogs || [])],
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      } catch {
        // Ignore
      }

      return nextState;
    });

    notify(
      'info',
      'Conta Excluída com Sucesso',
      `A conta de ${profileToDelete?.displayName || userToDelete?.email || 'membro'} foi removida permanentemente da liga.`
    );

    return true;
  };

  // Avaliação multicritério de estrelas (5 quesitos) calculada a partir da MÉDIA de todas as avaliações
  const updatePlayerSkills: LeagueContextValue['updatePlayerSkills'] = (
    playerId,
    skills,
    evaluatorId
  ) => {
    const p = state.profiles.find((prof) => prof.id === playerId);
    if (!p) {
      return false;
    }

    const evaluatorUser =
      (evaluatorId ? state.users.find((u) => u.id === evaluatorId) : undefined) ||
      currentUser;
    const evaluatorProfile =
      (evaluatorId ? state.profiles.find((prof) => prof.id === evaluatorId || prof.userId === evaluatorId) : undefined) ||
      currentPlayerProfile;

    const isSelf = p.id === evaluatorProfile?.id || p.userId === evaluatorUser?.id;
    if (isSelf && evaluatorUser?.role === 'player') {
      notify(
        'error',
        'Autoavaliação bloqueada',
        'Você não pode classificar a si mesmo. Suas estrelas são avaliadas pelos companheiros do seu time.'
      );
      return false;
    }

    // Regra de Negócio: Jogadores de times diferentes não podem avaliar jogadores de outros times, apenas do seu mesmo time
    let myTeam = (evaluatorUser?.teamName || evaluatorProfile?.teamName || '').trim().toLowerCase();
    let myCode = (evaluatorUser?.teamInviteCode || evaluatorProfile?.teamInviteCode || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    try {
      const rawTeams = localStorage.getItem('futplay_registered_teams_v1');
      if (rawTeams) {
        const list = JSON.parse(rawTeams);
        if (Array.isArray(list)) {
          const t = list.find((item: any) =>
            item.ownerUserId === evaluatorUser?.id ||
            (item.ownerName && evaluatorProfile?.displayName && item.ownerName.trim().toLowerCase() === evaluatorProfile.displayName.trim().toLowerCase())
          );
          if (t) {
            if (!myTeam || myTeam === 'meu time' || myTeam === 'sem time') myTeam = (t.name || '').trim().toLowerCase();
            if (!myCode) myCode = (t.inviteCode || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          }
        }
      }
    } catch {}

    const playerTeam = (p.teamName || '').trim().toLowerCase();
    const playerCode = (p.teamInviteCode || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    const isSameTeam =
      Boolean(playerTeam) &&
      playerTeam !== 'sem time' &&
      playerTeam !== 'meu time' &&
      (playerTeam === myTeam || (Boolean(playerCode) && playerCode === myCode));

    if (!isSelf && !isSameTeam && evaluatorUser?.role !== 'admin') {
      notify(
        'error',
        'Avaliação restrita',
        'Jogadores de times diferentes não podem avaliar jogadores de outros times, apenas do seu mesmo time.'
      );
      return false;
    }

    const fin = Math.max(0, Math.min(5, skills.finalizacao ?? 0));
    const mar = Math.max(0, Math.min(5, skills.marcacao ?? 0));
    const pas = Math.max(0, Math.min(5, skills.passe ?? 0));
    const rac = Math.max(0, Math.min(5, skills.raca ?? 0));
    const dri = Math.max(0, Math.min(5, skills.drible ?? 0));

    const activeEvaluatorId =
      evaluatorId || currentUserId || currentPlayerProfile?.id || 'evaluator-anonymous';
    const now = new Date().toISOString();

    setState((prev) => {
      const currentEvals = prev.peerEvaluations || [];
      const existingIdx = currentEvals.findIndex(
        (e) => e.evaluatorId === activeEvaluatorId && e.targetPlayerId === playerId
      );

      const evaluationRecord: PeerEvaluation = {
        id:
          existingIdx >= 0
            ? currentEvals[existingIdx].id
            : `pe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        evaluatorId: activeEvaluatorId,
        targetPlayerId: playerId,
        finalizacao: fin,
        marcacao: mar,
        passe: pas,
        raca: rac,
        drible: dri,
        createdAt: existingIdx >= 0 ? currentEvals[existingIdx].createdAt : now,
        updatedAt: now,
      };

      const updatedEvals =
        existingIdx >= 0
          ? currentEvals.map((e, idx) => (idx === existingIdx ? evaluationRecord : e))
          : [...currentEvals, evaluationRecord];

      // Filtra todas as avaliações feitas para este jogador específico (apenas avaliações ativas)
      const targetEvals = updatedEvals.filter(
        (e) =>
          e.targetPlayerId === playerId &&
          (e.finalizacao > 0 || e.marcacao > 0 || e.passe > 0 || e.raca > 0 || e.drible > 0)
      );
      const totalVotes = targetEvals.length;

      // Calcula a média exata de cada quesito entre todos os avaliadores
      const avgFin = totalVotes > 0
        ? Number((targetEvals.reduce((acc, cur) => acc + (cur.finalizacao || 0), 0) / totalVotes).toFixed(1))
        : 0;
      const avgMar = totalVotes > 0
        ? Number((targetEvals.reduce((acc, cur) => acc + (cur.marcacao || 0), 0) / totalVotes).toFixed(1))
        : 0;
      const avgPas = totalVotes > 0
        ? Number((targetEvals.reduce((acc, cur) => acc + (cur.passe || 0), 0) / totalVotes).toFixed(1))
        : 0;
      const avgRac = totalVotes > 0
        ? Number((targetEvals.reduce((acc, cur) => acc + (cur.raca || 0), 0) / totalVotes).toFixed(1))
        : 0;
      const avgDri = totalVotes > 0
        ? Number((targetEvals.reduce((acc, cur) => acc + (cur.drible || 0), 0) / totalVotes).toFixed(1))
        : 0;

      // A média das 5 notas médias resulta na nota geral em estrelas
      const overallStars = totalVotes > 0
        ? Number(((avgFin + avgMar + avgPas + avgRac + avgDri) / 5).toFixed(1))
        : 0;

      const skillLog: AuditLog = {
        id: `audit-skill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        actorUserId: currentUser.id,
        actorName: currentPlayerProfile?.displayName || currentUser.email || 'Avaliador',
        actorRole: currentUser.role,
        actionType: 'SCOUT_AVALIACAO',
        entityType: 'peer_evaluations',
        entityId: playerId,
        reason: `Avaliação de atributos (Scout) gravada para ${p.displayName}. Média geral de ${totalVotes} avaliador(es): ${overallStars} ⭐.`,
        afterData: evaluationRecord as any,
        createdAt: now,
      };

      try {
        localStorage.setItem('futplay_peer_evaluations_v1', JSON.stringify(updatedEvals));
      } catch {}

      if (isSupabaseConfigured()) {
        supabaseService.savePeerEvaluation(evaluationRecord, targetEvals).catch((err) => {
          console.warn('Erro ao sincronizar avaliação de atleta no Supabase:', err);
        });
        supabaseService.recordAuditLogInSupabase(skillLog).catch(() => {});
      }

      return {
        ...prev,
        peerEvaluations: updatedEvals,
        profiles: prev.profiles.map((prof) =>
          prof.id === playerId
            ? {
                ...prof,
                skills: {
                  finalizacao: avgFin,
                  marcacao: avgMar,
                  passe: avgPas,
                  raca: avgRac,
                  drible: avgDri,
                  totalVotes,
                  lastRatedAt: now,
                },
                overallStars,
                updatedAt: now,
              }
            : prof
        ),
        auditLogs: [skillLog, ...(prev.auditLogs || [])],
      };
    });

    notify(
      'success',
      'Classificação gravada com sucesso!',
      `Sua classificação para ${p.displayName} foi gravada. A média geral do atleta foi recalculada com as avaliações de todos os jogadores.`
    );

    return true;
  };

  // RF-004, RF-005, CA-007, CA-008: Cadastro de Partida Comunitária com trava de duplicidade de escalação
  const createCommunityMatch: LeagueContextValue['createCommunityMatch'] = (
    params
  ) => {
    // Verificar duplicidade de jogador na mesma partida (CA-008)
    const overlap = params.homePlayerIds.filter((id) =>
      params.awayPlayerIds.includes(id)
    );
    if (overlap.length > 0) {
      notify(
        'error',
        'Escalação duplicada bloqueada (CA-008)',
        'Um mesmo atleta não pode ser escalado simultaneamente nas duas equipes.'
      );
      return null;
    }

    const uniqueHome = Array.from(new Set(params.homePlayerIds));
    const uniqueAway = Array.from(new Set(params.awayPlayerIds));

    if (uniqueHome.length < 2 || uniqueAway.length < 2) {
      notify(
        'error',
        'Escalação mínima necessária',
        'Selecione pelo menos 2 atletas confirmados em cada equipe para registrar a súmula.'
      );
      return null;
    }

    const now = new Date().toISOString();
    const matchId = `match-${Date.now().toString().slice(-5)}`;

    const newMatchPlayers: MatchPlayer[] = [
      ...uniqueHome.map((pid, idx) => {
        const prof = state.profiles.find((p) => p.id === pid);
        return {
          id: `mp-${matchId}-h-${idx}`,
          matchId,
          playerId: pid,
          teamSide: 'home' as const,
          isCaptain: pid === params.homeCaptainId,
          positionPlayed:
            prof && prof.position !== 'multiplas' ? prof.position : 'atacante',
          participationStatus: 'confirmado' as const,
          minutesPlayed: 60,
          confirmedAt: now,
        };
      }),
      ...uniqueAway.map((pid, idx) => {
        const prof = state.profiles.find((p) => p.id === pid);
        return {
          id: `mp-${matchId}-a-${idx}`,
          matchId,
          playerId: pid,
          teamSide: 'away' as const,
          isCaptain: pid === params.awayCaptainId,
          positionPlayed:
            prof && prof.position !== 'multiplas' ? prof.position : 'defensor',
          participationStatus: 'confirmado' as const,
          minutesPlayed: 60,
          confirmedAt: now,
        };
      }),
    ];

    const draftMatch: Match = {
      id: matchId,
      cityId: selectedCityId,
      seasonId: selectedSeasonId,
      createdBy: currentUser.id,
      scheduledAt: params.scheduledAt || now,
      startedAt: now,
      lineupFrozenAt: now,
      venueName: params.venueName.trim() || 'Campo Comunitário Rosália',
      neighborhood: params.neighborhood.trim() || 'Centro',
      format: params.format,
      homeTeamName: params.homeTeamName.trim() || 'Equipe Verde',
      awayTeamName: params.awayTeamName.trim() || 'Equipe Dourada',
      homeCaptainId: params.homeCaptainId || uniqueHome[0],
      awayCaptainId: params.awayCaptainId || uniqueAway[0],
      status: 'escalacao_confirmada',
      rulesetVersion: 'v1.0.0',
      fraudHold: false,
      fraudSignals: [],
      createdAt: now,
      updatedAt: now,
    };

    const signals = inspectMatchForFraudSignals({
      targetMatch: draftMatch,
      targetPlayers: newMatchPlayers,
      allMatches: state.matches,
      allMatchPlayers: state.matchPlayers,
      confirmations: [],
    });

    draftMatch.fraudSignals = signals;

    const audit: AuditLog = {
      id: `audit-${Date.now()}`,
      actorUserId: currentUser.id,
      actorName: currentPlayerProfile?.displayName || currentUser.email,
      actorRole: currentUser.role,
      actionType: 'MATCH_CREATED_AND_LINEUP_FROZEN',
      entityType: 'matches',
      entityId: matchId,
      reason: `Partida ${draftMatch.homeTeamName} vs ${draftMatch.awayTeamName} (${draftMatch.format}) cadastrada com escalação congelada.`,
      afterData: {
        venue: draftMatch.venueName,
        format: draftMatch.format,
        playersCount: newMatchPlayers.length,
      },
      createdAt: now,
    };

    setState((prev) => ({
      ...prev,
      matches: [draftMatch, ...prev.matches],
      matchPlayers: [...prev.matchPlayers, ...newMatchPlayers],
      auditLogs: [audit, ...prev.auditLogs],
    }));

    notify(
      'success',
      'Partida registrada e escalação congelada!',
      `Partida #${matchId.slice(-4)} criada. Agora você pode registrar o placar e os eventos após o jogo.`
    );
    return draftMatch;
  };

  // Função interna atômica e idempotente para processar uma partida validada (Seção 8 / CA-014)
  const executeAtomicMatchProcessing = (
    draftState: LeagueState,
    matchId: string,
    resultVersionId: string,
    actorUserId: string,
    actorLabel: string
  ): LeagueState => {
    const match = draftState.matches.find((m) => m.id === matchId);
    const resultVer = draftState.matchResults.find(
      (r) => r.id === resultVersionId
    );
    if (!match || !resultVer) return draftState;

    // Trava de idempotência (CA-014): Verifica se já há transação de crédito para esta versão
    const alreadyProcessed = draftState.pointTransactions.some(
      (pt) =>
        pt.sourceResultVersionId === resultVersionId &&
        pt.transactionType === 'credito'
    );
    if (alreadyProcessed) {
      return draftState;
    }

    const now = new Date().toISOString();
    const participants = draftState.matchPlayers.filter(
      (mp) =>
        mp.matchId === matchId &&
        (mp.participationStatus === 'participou' ||
          mp.participationStatus === 'confirmado')
    );

    const homePlayers = participants.filter((p) => p.teamSide === 'home');
    const awayPlayers = participants.filter((p) => p.teamSide === 'away');

    const getAvgRating = (list: MatchPlayer[]) => {
      if (list.length === 0) return 1000;
      const sum = list.reduce((acc, mp) => {
        const prof = draftState.profiles.find((p) => p.id === mp.playerId);
        return acc + (prof ? prof.currentRating : 1000);
      }, 0);
      return Math.round(sum / list.length);
    };

    const homeAvgRating = getAvgRating(homePlayers);
    const awayAvgRating = getAvgRating(awayPlayers);

    const eventsForVersion = draftState.matchEvents.filter(
      (ev) => ev.resultVersionId === resultVersionId
    );

    const newTransactions: PointTransaction[] = [];
    const newRatingLogs: PlayerRatingLog[] = [];
    const updatedProfiles = [...draftState.profiles];
    const updatedEntries = [...draftState.seasonEntries];

    for (const mp of participants) {
      const profIdx = updatedProfiles.findIndex((p) => p.id === mp.playerId);
      if (profIdx === -1) continue;
      const prof = updatedProfiles[profIdx];

      const isHome = mp.teamSide === 'home';
      const teamResult: 'win' | 'draw' | 'loss' =
        resultVer.homeScore === resultVer.awayScore
          ? 'draw'
          : (isHome && resultVer.homeScore > resultVer.awayScore) ||
              (!isHome && resultVer.awayScore > resultVer.homeScore)
            ? 'win'
            : 'loss';

      const actualScore: 1 | 0.5 | 0 =
        teamResult === 'win' ? 1 : teamResult === 'draw' ? 0.5 : 0;

      const playerGoals = eventsForVersion.filter(
        (e) => e.playerId === mp.playerId && e.eventType === 'gol'
      ).length;
      const playerAssists = eventsForVersion.filter(
        (e) => e.playerId === mp.playerId && e.eventType === 'assistencia'
      ).length;
      const playerGkCapas = eventsForVersion.filter(
        (e) => e.playerId === mp.playerId && e.eventType === 'capa_goleiro'
      ).length;
      const playerYellowCards = eventsForVersion.filter(
        (e) => e.playerId === mp.playerId && e.eventType === 'cartao_amarelo'
      ).length;
      const playerBlueCards = eventsForVersion.filter(
        (e) => e.playerId === mp.playerId && e.eventType === 'cartao_azul'
      ).length;
      const playerRedCards = eventsForVersion.filter(
        (e) => e.playerId === mp.playerId && e.eventType === 'cartao_vermelho'
      ).length;
      const isMvp =
        resultVer.mvpPlayerId === mp.playerId ||
        eventsForVersion.some(
          (e) => e.playerId === mp.playerId && e.eventType === 'super_capa'
        );

      // 1. Cálculo de Pontos da Temporada: P = 5 + R + 3G + 2A + 3M
      const breakdown = calculateMatchSeasonPoints({
        teamResult,
        validatedGoals: playerGoals,
        validatedAssists: playerAssists,
        isValidatedMvp: isMvp,
      });

      newTransactions.push({
        id: `ptx-${resultVersionId}-${mp.playerId}`,
        playerId: mp.playerId,
        seasonId: match.seasonId,
        matchId: match.id,
        sourceResultVersionId: resultVersionId,
        transactionType: 'credito',
        pointsDelta: breakdown.total,
        breakdown,
        reasonCode: `PARTIDA_VALIDADA_V${resultVer.versionNumber}`,
        createdBy: actorUserId,
        createdAt: now,
      });

      // 2. Cálculo de Rating de Habilidade (Elo Coletivo, sem somar gols/assistências diretamente)
      const eloResult = calculatePlayerEloUpdate({
        playerRatingBefore: prof.currentRating,
        playerUncertaintyBefore: prof.ratingUncertainty,
        totalValidatedMatchesBefore: prof.totalValidatedMatches,
        teamAverageRating: isHome ? homeAvgRating : awayAvgRating,
        opponentAverageRating: isHome ? awayAvgRating : homeAvgRating,
        actualScore,
      });

      newRatingLogs.push({
        id: `rlog-${resultVersionId}-${mp.playerId}`,
        playerId: mp.playerId,
        matchId: match.id,
        resultVersionId,
        operationType: 'aplicacao',
        ratingBefore: eloResult.ratingBefore,
        ratingAfter: eloResult.ratingAfter,
        ratingDelta: eloResult.ratingDelta,
        uncertaintyBefore: eloResult.uncertaintyBefore,
        uncertaintyAfter: eloResult.uncertaintyAfter,
        kFactor: eloResult.kFactor,
        expectedScore: eloResult.expectedScore,
        actualScore: eloResult.actualScore,
        teamAvgRating: isHome ? homeAvgRating : awayAvgRating,
        opponentAvgRating: isHome ? awayAvgRating : homeAvgRating,
        algorithmVersion: ELO_ALGORITHM_VERSION,
        calculationStatus: 'aplicado',
        createdAt: now,
      });

      const newTotalMatches = prof.totalValidatedMatches + 1;
      const newDiv = resolveDivisionForPlayer(
        eloResult.ratingAfter,
        newTotalMatches,
        draftState.divisions
      );

      // 3. Atualizar SeasonEntry do jogador
      let entryIdx = updatedEntries.findIndex(
        (se) => se.seasonId === match.seasonId && se.playerId === mp.playerId
      );
      if (entryIdx === -1) {
        updatedEntries.push({
          id: `se-${match.seasonId}-${mp.playerId}`,
          seasonId: match.seasonId,
          playerId: mp.playerId,
          divisionId: newDiv.id,
          seasonPoints: 0,
          pendingPoints: 0,
          matchesPlayed: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goals: 0,
          assists: 0,
          mvpCount: 0,
          superCapas: 0,
          goalkeeperCapas: 0,
          capaEfficiencyPct: 0,
          yellowCards: 0,
          blueCards: 0,
          redCards: 0,
          cleanSheets: 0,
          defensiveActions: 0,
          status: 'provisorio',
          updatedAt: now,
        });
        entryIdx = updatedEntries.length - 1;
      }

      const currentEntry = updatedEntries[entryIdx];
      const concededGoals = isHome ? resultVer.awayScore : resultVer.homeScore;
      const nextMatchesPlayed = currentEntry.matchesPlayed + 1;
      const nextSuperCapas =
        (currentEntry.superCapas ?? currentEntry.mvpCount) +
        (isMvp ? 1 : 0) +
        playerGkCapas;
      const nextGoalkeeperCapas =
        (currentEntry.goalkeeperCapas ?? 0) + playerGkCapas;
      const nextYellowCards =
        (currentEntry.yellowCards ?? 0) + playerYellowCards;
      const nextBlueCards = (currentEntry.blueCards ?? 0) + playerBlueCards;
      const nextRedCards = (currentEntry.redCards ?? 0) + playerRedCards;
      const nextCapaEfficiencyPct =
        nextMatchesPlayed > 0
          ? Math.round((nextSuperCapas / nextMatchesPlayed) * 100)
          : 0;

      const updatedEntry: SeasonEntry = {
        ...currentEntry,
        divisionId: newDiv.id,
        seasonPoints: currentEntry.seasonPoints + breakdown.total,
        pendingPoints: Math.max(0, currentEntry.pendingPoints - breakdown.total),
        matchesPlayed: nextMatchesPlayed,
        wins: currentEntry.wins + (teamResult === 'win' ? 1 : 0),
        draws: currentEntry.draws + (teamResult === 'draw' ? 1 : 0),
        losses: currentEntry.losses + (teamResult === 'loss' ? 1 : 0),
        goals: currentEntry.goals + playerGoals,
        assists: currentEntry.assists + playerAssists,
        mvpCount: nextSuperCapas,
        superCapas: nextSuperCapas,
        goalkeeperCapas: nextGoalkeeperCapas,
        capaEfficiencyPct: nextCapaEfficiencyPct,
        yellowCards: nextYellowCards,
        blueCards: nextBlueCards,
        redCards: nextRedCards,
        cleanSheets: currentEntry.cleanSheets + (concededGoals === 0 ? 1 : 0),
        defensiveActions:
          currentEntry.defensiveActions +
          (prof.position === 'defensor' || prof.position === 'goleiro' ? 3 : 1),
        status: newTotalMatches >= 5 ? 'elegivel' : 'provisorio',
        updatedAt: now,
      };
      updatedEntries[entryIdx] = updatedEntry;

      const updatedProfile: PlayerProfile = {
        ...prof,
        currentRating: eloResult.ratingAfter,
        ratingUncertainty: eloResult.uncertaintyAfter,
        totalValidatedMatches: newTotalMatches,
        isProvisional: eloResult.isProvisionalAfter,
        currentDivisionId: newDiv.id,
        updatedAt: now,
      };
      updatedProfile.experimentalPositionScore =
        calculateExperimentalPositionScore(updatedProfile, updatedEntry);

      updatedProfiles[profIdx] = updatedProfile;
    }

    const updatedMatches = draftState.matches.map((m) =>
      m.id === matchId
        ? {
            ...m,
            status: 'validada' as const,
            officialHomeScore: resultVer.homeScore,
            officialAwayScore: resultVer.awayScore,
            activeResultVersionId: resultVersionId,
            fraudHold: false,
            updatedAt: now,
          }
        : m
    );

    const updatedResults = draftState.matchResults.map((r) =>
      r.id === resultVersionId
        ? {
            ...r,
            validationStatus: 'validado' as const,
            validatedBy: actorUserId,
            validatedAt: now,
          }
        : r
    );

    const updatedEvents = draftState.matchEvents.map((ev) =>
      ev.resultVersionId === resultVersionId
        ? { ...ev, verificationStatus: 'validado' as const }
        : ev
    );

    const updatedMatchPlayers = draftState.matchPlayers.map((mp) =>
      mp.matchId === matchId
        ? { ...mp, participationStatus: 'participou' as const }
        : mp
    );

    const audit: AuditLog = {
      id: `audit-val-${Date.now()}`,
      actorUserId,
      actorName: actorLabel,
      actorRole:
        draftState.users.find((u) => u.id === actorUserId)?.role || 'player',
      actionType: 'MATCH_VALIDATED_AND_SCORED',
      entityType: 'matches',
      entityId: matchId,
      reason: `Partida #${matchId.slice(-4)} validada (${resultVer.homeScore}x${resultVer.awayScore}). Estatísticas oficiais processadas.`,
      afterData: {
        resultVersionId,
        score: `${resultVer.homeScore}x${resultVer.awayScore}`,
        participantsScored: participants.length,
      },
      createdAt: now,
    };

    return {
      ...draftState,
      profiles: updatedProfiles,
      seasonEntries: updatedEntries,
      matches: updatedMatches,
      matchPlayers: updatedMatchPlayers,
      matchResults: updatedResults,
      matchEvents: updatedEvents,
      pointTransactions: [...newTransactions, ...draftState.pointTransactions],
      ratingLogs: [...newRatingLogs, ...draftState.ratingLogs],
      auditLogs: [audit, ...draftState.auditLogs],
    };
  };

  // RF-006, CA-009, CA-010: Enviar resultado e eventos (permanece pendente até confirmação independente)
  const submitMatchScoreAndEvents: LeagueContextValue['submitMatchScoreAndEvents'] =
    (params) => {
      const match = state.matches.find((m) => m.id === params.matchId);
      if (!match) return false;

      const existingVersions = state.matchResults.filter(
        (r) => r.matchId === params.matchId
      );
      const nextVersionNumber = existingVersions.length + 1;
      const resultVersionId = `res-v${nextVersionNumber}-${params.matchId}`;
      const now = new Date().toISOString();

      const newResultVersion: MatchResultVersion = {
        id: resultVersionId,
        matchId: params.matchId,
        versionNumber: nextVersionNumber,
        homeScore: params.homeScore,
        awayScore: params.awayScore,
        mvpPlayerId: params.mvpPlayerId,
        submittedBy: currentUser.id,
        validationStatus: 'pendente',
        createdAt: now,
      };

      const newEvents: MatchEvent[] = [
        ...params.goalScorerIds.map((pid, idx) => ({
          id: `ev-${resultVersionId}-g-${idx}`,
          matchId: params.matchId,
          resultVersionId,
          playerId: pid,
          eventType: 'gol' as const,
          eventMinute: 10 + idx * 8,
          recordedBy: currentUser.id,
          verificationStatus: 'pendente' as const,
          createdAt: now,
        })),
        ...params.assistPlayerIds.map((pid, idx) => ({
          id: `ev-${resultVersionId}-a-${idx}`,
          matchId: params.matchId,
          resultVersionId,
          playerId: pid,
          eventType: 'assistencia' as const,
          eventMinute: 10 + idx * 8,
          recordedBy: currentUser.id,
          verificationStatus: 'pendente' as const,
          createdAt: now,
        })),
        ...(params.goalkeeperCapaPlayerId
          ? [
              {
                id: `ev-${resultVersionId}-gkcapa-0`,
                matchId: params.matchId,
                resultVersionId,
                playerId: params.goalkeeperCapaPlayerId,
                eventType: 'capa_goleiro' as const,
                eventMinute: 60,
                recordedBy: currentUser.id,
                verificationStatus: 'pendente' as const,
                createdAt: now,
              },
            ]
          : []),
        ...(params.yellowCardPlayerIds || []).map((pid, idx) => ({
          id: `ev-${resultVersionId}-yc-${idx}`,
          matchId: params.matchId,
          resultVersionId,
          playerId: pid,
          eventType: 'cartao_amarelo' as const,
          eventMinute: 20 + idx * 5,
          recordedBy: currentUser.id,
          verificationStatus: 'pendente' as const,
          createdAt: now,
        })),
        ...(params.blueCardPlayerIds || []).map((pid, idx) => ({
          id: `ev-${resultVersionId}-bc-${idx}`,
          matchId: params.matchId,
          resultVersionId,
          playerId: pid,
          eventType: 'cartao_azul' as const,
          eventMinute: 35 + idx * 5,
          recordedBy: currentUser.id,
          verificationStatus: 'pendente' as const,
          createdAt: now,
        })),
      ];

      const submitterSide: 'home' | 'away' =
        currentPlayerProfile?.id === match.awayCaptainId ? 'away' : 'home';

      const initialConfirmation: ResultConfirmation = {
        id: `conf-${resultVersionId}-${currentUser.id}`,
        matchId: params.matchId,
        resultVersionId,
        userId: currentUser.id,
        playerId: currentPlayerProfile?.id || match.homeCaptainId,
        teamSide: submitterSide,
        confirmationType: 'concordancia',
        comment: 'Placar e eventos registrados pelo responsável da súmula.',
        createdAt: now,
      };

      const newEvidence: EvidenceFile | null = params.evidenceTitle
        ? {
            id: `evid-${Date.now()}`,
            matchId: params.matchId,
            resultVersionId,
            uploadedBy: currentUser.id,
            evidenceType: 'foto_sumula',
            title: params.evidenceTitle,
            privateUrlToken: `signed-temp-token://${params.matchId}-v${nextVersionNumber}`,
            isPrivate: true,
            createdAt: now,
          }
        : null;

      const scoreLog: AuditLog = {
        id: `audit-score-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        actorUserId: currentUser.id,
        actorName: currentPlayerProfile?.displayName || currentUser.email || 'Capitão',
        actorRole: currentUser.role,
        actionType: 'PLACAR_ENVIADO',
        entityType: 'matches',
        entityId: params.matchId,
        reason: `Placar enviado: ${match.homeTeamName} ${params.homeScore} x ${params.awayScore} ${match.awayTeamName} (v${nextVersionNumber}) com ${newEvents.length} eventos registrados.`,
        createdAt: now,
      };

      setState((prev) => ({
        ...prev,
        matches: prev.matches.map((m) =>
          m.id === params.matchId
            ? {
                ...m,
                status: 'aguardando_confirmacoes',
                activeResultVersionId: resultVersionId,
                endedAt: now,
                updatedAt: now,
              }
            : m
        ),
        matchResults: [newResultVersion, ...prev.matchResults],
        matchEvents: [...newEvents, ...prev.matchEvents],
        confirmations: [initialConfirmation, ...prev.confirmations],
        evidenceFiles: newEvidence
          ? [newEvidence, ...prev.evidenceFiles]
          : prev.evidenceFiles,
        auditLogs: [scoreLog, ...(prev.auditLogs || [])],
      }));

      notify(
        'info',
        'Resultado enviado — Aguardando confirmação independente (CA-010)',
        `Placar ${params.homeScore}x${params.awayScore} registrado (v${nextVersionNumber}). Os pontos permanecem pendentes até a confirmação do capitão adversário.`
      );
      return true;
    };

  // RF-007, CA-011: Confirmar resultado (exige separação de papéis: criador não valida sozinho!)
  const confirmMatchResult: LeagueContextValue['confirmMatchResult'] = (
    matchId,
    comment
  ) => {
    const match = state.matches.find((m) => m.id === matchId);
    if (!match || !match.activeResultVersionId) return false;

    const activeVersion = state.matchResults.find(
      (r) => r.id === match.activeResultVersionId
    );
    if (!activeVersion) return false;

    // Regra Seção 4.2 / 7.2: Impedir que o próprio criador do resultado conte como confirmação independente única
    if (
      activeVersion.submittedBy === currentUser.id &&
      currentUser.role === 'player'
    ) {
      notify(
        'warning',
        'Confirmação independente obrigatória (Seção 4.2)',
        'Você enviou este resultado. Para validar a partida, alterne no topo da tela para o Capitão Adversário (ex: Rafa Paredão) ou Moderador.'
      );
      return false;
    }

    const now = new Date().toISOString();
    const newConfirmation: ResultConfirmation = {
      id: `conf-${Date.now()}`,
      matchId,
      resultVersionId: activeVersion.id,
      userId: currentUser.id,
      playerId: currentPlayerProfile?.id || match.awayCaptainId,
      teamSide: 'away',
      confirmationType: 'concordancia',
      comment: comment || 'Resultado conferido e confirmado pelo capitão adversário.',
      createdAt: now,
    };

    setState((prev) => {
      const withConfirmation: LeagueState = {
        ...prev,
        confirmations: [newConfirmation, ...prev.confirmations],
      };
      return executeAtomicMatchProcessing(
        withConfirmation,
        matchId,
        activeVersion.id,
        currentUser.id,
        currentPlayerProfile?.displayName || 'Capitão Confirmador'
      );
    });

    notify(
      'success',
      'Partida Validada! Pontos e Estatísticas calculados',
      `Confirmação independente registrada. A pontuação oficial e estatísticas da partida foram creditadas aos participantes.`
    );
    return true;
  };

  // RF-007, CA-011, CA-012: Contestar resultado (impede que os pontos sejam definitivos)
  const contestMatchResult: LeagueContextValue['contestMatchResult'] = (
    params
  ) => {
    const match = state.matches.find((m) => m.id === params.matchId);
    if (!match || !match.activeResultVersionId) return false;

    const now = new Date().toISOString();
    const newDispute: Dispute = {
      id: `disp-${Date.now()}`,
      matchId: params.matchId,
      resultVersionId: match.activeResultVersionId,
      openedBy: currentUser.id,
      reasonCode: params.reasonCode,
      description: params.description,
      status: 'aberta',
      assignedModerator: 'user-mod',
      createdAt: now,
    };

    const newConf: ResultConfirmation = {
      id: `conf-disp-${Date.now()}`,
      matchId: params.matchId,
      resultVersionId: match.activeResultVersionId,
      userId: currentUser.id,
      playerId: currentPlayerProfile?.id || match.awayCaptainId,
      teamSide: 'away',
      confirmationType: 'contestacao',
      comment: params.description,
      createdAt: now,
    };

    const audit: AuditLog = {
      id: `audit-disp-${Date.now()}`,
      actorUserId: currentUser.id,
      actorName: currentPlayerProfile?.displayName || currentUser.email,
      actorRole: currentUser.role,
      actionType: 'MATCH_RESULT_DISPUTED',
      entityType: 'disputes',
      entityId: newDispute.id,
      reason: `Resultado contestado (${params.reasonCode}): ${params.description}`,
      createdAt: now,
    };

    setState((prev) => ({
      ...prev,
      matches: prev.matches.map((m) =>
        m.id === params.matchId
          ? {
              ...m,
              status: 'contestada',
              fraudHold: true,
              fraudSignals: [
                ...m.fraudSignals,
                {
                  id: `sig-${Date.now()}`,
                  code: 'CONFLITO_CONFIRMACOES',
                  severity: 'alta',
                  description: `Contestação formal aberta por ${currentPlayerProfile?.displayName || 'Participante'}: ${params.description}`,
                  detectedAt: now,
                },
              ],
              updatedAt: now,
            }
          : m
      ),
      matchResults: prev.matchResults.map((r) =>
        r.id === match.activeResultVersionId
          ? { ...r, validationStatus: 'contestado' }
          : r
      ),
      confirmations: [newConf, ...prev.confirmations],
      disputes: [newDispute, ...prev.disputes],
      auditLogs: [audit, ...prev.auditLogs],
    }));

    notify(
      'warning',
      'Partida Contestada — Pontos Retidos (CA-012)',
      'A contestação foi encaminhada à moderação. Nenhum ponto ou rating definitivo será atribuído até a resolução.'
    );
    return true;
  };

  // RF-011, CA-013, CA-022, CA-028, CA-029: Moderação com Reversão Compensatória e Nova Versão Auditável
  const moderateMatchResolution: LeagueContextValue['moderateMatchResolution'] =
    (params) => {
      if (currentUser.role !== 'admin' && currentUser.role !== 'moderator') {
        notify(
          'error',
          'Acesso Negado (CA-027)',
          'Somente moderadores e administradores autorizados podem julgar contestações ou anular partidas.'
        );
        return false;
      }

      if (!params.moderatorReason.trim()) {
        notify(
          'error',
          'Justificativa obrigatória (CA-028)',
          'Toda ação administrativa deve registrar motivo detalhado para a trilha de auditoria.'
        );
        return false;
      }

      const now = new Date().toISOString();

      setState((prev) => {
        let workingState = { ...prev };
        const match = workingState.matches.find((m) => m.id === params.matchId);
        if (!match) return prev;

        // Se a partida já estava VALIDADA antes, gerar transações compensatórias de REVERSÃO (CA-022)
        if (match.status === 'validada' && match.activeResultVersionId) {
          const oldVersionId = match.activeResultVersionId;
          const oldCredits = workingState.pointTransactions.filter(
            (pt) =>
              pt.sourceResultVersionId === oldVersionId &&
              pt.transactionType === 'credito'
          );
          const oldRatings = workingState.ratingLogs.filter(
            (rl) =>
              rl.resultVersionId === oldVersionId &&
              rl.operationType === 'aplicacao'
          );

          const reversalTransactions: PointTransaction[] = oldCredits.map(
            (cred) => ({
              id: `ptx-rev-${oldVersionId}-${cred.playerId}`,
              playerId: cred.playerId,
              seasonId: cred.seasonId,
              matchId: cred.matchId,
              sourceResultVersionId: oldVersionId,
              transactionType: 'reversao',
              pointsDelta: -cred.pointsDelta,
              breakdown: cred.breakdown,
              reasonCode: `REVERSAO_AUDITORIA: ${params.moderatorReason}`,
              createdBy: currentUser.id,
              createdAt: now,
            })
          );

          const reversalRatings: PlayerRatingLog[] = oldRatings.map((rlog) => ({
            ...rlog,
            id: `rlog-rev-${oldVersionId}-${rlog.playerId}`,
            operationType: 'reversao',
            ratingBefore: rlog.ratingAfter,
            ratingAfter: rlog.ratingBefore,
            ratingDelta: -rlog.ratingDelta,
            calculationStatus: 'revertido',
            createdAt: now,
          }));

          // Reverter saldos nos perfis e season_entries
          const revertedProfiles = workingState.profiles.map((p) => {
            const rlog = oldRatings.find((r) => r.playerId === p.id);
            if (!rlog) return p;
            const restoredMatches = Math.max(0, p.totalValidatedMatches - 1);
            const restoredRating = Math.max(600, p.currentRating - rlog.ratingDelta);
            const restoredDiv = resolveDivisionForPlayer(
              restoredRating,
              restoredMatches,
              workingState.divisions
            );
            return {
              ...p,
              currentRating: restoredRating,
              totalValidatedMatches: restoredMatches,
              isProvisional: restoredMatches < 5,
              currentDivisionId: restoredDiv.id,
              updatedAt: now,
            };
          });

          const revertedEntries = workingState.seasonEntries.map((se) => {
            const cred = oldCredits.find(
              (c) => c.playerId === se.playerId && c.seasonId === se.seasonId
            );
            if (!cred) return se;
            return {
              ...se,
              seasonPoints: Math.max(0, se.seasonPoints - cred.pointsDelta),
              matchesPlayed: Math.max(0, se.matchesPlayed - 1),
              wins: Math.max(
                0,
                se.wins - (cred.breakdown.resultBonus === 15 ? 1 : 0)
              ),
              draws: Math.max(
                0,
                se.draws - (cred.breakdown.resultBonus === 5 ? 1 : 0)
              ),
              losses: Math.max(
                0,
                se.losses - (cred.breakdown.resultBonus === 0 ? 1 : 0)
              ),
              goals: Math.max(0, se.goals - cred.breakdown.goalsCount),
              assists: Math.max(0, se.assists - cred.breakdown.assistsCount),
              mvpCount: Math.max(0, se.mvpCount - (cred.breakdown.isMvp ? 1 : 0)),
              updatedAt: now,
            };
          });

          workingState = {
            ...workingState,
            profiles: revertedProfiles,
            seasonEntries: revertedEntries,
            pointTransactions: [
              ...reversalTransactions,
              ...workingState.pointTransactions,
            ],
            ratingLogs: [...reversalRatings, ...workingState.ratingLogs],
            matchResults: workingState.matchResults.map((r) =>
              r.id === oldVersionId ? { ...r, validationStatus: 'substituido' } : r
            ),
          };
        }

        // Caso 1: Anular partida definitivamente
        if (params.action === 'annul_match') {
          const auditAnnul: AuditLog = {
            id: `audit-annul-${Date.now()}`,
            actorUserId: currentUser.id,
            actorName: 'Moderador Oficial',
            actorRole: currentUser.role,
            actionType: 'MATCH_ANNULLED_WITH_REVERSAL',
            entityType: 'matches',
            entityId: params.matchId,
            reason: params.moderatorReason,
            beforeData: { previousStatus: match.status },
            afterData: { newStatus: 'anulada' },
            createdAt: now,
          };

          return {
            ...workingState,
            matches: workingState.matches.map((m) =>
              m.id === params.matchId
                ? {
                    ...m,
                    status: 'anulada',
                    officialHomeScore: undefined,
                    officialAwayScore: undefined,
                    fraudHold: false,
                    updatedAt: now,
                  }
                : m
            ),
            disputes: workingState.disputes.map((d) =>
              d.matchId === params.matchId
                ? {
                    ...d,
                    status: 'resolvida',
                    resolutionReason: `Partida anulada: ${params.moderatorReason}`,
                    resolvedAt: now,
                  }
                : d
            ),
            auditLogs: [auditAnnul, ...workingState.auditLogs],
          };
        }

        // Caso 2: Corrigir placar criando nova versão auditável v(N+1) e validar (CA-013)
        if (params.action === 'correct_and_validate') {
          const existingVersions = workingState.matchResults.filter(
            (r) => r.matchId === params.matchId
          );
          const nextVerNum = existingVersions.length + 1;
          const newVerId = `res-v${nextVerNum}-${params.matchId}`;

          const oldVer = existingVersions[0];
          const newResultVer: MatchResultVersion = {
            id: newVerId,
            matchId: params.matchId,
            versionNumber: nextVerNum,
            homeScore:
              params.correctedHomeScore ?? oldVer?.homeScore ?? 0,
            awayScore:
              params.correctedAwayScore ?? oldVer?.awayScore ?? 0,
            mvpPlayerId: params.correctedMvpId ?? oldVer?.mvpPlayerId,
            submittedBy: currentUser.id,
            validationStatus: 'validado',
            validatedBy: currentUser.id,
            validatedAt: now,
            correctionReason: params.moderatorReason,
            createdAt: now,
          };

          // Clonar eventos válidos da versão anterior para a nova versão corrigida
          const clonedEvents: MatchEvent[] = workingState.matchEvents
            .filter((ev) => ev.resultVersionId === match.activeResultVersionId)
            .map((ev, i) => ({
              ...ev,
              id: `ev-${newVerId}-${i}`,
              resultVersionId: newVerId,
              verificationStatus: 'validado' as const,
            }));

          const stateWithNewVersion: LeagueState = {
            ...workingState,
            matchResults: [newResultVer, ...workingState.matchResults],
            matchEvents: [...clonedEvents, ...workingState.matchEvents],
            disputes: workingState.disputes.map((d) =>
              d.matchId === params.matchId
                ? {
                    ...d,
                    status: 'resolvida',
                    resolutionReason: `Placar corrigido para ${newResultVer.homeScore}x${newResultVer.awayScore} (v${nextVerNum}): ${params.moderatorReason}`,
                    resolvedAt: now,
                  }
                : d
            ),
          };

          return executeAtomicMatchProcessing(
            stateWithNewVersion,
            params.matchId,
            newVerId,
            currentUser.id,
            'Moderador Oficial (Correção Auditada)'
          );
        }

        // Caso 3: Validar versão atual após análise de disputa
        if (match.activeResultVersionId) {
          const resolvedDisputesState: LeagueState = {
            ...workingState,
            disputes: workingState.disputes.map((d) =>
              d.matchId === params.matchId
                ? {
                    ...d,
                    status: 'rejeitada',
                    resolutionReason: `Versão original mantida e validada: ${params.moderatorReason}`,
                    resolvedAt: now,
                  }
                : d
            ),
          };

          return executeAtomicMatchProcessing(
            resolvedDisputesState,
            params.matchId,
            match.activeResultVersionId,
            currentUser.id,
            'Moderador Oficial'
          );
        }

        return workingState;
      });

      notify(
        'success',
        'Decisão da Moderação Executada e Auditada (CA-028)',
        `Ação '${params.action}' registrada com histórico de versão e livro-razão reconciliado.`
      );
      return true;
    };

  // CA-030: Demonstração prática de bloqueio de manipulação direta via API
  const attemptDirectManipulationAttack = () => {
    const now = new Date().toISOString();
    const audit: AuditLog = {
      id: `audit-sec-${Date.now()}`,
      actorUserId: currentUser.id,
      actorName: currentPlayerProfile?.displayName || currentUser.email,
      actorRole: currentUser.role,
      actionType: 'SECURITY_BLOCKED_DIRECT_API_MUTATION',
      entityType: 'player_profiles',
      entityId: currentPlayerProfile?.id || 'unknown',
      reason:
        'Tentativa bloqueada (403 Forbidden - CA-030): Cliente tentou enviar payload direto { seasonPoints: 999 } fora do motor de servidor.',
      beforeData: {
        points: 0,
      },
      afterData: {
        status: 'REJECTED_BY_SERVER_RLS_POLICY',
      },
      createdAt: now,
    };

    setState((prev) => ({
      ...prev,
      auditLogs: [audit, ...prev.auditLogs],
    }));

    notify(
      'error',
      'Bloqueio de Segurança Ativo (CA-030 · 403 Forbidden)',
      'Usuários não podem manipular pontos, estatísticas ou estados de validação diretamente. Tentativa registrada no Log de Auditoria.'
    );
  };

  const resetDemoDatabase = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
      localStorage.removeItem(COMPLETED_FIRST_ACCESS_KEY);
      localStorage.removeItem('futplay_lite_auth_session_v1');
      localStorage.removeItem('futplay_lite_auth_session_v2');
      localStorage.removeItem('futplay_lite_auth_session_v3');
    } catch {
      // Ignore
    }

    const now = new Date().toISOString();
    const resetLog: AuditLog = {
      id: `audit-reset-${Date.now()}`,
      actorUserId: currentUser?.id || 'admin',
      actorName: currentPlayerProfile?.displayName || currentUser?.email || 'Administrador',
      actorRole: currentUser?.role || 'admin',
      actionType: 'BANCO_DADOS_RESTAURADO',
      entityType: 'system',
      entityId: 'database',
      reason: 'Restauração de fábrica dos dados locais realizada pelo administrador com validação de senha.',
      createdAt: now,
    };

    const adminUsers = state.users.filter(
      (u) =>
        u.role === 'admin' ||
        u.email?.toLowerCase() === 'futplaylite@gmail.com' ||
        u.id === currentUser?.id
    );

    setState({
      users: adminUsers.length > 0 ? adminUsers : INITIAL_USERS,
      cities: INITIAL_CITIES,
      divisions: INITIAL_DIVISIONS,
      seasons: INITIAL_SEASONS,
      profiles: INITIAL_PROFILES,
      seasonEntries: INITIAL_SEASON_ENTRIES,
      matches: INITIAL_MATCHES,
      matchPlayers: INITIAL_MATCH_PLAYERS,
      matchResults: INITIAL_MATCH_RESULTS,
      matchEvents: INITIAL_MATCH_EVENTS,
      confirmations: INITIAL_CONFIRMATIONS,
      disputes: INITIAL_DISPUTES,
      evidenceFiles: INITIAL_EVIDENCE_FILES,
      pointTransactions: INITIAL_POINT_TRANSACTIONS,
      ratingLogs: INITIAL_RATING_LOGS,
      auditLogs: [resetLog],
      peerEvaluations: [],
      monthlyPayments: [],
      monthlyConfig: DEFAULT_MONTHLY_CONFIG,
      teamTransactions: [],
      playerAdjustments: [],
    });
    try {
      localStorage.removeItem('futplay_player_adjustments_v1');
    } catch {}

    if (currentUser?.id) {
      setCurrentUserId(currentUser.id);
      try {
        localStorage.setItem(ACTIVE_USER_STORAGE_KEY, currentUser.id);
      } catch {
        // Ignore
      }
    } else {
      setCurrentUserId('');
    }

    notify(
      'success',
      'Base Restaurada com Sucesso',
      'Todos os dados de teste foram reiniciados para o padrão de fábrica. A ação foi gravada nos logs.'
    );
  };

  const toggleMonthlyPayment: LeagueContextValue['toggleMonthlyPayment'] = (
    playerId,
    yearMonth,
    isPaid,
    amount
  ) => {
    const p = state.profiles.find((prof) => prof.id === playerId);
    const playerDisplayName = p?.displayName || 'Jogador';
    const now = new Date().toISOString();
    const paymentId = `${playerId}_${yearMonth}`;
    const feeAmount = amount ?? state.monthlyConfig?.monthlyAmount ?? 30;

    const record: MonthlyPaymentRecord = {
      id: paymentId,
      playerId,
      yearMonth,
      isPaid,
      paidAt: isPaid ? now : undefined,
      amount: feeAmount,
      confirmedBy: currentUserId || 'admin-pelada',
      updatedAt: now,
    };

    const payLog: AuditLog = {
      id: `audit-pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actorUserId: currentUser.id,
      actorName: currentPlayerProfile?.displayName || currentUser.email || 'Treinador',
      actorRole: currentUser.role,
      actionType: isPaid ? 'MENSALIDADE_PAGA' : 'MENSALIDADE_PENDENTE',
      entityType: 'monthly_payments',
      entityId: paymentId,
      reason: `Mensalidade de ${playerDisplayName} (${yearMonth}) marcada como ${
        isPaid ? `PAGA (R$ ${feeAmount})` : 'PENDENTE'
      } por ${currentPlayerProfile?.displayName || currentUser.role}.`,
      afterData: {
        playerId,
        yearMonth,
        isPaid,
        amount: feeAmount,
      },
      createdAt: now,
    };

    setState((prev) => {
      const currentList = prev.monthlyPayments || [];
      const existingIdx = currentList.findIndex(
        (m) => m.playerId === playerId && m.yearMonth === yearMonth
      );

      const updatedPayments =
        existingIdx >= 0
          ? currentList.map((item, idx) => (idx === existingIdx ? record : item))
          : [...currentList, record];

      try {
        localStorage.setItem('futplay_monthly_payments_v1', JSON.stringify(updatedPayments));
      } catch {}

      return {
        ...prev,
        monthlyPayments: updatedPayments,
        auditLogs: [payLog, ...(prev.auditLogs || [])],
      };
    });

    if (isSupabaseConfigured()) {
      supabaseService.upsertMonthlyPayment(record).catch((err) => {
        console.warn('Falha assíncrona ao sincronizar mensalidade com Supabase:', err);
      });
    }

    notify(
      'success',
      isPaid ? 'Pagamento Confirmado! 🟢' : 'Status Alterado para Pendente 🔴',
      isPaid
        ? `Mensalidade de ${playerDisplayName} (${yearMonth}) marcada como PAGA!`
        : `Mensalidade de ${playerDisplayName} (${yearMonth}) marcada como PENDENTE.`
    );

    return true;
  };

  const updateMonthlyConfig: LeagueContextValue['updateMonthlyConfig'] = (config) => {
    const updatedConfig = {
      ...(state.monthlyConfig || DEFAULT_MONTHLY_CONFIG),
      ...config,
    };
    const now = new Date().toISOString();
    const cfgLog: AuditLog = {
      id: `audit-mcfg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actorUserId: currentUser.id,
      actorName: currentPlayerProfile?.displayName || currentUser.email || 'Treinador',
      actorRole: currentUser.role,
      actionType: 'CONFIG_MENSALIDADE_ALTERADA',
      entityType: 'monthly_config',
      entityId: 'global',
      reason: `Configuração da mensalidade alterada: R$ ${updatedConfig.monthlyAmount}, vencimento dia ${updatedConfig.dueDay}, chave PIX ${updatedConfig.pixKey}.`,
      createdAt: now,
    };
    setState((prev) => ({
      ...prev,
      monthlyConfig: updatedConfig,
      auditLogs: [cfgLog, ...(prev.auditLogs || [])],
    }));
    if (isSupabaseConfigured()) {
      supabaseService.saveMonthlyConfig(updatedConfig).catch((err) => {
        console.warn('Falha assíncrona ao salvar config no Supabase:', err);
      });
    }
    notify('success', 'Configuração Salva', 'Dados da mensalidade e PIX atualizados com sucesso.');
    return true;
  };

  const finalizePeladaSumula: LeagueContextValue['finalizePeladaSumula'] = (sumulaToFinalize) => {
    const finalized: SumulaData = {
      ...sumulaToFinalize,
      status: 'finalizada',
      lastUpdated: new Date().toISOString(),
    };

    // Salva no localStorage de todas as súmulas
    try {
      const ALL_KEY = 'futplay_todas_sumulas_peladas_v1';
      const ACTIVE_KEY = 'futplay_sumula_pelada_ativa_v1';
      const raw = localStorage.getItem(ALL_KEY);
      let list: SumulaData[] = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex((s) => s.id === finalized.id);
      if (idx >= 0) {
        list[idx] = finalized;
      } else {
        list = [finalized, ...list];
      }
      localStorage.setItem(ALL_KEY, JSON.stringify(list));
      localStorage.setItem(ACTIVE_KEY, JSON.stringify(finalized));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('futplay_sumulas_changed', {
            detail: { savedId: finalized.id, count: list.length },
          })
        );
      }
    } catch (e) {
      console.warn('Erro ao persistir súmula finalizada:', e);
    }

    // Sincroniza súmula finalizada no Supabase online
    if (isSupabaseConfigured()) {
      supabaseService.savePeladaSumula(finalized).catch((err) => {
        console.warn('Falha ao salvar súmula finalizada no Supabase:', err);
      });
    }

    // 1. Participantes confirmados na chegada ou escalados
    const confirmedArrivalNames = new Set(
      (finalized.arrivalList || [])
        .filter((a) => a.confirmed)
        .map((a) => (a.playerName || '').trim().toLowerCase())
    );

    // 2. Mapeamento de gols por atleta (nome em minúsculo)
    const goalsByPlayer: Record<string, number> = {};
    Object.values(finalized.teamLineups || {}).forEach((lineup) => {
      (lineup || []).forEach((item) => {
        const pKey = (item.player || '').trim().toLowerCase();
        const g = Number(item.goals) || 0;
        if (pKey && g > 0) {
          goalsByPlayer[pKey] = (goalsByPlayer[pKey] || 0) + g;
        }
      });
    });

    // 3. Mapeamento de cartões por atleta
    const yellowByPlayer: Record<string, number> = {};
    (finalized.yellowCards || []).forEach((name) => {
      const pKey = (name || '').trim().toLowerCase();
      if (pKey) yellowByPlayer[pKey] = (yellowByPlayer[pKey] || 0) + 1;
    });

    const blueByPlayer: Record<string, number> = {};
    (finalized.blueCards || []).forEach((name) => {
      const pKey = (name || '').trim().toLowerCase();
      if (pKey) blueByPlayer[pKey] = (blueByPlayer[pKey] || 0) + 1;
    });

    const redByPlayer: Record<string, number> = {};
    (finalized.redCards || []).forEach((name) => {
      const pKey = (name || '').trim().toLowerCase();
      if (pKey) redByPlayer[pKey] = (redByPlayer[pKey] || 0) + 1;
    });

    // 4. Identifica o time campeão da súmula para Super Capas
    let championTeamName = '';
    let maxWins = -1;
    let maxDraws = -1;
    let maxGoals = -1;
    (finalized.teamsGrid || []).forEach((row) => {
      const wins = (row.matches || []).filter((m) => m === 'V').length;
      const draws = (row.matches || []).filter((m) => m === 'E').length;
      const pts = wins * 3 + draws;
      const maxPts = maxWins * 3 + maxDraws;

      const lineup = (finalized.teamLineups && finalized.teamLineups[row.teamName]) || [];
      const teamG = lineup.reduce((acc, p) => acc + (Number(p.goals) || 0), 0);

      if (pts > maxPts || (pts === maxPts && teamG > maxGoals)) {
        maxWins = wins;
        maxDraws = draws;
        maxGoals = teamG;
        championTeamName = row.teamName;
      }
    });

    const championLineup = championTeamName
      ? (finalized.teamLineups?.[championTeamName] || [])
      : [];
    const championPlayerKeys = new Set(
      championLineup.map((p) => (p.player || '').trim().toLowerCase())
    );

    // 5. Atualiza os SeasonEntries no estado da liga
    setState((prev) => {
      const updatedEntries = [...prev.seasonEntries];
      const nowStr = new Date().toISOString();

      prev.profiles.forEach((profile) => {
        const pKey = (profile.displayName || '').trim().toLowerCase();

        // Participou se estava confirmado na chegada OU se foi escalado em qualquer time
        const isArrivalConfirmed = confirmedArrivalNames.has(pKey);
        const isLineupMember = Object.values(finalized.teamLineups || {}).some((lineup) =>
          (lineup || []).some((p) => (p.player || '').trim().toLowerCase() === pKey)
        );
        const participated = isArrivalConfirmed || isLineupMember;

        const goalsToAdd = goalsByPlayer[pKey] || 0;
        const yellowToAdd = yellowByPlayer[pKey] || 0;
        const blueToAdd = blueByPlayer[pKey] || 0;
        const redToAdd = redByPlayer[pKey] || 0;
        const isSuperCapa = championPlayerKeys.has(pKey);
        const isGk = profile.position === 'goleiro';

        if (participated || goalsToAdd > 0 || yellowToAdd > 0 || blueToAdd > 0 || redToAdd > 0) {
          const entryIdx = updatedEntries.findIndex((se) => se.playerId === profile.id);
          if (entryIdx >= 0) {
            const current = updatedEntries[entryIdx];
            const newMatches = (current.matchesPlayed || 0) + (participated ? 1 : 0);
            const newGoals = (current.goals || 0) + goalsToAdd;
            const newYellow = (current.yellowCards || 0) + yellowToAdd;
            const newBlue = (current.blueCards || 0) + blueToAdd;
            const newRed = (current.redCards || 0) + redToAdd;
            const newSuperCapas = (current.superCapas || current.mvpCount || 0) + (isSuperCapa ? 1 : 0);
            const newGkCapas = (current.goalkeeperCapas || 0) + (isSuperCapa && isGk ? 1 : 0);
            const newCapaPct = newMatches > 0 ? Math.round((newSuperCapas / newMatches) * 100) : 0;
            const newPoints = (current.seasonPoints || 0) + (isSuperCapa ? 3 : participated ? 1 : 0);

            updatedEntries[entryIdx] = {
              ...current,
              matchesPlayed: newMatches,
              goals: newGoals,
              yellowCards: newYellow,
              blueCards: newBlue,
              redCards: newRed,
              superCapas: newSuperCapas,
              goalkeeperCapas: newGkCapas,
              capaEfficiencyPct: newCapaPct,
              seasonPoints: newPoints,
              updatedAt: nowStr,
            };
          } else {
            const newMatches = participated ? 1 : 0;
            const newGoals = goalsToAdd;
            const newSuperCapas = isSuperCapa ? 1 : 0;
            const newGkCapas = isSuperCapa && isGk ? 1 : 0;
            const newCapaPct = newMatches > 0 ? Math.round((newSuperCapas / newMatches) * 100) : 0;

            updatedEntries.push({
              id: `se-${profile.id}-${Date.now()}`,
              seasonId: prev.seasons[0]?.id || 'season-2026-2',
              playerId: profile.id,
              divisionId: profile.currentDivisionId || 'div-geral',
              seasonPoints: isSuperCapa ? 3 : 1,
              pendingPoints: 0,
              matchesPlayed: newMatches,
              wins: isSuperCapa ? 1 : 0,
              draws: 0,
              losses: 0,
              goals: newGoals,
              assists: 0,
              mvpCount: newSuperCapas,
              superCapas: newSuperCapas,
              goalkeeperCapas: newGkCapas,
              capaEfficiencyPct: newCapaPct,
              yellowCards: yellowToAdd,
              blueCards: blueToAdd,
              redCards: redToAdd,
              cleanSheets: 0,
              defensiveActions: 0,
              status: 'elegivel',
              updatedAt: nowStr,
            });
          }
        }
      });

      const sumulaLog: AuditLog = {
        id: `audit-sumula-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        actorUserId: currentUser.id,
        actorName: currentPlayerProfile?.displayName || currentUser.email || 'Mesário',
        actorRole: currentUser.role,
        actionType: 'SUMULA_PELADA_FINALIZADA',
        entityType: 'pelada_sumulas',
        entityId: finalized.id,
        reason: `Súmula de pelada "${finalized.teamName || finalized.matchDate || 'Pelada'}" finalizada. Equipe campeã: "${
          championTeamName || 'Não definida'
        }" com ${finalized.teamsGrid?.length || 0} times participantes.`,
        createdAt: new Date().toISOString(),
      };

      return {
        ...prev,
        seasonEntries: updatedEntries,
        auditLogs: [sumulaLog, ...(prev.auditLogs || [])],
      };
    });

    notify(
      'success',
      'Súmula Finalizada e Homologada!',
      'Gols, presenças e cartões foram computados nas estatísticas oficiais de todos os atletas participantes.'
    );

    return true;
  };

  const addTeamTransaction: LeagueContextValue['addTeamTransaction'] = (tx) => {
    const canManage =
      currentUser.role === 'coach' ||
      currentUser.role === 'admin' ||
      currentUser.isTeamOwner === true ||
      currentPlayerProfile?.isTeamOwner === true ||
      currentUser.id === 'user-paredao';

    if (!canManage) {
      notify(
        'error',
        'Acesso Restrito',
        'Apenas o treinador pode lançar despesas ou receitas no caixa do time.'
      );
      return false;
    }

    const now = new Date().toISOString();
    const newTx: TeamTransaction = {
      ...tx,
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      createdAt: now,
    };
    const txLog: AuditLog = {
      id: `audit-tx-add-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actorUserId: currentUser.id,
      actorName: currentPlayerProfile?.displayName || currentUser.email || 'Treinador',
      actorRole: currentUser.role,
      actionType: 'LANCAMENTO_CAIXA_ADICIONADO',
      entityType: 'team_transactions',
      entityId: newTx.id,
      reason: `Lançamento [${tx.type === 'receita' ? 'RECEITA' : 'DESPESA'}] de R$ ${tx.amount.toFixed(
        2
      )} (${tx.category || 'Geral'}): "${tx.description}".`,
      createdAt: now,
    };

    setState((prev) => {
      const updated = [newTx, ...(prev.teamTransactions || [])];
      try {
        localStorage.setItem('futplay_team_financial_transactions_v1', JSON.stringify(updated));
      } catch (e) {}
      return {
        ...prev,
        teamTransactions: updated,
        auditLogs: [txLog, ...(prev.auditLogs || [])],
      };
    });
    if (isSupabaseConfigured()) {
      supabaseService.saveTeamTransaction(newTx).catch((err) => {
        console.warn('Falha assíncrona ao salvar transação no Supabase:', err);
      });
    }
    notify(
      'success',
      tx.type === 'receita' ? 'Receita Registrada' : 'Despesa Registrada',
      `R$ ${tx.amount.toFixed(2)} registrado no caixa do time.`
    );
    return true;
  };

  const deleteTeamTransaction: LeagueContextValue['deleteTeamTransaction'] = (id) => {
    const canManage =
      currentUser.role === 'coach' ||
      currentUser.role === 'admin' ||
      currentUser.isTeamOwner === true ||
      currentPlayerProfile?.isTeamOwner === true ||
      currentUser.id === 'user-paredao';

    if (!canManage) {
      notify(
        'error',
        'Acesso Restrito',
        'Apenas o treinador pode excluir movimentações financeiras.'
      );
      return false;
    }

    const targetTx = (state.teamTransactions || []).find((t) => t.id === id);
    const now = new Date().toISOString();
    const delTxLog: AuditLog = {
      id: `audit-tx-del-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actorUserId: currentUser.id,
      actorName: currentPlayerProfile?.displayName || currentUser.email || 'Treinador',
      actorRole: currentUser.role,
      actionType: 'LANCAMENTO_CAIXA_REMOVIDO',
      entityType: 'team_transactions',
      entityId: id,
      reason: `Lançamento ${
        targetTx?.description ? `"${targetTx.description}"` : id
      } (R$ ${targetTx?.amount || 0}) excluído do caixa.`,
      createdAt: now,
    };

    setState((prev) => {
      const updated = (prev.teamTransactions || []).filter((t) => t.id !== id);
      try {
        localStorage.setItem('futplay_team_financial_transactions_v1', JSON.stringify(updated));
      } catch (e) {}
      return {
        ...prev,
        teamTransactions: updated,
        auditLogs: [delTxLog, ...(prev.auditLogs || [])],
      };
    });
    if (isSupabaseConfigured()) {
      supabaseService.deleteTeamTransaction(id, targetTx?.teamName).catch((err) => {
        console.warn('Falha assíncrona ao excluir transação no Supabase:', err);
      });
    }
    notify('info', 'Lançamento Removido', 'A movimentação foi excluída com sucesso.');
    return true;
  };

  const saveUserWhatsapp: LeagueContextValue['saveUserWhatsapp'] = (
    whatsappNumber
  ) => {
    const cleaned = whatsappNumber.trim();
    if (cleaned.length < 8) {
      notify(
        'error',
        'Número inválido',
        'Informe um número de WhatsApp válido com DDD.'
      );
      return false;
    }

    const now = new Date().toISOString();
    const wppLog: AuditLog = {
      id: `audit-wpp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actorUserId: currentUser.id,
      actorName: currentPlayerProfile?.displayName || currentUser.email || 'Usuário',
      actorRole: currentUser.role,
      actionType: 'CONTATO_WHATSAPP_ATUALIZADO',
      entityType: 'users',
      entityId: currentUser.id,
      reason: `Número de WhatsApp atualizado para: ${cleaned}.`,
      createdAt: now,
    };
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id ? { ...u, whatsappNumber: cleaned } : u
      ),
      profiles: prev.profiles.map((p) =>
        p.userId === currentUser.id
          ? { ...p, whatsappNumber: cleaned, updatedAt: now }
          : p
      ),
      auditLogs: [wppLog, ...(prev.auditLogs || [])],
    }));

    notify(
      'success',
      'WhatsApp Conectado!',
      `Você receberá notificações de partidas e ranking no WhatsApp ${cleaned}.`
    );
    return true;
  };

  const saveOnboardingStep1: LeagueContextValue['saveOnboardingStep1'] = ({
    displayName,
    avatarUrl,
  }) => {
    const trimmedName = displayName.trim();
    if (trimmedName.length < 2) {
      notify(
        'error',
        'Nome inválido',
        'Informe seu nome ou apelido esportivo (mínimo 2 letras).'
      );
      return false;
    }

    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? {
              ...u,
              avatarUrl: avatarUrl ?? u.avatarUrl,
              onboardingStep: Math.max(u.onboardingStep || 1, 2),
            }
          : u
      ),
      profiles: prev.profiles.map((p) =>
        p.userId === currentUser.id
          ? {
              ...p,
              displayName: trimmedName,
              avatarUrl: avatarUrl ?? p.avatarUrl,
              updatedAt: now,
            }
          : p
      ),
    }));

    if (isSupabaseConfigured()) {
      supabaseService.updateProfile(currentUser.id, {
        displayName: trimmedName,
        avatarUrl,
      });
    }

    notify(
      'success',
      'Passo 1 de 3 Concluído!',
      `Perfil de ${trimmedName} e foto salvos com sucesso.`
    );
    return true;
  };

  const saveOnboardingStep2: LeagueContextValue['saveOnboardingStep2'] = ({
    mode,
    teamName,
    teamCity,
    teamCrestUrl,
    teamModality,
    teamInviteCode,
    position,
  }) => {
    const trimmedTeam = teamName.trim();
    const trimmedCity = teamCity.trim() || 'Planalto - BA';
    if (trimmedTeam.length < 2) {
      notify(
        'error',
        'Nome do time inválido',
        'Informe o nome da sua equipe (mínimo 2 caracteres).'
      );
      return false;
    }

    const modalityLabel: Record<TeamModality, string> = {
      society: 'Society',
      futsal: 'Futsal',
      futebol_areia: 'Futebol de Areia',
      futebol_campo: 'Futebol de Campo',
    };

    const generatedCode =
      teamInviteCode ||
      `${trimmedTeam
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 4)
        .toUpperCase() || 'TIME'}-${Math.floor(100 + Math.random() * 900)}`;

    if (mode === 'join') {
      markFirstAccessCompletedInStorage(currentUser.id, currentUser.email);
    }

    const now = new Date().toISOString();
    const onbLog: AuditLog = {
      id: `audit-onb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actorUserId: currentUser.id,
      actorName: currentPlayerProfile?.displayName || currentUser.email || 'Atleta',
      actorRole: mode === 'create' ? 'coach' : 'player',
      actionType: mode === 'create' ? 'TIME_CRIADO' : 'TIME_INGRESSOU',
      entityType: 'teams',
      entityId: generatedCode,
      reason:
        mode === 'create'
          ? `Criou a equipe "${trimmedTeam}" (${modalityLabel[teamModality]}, ${trimmedCity}) com código de convite ${generatedCode}.`
          : `Ingressou na equipe "${trimmedTeam}" (${modalityLabel[teamModality]}, ${trimmedCity}).`,
      createdAt: now,
    };

    setState((prev) => {
      // 1. Atualiza ou adiciona o usuário
      let userUpdated = false;
      const updatedUsers = prev.users.map((u) => {
        if (u.id === currentUser.id) {
          userUpdated = true;
          return {
            ...u,
            teamName: trimmedTeam,
            teamCity: trimmedCity,
            teamCrestUrl: teamCrestUrl ?? u.teamCrestUrl,
            teamModality,
            teamInviteCode: generatedCode,
            isTeamOwner: mode === 'create',
            role: mode === 'create' ? ('coach' as const) : ('player' as const),
            onboardingStep:
              mode === 'join' ? 4 : Math.max(u.onboardingStep || 2, 3),
            onboardingCompleted:
              mode === 'join' ? true : u.onboardingCompleted,
          };
        }
        return u;
      });

      if (!userUpdated && currentUser.id) {
        updatedUsers.push({
          ...currentUser,
          teamName: trimmedTeam,
          teamCity: trimmedCity,
          teamCrestUrl,
          teamModality,
          teamInviteCode: generatedCode,
          isTeamOwner: mode === 'create',
          role: mode === 'create' ? 'coach' : 'player',
          onboardingStep: mode === 'join' ? 4 : 3,
          onboardingCompleted: mode === 'join',
        });
      }

      // 2. Atualiza ou adiciona o perfil do atleta garantindo persistência do código e dono
      let profileUpdated = false;
      const updatedProfiles = prev.profiles.map((p) => {
        if (p.userId === currentUser.id || p.id === currentUser.id) {
          profileUpdated = true;
          return {
            ...p,
            teamName: trimmedTeam,
            teamCity: trimmedCity,
            teamCrestUrl: teamCrestUrl ?? p.teamCrestUrl,
            teamModality,
            teamInviteCode: generatedCode,
            isTeamOwner: mode === 'create',
            position: position ?? p.position,
            updatedAt: now,
          };
        }
        return p;
      });

      if (!profileUpdated && currentUser.id) {
        updatedProfiles.push({
          id: `profile-${currentUser.id}`,
          userId: currentUser.id,
          displayName: currentPlayerProfile?.displayName || currentUser.email?.split('@')[0] || 'Atleta',
          avatarUrl: currentUser.avatarUrl,
          avatarColor: '#126B46',
          cityId: '11111111-1111-4111-8111-111111111101',
          neighborhood: 'Centro',
          position: position || 'atacante',
          dominantFoot: 'direito',
          profileVisibility: 'publico',
          teamName: trimmedTeam,
          teamCity: trimmedCity,
          teamCrestUrl,
          teamModality,
          teamInviteCode: generatedCode,
          isTeamOwner: mode === 'create',
          currentRating: 1000,
          ratingUncertainty: 100,
          isProvisional: true,
          currentDivisionId: 'div-geral',
          totalValidatedMatches: 0,
          experimentalPositionScore: null,
          badges: [],
          createdAt: now,
          updatedAt: now,
        });
      }

      return {
        ...prev,
        users: updatedUsers,
        profiles: updatedProfiles,
        auditLogs: [onbLog, ...(prev.auditLogs || [])],
      };
    });

    // 3. Persistência imediata e dedicada do time em localStorage para reconhecimento instantâneo
    try {
      const TEAMS_KEY = 'futplay_registered_teams_v1';
      const storedRaw = localStorage.getItem(TEAMS_KEY);
      const storedList = storedRaw ? JSON.parse(storedRaw) : [];
      const newEntry = {
        id: `custom-${generatedCode}`,
        inviteCode: generatedCode.toUpperCase(),
        name: trimmedTeam,
        city: trimmedCity,
        neighborhood: 'Centro',
        foundedYear: '2026',
        crestUrl: teamCrestUrl,
        crestColor: '#1D4ED8',
        modality: teamModality,
        modalityLabel: modalityLabel[teamModality],
        ownerName:
          currentPlayerProfile?.displayName ||
          currentUser.email?.split('@')[0] ||
          'Dono do Time',
        ownerUserId: currentUser.id,
        roster: [],
      };
      const filtered = (storedList || []).filter(
        (t: any) =>
          (t.inviteCode || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() !==
          generatedCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      );
      localStorage.setItem(TEAMS_KEY, JSON.stringify([newEntry, ...filtered]));

      if (teamCrestUrl) {
        try {
          const rawC = localStorage.getItem('futplay_team_crests_v1');
          const parsedC = rawC ? JSON.parse(rawC) : {};
          parsedC[trimmedTeam.toLowerCase()] = teamCrestUrl;
          localStorage.setItem('futplay_team_crests_v1', JSON.stringify(parsedC));
        } catch {}
      }
    } catch (e) {
      console.warn('Erro ao salvar time na chave dedicada:', e);
    }

    if (isSupabaseConfigured()) {
      supabaseService.recordAuditLogInSupabase(onbLog).catch(() => {});
      if (currentUser?.id) {
        supabaseService.updateProfile(currentUser.id, {
          position: position || undefined,
          teamName: trimmedTeam,
          teamCity: trimmedCity,
          teamCrestUrl: teamCrestUrl || undefined,
          teamModality,
          teamInviteCode: generatedCode,
          isTeamOwner: mode === 'create',
        });
      }
    }

    notify(
      'success',
      mode === 'create'
        ? `Time "${trimmedTeam}" Criado! Código: ${generatedCode}`
        : `Entrada Confirmada no "${trimmedTeam}"!`,
      mode === 'create'
        ? `Agora convide seus jogadores compartilhando o código ${generatedCode} ou o link do time.`
        : `Bem-vindo ao elenco do ${trimmedTeam} · ${modalityLabel[teamModality]} (${trimmedCity}).`
    );
    return true;
  };

  const saveOnboardingStep3: LeagueContextValue['saveOnboardingStep3'] = () => {
    markFirstAccessCompletedInStorage(currentUser.id, currentUser.email);

    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? {
              ...u,
              onboardingStep: 4,
              onboardingCompleted: true,
            }
          : u
      ),
    }));

    notify(
      'success',
      'Primeiro Acesso Concluído!',
      'Seu perfil e sua equipe estão prontos na Liga de Planalto - BA.'
    );
    return true;
  };

  const updatePlayerStatsManually: LeagueContextValue['updatePlayerStatsManually'] = (params) => {
    const { playerId, statsUpdates, profileUpdates, reason, actorUserId, actorName } = params;

    const targetProfile = state.profiles.find((p) => p.id === playerId || p.userId === playerId);
    if (!targetProfile) return false;

    const currentSeasonEntry =
      state.seasonEntries.find(
        (se) => se.playerId === targetProfile.id && se.seasonId === selectedSeasonId
      ) ||
      state.seasonEntries.find((se) => se.playerId === targetProfile.id) ||
      ({
        id: `season-entry-${targetProfile.id}-${selectedSeasonId}`,
        seasonId: selectedSeasonId,
        playerId: targetProfile.id,
        divisionId: targetProfile.currentDivisionId || 'div-geral',
        seasonPoints: 0,
        pendingPoints: 0,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals: 0,
        assists: 0,
        mvpCount: 0,
        superCapas: 0,
        goalkeeperCapas: 0,
        yellowCards: 0,
        blueCards: 0,
        redCards: 0,
        cleanSheets: 0,
        defensiveActions: 0,
        status: 'elegivel',
        updatedAt: new Date().toISOString(),
      } as SeasonEntry);

    const diffs: PlayerStatAdjustmentDiff[] = [];
    const beforeData: Record<string, unknown> = {};
    const afterData: Record<string, unknown> = {};

    const FIELD_LABELS: Record<string, string> = {
      matchesPlayed: 'Partidas Jogadas (PJ)',
      wins: 'Vitórias (V)',
      draws: 'Empates (E)',
      losses: 'Derrotas (D)',
      goals: 'Gols Marcados (G)',
      assists: 'Assistências (A)',
      superCapas: 'Super Capas (SC)',
      goalkeeperCapas: 'Capas de Goleiro (CG)',
      yellowCards: 'Cartões Amarelos (CA)',
      blueCards: 'Cartões Azuis (CB)',
      redCards: 'Cartões Vermelhos (CV)',
      cleanSheets: 'Jogos sem Sofrer Gols',
      seasonPoints: 'Pontos na Temporada',
      position: 'Posição',
    };

    // Avalia campos de SeasonEntry
    Object.entries(statsUpdates).forEach(([key, val]) => {
      const fieldKey = key as keyof SeasonEntry;
      const oldVal = currentSeasonEntry[fieldKey];
      if (val !== undefined && oldVal !== val) {
        beforeData[key] = oldVal ?? 0;
        afterData[key] = val;
        const numOld = typeof oldVal === 'number' ? oldVal : 0;
        const numNew = typeof val === 'number' ? val : 0;
        diffs.push({
          field: key,
          label: FIELD_LABELS[key] || key,
          before: (oldVal as number | string) ?? 0,
          after: val as number | string,
          delta: typeof val === 'number' && typeof oldVal === 'number' ? numNew - numOld : undefined,
        });
      }
    });

    // Avalia campos de PlayerProfile (ex: position, role)
    if (profileUpdates) {
      if (profileUpdates.position !== undefined && profileUpdates.position !== targetProfile.position) {
        beforeData['position'] = targetProfile.position;
        afterData['position'] = profileUpdates.position;
        diffs.push({
          field: 'position',
          label: 'Posição no Elenco',
          before: targetProfile.position,
          after: profileUpdates.position,
        });
      }

      if (profileUpdates.role !== undefined && profileUpdates.role !== (targetProfile.role || (targetProfile.isTeamOwner ? 'coach' : 'player'))) {
        const oldRole = targetProfile.role || (targetProfile.isTeamOwner ? 'coach' : 'player');
        beforeData['role'] = oldRole;
        afterData['role'] = profileUpdates.role;
        diffs.push({
          field: 'role',
          label: 'Função no Time',
          before: oldRole === 'coach' ? 'Treinador' : 'Atleta',
          after: profileUpdates.role === 'coach' ? 'Treinador' : 'Atleta',
        });
      }
    }

    if (diffs.length === 0) {
      return true; // Nada a alterar
    }

    const now = new Date().toISOString();
    const adjustmentId = `adj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newAdjustment: PlayerAdminAdjustment = {
      id: adjustmentId,
      playerId: targetProfile.id,
      playerName: targetProfile.displayName,
      actorUserId: actorUserId || currentUser.id,
      actorName: actorName || currentUser.email || 'Administrador',
      reason: reason.trim() || 'Ajuste manual de dados pelo Administrador',
      diffs,
      createdAt: now,
    };

    const newAuditLog: AuditLog = {
      id: `audit-${adjustmentId}`,
      actorUserId: actorUserId || currentUser.id,
      actorName: actorName || currentUser.email || 'Administrador',
      actorRole: 'admin',
      actionType: 'ADMIN_MANUAL_PLAYER_UPDATE',
      entityType: 'player_stats',
      entityId: targetProfile.id,
      reason: `${reason.trim() || 'Ajuste manual'} — Atleta: ${targetProfile.displayName} (${diffs
        .map((d) => `${d.label}: ${d.before} ➔ ${d.after}`)
        .join(', ')})`,
      beforeData,
      afterData,
      createdAt: now,
    };

    setState((prev) => {
      // 1. Atualiza SeasonEntry
      const updatedSeasonEntries = [...prev.seasonEntries];
      const sIdx = updatedSeasonEntries.findIndex(
        (se) => se.playerId === targetProfile.id && se.seasonId === selectedSeasonId
      );
      const updatedEntry: SeasonEntry = {
        ...currentSeasonEntry,
        ...statsUpdates,
        updatedAt: now,
      };
      if (sIdx >= 0) {
        updatedSeasonEntries[sIdx] = updatedEntry;
      } else {
        updatedSeasonEntries.push(updatedEntry);
      }

      // 2. Atualiza Profile
      const updatedProfiles = prev.profiles.map((p) => {
        if (p.id !== targetProfile.id) return p;
        const nextRole = profileUpdates?.role ?? p.role ?? (p.isTeamOwner ? 'coach' : 'player');
        const isCoachNow = nextRole === 'coach';
        return {
          ...p,
          ...profileUpdates,
          role: nextRole,
          isCoach: isCoachNow,
          isTeamOwner: isCoachNow ? true : (p.isTeamOwner && nextRole !== 'player' ? true : false),
          updatedAt: now,
        };
      });

      // 3. Atualiza Usuário correspondente
      const updatedUsers = prev.users.map((u) => {
        if (u.id === targetProfile.userId || u.id === targetProfile.id) {
          const nextRole = profileUpdates?.role ?? u.role ?? (u.isTeamOwner ? 'coach' : 'player');
          const isCoachNow = nextRole === 'coach';
          return {
            ...u,
            role: nextRole,
            isTeamOwner: isCoachNow ? true : (u.isTeamOwner && nextRole !== 'player' ? true : false),
          };
        }
        return u;
      });

      // 4. Atualiza Ajustes
      const updatedAdjustments = [newAdjustment, ...(prev.playerAdjustments || [])];
      try {
        localStorage.setItem('futplay_player_adjustments_v1', JSON.stringify(updatedAdjustments));
      } catch {}

      // 5. Atualiza AuditLogs
      const updatedLogs = [newAuditLog, ...(prev.auditLogs || [])];

      const next: LeagueState = {
        ...prev,
        seasonEntries: updatedSeasonEntries,
        profiles: updatedProfiles,
        users: updatedUsers,
        playerAdjustments: updatedAdjustments,
        auditLogs: updatedLogs,
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}

      return next;
    });

    if (isSupabaseConfigured()) {
      supabaseService.recordAuditLogInSupabase(newAuditLog).catch(() => {});
      if (targetProfile.userId && profileUpdates) {
        supabaseService.updateProfile(targetProfile.userId, profileUpdates).catch(() => {});
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('futplay_player_stats_changed', {
          detail: { playerId: targetProfile.id, adjustmentId },
        })
      );
      window.dispatchEvent(
        new CustomEvent('futplay_sumulas_changed', {
          detail: { count: 0 },
        })
      );
    }

    notify(
      'success',
      `Dados de ${targetProfile.displayName} Atualizados!`,
      `Foram aplicadas ${diffs.length} alterações com registro oficial no perfil do atleta.`
    );

    return true;
  };

  return (
    <LeagueContext.Provider
      value={{
        ...state,
        profiles: athleteProfiles,
        seasonEntries: athleteSeasonEntries,
        currentUser,
        currentPlayerProfile,
        selectedCityId,
        selectedSeasonId,
        notification,
        setSelectedCityId,
        setSelectedSeasonId,
        switchActiveUser,
        setActiveUserWithData,
        removeLocalUserSilently,
        clearNotification,
        notify,
        registerNewAthlete,
        updateOwnProfile,
        updateTeamInfo,
        deleteUserAccount,
        updatePlayerSkills,
        saveUserWhatsapp,
        saveOnboardingStep1,
        saveOnboardingStep2,
        saveOnboardingStep3,
        createCommunityMatch,
        submitMatchScoreAndEvents,
        confirmMatchResult,
        contestMatchResult,
        moderateMatchResolution,
        attemptDirectManipulationAttack,
        resetDemoDatabase,
        sumulaStopwatch,
        toggleMonthlyPayment,
        updateMonthlyConfig,
        finalizePeladaSumula,
        addTeamTransaction,
        deleteTeamTransaction,
        refreshTeamTransactions,
        refreshMonthlyData,
        refreshLeagueData,
        isCloudSyncReady,
        recordAuditLog,
        updatePlayerStatsManually,
        playerAdjustments: state.playerAdjustments || [],
      }}
    >
      {children}
    </LeagueContext.Provider>
  );
};

export function useLeague(): LeagueContextValue {
  const ctx = useContext(LeagueContext);
  if (!ctx) {
    throw new Error('useLeague deve ser usado dentro de um LeagueProvider');
  }
  return ctx;
}
