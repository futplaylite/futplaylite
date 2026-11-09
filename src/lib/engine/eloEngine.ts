import { Division, DivisionName } from '../../types/league';

export const ELO_ALGORITHM_VERSION = 'elo-team-v1.0';
export const PROVISIONAL_MATCHES_THRESHOLD = 5;

export const DEFAULT_DIVISIONS: Division[] = [
  {
    id: '22222222-2222-4222-8222-222222222201',
    name: 'Bronze',
    tier: 1,
    minRating: 0,
    maxRating: 1099,
    minMatchesRequired: 0,
    rulesetVersion: 'v1.0.0',
  },
  {
    id: '22222222-2222-4222-8222-222222222202',
    name: 'Prata',
    tier: 2,
    minRating: 1100,
    maxRating: 1249,
    minMatchesRequired: 5,
    rulesetVersion: 'v1.0.0',
  },
  {
    id: '22222222-2222-4222-8222-222222222203',
    name: 'Ouro',
    tier: 3,
    minRating: 1250,
    maxRating: 1399,
    minMatchesRequired: 5,
    rulesetVersion: 'v1.0.0',
  },
  {
    id: '22222222-2222-4222-8222-222222222204',
    name: 'Platina',
    tier: 4,
    minRating: 1400,
    maxRating: 1549,
    minMatchesRequired: 5,
    rulesetVersion: 'v1.0.0',
  },
  {
    id: '22222222-2222-4222-8222-222222222205',
    name: 'Diamante',
    tier: 5,
    minRating: 1550,
    maxRating: null,
    minMatchesRequired: 5,
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
  rating: number,
  totalValidatedMatches: number,
  divisions: Division[] = DEFAULT_DIVISIONS
): Division {
  const bronze = divisions.find((d) => d.name === 'Bronze') || divisions[0];
  if (totalValidatedMatches < PROVISIONAL_MATCHES_THRESHOLD) {
    return bronze;
  }

  const sortedDesc = [...divisions].sort((a, b) => b.tier - a.tier);
  for (const div of sortedDesc) {
    if (
      rating >= div.minRating &&
      totalValidatedMatches >= div.minMatchesRequired
    ) {
      return div;
    }
  }
  return bronze;
}

export function getDivisionBadgeStyle(divisionName: DivisionName): {
  bg: string;
  border: string;
  text: string;
  accent: string;
} {
  switch (divisionName) {
    case 'Diamante':
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-300',
        text: 'text-blue-700',
        accent: '#1D4ED8',
      };
    case 'Platina':
      return {
        bg: 'bg-sky-50',
        border: 'border-sky-300',
        text: 'text-sky-700',
        accent: '#0284C7',
      };
    case 'Ouro':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-300',
        text: 'text-amber-700',
        accent: '#B45309',
      };
    case 'Prata':
      return {
        bg: 'bg-slate-100',
        border: 'border-slate-300',
        text: 'text-slate-700',
        accent: '#475569',
      };
    case 'Bronze':
    default:
      return {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-700',
        accent: '#C2410C',
      };
  }
}
