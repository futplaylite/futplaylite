import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
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
  UserCheck,
  HelpCircle,
  Send,
  ExternalLink,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { PlayerProfile } from '../types/league';

interface MonthlyFeesViewProps {
  onBack: () => void;
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

const MONTH_SHORT_NAMES = [
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
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

export const MonthlyFeesView: React.FC<MonthlyFeesViewProps> = ({ onBack }) => {
  const {
    profiles,
    currentPlayerProfile,
    monthlyPayments,
    monthlyConfig,
    toggleMonthlyPayment,
    updateMonthlyConfig,
    currentUser,
  } = useLeague();

  // Identificação do perfil do usuário atual
  const myProfile = currentPlayerProfile || profiles.find((p) => p.userId === currentUser?.id);

  // Nome do time do usuário
  const userTeamName = (
    currentUser?.teamName ||
    myProfile?.teamName ||
    'Meu Time'
  ).trim();

  // Verifica se o usuário atual é treinador ou administrador
  const isCoachOrAdmin =
    currentUser?.role === 'coach' ||
    currentUser?.role === 'admin' ||
    currentUser?.isTeamOwner === true ||
    myProfile?.isTeamOwner === true;

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentYearMonth);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [copiedPix, setCopiedPix] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(false);

  // Estado do POPUP DE CONFIRMAÇÃO exigido pelo usuário (Área do Treinador)
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);

  // Campos para edição de configuração do PIX e Valor
  const [editAmount, setEditAmount] = useState<number>(monthlyConfig?.monthlyAmount || 30);
  const [editPixKey, setEditPixKey] = useState<string>(monthlyConfig?.pixKey || '77988001122');
  const [editPixReceiver, setEditPixReceiver] = useState<string>(
    monthlyConfig?.pixReceiverName || 'Rosália Esportes'
  );

  // Mantém os campos de configuração sincronizados com o banco
  useEffect(() => {
    if (monthlyConfig) {
      setEditAmount(monthlyConfig.monthlyAmount);
      setEditPixKey(monthlyConfig.pixKey);
      setEditPixReceiver(monthlyConfig.pixReceiverName);
    }
  }, [monthlyConfig]);

  // Normalização para busca de time
  const normalize = (s: string) =>
    (s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const userTeamNormalized = normalize(userTeamName);

  // Atletas que pertencem EXCLUSIVAMENTE ao time do treinador
  const teamPlayers = useMemo(() => {
    if (!userTeamNormalized || userTeamNormalized === 'meu time' || userTeamNormalized === 'sem time') {
      return profiles.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
    const matches = profiles.filter(
      (p) => normalize(p.teamName || '') === userTeamNormalized
    );
    if (matches.length === 0) {
      return myProfile ? [myProfile] : profiles;
    }
    return matches.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [profiles, userTeamNormalized, myProfile]);

  // Localiza o treinador/responsável do time para envio do comprovante via WhatsApp
  const coachProfile = useMemo(() => {
    return (
      profiles.find((p) => {
        if (!p.isTeamOwner) return false;
        if (!userTeamNormalized) return true;
        return normalize(p.teamName || '') === userTeamNormalized;
      }) || profiles.find((p) => p.isTeamOwner)
    );
  }, [profiles, userTeamNormalized]);

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

  // Estatísticas do time no mês (Área exclusiva do Treinador/Admin)
  const stats = useMemo(() => {
    let paidCount = 0;
    let pendingCount = 0;
    teamPlayers.forEach((p) => {
      if (paymentMap.get(p.id)) {
        paidCount++;
      } else {
        pendingCount++;
      }
    });

    const fee = monthlyConfig?.monthlyAmount || 30;
    const totalCollected = paidCount * fee;
    const totalPotential = teamPlayers.length * fee;

    return {
      paidCount,
      pendingCount,
      totalCount: teamPlayers.length,
      totalCollected,
      totalPotential,
      percent: teamPlayers.length > 0 ? Math.round((paidCount / teamPlayers.length) * 100) : 0,
    };
  }, [teamPlayers, paymentMap, monthlyConfig]);

  // Atletas filtrados para exibição na lista do Treinador
  const filteredPlayers = useMemo(() => {
    if (filter === 'paid') {
      return teamPlayers.filter((p) => paymentMap.get(p.id));
    }
    if (filter === 'pending') {
      return teamPlayers.filter((p) => !paymentMap.get(p.id));
    }
    return teamPlayers;
  }, [teamPlayers, paymentMap, filter]);

  // =========================================================================
  // DADOS ESPECÍFICOS DO CONTROLE PESSOAL DO JOGADOR
  // =========================================================================
  const myPlayerId = myProfile?.id || '';
  const myPaymentRecord = useMemo(() => {
    return (monthlyPayments || []).find(
      (m) =>
        (m.playerId === myPlayerId || (myProfile?.userId && m.playerId === myProfile.userId)) &&
        m.yearMonth === selectedMonth
    );
  }, [monthlyPayments, myPlayerId, myProfile?.userId, selectedMonth]);

  const isMyPaid = myPaymentRecord?.isPaid === true;

  // Ano atual selecionado para o histórico de 12 meses do atleta
  const selectedYear = parseInt(selectedMonth.split('-')[0], 10) || new Date().getFullYear();

  // Histórico anual pessoal do atleta (12 meses do ano)
  const myYearlyHistory = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const ym = `${selectedYear}-${String(monthNum).padStart(2, '0')}`;
      const record = (monthlyPayments || []).find(
        (m) =>
          (m.playerId === myPlayerId || (myProfile?.userId && m.playerId === myProfile.userId)) &&
          m.yearMonth === ym
      );
      return {
        monthIndex: i,
        shortLabel: MONTH_SHORT_NAMES[i],
        fullName: MONTH_NAMES[i],
        yearMonth: ym,
        isPaid: record?.isPaid === true,
        paidAt: record?.paidAt,
        amount: record?.amount || monthlyConfig?.monthlyAmount || 30,
      };
    });
  }, [selectedYear, monthlyPayments, myPlayerId, myProfile?.userId, monthlyConfig?.monthlyAmount]);

  const myPaidCount = myYearlyHistory.filter((m) => m.isPaid).length;
  const myPendingCount = 12 - myPaidCount;

  // Copiar chave PIX
  const handleCopyPix = () => {
    const pix = monthlyConfig?.pixKey || '77988001122';
    try {
      navigator.clipboard.writeText(pix);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2000);
    } catch {
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2000);
    }
  };

  // Enviar lembrete via WhatsApp (Treinador para o atleta)
  const handleSendReminder = (player: PlayerProfile) => {
    const monthName = formatYearMonth(selectedMonth);
    const amount = monthlyConfig?.monthlyAmount || 30;
    const pix = monthlyConfig?.pixKey || '77988001122';
    const receiver = monthlyConfig?.pixReceiverName || 'Rosália Esportes';

    const message = `Fala ${player.displayName}! ⚽\nPassando para lembrar da mensalidade da pelada de *${monthName}* no valor de *R$ ${amount},00* (*${userTeamName}*).\n\n🔑 Chave PIX: *${pix}*\nTitular: *${receiver}*\n\nAssim que fizer o pagamento, envia o comprovante aqui para darmos baixa no sistema! Tmj! 👊`;

    const cleanPhone = player.whatsappNumber ? player.whatsappNumber.replace(/\D/g, '') : '';
    const url = cleanPhone
      ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');
  };

  // Enviar comprovante via WhatsApp (Atleta para o treinador)
  const handleSendProofToCoach = () => {
    const coachPhone = coachProfile?.whatsappNumber ? coachProfile.whatsappNumber.replace(/\D/g, '') : '';
    const myName = myProfile?.displayName || 'Atleta';
    const monthName = formatYearMonth(selectedMonth);
    const amount = monthlyConfig?.monthlyAmount || 30;

    const message = `Fala Professor${coachProfile?.displayName ? ' ' + coachProfile.displayName : ''}! ⚽\nAcabei de realizar o pagamento da mensalidade da pelada de *${monthName}* no valor de *R$ ${amount},00* (${userTeamName}).\n\nEstou enviando o comprovante aqui para conferência e baixa no sistema!\nAtleta: *${myName}* 👊`;

    const url = coachPhone
      ? `https://wa.me/55${coachPhone}?text=${encodeURIComponent(message)}`
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
    <div className="w-full space-y-3 pb-8 animate-fadeIn">
      {/* Botão Superior para Voltar */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-blue-700 shadow-xs active:scale-[0.99] transition cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Voltar</span>
      </button>

      {/* Card Cabeçalho Oficial */}
      <div className="w-full rounded-2xl border border-blue-200/80 bg-gradient-to-b from-blue-700 via-blue-800 to-blue-950 p-4 text-white shadow-md relative overflow-hidden">
        {/* Imagem de Fundo Oficial do Estádio com Refletores */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-80"
          style={{
            backgroundImage: "url('/images/stadium-super-capas.jpg')",
          }}
        />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#0a1435]/70 via-[#07112c]/80 to-[#030612]/92 pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/20 text-emerald-400 shadow-inner">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black uppercase tracking-wide font-display text-white">
                  {isCoachOrAdmin ? 'Mensalidades da Pelada' : 'Minha Mensalidade'}
                </h1>
                <p className="text-[11px] text-blue-200">
                  {isCoachOrAdmin
                    ? `Gestão financeira do elenco · ${userTeamName}`
                    : `Controle pessoal do atleta · ${userTeamName}`}
                </p>
              </div>
            </div>

            {/* Botão de Configuração de PIX e Valor (Exclusivo do Treinador/Admin) */}
            {isCoachOrAdmin && (
              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                className={`p-2 rounded-xl border transition active:scale-95 cursor-pointer ${
                  showConfig
                    ? 'bg-amber-400 text-blue-950 border-amber-300 shadow-sm'
                    : 'bg-white/10 text-blue-100 hover:bg-white/20 border-white/15'
                }`}
                title="Configurar valor e chave PIX da equipe"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Seletor do Mês de Referência */}
          <div className="flex items-center justify-between rounded-xl bg-black/35 px-3 py-2 border border-white/15">
            <button
              type="button"
              onClick={() => setSelectedMonth((prev) => getAdjacentMonth(prev, -1))}
              className="p-1 rounded-lg hover:bg-white/10 text-blue-200 hover:text-white transition active:scale-90 cursor-pointer"
              title="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5 font-mono text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wide">
              <Calendar className="h-4 w-4 text-amber-400" />
              <span>{formatYearMonth(selectedMonth)}</span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedMonth((prev) => getAdjacentMonth(prev, 1))}
              className="p-1 rounded-lg hover:bg-white/10 text-blue-200 hover:text-white transition active:scale-90 cursor-pointer"
              title="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Painel expansível de Configuração do PIX e Valor (Apenas Treinador/Admin) */}
      {isCoachOrAdmin && showConfig && (
        <form
          onSubmit={handleSaveConfig}
          className="rounded-2xl bg-amber-50/95 border border-amber-200 p-3.5 space-y-3 text-slate-800 shadow-sm animate-fadeIn"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-900 uppercase flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5 text-amber-700" />
              Configurar Mensalidade & PIX do Time
            </span>
            <button
              type="button"
              onClick={() => setShowConfig(false)}
              className="text-[10px] text-amber-700 hover:underline font-bold cursor-pointer"
            >
              Fechar
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
              placeholder="Ex: Rosália Esportes"
              className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2 shadow-xs transition active:scale-95 cursor-pointer"
          >
            Salvar Configurações
          </button>
        </form>
      )}

      {/* ========================================================================= */}
      {/* CARD OFICIAL DO PIX DA PELADA COM 1-TOQUE PARA COPIAR                      */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-emerald-300/80 bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-900 p-3.5 text-white shadow-sm relative overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Chave PIX Oficial da Pelada
            </span>
            <p className="font-mono text-base font-black text-white tracking-wide truncate mt-0.5">
              {monthlyConfig?.pixKey || '77988001122'}
            </p>
            <p className="text-[10px] text-emerald-200 truncate mt-0.5">
              Titular: {monthlyConfig?.pixReceiverName || 'Rosália Esportes'}
            </p>
            <p className="text-[10px] text-amber-300 font-bold mt-0.5">
              Valor Mensal: R$ {monthlyConfig?.monthlyAmount || 30},00 por atleta
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopyPix}
            className="shrink-0 flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] px-3.5 py-2 shadow-sm active:scale-95 transition cursor-pointer"
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

      {/* ========================================================================= */}
      {/* MODO 1: CONTROLE PESSOAL DO JOGADOR (Acesso estrito aos dados pessoais)   */}
      {/* ========================================================================= */}
      {!isCoachOrAdmin && (
        <div className="space-y-3 animate-fadeIn">
          {/* Card de Status Pessoal do Mês Selecionado */}
          <div
            className={`rounded-2xl border p-4 shadow-sm transition space-y-3 ${
              isMyPaid
                ? 'bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white border-emerald-300'
                : 'bg-gradient-to-br from-rose-50 via-amber-50/40 to-white border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2 border-b pb-3 border-slate-200/60">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold shadow-2xs ${
                    isMyPaid
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {isMyPaid ? (
                    <Check className="h-6 w-6 stroke-[3]" />
                  ) : (
                    <Clock className="h-6 w-6 stroke-[2.5]" />
                  )}
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Status da Minha Mensalidade
                  </div>
                  <div className="text-sm sm:text-base font-black text-slate-900">
                    {formatYearMonth(selectedMonth)}
                  </div>
                </div>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide border shadow-2xs ${
                  isMyPaid
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                }`}
              >
                {isMyPaid ? '🟢 Pago' : '🔴 Pendente'}
              </span>
            </div>

            {/* Informações de Pagamento do Atleta */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white/80 border border-slate-200 p-2.5">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  Valor da Mensalidade
                </div>
                <div className="font-mono text-sm sm:text-base font-black text-slate-900 mt-0.5">
                  R$ {monthlyConfig?.monthlyAmount || 30},00
                </div>
              </div>

              <div className="rounded-xl bg-white/80 border border-slate-200 p-2.5">
                <div className="text-[10px] font-bold text-slate-500 uppercase">
                  Confirmação no Sistema
                </div>
                <div className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                  {isMyPaid ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <Check className="h-3 w-3 stroke-[3]" />
                      Confirmado
                    </span>
                  ) : (
                    <span className="text-rose-600 font-bold">
                      Aguardando PIX
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Orientação e Botão de Enviar Comprovante para o WhatsApp do Treinador */}
            {!isMyPaid ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2 text-left">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Copie a chave PIX acima, faça a transferência pelo aplicativo do seu banco e clique no botão abaixo para enviar o comprovante ao treinador para dar baixa no sistema.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSendProofToCoach}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 shadow-sm active:scale-95 transition cursor-pointer"
                >
                  <MessageCircle className="h-4 w-4 fill-white" />
                  <span>Enviar Comprovante no WhatsApp do Treinador</span>
                </button>
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-center text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                <span>Parabéns! Sua mensalidade deste mês está 100% quitada e regularizada.</span>
              </div>
            )}
          </div>

          {/* Histórico Anual Pessoal (Grade dos 12 Meses) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-2.5 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-800">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span>Meu Histórico de {selectedYear}</span>
              </div>
              <div className="text-[11px] font-bold text-slate-500">
                <span className="text-emerald-700">{myPaidCount} pagos</span> ·{' '}
                <span className="text-rose-600">{myPendingCount} pendentes</span>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
              {myYearlyHistory.map((m) => {
                const isSelected = m.yearMonth === selectedMonth;

                return (
                  <button
                    key={m.yearMonth}
                    type="button"
                    onClick={() => setSelectedMonth(m.yearMonth)}
                    className={`rounded-xl p-2.5 text-center border transition active:scale-95 cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/30 shadow-xs'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-black text-slate-800">
                      {m.shortLabel}
                    </div>
                    <div className="mt-1">
                      {m.isPaid ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[9px] px-1.5 py-0.2">
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                          PAGO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-100 text-rose-800 font-black text-[9px] px-1.5 py-0.2">
                          <Clock className="h-2.5 w-2.5" />
                          PENDENTE
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODO 2: PAINEL COMPLETO DO TREINADOR / COMISSÃO TÉCNICA                   */}
      {/* (Visão gerencial do elenco, arrecadação, baixas e cobranças)              */}
      {/* ========================================================================= */}
      {isCoachOrAdmin && (
        <div className="space-y-3 animate-fadeIn">
          {/* Resumo do Mês da Equipe */}
          <div className="grid grid-cols-3 gap-2">
            {/* Pagos */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-2.5 text-center shadow-2xs">
              <div className="flex items-center justify-center gap-1 text-emerald-700">
                <Check className="h-4 w-4 stroke-[3]" />
                <span className="font-mono text-lg font-black">{stats.paidCount}</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mt-0.5">
                Pagos
              </div>
            </div>

            {/* Pendentes */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-2.5 text-center shadow-2xs">
              <div className="flex items-center justify-center gap-1 text-rose-700">
                <Clock className="h-4 w-4 stroke-[2.5]" />
                <span className="font-mono text-lg font-black">{stats.pendingCount}</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-800 mt-0.5">
                Pendentes
              </div>
            </div>

            {/* Total Arrecadado */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-2.5 text-center shadow-2xs">
              <div className="font-mono text-lg font-black text-blue-900 truncate">
                R$ {stats.totalCollected}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800 mt-0.5">
                Arrecadado
              </div>
            </div>
          </div>

          {/* Barra de Progresso de Arrecadação */}
          <div className="rounded-xl bg-white p-2.5 border border-slate-200 shadow-2xs text-left">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 mb-1.5">
              <span>Progresso de Arrecadação: {stats.percent}%</span>
              <span className="font-mono font-bold text-slate-900">
                R$ {stats.totalCollected} / R$ {stats.totalPotential}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>

          {/* Filtros Rápidos */}
          <div className="flex items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                filter === 'all'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Todos ({stats.totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('paid')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                filter === 'paid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <Check className="h-3.5 w-3.5 stroke-[3]" />
              Pagos ({stats.paidCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('pending')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                filter === 'pending'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              Pendentes ({stats.pendingCount})
            </button>
          </div>

          {/* Lista de Atletas do Time */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100 shadow-xs">
            {filteredPlayers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Nenhum atleta nesta categoria.
              </div>
            ) : (
              filteredPlayers.map((player) => {
                const isPaid = paymentMap.get(player.id) === true;

                return (
                  <div
                    key={player.id}
                    className="p-3 flex items-center justify-between gap-2.5 hover:bg-slate-50 transition"
                  >
                    {/* Dados do Atleta */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-50 border border-blue-100 font-display text-xs font-bold text-blue-700 shadow-2xs">
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

                      <div className="min-w-0 text-left">
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
                          className="flex items-center gap-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] px-2 py-1.5 shadow-2xs active:scale-95 transition cursor-pointer"
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
                        className={`flex items-center gap-1 rounded-xl font-black text-xs px-3 py-1.5 shadow-2xs active:scale-95 transition border cursor-pointer ${
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
      )}

      {/* ========================================================================= */}
      {/* POPUP DE CONFIRMAÇÃO OBRIGATÓRIO (Exclusivo do Treinador/Admin)          */}
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
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={executeStatusChange}
                className={`w-full rounded-xl py-2.5 text-xs font-black text-white shadow-md active:scale-95 transition cursor-pointer ${
                  confirmTarget.targetPaid
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {confirmTarget.targetPaid ? 'Sim, Confirmar' : 'Sim, Marcar Pendente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
