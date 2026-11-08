import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  History,
  Play,
  RotateCcw,
  ShieldCheck,
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

  const isStaff =
    currentUser.role === 'admin' || currentUser.role === 'moderator';

  const selectedMatch =
    matches.find((m) => m.id === targetMatchId) || matches[0];
  const activeVersion = matchResults.find(
    (r) => r.id === selectedMatch?.activeResultVersionId
  );

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
              onClick={resetDemoDatabase}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-xs font-semibold text-slate-700"
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
        </div>
      )}

      {/* ABA 2: LOGS DE AUDITORIA */}
      {subView === 'audit' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2.5">
          <h2 className="text-sm font-bold text-slate-900">
            Histórico de Auditoria
          </h2>
          <div className="divide-y divide-slate-100">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="py-2.5 first:pt-0 last:pb-0 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold text-blue-700">
                    {log.actionType}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(log.createdAt).toLocaleTimeString('pt-BR')}
                  </span>
                </div>
                <p className="text-slate-700 leading-snug">{log.reason}</p>
                <div className="text-[10px] text-slate-400">
                  Responsável: {log.actorName}
                </div>
              </div>
            ))}
          </div>
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
    </div>
  );
};
