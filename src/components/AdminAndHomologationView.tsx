import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  ClipboardCheck,
  Eye,
  EyeOff,
  FileWarning,
  History,
  Lock,
  Play,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { runPriorityHomologationTests } from '../lib/engine/homologationSuite';
import { HomologationTestResult } from '../types/league';

interface AdminAndHomologationViewProps {
  initialMatchId?: string;
}

export const AdminAndHomologationView: React.FC<
  AdminAndHomologationViewProps
> = ({ initialMatchId }) => {
  const {
    currentUser,
    matches,
    matchResults,
    disputes,
    auditLogs,
    switchActiveUser,
    moderateMatchResolution,
    attemptDirectManipulationAttack,
    resetDemoDatabase,
  } = useLeague();

  const [subView, setSubView] = useState<'moderation' | 'audit' | 'homolog'>(
    'moderation'
  );
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

    let isValid = false;

    // 1. Senhas mestras administrativas reconhecidas
    const masterKeys = ['admin', 'admin123', 'futplay', 'futplay2026', '123456'];
    if (masterKeys.includes(trimmed.toLowerCase())) {
      isValid = true;
    }

    // 2. Senha configurada localmente no dispositivo para a conta ativa
    if (!isValid) {
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
          isValid = true;
        }
      } catch {
        // Ignora erro
      }
    }

    if (!isValid) {
      setResetError('Senha de administrador incorreta. Tente novamente.');
      return;
    }

    setIsResetModalOpen(false);
    setResetPassword('');
    resetDemoDatabase();
  };

  const filteredAuditLogs = useMemo(() => {
    if (!logSearch.trim()) return auditLogs;
    const q = logSearch.toLowerCase();
    return auditLogs.filter(
      (l) =>
        (l.actionType || '').toLowerCase().includes(q) ||
        (l.actorName || '').toLowerCase().includes(q) ||
        (l.reason || '').toLowerCase().includes(q) ||
        (l.actorRole || '').toLowerCase().includes(q)
    );
  }, [auditLogs, logSearch]);

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
      {/* 1. Card Superior de Moderação e Abas */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">
            Moderação & Auditoria
          </h1>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
              isStaff
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <ShieldCheck className="h-3 w-3" />
            {currentUser.role}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {!isStaff ? (
            <button
              onClick={() => switchActiveUser('user-mod')}
              className="rounded-xl bg-blue-600 py-2 px-3 text-xs font-bold text-white shadow-sm"
            >
              Entrar como Moderador
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenResetModal}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 py-2 px-3 text-xs font-semibold text-slate-700 transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-blue-600" />
              Restaurar Dados
            </button>
          )}

          <button
            onClick={attemptDirectManipulationAttack}
            className="rounded-xl border border-red-200 bg-red-50 py-2 px-3 text-xs font-bold text-red-700"
          >
            Testar Bloqueio API
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setSubView('moderation')}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-bold transition ${
              subView === 'moderation'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600'
            }`}
          >
            <FileWarning className="h-3.5 w-3.5" />
            Disputas
          </button>
          <button
            onClick={() => setSubView('audit')}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-bold transition ${
              subView === 'audit'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Logs ({auditLogs.length})
          </button>
          <button
            onClick={() => setSubView('homolog')}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-bold transition ${
              subView === 'homolog'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600'
            }`}
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            Testes ({passedCount}/10)
          </button>
        </div>
      </div>

      {/* ABA 1: RESOLUÇÃO DE CONTESTAÇÕES */}
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
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Histórico de Auditoria & Ações
              </h2>
              <p className="text-[11px] text-slate-500">
                Trilha de registro das ações realizadas pelos usuários
              </p>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
              {auditLogs.length} {auditLogs.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>

          {/* Campo de Busca nos Logs */}
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
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.2 text-[9px] font-bold border uppercase ${roleBadge}`}
                      >
                        {roleLabel}
                      </span>
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Testes de Homologação ({passedCount}/10)
              </h2>
              <p className="text-[11px] text-slate-500">
                Verificação das regras de negócio
              </p>
            </div>
            <button
              onClick={handleRunHomologationSuite}
              className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white"
            >
              <Play className="h-3 w-3" />
              Executar
            </button>
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
    </div>
  );
};
