import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Handshake,
  MapPin,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Shield,
  Star,
  Swords,
  Trophy,
  UserCheck,
  Users,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { Match, MatchFormat, DisputeReasonCode } from '../types/league';
import { TeamCrestBadge } from './TeamCrestBadge';
import { getMatchStatusBadge } from './DashboardView';

interface SumulaOficialViewProps {
  matchId: string;
  onBack: () => void;
}

interface LocalEventItem {
  id: string;
  minute?: number;
  playerId: string;
  playerName: string;
  teamSide: 'home' | 'away';
  type: 'gol' | 'cartao_amarelo' | 'cartao_azul' | 'cartao_vermelho' | 'defesa_dificil';
}

export const SumulaOficialView: React.FC<SumulaOficialViewProps> = ({
  matchId,
  onBack,
}) => {
  const {
    matches,
    matchPlayers,
    matchResults,
    matchEvents,
    profiles,
    currentUser,
    submitMatchScoreAndEvents,
    confirmMatchResult,
    contestMatchResult,
  } = useLeague();

  const match = matches.find((m) => m.id === matchId) || matches[0];
  const activeResult = matchResults.find((r) => r.id === match?.activeResultVersionId);

  // Placar local
  const [homeScore, setHomeScore] = useState<number>(() => {
    return match?.officialHomeScore ?? activeResult?.homeScore ?? 0;
  });
  const [awayScore, setAwayScore] = useState<number>(() => {
    return match?.officialAwayScore ?? activeResult?.awayScore ?? 0;
  });

  // Cronômetro do Jogo Oficial
  const [gamePeriod, setGamePeriod] = useState<'pre' | '1T' | 'intervalo' | '2T' | 'fim'>(() => {
    if (match?.status === 'validada') return 'fim';
    if (match?.status === 'aguardando_confirmacoes') return 'fim';
    if (match?.status === 'em_andamento') return '1T';
    return 'pre';
  });
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setElapsedMinutes((prev) => prev + 1);
      }, 60000); // 1 minuto real (ou pode avançar manual)
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  // Aba ativa: elenco mandante, elenco visitante ou linha do tempo
  const [activeTab, setActiveTab] = useState<'home' | 'away' | 'timeline'>('home');

  // MVP e Destaque
  const [selectedMvpId, setSelectedMvpId] = useState<string>(() => {
    return activeResult?.mvpPlayerId || '';
  });
  const [selectedGkCapaId, setSelectedGkCapaId] = useState<string>('');

  // Eventos locais de gols e cartões
  const [eventsList, setEventsList] = useState<LocalEventItem[]>(() => {
    // Inicializa a partir de eventos salvos se existirem
    const list: LocalEventItem[] = [];
    if (activeResult) {
      const matchEvs = matchEvents.filter((e) => e.resultVersionId === activeResult.id);
      matchEvs.forEach((ev) => {
        const p = profiles.find((prof) => prof.id === ev.playerId);
        const mp = matchPlayers.find((mPlayer) => mPlayer.playerId === ev.playerId && mPlayer.matchId === matchId);
        const side = mp?.teamSide || 'home';
        if (ev.eventType === 'gol') {
          list.push({
            id: ev.id,
            playerId: ev.playerId,
            playerName: p?.displayName || 'Jogador',
            teamSide: side,
            type: 'gol',
            minute: ev.eventMinute,
          });
        } else if (ev.eventType === 'cartao_amarelo') {
          list.push({
            id: ev.id,
            playerId: ev.playerId,
            playerName: p?.displayName || 'Jogador',
            teamSide: side,
            type: 'cartao_amarelo',
            minute: ev.eventMinute,
          });
        } else if (ev.eventType === 'cartao_azul') {
          list.push({
            id: ev.id,
            playerId: ev.playerId,
            playerName: p?.displayName || 'Jogador',
            teamSide: side,
            type: 'cartao_azul',
            minute: ev.eventMinute,
          });
        } else if (ev.eventType === 'cartao_vermelho') {
          list.push({
            id: ev.id,
            playerId: ev.playerId,
            playerName: p?.displayName || 'Jogador',
            teamSide: side,
            type: 'cartao_vermelho',
            minute: ev.eventMinute,
          });
        }
      });
    }
    return list;
  });

  // Modal de contestação
  const [showContestModal, setShowContestModal] = useState<boolean>(false);
  const [contestReason, setContestReason] = useState<DisputeReasonCode>('placar_incorreto');
  const [contestDescription, setContestDescription] = useState<string>('Divergência no placar ou gols anotados.');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Elencos dos Dois Clubes
  const homeRoster = useMemo(() => {
    const list = profiles.filter((p) => p.teamName === match?.homeTeamName);
    if (list.length > 0) return list;
    // Fallback: jogadores marcados em matchPlayers
    const mpIds = matchPlayers
      .filter((mp) => mp.matchId === match?.id && mp.teamSide === 'home')
      .map((mp) => mp.playerId);
    return profiles.filter((p) => mpIds.includes(p.id));
  }, [profiles, match, matchPlayers]);

  const awayRoster = useMemo(() => {
    const list = profiles.filter((p) => p.teamName === match?.awayTeamName);
    if (list.length > 0) return list;
    // Fallback: jogadores marcados em matchPlayers
    const mpIds = matchPlayers
      .filter((mp) => mp.matchId === match?.id && mp.teamSide === 'away')
      .map((mp) => mp.playerId);
    return profiles.filter((p) => mpIds.includes(p.id));
  }, [profiles, match, matchPlayers]);

  const getTeamCrest = (teamName: string) => {
    const p = profiles.find((prof) => prof.teamName === teamName && prof.teamCrestUrl);
    return p?.teamCrestUrl;
  };

  // Contagem de gols e cartões por jogador
  const playerGoalsCount = (playerId: string) =>
    eventsList.filter((e) => e.playerId === playerId && e.type === 'gol').length;

  const playerHasYellow = (playerId: string) =>
    eventsList.some((e) => e.playerId === playerId && e.type === 'cartao_amarelo');

  const playerHasBlue = (playerId: string) =>
    eventsList.some((e) => e.playerId === playerId && e.type === 'cartao_azul');

  const playerHasRed = (playerId: string) =>
    eventsList.some((e) => e.playerId === playerId && e.type === 'cartao_vermelho');

  // Adicionar Gol
  const handleAddGoal = (playerId: string, playerName: string, side: 'home' | 'away') => {
    const newEv: LocalEventItem = {
      id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      playerId,
      playerName,
      teamSide: side,
      type: 'gol',
      minute: elapsedMinutes > 0 ? elapsedMinutes : undefined,
    };
    setEventsList((prev) => [newEv, ...prev]);
    if (side === 'home') {
      setHomeScore((s) => s + 1);
    } else {
      setAwayScore((s) => s + 1);
    }
    showToast(`⚽ Gol de ${playerName}!`);
  };

  // Remover Gol
  const handleRemoveGoal = (playerId: string, side: 'home' | 'away') => {
    const idx = eventsList.findIndex((e) => e.playerId === playerId && e.type === 'gol');
    if (idx === -1) return;
    const copy = [...eventsList];
    copy.splice(idx, 1);
    setEventsList(copy);
    if (side === 'home') {
      setHomeScore((s) => Math.max(0, s - 1));
    } else {
      setAwayScore((s) => Math.max(0, s - 1));
    }
  };

  // Alternar Cartão
  const handleToggleCard = (
    playerId: string,
    playerName: string,
    side: 'home' | 'away',
    cardType: 'cartao_amarelo' | 'cartao_azul' | 'cartao_vermelho'
  ) => {
    const exists = eventsList.some((e) => e.playerId === playerId && e.type === cardType);
    if (exists) {
      setEventsList((prev) => prev.filter((e) => !(e.playerId === playerId && e.type === cardType)));
    } else {
      const newEv: LocalEventItem = {
        id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        playerId,
        playerName,
        teamSide: side,
        type: cardType,
        minute: elapsedMinutes > 0 ? elapsedMinutes : undefined,
      };
      setEventsList((prev) => [newEv, ...prev]);
      const cardLabel =
        cardType === 'cartao_amarelo' ? '🟨 Amarelo' : cardType === 'cartao_azul' ? '🟦 Azul' : '🟥 Vermelho';
      showToast(`${cardLabel} para ${playerName}`);
    }
  };

  // Enviar Súmula para Validação
  const handleFinalizeAndSubmit = () => {
    if (!match) return;

    const goalScorerIds: string[] = [];
    const yellowCardPlayerIds: string[] = [];
    const blueCardPlayerIds: string[] = [];

    eventsList.forEach((e) => {
      if (e.type === 'gol') goalScorerIds.push(e.playerId);
      if (e.type === 'cartao_amarelo') yellowCardPlayerIds.push(e.playerId);
      if (e.type === 'cartao_azul') blueCardPlayerIds.push(e.playerId);
    });

    const success = submitMatchScoreAndEvents({
      matchId: match.id,
      homeScore,
      awayScore,
      mvpPlayerId: selectedMvpId || undefined,
      goalkeeperCapaPlayerId: selectedGkCapaId || undefined,
      goalScorerIds,
      assistPlayerIds: [],
      yellowCardPlayerIds,
      blueCardPlayerIds,
      evidenceTitle: `Súmula Oficial: ${match.homeTeamName} vs ${match.awayTeamName}`,
    });

    if (success) {
      setGamePeriod('fim');
      showToast('Súmula enviada com sucesso! Aguardando validação cruzada.');
    } else {
      alert('Erro ao enviar súmula.');
    }
  };

  // Confirmar Súmula (Capitão adversário ou Admin)
  const handleConfirmResult = () => {
    if (!match) return;
    const ok = confirmMatchResult(match.id, 'Súmula conferida e aprovada pelo capitão.');
    if (ok) {
      showToast('✓ Partida validada oficialmente! Pontos e gols computados na liga.');
    }
  };

  // Contestar Súmula
  const handleContestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!match) return;
    contestMatchResult({
      matchId: match.id,
      reasonCode: contestReason,
      description: contestDescription,
    });
    setShowContestModal(false);
    showToast('⚠️ Contestação enviada para análise da moderação da liga.');
  };

  if (!match) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-slate-500">Partida não encontrada.</p>
        <button
          onClick={onBack}
          className="mt-2 text-xs font-bold text-blue-600 hover:underline"
        >
          Voltar
        </button>
      </div>
    );
  }

  const statusBadge = getMatchStatusBadge(match.status);
  const isMatchValidated = match.status === 'validada';
  const isAwaitingConfirmation = match.status === 'aguardando_confirmacoes';
  const isContested = match.status === 'contestada';

  return (
    <div className="space-y-3.5 pb-10">
      {/* Toast flutuante */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 rounded-full bg-slate-900/90 text-white px-4 py-2 text-xs font-bold shadow-xl border border-white/20 animate-in fade-in flex items-center gap-1.5 backdrop-blur-sm">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Barra Superior de Navegação */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-black text-slate-700 hover:text-blue-800 transition py-1"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar para Partidas</span>
        </button>

        <span
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusBadge.cls}`}
        >
          {statusBadge.label}
        </span>
      </div>

      {/* HERO CARD: PLACAR OFICIAL & ESTÁDIO */}
      <div className="relative rounded-2xl border border-blue-400/40 bg-gradient-to-b from-blue-700 via-blue-800 to-indigo-950 p-4 text-white shadow-lg overflow-hidden">
        {/* Imagem de Fundo Oficial do Estádio com Refletores */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-80"
          style={{
            backgroundImage: "url('/images/stadium-super-capas.jpg')",
          }}
        />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#0a1435]/75 via-[#07112c]/85 to-[#030612]/92 pointer-events-none" />

        {/* Topo do Card Oficial */}
        <div className="relative z-10 flex items-center justify-between pb-2 border-b border-white/15 text-[11px] font-semibold text-blue-200">
          <div className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-amber-300" />
            <span className="font-bold text-white uppercase tracking-wider">
              Súmula de Jogo Oficial
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-300">
            <MapPin className="h-3 w-3 text-amber-300" />
            <span>{match.venueName} · {match.format}</span>
          </div>
        </div>

        {/* DUELO CENTRAL DOS CLUBES COM OS ESCUDOS */}
        <div className="relative z-10 my-3 flex items-center justify-between gap-2">
          {/* Time Mandante */}
          <div className="flex flex-col items-center text-center flex-1 min-w-0">
            <TeamCrestBadge
              name={match.homeTeamName}
              crestUrl={getTeamCrest(match.homeTeamName)}
              size={56}
              className="drop-shadow-md"
            />
            <h2 className="mt-1.5 text-xs sm:text-sm font-black text-white uppercase truncate w-full" title={match.homeTeamName}>
              {match.homeTeamName}
            </h2>
            <span className="text-[9px] font-bold text-blue-300 uppercase">Mandante</span>
          </div>

          {/* Placar Central com Controles */}
          <div className="flex flex-col items-center justify-center shrink-0 px-2">
            <div className="flex items-center gap-2">
              {/* Botões do Mandante */}
              {!isMatchValidated && (
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => setHomeScore((s) => s + 1)}
                    className="h-5 w-5 rounded bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xs font-bold transition"
                    title="Adicionar Gol Mandante"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setHomeScore((s) => Math.max(0, s - 1))}
                    className="h-5 w-5 rounded bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center text-xs font-bold transition"
                    title="Diminuir Gol Mandante"
                  >
                    -
                  </button>
                </div>
              )}

              {/* Caixa do Placar */}
              <div className="flex items-center gap-1.5 rounded-xl bg-black/45 border border-white/20 px-3.5 py-1.5 backdrop-blur-md shadow-inner">
                <span className="font-mono text-2xl sm:text-3xl font-black text-white">
                  {homeScore}
                </span>
                <span className="font-black text-amber-300 text-lg">:</span>
                <span className="font-mono text-2xl sm:text-3xl font-black text-white">
                  {awayScore}
                </span>
              </div>

              {/* Botões do Visitante */}
              {!isMatchValidated && (
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => setAwayScore((s) => s + 1)}
                    className="h-5 w-5 rounded bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xs font-bold transition"
                    title="Adicionar Gol Visitante"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setAwayScore((s) => Math.max(0, s - 1))}
                    className="h-5 w-5 rounded bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center text-xs font-bold transition"
                    title="Diminuir Gol Visitante"
                  >
                    -
                  </button>
                </div>
              )}
            </div>

            {/* Tempo / Status de Jogo */}
            <div className="mt-2 flex items-center gap-1.5">
              <span className="rounded-full bg-amber-400/25 border border-amber-300/40 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-200">
                {gamePeriod === 'pre'
                  ? 'A Iniciar'
                  : gamePeriod === '1T'
                  ? `1º Tempo · ${elapsedMinutes}'`
                  : gamePeriod === 'intervalo'
                  ? 'Intervalo'
                  : gamePeriod === '2T'
                  ? `2º Tempo · ${elapsedMinutes}'`
                  : 'Fim de Jogo'}
              </span>

              {/* Botão de Iniciar Cronômetro */}
              {gamePeriod !== 'fim' && !isMatchValidated && (
                <button
                  type="button"
                  onClick={() => setIsTimerRunning((r) => !r)}
                  className="rounded-full bg-white/15 hover:bg-white/25 p-1 text-white transition"
                  title={isTimerRunning ? 'Pausar tempo' : 'Iniciar tempo'}
                >
                  <Play className={`h-3 w-3 ${isTimerRunning ? 'text-emerald-400 fill-emerald-400' : ''}`} />
                </button>
              )}
            </div>
          </div>

          {/* Time Visitante */}
          <div className="flex flex-col items-center text-center flex-1 min-w-0">
            <TeamCrestBadge
              name={match.awayTeamName}
              crestUrl={getTeamCrest(match.awayTeamName)}
              size={56}
              className="drop-shadow-md"
            />
            <h2 className="mt-1.5 text-xs sm:text-sm font-black text-white uppercase truncate w-full" title={match.awayTeamName}>
              {match.awayTeamName}
            </h2>
            <span className="text-[9px] font-bold text-amber-300 uppercase">Visitante</span>
          </div>
        </div>

        {/* Rodapé Informativo */}
        <div className="relative z-10 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-blue-200">
          <span>📅 {new Date(match.scheduledAt).toLocaleDateString('pt-BR')} às {new Date(match.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="font-bold text-amber-300 uppercase">⚽ Confronto Oficial</span>
        </div>
      </div>

      {/* SELETOR DE ABAS DA SÚMULA OFICIAL */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 border border-slate-200 font-sans">
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`rounded-xl py-2 text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'home'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TeamCrestBadge name={match.homeTeamName} crestUrl={getTeamCrest(match.homeTeamName)} size={16} />
          <span className="truncate">{match.homeTeamName}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('away')}
          className={`rounded-xl py-2 text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'away'
              ? 'bg-amber-400 text-blue-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TeamCrestBadge name={match.awayTeamName} crestUrl={getTeamCrest(match.awayTeamName)} size={16} />
          <span className="truncate">{match.awayTeamName}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={`rounded-xl py-2 text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'timeline'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="h-3.5 w-3.5 text-blue-600" />
          <span>Lances ({eventsList.length})</span>
        </button>
      </div>

      {/* CONTEÚDO DA ABA SELECIONADA */}
      {activeTab === 'timeline' ? (
        /* ABA 3: LINHA DO TEMPO DOS GOLS E CARTÕES */
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue-600" />
              Linha do Tempo dos Lances Oficiais
            </h3>
            <span className="text-[10px] font-bold text-slate-400">
              {eventsList.length} registro(s)
            </span>
          </div>

          {eventsList.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Nenhum gol ou cartão registrado ainda nesta partida.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {eventsList.map((ev, idx) => {
                const isHome = ev.teamSide === 'home';
                const teamName = isHome ? match.homeTeamName : match.awayTeamName;

                return (
                  <div
                    key={ev.id || idx}
                    className="py-2.5 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-black text-slate-400 w-7">
                        {ev.minute ? `${ev.minute}'` : '⚽'}
                      </span>
                      <span className="text-base">
                        {ev.type === 'gol'
                          ? '⚽'
                          : ev.type === 'cartao_amarelo'
                          ? '🟨'
                          : ev.type === 'cartao_azul'
                          ? '🟦'
                          : ev.type === 'cartao_vermelho'
                          ? '🟥'
                          : '🧤'}
                      </span>
                      <div>
                        <strong className="font-black text-slate-900 uppercase">
                          {ev.playerName}
                        </strong>
                        <span className="text-slate-400 font-medium"> ({teamName})</span>
                      </div>
                    </div>

                    {!isMatchValidated && (
                      <button
                        type="button"
                        onClick={() => {
                          if (ev.type === 'gol') {
                            handleRemoveGoal(ev.playerId, ev.teamSide);
                          } else {
                            setEventsList((prev) => prev.filter((item) => item.id !== ev.id));
                          }
                        }}
                        className="text-slate-400 hover:text-red-600 p-1"
                        title="Remover evento"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ABAS 1 E 2: ESCALAÇÃO OFICIAL COM AÇÕES RÁPIDAS */
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                <Users className="h-4 w-4 text-blue-600" />
                Escalação Oficial: {activeTab === 'home' ? match.homeTeamName : match.awayTeamName}
              </h3>
              <p className="text-[10px] text-slate-400">
                Toque nos botões para registrar gols e cartões do atleta
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
              {activeTab === 'home' ? homeRoster.length : awayRoster.length} atletas
            </span>
          </div>

          {/* LISTA DE JOGADORES DO TIME SELECIONADO */}
          <div className="divide-y divide-slate-100">
            {(activeTab === 'home' ? homeRoster : awayRoster).map((player) => {
              const isGk = player.position === 'goleiro';
              const isCaptain = player.isTeamOwner || player.id === (activeTab === 'home' ? match.homeCaptainId : match.awayCaptainId);
              const goals = playerGoalsCount(player.id);
              const hasYellow = playerHasYellow(player.id);
              const hasBlue = playerHasBlue(player.id);
              const hasRed = playerHasRed(player.id);
              const isMvp = selectedMvpId === player.id;
              const side = activeTab;

              return (
                <div
                  key={player.id}
                  className="py-2.5 flex items-center justify-between gap-2"
                >
                  {/* Foto e Nome */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-50 border border-blue-200/80 font-display text-xs font-bold text-blue-700">
                      {player.avatarUrl ? (
                        <img
                          src={player.avatarUrl}
                          alt={player.displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        player.displayName.slice(0, 2).toUpperCase()
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-black text-slate-900 truncate uppercase">
                          {player.displayName}
                        </span>
                        {isGk && (
                          <span className="text-[9px] font-bold text-blue-700" title="Goleiro Oficial">
                            🧤
                          </span>
                        )}
                        {isCaptain && (
                          <span className="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-300 rounded px-1" title="Capitão">
                            ©
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 capitalize">
                        {player.position} · Pé {player.dominantFoot}
                      </span>
                    </div>
                  </div>

                  {/* Ações Rápidas do Atleta: Gols, Cartões e MVP */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Botão de Gol */}
                    <div className="flex items-center rounded-lg bg-slate-100 border border-slate-200 p-0.5">
                      {goals > 0 && !isMatchValidated && (
                        <button
                          type="button"
                          onClick={() => handleRemoveGoal(player.id, side)}
                          className="h-6 w-6 rounded text-slate-500 hover:text-red-600 flex items-center justify-center transition active:scale-90"
                          title="Remover 1 gol"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isMatchValidated}
                        onClick={() => handleAddGoal(player.id, player.displayName, side)}
                        className={`h-6 px-1.5 rounded flex items-center gap-1 text-[11px] font-black transition active:scale-95 ${
                          goals > 0
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-slate-200'
                        }`}
                        title="Marcar gol"
                      >
                        <span>⚽</span>
                        {goals > 0 && <span>{goals}</span>}
                      </button>
                    </div>

                    {/* Cartão Amarelo 🟨 */}
                    <button
                      type="button"
                      disabled={isMatchValidated}
                      onClick={() => handleToggleCard(player.id, player.displayName, side, 'cartao_amarelo')}
                      className={`h-7 w-7 rounded-lg text-xs font-black flex items-center justify-center border transition active:scale-90 ${
                        hasYellow
                          ? 'bg-amber-400 text-amber-950 border-amber-500 shadow-xs'
                          : 'bg-slate-50 text-slate-300 border-slate-200 hover:border-amber-400 hover:text-amber-500'
                      }`}
                      title="Cartão Amarelo"
                    >
                      🟨
                    </button>

                    {/* Cartão Azul 🟦 (Society 2 min) */}
                    <button
                      type="button"
                      disabled={isMatchValidated}
                      onClick={() => handleToggleCard(player.id, player.displayName, side, 'cartao_azul')}
                      className={`h-7 w-7 rounded-lg text-xs font-black flex items-center justify-center border transition active:scale-90 ${
                        hasBlue
                          ? 'bg-blue-500 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-300 border-slate-200 hover:border-blue-400 hover:text-blue-500'
                      }`}
                      title="Cartão Azul (2 min)"
                    >
                      🟦
                    </button>

                    {/* Cartão Vermelho 🟥 */}
                    <button
                      type="button"
                      disabled={isMatchValidated}
                      onClick={() => handleToggleCard(player.id, player.displayName, side, 'cartao_vermelho')}
                      className={`h-7 w-7 rounded-lg text-xs font-black flex items-center justify-center border transition active:scale-90 ${
                        hasRed
                          ? 'bg-red-600 text-white border-red-700 shadow-xs'
                          : 'bg-slate-50 text-slate-300 border-slate-200 hover:border-red-400 hover:text-red-500'
                      }`}
                      title="Cartão Vermelho"
                    >
                      🟥
                    </button>

                    {/* MVP / Craque */}
                    <button
                      type="button"
                      disabled={isMatchValidated}
                      onClick={() => setSelectedMvpId((prev) => (prev === player.id ? '' : player.id))}
                      className={`h-7 w-7 rounded-lg text-xs font-black flex items-center justify-center border transition active:scale-90 ${
                        isMvp
                          ? 'bg-amber-400 text-amber-950 border-amber-500 shadow-xs'
                          : 'bg-slate-50 text-slate-300 border-slate-200 hover:text-amber-500'
                      }`}
                      title="Eleger Craque da Partida (MVP)"
                    >
                      ⭐
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BLOCO DE VALIDAÇÃO E ENCERRAMENTO */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Handshake className="h-4 w-4 text-blue-600" />
            Validação da Súmula Oficial
          </h4>
          <span className="text-[11px] font-bold text-slate-500">
            {isMatchValidated
              ? '✓ Validada Oficialmente'
              : isAwaitingConfirmation
              ? 'Aguardando Confirmação'
              : isContested
              ? 'Em Contestação'
              : 'Em Andamento'}
          </span>
        </div>

        {isMatchValidated ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center text-xs font-bold text-emerald-800 space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-black uppercase">Partida Homologada com Sucesso</span>
            </div>
            <p className="text-[11px] text-emerald-600">
              O resultado de {match.homeTeamName} {homeScore} x {awayScore} {match.awayTeamName} foi computado na tabela de classificação e os gols foram creditados aos atletas.
            </p>
          </div>
        ) : isAwaitingConfirmation ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-3">
            <p className="text-xs text-amber-800 font-medium">
              A súmula foi enviada pelo mesário. O capitão ou treinador do time adversário deve conferir o placar oficial ({homeScore} x {awayScore}) e aprovar.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirmResult}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>Confirmar & Validar Resultado</span>
              </button>
              <button
                type="button"
                onClick={() => setShowContestModal(true)}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-red-100 border border-red-300 px-3 py-2.5 text-xs font-bold text-red-700 hover:bg-red-200 active:scale-95 transition cursor-pointer"
              >
                <AlertTriangle className="h-4 w-4" />
                <span>Contestar</span>
              </button>
            </div>
          </div>
        ) : isContested ? (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-center text-xs font-bold text-red-700 space-y-1">
            <div className="flex items-center justify-center gap-1.5">
              <AlertTriangle className="h-5 w-5" />
              <span>Confronto sob Análise de Moderação</span>
            </div>
            <p className="text-[11px] text-red-600 font-normal">
              Houve uma divergência apontada por um dos clubes. Os moderadores da liga foram notificados para verificar o placar.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-500">
              Após apitar o fim da partida e registrar todos os gols e advertências, encerre a súmula para que os capitães assinem.
            </p>
            <button
              type="button"
              onClick={handleFinalizeAndSubmit}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-700 py-3 text-xs font-black text-white shadow-md hover:bg-blue-800 active:scale-95 transition cursor-pointer"
            >
              <Check className="h-4 w-4 text-amber-300" />
              <span>Finalizar Partida & Enviar Súmula</span>
            </button>
          </div>
        )}
      </div>

      {/* MODAL DE CONTESTAÇÃO DE RESULTADO */}
      {showContestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase">
                    Contestar Súmula
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Aponte a divergência observada
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowContestModal(false)}
                className="rounded-full bg-slate-100 p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleContestSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Motivo da Contestação
                </label>
                <select
                  value={contestReason}
                  onChange={(e) => setContestReason(e.target.value as DisputeReasonCode)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-red-500 focus:outline-none"
                >
                  <option value="placar_incorreto">Placar final incorreto</option>
                  <option value="gols_divergentes">Autores dos gols incorretos</option>
                  <option value="escalacao_irregular">Escalação irregular de atleta</option>
                  <option value="outro">Outro motivo</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Detalhes para a Moderação
                </label>
                <textarea
                  value={contestDescription}
                  onChange={(e) => setContestDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-red-500 focus:outline-none"
                  placeholder="Explique o que aconteceu (ex: Nosso segundo gol foi aos 35 minutos e não foi anotado)..."
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowContestModal(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-red-700 transition"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Enviar Contestação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
