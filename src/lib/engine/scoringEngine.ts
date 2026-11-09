import {
  PointBreakdown,
  PlayerProfile,
  SeasonEntry,
} from '../../types/league';

export const RULESET_VERSION = 'v1.0.0';

/**
 * Calcula a pontuação de temporada oficial conforme a Seção 3.1 do PRD:
 * P = 5 + R + 3G + 2A + 3M
 *
 * Onde:
 * - Participação validada = +5
 * - R (Resultado da equipe): Vitória = +15, Empate = +5, Derrota = +0
 * - G (Gols validados): +3 por gol
 * - A (Assistências validadas): +2 por assistência
 * - M (MVP validado): +3 se confirmado (1), 0 caso contrário
 */
export function calculateMatchSeasonPoints(params: {
  teamResult: 'win' | 'draw' | 'loss';
  validatedGoals: number;
  validatedAssists: number;
  isValidatedMvp: boolean;
}): PointBreakdown {
  const participation = 5;
  const resultBonus =
    params.teamResult === 'win'
      ? 15
      : params.teamResult === 'draw'
        ? 5
        : 0;

  const goalsCount = Math.max(0, Math.floor(params.validatedGoals));
  const assistsCount = Math.max(0, Math.floor(params.validatedAssists));
  const goalsPoints = 3 * goalsCount;
  const assistsPoints = 2 * assistsCount;
  const mvpPoints = params.isValidatedMvp ? 3 : 0;

  const total =
    participation + resultBonus + goalsPoints + assistsPoints + mvpPoints;

  return {
    participation,
    resultBonus,
    goalsPoints,
    assistsPoints,
    mvpPoints,
    goalsCount,
    assistsCount,
    isMvp: params.isValidatedMvp,
    total,
  };
}

/**
 * Critérios oficiais de desempate (Seção 3.1 / CA-020):
 * 1. Maior pontuação confirmada da temporada (seasonPoints)
 * 2. Maior rating de habilidade (currentRating)
 * 3. Maior número de vitórias validadas (wins)
 * 4. Maior número de partidas válidas (matchesPlayed)
 * 5. Maior número de MVPs validados (mvpCount)
 */
export function compareSeasonRanking(
  a: { entry: SeasonEntry; profile: PlayerProfile },
  b: { entry: SeasonEntry; profile: PlayerProfile }
): number {
  if (b.entry.seasonPoints !== a.entry.seasonPoints) {
    return b.entry.seasonPoints - a.entry.seasonPoints;
  }
  if (b.profile.currentRating !== a.profile.currentRating) {
    return b.profile.currentRating - a.profile.currentRating;
  }
  if (b.entry.wins !== a.entry.wins) {
    return b.entry.wins - a.entry.wins;
  }
  if (b.entry.matchesPlayed !== a.entry.matchesPlayed) {
    return b.entry.matchesPlayed - a.entry.matchesPlayed;
  }
  if (b.entry.mvpCount !== a.entry.mvpCount) {
    return b.entry.mvpCount - a.entry.mvpCount;
  }
  return a.profile.displayName.localeCompare(b.profile.displayName, 'pt-BR');
}

/**
 * Desativado a pedido: sistema de pontuação experimental por posição.
 */
export function calculateExperimentalPositionScore(
  _profile: PlayerProfile,
  _entry: SeasonEntry
): number | null {
  return null;
}
