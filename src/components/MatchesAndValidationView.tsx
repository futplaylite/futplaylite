import React, { useState, useMemo, useEffect } from 'react';
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
  X,
  Swords,
  CheckCircle2,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { getMatchStatusBadge } from './DashboardView';
import { DisputeReasonCode, MatchFormat } from '../types/league';
import { SumulaPeladaView, getStoredSumulas, deleteSumulaFromList, SumulaData } from './SumulaPeladaView';
import { SumulaOficialView } from './SumulaOficialView';
import { TeamCrestBadge } from './TeamCrestBadge';

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

  // Categoria de Partida: 'treino' (via Súmula) ou 'oficial' (Time vs Time cadastrado)
  const [matchCategory, setMatchCategory] = useState<'treino' | 'oficial'>('treino');
  const [showCreateOfficialModal, setShowCreateOfficialModal] = useState<boolean>(false);
  const [officialMatchSuccessToast, setOfficialMatchSuccessToast] = useState<string | null>(null);

  // Campos para agendamento de novo Jogo Oficial
  const [newOfficialHomeTeam, setNewOfficialHomeTeam] = useState<string>(
    currentUser.teamName || 'Real Planalto FC'
  );
  const [newOfficialAwayTeam, setNewOfficialAwayTeam] = useState<string>('Unidos da Vila');
  const [newOfficialDate, setNewOfficialDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [newOfficialTime, setNewOfficialTime] = useState<string>('20:00');
  const [newOfficialVenue, setNewOfficialVenue] = useState<string>('Arena Planalto Society');
  const [newOfficialFormat, setNewOfficialFormat] = useState<MatchFormat>('7v7');

  // Lista consolidada de times cadastrados no app
  const allRegisteredTeamNames = useMemo(() => {
    const set = new Set<string>([
      'Real Planalto FC',
      'Unidos da Vila',
      'Falcões do Sudoeste',
      'Areia de Ouro Planalto',
      'Barcelona do Bairro',
      'Chelsea Planalto',
      'Boleiros de Ouro',
      'Rosália EC',
    ]);
    profiles.forEach((p) => {
      if (p.teamName) set.add(p.teamName);
    });
    matches.forEach((m) => {
      if (m.homeTeamName) set.add(m.homeTeamName);
      if (m.awayTeamName) set.add(m.awayTeamName);
    });
    return Array.from(set);
  }, [profiles, matches]);

  const getTeamCrest = (teamName: string) => {
    const p = profiles.find((prof) => prof.teamName === teamName && prof.teamCrestUrl);
    return p?.teamCrestUrl;
  };

  const handleScheduleOfficialMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOfficialHomeTeam || !newOfficialAwayTeam) return;
    if (newOfficialHomeTeam === newOfficialAwayTeam) {
      alert('Selecione dois times diferentes para o confronto!');
      return;
    }

    const scheduledIso = `${newOfficialDate}T${newOfficialTime}:00Z`;

    const homePlayers = profiles
      .filter((p) => p.teamName === newOfficialHomeTeam)
      .map((p) => p.id);
    const awayPlayers = profiles
      .filter((p) => p.teamName === newOfficialAwayTeam)
      .map((p) => p.id);

    createCommunityMatch({
      venueName: newOfficialVenue,
      neighborhood: 'Planalto - BA',
      scheduledAt: scheduledIso,
      format: newOfficialFormat,
      homeTeamName: newOfficialHomeTeam,
      awayTeamName: newOfficialAwayTeam,
      homePlayerIds: homePlayers.length > 0 ? homePlayers : ['player-henrique'],
      awayPlayerIds: awayPlayers.length > 0 ? awayPlayers : ['player-melquiz'],
      homeCaptainId: homePlayers[0] || 'player-henrique',
      awayCaptainId: awayPlayers[0] || 'player-melquiz',
    });

    setShowCreateOfficialModal(false);
    setMatchCategory('oficial');
    setOfficialMatchSuccessToast(
      `Jogo oficial marcado: ${newOfficialHomeTeam} vs ${newOfficialAwayTeam}!`
    );
    setTimeout(() => setOfficialMatchSuccessToast(null), 3500);
  };

  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    initialMatchId || matches[1]?.id || matches[0]?.id
  );
  const [activeSumulaView, setActiveSumulaView] = useState<
    'none' | 'pelada' | 'oficial'
  >('none');
  const [selectedSumulaId, setSelectedSumulaId] = useState<string | undefined>();
  const [isCreatingNewSumula, setIsCreatingNewSumula] = useState<boolean>(false);
  const [blockedSumulaNotice, setBlockedSumulaNotice] = useState<string | null>(null);
  const [sumulaToDelete, setSumulaToDelete] = useState<SumulaData | null>(null);

  const [sumulasVersion, setSumulasVersion] = useState<number>(0);

  useEffect(() => {
    const handleSumulasChanged = () => {
      setSumulasVersion((v) => v + 1);
    };
    window.addEventListener('futplay_sumulas_changed', handleSumulasChanged);
    return () => {
      window.removeEventListener('futplay_sumulas_changed', handleSumulasChanged);
    };
  }, []);

  const allSavedSumulas: SumulaData[] = useMemo(() => {
    return getStoredSumulas();
  }, [sumulasVersion]);

  const userTeam = (
    currentUser.teamName ||
    currentPlayerProfile?.teamName ||
    ''
  ).trim().toLowerCase();

  const isAdmin = currentUser.role === 'admin';

  // Cada jogador e treinador vê apenas as súmulas do seu time; administrador vê todas
  const visibleSumulas = useMemo(() => {
    return allSavedSumulas.filter((s) => {
      if (isAdmin) return true;
      const sTeam = (s.teamName || '').trim().toLowerCase();
      if (sTeam && userTeam) {
        if (sTeam === userTeam) return true;
      }
      if (s.createdByUserId && s.createdByUserId === currentUser.id) return true;
      const myNameUpper = (currentPlayerProfile?.displayName || '').trim().toUpperCase();
      if (myNameUpper && s.arrivalList?.some((a) => a.playerName.trim().toUpperCase() === myNameUpper)) {
        return true;
      }
      if (!sTeam && userTeam === 'real planalto fc') return true;
      return false;
    });
  }, [allSavedSumulas, isAdmin, userTeam, currentUser.id, currentPlayerProfile?.displayName]);

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

  const playersInMatch = selectedMatch
    ? matchPlayers.filter((mp) => mp.matchId === selectedMatch.id)
    : [];
  const homeLineup = playersInMatch.filter((mp) => mp.teamSide === 'home');
  const awayLineup = playersInMatch.filter((mp) => mp.teamSide === 'away');

  const versionsForMatch = selectedMatch
    ? matchResults
        .filter((r) => r.matchId === selectedMatch.id)
        .sort((a, b) => b.versionNumber - a.versionNumber)
    : [];

  const activeResultVersion = selectedMatch
    ? versionsForMatch.find(
        (r) => r.id === selectedMatch.activeResultVersionId
      )
    : undefined;

  const eventsForActiveVersion = matchEvents.filter(
    (e) => e.resultVersionId === activeResultVersion?.id
  );

  const evidencesForMatch = selectedMatch
    ? evidenceFiles.filter((ev) => ev.matchId === selectedMatch.id)
    : [];

  const txForMatch = selectedMatch
    ? pointTransactions.filter((pt) => pt.matchId === selectedMatch.id)
    : [];

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
    if (!selectedMatch) return;
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
    if (!selectedMatch) return;
    contestMatchResult({
      matchId: selectedMatch.id,
      reasonCode: disputeReason,
      description: disputeDesc,
    });
    setShowContestBox(false);
  };

  const awayCaptainProfile = selectedMatch?.awayCaptainId
    ? profiles.find((p) => p.id === selectedMatch.awayCaptainId)
    : undefined;

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

  // Se o usuário clicou na Súmula de Jogo Oficial (Time vs Time)
  if (activeSumulaView === 'oficial' && selectedMatchId) {
    return (
      <SumulaOficialView
        matchId={selectedMatchId}
        onBack={() => {
          setActiveSumulaView('none');
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Toast de sucesso ao marcar jogo oficial */}
      {officialMatchSuccessToast && (
        <div className="rounded-xl bg-emerald-500/20 border border-emerald-400/40 p-2.5 text-center text-xs font-bold text-emerald-200 animate-in fade-in flex items-center justify-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{officialMatchSuccessToast}</span>
        </div>
      )}

      {/* SELETOR EM FORMATO DE CARDS: APENAS TREINOS E JOGOS OFICIAIS */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* CARD 1: TREINOS (SÚMULA) */}
        <button
          type="button"
          onClick={() => setMatchCategory('treino')}
          className={`p-3 rounded-2xl border text-left transition active:scale-[0.98] cursor-pointer flex flex-col justify-between relative overflow-hidden ${
            matchCategory === 'treino'
              ? 'bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 border-blue-400 text-white shadow-md ring-2 ring-blue-500/30'
              : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div
              className={`p-2 rounded-xl ${
                matchCategory === 'treino'
                  ? 'bg-white/20 text-white'
                  : 'bg-blue-50 text-blue-700 border border-blue-100'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
            </div>
            <span
              className={`text-[10px] font-black uppercase rounded-full px-2 py-0.5 ${
                matchCategory === 'treino'
                  ? 'bg-white/25 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {visibleSumulas.length} súmulas
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h3
                className={`text-xs font-black uppercase tracking-tight ${
                  matchCategory === 'treino' ? 'text-white' : 'text-slate-900'
                }`}
              >
                Treinos
              </h3>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                  matchCategory === 'treino'
                    ? 'bg-blue-500/40 text-blue-200'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                Súmula
              </span>
            </div>
            <p
              className={`text-[10px] mt-1 leading-snug ${
                matchCategory === 'treino' ? 'text-blue-100' : 'text-slate-500'
              }`}
            >
              Peladas semanais e treinos gerenciados via Súmula Digital
            </p>
          </div>
        </button>

        {/* CARD 2: JOGOS OFICIAIS */}
        <button
          type="button"
          onClick={() => setMatchCategory('oficial')}
          className={`p-3 rounded-2xl border text-left transition active:scale-[0.98] cursor-pointer flex flex-col justify-between relative overflow-hidden ${
            matchCategory === 'oficial'
              ? 'bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 border-amber-300 text-white shadow-md ring-2 ring-amber-400/30'
              : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div
              className={`p-2 rounded-xl ${
                matchCategory === 'oficial'
                  ? 'bg-white/25 text-white'
                  : 'bg-amber-50 text-amber-700 border border-amber-100'
              }`}
            >
              <Trophy className="h-4 w-4" />
            </div>
            <span
              className={`text-[10px] font-black uppercase rounded-full px-2 py-0.5 ${
                matchCategory === 'oficial'
                  ? 'bg-white/25 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {matches.length} jogos
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h3
                className={`text-xs font-black uppercase tracking-tight ${
                  matchCategory === 'oficial' ? 'text-white' : 'text-slate-900'
                }`}
              >
                Jogos Oficiais
              </h3>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                  matchCategory === 'oficial'
                    ? 'bg-amber-400/40 text-amber-100'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                Liga
              </span>
            </div>
            <p
              className={`text-[10px] mt-1 leading-snug ${
                matchCategory === 'oficial' ? 'text-amber-100' : 'text-slate-500'
              }`}
            >
              Disputa Time vs Time cadastrado no app
            </p>
          </div>
        </button>
      </div>

      {/* Card Principal: Lista de Partidas e Súmulas */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm space-y-2.5">
        {/* LISTA DE PARTIDAS */}
        <div className="space-y-2.5 pt-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>
              {matchCategory === 'treino'
                ? 'Súmulas de Treinos & Peladas'
                : 'Jogos Oficiais entre Times Cadastrados'}
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              {matchCategory === 'treino'
                ? `${visibleSumulas.length} súmula(s)`
                : `${matches.length} jogo(s)`}
            </span>
          </div>

          {/* 1. SEÇÃO DE TREINOS (VIA SÚMULA) */}
          {matchCategory === 'treino' &&
            (() => {
              const parseDateHelper = (d?: string) => {
                if (!d) return 0;
                const parts = d.split('/');
                if (parts.length === 3) {
                  return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
                }
                const t = Date.parse(d);
                return isNaN(t) ? 0 : t;
              };

              const filteredSumulas = visibleSumulas
                .slice()
                .sort((a, b) => {
                  const tA = parseDateHelper(a.matchDate) || (a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0);
                  const tB = parseDateHelper(b.matchDate) || (b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0);
                  return tB - tA;
                });

              return (
                <div className="space-y-2.5">
                  {/* Botão de Criação de Súmula no INÍCIO da lista */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNewSumula(true);
                      setSelectedSumulaId(undefined);
                      setActiveSumulaView('pelada');
                    }}
                    className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/60 hover:bg-blue-50 text-blue-700 font-black text-xs flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs active:scale-[0.99] transition cursor-pointer mb-1"
                    title="Abrir nova súmula de treino"
                  >
                    <PlusCircle className="h-4 w-4 text-blue-600" />
                    <span>Nova Súmula</span>
                  </button>

                  {filteredSumulas.map((s, idx) => {
                    const totalGoals = Object.values(s.teamLineups || {}).reduce(
                      (sum, team) =>
                        sum +
                        (team || []).reduce(
                          (tSum, p) => tSum + (Number(p.goals) || 0),
                          0
                        ),
                      0
                    );
                    const totalArrivals = (s.arrivalList || []).filter(
                      (a) => a.confirmed
                    ).length;

                    return (
                      <div
                        key={s.id || idx}
                        onClick={() => {
                          setSelectedSumulaId(s.id);
                          setIsCreatingNewSumula(false);
                          setActiveSumulaView('pelada');
                        }}
                        className="cursor-pointer rounded-xl bg-gradient-to-r from-blue-50/70 to-slate-50 border border-blue-200/80 p-2.5 hover:border-blue-400 hover:shadow-xs transition space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="rounded bg-blue-100 text-blue-800 border border-blue-200 px-1.5 py-0.2 text-[8px] font-black uppercase flex items-center gap-0.5">
                              <ClipboardList className="h-2.5 w-2.5" />
                              Treino
                            </span>
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
                              Abrir Súmula →
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

                  {filteredSumulas.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center space-y-3">
                      <ClipboardList className="mx-auto h-8 w-8 text-blue-400" />
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Nenhuma súmula ativa no momento.
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Toque abaixo para abrir e preencher a súmula da rodada.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNewSumula(true);
                          setSelectedSumulaId(undefined);
                          setActiveSumulaView('pelada');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition cursor-pointer"
                      >
                        <PlusCircle className="h-4 w-4" />
                        <span>Abrir Nova Súmula</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 2. SEÇÃO DE JOGOS OFICIAIS (TIME VS TIME CADASTRADO NO APP) */}
            {matchCategory === 'oficial' &&
              (() => {
                const parseDateHelper = (d?: string) => {
                  if (!d) return 0;
                  const parts = d.split('/');
                  if (parts.length === 3) {
                    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
                  }
                  const t = Date.parse(d);
                  return isNaN(t) ? 0 : t;
                };

                const filteredMatches = matches
                  .slice()
                  .sort((a, b) => {
                    const tA = parseDateHelper(a.scheduledAt) || (a.startedAt ? parseDateHelper(a.startedAt) : 0);
                    const tB = parseDateHelper(b.scheduledAt) || (b.startedAt ? parseDateHelper(b.startedAt) : 0);
                    return tA - tB;
                  });

                return (
                  <div className="space-y-2.5">
                    {/* Botão de Criação de Jogo Oficial no INÍCIO da lista */}
                    {isCoachOrAdmin && (
                      <button
                        type="button"
                        onClick={() => setShowCreateOfficialModal(true)}
                        className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/60 hover:bg-amber-50 text-amber-900 font-black text-xs flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs active:scale-[0.99] transition cursor-pointer mb-1"
                        title="Marcar novo confronto oficial"
                      >
                        <Trophy className="h-4 w-4 text-amber-600" />
                        <span>Marcar Novo Jogo Oficial</span>
                      </button>
                    )}

                    {filteredMatches.map((m) => {
                      const res = matchResults.find(
                        (r) => r.id === m.activeResultVersionId
                      );
                      const statusBadge = getMatchStatusBadge(m.status);

                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            setSelectedMatchId(m.id);
                            setActiveSumulaView('oficial');
                          }}
                          className="cursor-pointer rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-3 shadow-xs space-y-2 hover:border-blue-400 hover:shadow-sm transition active:scale-[0.99]"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="rounded bg-amber-100 text-amber-900 border border-amber-300/40 px-1.5 py-0.2 text-[8px] font-black uppercase flex items-center gap-0.5">
                                <Trophy className="h-2.5 w-2.5 text-amber-700" />
                                Jogo Oficial
                              </span>
                              <span className="font-semibold text-slate-500 truncate text-[11px]">
                                📍 {m.venueName} · {m.format}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${statusBadge.cls}`}
                              >
                                {statusBadge.label}
                              </span>
                              <span className="text-[11px] font-black text-blue-600 flex items-center">
                                Súmula →
                              </span>
                            </div>
                          </div>

                          {/* Confronto Time A vs Time B com Brasões */}
                          <div className="flex items-center justify-between rounded-xl bg-white border border-slate-200/80 p-2.5 shadow-2xs">
                            {/* Time Mandante */}
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <TeamCrestBadge
                                name={m.homeTeamName}
                                crestUrl={getTeamCrest(m.homeTeamName)}
                                size={32}
                              />
                              <span className="text-xs font-black text-slate-900 truncate uppercase">
                                {m.homeTeamName}
                              </span>
                            </div>

                            {/* Placar Oficial ou 'VS' */}
                            <div className="shrink-0 px-3">
                              <span className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-3 py-1 font-mono text-sm font-black text-white shadow-xs">
                                {m.status === 'validada'
                                  ? `${m.officialHomeScore ?? 0} : ${m.officialAwayScore ?? 0}`
                                  : res
                                  ? `${res.homeScore} : ${res.awayScore}`
                                  : 'VS'}
                              </span>
                            </div>

                            {/* Time Visitante */}
                            <div className="flex items-center justify-end gap-2 min-w-0 flex-1 text-right">
                              <span className="text-xs font-black text-slate-900 truncate uppercase">
                                {m.awayTeamName}
                              </span>
                              <TeamCrestBadge
                                name={m.awayTeamName}
                                crestUrl={getTeamCrest(m.awayTeamName)}
                                size={32}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {filteredMatches.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                        <Trophy className="mx-auto h-8 w-8 text-slate-300" />
                        <p className="text-xs font-bold text-slate-700 mt-2">
                          Nenhum jogo oficial encontrado neste filtro.
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Confrontos oficiais entre times cadastrados aparecem aqui.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
          </div>
        </div>

      {/* Modal: Agendar Novo Jogo Oficial (Time vs Time) */}
      {showCreateOfficialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                    Marcar Jogo Oficial
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Confronto entre dois times cadastrados na liga
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateOfficialModal(false)}
                className="rounded-full bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleScheduleOfficialMatch} className="space-y-3">
              {/* Seleção do Time Mandante */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Time Mandante (Casa)
                </label>
                <select
                  value={newOfficialHomeTeam}
                  onChange={(e) => setNewOfficialHomeTeam(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  {allRegisteredTeamNames.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </div>

              {/* Seleção do Time Visitante */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Time Visitante (Fora)
                </label>
                <select
                  value={newOfficialAwayTeam}
                  onChange={(e) => setNewOfficialAwayTeam(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  {allRegisteredTeamNames
                    .filter((t) => t !== newOfficialHomeTeam)
                    .map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                </select>
              </div>

              {/* Grid Data e Horário */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Data do Jogo
                  </label>
                  <input
                    type="date"
                    value={newOfficialDate}
                    onChange={(e) => setNewOfficialDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Horário
                  </label>
                  <input
                    type="time"
                    value={newOfficialTime}
                    onChange={(e) => setNewOfficialTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Local e Formato */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Local / Arena
                  </label>
                  <input
                    type="text"
                    value={newOfficialVenue}
                    onChange={(e) => setNewOfficialVenue(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                    placeholder="Ex: Arena Planalto"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Formato
                  </label>
                  <select
                    value={newOfficialFormat}
                    onChange={(e) => setNewOfficialFormat(e.target.value as MatchFormat)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="7v7">Society (7v7)</option>
                    <option value="5v5">Futsal (5v5)</option>
                    <option value="6v6">Society (6v6)</option>
                    <option value="11v11">Campo (11v11)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateOfficialModal(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-800 active:scale-95 transition"
                >
                  <Trophy className="h-3.5 w-3.5 text-amber-300" />
                  Confirmar Jogo Oficial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  setSumulasVersion((v) => v + 1);
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
