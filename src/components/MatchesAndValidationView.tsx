import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  FileCheck2,
  Lock,
  Trophy,
  ClipboardList,
  PlusCircle,
  Shield,
  Calendar,
  Users,
  Award,
  Trash2,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { getMatchStatusBadge } from './DashboardView';
import { DisputeReasonCode, MatchFormat } from '../types/league';
import { SumulaPeladaView, getStoredSumulas, deleteSumulaFromList, SumulaData } from './SumulaPeladaView';

interface MatchesAndValidationViewProps {
  initialMatchId?: string;
  onNavigateToAdmin?: (matchId: string) => void;
}

export const MatchesAndValidationView: React.FC<
  MatchesAndValidationViewProps
> = ({ initialMatchId, onNavigateToAdmin }) => {
  const {
    matches,
    matchPlayers,
    matchResults,
    matchEvents,
    evidenceFiles,
    pointTransactions,
    profiles,
    currentUser,
    currentPlayerProfile,
    switchActiveUser,
    createCommunityMatch,
    submitMatchScoreAndEvents,
    confirmMatchResult,
    contestMatchResult,
  } = useLeague();

  // Nível de acesso: Treinador (coach / dono de time) ou Admin podem criar/gerenciar súmulas em andamento
  const isCoachOrAdmin =
    currentUser.role === 'admin' ||
    currentUser.role === 'coach' ||
    currentUser.isTeamOwner === true;

  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    initialMatchId || matches[1]?.id || matches[0]?.id
  );
  const [activeSumulaView, setActiveSumulaView] = useState<
    'none' | 'pelada' | 'oficial'
  >('none');
  const [selectedSumulaId, setSelectedSumulaId] = useState<string | undefined>();
  const [isCreatingNewSumula, setIsCreatingNewSumula] = useState<boolean>(false);
  const [blockedSumulaNotice, setBlockedSumulaNotice] = useState<string | null>(null);
  const [sumulaStatusFilter, setSumulaStatusFilter] = useState<
    'todas' | 'em_andamento' | 'agendadas' | 'validadas'
  >('todas');
  const [sumulaToDelete, setSumulaToDelete] = useState<SumulaData | null>(null);

  const [venueName, setVenueName] = useState('Arena Planalto Society');
  const [neighborhood, setNeighborhood] = useState('Centro - Planalto');
  const [format, setFormat] = useState<MatchFormat>('7v7');
  const [homeTeamName, setHomeTeamName] = useState('Esquadrão Azul');
  const [awayTeamName, setAwayTeamName] = useState('Seleção Ouro');
  const [homePlayerIds, setHomePlayerIds] = useState<string[]>([
    'player-henrique',
    'player-jp',
    'player-hugo-pacoca',
    'player-deda',
    'player-palito',
  ]);
  const [awayPlayerIds, setAwayPlayerIds] = useState<string[]>([
    'player-melquiz',
    'player-dayvid',
    'player-marlom',
    'player-yago',
    'player-manelao',
  ]);

  const [homeScoreInput, setHomeScoreInput] = useState<number>(6);
  const [awayScoreInput, setAwayScoreInput] = useState<number>(5);
  const [mvpPlayerIdInput, setMvpPlayerIdInput] =
    useState<string>('player-henrique');
  const [goalkeeperCapaPlayerIdInput, setGoalkeeperCapaPlayerIdInput] =
    useState<string>('player-palito');
  const [goalScorersInput, setGoalScorersInput] = useState<string[]>([
    'player-henrique',
    'player-henrique',
    'player-melquiz',
    'player-dayvid',
  ]);
  const [assistPlayersInput] = useState<string[]>(['player-jp']);
  const [yellowCardPlayersInput, setYellowCardPlayersInput] = useState<
    string[]
  >(['player-henrique']);
  const [blueCardPlayersInput, setBlueCardPlayersInput] = useState<string[]>(
    []
  );
  const [evidenceTitleInput] = useState<string>(
    'Súmula Oficial da Rodada (Planalto - BA)'
  );

  const [showContestBox, setShowContestBox] = useState<boolean>(false);
  const [disputeReason, setDisputeReason] =
    useState<DisputeReasonCode>('placar_incorreto');
  const [disputeDesc, setDisputeDesc] = useState<string>(
    'Divergência no placar final anotado.'
  );

  const selectedMatch =
    matches.find((m) => m.id === selectedMatchId) || matches[0];

  const playersInMatch = matchPlayers.filter(
    (mp) => mp.matchId === selectedMatch.id
  );
  const homeLineup = playersInMatch.filter((mp) => mp.teamSide === 'home');
  const awayLineup = playersInMatch.filter((mp) => mp.teamSide === 'away');

  const versionsForMatch = matchResults
    .filter((r) => r.matchId === selectedMatch.id)
    .sort((a, b) => b.versionNumber - a.versionNumber);

  const activeResultVersion = versionsForMatch.find(
    (r) => r.id === selectedMatch.activeResultVersionId
  );

  const eventsForActiveVersion = matchEvents.filter(
    (e) => e.resultVersionId === activeResultVersion?.id
  );

  const evidencesForMatch = evidenceFiles.filter(
    (ev) => ev.matchId === selectedMatch.id
  );

  const txForMatch = pointTransactions.filter(
    (pt) => pt.matchId === selectedMatch.id
  );

  const isParticipantOrStaff =
    currentUser.role === 'admin' ||
    currentUser.role === 'moderator' ||
    playersInMatch.some((mp) => mp.playerId === currentPlayerProfile?.id);

  const togglePlayerTeamSelection = (
    playerId: string,
    targetSide: 'home' | 'away'
  ) => {
    if (targetSide === 'home') {
      if (homePlayerIds.includes(playerId)) {
        setHomePlayerIds(homePlayerIds.filter((id) => id !== playerId));
      } else {
        setAwayPlayerIds(awayPlayerIds.filter((id) => id !== playerId));
        setHomePlayerIds([...homePlayerIds, playerId]);
      }
    } else {
      if (awayPlayerIds.includes(playerId)) {
        setAwayPlayerIds(awayPlayerIds.filter((id) => id !== playerId));
      } else {
        setHomePlayerIds(homePlayerIds.filter((id) => id !== playerId));
        setAwayPlayerIds([...awayPlayerIds, playerId]);
      }
    }
  };

  const changePlayerGoalsInSumula = (playerId: string, delta: 1 | -1) => {
    if (delta === 1) {
      setGoalScorersInput((prev) => [...prev, playerId]);
    } else {
      setGoalScorersInput((prev) => {
        const idx = prev.indexOf(playerId);
        if (idx === -1) return prev;
        const copy = [...prev];
        copy.splice(idx, 1);
        return copy;
      });
    }
  };

  const toggleCardSelection = (
    playerId: string,
    cardType: 'yellow' | 'blue'
  ) => {
    if (cardType === 'yellow') {
      setYellowCardPlayersInput((prev) =>
        prev.includes(playerId)
          ? prev.filter((id) => id !== playerId)
          : [...prev, playerId]
      );
    } else {
      setBlueCardPlayersInput((prev) =>
        prev.includes(playerId)
          ? prev.filter((id) => id !== playerId)
          : [...prev, playerId]
      );
    }
  };

  const handleCreateMatch = (e: React.FormEvent) => {
    e.preventDefault();
    const created = createCommunityMatch({
      venueName,
      neighborhood,
      scheduledAt: new Date().toISOString(),
      format,
      homeTeamName,
      awayTeamName,
      homePlayerIds,
      awayPlayerIds,
      homeCaptainId: homePlayerIds[0] || 'player-henrique',
      awayCaptainId: awayPlayerIds[0] || 'player-melquiz',
    });
    if (created) {
      setSelectedMatchId(created.id);
    }
  };

  const handleSubmitScore = (e: React.FormEvent) => {
    e.preventDefault();
    submitMatchScoreAndEvents({
      matchId: selectedMatch.id,
      homeScore: homeScoreInput,
      awayScore: awayScoreInput,
      mvpPlayerId: mvpPlayerIdInput || undefined,
      goalkeeperCapaPlayerId: goalkeeperCapaPlayerIdInput || undefined,
      goalScorerIds: goalScorersInput,
      assistPlayerIds: assistPlayersInput,
      yellowCardPlayerIds: yellowCardPlayersInput,
      blueCardPlayerIds: blueCardPlayersInput,
      evidenceTitle: evidenceTitleInput,
    });
  };

  const handleContestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    contestMatchResult({
      matchId: selectedMatch.id,
      reasonCode: disputeReason,
      description: disputeDesc,
    });
    setShowContestBox(false);
  };

  const awayCaptainProfile = profiles.find(
    (p) => p.id === selectedMatch.awayCaptainId
  );

  // Se o usuário clicou na Súmula de Pelada, abre como página dedicada (não popup)
  if (activeSumulaView === 'pelada') {
    return (
      <SumulaPeladaView
        sumulaId={selectedSumulaId}
        isNew={isCreatingNewSumula}
        onBack={() => {
          setActiveSumulaView('none');
          setIsCreatingNewSumula(false);
          setSelectedSumulaId(undefined);
        }}
      />
    );
  }

  const allSavedSumulas: SumulaData[] = getStoredSumulas();

  return (
    <div className="space-y-4">
      {/* Card Azul Compacto */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 p-3 text-white shadow-sm flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4 text-blue-200 shrink-0" />
            Súmulas & Partidas
          </h1>
          <p className="text-[11px] text-blue-100 truncate">
            Peladas semanais e jogos oficiais
          </p>
        </div>

        {isCoachOrAdmin && (
          <button
            onClick={() => {
              setIsCreatingNewSumula(true);
              setSelectedSumulaId(undefined);
              setActiveSumulaView('pelada');
            }}
            className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-black text-blue-800 shadow-sm hover:bg-blue-50 active:scale-95 transition"
          >
            <PlusCircle className="h-3.5 w-3.5 text-blue-600" />
            Nova Súmula
          </button>
        )}
      </div>

      {/* Seletor de Filtros de Status */}
      <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-2xs space-y-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'todas', label: 'Todas' },
            { id: 'em_andamento', label: 'Em Andamento' },
            { id: 'agendadas', label: 'Agendadas' },
            { id: 'validadas', label: 'Validadas' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSumulaStatusFilter(tab.id as any)}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                sumulaStatusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Lista de Todas as Súmulas da Pelada */}
        <div className="space-y-2.5 pt-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>
              {sumulaStatusFilter === 'validadas'
                ? 'Súmulas Finalizadas & Validadas'
                : sumulaStatusFilter === 'agendadas'
                ? 'Súmulas Agendadas'
                : sumulaStatusFilter === 'em_andamento'
                ? 'Súmulas em Andamento'
                : 'Todas as Súmulas da Pelada'}
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              {allSavedSumulas.length}{' '}
              {allSavedSumulas.length === 1 ? 'súmula' : 'súmulas'}
            </span>
          </div>

          {allSavedSumulas
            .filter((s) => {
              if (sumulaStatusFilter === 'em_andamento') {
                return s.status === 'em_andamento';
              }
              if (sumulaStatusFilter === 'validadas') {
                return s.status === 'finalizada';
              }
              if (sumulaStatusFilter === 'agendadas') {
                return false;
              }
              return true;
            })
            .map((s, idx) => {
              const totalGoals = Object.values(s.teamLineups).reduce(
                (sum, team) =>
                  sum +
                  team.reduce(
                    (tSum, p) => tSum + (Number(p.goals) || 0),
                    0
                  ),
                0
              );
              const totalArrivals = s.arrivalList.filter(
                (a) => a.confirmed
              ).length;

              return (
                <div
                  key={s.id || idx}
                  onClick={() => {
                    if (!isCoachOrAdmin && s.status === 'em_andamento') {
                      setBlockedSumulaNotice(
                        'Esta súmula ainda está em andamento no campo. Como jogador, você terá acesso completo para visualizar as estatísticas assim que for validada pelo treinador ou administrador.'
                      );
                      return;
                    }
                    setSelectedSumulaId(s.id);
                    setIsCreatingNewSumula(false);
                    setActiveSumulaView('pelada');
                  }}
                  className="cursor-pointer rounded-xl bg-gradient-to-r from-blue-50/60 to-slate-50 border border-blue-200/80 p-2.5 hover:border-blue-400 hover:shadow-xs transition space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`flex h-2 w-2 shrink-0 rounded-full ${
                          s.status === 'em_andamento'
                            ? 'bg-emerald-500 animate-pulse'
                            : 'bg-blue-600'
                        }`}
                      ></span>
                      <span className="text-xs font-black text-slate-900 truncate">
                        Súmula {s.matchDate || 'Rodada'}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                          s.status === 'em_andamento'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {s.status === 'em_andamento' ? 'Ativa' : 'Validada'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isCoachOrAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSumulaToDelete(s);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="Excluir súmula"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <span className="text-[11px] font-bold text-blue-600 flex items-center">
                        {!isCoachOrAdmin && s.status === 'em_andamento' ? (
                          <span className="text-slate-400 flex items-center gap-0.5">
                            <Lock className="h-3 w-3" /> Em andamento
                          </span>
                        ) : (
                          'Abrir →'
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1 border border-slate-100 text-[10px]">
                    <span className="text-slate-600 font-medium">
                      👥 <strong className="text-slate-800">{totalArrivals}</strong> atletas
                    </span>
                    <span className="text-slate-600 font-medium">
                      ⚽ <strong className="text-blue-700">{totalGoals}</strong> gols
                    </span>
                    <span className="text-slate-600 font-medium">
                      🟨 <strong>{s.yellowCards.length}</strong> · 🟦 <strong>{s.blueCards.length}</strong>{s.redCards && s.redCards.length > 0 ? <> · 🟥 <strong>{s.redCards.length}</strong></> : null}
                    </span>
                  </div>
                </div>
              );
            })}

          {/* Jogos Oficiais Cadastrados (quando houver jogos oficiais) */}
          {(() => {
            const filteredMatches = matches.filter((m) => {
              if (sumulaStatusFilter === 'em_andamento') {
                return (
                  m.status === 'escalacao_confirmada' ||
                  m.status === 'aguardando_confirmacoes' ||
                  m.status === 'contestada'
                );
              }
              if (sumulaStatusFilter === 'agendadas') {
                return m.status === 'rascunho';
              }
              if (sumulaStatusFilter === 'validadas') {
                return m.status === 'validada';
              }
              return true;
            });

            if (filteredMatches.length === 0 && sumulaStatusFilter === 'agendadas') {
              return (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                  <p className="text-xs font-bold text-slate-600">
                    Nenhum jogo oficial agendado no momento.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Os jogos oficiais agendados entre times aparecerão aqui.
                  </p>
                </div>
              );
            }

            return filteredMatches.map((m) => {
              const res = matchResults.find(
                (r) => r.id === m.activeResultVersionId
              );
              const statusBadge = getMatchStatusBadge(m.status);

              return (
                <div
                  key={m.id}
                  className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-500">
                      📍 {m.venueName} · {m.format} (Jogo Oficial)
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${statusBadge.cls}`}
                    >
                      {statusBadge.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 p-3">
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[130px]">
                      {m.homeTeamName}
                    </span>

                    <span className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-1 font-mono text-sm font-black text-white shadow-xs">
                      {m.status === 'validada'
                        ? `${m.officialHomeScore} : ${m.officialAwayScore}`
                        : res
                        ? `${res.homeScore} : ${res.awayScore}`
                        : '- : -'}
                    </span>

                    <span className="text-xs font-bold text-slate-900 truncate max-w-[130px] text-right">
                      {m.awayTeamName}
                    </span>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Modal Popup de Confirmação: Tem certeza? */}
      {sumulaToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900">
                  Tem certeza?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Deseja realmente excluir a súmula de{' '}
                  <span className="font-bold text-slate-800">
                    {sumulaToDelete.matchDate || 'data não informada'}
                  </span>
                  ? Essa ação é permanente e não poderá ser desfeita.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSumulaToDelete(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteSumulaFromList(sumulaToDelete.id);
                  setSumulaToDelete(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-red-700 active:scale-95 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Aviso: Súmula em Andamento Bloqueada para Jogadores */}
      {blockedSumulaNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Lock className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900">
                  Súmula em Andamento
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {blockedSumulaNotice}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBlockedSumulaNotice(null)}
                className="w-full rounded-xl bg-blue-700 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-800 active:scale-95 transition"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
