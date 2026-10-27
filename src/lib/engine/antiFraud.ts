import {
  FraudSignal,
  Match,
  MatchPlayer,
  ResultConfirmation,
} from '../../types/league';

/**
 * Motor de Proteção contra Manipulação e Fraude (Seção 3.4 e CA-033).
 * Identifica padrões suspeitos sem aplicar sanção irreversível automática,
 * retendo temporariamente a validação ou encaminhando para revisão humana.
 */
export function inspectMatchForFraudSignals(params: {
  targetMatch: Match;
  targetPlayers: MatchPlayer[];
  allMatches: Match[];
  allMatchPlayers: MatchPlayer[];
  confirmations: ResultConfirmation[];
}): FraudSignal[] {
  const signals: FraudSignal[] = [];
  const nowIso = new Date().toISOString();

  // 1. Detectar tentativa de partida duplicada (mesmo local, data próxima e mesmos capitães)
  const duplicateCandidate = params.allMatches.find(
    (m) =>
      m.id !== params.targetMatch.id &&
      m.status !== 'cancelada' &&
      m.status !== 'anulada' &&
      m.venueName.toLowerCase() === params.targetMatch.venueName.toLowerCase() &&
      Math.abs(
        new Date(m.scheduledAt).getTime() -
          new Date(params.targetMatch.scheduledAt).getTime()
      ) <
        2 * 60 * 60 * 1000 &&
      ((m.homeCaptainId === params.targetMatch.homeCaptainId &&
        m.awayCaptainId === params.targetMatch.awayCaptainId) ||
        (m.homeCaptainId === params.targetMatch.awayCaptainId &&
          m.awayCaptainId === params.targetMatch.homeCaptainId))
  );

  if (duplicateCandidate) {
    signals.push({
      id: `fraud-dup-${params.targetMatch.id}`,
      code: 'TENTATIVA_PARTIDA_DUPLICADA',
      severity: 'alta',
      description: `Partida no mesmo local (${params.targetMatch.venueName}) e janela de horário com os mesmos capitães já registrada (ID: ${duplicateCandidate.id.slice(0, 8)}).`,
      detectedAt: nowIso,
    });
  }

  // 2. Jogos repetidos entre o mesmo grupo em alta frequência (Seção 3.4 - Farm de pontos)
  const targetPlayerIds = new Set(params.targetPlayers.map((p) => p.playerId));
  let highOverlapMatchesCount = 0;

  for (const otherMatch of params.allMatches) {
    if (otherMatch.id === params.targetMatch.id) continue;
    const daysDiff =
      Math.abs(
        new Date(params.targetMatch.scheduledAt).getTime() -
          new Date(otherMatch.scheduledAt).getTime()
      ) /
      (1000 * 60 * 60 * 24);

    if (daysDiff <= 7) {
      const otherPlayers = params.allMatchPlayers.filter(
        (mp) => mp.matchId === otherMatch.id
      );
      const overlap = otherPlayers.filter((mp) =>
        targetPlayerIds.has(mp.playerId)
      ).length;
      if (
        targetPlayerIds.size >= 4 &&
        overlap / Math.max(1, targetPlayerIds.size) >= 0.8
      ) {
        highOverlapMatchesCount++;
      }
    }
  }

  if (highOverlapMatchesCount >= 3) {
    signals.push({
      id: `fraud-freq-${params.targetMatch.id}`,
      code: 'FREQUENCIA_ATIPICA_MESMO_GRUPO',
      severity: 'media',
      description: `Mais de 3 partidas na mesma semana com >80% dos mesmos atletas (possível farm artificial de pontos).`,
      detectedAt: nowIso,
    });
  }

  // 3. Conflito nas confirmações de participantes
  const contestations = params.confirmations.filter(
    (c) => c.confirmationType === 'contestacao'
  );
  if (contestations.length > 0) {
    signals.push({
      id: `fraud-conf-${params.targetMatch.id}`,
      code: 'CONFLITO_CONFIRMACOES',
      severity: 'alta',
      description: `Há ${contestations.length} contestação(ões) formal(is) registrada(s) por participante(s) ou capitão adversário.`,
      detectedAt: nowIso,
    });
  }

  return signals;
}
