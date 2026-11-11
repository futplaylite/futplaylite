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
  Wallet,
  Receipt,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Search,
  Award,
  Trophy,
  MapPin,
  Flame,
  Eye,
  Info,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { PlayerProfile, TeamTransaction, TransactionType, TransactionCategory } from '../types/league';
import { TeamCrestBadge } from './TeamCrestBadge';

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

function formatDateDisplay(dStr: string): string {
  if (!dStr) return '';
  const parts = dStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dStr;
}

interface ConfirmTarget {
  player: PlayerProfile;
  targetPaid: boolean;
}

export const CATEGORY_INFO: Record<
  string,
  { label: string; icon: any; color: string; bg: string; border: string }
> = {
  aluguel: {
    label: 'Aluguel Campo/Quadra',
    icon: MapPin,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  equipamento: {
    label: 'Bolas & Equipamentos',
    icon: Flame,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  uniforme: {
    label: 'Coletes & Uniformes',
    icon: Sparkles,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
  },
  arbitragem: {
    label: 'Arbitragem & Juiz',
    icon: ShieldCheck,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
  },
  confraternizacao: {
    label: 'Resenha & Confraternização',
    icon: Users,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
  patrocinio: {
    label: 'Patrocínio & Apoio',
    icon: Award,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  mensalidade: {
    label: 'Mensalidades da Pelada',
    icon: CreditCard,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  premiacao: {
    label: 'Premiação & Troféus',
    icon: Trophy,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
  },
  outro: {
    label: 'Outras Movimentações',
    icon: DollarSign,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
  },
};

export const MonthlyFeesView: React.FC<MonthlyFeesViewProps> = ({ onBack }) => {
  const {
    profiles,
    currentPlayerProfile,
    monthlyPayments,
    monthlyConfig,
    toggleMonthlyPayment,
    updateMonthlyConfig,
    currentUser,
    teamTransactions,
    addTeamTransaction,
    deleteTeamTransaction,
  } = useLeague();

  // Aba principal: 'caixa' (Receitas & Despesas do Time) ou 'mensalidades' (Status & PIX)
  const [activeTab, setActiveTab] = useState<'caixa' | 'mensalidades'>('caixa');

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

  // Estado do POPUP DE CONFIRMAÇÃO exigido pelo usuário (Área do Treinador - Mensalidades)
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

  // Atletas que pertencem EXCLUSIVAMENTE ao time do usuário
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

  // Mapa de pagamentos de mensalidades para o mês selecionado
  const paymentMap = useMemo(() => {
    const map = new Map<string, boolean>();
    (monthlyPayments || []).forEach((item) => {
      if (item.yearMonth === selectedMonth) {
        map.set(item.playerId, item.isPaid);
      }
    });
    return map;
  }, [monthlyPayments, selectedMonth]);

  // Estatísticas de mensalidades do time no mês
  const monthlyStats = useMemo(() => {
    const fee = monthlyConfig?.monthlyAmount || 30;
    let paidCount = 0;
    let pendingCount = 0;

    teamPlayers.forEach((p) => {
      if (paymentMap.get(p.id)) {
        paidCount++;
      } else {
        pendingCount++;
      }
    });

    const totalPaidAmount = paidCount * fee;
    const totalPendingAmount = pendingCount * fee;
    const totalExpectedAmount = (paidCount + pendingCount) * fee;
    const pct =
      totalExpectedAmount > 0
        ? Math.round((totalPaidAmount / totalExpectedAmount) * 100)
        : 0;

    return {
      paidCount,
      pendingCount,
      totalPaidAmount,
      totalPendingAmount,
      totalExpectedAmount,
      pct,
    };
  }, [teamPlayers, paymentMap, monthlyConfig]);

  // Dados do Jogador Atual para o Modo Pessoal
  const myPlayerId = myProfile?.id;
  const isMyPaid = myPlayerId ? paymentMap.get(myPlayerId) === true : false;

  // Ano atual selecionado para o histórico do atleta
  const selectedYear = useMemo(() => {
    const [y] = selectedMonth.split('-');
    return parseInt(y, 10) || new Date().getFullYear();
  }, [selectedMonth]);

  // Histórico anual pessoal do atleta (12 meses do ano selecionado)
  const myYearlyHistory = useMemo(() => {
    if (!myPlayerId) return [];
    return MONTH_NAMES.map((name, index) => {
      const mStr = String(index + 1).padStart(2, '0');
      const ym = `${selectedYear}-${mStr}`;
      const record = (monthlyPayments || []).find(
        (rec) =>
          (rec.playerId === myPlayerId || (myProfile?.userId && rec.playerId === myProfile.userId)) &&
          rec.yearMonth === ym
      );
      return {
        monthIndex: index,
        monthName: name,
        monthShort: MONTH_SHORT_NAMES[index],
        yearMonth: ym,
        isPaid: record ? record.isPaid : false,
        amount: record?.amount || monthlyConfig?.monthlyAmount || 30,
      };
    });
  }, [selectedYear, monthlyPayments, myPlayerId, myProfile?.userId, monthlyConfig?.monthlyAmount]);

  // ==========================================
  // ESTADOS DO GERENCIADOR DE RECEITAS E DESPESAS (CAIXA)
  // ==========================================
  const [showAddTransactionModal, setShowAddTransactionModal] = useState<boolean>(false);
  const [txType, setTxType] = useState<TransactionType>('despesa');
  const [txDescription, setTxDescription] = useState<string>('');
  const [txAmount, setTxAmount] = useState<string>('');
  const [txCategory, setTxCategory] = useState<TransactionCategory>('aluguel');
  const [txDate, setTxDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [txNotes, setTxNotes] = useState<string>('');
  const [txToDelete, setTxToDelete] = useState<TeamTransaction | null>(null);

  // Filtros da aba de Caixa
  const [txFilter, setTxFilter] = useState<'all' | 'receita' | 'despesa'>('all');
  const [txSearch, setTxSearch] = useState<string>('');

  // Transações pertencentes ao time do usuário
  const myTeamTransactions = useMemo(() => {
    return (teamTransactions || []).filter((tx) => {
      if (!userTeamNormalized || userTeamNormalized === 'meu time' || userTeamNormalized === 'sem time') {
        return true;
      }
      return normalize(tx.teamName) === userTeamNormalized;
    });
  }, [teamTransactions, userTeamNormalized]);

  // Totais do Caixa do Time
  const financialTotals = useMemo(() => {
    let totalReceitas = 0;
    let totalDespesas = 0;

    myTeamTransactions.forEach((tx) => {
      const val = Number(tx.amount) || 0;
      if (tx.type === 'receita') {
        totalReceitas += val;
      } else {
        totalDespesas += val;
      }
    });

    const saldo = totalReceitas - totalDespesas;
    return {
      totalReceitas,
      totalDespesas,
      saldo,
    };
  }, [myTeamTransactions]);

  // Transações filtradas para exibição
  const filteredTransactions = useMemo(() => {
    let list = [...myTeamTransactions];

    if (txFilter === 'receita') {
      list = list.filter((t) => t.type === 'receita');
    } else if (txFilter === 'despesa') {
      list = list.filter((t) => t.type === 'despesa');
    }

    if (txSearch.trim()) {
      const q = normalize(txSearch);
      list = list.filter(
        (t) =>
          normalize(t.description).includes(q) ||
          normalize(t.category).includes(q) ||
          normalize(t.createdByName || '').includes(q)
      );
    }

    // Ordena da mais recente para a mais antiga
    return list.sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || 0).getTime();
      const dateB = new Date(b.date || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [myTeamTransactions, txFilter, txSearch]);

  // Salvar novo lançamento de Receita ou Despesa
  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseFloat(txAmount.replace(',', '.'));
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      alert('Informe um valor numérico válido maior que zero.');
      return;
    }
    if (!txDescription.trim()) {
      alert('Informe uma descrição clara para a transação.');
      return;
    }

    addTeamTransaction({
      teamName: userTeamName,
      type: txType,
      category: txCategory,
      description: txDescription.trim(),
      amount: cleanAmount,
      date: txDate || new Date().toISOString().split('T')[0],
      notes: txNotes.trim() || undefined,
      createdByName: myProfile?.displayName || currentUser?.email?.split('@')[0] || 'Comissão',
      createdByUserId: currentUser?.id,
    });

    setTxDescription('');
    setTxAmount('');
    setTxNotes('');
    setShowAddTransactionModal(false);
  };

  // Confirmar exclusão de lançamento
  const handleConfirmDeleteTx = () => {
    if (!txToDelete) return;
    deleteTeamTransaction(txToDelete.id);
    setTxToDelete(null);
  };

  // Copiar chave PIX
  const handleCopyPix = () => {
    const pix = monthlyConfig?.pixKey || '77988001122';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pix);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2500);
    }
  };

  // Enviar lembrete de cobrança no WhatsApp para atleta pendente
  const handleSendWhatsAppReminder = (player: PlayerProfile) => {
    const num = (player.whatsappNumber || '').replace(/\D/g, '');
    if (!num) {
      alert(`O atleta ${player.displayName} ainda não possui número de WhatsApp cadastrado.`);
      return;
    }
    const fee = monthlyConfig?.monthlyAmount || 30;
    const pix = monthlyConfig?.pixKey || '77988001122';
    const receiver = monthlyConfig?.pixReceiverName || 'Rosália Esportes';
    const monthName = formatYearMonth(selectedMonth);

    const message = `Fala ${player.displayName}! ⚽\nPassando para lembrar da mensalidade da pelada de *${monthName}* no valor de *R$ ${fee},00* (*${userTeamName}*).\n\n🔑 Chave PIX: *${pix}*\nTitular: *${receiver}*\n\nAssim que fizer o pagamento, envia o comprovante aqui para darmos baixa no sistema! Tmj! 👊`;
    const url = `https://wa.me/55${num}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Enviar comprovante de pagamento para o WhatsApp do Treinador
  const handleSendProofToCoach = () => {
    const num = (coachProfile?.whatsappNumber || '').replace(/\D/g, '');
    const myName = myProfile?.displayName || currentUser?.email?.split('@')[0] || 'Atleta';
    const monthName = formatYearMonth(selectedMonth);
    const fee = monthlyConfig?.monthlyAmount || 30;

    const message = `Fala Professor${coachProfile?.displayName ? ' ' + coachProfile.displayName : ''}! ⚽\nAcabei de realizar o pagamento da mensalidade da pelada de *${monthName}* no valor de *R$ ${fee},00* (${userTeamName}).\n\nEstou enviando o comprovante aqui para conferência e baixa no sistema!\nAtleta: *${myName}* 🤝`;

    if (num) {
      window.open(`https://wa.me/55${num}?text=${encodeURIComponent(message)}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  // Salvar configurações do time (Treinador)
  const handleSaveConfig = () => {
    updateMonthlyConfig({
      monthlyAmount: editAmount,
      pixKey: editPixKey.trim(),
      pixReceiverName: editPixReceiver.trim(),
    });
    setShowConfig(false);
  };

  // Executa a confirmação da mudança de status (Treinador)
  const executeToggleConfirm = () => {
    if (!confirmTarget) return;
    toggleMonthlyPayment(
      confirmTarget.player.id,
      selectedMonth,
      confirmTarget.targetPaid,
      monthlyConfig?.monthlyAmount || 30
    );
    setConfirmTarget(null);
  };

  return (
    <div className="space-y-4 pb-20 animate-fadeIn">
      {/* Cabeçalho Principal com Botão Voltar e Escudo do Time */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-95 cursor-pointer shrink-0"
              title="Voltar ao Painel Principal"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <TeamCrestBadge name={userTeamName} size={32} />
              <div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none">
                  Financeiro do Time
                </h1>
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                  {userTeamName} • Transparência para todos
                </p>
              </div>
            </div>
          </div>

          {/* Botão de Configurações do PIX e Valor (Apenas Treinador) */}
          {isCoachOrAdmin && (
            <button
              type="button"
              onClick={() => setShowConfig(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-95 cursor-pointer shrink-0"
              title="Configurar Mensalidade e Chave PIX"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Alternador de Abas: [Caixa & Extrato] vs [Mensalidades] */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('caixa')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black transition cursor-pointer ${
              activeTab === 'caixa'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wallet className="h-4 w-4 text-emerald-600" />
            <span>Caixa & Extrato</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mensalidades')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black transition cursor-pointer ${
              activeTab === 'mensalidades'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="h-4 w-4 text-blue-600" />
            <span>Mensalidades</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ABA 1: CAIXA & EXTRATO (RECEITAS E DESPESAS DO TIME)      */}
      {/* ========================================================= */}
      {activeTab === 'caixa' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Card de Saldo Principal */}
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px]">
                <Wallet className="h-4 w-4 text-emerald-400" />
                <span>Saldo Atual do Time</span>
              </div>
              <span className="font-mono text-[10px] bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
                Caixa da Equipe
              </span>
            </div>

            <div className="my-2">
              <div
                className={`font-mono text-3xl sm:text-4xl font-black tracking-tight ${
                  financialTotals.saldo >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                R$ {financialTotals.saldo.toFixed(2).replace('.', ',')}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Transparência aberta: visível para todos os atletas do time</span>
              </p>
            </div>

            {/* Grid com Entradas e Saídas */}
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-700/60">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Total Receitas</span>
                </div>
                <div className="font-mono text-base sm:text-lg font-black text-emerald-300 mt-1">
                  + R$ {financialTotals.totalReceitas.toFixed(2).replace('.', ',')}
                </div>
              </div>

              <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-rose-300">
                  <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
                  <span>Total Despesas</span>
                </div>
                <div className="font-mono text-base sm:text-lg font-black text-rose-300 mt-1">
                  - R$ {financialTotals.totalDespesas.toFixed(2).replace('.', ',')}
                </div>
              </div>
            </div>
          </div>

          {/* Integração Inteligente com Mensalidades: Card Informativo */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 shadow-2xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold shrink-0 shadow-2xs">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                  Mensalidades de {formatYearMonth(selectedMonth)}
                </div>
                <div className="text-xs font-bold text-slate-800 mt-0.5">
                  <span className="font-mono font-black text-emerald-700">
                    R$ {monthlyStats.totalPaidAmount},00
                  </span>{' '}
                  arrecadados ({monthlyStats.paidCount} de {teamPlayers.length} atletas)
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('mensalidades')}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition active:scale-95 cursor-pointer shrink-0 shadow-2xs flex items-center gap-1"
            >
              <span>Ver Status</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Barra de Ações: Botão Novo Lançamento + Filtros de Tipo */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-800">
                <Receipt className="h-4 w-4 text-emerald-600" />
                <span>Extrato de Movimentações</span>
              </div>

              {isCoachOrAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    setTxType('despesa');
                    setShowAddTransactionModal(true);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3 py-2 shadow-xs active:scale-95 transition cursor-pointer"
                >
                  <Plus className="h-4 w-4 stroke-[3]" />
                  <span>Novo Lançamento</span>
                </button>
              ) : (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-full">
                  Modo Participante
                </span>
              )}
            </div>

            {/* Filtros rápidos: [Todos] | [Entradas] | [Saídas] + Busca */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setTxFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                    txFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos ({myTeamTransactions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTxFilter('receita')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                    txFilter === 'receita'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  <span>Receitas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTxFilter('despesa')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                    txFilter === 'despesa'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  <span>Despesas</span>
                </button>
              </div>

              {/* Campo de Busca Rápida */}
              <div className="relative flex-1 max-w-xs">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder="Buscar lançamento..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Lista de Transações / Movimentações */}
          {filteredTransactions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Receipt className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  Nenhum lançamento financeiro encontrado
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {myTeamTransactions.length === 0
                    ? 'O time ainda não possui receitas ou despesas registradas. Aluguel de quadra, bolas, coletes e patrocínios aparecerão aqui.'
                    : 'Nenhum lançamento corresponde ao filtro ou busca selecionada.'}
                </p>
              </div>

              {isCoachOrAdmin && myTeamTransactions.length === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setTxType('despesa');
                    setShowAddTransactionModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 shadow-xs active:scale-95 transition cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Lançar Primeiro Registro</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTransactions.map((tx) => {
                const cat = CATEGORY_INFO[tx.category] || CATEGORY_INFO.outro;
                const CatIcon = cat.icon;
                const isReceita = tx.type === 'receita';

                return (
                  <div
                    key={tx.id}
                    className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:border-slate-300 transition flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl border shrink-0 ${cat.bg} ${cat.border} ${cat.color}`}
                      >
                        <CatIcon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-md border ${
                              isReceita
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            {isReceita ? 'Entrada' : 'Saída'}
                          </span>
                          <span className="text-[10px] text-slate-400">•</span>
                          <span className="text-[10px] font-bold text-slate-500">
                            {formatDateDisplay(tx.date)}
                          </span>
                        </div>

                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate mt-0.5">
                          {tx.description}
                        </h4>

                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                          <span>{cat.label}</span>
                          {tx.createdByName && (
                            <>
                              <span>•</span>
                              <span className="truncate">Por: {tx.createdByName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div
                          className={`font-mono text-sm sm:text-base font-black ${
                            isReceita ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {isReceita ? '+' : '-'} R${' '}
                          {Number(tx.amount).toFixed(2).replace('.', ',')}
                        </div>
                        {tx.notes && (
                          <div className="text-[9px] text-slate-400 truncate max-w-[120px]">
                            {tx.notes}
                          </div>
                        )}
                      </div>

                      {/* Botão de Excluir (Apenas Treinador/Admin) */}
                      {isCoachOrAdmin && (
                        <button
                          type="button"
                          onClick={() => setTxToDelete(tx)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Excluir este lançamento"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Dica de Transparência */}
          <div className="rounded-2xl border border-slate-200 bg-slate-100/60 p-3 text-center">
            <p className="text-[11px] text-slate-600 flex items-center justify-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span>
                Todas as entradas e saídas ficam salvas no caixa para prestação de contas aos atletas.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 2: MENSALIDADES (PIX & STATUS DOS JOGADORES)           */}
      {/* ========================================================= */}
      {activeTab === 'mensalidades' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Card da Chave PIX Oficial do Time (Com Cópia em 1 Clique) */}
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 p-3.5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold uppercase tracking-wide text-emerald-800 flex items-center gap-1.5 text-[11px]">
                <CreditCard className="h-3.5 w-3.5 text-emerald-600" />
                PIX Oficial do Time
              </span>
              <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                {monthlyConfig?.pixKeyType || 'Celular'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-xl bg-white border border-emerald-200/80 p-2.5">
              <div className="min-w-0">
                <div className="font-mono text-sm sm:text-base font-black text-slate-900 truncate">
                  {monthlyConfig?.pixKey || '77988001122'}
                </div>
                <div className="text-[10px] text-slate-500 font-semibold truncate mt-0.5">
                  Titular: {monthlyConfig?.pixReceiverName || 'Rosália Esportes'} • R${' '}
                  {monthlyConfig?.monthlyAmount || 30},00 por atleta
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyPix}
                className="flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-black transition active:scale-95 cursor-pointer shrink-0 shadow-2xs"
              >
                {copiedPix ? (
                  <>
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Seletor de Mês de Referência */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelectedMonth((prev) => getAdjacentMonth(prev, -1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-95 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="text-center">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Mês de Referência
              </div>
              <div className="text-sm font-extrabold text-slate-900">
                {formatYearMonth(selectedMonth)}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedMonth((prev) => getAdjacentMonth(prev, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-95 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* ==================================================== */}
          {/* MODO 1: CONTROLE PESSOAL DO ATLETA (!isCoachOrAdmin) */}
          {/* ==================================================== */}
          {!isCoachOrAdmin && (
            <div className="space-y-4">
              {/* Card de Status do Jogador no Mês */}
              <div
                className={`rounded-3xl border p-4 sm:p-5 shadow-xs space-y-3.5 ${
                  isMyPaid
                    ? 'border-emerald-300 bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/50'
                    : 'border-rose-300 bg-gradient-to-br from-rose-50/90 via-white to-rose-50/50'
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
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 shadow-xs active:scale-95 transition cursor-pointer"
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
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5 text-left">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-800">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <span>Meu Histórico de {selectedYear}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">
                    Toque no mês para ver detalhes
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {myYearlyHistory.map((item) => {
                    const isSelected = item.yearMonth === selectedMonth;
                    return (
                      <button
                        key={item.yearMonth}
                        type="button"
                        onClick={() => setSelectedMonth(item.yearMonth)}
                        className={`p-2.5 rounded-xl border text-left transition active:scale-95 cursor-pointer relative ${
                          isSelected
                            ? 'ring-2 ring-blue-500 border-blue-400 bg-blue-50/50'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-extrabold text-slate-800">
                            {item.monthShort}
                          </span>
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black ${
                              item.isPaid
                                ? 'bg-emerald-600 text-white'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {item.isPaid ? '✓' : '•'}
                          </span>
                        </div>
                        <div className="text-[9px] font-semibold text-slate-500 mt-1">
                          {item.isPaid ? (
                            <span className="text-emerald-700 font-bold">Pago</span>
                          ) : (
                            <span className="text-rose-600 font-bold">Pendente</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* MODO 2: PAINEL DO TREINADOR / COMISSÃO TÉCNICA       */}
          {/* ==================================================== */}
          {isCoachOrAdmin && (
            <div className="space-y-4">
              {/* Cards de Métricas da Pelada */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-center">
                  <div className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">
                    Total Recebido
                  </div>
                  <div className="font-mono text-base sm:text-lg font-black text-emerald-700 mt-0.5">
                    R$ {monthlyStats.totalPaidAmount}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold">
                    {monthlyStats.paidCount} atletas
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3 text-center">
                  <div className="text-[10px] font-extrabold text-rose-800 uppercase tracking-wider">
                    Pendente
                  </div>
                  <div className="font-mono text-base sm:text-lg font-black text-rose-700 mt-0.5">
                    R$ {monthlyStats.totalPendingAmount}
                  </div>
                  <div className="text-[10px] text-rose-600 font-semibold">
                    {monthlyStats.pendingCount} atletas
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3 text-center">
                  <div className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider">
                    Total Previsto
                  </div>
                  <div className="font-mono text-base sm:text-lg font-black text-blue-700 mt-0.5">
                    R$ {monthlyStats.totalExpectedAmount}
                  </div>
                  <div className="text-[10px] text-blue-600 font-semibold">
                    {teamPlayers.length} atletas
                  </div>
                </div>
              </div>

              {/* Barra de Progresso de Quitação */}
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    Progresso de Quitação do Mês
                  </span>
                  <span className="font-mono font-black text-emerald-600">
                    {monthlyStats.pct}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                    style={{ width: `${monthlyStats.pct}%` }}
                  />
                </div>
              </div>

              {/* Filtros da Lista de Atletas */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-800">
                  <Users className="h-4 w-4 text-slate-600" />
                  <span>Elenco do Time ({teamPlayers.length})</span>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      filter === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('paid')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      filter === 'paid'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    Pagos ({monthlyStats.paidCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilter('pending')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      filter === 'pending'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    Pendentes ({monthlyStats.pendingCount})
                  </button>
                </div>
              </div>

              {/* Lista dos Atletas do Time */}
              <div className="space-y-2">
                {teamPlayers
                  .filter((p) => {
                    const isPaid = paymentMap.get(p.id) === true;
                    if (filter === 'paid') return isPaid;
                    if (filter === 'pending') return !isPaid;
                    return true;
                  })
                  .map((player) => {
                    const isPaid = paymentMap.get(player.id) === true;
                    return (
                      <div
                        key={player.id}
                        className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs flex items-center justify-between gap-3 hover:border-slate-300 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {player.avatarUrl ? (
                            <img
                              src={player.avatarUrl}
                              alt={player.displayName}
                              className="h-10 w-10 rounded-xl object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-700 text-xs border border-slate-200 shrink-0">
                              {player.displayName.slice(0, 2).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                              {player.displayName}
                            </h4>
                            <p className="text-[10px] text-slate-500 font-semibold truncate capitalize">
                              {player.position}
                            </p>
                          </div>
                        </div>

                        {/* Ações do Atleta */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => handleSendWhatsAppReminder(player)}
                              className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition active:scale-95 cursor-pointer"
                              title="Cobrar via WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </button>
                          )}

                          {/* Botão de Alterar Status com Confirmação Popup Obrigatória */}
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmTarget({
                                player,
                                targetPaid: !isPaid,
                              });
                            }}
                            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition active:scale-95 cursor-pointer shadow-2xs ${
                              isPaid
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                            }`}
                          >
                            {isPaid ? (
                              <>
                                <Check className="h-3.5 w-3.5 stroke-[3]" />
                                <span>Pago</span>
                              </>
                            ) : (
                              <>
                                <Clock className="h-3.5 w-3.5" />
                                <span>Pendente</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 1: NOVO LANÇAMENTO FINANCEIRO (RECEITA/DESPESA) */}
      {/* ==================================================== */}
      {showAddTransactionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 font-bold">
                  <Receipt className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                    Novo Lançamento
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {userTeamName} • Caixa do Time
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTransactionModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="space-y-3.5 text-left">
              {/* Tipo: Entrada ou Saída */}
              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide block mb-1">
                  Tipo de Movimentação
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTxType('receita');
                      setTxCategory('patrocinio');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition border flex items-center justify-center gap-1.5 cursor-pointer ${
                      txType === 'receita'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <TrendingUp className="h-4 w-4" />
                    <span>🟢 Entrada / Receita</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTxType('despesa');
                      setTxCategory('aluguel');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition border flex items-center justify-center gap-1.5 cursor-pointer ${
                      txType === 'despesa'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <TrendingDown className="h-4 w-4" />
                    <span>🔴 Saída / Despesa</span>
                  </button>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide block mb-1">
                  Descrição do Lançamento
                </label>
                <input
                  type="text"
                  required
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder={
                    txType === 'receita'
                      ? 'Ex: Patrocínio Bar do Zé, Rifa...'
                      : 'Ex: Aluguel da quadra de quarta, Compra de bolas...'
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Valor em R$ e Data */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide block mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.5"
                    required
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="150.00"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide block mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Categoria */}
              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide block mb-1">
                  Categoria
                </label>
                <select
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value as TransactionCategory)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="aluguel">🏟️ Aluguel Campo / Quadra</option>
                  <option value="equipamento">⚽ Bolas & Equipamentos</option>
                  <option value="uniforme">👕 Coletes & Uniformes</option>
                  <option value="arbitragem">🏆 Arbitragem & Juiz</option>
                  <option value="confraternizacao">🥩 Resenha & Confraternização</option>
                  <option value="patrocinio">🤝 Patrocínio & Apoio</option>
                  <option value="mensalidade">💳 Mensalidade da Pelada</option>
                  <option value="premiacao">🥇 Premiação & Troféus</option>
                  <option value="outro">📄 Outras Movimentações</option>
                </select>
              </div>

              {/* Observação Opcional */}
              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide block mb-1">
                  Observações (Opcional)
                </label>
                <input
                  type="text"
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  placeholder="Ex: Pago via PIX pelo Rogério"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Botões do Formulário */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTransactionModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-black text-white shadow-xs transition active:scale-95"
                >
                  Salvar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: CONFIRMAÇÃO DE EXCLUSÃO DE LANÇAMENTO       */}
      {/* ==================================================== */}
      {txToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 font-bold">
                <Trash2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                  Excluir Lançamento?
                </h3>
                <p className="text-[10px] text-slate-500">
                  Esta ação removerá o registro do caixa
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              Deseja realmente remover o lançamento{' '}
              <strong className="text-slate-900">"{txToDelete.description}"</strong> no valor de{' '}
              <strong className="text-slate-900">
                R$ {Number(txToDelete.amount).toFixed(2).replace('.', ',')}
              </strong>
              ?
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTx}
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 py-2.5 text-xs font-black text-white shadow-xs transition active:scale-95 cursor-pointer"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 3: CONFIRMAÇÃO DE STATUS DE MENSALIDADE        */}
      {/* ==================================================== */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl font-bold ${
                  confirmTarget.targetPaid
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-rose-50 text-rose-600'
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                  Confirmar Alteração
                </h3>
                <p className="text-[10px] text-slate-500">
                  {formatYearMonth(selectedMonth)}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              Deseja alterar a mensalidade de{' '}
              <strong className="text-slate-900">{confirmTarget.player.displayName}</strong>{' '}
              para:{' '}
              <span
                className={`font-black ${
                  confirmTarget.targetPaid ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {confirmTarget.targetPaid ? '🟢 PAGO' : '🔴 PENDENTE'}
              </span>
              ?
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeToggleConfirm}
                className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-black text-white shadow-xs transition active:scale-95 cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 4: CONFIGURAÇÃO DE PIX E VALOR (TREINADOR)     */}
      {/* ==================================================== */}
      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold">
                  <Settings className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                    Configurar PIX do Time
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Defina a chave e o valor padrão
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-left">
              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide block mb-1">
                  Valor da Mensalidade (R$)
                </label>
                <input
                  type="number"
                  min="5"
                  max="500"
                  value={editAmount}
                  onChange={(e) => setEditAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide block mb-1">
                  Chave PIX
                </label>
                <input
                  type="text"
                  value={editPixKey}
                  onChange={(e) => setEditPixKey(e.target.value)}
                  placeholder="Chave PIX (Telefone, CPF, E-mail ou Aleatória)"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide block mb-1">
                  Nome do Titular da Conta
                </label>
                <input
                  type="text"
                  value={editPixReceiver}
                  onChange={(e) => setEditPixReceiver(e.target.value)}
                  placeholder="Nome do Treinador ou Dono da Chave"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-black text-white shadow-xs transition active:scale-95 cursor-pointer"
              >
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { MonthlyFeesView as TeamFinancialView };
