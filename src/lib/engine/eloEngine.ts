import { Division, DivisionName } from '../../types/league';

export const ELO_ALGORITHM_VERSION = 'elo-team-v1.0';
export const PROVISIONAL_MATCHES_THRESHOLD = 5;

export const DEFAULT_DIVISIONS: Division[] = [
  {
    id: '22222222-2222-4222-8222-222222222201',
    name: 'Geral',
    tier: 1,
    minRating: 0,
    maxRating: null,
    minMatchesRequired: 0,
    rulesetVersion: 'v1.0.0',
  },
];

export function calculateExpectedTeamScore(
  teamAverageRating: number,
  opponentAverageRating: number
): number {
  const exponent = (opponentAverageRating - teamAverageRating) / 400;
  const expected = 1 / (1 + Math.pow(10, exponent));
  return Number(expected.toFixed(4));
}

export function getDynamicKFactor(
  currentRating: number,
  totalValidatedMatches: number
): number {
  if (totalValidatedMatches < PROVISIONAL_MATCHES_THRESHOLD) {
    return 40;
  }
  if (currentRating < 1400) {
    return 24;
  }
  return 16;
}

export function calculatePlayerEloUpdate(params: {
  playerRatingBefore: number;
  playerUncertaintyBefore: number;
  totalValidatedMatchesBefore: number;
  teamAverageRating: number;
  opponentAverageRating: number;
  actualScore: 1 | 0.5 | 0;
}): {
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  uncertaintyBefore: number;
  uncertaintyAfter: number;
  kFactor: number;
  expectedScore: number;
  actualScore: number;
  isProvisionalAfter: boolean;
} {
  const expectedScore = calculateExpectedTeamScore(
    params.teamAverageRating,
    params.opponentAverageRating
  );

  const kFactor = getDynamicKFactor(
    params.playerRatingBefore,
    params.totalValidatedMatchesBefore
  );

  const rawDelta = kFactor * (params.actualScore - expectedScore);
  const ratingDelta = Math.round(rawDelta);
  const ratingAfter = Math.max(600, params.playerRatingBefore + ratingDelta);

  const uncertaintyAfter = Number(
    Math.max(15, params.playerUncertaintyBefore - 12).toFixed(2)
  );
  const totalAfter = params.totalValidatedMatchesBefore + 1;

  return {
    ratingBefore: params.playerRatingBefore,
    ratingAfter,
    ratingDelta,
    uncertaintyBefore: params.playerUncertaintyBefore,
    uncertaintyAfter,
    kFactor,
    expectedScore,
    actualScore: params.actualScore,
    isProvisionalAfter: totalAfter < PROVISIONAL_MATCHES_THRESHOLD,
  };
}

export function resolveDivisionForPlayer(
  _rating: number = 0,
  _totalValidatedMatches: number = 0,
  divisions: Division[] = DEFAULT_DIVISIONS
): Division {
  return divisions[0] || DEFAULT_DIVISIONS[0];
}

export function getDivisionBadgeStyle(_divisionName?: DivisionName): {
  bg: string;
  border: string;
  text: string;
  accent: string;
} {
  return {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    accent: '#1D4ED8',
  };
}
