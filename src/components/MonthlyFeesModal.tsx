import React, { useState, useMemo } from 'react';
import {
  X,
  Check,
  AlertCircle,
  Calendar,
  DollarSign,
  Copy,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  MessageCircle,
  Filter,
  ShieldCheck,
  Clock,
  Sparkles,
  Settings,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { PlayerProfile } from '../types/league';

interface MonthlyFeesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function formatYearMonth(ym: string): string {
  const [yearStr, monthStr] = ym.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return ym;
  return `${MONTH_NAMES[month - 1]} / ${year}`;
}

function getAdjacentMonth(ym: string, offset: number): string {
  const [yearStr, monthStr] = ym.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) + offset;
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface ConfirmTarget {
  player: PlayerProfile;
  targetPaid: boolean;
}

export const MonthlyFeesModal: React.FC<MonthlyFeesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    profiles,
    selectedCityId,
    monthlyPayments,
    monthlyConfig,
    toggleMonthlyPayment,
    updateMonthlyConfig,
    currentUser,
  } = useLeague();

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentYearMonth);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [copiedPix, setCopiedPix] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(false);

  // Estado do POPUP DE CONFIRMAÇÃO exigido pelo usuário
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);

  // Campos para edição de configuração
  const [editAmount, setEditAmount] = useState<number>(monthlyConfig?.monthlyAmount || 30);
  const [editPixKey, setEditPixKey] = useState<string>(monthlyConfig?.pixKey || '77988001122');
  const [editPixReceiver, setEditPixReceiver] = useState<string>(
    monthlyConfig?.pixReceiverName || 'Rosália Esportes / Real Planalto FC'
  );

  const cityPlayers = useMemo(() => {
    return profiles
      .filter((p) => p.cityId === selectedCityId)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [profiles, selectedCityId]);

  // Mapa de pagamentos para o mês selecionado
  const paymentMap = useMemo(() => {
    const map = new Map<string, boolean>();
    (monthlyPayments || []).forEach((item) => {
      if (item.yearMonth === selectedMonth) {
        map.set(item.playerId, item.isPaid);
      }
    });
    return map;
  }, [monthlyPayments, selectedMonth]);

  const stats = useMemo(() => {
    let paidCount = 0;
    let pendingCount = 0;
    cityPlayers.forEach((p) => {
      if (paymentMap.get(p.id)) {
        paidCount++;
      } else {
        pendingCount++;
      }
    });

    const fee = monthlyConfig?.monthlyAmount || 30;
    const totalCollected = paidCount * fee;
    const totalPotential = cityPlayers.length * fee;

    return {
      paidCount,
      pendingCount,
      totalCount: cityPlayers.length,
      totalCollected,
      totalPotential,
      percent: cityPlayers.length > 0 ? Math.round((paidCount / cityPlayers.length) * 100) : 0,
    };
  }, [cityPlayers, paymentMap, monthlyConfig]);

  const filteredPlayers = useMemo(() => {
    if (filter === 'paid') {
      return cityPlayers.filter((p) => paymentMap.get(p.id));
    }
    if (filter === 'pending') {
      return cityPlayers.filter((p) => !paymentMap.get(p.id));
    }
    return cityPlayers;
  }, [cityPlayers, paymentMap, filter]);

  if (!isOpen) return null;

  const handleCopyPix = () => {
    const pix = monthlyConfig?.pixKey || '77988001122';
    try {
      navigator.clipboard.writeText(pix);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2000);
    } catch {
      // Fallback
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2000);
    }
  };

  const handleSendReminder = (player: PlayerProfile) => {
    const monthName = formatYearMonth(selectedMonth);
    const amount = monthlyConfig?.monthlyAmount || 30;
    const pix = monthlyConfig?.pixKey || '77988001122';
    const receiver = monthlyConfig?.pixReceiverName || 'Rosália Esportes / Real Planalto FC';

    const message = `Fala ${player.displayName}! ⚽\nPassando para lembrar da mensalidade da pelada de *${monthName}* no valor de *R$ ${amount},00*.\n\n🔑 Chave PIX: *${pix}*\nTitular: *${receiver}*\n\nAssim que fizer o pagamento, envia o comprovante aqui para darmos baixa no sistema! Tmj! 👊`;

    const cleanPhone = player.whatsappNumber ? player.whatsappNumber.replace(/\D/g, '') : '';
    const url = cleanPhone
      ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateMonthlyConfig({
      monthlyAmount: Number(editAmount) || 30,
      pixKey: editPixKey.trim(),
      pixReceiverName: editPixReceiver.trim(),
    });
    setShowConfig(false);
  };

  const executeStatusChange = () => {
    if (!confirmTarget) return;
    toggleMonthlyPayment(confirmTarget.player.id, selectedMonth, confirmTarget.targetPaid);
    setConfirmTarget(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Cabeçalho do Modal */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 px-4 py-3.5 text-white shrink-0 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 border border-white/20 text-emerald-400 shadow-inner">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-black uppercase tracking-wide font-display text-white">
                  Mensalidades da Pelada
                </h2>
                <p className="text-[11px] text-blue-200">
                  Controle de pagamento rápido e simples
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                className={`p-1.5 rounded-lg border transition ${
                  showConfig
                    ? 'bg-amber-400 text-blue-950 border-amber-300'
                    : 'bg-white/10 text-blue-100 hover:bg-white/20 border-white/10'
                }`}
                title="Configurar valor e chave PIX"
              >
                <Settings className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Seletor do Mês */}
          <div className="mt-3 flex items-center justify-between rounded-xl bg-black/25 px-3 py-1.5 border border-white/10">
            <button
              type="button"
              onClick={() => setSelectedMonth((prev) => getAdjacentMonth(prev, -1))}
              className="p-1 rounded-lg hover:bg-white/10 text-blue-200 hover:text-white transition active:scale-90"
              title="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5 font-mono text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wide">
              <Calendar className="h-3.5 w-3.5 text-amber-400" />
              <span>{formatYearMonth(selectedMonth)}</span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedMonth((prev) => getAdjacentMonth(prev, 1))}
              className="p-1 rounded-lg hover:bg-white/10 text-blue-200 hover:text-white transition active:scale-90"
              title="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Painel expansível de Configuração do PIX e Valor */}
        {showConfig && (
          <form
            onSubmit={handleSaveConfig}
            className="bg-amber-50/90 border-b border-amber-200 p-3.5 space-y-3 shrink-0 text-slate-800"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-900 uppercase flex items-center gap-1.5">
                <Settings className="h-3.5 w-3.5 text-amber-700" />
                Configurar Mensalidade & PIX
              </span>
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="text-[10px] text-amber-700 hover:underline font-bold"
              >
                Cancelar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-left">
              <div>
                <label className="text-[10px] font-bold text-slate-700 uppercase">
                  Valor da Mensalidade (R$)
                </label>
                <div className="relative mt-0.5">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">
                    R$
                  </span>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={editAmount}
                    onChange={(e) => setEditAmount(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-700 uppercase">
                  Chave PIX
                </label>
                <input
                  type="text"
                  value={editPixKey}
                  onChange={(e) => setEditPixKey(e.target.value)}
                  placeholder="Ex: (77) 98800-1122"
                  className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-700 uppercase">
                Nome do Favorecido / Titular do PIX
              </label>
              <input
                type="text"
                value={editPixReceiver}
                onChange={(e) => setEditPixReceiver(e.target.value)}
                placeholder="Ex: Rosália Esportes / Real Planalto FC"
                className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2 shadow-xs transition active:scale-95"
            >
              Salvar Alterações
            </button>
          </form>
        )}

        {/* Conteúdo rolável */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Card Resumo do Mês */}
          <div className="grid grid-cols-3 gap-2">
            {/* Pagos */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-emerald-700">
                <Check className="h-3.5 w-3.5 stroke-[3]" />
                <span className="font-mono text-base font-black">
                  {stats.paidCount}
                </span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mt-0.5">
                Pagos
              </div>
            </div>

            {/* Pendentes */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-rose-700">
                <Clock className="h-3.5 w-3.5 stroke-[2.5]" />
                <span className="font-mono text-base font-black">
                  {stats.pendingCount}
                </span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-800 mt-0.5">
                Pendentes
              </div>
            </div>

            {/* Total Arrecadado */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-2 text-center">
              <div className="font-mono text-base font-black text-blue-900 truncate">
                R$ {stats.totalCollected}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800 mt-0.5">
                Arrecadado
              </div>
            </div>
          </div>

          {/* Barra de Progresso de Arrecadação */}
          <div className="rounded-xl bg-slate-100 p-2 border border-slate-200/80">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 mb-1">
              <span>Arrecadação: {stats.percent}% da meta</span>
              <span className="font-mono">
                R$ {stats.totalCollected} / R$ {stats.totalPotential}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>

          {/* Card Oficial do PIX da Pelada */}
          <div className="rounded-xl border border-emerald-300 bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-900 p-3 text-white shadow-sm relative overflow-hidden">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Chave PIX Oficial
                </span>
                <p className="font-mono text-sm sm:text-base font-black text-white tracking-wide truncate mt-0.5">
                  {monthlyConfig?.pixKey || '77988001122'}
                </p>
                <p className="text-[10px] text-emerald-200 truncate mt-0.5">
                  Titular: {monthlyConfig?.pixReceiverName || 'Rosália Esportes / Real Planalto FC'}
                </p>
                <p className="text-[10px] text-amber-300 font-bold mt-0.5">
                  Valor: R$ {monthlyConfig?.monthlyAmount || 30},00 por atleta
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyPix}
                className="shrink-0 flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] px-3 py-1.5 shadow-sm active:scale-95 transition"
              >
                {copiedPix ? (
                  <>
                    <CheckCheck className="h-3.5 w-3.5 text-slate-950" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-950" />
                    <span>Copiar PIX</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Filtros rápidos */}
          <div className="flex items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                filter === 'all'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({stats.totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('paid')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition flex items-center gap-1 ${
                filter === 'paid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <Check className="h-3 w-3 stroke-[3]" />
              Pagos ({stats.paidCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('pending')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition flex items-center gap-1 ${
                filter === 'pending'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <Clock className="h-3 w-3" />
              Pendentes ({stats.pendingCount})
            </button>
          </div>

          {/* Lista de Atletas */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
            {filteredPlayers.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Nenhum atleta nesta categoria.
              </div>
            ) : (
              filteredPlayers.map((player) => {
                const isPaid = paymentMap.get(player.id) === true;

                return (
                  <div
                    key={player.id}
                    className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 transition"
                  >
                    {/* Dados do Atleta */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-blue-50 border border-blue-100 font-display text-xs font-bold text-blue-700">
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
                        <p className="text-xs font-black text-slate-900 uppercase truncate">
                          {player.displayName}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {player.position === 'goleiro'
                            ? '🧤 Goleiro'
                            : `🏃 ${player.position}`}
                          {player.neighborhood ? ` · ${player.neighborhood}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Botão de Cobrança amigável via WhatsApp (se pendente) */}
                      {!isPaid && (
                        <button
                          type="button"
                          onClick={() => handleSendReminder(player)}
                          className="flex items-center gap-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] px-2 py-1.5 shadow-2xs active:scale-95 transition"
                          title="Enviar lembrete amigável no WhatsApp"
                        >
                          <MessageCircle className="h-3 w-3 fill-white" />
                          <span className="hidden sm:inline">Cobrar</span>
                        </button>
                      )}

                      {/* Botão de Status (1 Toque abre o popup de confirmação) */}
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmTarget({
                            player,
                            targetPaid: !isPaid,
                          })
                        }
                        className={`flex items-center gap-1 rounded-lg font-black text-[11px] px-2.5 py-1.5 shadow-2xs active:scale-95 transition border ${
                          isPaid
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300'
                        }`}
                        title={
                          isPaid
                            ? 'Clique para alterar para Pendente'
                            : 'Clique para confirmar pagamento'
                        }
                      >
                        {isPaid ? (
                          <>
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                            <span>Pago</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3" />
                            <span>Pendente</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Rodapé com Fechar */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            Total de {cityPlayers.length} atletas cadastrados
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition shadow-2xs"
          >
            Concluir
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* POPUP DE CONFIRMAÇÃO OBRIGATÓRIO (Exigido pelo usuário)                   */}
      {/* "ao mudar para pago ou pendente aparecer popup de confirmação"            */}
      {/* ========================================================================= */}
      {confirmTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 text-center space-y-4">
            {/* Ícone de Destaque */}
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
              {confirmTarget.targetPaid ? (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
                  <Check className="h-8 w-8 stroke-[3]" />
                </div>
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 shadow-inner">
                  <AlertTriangle className="h-8 w-8 stroke-[2.5]" />
                </div>
              )}
            </div>

            {/* Título & Mensagem */}
            <div>
              <h3 className="text-base font-black uppercase tracking-wide text-slate-900 font-display">
                {confirmTarget.targetPaid
                  ? 'Confirmar Pagamento?'
                  : 'Alterar para Pendente?'}
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                {confirmTarget.targetPaid
                  ? `Deseja confirmar o pagamento da mensalidade de ${confirmTarget.player.displayName}?`
                  : `Tem certeza que deseja marcar ${confirmTarget.player.displayName} como PENDENTE?`}
              </p>
            </div>

            {/* Card com Detalhes da Operação */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-left text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Atleta:</span>
                <span className="font-bold text-slate-800 uppercase">
                  {confirmTarget.player.displayName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Referência:</span>
                <span className="font-bold text-slate-800">
                  {formatYearMonth(selectedMonth)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Valor:</span>
                <span className="font-black text-emerald-600">
                  R$ {monthlyConfig?.monthlyAmount || 30},00
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1 mt-1 text-[11px]">
                <span className="text-slate-500">Novo Status:</span>
                <span
                  className={`font-black ${
                    confirmTarget.targetPaid ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {confirmTarget.targetPaid ? '🟢 PAGO' : '🔴 PENDENTE'}
                </span>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={executeStatusChange}
                className={`w-full rounded-xl py-2.5 text-xs font-black text-white shadow-md active:scale-95 transition ${
                  confirmTarget.targetPaid
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {confirmTarget.targetPaid
                  ? 'Sim, Confirmar'
                  : 'Sim, Marcar Pendente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
