import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Share2,
  Trash2,
  AlertTriangle,
  UserCheck,
  Lock,
  Unlock,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { ShareSumulaReceiptModal } from './ShareSumulaReceiptModal';
import { SumulaData } from '../types/league';
export type { SumulaData };

const STORAGE_KEY = 'futplay_sumula_pelada_ativa_v1';
export const ALL_SUMULAS_STORAGE_KEY = 'futplay_todas_sumulas_peladas_v1';

/**
 * Identifica se um atleta é do tipo Goleiro (pelo flag explícito ou pelo nome esportivo)
 */
export const isGoalkeeperPlayer = (name: string, isGoalkeeperFlag?: boolean): boolean => {
  if (isGoalkeeperFlag !== undefined) return isGoalkeeperFlag;
  const upper = (name || '').trim().toUpperCase();
  return upper.includes('GOLEIRO') || upper.endsWith('(GK)') || upper.startsWith('GK');
};

/**
 * Sincroniza automaticamente a lista de Goleiros Fixos com os atletas tipo Goleiro
 * que estiverem com presença confirmada na Lista de Presença.
 */
export const syncFixedGoalkeepers = (
  arrivalList?: SumulaData['arrivalList']
): { num: string; name: string }[] => {
  const list = arrivalList || [];
  const confirmedGkNames = list
    .filter((a) => a.confirmed && isGoalkeeperPlayer(a.playerName, a.isGoalkeeper))
    .map((a) => a.playerName.toUpperCase());

  const slotCount = Math.max(4, confirmedGkNames.length);
  const slots: { num: string; name: string }[] = [];

  for (let i = 0; i < slotCount; i++) {
    slots.push({
      num: String(i + 1).padStart(2, '0'),
      name: confirmedGkNames[i] || '',
    });
  }

  return slots;
};

/**
 * Cria uma súmula em branco e limpa (sem dados fictícios de demonstração).
 */
export const createCleanSumula = (params?: {
  id?: string;
  teamName?: string;
  createdByUserId?: string;
  createdByName?: string;
  arrivalList?: SumulaData['arrivalList'];
}): SumulaData => {
  const arrivals = params?.arrivalList || [];
  return {
    id: params?.id || `sumula-pelada-${Date.now()}`,
    status: 'em_andamento',
    matchDate: new Date().toLocaleDateString('pt-BR'),
    startTime: '20:15',
    lastUpdated: new Date().toISOString(),
    teamName: params?.teamName,
    createdByUserId: params?.createdByUserId,
    createdByName: params?.createdByName,
    timerSeconds: 0,
    isTimerRunning: false,
    arrivalList: arrivals,
    yellowCards: [],
    blueCards: [],
    redCards: [],
    goalkeepers: syncFixedGoalkeepers(arrivals),
    teamsGrid: [
      { teamName: 'Time 01', matches: ['-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-'] },
      { teamName: 'Time 02', matches: ['-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-'] },
      { teamName: 'Time 03', matches: ['-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-'] },
      { teamName: 'Time 04', matches: ['-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-'] },
    ],
    teamLineups: {
      'Time 01': [],
      'Time 02': [],
      'Time 03': [],
      'Time 04': [],
    },
    highlightGoals: [],
  };
};

export const DEFAULT_INITIAL_SUMULA: SumulaData = createCleanSumula({ id: 'template' });

export const buildDefaultArrivalList = (): SumulaData['arrivalList'] => [];

/**
 * Retorna apenas as súmulas reais cadastradas, expurgando automaticamente a súmula antiga de teste
 */
export const getStoredSumulas = (): SumulaData[] => {
  try {
    const listRaw = localStorage.getItem(ALL_SUMULAS_STORAGE_KEY);
    if (listRaw !== null) {
      const parsed = JSON.parse(listRaw);
      if (Array.isArray(parsed)) {
        // Remove sumula de teste/demonstração legada
        const realSumulas = parsed.filter(
          (s) => s && s.id && s.id !== 'pelada-rodada-atual' && s.id !== 'demo-sumula' && s.id !== 'template'
        );
        if (realSumulas.length !== parsed.length) {
          localStorage.setItem(ALL_SUMULAS_STORAGE_KEY, JSON.stringify(realSumulas));
        }
        return realSumulas;
      }
    }
  } catch (e) {
    console.warn('Erro ao ler todas as súmulas:', e);
  }

  // Limpa também do storage legado ativo se for a de demonstração
  try {
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy) {
      const parsedLegacy = JSON.parse(legacy);
      if (
        parsedLegacy &&
        (parsedLegacy.id === 'pelada-rodada-atual' ||
          parsedLegacy.id === 'demo-sumula' ||
          parsedLegacy.id === 'template')
      ) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch {}

  return [];
};

export const saveSumulaToList = (sumulaToSave: SumulaData) => {
  try {
    const list = getStoredSumulas();
    const idx = list.findIndex((s) => s.id === sumulaToSave.id);
    let updatedList: SumulaData[];
    if (idx >= 0) {
      updatedList = list.map((s) => (s.id === sumulaToSave.id ? sumulaToSave : s));
    } else {
      updatedList = [sumulaToSave, ...list];
    }
    localStorage.setItem(ALL_SUMULAS_STORAGE_KEY, JSON.stringify(updatedList));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sumulaToSave));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('futplay_sumulas_changed', {
          detail: { savedId: sumulaToSave.id, count: updatedList.length },
        })
      );
    }
  } catch (e) {
    console.warn('Erro ao salvar súmula na lista:', e);
  }
};

export const deleteSumulaFromList = (sumulaId: string) => {
  try {
    const list = getStoredSumulas();
    const updatedList = list.filter((s) => s.id !== sumulaId);
    localStorage.setItem(ALL_SUMULAS_STORAGE_KEY, JSON.stringify(updatedList));
    if (localStorage.getItem(STORAGE_KEY)) {
      try {
        const active = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (active.id === sumulaId) {
          if (updatedList.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList[0]));
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch {}
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('futplay_sumulas_changed', {
          detail: { deletedId: sumulaId, count: updatedList.length },
        })
      );
    }
  } catch (e) {
    console.warn('Erro ao excluir súmula:', e);
  }
};

interface SumulaPeladaViewProps {
  onBack: () => void;
  onFinish?: (data: SumulaData) => void;
  sumulaId?: string;
  isNew?: boolean;
}

export const SumulaPeladaView: React.FC<SumulaPeladaViewProps> = ({
  onBack,
  onFinish,
  sumulaId,
  isNew,
}) => {
  const {
    currentUser,
    sumulaStopwatch,
    profiles,
    currentPlayerProfile,
    finalizePeladaSumula,
  } = useLeague();
  const isCoachOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'coach' ||
    currentUser?.isTeamOwner === true;

  const [showFinalizeModal, setShowFinalizeModal] = useState<boolean>(false);
  const isDeletedRef = useRef<boolean>(false);
  const userTeam = (currentUser?.teamName || currentPlayerProfile?.teamName || '').trim();

  // Carrega a súmula específica ou cria uma nova com id único para o time correspondente
  const [sumula, setSumula] = useState<SumulaData>(() => {
    // Busca atletas reais cadastrados no time atual
    const teamProfiles = profiles.filter((p) => {
      const pTeam = (p.teamName || '').trim().toLowerCase();
      return Boolean(userTeam) && pTeam === userTeam.toLowerCase();
    });

    const activeAthletes = teamProfiles.length > 0
      ? teamProfiles
      : (currentPlayerProfile ? [currentPlayerProfile] : []);

    const teamArrivals: SumulaData['arrivalList'] = activeAthletes.map((p, idx) => ({
      order: idx + 1,
      playerName: p.displayName.trim().toUpperCase(),
      confirmed: p.userId === currentUser.id,
      isGuest: false,
      isGoalkeeper: p.position === 'goleiro',
      note: p.position === 'goleiro' ? 'Goleiro' : undefined,
    }));

    if (isNew) {
      const newId = `sumula-pelada-${Date.now()}`;
      return createCleanSumula({
        id: newId,
        teamName: userTeam || 'Meu Time',
        createdByUserId: currentUser.id,
        createdByName: currentPlayerProfile?.displayName || currentUser.email.split('@')[0],
        arrivalList: teamArrivals,
      });
    }

    const all = getStoredSumulas();
    let current: SumulaData | undefined;
    if (sumulaId) {
      current = all.find((s) => s.id === sumulaId);
    } else if (all.length > 0) {
      current = all[0];
    }

    if (!current) {
      return createCleanSumula({
        teamName: userTeam,
        createdByUserId: currentUser.id,
        createdByName: currentPlayerProfile?.displayName || currentUser.email.split('@')[0],
        arrivalList: teamArrivals,
      });
    }

    // Merge defensivo garantindo que todas as propriedades da súmula existam
    const arrivalListToUse = current.arrivalList && current.arrivalList.length > 0
      ? current.arrivalList
      : teamArrivals;

    const sanitized: SumulaData = {
      ...DEFAULT_INITIAL_SUMULA,
      ...current,
      teamName: current.teamName || userTeam,
      arrivalList: arrivalListToUse,
      teamsGrid: current.teamsGrid || DEFAULT_INITIAL_SUMULA.teamsGrid,
      teamLineups: current.teamLineups || DEFAULT_INITIAL_SUMULA.teamLineups,
      yellowCards: current.yellowCards || [],
      blueCards: current.blueCards || [],
      redCards: current.redCards || [],
      goalkeepers: current.goalkeepers || syncFixedGoalkeepers(arrivalListToUse),
      highlightGoals: current.highlightGoals || [],
    };

    return sanitized;
  });

  const isLocked = sumula.status === 'finalizada';
  const canEdit = isCoachOrAdmin && !isLocked;

  // Ativa o cronômetro no cabeçalho do app enquanto a súmula estiver aberta
  useEffect(() => {
    sumulaStopwatch.open('Súmula de Treino', sumula.timerSeconds || 0);
    return () => {
      sumulaStopwatch.close();
    };
  }, []);

  const handleExit = () => {
    if (isDeletedRef.current) {
      sumulaStopwatch.close();
      onBack();
      return;
    }
    setSumula((s) => ({
      ...s,
      timerSeconds: sumulaStopwatch.seconds,
      isTimerRunning: sumulaStopwatch.isRunning,
    }));
    sumulaStopwatch.close();
    onBack();
  };

  const [savedBadge, setSavedBadge] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

  // Auto-salvar no localStorage a cada alteração
  useEffect(() => {
    if (isDeletedRef.current) return;
    try {
      const updated = { ...sumula, lastUpdated: new Date().toISOString() };
      saveSumulaToList(updated);
      setSavedBadge(true);
      const timer = setTimeout(() => setSavedBadge(false), 1500);
      return () => clearTimeout(timer);
    } catch (e) {
      console.warn('Erro ao salvar súmula:', e);
    }
  }, [sumula]);

  const handleDeleteCurrentSumula = () => {
    isDeletedRef.current = true;
    deleteSumulaFromList(sumula.id);
    setShowDeleteModal(false);
    sumulaStopwatch.close();
    onBack();
  };

  const [newArrivalName, setNewArrivalName] = useState('');
  const [newArrivalIsGoalkeeper, setNewArrivalIsGoalkeeper] = useState(false);
  const [newCardPlayer, setNewCardPlayer] = useState('');
  const [showCardSuggestions, setShowCardSuggestions] = useState(false);
  const [selectedCardType, setSelectedCardType] = useState<
    'amarelo' | 'azul' | 'vermelho'
  >('amarelo');
  const [newHighlightPlayer, setNewHighlightPlayer] = useState('');
  const [newHighlightTime, setNewHighlightTime] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);

  // Estado para adicionar jogador aos times (Time 01, Time 02, etc.)
  const [activeAddTeam, setActiveAddTeam] = useState<string | null>(null);
  const [openTeamDropdown, setOpenTeamDropdown] = useState<string | null>(null);
  const [newTeamPlayerName, setNewTeamPlayerName] = useState('');
  const [newTeamPlayerIsSub, setNewTeamPlayerIsSub] = useState(false);

  // Lista rica de atletas disponíveis para os times (com posição, pé dominante e presença)
  const availableTeamPlayers = useMemo(() => {
    const sumulaTeam = (sumula.teamName || userTeam || '').trim().toLowerCase();

    const positionMap: Record<string, { label: string; icon: string }> = {
      atacante: { label: 'Atacante', icon: '⚡' },
      'meio-campista': { label: 'Meio-campista', icon: '🎯' },
      defensor: { label: 'Defensor', icon: '🛡️' },
      goleiro: { label: 'Goleiro', icon: '🧤' },
    };

    const footMap: Record<string, string> = {
      direito: 'Destro',
      esquerdo: 'Canhoto',
      ambos: 'Ambidestro',
    };

    const map = new Map<
      string,
      {
        name: string;
        positionLabel: string;
        positionEmoji: string;
        footLabel: string;
        avatarUrl?: string;
        isConfirmedArrival: boolean;
        isGoalkeeper: boolean;
        assignedTeam?: string;
      }
    >();

    // 1. Todos os atletas reais do time cadastrados no banco de dados (excluindo conta admin)
    profiles
      .filter((p) => {
        const isUserAdmin =
          p.userId === 'admin' ||
          p.id === 'admin' ||
          (p.whatsappNumber || '').includes('futplaylite@gmail.com');
        if (isUserAdmin) return false;
        return !sumulaTeam || (p.teamName || '').trim().toLowerCase() === sumulaTeam;
      })
      .forEach((p) => {
        const up = p.displayName.trim().toUpperCase();
        const posKey = (p.position || '').toLowerCase();
        const footKey = (p.dominantFoot || '').toLowerCase();
        const pos = positionMap[posKey] || { label: 'Atleta', icon: '⚽' };
        const foot = footMap[footKey] || 'Não informado';

        map.set(up, {
          name: up,
          positionLabel: pos.label,
          positionEmoji: pos.icon,
          footLabel: foot,
          avatarUrl: p.avatarUrl,
          isConfirmedArrival: false,
          isGoalkeeper: p.position === 'goleiro',
        });
      });

    // 2. Presenças da súmula (arrivalList)
    (sumula.arrivalList || []).forEach((a) => {
      if (!a.playerName) return;
      const up = a.playerName.trim().toUpperCase();
      const existing = map.get(up);
      const isGk = a.isGoalkeeper || existing?.isGoalkeeper || false;

      if (existing) {
        existing.isConfirmedArrival = Boolean(a.confirmed);
        if (isGk && !existing.isGoalkeeper) {
          existing.isGoalkeeper = true;
          existing.positionLabel = 'Goleiro';
          existing.positionEmoji = '🧤';
        }
      } else {
        map.set(up, {
          name: up,
          positionLabel: isGk ? 'Goleiro' : (a.isGuest ? 'Convidado' : 'Atleta'),
          positionEmoji: isGk ? '🧤' : (a.isGuest ? '👤' : '⚽'),
          footLabel: 'Não informado',
          avatarUrl: undefined,
          isConfirmedArrival: Boolean(a.confirmed),
          isGoalkeeper: isGk,
        });
      }
    });

    // 3. Identificar se o atleta já está em algum time na súmula atual
    const result = Array.from(map.values()).map((player) => {
      let assignedTeam: string | undefined = undefined;
      for (const [teamKey, lineup] of Object.entries(sumula.teamLineups || {})) {
        if ((lineup || []).some((item) => item.player.trim().toUpperCase() === player.name)) {
          assignedTeam = teamKey;
          break;
        }
      }
      return { ...player, assignedTeam };
    });

    // Ordenação inteligente: primeiro confirmados sem time, depois cadastrados sem time, depois os já escalados
    return result.sort((a, b) => {
      if (!a.assignedTeam && b.assignedTeam) return -1;
      if (a.assignedTeam && !b.assignedTeam) return 1;
      if (a.isConfirmedArrival && !b.isConfirmedArrival) return -1;
      if (!a.isConfirmedArrival && b.isConfirmedArrival) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [sumula.arrivalList, sumula.teamName, sumula.teamLineups, userTeam, profiles]);

  // 1. Lista de Presença
  const handleAddArrival = () => {
    if (!canEdit || !newArrivalName.trim()) return;
    const name = newArrivalName.trim().toUpperCase();
    const matchedProfile = profiles.find(
      (p) => p.displayName.trim().toUpperCase() === name
    );
    const isGk = newArrivalIsGoalkeeper || matchedProfile?.position === 'goleiro' || isGoalkeeperPlayer(name);
    const isOfficial = Boolean(matchedProfile);

    setSumula((prev) => {
      const updatedArrivals = [
        ...prev.arrivalList,
        {
          order: prev.arrivalList.length + 1,
          playerName: name,
          confirmed: true,
          isGuest: !isOfficial,
          isGoalkeeper: isGk,
          note: isGk ? 'Goleiro' : (!isOfficial ? 'Convidado' : undefined),
        },
      ];
      // Se for goleiro, atualiza automaticamente os Goleiros Fixos da súmula
      const updatedGks = isGk
        ? syncFixedGoalkeepers(updatedArrivals)
        : prev.goalkeepers;

      return {
        ...prev,
        arrivalList: updatedArrivals,
        goalkeepers: updatedGks,
      };
    });

    setNewArrivalName('');
    setNewArrivalIsGoalkeeper(false);
  };

  const handleToggleArrival = (idx: number) => {
    if (!canEdit) return;
    setSumula((prev) => {
      const updatedArrivals = prev.arrivalList.map((item, i) =>
        i === idx ? { ...item, confirmed: !item.confirmed } : item
      );
      // Sempre que confirmar ou desmarcar a presença de qualquer atleta,
      // sincroniza os Goleiros Fixos com os goleiros confirmados
      const updatedGks = syncFixedGoalkeepers(updatedArrivals);

      return {
        ...prev,
        arrivalList: updatedArrivals,
        goalkeepers: updatedGks,
      };
    });
  };

  // 2. Cartões
  const handleAddCard = () => {
    if (!canEdit || !newCardPlayer.trim()) return;
    const name = newCardPlayer.trim().toUpperCase();
    setSumula((prev) => {
      if (selectedCardType === 'amarelo') {
        return { ...prev, yellowCards: [...prev.yellowCards, name] };
      } else if (selectedCardType === 'azul') {
        return { ...prev, blueCards: [...prev.blueCards, name] };
      } else {
        return { ...prev, redCards: [...prev.redCards, name] };
      }
    });
    setNewCardPlayer('');
  };

  const handleRemoveCard = (
    type: 'yellow' | 'blue' | 'red',
    removeIdx: number
  ) => {
    if (!canEdit) return;
    setSumula((prev) => {
      if (type === 'yellow') {
        return {
          ...prev,
          yellowCards: prev.yellowCards.filter((_, i) => i !== removeIdx),
        };
      } else if (type === 'blue') {
        return {
          ...prev,
          blueCards: prev.blueCards.filter((_, i) => i !== removeIdx),
        };
      } else {
        return {
          ...prev,
          redCards: prev.redCards.filter((_, i) => i !== removeIdx),
        };
      }
    });
  };

  // 3. Goleiros
  const handleGkChange = (idx: number, val: string) => {
    if (!canEdit) return;
    setSumula((prev) => ({
      ...prev,
      goalkeepers: prev.goalkeepers.map((g, i) =>
        i === idx ? { ...g, name: val.toUpperCase() } : g
      ),
    }));
  };

  // Temporizadores para validação em 30s e desbloqueio de 5s segurando
  const [nowTime, setNowTime] = useState<number>(Date.now());
  const [unlockingCell, setUnlockingCell] = useState<{
    key: string;
    progress: number; // 0 a 100%
  } | null>(null);
  const pressTimerRef = React.useRef<{
    timeoutId: any;
    intervalId: any;
    key: string;
  } | null>(null);

  // Atualiza relógio local a cada segundo para checar os 30s
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 4. Grade de Pontos (V / E / -)
  const handleGridResultToggle = (tIdx: number, mIdx: number) => {
    if (!canEdit) return;
    const cellKey = `${tIdx}_${mIdx}`;
    const cellTimer = sumula.gridTimers?.[cellKey];
    
    // Se a célula já estiver travada (passou 30s), impede a troca simples por clique
    const isLocked =
      cellTimer?.isLocked ||
      (cellTimer?.updatedAt && nowTime - cellTimer.updatedAt >= 30000);

    if (isLocked) {
      // Travado silenciosamente, não troca por clique e não emite popup
      return;
    }

    setSumula((prev) => {
      const copy = [...prev.teamsGrid];
      const mCopy = [...copy[tIdx].matches];
      const cur = mCopy[mIdx];
      // Alterna apenas entre vazio/derrota ('-'), Vitória ('V') e Empate ('E')
      const next = cur === '-' ? 'V' : cur === 'V' ? 'E' : '-';
      mCopy[mIdx] = next;
      copy[tIdx] = { ...copy[tIdx], matches: mCopy };

      const timers = { ...(prev.gridTimers || {}) };
      if (next === 'V' || next === 'E') {
        timers[cellKey] = {
          updatedAt: Date.now(),
          isLocked: false,
        };
      } else {
        // Se voltou para '-' (normal/sem cor), remove o timer
        delete timers[cellKey];
      }

      return { ...prev, teamsGrid: copy, gridTimers: timers };
    });
  };

  // Iniciar pressão para desbloqueio (3 segundos)
  const handleStartHold = (cellKey: string) => {
    if (!canEdit) return;
    const cellTimer = sumula.gridTimers?.[cellKey];
    const isLocked =
      cellTimer?.isLocked ||
      (cellTimer?.updatedAt && nowTime - cellTimer.updatedAt >= 30000);

    if (!isLocked) return;

    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current.timeoutId);
      clearInterval(pressTimerRef.current.intervalId);
    }

    let progress = 0;
    setUnlockingCell({ key: cellKey, progress: 0 });

    const intervalId = setInterval(() => {
      progress += 3.34; // a cada 100ms sobe ~3.34% (100% em 3s)
      setUnlockingCell({ key: cellKey, progress: Math.min(100, progress) });
    }, 100);

    const timeoutId = setTimeout(() => {
      clearInterval(intervalId);
      setUnlockingCell(null);
      // Destrava a célula diretamente sem popups/avisos
      setSumula((prev) => {
        const timers = { ...(prev.gridTimers || {}) };
        delete timers[cellKey];
        return { ...prev, gridTimers: timers };
      });
    }, 3000);

    pressTimerRef.current = { timeoutId, intervalId, key: cellKey };
  };

  // Cancelar pressão se soltar antes de 5 segundos
  const handleEndHold = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current.timeoutId);
      clearInterval(pressTimerRef.current.intervalId);
      pressTimerRef.current = null;
    }
    setUnlockingCell(null);
  };

  // 5. Gols da Escalação
  const handleGoalChange = (teamKey: string, pIdx: number, delta: number) => {
    if (!canEdit) return;
    setSumula((prev) => {
      const list = [...prev.teamLineups[teamKey]];
      const current = Number(list[pIdx].goals) || 0;
      const next = Math.max(0, current + delta);
      list[pIdx] = { ...list[pIdx], goals: next };
      return {
        ...prev,
        teamLineups: { ...prev.teamLineups, [teamKey]: list },
      };
    });
  };

  // Adicionar jogador a um Time da súmula
  const handleAddPlayerToTeam = (
    teamKey: string,
    specificPlayerName?: string,
    specificIsSub?: boolean
  ) => {
    if (!canEdit) return;
    const name = (specificPlayerName || newTeamPlayerName).trim().toUpperCase();
    if (!name) return;

    const isSub = specificIsSub !== undefined ? specificIsSub : newTeamPlayerIsSub;

    setSumula((prev) => {
      const currentList = prev.teamLineups[teamKey] || [];
      const alreadyExists = currentList.some(
        (p) => p.player.trim().toUpperCase() === name
      );

      if (alreadyExists) {
        alert(`${name} já está escalado no ${teamKey}!`);
        return prev;
      }

      const updatedTeam = [
        ...currentList,
        {
          player: name,
          goals: 0,
          isSub: isSub,
        },
      ];

      return {
        ...prev,
        teamLineups: {
          ...prev.teamLineups,
          [teamKey]: updatedTeam,
        },
      };
    });

    setNewTeamPlayerName('');
    setNewTeamPlayerIsSub(false);
    setActiveAddTeam(null);
    setOpenTeamDropdown(null);
  };

  // Remover jogador de um Time da súmula
  const handleRemovePlayerFromTeam = (teamKey: string, pIdx: number) => {
    if (!canEdit) return;
    const playerToRemove = sumula.teamLineups[teamKey]?.[pIdx];
    if (!playerToRemove) return;

    const goals = Number(playerToRemove.goals) || 0;
    if (goals > 0) {
      const confirmRemove = window.confirm(
        `O jogador ${playerToRemove.player} possui ${goals} gol(s) registrado(s). Deseja realmente removê-lo do ${teamKey}?`
      );
      if (!confirmRemove) return;
    }

    setSumula((prev) => {
      const list = [...(prev.teamLineups[teamKey] || [])];
      list.splice(pIdx, 1);
      return {
        ...prev,
        teamLineups: {
          ...prev.teamLineups,
          [teamKey]: list,
        },
      };
    });
  };

  // 6. Gols Destaque
  const handleAddHighlightGoal = () => {
    if (!canEdit || !newHighlightPlayer.trim()) return;
    setSumula((prev) => ({
      ...prev,
      highlightGoals: [
        ...prev.highlightGoals,
        {
          player: newHighlightPlayer.trim().toUpperCase(),
          time: newHighlightTime.trim() || '22:00',
        },
      ],
    }));
    setNewHighlightPlayer('');
    setNewHighlightTime('');
  };

  // Reiniciar súmula
  const handleReset = () => {
    if (!canEdit) return;
    if (window.confirm('Deseja reiniciar a súmula para uma nova rodada em branco?')) {
      const teamProfiles = profiles.filter((p) => {
        const pTeam = (p.teamName || '').trim().toLowerCase();
        return pTeam === userTeam.trim().toLowerCase();
      });
      const activeAthletes = teamProfiles.length > 0
        ? teamProfiles
        : (currentPlayerProfile ? [currentPlayerProfile] : []);

      const teamArrivals: SumulaData['arrivalList'] = activeAthletes.map((p, idx) => ({
        order: idx + 1,
        playerName: p.displayName.trim().toUpperCase(),
        confirmed: p.userId === currentUser.id,
        isGuest: false,
        isGoalkeeper: p.position === 'goleiro',
        note: p.position === 'goleiro' ? 'Goleiro' : undefined,
      }));

      const fresh: SumulaData = createCleanSumula({
        id: `sumula-pelada-${Date.now()}`,
        teamName: userTeam,
        createdByUserId: currentUser.id,
        createdByName: currentPlayerProfile?.displayName || currentUser.email.split('@')[0],
        arrivalList: teamArrivals,
      });
      setSumula(fresh);
      saveSumulaToList(fresh);
    }
  };

  return (
    <div className="-mx-2.5 sm:mx-0 space-y-3 pb-8 relative">
      {/* Prancheta Física Estilizada com laterais expandidas */}
      <div className="rounded-xl sm:rounded-2xl bg-white shadow-md border border-slate-300 text-slate-800 overflow-hidden">
        {/* CABEÇALHO DO CARD: EXCLUIR ANTES DO TÍTULO + SÚMULA DE TREINO + DATA/HORA */}
        <div className="bg-slate-900 text-white px-3 sm:px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2">
          {/* Lado Esquerdo: Botão Voltar + Excluir Súmula + Título Oficial */}
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={handleExit}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 text-[10px] font-bold transition active:scale-95 shrink-0"
              title="Voltar para a lista de partidas"
            >
              <ArrowLeft className="h-3 w-3 text-blue-400" />
              <span>Voltar</span>
            </button>

            {canEdit && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-950/60 hover:bg-red-900/80 text-red-300 px-2 py-1 text-[10px] font-bold transition active:scale-95 shrink-0 cursor-pointer"
                title="Excluir Súmula"
              >
                <Trash2 className="h-3 w-3 text-red-400" />
                <span>Excluir</span>
              </button>
            )}

            <span className="text-xs font-black uppercase tracking-wider text-slate-200 truncate">
              Data e Horário:
            </span>

            {isLocked ? (
              <span className="rounded bg-emerald-900/80 border border-emerald-500/40 px-2 py-0.5 text-[9px] font-extrabold text-emerald-200 shrink-0 flex items-center gap-1">
                <Lock className="h-2.5 w-2.5" />
                Finalizada
              </span>
            ) : !isCoachOrAdmin ? (
              <span className="rounded bg-blue-900/80 border border-blue-500/30 px-1.5 py-0.2 text-[8px] font-extrabold text-blue-200 shrink-0">
                Leitura
              </span>
            ) : null}
          </div>

          {/* Lado Direito: Data e Início */}
          <div className="flex items-center gap-2 text-xs text-slate-300 shrink-0">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-blue-400 shrink-0" />
              <input
                type="text"
                disabled={!canEdit}
                value={sumula.matchDate}
                onChange={(e) =>
                  setSumula((prev) => ({ ...prev, matchDate: e.target.value }))
                }
                className="bg-transparent border-b border-slate-700 text-white font-mono text-[11px] font-bold w-20 focus:outline-none focus:border-blue-400 disabled:opacity-75 text-center"
                title="Data do jogo"
              />
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-blue-400 shrink-0" />
              <input
                type="text"
                disabled={!canEdit}
                value={sumula.startTime}
                onChange={(e) =>
                  setSumula((prev) => ({ ...prev, startTime: e.target.value }))
                }
                className="bg-transparent border-b border-slate-700 text-white font-mono text-[11px] font-bold w-12 focus:outline-none focus:border-blue-400 disabled:opacity-75 text-center"
                title="Horário de início"
              />
            </span>
          </div>
        </div>

        {/* Banner Informativo de Súmula Finalizada e Homologada */}
        {isLocked && (
          <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 border-b border-emerald-500/40 px-3.5 py-2.5 flex items-center justify-between gap-3 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-black uppercase text-emerald-300 tracking-wider flex items-center gap-1.5">
                  Súmula Finalizada & Homologada
                  <span className="rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 px-1.5 py-0.2 text-[8px] font-mono">
                    IMUTÁVEL
                  </span>
                </p>
                <p className="text-[10px] text-emerald-100/80">
                  Gols, presenças e cartões já foram registrados nas estatísticas oficiais de todos os atletas. Modo somente leitura.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowReceiptModal(true)}
              className="shrink-0 flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] px-2.5 py-1.5 transition active:scale-95 cursor-pointer shadow-xs"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Comprovante</span>
            </button>
          </div>
        )}

        {/* Conteúdo da Prancheta */}
        <div className="p-2 sm:p-3 space-y-3 text-xs bg-[#fdfdfd]">
          {/* Seção 1: Lista de Presença (Todo o elenco com confirmação e tag de convidado) */}
          <div className="rounded-xl border border-blue-200 bg-white p-2.5 shadow-2xs">
            <div className="font-bold text-slate-800 border-b border-slate-100 pb-1.5 mb-2 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide flex items-center gap-1.5 text-blue-900">
                <UserCheck className="h-4 w-4 text-blue-600" />
                Lista de Presença ({sumula.arrivalList.filter((a) => a.confirmed).length}/{sumula.arrivalList.length})
              </span>
              <span className="text-[10px] text-slate-400">
                Toque no atleta para confirmar
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1 divide-y divide-slate-50 pr-1">
              {sumula.arrivalList.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleToggleArrival(idx)}
                  className="pt-1 flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded px-1 transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] font-bold text-slate-400 w-4">
                      {String(item.order).padStart(2, '0')}
                    </span>
                    <span
                      className={`text-[11px] font-bold truncate ${
                        item.confirmed ? 'text-slate-800' : 'text-slate-400 line-through'
                      }`}
                    >
                      {item.playerName}
                    </span>

                    {/* Badge para Usuário do Tipo Goleiro */}
                    {item.isGoalkeeper && (
                      <span className="rounded bg-blue-100 border border-blue-300 px-1.5 py-0.2 text-[9px] font-extrabold text-blue-800 shrink-0 flex items-center gap-0.5">
                        🧤 Goleiro
                      </span>
                    )}

                    {/* Notificação/Badge de Convidado (Linha) */}
                    {!item.isGoalkeeper && item.isGuest && (
                      <span className="rounded bg-purple-100 border border-purple-300 px-1.5 py-0.2 text-[9px] font-extrabold text-purple-800 shrink-0">
                        Convidado
                      </span>
                    )}
                  </div>

                  <span
                    className={`h-4 w-4 rounded flex items-center justify-center text-[10px] shrink-0 ${
                      item.confirmed
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-300 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                </div>
              ))}
            </div>

            {/* Adicionar Atleta / Convidado */}
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Nome do atleta / Convidado..."
                value={newArrivalName}
                onChange={(e) => setNewArrivalName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddArrival()}
                className="flex-1 rounded border border-slate-200 px-2 py-1 text-[10px] uppercase font-semibold"
              />
              <button
                type="button"
                onClick={() => setNewArrivalIsGoalkeeper(!newArrivalIsGoalkeeper)}
                className={`rounded px-2 py-1 text-[10px] font-bold border transition flex items-center gap-1 shrink-0 ${
                  newArrivalIsGoalkeeper
                    ? 'bg-blue-600 border-blue-700 text-white shadow-2xs'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
                title="Alternar entre Jogador de Linha e Goleiro"
              >
                {newArrivalIsGoalkeeper ? '🧤 Goleiro' : '🏃 Linha'}
              </button>
              <button
                type="button"
                onClick={handleAddArrival}
                className="rounded bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-blue-700 active:scale-95 transition shrink-0"
              >
                + Adicionar
              </button>
            </div>
          </div>

          {/* Seção 2: Goleiros Fixos (Sincronizado automaticamente com a Lista de Presença) */}
          <div className="rounded-xl border border-blue-200 bg-white p-2.5 shadow-2xs">
            <div className="font-bold text-slate-800 border-b border-slate-100 pb-1.5 mb-2 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide flex items-center gap-1.5 text-blue-900 font-extrabold">
                🧤 Goleiros Fixos
              </span>
              <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                {sumula.goalkeepers.filter((g) => g.name.trim()).length} de {sumula.goalkeepers.length} Definidos
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {sumula.goalkeepers.map((gk, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-1.5 rounded-lg border p-1.5 transition ${
                    gk.name.trim()
                      ? 'border-blue-300 bg-blue-50/70'
                      : 'border-dashed border-slate-200 bg-slate-50'
                  }`}
                >
                  <span className="font-mono text-[10px] font-black text-blue-700 shrink-0">
                    {gk.num}
                  </span>
                  <input
                    type="text"
                    value={gk.name}
                    placeholder="Aguardando confirmação..."
                    onChange={(e) => handleGkChange(idx, e.target.value)}
                    className={`w-full bg-transparent font-bold text-[11px] uppercase focus:outline-blue-500 ${
                      gk.name.trim()
                        ? 'text-blue-950 font-extrabold'
                        : 'text-slate-400 placeholder:text-slate-300 font-normal'
                    }`}
                  />
                  {gk.name.trim() && (
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 font-black px-1 rounded shrink-0">
                      ✓
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[9px] text-slate-400">
              🧤 Goleiros confirmados na Lista de Presença aparecem automaticamente nas vagas fixas ao iniciar a súmula.
            </p>
          </div>

          {/* Seção 3: Grade de Pontos (Time 01 a 04 com V / E / -) */}
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs">
            <div className="font-bold text-slate-800 border-b border-slate-100 pb-1 mb-2">
              <span className="text-[11px] uppercase tracking-wide">
                Pontos e Partidas dos Times
              </span>
            </div>

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-[10px] font-bold text-slate-600">
                    <th className="p-1 text-left">Time</th>
                    {Array.from({ length: 15 }).map((_, i) => (
                      <th key={i} className="p-1 w-6">
                        J{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {sumula.teamsGrid.map((row, tIdx) => (
                    <tr key={tIdx} className="hover:bg-slate-50">
                      <td className="p-1 text-left font-sans font-bold text-slate-800 text-[10px] whitespace-nowrap">
                        {row.teamName}
                      </td>
                      {row.matches.map((res, mIdx) => {
                        const cellKey = `${tIdx}_${mIdx}`;
                        const cellTimer = sumula.gridTimers?.[cellKey];
                        const isMarked = res !== '-';
                        const elapsed = cellTimer?.updatedAt
                          ? nowTime - cellTimer.updatedAt
                          : 999999;
                        const isLocked =
                          cellTimer?.isLocked || (cellTimer?.updatedAt && elapsed >= 30000);
                        const isUnlockingThis = unlockingCell?.key === cellKey;
                        const secondsLeft = Math.max(0, Math.ceil((30000 - elapsed) / 1000));

                        // Definição de cores:
                        // Se estiver travado (>30s):
                        //   V = VERDE definitivo
                        //   E = AMARELO definitivo
                        //   - (derrota/vazio) = NORMAL sem cor
                        // Se estiver nos primeiros 30s de contagem:
                        //   V = Azul pulsante
                        //   E = Amarelo pulsante
                        let buttonClasses = 'text-slate-400 bg-slate-50 border border-slate-200';

                        if (isLocked) {
                          if (res === 'V') {
                            buttonClasses = 'bg-emerald-600 text-white border border-emerald-700 shadow-2xs font-extrabold';
                          } else if (res === 'E') {
                            buttonClasses = 'bg-amber-400 text-amber-950 border border-amber-500 shadow-2xs font-extrabold';
                          } else {
                            // Derrota fica normal sem cor
                            buttonClasses = 'text-slate-400 bg-slate-50 border border-slate-200';
                          }
                        } else if (cellTimer?.updatedAt && isMarked) {
                          // Em contagem regressiva dos 30s (ainda editável)
                          if (res === 'V') {
                            buttonClasses = 'bg-emerald-500 text-white shadow-xs ring-2 ring-emerald-300 animate-pulse';
                          } else if (res === 'E') {
                            buttonClasses = 'bg-amber-300 text-amber-950 border border-amber-400 ring-2 ring-amber-200 animate-pulse';
                          }
                        } else {
                          // Legado ou padrão inicial
                          if (res === 'V') {
                            buttonClasses = 'bg-emerald-600 text-white shadow-2xs font-bold';
                          } else if (res === 'E') {
                            buttonClasses = 'bg-amber-400 text-amber-950 border border-amber-500 font-bold';
                          } else {
                            buttonClasses = 'text-slate-400 bg-slate-50 border border-slate-200';
                          }
                        }

                        return (
                          <td key={mIdx} className="p-0.5 relative select-none">
                            <button
                              type="button"
                              onClick={() => handleGridResultToggle(tIdx, mIdx)}
                              onMouseDown={() => handleStartHold(cellKey)}
                              onMouseUp={handleEndHold}
                              onMouseLeave={handleEndHold}
                              onTouchStart={() => handleStartHold(cellKey)}
                              onTouchEnd={handleEndHold}
                              onTouchCancel={handleEndHold}
                              className={`w-6 h-6 rounded text-[10px] font-bold transition flex items-center justify-center relative overflow-hidden ${buttonClasses}`}
                              title={
                                isLocked
                                  ? 'Travado definitivo. Segure por 3s para liberar.'
                                  : cellTimer?.updatedAt
                                  ? `Validando em ${secondsLeft}s...`
                                  : 'Toque para marcar'
                              }
                            >
                              {/* Barra de progresso de 3s quando está segurando para destravar */}
                              {isUnlockingThis && (
                                <div
                                  className="absolute bottom-0 left-0 top-0 bg-amber-400/80 transition-all"
                                  style={{ width: `${unlockingCell.progress}%` }}
                                />
                              )}

                              <span className="relative z-10">{res}</span>

                              {/* Ícone discreto de cadeado se travado */}
                              {isLocked && (
                                <span className="absolute -top-0.5 -right-0.5 text-[7px] leading-none text-white/90">
                                  🔒
                                </span>
                              )}
                            </button>

                            {/* Contador regressivo dos 30s abaixo da célula */}
                            {!isLocked && cellTimer?.updatedAt && secondsLeft > 0 && (
                              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[7px] font-mono text-blue-700 font-bold leading-none pointer-events-none">
                                {secondsLeft}s
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Seção 3: Escalação & Gols por Time (Time 01 a Time 04 em 2 Colunas) */}
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(sumula.teamLineups).map(([tName, players]) => {
              const totalTeamGoals = players.reduce(
                (acc, p) => acc + (Number(p.goals) || 0),
                0
              );
              return (
                <div
                  key={tName}
                  className={`rounded-xl border border-slate-200 bg-white p-2 shadow-2xs flex flex-col justify-between ${
                    activeAddTeam === tName ? 'relative z-30' : 'relative z-10'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-1 gap-1">
                      <span className="font-bold text-[10px] text-blue-900 uppercase truncate">
                        {tName}
                      </span>
                      <span className="rounded bg-blue-50 px-1.5 py-0.2 font-mono text-[9px] font-extrabold text-blue-700 shrink-0">
                        ⚽ {totalTeamGoals}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {players.map((item, pIdx) => (
                        <div
                          key={pIdx}
                          className="py-1 flex items-center justify-between text-xs gap-1"
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => handleRemovePlayerFromTeam(tName, pIdx)}
                              className="h-4 w-4 -ml-0.5 shrink-0 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition active:scale-90"
                              title={`Excluir ${item.player} do time`}
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>

                            {item.isSub && (
                              <span className="text-[8px] font-extrabold text-amber-600 bg-amber-50 rounded px-0.5 shrink-0">
                                S
                              </span>
                            )}
                            <span className="font-semibold text-slate-800 truncate text-[10px] leading-tight">
                              {item.player}
                            </span>
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleGoalChange(tName, pIdx, -1)}
                              className="h-4 w-4 rounded bg-slate-100 text-slate-700 font-bold text-[10px] hover:bg-slate-200 active:scale-95 flex items-center justify-center"
                            >
                              -
                            </button>
                            <span className="w-3.5 text-center font-mono font-extrabold text-blue-800 text-[10px]">
                              {item.goals}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleGoalChange(tName, pIdx, 1)}
                              className="h-4 w-4 rounded bg-blue-600 text-white font-bold text-[10px] hover:bg-blue-700 active:scale-95 flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {players.length === 0 && (
                      <div className="py-2 text-center text-[9px] text-slate-400 italic">
                        Nenhum jogador escalado
                      </div>
                    )}
                  </div>

                  {/* Formulário / Botão para Adicionar Jogador ao Time */}
                  {activeAddTeam === tName ? (
                    <div className="mt-2 pt-1.5 border-t border-slate-100 space-y-1.5 bg-slate-50 p-1.5 rounded-lg">
                      <div className="relative">
                        {/* Seletor Customizado Inline com Seta (Estilo Criar Conta) */}
                        <div className="flex items-center rounded-lg border border-slate-300 bg-white shadow-2xs focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600 transition">
                          <input
                            type="text"
                            value={newTeamPlayerName}
                            onChange={(e) => {
                              setNewTeamPlayerName(e.target.value);
                              setOpenTeamDropdown(tName);
                            }}
                            onFocus={() => setOpenTeamDropdown(tName)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddPlayerToTeam(tName);
                              }
                            }}
                            placeholder="Buscar ou digitar atleta..."
                            className="w-full text-[10px] uppercase font-bold px-2 py-1 text-slate-800 placeholder:normal-case placeholder:font-normal focus:outline-none bg-transparent"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setOpenTeamDropdown((prev) => (prev === tName ? null : tName))
                            }
                            title="Ver atletas disponíveis"
                            className="px-1.5 py-1 text-slate-400 hover:text-blue-600 transition cursor-pointer flex items-center justify-center shrink-0"
                          >
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                                openTeamDropdown === tName ? 'rotate-180 text-blue-600' : ''
                              }`}
                            />
                          </button>
                        </div>

                        {/* Dropdown com Lista Inline dos Atletas Disponíveis (com Posição e Pé) */}
                        {openTeamDropdown === tName && (
                          <div className="absolute left-0 top-full mt-1.5 w-[240px] max-w-[85vw] rounded-xl border border-slate-200 bg-white p-1 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150 max-h-56 overflow-y-auto">
                            {(() => {
                              const query = newTeamPlayerName.trim().toUpperCase();
                              const filtered = availableTeamPlayers.filter((p) => {
                                if (!query) return true;
                                return (
                                  p.name.includes(query) ||
                                  p.positionLabel.toUpperCase().includes(query) ||
                                  p.footLabel.toUpperCase().includes(query)
                                );
                              });

                              return (
                                <>
                                  {filtered.length === 0 ? (
                                    <div className="p-2 text-center text-[9px] text-slate-400 italic">
                                      Nenhum atleta cadastrado encontrado
                                    </div>
                                  ) : (
                                    filtered.map((player) => {
                                      const isAlreadyInThisTeam = player.assignedTeam === tName;
                                      return (
                                        <div
                                          key={player.name}
                                          className={`w-full flex items-center justify-between rounded-lg p-1.5 text-xs transition border-b border-slate-50 last:border-b-0 ${
                                            isAlreadyInThisTeam
                                              ? 'bg-slate-50 opacity-60'
                                              : 'hover:bg-blue-50/70 cursor-pointer'
                                          }`}
                                          onClick={() => {
                                            if (isAlreadyInThisTeam) return;
                                            setNewTeamPlayerName(player.name);
                                            setOpenTeamDropdown(null);
                                          }}
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                            {/* Avatar / Inicial */}
                                            <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-[8px] shrink-0 overflow-hidden">
                                              {player.avatarUrl ? (
                                                <img
                                                  src={player.avatarUrl}
                                                  alt={player.name}
                                                  className="w-full h-full object-cover"
                                                />
                                              ) : (
                                                player.name.slice(0, 2)
                                              )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-center gap-1 flex-wrap">
                                                <span className="font-bold text-slate-800 text-[10px] truncate uppercase leading-tight">
                                                  {player.name}
                                                </span>
                                                {player.isConfirmedArrival && (
                                                  <span className="inline-flex items-center px-1 py-0.2 rounded text-[7px] font-extrabold bg-emerald-100 text-emerald-800">
                                                    Presente
                                                  </span>
                                                )}
                                                {player.assignedTeam &&
                                                  player.assignedTeam !== tName && (
                                                    <span className="inline-flex items-center px-1 py-0.2 rounded text-[7px] font-semibold bg-amber-100 text-amber-800">
                                                      {player.assignedTeam}
                                                    </span>
                                                  )}
                                              </div>

                                              {/* Posição e Pé Dominante (Igual ao criar conta) */}
                                              <div className="flex items-center gap-1.5 text-[8px] text-slate-500 mt-0.5">
                                                <span className="inline-flex items-center gap-0.5 font-medium text-slate-700 bg-slate-100 px-1 py-0.2 rounded">
                                                  <span>{player.positionEmoji}</span>
                                                  <span>{player.positionLabel}</span>
                                                </span>
                                                <span className="inline-flex items-center gap-0.5 text-slate-600 bg-slate-100 px-1 py-0.2 rounded">
                                                  <span>👟</span>
                                                  <span>
                                                    Pé:{' '}
                                                    <strong className="text-slate-700">
                                                      {player.footLabel}
                                                    </strong>
                                                  </span>
                                                </span>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Botão de escalação rápida */}
                                          <div className="shrink-0 ml-1">
                                            {isAlreadyInThisTeam ? (
                                              <span className="text-[8px] font-semibold text-slate-400">
                                                Neste time
                                              </span>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleAddPlayerToTeam(tName, player.name);
                                                }}
                                                className="px-1.5 py-0.5 text-[8px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-2xs transition active:scale-95"
                                              >
                                                + Escalar
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}

                                  {/* Opção para adicionar atleta digitado caso não exista */}
                                  {query &&
                                    !availableTeamPlayers.some((p) => p.name === query) && (
                                      <div
                                        className="p-1.5 rounded-lg bg-blue-50/80 border border-blue-200 flex items-center justify-between text-xs cursor-pointer hover:bg-blue-100 transition mt-1"
                                        onClick={() => handleAddPlayerToTeam(tName, query)}
                                      >
                                        <div className="flex items-center gap-1 text-[9px] text-blue-900 font-bold truncate">
                                          <Plus className="h-3 w-3 text-blue-600 shrink-0" />
                                          <span className="truncate">
                                            Adicionar "{query}" como convidado
                                          </span>
                                        </div>
                                        <span className="text-[8px] font-bold text-blue-700 bg-white px-1.5 py-0.5 rounded shadow-2xs shrink-0 ml-1">
                                          + Escalar
                                        </span>
                                      </div>
                                    )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <label className="flex items-center gap-1 text-[9px] font-semibold text-slate-600 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={newTeamPlayerIsSub}
                            onChange={(e) => setNewTeamPlayerIsSub(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 h-3 w-3 focus:ring-0"
                          />
                          <span>Reserva (S)</span>
                        </label>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveAddTeam(null);
                              setOpenTeamDropdown(null);
                              setNewTeamPlayerName('');
                              setNewTeamPlayerIsSub(false);
                            }}
                            className="px-1.5 py-0.5 text-[9px] font-medium text-slate-500 hover:text-slate-800 rounded hover:bg-slate-200 transition"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddPlayerToTeam(tName)}
                            className="px-2 py-0.5 text-[9px] font-bold bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded transition shadow-2xs"
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveAddTeam(tName);
                        setOpenTeamDropdown(tName);
                        setNewTeamPlayerName('');
                        setNewTeamPlayerIsSub(false);
                      }}
                      className="mt-2 w-full py-1 rounded-lg border border-dashed border-blue-200 bg-blue-50/40 hover:bg-blue-50 text-blue-700 text-[10px] font-bold flex items-center justify-center gap-1 transition active:scale-95"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Adicionar Jogador</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Seção 4: Lista de Cartões */}
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs">
            <div className="font-bold text-slate-800 border-b border-slate-100 pb-1 mb-2 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide">
                Lista de Cartões
              </span>
              <span className="text-[10px] text-slate-400">
                {sumula.yellowCards.length +
                  sumula.blueCards.length +
                  sumula.redCards.length}{' '}
                registrados
              </span>
            </div>

            {/* Amarelos */}
            <div className="space-y-1 mb-2">
              <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700">
                <span className="h-3 w-2.5 rounded-2xs bg-amber-400 border border-amber-600 inline-block"></span>
                Amarelo:
              </div>
              <div className="flex flex-wrap gap-1">
                {sumula.yellowCards.length === 0 ? (
                  <span className="text-[10px] text-slate-400 italic">
                    Nenhum
                  </span>
                ) : (
                  sumula.yellowCards.map((p, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-900"
                    >
                      {p}
                      <button
                        onClick={() => handleRemoveCard('yellow', idx)}
                        className="text-amber-500 hover:text-amber-800"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Azuis */}
            <div className="space-y-1 mb-2">
              <div className="flex items-center gap-1 text-[10px] font-bold text-blue-700">
                <span className="h-3 w-2.5 rounded-2xs bg-blue-500 border border-blue-700 inline-block"></span>
                Azul:
              </div>
              <div className="flex flex-wrap gap-1">
                {sumula.blueCards.length === 0 ? (
                  <span className="text-[10px] text-slate-400 italic">
                    Nenhum
                  </span>
                ) : (
                  sumula.blueCards.map((p, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[9px] font-bold text-blue-900"
                    >
                      {p}
                      <button
                        onClick={() => handleRemoveCard('blue', idx)}
                        className="text-blue-500 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Vermelhos */}
            <div className="space-y-1 mb-2">
              <div className="flex items-center gap-1 text-[10px] font-bold text-red-700">
                <span className="h-3 w-2.5 rounded-2xs bg-red-600 border border-red-700 inline-block"></span>
                Vermelho:
              </div>
              <div className="flex flex-wrap gap-1">
                {sumula.redCards.length === 0 ? (
                  <span className="text-[10px] text-slate-400 italic">
                    Nenhum
                  </span>
                ) : (
                  sumula.redCards.map((p, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded bg-red-50 border border-red-200 px-1.5 py-0.5 text-[9px] font-bold text-red-900"
                    >
                      {p}
                      <button
                        onClick={() => handleRemoveCard('red', idx)}
                        className="text-red-500 hover:text-red-800"
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Formulário rápido para adicionar cartão com Autocomplete da Lista de Presença */}
            <div className="mt-2 pt-2 border-t border-slate-100 relative">
              <div className="flex items-center gap-1">
                <select
                  value={selectedCardType}
                  onChange={(e: any) => setSelectedCardType(e.target.value)}
                  className="rounded border border-slate-200 bg-slate-50 text-[10px] p-1 font-bold shrink-0"
                >
                  <option value="amarelo">🟨 Amarelo</option>
                  <option value="azul">🟦 Azul</option>
                  <option value="vermelho">🟥 Vermelho</option>
                </select>

                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Nome do atleta..."
                    value={newCardPlayer}
                    onFocus={() => setShowCardSuggestions(true)}
                    onChange={(e) => {
                      setNewCardPlayer(e.target.value);
                      setShowCardSuggestions(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddCard();
                        setShowCardSuggestions(false);
                      }
                    }}
                    className="w-full rounded border border-slate-200 px-1.5 py-1 text-[10px] uppercase font-semibold focus:outline-blue-500 focus:border-blue-500"
                  />

                  {/* Dropdown de Sugestões / Filtro da Lista de Presença */}
                  {showCardSuggestions && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setShowCardSuggestions(false)}
                      />
                      <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg divide-y divide-slate-100">
                        {(() => {
                          const query = newCardPlayer.trim().toUpperCase();
                          const matches = sumula.arrivalList.filter((item) =>
                            query ? item.playerName.toUpperCase().includes(query) : true
                          );

                          if (matches.length === 0) {
                            return (
                              <div className="p-2 text-[10px] text-slate-400 italic text-center">
                                Nenhum atleta encontrado na presença
                              </div>
                            );
                          }

                          return matches.map((item, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setNewCardPlayer(item.playerName);
                                setShowCardSuggestions(false);
                              }}
                              className="w-full px-2 py-1.5 text-left text-[11px] font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-900 flex items-center justify-between transition"
                            >
                              <span className="truncate">{item.playerName}</span>
                              <span className="text-[9px] font-mono text-slate-400 ml-1">
                                #{item.order}
                              </span>
                            </button>
                          ));
                        })()}
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleAddCard();
                    setShowCardSuggestions(false);
                  }}
                  className="shrink-0 rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-700 active:scale-95 transition"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Seção 5: Gols Destaque (Jogador | Hora) */}
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs">
            <div className="font-bold text-slate-800 border-b border-slate-100 pb-1 mb-2 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-red-700 font-black flex items-center gap-1">
                ⚽ Gols Destaque
              </span>
              <span className="text-[10px] text-slate-400">Jogador | Hora</span>
            </div>

            <div className="space-y-1.5 divide-y divide-slate-100">
              {sumula.highlightGoals.map((h, idx) => (
                <div
                  key={idx}
                  className="pt-1.5 flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-slate-800 text-[11px]">
                    ⚽ {h.player}
                  </span>
                  <span className="font-mono text-[10px] font-bold text-red-600 bg-red-50 rounded px-1.5 py-0.5 border border-red-200">
                    {h.time}
                  </span>
                </div>
              ))}
            </div>

            {/* Adicionar Gol Destaque */}
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-1">
              <input
                type="text"
                placeholder="Jogador"
                value={newHighlightPlayer}
                onChange={(e) => setNewHighlightPlayer(e.target.value)}
                className="flex-1 rounded border border-slate-200 px-2 py-1 text-[10px] uppercase font-semibold"
              />
              <input
                type="text"
                placeholder="Hora (22:04)"
                value={newHighlightTime}
                onChange={(e) => setNewHighlightTime(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddHighlightGoal()}
                className="w-16 rounded border border-slate-200 px-1 py-1 text-center font-mono text-[10px] font-bold"
              />
              <button
                type="button"
                onClick={handleAddHighlightGoal}
                className="rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-red-700 active:scale-95 transition"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleExit}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
          >
            ← Voltar
          </button>

          {/* Botão para Gerar e Compartilhar Imagem do Comprovante da Súmula */}
          <button
            type="button"
            onClick={() => setShowReceiptModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400 bg-emerald-50 px-3 py-2.5 text-xs font-black text-emerald-800 hover:bg-emerald-100 active:scale-95 transition cursor-pointer shadow-2xs"
            title="Gerar e compartilhar comprovante visual da súmula"
          >
            <Share2 className="h-4 w-4 text-emerald-600" />
            <span>Comprovante</span>
          </button>

          {isCoachOrAdmin && !isLocked && (
            <div className="flex-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const draftSumula: SumulaData = {
                    ...sumula,
                    timerSeconds: sumulaStopwatch.seconds,
                    isTimerRunning: sumulaStopwatch.isRunning,
                    lastUpdated: new Date().toISOString(),
                  };
                  saveSumulaToList(draftSumula);
                  setSavedBadge(true);
                  setTimeout(() => setSavedBadge(false), 2500);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-400 bg-blue-50 px-3 py-2.5 text-xs font-black text-blue-700 hover:bg-blue-100 active:scale-95 transition cursor-pointer shadow-2xs"
                title="Salva as alterações mantendo a súmula aberta para edição"
              >
                <Save className="h-4 w-4" />
                <span>Salvar Rascunho</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFinalizeModal(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition cursor-pointer"
                title="Fecha a súmula e registra os dados em todos os atletas"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Finalizar Súmula</span>
              </button>
            </div>
          )}

          {isLocked && (
            <div className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-300 py-2.5 px-3 text-xs font-black text-emerald-800">
              <Lock className="h-4 w-4 text-emerald-600" />
              <span>Súmula Finalizada & Homologada</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmação de Finalização da Súmula */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900">
                  Finalizar Súmula da Rodada?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Ao finalizar, a súmula será fechada definitivamente e <strong>nenhum dado poderá mais ser alterado</strong>.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                  Todos os gols, presenças confirmadas, cartões e títulos de Super Capas serão registrados imediatamente na ficha e ranking dos atletas participantes.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowFinalizeModal(false);
                  const toFinalize: SumulaData = {
                    ...sumula,
                    status: 'finalizada',
                    timerSeconds: sumulaStopwatch.seconds,
                    isTimerRunning: false,
                    lastUpdated: new Date().toISOString(),
                  };
                  finalizePeladaSumula(toFinalize);
                  setSumula(toFinalize);
                  setShowReceiptModal(true);
                  if (onFinish) {
                    onFinish(toFinalize);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 active:scale-95 transition cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                Sim, Finalizar & Homologar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup / Modal de Confirmação de Exclusão */}
      {showDeleteModal && (
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
                  Deseja realmente excluir esta súmula de{' '}
                  <span className="font-bold text-slate-800">
                    {sumula.matchDate || 'data não informada'}
                  </span>
                  ? Essa ação não pode ser desfeita.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteCurrentSumula}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-red-700 active:scale-95 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Indicador Flutuante 'Salvo' no Canto Inferior Direito da Página */}
      {savedBadge && (
        <div className="fixed bottom-20 right-4 z-50 flex items-center gap-1.5 rounded-full bg-emerald-600 text-white px-3.5 py-1.5 text-xs font-bold shadow-lg animate-bounce transition">
          <CheckCircle2 className="h-4 w-4" />
          <span>Salvo</span>
        </div>
      )}

      {/* Modal de Compartilhamento da Imagem do Comprovante da Súmula */}
      {showReceiptModal && (
        <ShareSumulaReceiptModal
          isOpen={true}
          onClose={() => {
            setShowReceiptModal(false);
          }}
          data={{
            sumula,
            teamName: sumula.teamName || userTeam || 'Meu Time',
            venueName: 'Arena Planalto Society',
          }}
        />
      )}
    </div>
  );
};
