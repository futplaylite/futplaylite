import React, { createContext, useContext, useEffect, useState } from 'react';
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
  PointTransaction,
  ProfileVisibility,
  ResultConfirmation,
  Season,
  SeasonEntry,
  TeamModality,
  User,
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
import { isSupabaseConfigured, supabaseService, generateUUID } from '../supabase';

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

function markFirstAccessCompletedInStorage(userId: string, email?: string) {
  try {
    const set = getCompletedFirstAccessSet();
    if (userId) set.add(userId.toLowerCase());
    if (email) set.add(email.trim().toLowerCase());
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
}

interface LeagueContextValue extends LeagueState {
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
}

const LeagueContext = createContext<LeagueContextValue | null>(null);

export const DEFAULT_MONTHLY_CONFIG: PeladaMonthlyConfig = {
  monthlyAmount: 30,
  dueDay: 10,
  pixKey: '77988001122',
  pixKeyType: 'Celular',
  pixReceiverName: 'Rosália Esportes / Real Planalto FC',
};

function getInitialState(): LeagueState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: LeagueState = JSON.parse(saved);
      return {
        ...parsed,
        users: parsed.users || [],
        profiles: parsed.profiles || [],
        matches: parsed.matches || [],
        peerEvaluations: parsed.peerEvaluations || [],
        monthlyPayments: parsed.monthlyPayments || [],
        monthlyConfig: parsed.monthlyConfig || DEFAULT_MONTHLY_CONFIG,
      };
    }
  } catch (e) {
    console.warn('Falha ao ler estado salvo, usando dados iniciais:', e);
  }
  return {
    users: INITIAL_USERS,
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
    auditLogs: INITIAL_AUDIT_LOGS,
    peerEvaluations: [],
    monthlyPayments: [],
    monthlyConfig: DEFAULT_MONTHLY_CONFIG,
  };
}

export const LeagueProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
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

  // Sincronização inicial com o Supabase quando configurado
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    // 1. Sincroniza usuários a partir do Supabase (fonte oficial da verdade)
    supabaseService.getUsers().then((remoteUsers) => {
      if (!remoteUsers) return;
      setState((prev) => {
        const localMap = new Map(prev.users.map((u) => [u.id, u]));
        const merged = remoteUsers.map((ru) => {
          const loc = localMap.get(ru.id);
          return loc ? { ...loc, ...ru } : ru;
        });
        const next = { ...prev, users: merged };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore
        }
        return next;
      });
    });

    // 2. Sincroniza perfis esportivos do Supabase
    supabaseService.getProfiles().then((remoteProfiles) => {
      if (!remoteProfiles) return;
      setState((prev) => {
        const localMap = new Map(prev.profiles.map((p) => [p.id, p]));
        const merged = remoteProfiles.map((rp) => {
          const loc = localMap.get(rp.id);
          return loc ? { ...loc, ...rp } : rp;
        });
        const next = { ...prev, profiles: merged };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore
        }
        return next;
      });
    });

    // 3. Sincroniza configurações e mensalidades
    supabaseService.getMonthlyConfig().then((cfg) => {
      if (cfg) {
        setState((prev) => ({ ...prev, monthlyConfig: cfg }));
      }
    });

    supabaseService.getMonthlyPayments().then((payments) => {
      if (payments && payments.length > 0) {
        setState((prev) => ({ ...prev, monthlyPayments: payments }));
      }
    });
  }, []);

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
  const isAlreadyCompleted =
    Boolean(rawCurrentUser.id) &&
    (rawCurrentUser.onboardingCompleted === true ||
      (rawCurrentUser.onboardingStep || 1) >= 4 ||
      completedSet.has(rawCurrentUser.id.toLowerCase()) ||
      (rawCurrentUser.email && completedSet.has(rawCurrentUser.email.toLowerCase())));

  const currentUser: User = isAlreadyCompleted
    ? {
        ...rawCurrentUser,
        onboardingCompleted: true,
        onboardingStep: 4,
      }
    : rawCurrentUser;

  const currentPlayerProfile = state.profiles.find(
    (p) => p.userId === currentUser.id
  );

  const switchActiveUser = (userId: string) => {
    const target = state.users.find((u) => u.id === userId);
    if (target) {
      setCurrentUserId(target.id);
      try {
        localStorage.setItem(ACTIVE_USER_STORAGE_KEY, target.id);
      } catch {
        // Ignore
      }
      const prof = state.profiles.find((p) => p.userId === target.id);
      notify(
        'info',
        `Sessão alternada: ${prof ? prof.displayName : 'Moderador Oficial'}`,
        `Papel ativo no servidor: ${target.role.toUpperCase()} (${target.email})`
      );
    }
  };

  const setActiveUserWithData = (user: User, profile?: PlayerProfile) => {
    setState((prev) => {
      const userIdx = prev.users.findIndex((u) => u.id === user.id);
      const newUsers = [...prev.users];
      if (userIdx >= 0) {
        newUsers[userIdx] = { ...newUsers[userIdx], ...user };
      } else {
        newUsers.push(user);
      }

      let newProfiles = [...prev.profiles];
      if (profile) {
        const profIdx = newProfiles.findIndex(
          (p) => p.id === profile.id || p.userId === user.id
        );
        if (profIdx >= 0) {
          newProfiles[profIdx] = { ...newProfiles[profIdx], ...profile };
        } else {
          newProfiles.push(profile);
        }
      }

      return {
        ...prev,
        users: newUsers,
        profiles: newProfiles,
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

  // RF-001, RF-002, RF-003: Cadastro de Novo Atleta com Classificação Provisória (Bronze, 1000 Elo)
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

    const now = new Date().toISOString();
    const newUserId = generateUUID();
    const newPlayerId = generateUUID();

    const isFirstUser = state.users.length === 0;

    const newUser: User = {
      id: newUserId,
      email: params.email?.trim() || `${trimmedName.toLowerCase().replace(/\s+/g, '')}@futplay.com`,
      whatsappNumber: params.whatsappNumber?.trim() || undefined,
      role: isFirstUser ? 'coach' : 'player',
      isTeamOwner: isFirstUser,
      teamName: isFirstUser ? 'Real Planalto FC' : undefined,
      teamCity: 'Planalto - BA',
      status: 'ativa',
      createdAt: now,
      onboardingStep: 1,
      onboardingCompleted: false,
    };

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
      isTeamOwner: isFirstUser,
      teamName: isFirstUser ? 'Real Planalto FC' : undefined,
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
      reason: 'Cadastro inicial na Liga Municipal com classificação provisória (1000 Elo, Bronze).',
      afterData: {
        displayName: trimmedName,
        cityId: targetCityId,
        initialRating: 1000,
        isProvisional: true,
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
      `${trimmedName} ingressou na temporada com Rating inicial 1000 (Classificação Provisória · Divisão Bronze).`
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

    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === currentPlayerProfile.id
          ? {
              ...p,
              displayName: params.displayName.trim() || p.displayName,
              neighborhood: params.neighborhood.trim() || p.neighborhood,
              position: params.position,
              dominantFoot: params.dominantFoot,
              profileVisibility: params.profileVisibility,
              updatedAt: now,
            }
          : p
      ),
    }));

    notify(
      'success',
      'Perfil esportivo atualizado',
      'Suas preferências e visibilidade pública (LGPD) foram salvas com sucesso.'
    );
    return true;
  };

  // Exclusão de Conta de Atleta (Direito de eliminação / LGPD)
  const deleteUserAccount: LeagueContextValue['deleteUserAccount'] = async (targetUserId) => {
    const userIdToDelete = targetUserId || currentUserId;
    if (!userIdToDelete) return false;

    const userToDelete = state.users.find((u) => u.id === userIdToDelete);
    const profileToDelete = state.profiles.find((p) => p.userId === userIdToDelete);

    // 1. Sincroniza exclusão no Supabase PRIMEIRO (aguardando conclusão antes de eventual reload)
    if (isSupabaseConfigured()) {
      try {
        await supabaseService.deleteUser(
          userIdToDelete,
          userToDelete?.email,
          userToDelete?.whatsappNumber
        );
      } catch (err) {
        console.warn('Erro ao excluir no Supabase:', err);
      }
    }

    // 2. Remove senhas ou credenciais locais
    try {
      const stored = JSON.parse(localStorage.getItem('futplay_user_passwords') || '{}');
      delete stored[userIdToDelete];
      if (profileToDelete) {
        delete stored[profileToDelete.id];
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
    const isCurrentActive = userIdToDelete === currentUserId;
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
      const remainingUsers = prev.users.filter((u) => u.id !== userIdToDelete);
      const remainingProfiles = prev.profiles.filter(
        (p) => p.userId !== userIdToDelete && (!profileToDelete || p.id !== profileToDelete.id)
      );
      const remainingSeasonEntries = prev.seasonEntries.filter(
        (se) => !profileToDelete || se.playerId !== profileToDelete.id
      );

      const nextState = {
        ...prev,
        users: remainingUsers,
        profiles: remainingProfiles,
        seasonEntries: remainingSeasonEntries,
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
      `A conta de ${profileToDelete?.displayName || userToDelete?.email || 'atleta'} foi removida permanentemente da liga.`
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

      // Filtra todas as avaliações feitas para este jogador específico
      const targetEvals = updatedEvals.filter((e) => e.targetPlayerId === playerId);
      const totalVotes = targetEvals.length;

      // Calcula a média exata de cada quesito entre todos os avaliadores
      const avgFin = Number(
        (targetEvals.reduce((acc, cur) => acc + cur.finalizacao, 0) / totalVotes).toFixed(1)
      );
      const avgMar = Number(
        (targetEvals.reduce((acc, cur) => acc + cur.marcacao, 0) / totalVotes).toFixed(1)
      );
      const avgPas = Number(
        (targetEvals.reduce((acc, cur) => acc + cur.passe, 0) / totalVotes).toFixed(1)
      );
      const avgRac = Number(
        (targetEvals.reduce((acc, cur) => acc + cur.raca, 0) / totalVotes).toFixed(1)
      );
      const avgDri = Number(
        (targetEvals.reduce((acc, cur) => acc + cur.drible, 0) / totalVotes).toFixed(1)
      );

      // A média das 5 notas médias resulta na nota geral em estrelas
      const overallStars = Number(
        ((avgFin + avgMar + avgPas + avgRac + avgDri) / 5).toFixed(1)
      );

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
      };
    });

    notify(
      'success',
      'Classificação computada!',
      `Sua avaliação para ${p.displayName} foi registrada e integrada à média geral do atleta.`
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
      'Partida Validada! Pontos e Rating Elo calculados',
      `Confirmação independente registrada. A fórmula P = 5 + R + 3G + 2A + 3M e o Elo coletivo foram creditados aos participantes.`
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
        'Tentativa bloqueada (403 Forbidden - CA-030): Cliente tentou enviar payload direto { currentRating: 1850, seasonPoints: 999, division: "Diamante" } fora do motor de servidor.',
      beforeData: {
        currentRating: currentPlayerProfile?.currentRating,
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
      'Usuários não podem manipular pontos, rating Elo, divisões ou estados de validação diretamente. Tentativa registrada no Log de Auditoria.'
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
    setState({
      users: INITIAL_USERS,
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
      auditLogs: INITIAL_AUDIT_LOGS,
      peerEvaluations: [],
      monthlyPayments: [],
      monthlyConfig: DEFAULT_MONTHLY_CONFIG,
    });
    setCurrentUserId('');
    notify(
      'info',
      'Base Limpa com Sucesso',
      'Todos os dados de teste foram removidos. Pronto para novos cadastros reais.'
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

    setState((prev) => {
      const currentList = prev.monthlyPayments || [];
      const existingIdx = currentList.findIndex(
        (m) => m.playerId === playerId && m.yearMonth === yearMonth
      );

      const record: MonthlyPaymentRecord = {
        id: paymentId,
        playerId,
        yearMonth,
        isPaid,
        paidAt: isPaid ? now : undefined,
        amount: feeAmount,
        confirmedBy: currentUserId || 'admin-pelada',
      };

      const updatedPayments =
        existingIdx >= 0
          ? currentList.map((item, idx) => (idx === existingIdx ? record : item))
          : [...currentList, record];

      if (isSupabaseConfigured()) {
        supabaseService.upsertMonthlyPayment(record).catch((err) => {
          console.warn('Falha assíncrona ao sincronizar mensalidade com Supabase:', err);
        });
      }

      return {
        ...prev,
        monthlyPayments: updatedPayments,
      };
    });

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
    setState((prev) => ({
      ...prev,
      monthlyConfig: updatedConfig,
    }));
    if (isSupabaseConfigured()) {
      supabaseService.saveMonthlyConfig(updatedConfig).catch((err) => {
        console.warn('Falha assíncrona ao salvar config no Supabase:', err);
      });
    }
    notify('success', 'Configuração Salva', 'Dados da mensalidade e PIX atualizados com sucesso.');
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
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? {
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
            }
          : u
      ),
      profiles: prev.profiles.map((p) =>
        p.userId === currentUser.id
          ? {
              ...p,
              teamName: trimmedTeam,
              teamCity: trimmedCity,
              teamCrestUrl: teamCrestUrl ?? p.teamCrestUrl,
              teamModality,
              teamInviteCode: generatedCode,
              isTeamOwner: mode === 'create',
              position: position ?? p.position,
              updatedAt: now,
            }
          : p
      ),
    }));

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

  return (
    <LeagueContext.Provider
      value={{
        ...state,
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
