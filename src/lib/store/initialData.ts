import {
  AuditLog,
  City,
  Dispute,
  Division,
  EvidenceFile,
  Match,
  MatchEvent,
  MatchPlayer,
  MatchResultVersion,
  PlayerProfile,
  PlayerRatingLog,
  PointTransaction,
  ResultConfirmation,
  Season,
  SeasonEntry,
  User,
} from '../../types/league';
import { DEFAULT_DIVISIONS } from '../engine/eloEngine';

export const INITIAL_CITIES: City[] = [
  {
    id: 'city-rosalia',
    name: 'Planalto',
    stateCode: 'BA',
    regionName: 'Sudoeste da Bahia',
    countryCode: 'BR',
    slug: 'planalto-ba',
    status: 'ativa',
  },
  {
    id: 'city-marilia',
    name: 'Poções',
    stateCode: 'BA',
    regionName: 'Sudoeste da Bahia',
    countryCode: 'BR',
    slug: 'pocoes-ba',
    status: 'em_preparacao',
  },
  {
    id: 'city-oriente',
    name: 'Vitória da Conquista',
    stateCode: 'BA',
    regionName: 'Sudoeste da Bahia',
    countryCode: 'BR',
    slug: 'vitoria-da-conquista-ba',
    status: 'em_preparacao',
  },
];

export const INITIAL_DIVISIONS: Division[] = DEFAULT_DIVISIONS;

export const INITIAL_SEASONS: Season[] = [
  {
    id: 'season-2026-2',
    cityId: 'city-rosalia',
    name: 'Temporada 2026.2 · Liga Planalto - BA',
    startsAt: '2026-09-01T00:00:00-03:00',
    endsAt: '2026-11-10T23:59:59-03:00',
    gracePeriodEndsAt: '2026-11-17T23:59:59-03:00',
    durationWeeks: 10,
    rulesetVersion: 'v1.0.0',
    status: 'ativa',
  },
];

// Base Limpa para Produção (Cada atleta/usuário realiza o próprio cadastro)
export const INITIAL_USERS: User[] = [];
export const INITIAL_PROFILES: PlayerProfile[] = [];
export const INITIAL_SEASON_ENTRIES: SeasonEntry[] = [];
export const INITIAL_MATCHES: Match[] = [];
export const INITIAL_MATCH_PLAYERS: MatchPlayer[] = [];
export const INITIAL_MATCH_RESULTS: MatchResultVersion[] = [];
export const INITIAL_MATCH_EVENTS: MatchEvent[] = [];
export const INITIAL_CONFIRMATIONS: ResultConfirmation[] = [];
export const INITIAL_DISPUTES: Dispute[] = [];
export const INITIAL_EVIDENCE_FILES: EvidenceFile[] = [];
export const INITIAL_POINT_TRANSACTIONS: PointTransaction[] = [];
export const INITIAL_RATING_LOGS: PlayerRatingLog[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
