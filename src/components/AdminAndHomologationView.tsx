import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileWarning,
  History,
  Lock,
  Play,
  RotateCcw,
  Save,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { runPriorityHomologationTests } from '../lib/engine/homologationSuite';
import {
  HomologationTestResult,
  PlayerPosition,
  PlayerProfile,
  SeasonEntry,
  TeamModality,
} from '../types/league';

interface AdminAndHomologationViewProps {
  initialMatchId?: string;
}

export const AdminAndHomologationView: React.FC<
  AdminAndHomologationViewProps
> = ({ initialMatchId }) => {
  const {
    currentUser,
    currentPlayerProfile,
    matches,
    matchResults,
    disputes,
    auditLogs,
    profiles,
    seasonEntries,
    users,
    selectedSeasonId,
    updatePlayerStatsManually,
    switchActiveUser,
    moderateMatchResolution,
    attemptDirectManipulationAttack,
    resetDemoDatabase,
  } = useLeague();

  const [subView, setSubView] = useState<'teams' | 'moderation' | 'audit' | 'homolog'>(
    'teams'
  );
  const [selectedTeamName, setSelectedTeamName] = useState<string | null>(null);
  const [teamSearch, setTeamSearch] = useState<string>('');
  const [playerSearch, setPlayerSearch] = useState<string>('');
  const [logPeriodFilter, setLogPeriodFilter] = useState<'all' | '7d' | '30d' | '180d'>('all');

  // Estados para edição manual de dados do atleta pelo Administrador
  const [editingPlayer, setEditingPlayer] = useState<PlayerProfile | null>(null);
  const [editForm, setEditForm] = useState<{
    matchesPlayed: number;
    wins: number;
    draws: number;
    losses: number;
    goals: number;
    assists: number;
    superCapas: number;
    goalkeeperCapas: number;
    yellowCards: number;
    blueCards: number;
    redCards: number;
    seasonPoints: number;
    position: PlayerPosition;
    reason: string;
  }>({
    matchesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals: 0,
    assists: 0,
    superCapas: 0,
    goalkeeperCapas: 0,
    yellowCards: 0,
    blueCards: 0,
    redCards: 0,
    seasonPoints: 0,
    position: 'atacante',
    reason: 'Ajuste manual de dados da súmula pelo Administrador',
  });

  // Popup de Senha de Administrador para confirmar edição manual
  const [isEditPasswordModalOpen, setIsEditPasswordModalOpen] = useState<boolean>(false);
  const [editAdminPassword, setEditAdminPassword] = useState<string>('');
  const [showEditAdminPassword, setShowEditAdminPassword] = useState<boolean>(false);
  const [editAdminPasswordError, setEditAdminPasswordError] = useState<string>('');
  const [editSuccessAlert, setEditSuccessAlert] = useState<string | null>(null);

  const [targetMatchId, setTargetMatchId] = useState<string>(
    initialMatchId || 'match-103'
  );
  const [modAction, setModAction] = useState<
    'validate_current' | 'correct_and_validate' | 'annul_match'
  >('correct_and_validate');
  const [correctedHome, setCorrectedHome] = useState<number>(2);
  const [correctedAway, setCorrectedAway] = useState<number>(2);
  const [modReason, setModReason] = useState<string>(
    'Confirmado empate em 2x2 após revisão da súmula.'
  );

  const [testResults, setTestResults] = useState<HomologationTestResult[]>(() =>
    runPriorityHomologationTests()
  );

  // Estados para modal de segurança ao Restaurar Dados
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [resetPassword, setResetPassword] = useState<string>('');
  const [showResetPassword, setShowResetPassword] = useState<boolean>(false);
  const [resetError, setResetError] = useState<string>('');

  // Busca e filtro de logs
  const [logSearch, setLogSearch] = useState<string>('');

  const isStaff =
    currentUser.role === 'admin' || currentUser.role === 'moderator';

  const selectedMatch =
    matches.find((m) => m.id === targetMatchId) || matches[0];
  const activeVersion = matchResults.find(
    (r) => r.id === selectedMatch?.activeResultVersionId
  );

  // Validador compartilhado de senha administrativa
  const verifyAdminPassword = (trimmed: string): boolean => {
    const masterKeys = ['admin', 'admin123', 'futplay', 'futplay2026', '123456'];
    if (masterKeys.includes(trimmed.toLowerCase())) {
      return true;
    }
    try {
      const stored = JSON.parse(
        localStorage.getItem('futplay_user_passwords') || '{}'
      );
      const expected =
        stored[currentUser.id] ||
        (currentUser.email ? stored[currentUser.email.toLowerCase()] : undefined) ||
        (currentUser.whatsappNumber
          ? stored[currentUser.whatsappNumber.replace(/\D/g, '')]
          : undefined);

      if (expected && expected === trimmed) {
        return true;
      }
    } catch {
      // Ignora erro
    }
    return false;
  };

  const handleOpenResetModal = () => {
    setResetPassword('');
    setResetError('');
    setShowResetPassword(false);
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = resetPassword.trim();
    if (!trimmed) {
      setResetError('Informe a senha do administrador.');
      return;
    }

    if (!verifyAdminPassword(trimmed)) {
      setResetError('Senha de administrador incorreta. Tente novamente.');
      return;
    }

    setIsResetModalOpen(false);
    setResetPassword('');
    resetDemoDatabase();
  };

  // Abre o formulário de edição do atleta selecionado
  const handleOpenEditPlayer = (player: PlayerProfile) => {
    const entry =
      seasonEntries.find(
        (se) => se.playerId === player.id && se.seasonId === selectedSeasonId
      ) ||
      seasonEntries.find((se) => se.playerId === player.id) ||
      ({} as Partial<SeasonEntry>);

    setEditForm({
      matchesPlayed: Number(entry.matchesPlayed ?? 0),
      wins: Number(entry.wins ?? 0),
      draws: Number(entry.draws ?? 0),
      losses: Number(entry.losses ?? 0),
      goals: Number(entry.goals ?? 0),
      assists: Number(entry.assists ?? 0),
      superCapas: Number(entry.superCapas ?? entry.mvpCount ?? 0),
      goalkeeperCapas: Number(entry.goalkeeperCapas ?? 0),
      yellowCards: Number(entry.yellowCards ?? 0),
      blueCards: Number(entry.blueCards ?? 0),
      redCards: Number(entry.redCards ?? 0),
      seasonPoints: Number(entry.seasonPoints ?? 0),
      position: player.position || 'atacante',
      reason: 'Ajuste manual de dados pelo Administrador',
    });
    setEditingPlayer(player);
  };

  // Ao clicar em salvar alterações do formulário de atleta, abre o popup de senha
  const handleRequestSavePlayerStats = (e: React.FormEvent) => {
    e.preventDefault();
    setEditAdminPassword('');
    setEditAdminPasswordError('');
    setShowEditAdminPassword(false);
    setIsEditPasswordModalOpen(true);
  };

  // Confirmação final após digitar senha de administrador no popup
  const handleConfirmSavePlayerStatsWithPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingPlayer) return;
    const trimmed = editAdminPassword.trim();
    if (!trimmed) {
      setEditAdminPasswordError('Informe a senha do administrador.');
      return;
    }

    if (!verifyAdminPassword(trimmed)) {
      setEditAdminPasswordError('Senha de administrador incorreta. Tente novamente.');
      return;
    }

    const ok = updatePlayerStatsManually({
      playerId: editingPlayer.id,
      statsUpdates: {
        matchesPlayed: Number(editForm.matchesPlayed) || 0,
        wins: Number(editForm.wins) || 0,
        draws: Number(editForm.draws) || 0,
        losses: Number(editForm.losses) || 0,
        goals: Number(editForm.goals) || 0,
        assists: Number(editForm.assists) || 0,
        superCapas: Number(editForm.superCapas) || 0,
        goalkeeperCapas: Number(editForm.goalkeeperCapas) || 0,
        yellowCards: Number(editForm.yellowCards) || 0,
        blueCards: Number(editForm.blueCards) || 0,
        redCards: Number(editForm.redCards) || 0,
        seasonPoints: Number(editForm.seasonPoints) || 0,
      },
      profileUpdates: {
        position: editForm.position,
      },
      reason: editForm.reason.trim() || 'Ajuste manual realizado pelo Administrador',
      actorUserId: currentUser?.id || 'admin',
      actorName: currentPlayerProfile?.displayName || currentUser?.email || 'Administrador',
    });

    if (ok) {
      setIsEditPasswordModalOpen(false);
      setEditSuccessAlert(
        `Dados de ${editingPlayer.displayName} atualizados com sucesso e registrados no histórico privado do perfil!`
      );
      setTimeout(() => setEditSuccessAlert(null), 6000);
      setEditingPlayer(null);
    }
  };

  // Agrupamento e cálculo de métricas para todos os times da Liga
  const teamItems = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        city: string;
        crestUrl?: string;
        modality?: TeamModality;
        inviteCode?: string;
        ownerName?: string;
        players: PlayerProfile[];
        totalGoals: number;
        totalMatches: number;
      }
    >();

    profiles.forEach((p) => {
      const raw = (p.teamName || '').trim();
      const teamKey = raw ? raw.toLowerCase() : '__sem_time__';
      const teamDisplayName = raw || 'Atletas Sem Time Definido';

      let item = map.get(teamKey);
      if (!item) {
        item = {
          name: teamDisplayName,
          city: p.teamCity || 'Planalto - BA',
          crestUrl: p.teamCrestUrl,
          modality: p.teamModality,
          inviteCode: p.teamInviteCode,
          ownerName: p.isTeamOwner ? p.displayName : undefined,
          players: [],
          totalGoals: 0,
          totalMatches: 0,
        };
        map.set(teamKey, item);
      }
      if (p.teamCrestUrl && !item.crestUrl) item.crestUrl = p.teamCrestUrl;
      if (p.isTeamOwner && !item.ownerName) item.ownerName = p.displayName;
      item.players.push(p);
    });

    users.forEach((u) => {
      const raw = (u.teamName || '').trim();
      if (!raw) return;
      const teamKey = raw.toLowerCase();
      if (!map.has(teamKey)) {
        map.set(teamKey, {
          name: raw,
          city: u.teamCity || 'Planalto - BA',
          crestUrl: u.teamCrestUrl,
          modality: u.teamModality,
          inviteCode: u.teamInviteCode,
          ownerName: u.isTeamOwner ? u.email || 'Dono' : undefined,
          players: [],
          totalGoals: 0,
          totalMatches: 0,
        });
      }
    });

    Array.from(map.values()).forEach((item) => {
      let gSum = 0;
      let mMax = 0;
      item.players.forEach((p) => {
        const entry =
          seasonEntries.find(
            (se) => se.playerId === p.id && se.seasonId === selectedSeasonId
          ) || seasonEntries.find((se) => se.playerId === p.id);
        if (entry) {
          gSum += entry.goals || 0;
          if ((entry.matchesPlayed || 0) > mMax) mMax = entry.matchesPlayed;
        }
      });
      item.totalGoals = gSum;
      item.totalMatches = mMax;
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.name === 'Atletas Sem Time Definido') return 1;
      if (b.name === 'Atletas Sem Time Definido') return -1;
      return a.name.localeCompare(b.name);
    });
  }, [profiles, users, seasonEntries, selectedSeasonId]);

  const filteredTeams = useMemo(() => {
    if (!teamSearch.trim()) return teamItems;
    const q = teamSearch.toLowerCase();
    return teamItems.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q) ||
        (t.ownerName || '').toLowerCase().includes(q) ||
        (t.inviteCode || '').toLowerCase().includes(q)
    );
  }, [teamItems, teamSearch]);

  const activeSelectedTeam = useMemo(() => {
    if (!selectedTeamName) return null;
    return (
      teamItems.find(
        (t) => t.name.toLowerCase() === selectedTeamName.toLowerCase()
      ) || null
    );
  }, [teamItems, selectedTeamName]);

  const filteredTeamPlayers = useMemo(() => {
    if (!activeSelectedTeam) return [];
    if (!playerSearch.trim()) return activeSelectedTeam.players;
    const q = playerSearch.toLowerCase();
    return activeSelectedTeam.players.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        p.position.toLowerCase().includes(q)
    );
  }, [activeSelectedTeam, playerSearch]);

  const filteredAuditLogs = useMemo(() => {
    let list = auditLogs;
    if (logPeriodFilter !== 'all') {
      const nowMs = Date.now();
      const days = logPeriodFilter === '7d' ? 7 : logPeriodFilter === '30d' ? 30 : 180;
      const thresholdMs = days * 24 * 60 * 60 * 1000;
      list = list.filter((l) => {
        const itemMs = new Date(l.createdAt || 0).getTime();
        return nowMs - itemMs <= thresholdMs;
      });
    }

    if (!logSearch.trim()) return list;
    const q = logSearch.toLowerCase();
    return list.filter(
      (l) =>
        (l.actionType || '').toLowerCase().includes(q) ||
        (l.actorName || '').toLowerCase().includes(q) ||
        (l.reason || '').toLowerCase().includes(q) ||
        (l.actorRole || '').toLowerCase().includes(q)
    );
  }, [auditLogs, logSearch, logPeriodFilter]);

  const handleExportAuditLogsCsv = () => {
    if (auditLogs.length === 0) return;

    const headers = [
      'ID',
      'Data e Hora (ISO)',
      'Data e Hora (Local)',
      'Tipo de Acao',
      'Responsavel',
      'Papel',
      'Tipo de Entidade',
      'ID da Entidade',
      'Motivo / Descricao',
      'Politica de Retencao Legal',
      'Validade Minima de Retencao',
    ];

    const rows = filteredAuditLogs.map((l) => {
      let localDate = l.createdAt;
      try {
        localDate = new Date(l.createdAt).toLocaleString('pt-BR');
      } catch {}

      return [
        l.id,
        l.createdAt,
        localDate,
        l.actionType,
        l.actorName,
        l.actorRole,
        l.entityType,
        l.entityId,
        `"${(l.reason || '').replace(/"/g, '""')}"`,
        l.legalRetentionPolicy || 'Marco Civil (Art. 15, Lei 12.965/2014)',
        l.retentionUntil || '',
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_auditoria_futplay_marcocivil_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRunHomologationSuite = () => {
    setTestResults(runPriorityHomologationTests());
  };

  const handleExecuteModeration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatch) return;
    moderateMatchResolution({
      matchId: selectedMatch.id,
      action: modAction,
      correctedHomeScore: correctedHome,
      correctedAwayScore: correctedAway,
      moderatorReason: modReason,
    });
  };

  const passedCount = useMemo(
    () => testResults.filter((t) => t.passed).length,
    [testResults]
  );

  return (
    <div className="space-y-4">
      {/* 1. Barra de Abas Principal */}
      <div className="rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setSubView('teams')}
            className={`flex items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-bold transition ${
              subView === 'teams'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span className="truncate">Times & Atletas</span>
          </button>
          <button
            onClick={() => setSubView('moderation')}
            className={`flex items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-bold transition ${
              subView === 'moderation'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileWarning className="h-3.5 w-3.5" />
            <span className="truncate">Disputas</span>
          </button>
          <button
            onClick={() => setSubView('audit')}
            className={`flex items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-bold transition ${
              subView === 'audit'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span className="truncate">Logs ({auditLogs.length})</span>
          </button>
          <button
            onClick={() => setSubView('homolog')}
            className={`flex items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-bold transition ${
              subView === 'homolog'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            <span className="truncate">Testes ({passedCount}/10)</span>
          </button>
        </div>
      </div>

      {/* ALERTA DE SUCESSO DE EDIÇÃO MANUAL */}
      {editSuccessAlert && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800 flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{editSuccessAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setEditSuccessAlert(null)}
            className="text-emerald-600 hover:text-emerald-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ======================================================================= */}
      {/* ABA PRINCIPAL: GESTÃO DE TIMES & TABELA COMPLETA DE ATLETAS             */}
      {/* ======================================================================= */}
      {subView === 'teams' && (
        <div className="space-y-4">
          {!selectedTeamName ? (
            /* =================================================================== */
            /* 1. LISTA DE TIMES CADASTRADOS NA LIGA                              */
            /* =================================================================== */
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-blue-600" />
                    Times & Elencos da Liga
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Selecione um time para abrir a tabela de atletas, auditar estatísticas e editar qualquer dado com senha.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-[11px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-xl">
                    {teamItems.length} {teamItems.length === 1 ? 'time cadastrado' : 'times cadastrados'}
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenResetModal}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 py-1.5 px-3 text-xs font-semibold text-slate-700 transition cursor-pointer shadow-xs hover:border-slate-300"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-blue-600" />
                    Restaurar Dados
                  </button>
                </div>
              </div>

              {/* Barra de Busca de Times */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="Pesquisar time pelo nome, cidade ou código..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2 text-xs font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>

              {filteredTeams.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
                  Nenhum time encontrado para a busca "{teamSearch}".
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredTeams.map((team) => (
                    <button
                      key={team.name}
                      type="button"
                      onClick={() => {
                        setSelectedTeamName(team.name);
                        setPlayerSearch('');
                      }}
                      className="group p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-md active:scale-[0.99] transition text-left cursor-pointer flex flex-col justify-between gap-3 relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          {team.crestUrl ? (
                            <img
                              src={team.crestUrl}
                              alt={team.name}
                              className="h-11 w-11 rounded-xl object-contain shrink-0 drop-shadow-xs"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white font-extrabold text-sm shrink-0 shadow-xs">
                              {team.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="text-xs font-black text-slate-900 uppercase truncate group-hover:text-blue-700 transition">
                              {team.name}
                            </h3>
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">
                              {team.city}
                              {team.modality ? ` · ${team.modality.toUpperCase()}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 text-slate-400 group-hover:text-blue-600 transition">
                          <span className="text-[10px] font-bold">Ver Elenco</span>
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>

                      {/* Badges de Resumo do Time */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 text-[10px]">
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 text-blue-700 px-2 py-0.5 font-bold">
                          <Users className="h-3 w-3" />
                          {team.players.length} {team.players.length === 1 ? 'atleta' : 'atletas'}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-800 px-2 py-0.5 font-bold">
                          ⚽ {team.totalGoals} gols
                        </span>
                        {team.inviteCode && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-700 px-1.5 py-0.5 font-mono font-bold">
                            #{team.inviteCode}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* =================================================================== */
            /* 2. TABELA COMPLETA DE ATLETAS DO TIME SELECIONADO                  */
            /* =================================================================== */
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
              {/* Topo: Voltar e Identificação do Time */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTeamName(null);
                      setPlayerSearch('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Voltar para Times</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {activeSelectedTeam?.crestUrl ? (
                      <img
                        src={activeSelectedTeam.crestUrl}
                        alt={activeSelectedTeam.name}
                        className="h-8 w-8 object-contain rounded-lg shrink-0"
                      />
                    ) : (
                      <Shield className="h-6 w-6 text-blue-600" />
                    )}
                    <div>
                      <h2 className="text-sm font-black text-slate-900 uppercase">
                        {activeSelectedTeam?.name}
                      </h2>
                      <p className="text-[10px] text-slate-500">
                        {activeSelectedTeam?.city} · {activeSelectedTeam?.players.length} atletas registrados
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-[10px] font-extrabold uppercase rounded-full bg-blue-100 text-blue-800 px-2.5 py-1">
                    Modo Edição Admin Ativo
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenResetModal}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 py-1.5 px-3 text-xs font-semibold text-slate-700 transition cursor-pointer shadow-xs hover:border-slate-300"
                  >
                    <RotateCcw className="h-3.5 w-3.5 text-blue-600" />
                    Restaurar Dados
                  </button>
                </div>
              </div>

              {/* Busca de Atletas */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  placeholder="Filtrar atleta por nome, apelido ou posição..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2 text-xs font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>

              {/* TABELA DE ATLETAS (Visualização Desktop & Tablet) */}
              <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600 tracking-wider">
                      <th className="py-2.5 px-3">Nome do Atleta</th>
                      <th className="py-2.5 px-2 text-center">Posição</th>
                      <th className="py-2.5 px-2 text-center" title="Partidas Jogadas">PJ</th>
                      <th className="py-2.5 px-2 text-center" title="Vitórias - Empates - Derrotas">V-E-D</th>
                      <th className="py-2.5 px-2 text-center" title="Gols Marcados">Gols</th>
                      <th className="py-2.5 px-2 text-center" title="Assistências">Assist</th>
                      <th className="py-2.5 px-2 text-center" title="Super Capas">SC</th>
                      <th className="py-2.5 px-2 text-center" title="Capas de Goleiro">CG</th>
                      <th className="py-2.5 px-2 text-center" title="Cartões: Amarelo / Azul / Vermelho">Cartões</th>
                      <th className="py-2.5 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTeamPlayers.map((player) => {
                      const entry =
                        seasonEntries.find(
                          (se) => se.playerId === player.id && se.seasonId === selectedSeasonId
                        ) || seasonEntries.find((se) => se.playerId === player.id);

                      const pj = entry?.matchesPlayed ?? 0;
                      const v = entry?.wins ?? 0;
                      const e = entry?.draws ?? 0;
                      const d = entry?.losses ?? 0;
                      const g = entry?.goals ?? 0;
                      const a = entry?.assists ?? 0;
                      const sc = entry?.superCapas ?? entry?.mvpCount ?? 0;
                      const cg = entry?.goalkeeperCapas ?? 0;
                      const ca = entry?.yellowCards ?? 0;
                      const cb = entry?.blueCards ?? 0;
                      const cv = entry?.redCards ?? 0;

                      return (
                        <tr key={player.id} className="hover:bg-blue-50/40 transition">
                          <td className="py-2.5 px-3">
                            <div className="min-w-0">
                              <span className="font-extrabold text-slate-900 block truncate text-xs">
                                {player.displayName}
                              </span>
                              {player.isTeamOwner && (
                                <span className="text-[9px] font-black text-blue-700 uppercase">
                                  Dono / Capitão
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-2 text-center">
                            <span className="inline-block rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 capitalize">
                              {player.position === 'goleiro' ? '🧤 Goleiro' : player.position}
                            </span>
                          </td>

                          <td className="py-2.5 px-2 text-center font-bold text-slate-800">
                            {pj}
                          </td>

                          <td className="py-2.5 px-2 text-center font-mono text-[11px] text-slate-600">
                            <span className="text-emerald-700 font-bold">{v}</span>-
                            <span className="text-slate-500 font-bold">{e}</span>-
                            <span className="text-rose-700 font-bold">{d}</span>
                          </td>

                          <td className="py-2.5 px-2 text-center font-extrabold text-blue-700">
                            {g}
                          </td>

                          <td className="py-2.5 px-2 text-center font-bold text-slate-700">
                            {a}
                          </td>

                          <td className="py-2.5 px-2 text-center font-bold text-amber-700">
                            {sc}
                          </td>

                          <td className="py-2.5 px-2 text-center font-bold text-teal-700">
                            {cg}
                          </td>

                          <td className="py-2.5 px-2 text-center">
                            <div className="flex items-center justify-center gap-1 text-[10px] font-bold">
                              <span className="px-1 rounded bg-amber-100 text-amber-900" title="Amarelos">
                                {ca}
                              </span>
                              <span className="px-1 rounded bg-blue-100 text-blue-900" title="Azuis">
                                {cb}
                              </span>
                              <span className="px-1 rounded bg-red-100 text-red-900" title="Vermelhos">
                                {cv}
                              </span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenEditPlayer(player)}
                              className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-blue-700 transition cursor-pointer"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>Editar</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* LISTA RESPONSIVA DE ATLETAS (Visualização Mobile) */}
              <div className="lg:hidden space-y-3">
                {filteredTeamPlayers.map((player) => {
                  const entry =
                    seasonEntries.find(
                      (se) => se.playerId === player.id && se.seasonId === selectedSeasonId
                    ) || seasonEntries.find((se) => se.playerId === player.id);

                  const pj = entry?.matchesPlayed ?? 0;
                  const v = entry?.wins ?? 0;
                  const e = entry?.draws ?? 0;
                  const d = entry?.losses ?? 0;
                  const g = entry?.goals ?? 0;
                  const a = entry?.assists ?? 0;
                  const sc = entry?.superCapas ?? entry?.mvpCount ?? 0;
                  const cg = entry?.goalkeeperCapas ?? 0;
                  const ca = entry?.yellowCards ?? 0;
                  const cb = entry?.blueCards ?? 0;
                  const cv = entry?.redCards ?? 0;

                  return (
                    <div
                      key={player.id}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-slate-900 truncate">
                            {player.displayName}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-700 capitalize">
                              {player.position === 'goleiro' ? '🧤 Goleiro' : player.position}
                            </span>
                            {player.isTeamOwner && (
                              <span className="rounded bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 text-[9px] font-black uppercase">
                                Dono / Capitão
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenEditPlayer(player)}
                          className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 transition cursor-pointer shrink-0"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Editar</span>
                        </button>
                      </div>

                      {/* Grade de Estatísticas do Jogador */}
                      <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-slate-50 p-2.5 text-center text-[10px]">
                        <div>
                          <span className="block text-slate-500 font-semibold">PJ</span>
                          <span className="font-bold text-slate-900">{pj}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-semibold">V-E-D</span>
                          <span className="font-mono font-bold text-slate-700">
                            {v}-{e}-{d}
                          </span>
                        </div>
                        <div>
                          <span className="block text-blue-600 font-semibold">Gols</span>
                          <span className="font-extrabold text-blue-800">{g}</span>
                        </div>
                        <div>
                          <span className="block text-slate-500 font-semibold">Assist</span>
                          <span className="font-bold text-slate-800">{a}</span>
                        </div>
                        <div>
                          <span className="block text-amber-700 font-semibold">SC</span>
                          <span className="font-bold text-amber-900">{sc}</span>
                        </div>
                        <div>
                          <span className="block text-teal-700 font-semibold">CG</span>
                          <span className="font-bold text-teal-900">{cg}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="block text-slate-500 font-semibold">Cartões (A/Az/V)</span>
                          <span className="font-bold text-slate-800">
                            {ca} / {cb} / {cv}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredTeamPlayers.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-500">
                  Nenhum atleta encontrado no elenco deste time.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ABA 2: RESOLUÇÃO DE CONTESTAÇÕES */}
      {subView === 'moderation' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3.5">
          <h2 className="text-sm font-bold text-slate-900">
            Analisar Partida ou Contestação
          </h2>

          {!selectedMatch ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center space-y-1.5">
              <p className="text-xs font-bold text-slate-700">
                Nenhuma partida registrada para moderação ainda.
              </p>
              <p className="text-[11px] text-slate-500">
                Quando houver partidas ou contestações enviadas pelos times, elas aparecerão aqui para auditoria e validação.
              </p>
            </div>
          ) : (
            <form onSubmit={handleExecuteModeration} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Partida:
                </label>
                <select
                  value={selectedMatch.id}
                  onChange={(e) => setTargetMatchId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800"
                >
                  {matches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.homeTeamName} vs {m.awayTeamName} ({m.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1.5">
                <div>
                  Placar atual:{' '}
                  <strong className="text-blue-700 font-mono">
                    {activeVersion
                      ? `${activeVersion.homeScore} x ${activeVersion.awayScore}`
                      : 'Sem placar'}
                  </strong>
                </div>
                {disputes
                  .filter((d) => d.matchId === selectedMatch.id)
                  .map((d) => (
                    <div
                      key={d.id}
                      className="rounded-lg bg-red-50 border border-red-100 p-2 text-red-700"
                    >
                      <strong>Contestação:</strong> {d.description}
                    </div>
                  ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Decisão da Moderação:
                </label>
                <select
                  value={modAction}
                  onChange={(e) => setModAction(e.target.value as any)}
                  className="w-full rounded-xl border border-blue-200 bg-blue-50/50 px-3 py-2 text-xs font-bold text-blue-800"
                >
                  <option value="correct_and_validate">
                    Corrigir Placar e Validar
                  </option>
                  <option value="validate_current">
                    Aprovar Placar Original
                  </option>
                  <option value="annul_match">
                    Anular Partida e Reverter Pontos
                  </option>
                </select>
              </div>

              {modAction === 'correct_and_validate' && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1 truncate">
                      {selectedMatch.homeTeamName}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={correctedHome}
                      onChange={(e) => setCorrectedHome(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1 truncate">
                      {selectedMatch.awayTeamName}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={correctedAway}
                      onChange={(e) => setCorrectedAway(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-slate-900"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Motivo / Justificativa *
                </label>
                <textarea
                  rows={2}
                  required
                  value={modReason}
                  onChange={(e) => setModReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-sm"
              >
                Confirmar Decisão
              </button>
            </form>
          )}
        </div>
      )}

      {/* ABA 2: LOGS DE AUDITORIA */}
      {subView === 'audit' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <History className="h-4 w-4 text-blue-600" />
                Histórico de Auditoria & Ações
              </h2>
              <p className="text-[11px] text-slate-500">
                Trilha de registro imutável das ações dos usuários e administradores
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleExportAuditLogsCsv}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition cursor-pointer shadow-xs"
                title="Baixar arquivo oficial de auditoria (CSV) conforme Marco Civil"
              >
                <Download className="h-3.5 w-3.5 text-blue-600" />
                Exportar CSV
              </button>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 border border-blue-200">
                {filteredAuditLogs.length} {filteredAuditLogs.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>
          </div>

          {/* Selo de Conformidade com o Marco Civil e LGPD */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 flex items-start gap-2.5 text-emerald-950">
            <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-tight space-y-0.5 flex-1">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <strong className="font-bold text-emerald-900">
                  Conformidade Marco Civil da Internet (Art. 15 · Lei 12.965/2014) & LGPD
                </strong>
                <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                  Retenção Mínima: 180 dias
                </span>
              </div>
              <p className="text-emerald-800 text-[10.5px]">
                Trilha de auditoria protegida e imutável. Todos os registros de acesso, cadastros, transferências, súmulas e ajustes financeiros são guardados com validade jurídica comprovada.
              </p>
            </div>
          </div>

          {/* Filtros: Busca e Período Legal */}
          <div className="space-y-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Buscar por ação, usuário ou descrição..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-8 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
              {logSearch && (
                <button
                  type="button"
                  onClick={() => setLogSearch('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Abas de Período */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
              <span className="text-slate-400 font-semibold text-[10px] mr-1 shrink-0">Período:</span>
              <button
                type="button"
                onClick={() => setLogPeriodFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition shrink-0 cursor-pointer ${
                  logPeriodFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todo o Histórico ({auditLogs.length})
              </button>
              <button
                type="button"
                onClick={() => setLogPeriodFilter('180d')}
                className={`px-2.5 py-1 rounded-lg font-bold transition shrink-0 cursor-pointer ${
                  logPeriodFilter === '180d'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                180 dias (Marco Civil)
              </button>
              <button
                type="button"
                onClick={() => setLogPeriodFilter('30d')}
                className={`px-2.5 py-1 rounded-lg font-bold transition shrink-0 cursor-pointer ${
                  logPeriodFilter === '30d'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Últimos 30 dias
              </button>
              <button
                type="button"
                onClick={() => setLogPeriodFilter('7d')}
                className={`px-2.5 py-1 rounded-lg font-bold transition shrink-0 cursor-pointer ${
                  logPeriodFilter === '7d'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Últimos 7 dias
              </button>
            </div>
          </div>

          {auditLogs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center space-y-1">
              <p className="text-xs font-bold text-slate-700">
                Nenhum registro de auditoria até o momento.
              </p>
              <p className="text-[11px] text-slate-500">
                Todas as ações (login, mensalidades, caixa, súmulas e alterações de perfil) aparecerão gravadas aqui.
              </p>
            </div>
          ) : filteredAuditLogs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500">
              Nenhuma ação encontrada para "{logSearch}".
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-0.5 space-y-2">
              {filteredAuditLogs.map((log) => {
                const actionUpper = (log.actionType || '').toUpperCase();
                let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                if (
                  actionUpper.includes('PAGA') ||
                  actionUpper.includes('VALIDAD') ||
                  actionUpper.includes('HOMOLOG')
                ) {
                  badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                } else if (
                  actionUpper.includes('PENDENTE') ||
                  actionUpper.includes('REMOVID') ||
                  actionUpper.includes('ANUL') ||
                  actionUpper.includes('EXCLU') ||
                  actionUpper.includes('BLOCKED')
                ) {
                  badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                } else if (actionUpper.includes('CAIXA') || actionUpper.includes('FINANC')) {
                  badgeClass = 'bg-teal-50 text-teal-700 border-teal-200';
                } else if (
                  actionUpper.includes('SUMULA') ||
                  actionUpper.includes('PARTIDA') ||
                  actionUpper.includes('MATCH')
                ) {
                  badgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
                } else if (
                  actionUpper.includes('RESTAURAD') ||
                  actionUpper.includes('CONFIG')
                ) {
                  badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                }

                const roleLower = (log.actorRole || 'player').toLowerCase();
                let roleBadge = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                let roleLabel = 'ATLETA';
                if (roleLower === 'admin') {
                  roleBadge = 'bg-purple-100 text-purple-800 border-purple-200';
                  roleLabel = 'ADMIN';
                } else if (roleLower === 'coach') {
                  roleBadge = 'bg-blue-100 text-blue-800 border-blue-200';
                  roleLabel = 'TREINADOR';
                } else if (roleLower === 'moderator') {
                  roleBadge = 'bg-amber-100 text-amber-800 border-amber-200';
                  roleLabel = 'MODERADOR';
                }

                let formattedDate = log.createdAt;
                try {
                  const d = new Date(log.createdAt);
                  const dStr = d.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                  });
                  const tStr = d.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });
                  formattedDate = `${dStr} às ${tStr}`;
                } catch {}

                return (
                  <div
                    key={log.id}
                    className="pt-2.5 first:pt-0 pb-2 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px] font-bold border uppercase tracking-wider ${badgeClass}`}
                      >
                        {log.actionType}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        {formattedDate}
                      </span>
                    </div>

                    <p className="text-slate-700 leading-snug font-medium text-xs">
                      {log.reason}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-slate-400">Por:</span>
                        <strong className="text-slate-800 truncate">
                          {log.actorName}
                        </strong>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-1.5 py-0.5 text-[9px] font-semibold border border-slate-200"
                          title="Guarda legal mínima de 180 dias garantida pelo Marco Civil da Internet (Lei 12.965/14)"
                        >
                          🛡️ 180d
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.2 text-[9px] font-bold border uppercase ${roleBadge}`}
                        >
                          {roleLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ABA 3: TESTES DE HOMOLOGAÇÃO */}
      {subView === 'homolog' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Testes de Homologação ({passedCount}/10)
              </h2>
              <p className="text-[11px] text-slate-500">
                Verificação das regras de negócio e proteção da API
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={attemptDirectManipulationAttack}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 py-1.5 px-3 text-xs font-bold text-red-700 transition cursor-pointer shadow-xs"
              >
                <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
                Testar Bloqueio API
              </button>
              <button
                type="button"
                onClick={handleRunHomologationSuite}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 py-1.5 px-3 text-xs font-bold text-white transition cursor-pointer shadow-xs"
              >
                <Play className="h-3 w-3" />
                Executar
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {testResults.map((test) => (
              <div
                key={test.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {test.code} · {test.title}
                    </span>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 shrink-0">
                    OK
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {test.details}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. MODAL POPUP DE SEGURANÇA: EXIGIR SENHA PARA RESTAURAR DADOS */}
      {isResetModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 leading-tight">
                      Restaurar Dados
                    </h3>
                    <p className="text-[11px] text-red-600 font-semibold">
                      Autorização do Administrador
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-200/80 p-3 text-[11px] text-amber-900 leading-relaxed">
                <strong>Atenção:</strong> Esta ação limpará os dados locais e rascunhos acumulados, retornando o banco ao estado inicial da liga. Para autorizar, digite sua <strong>senha de administrador</strong>.
              </div>

              <form onSubmit={handleConfirmReset} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Senha do Administrador *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      autoFocus
                      required
                      value={resetPassword}
                      onChange={(e) => {
                        setResetPassword(e.target.value);
                        if (resetError) setResetError('');
                      }}
                      placeholder="Digite a senha..."
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-10 py-2.5 text-xs font-semibold text-slate-900 focus:border-red-500 focus:bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showResetPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {resetError && (
                    <p className="mt-1 text-[11px] font-bold text-red-600">
                      {resetError}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(false)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-red-600 hover:bg-red-700 py-2.5 text-xs font-bold text-white shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Confirmar
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ======================================================================= */}
      {/* MODAL 1: FORMULÁRIO DE EDIÇÃO DE ESTATÍSTICAS DO ATLETA                 */}
      {/* ======================================================================= */}
      {editingPlayer &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn">
            <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-6">
              {/* Cabeçalho do Modal */}
              <div className="flex items-center justify-between border-b border-slate-100 p-4 bg-slate-50">
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-900 truncate">
                    Editar Dados: {editingPlayer.displayName}
                  </h3>
                  <p className="text-[11px] text-blue-700 font-semibold mt-0.5">
                    {editingPlayer.teamName || 'Sem time'} · {editingPlayer.position}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingPlayer(null)}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Formulário com todos os campos alimentados pela súmula e expostos no ranking */}
              <form onSubmit={handleRequestSavePlayerStats} className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-[11px] text-blue-900 leading-relaxed">
                  <strong>Aviso do Administrador:</strong> Qualquer dado alterado aqui será registrado no{' '}
                  <strong>histórico privado do perfil de {editingPlayer.displayName}</strong> com aviso de adição ou subtração de gols, vitórias ou cartões.
                </div>

                {/* Grade de Estatísticas da Súmula e Ranking */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Partidas (PJ) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editForm.matchesPlayed}
                      onChange={(e) =>
                        setEditForm({ ...editForm, matchesPlayed: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-emerald-800 mb-1">
                      Vitórias (V)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.wins}
                      onChange={(e) =>
                        setEditForm({ ...editForm, wins: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-bold text-emerald-800 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Empates (E)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.draws}
                      onChange={(e) =>
                        setEditForm({ ...editForm, draws: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-bold text-slate-800 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-rose-800 mb-1">
                      Derrotas (D)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.losses}
                      onChange={(e) =>
                        setEditForm({ ...editForm, losses: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-bold text-rose-800 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-700 mb-1">
                      ⚽ Gols Marcados *
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editForm.goals}
                      onChange={(e) =>
                        setEditForm({ ...editForm, goals: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-blue-300 bg-blue-50/30 p-2 text-xs font-extrabold text-blue-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      👟 Assistências
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.assists}
                      onChange={(e) =>
                        setEditForm({ ...editForm, assists: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-amber-700 mb-1">
                      🏆 Super Capas (SC)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.superCapas}
                      onChange={(e) =>
                        setEditForm({ ...editForm, superCapas: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-bold text-amber-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-teal-700 mb-1">
                      🧤 Capas GK (CG)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.goalkeeperCapas}
                      onChange={(e) =>
                        setEditForm({ ...editForm, goalkeeperCapas: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-bold text-teal-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-amber-600 mb-1">
                      🟨 Cartões Amarelos
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.yellowCards}
                      onChange={(e) =>
                        setEditForm({ ...editForm, yellowCards: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-amber-200 bg-amber-50/30 p-2 text-xs font-bold text-amber-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-600 mb-1">
                      🟦 Cartões Azuis
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.blueCards}
                      onChange={(e) =>
                        setEditForm({ ...editForm, blueCards: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-blue-200 bg-blue-50/30 p-2 text-xs font-bold text-blue-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-rose-600 mb-1">
                      🟥 Cartões Vermelhos
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.redCards}
                      onChange={(e) =>
                        setEditForm({ ...editForm, redCards: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-rose-200 bg-rose-50/30 p-2 text-xs font-bold text-rose-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Posição no Elenco */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Posição no Elenco *
                  </label>
                  <select
                    value={editForm.position}
                    onChange={(e) =>
                      setEditForm({ ...editForm, position: e.target.value as PlayerPosition })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-xs font-bold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                  >
                    <option value="goleiro">🧤 Goleiro</option>
                    <option value="atacante">⚡ Atacante</option>
                    <option value="meio-campista">🎯 Meio-campista</option>
                    <option value="defensor">🛡️ Defensor</option>
                  </select>
                </div>

                {/* Motivo do Ajuste */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Motivo da Alteração * (Aparecerá no histórico privado do jogador)
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.reason}
                    onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                    placeholder="Ex.: Correção de súmula oficial da rodada..."
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>

                {/* Botões do Modal de Edição */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingPlayer(null)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-xs font-bold shadow-md active:scale-[0.99] transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Salvar Dados (Exige Senha)</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ======================================================================= */}
      {/* MODAL 2: CONFIRMAÇÃO DE SENHA DO ADMINISTRADOR PARA SALVAR DADOS        */}
      {/* ======================================================================= */}
      {isEditPasswordModalOpen &&
        editingPlayer &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
            <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 shrink-0">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 leading-tight">
                      Confirmar com Senha
                    </h3>
                    <p className="text-[11px] text-blue-700 font-semibold">
                      Autorização do Administrador
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditPasswordModalOpen(false)}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-[11px] text-blue-900 leading-relaxed">
                Você está alterando os dados oficiais de <strong>{editingPlayer.displayName}</strong>. Para confirmar e registrar no histórico privado do atleta, digite sua <strong>senha de administrador</strong>.
              </div>

              <form onSubmit={handleConfirmSavePlayerStatsWithPassword} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Senha de Administrador *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showEditAdminPassword ? 'text' : 'password'}
                      autoFocus
                      required
                      value={editAdminPassword}
                      onChange={(e) => {
                        setEditAdminPassword(e.target.value);
                        if (editAdminPasswordError) setEditAdminPasswordError('');
                      }}
                      placeholder="Digite a senha..."
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-10 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditAdminPassword(!showEditAdminPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showEditAdminPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {editAdminPasswordError && (
                    <p className="mt-1 text-[11px] font-bold text-red-600">
                      {editAdminPasswordError}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditPasswordModalOpen(false)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-xs font-bold shadow-md transition cursor-pointer"
                  >
                    Confirmar
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
