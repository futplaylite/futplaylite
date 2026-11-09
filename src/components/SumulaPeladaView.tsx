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
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { ShareSumulaReceiptModal } from './ShareSumulaReceiptModal';

export interface SumulaData {
  id: string;
  status: 'em_andamento' | 'finalizada';
  matchDate: string;
  startTime: string;
  lastUpdated: string;
  timerSeconds?: number;
  isTimerRunning?: boolean;
  arrivalList: {
    order: number;
    playerName: string;
    confirmed: boolean;
    note?: string;
    isGuest?: boolean;
    isGoalkeeper?: boolean; // Usuário do tipo Goleiro
  }[];
  yellowCards: string[];
  blueCards: string[];
  redCards: string[];
  goalkeepers: { num: string; name: string }[];
  teamsGrid: { teamName: string; matches: string[] }[];
  gridTimers?: {
    [cellKey: string]: {
      updatedAt: number; // timestamp quando foi marcado
      isLocked: boolean; // se já passou 30s e travou
    };
  };
  teamLineups: {
    [key: string]: { player: string; goals: number | string; isSub?: boolean }[];
  };
  highlightGoals: { player: string; time: string }[];
}

const STORAGE_KEY = 'futplay_sumula_pelada_ativa_v1';

// Goleiros Oficiais Cadastrados no Banco / Seed Excel
export const OFFICIAL_GOALKEEPER_NAMES: string[] = [
  'PALITO',
  'EMERSOM GOLEIRO',
  'MANELÃO',
  'RAFAEL GOLEIROS',
];

export const OFFICIAL_ELENCO_PLAYERS: string[] = [
  'JUNIOR (GANSO)',
  'MARLOM',
  'ROBSOM',
  'SEVERINO',
  'YAGO',
  'ELIZEU (ZEU)',
  'DEDA',
  'HUGO PAÇOCA',
  'RAFAEL (RAFA)',
  'HENRIQUE',
  'JUACY',
  'MAILOM',
  'CARLOS',
  'TEI (SUJO)',
  'DAMIÃO',
  'DAYVID',
  'GLEISOM',
  'JASOM',
  'MELQUIZ',
  'PITBUL',
  'JR GALEGO',
  'RODRIGO',
  'GEO',
  'ALMIR',
  'FABRICIO',
  'EDNALDO',
  'TIAGO',
  'RONALDO',
];

/**
 * Identifica se um atleta é do tipo Goleiro (pelo flag explícito ou pelo nome oficial)
 */
export const isGoalkeeperPlayer = (name: string, isGoalkeeperFlag?: boolean): boolean => {
  if (isGoalkeeperFlag !== undefined) return isGoalkeeperFlag;
  const upper = (name || '').trim().toUpperCase();
  if (upper.includes('GOLEIRO')) return true;
  return OFFICIAL_GOALKEEPER_NAMES.some((gk) => gk.toUpperCase() === upper);
};

/**
 * Sincroniza automaticamente a lista de Goleiros Fixos com os atletas tipo Goleiro
 * que estiverem com presença confirmada na Lista de Presença.
 */
export const syncFixedGoalkeepers = (
  arrivalList: SumulaData['arrivalList']
): { num: string; name: string }[] => {
  // Coleta os nomes de goleiros com presença confirmada
  const confirmedGkNames = arrivalList
    .filter((a) => a.confirmed && isGoalkeeperPlayer(a.playerName, a.isGoalkeeper))
    .map((a) => a.playerName.toUpperCase());

  // Mínimo de 4 vagas de goleiros fixos na súmula
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

export const buildDefaultArrivalList = (): SumulaData['arrivalList'] => {
  // 1. Goleiros com presença confirmada por padrão para preencherem os Goleiros Fixos da súmula
  const goalkeepersList = OFFICIAL_GOALKEEPER_NAMES.map((name, idx) => ({
    order: idx + 1,
    playerName: name,
    confirmed: true,
    isGuest: false,
    isGoalkeeper: true,
  }));

  // 2. Jogadores de Linha
  const fieldPlayersList = OFFICIAL_ELENCO_PLAYERS.map((name, idx) => ({
    order: goalkeepersList.length + idx + 1,
    playerName: name,
    confirmed: idx < 18, // Primeiros 18 jogadores de linha confirmados por padrão
    isGuest: false,
    isGoalkeeper: false,
  }));

  return [...goalkeepersList, ...fieldPlayersList];
};

const defaultArrivals = buildDefaultArrivalList();

export const DEFAULT_INITIAL_SUMULA: SumulaData = {
  id: 'pelada-rodada-atual',
  status: 'em_andamento',
  matchDate: new Date().toLocaleDateString('pt-BR'),
  startTime: '20:15',
  lastUpdated: new Date().toISOString(),
  timerSeconds: 0,
  isTimerRunning: false,
  arrivalList: defaultArrivals,
  yellowCards: [
    'YAGO',
    'RAFAEL (RAFA)',
    'ELIZEU (ZEU)',
    'HENRIQUE',
    'GLEISOM',
  ],
  blueCards: [],
  redCards: [],
  goalkeepers: syncFixedGoalkeepers(defaultArrivals),
  teamsGrid: [
    { teamName: 'Time 01', matches: ['-', '-', 'V', 'E', '-', '-', 'E', '-', '-', '-', 'V', '-', '-', '-', '-'] },
    { teamName: 'Time 02', matches: ['V', 'V', 'V', '-', 'V', '-', '-', 'E', '-', 'V', 'V', '-', '-', '-', '-'] },
    { teamName: 'Time 03', matches: ['-', '-', '-', 'E', '-', 'V', 'V', 'E', '-', '-', '-', '-', '-', '-', '-'] },
    { teamName: 'Time 04', matches: ['-', '-', '-', '-', '-', '-', 'E', '-', 'V', '-', '-', '-', '-', '-', '-'] },
  ],
  teamLineups: {
    'Time 01': [
      { player: 'JUNIOR (GANSO)', goals: 1 },
      { player: 'PITBUL', goals: 0 },
      { player: 'HUGO PAÇOCA', goals: 1 },
      { player: 'CARLOS', goals: 0 },
      { player: 'ROBSOM', goals: 0 },
      { player: 'DAMIÃO', goals: 0, isSub: true },
      { player: 'GEO', goals: 1, isSub: true },
    ],
    'Time 02': [
      { player: 'DAYVID', goals: 3 },
      { player: 'HENRIQUE', goals: 1 },
      { player: 'MARLOM', goals: 1 },
      { player: 'GLEISOM', goals: 1 },
      { player: 'MAILOM', goals: 2 },
    ],
    'Time 03': [
      { player: 'SEVERINO', goals: 0 },
      { player: 'PITBUL', goals: 2 },
      { player: 'RAFAEL (RAFA)', goals: 2 },
      { player: 'JASOM', goals: 0 },
      { player: 'YAGO', goals: 1, isSub: true },
    ],
    'Time 04': [
      { player: 'TEI (SUJO)', goals: 0 },
      { player: 'MELQUIZ', goals: 4 },
      { player: 'JUACY', goals: 1 },
      { player: 'DEDA', goals: 0 },
      { player: 'ELIZEU (ZEU)', goals: 1, isSub: true },
    ],
  },
  highlightGoals: [
    { player: 'SEVERINO', time: '21:31' },
    { player: 'JUNIOR (GANSO)', time: '22:04' },
    { player: 'MELQUIZ', time: '22:05' },
  ],
};

export const ALL_SUMULAS_STORAGE_KEY = 'futplay_todas_sumulas_peladas_v1';

export const getStoredSumulas = (): SumulaData[] => {
  try {
    const listRaw = localStorage.getItem(ALL_SUMULAS_STORAGE_KEY);
    if (listRaw !== null) {
      const parsed = JSON.parse(listRaw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Erro ao ler todas as súmulas:', e);
  }
  // Se não existir lista ainda, tenta a súmula legada ou a padrão
  try {
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy) {
      const parsedLegacy = JSON.parse(legacy);
      if (parsedLegacy && parsedLegacy.id) {
        return [parsedLegacy];
      }
    }
  } catch {}
  return [DEFAULT_INITIAL_SUMULA];
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
  const { currentUser, sumulaStopwatch } = useLeague();
  const isCoachOrAdmin =
    currentUser.role === 'admin' ||
    currentUser.role === 'coach' ||
    currentUser.isTeamOwner === true;

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

  // Carrega a súmula específica ou cria uma nova com id único
  const [sumula, setSumula] = useState<SumulaData>(() => {
    if (isNew) {
      const newId = `sumula-pelada-${Date.now()}`;
      const freshArrivals = buildDefaultArrivalList();
      const fresh: SumulaData = {
        ...DEFAULT_INITIAL_SUMULA,
        id: newId,
        matchDate: new Date().toLocaleDateString('pt-BR'),
        startTime: '20:15',
        lastUpdated: new Date().toISOString(),
        arrivalList: freshArrivals,
        goalkeepers: syncFixedGoalkeepers(freshArrivals),
      };
      saveSumulaToList(fresh);
      return fresh;
    }

    const all = getStoredSumulas();
    let current: SumulaData = DEFAULT_INITIAL_SUMULA;
    if (sumulaId) {
      const found = all.find((s) => s.id === sumulaId);
      if (found) current = found;
    } else if (all[0]) {
      current = all[0];
    }
    // Remove asteriscos legados, garante goleiros na lista e sincroniza Goleiros Fixos
    let sanitized = current;
    if (sanitized && sanitized.arrivalList) {
      const hasGksInArrival = sanitized.arrivalList.some((a) =>
        isGoalkeeperPlayer(a.playerName, a.isGoalkeeper)
      );
      let updatedArrivalList = sanitized.arrivalList;
      if (!hasGksInArrival) {
        // Se a súmula não continha os goleiros na lista de chegada, adiciona os 4 oficiais no início
        const gksToAdd = OFFICIAL_GOALKEEPER_NAMES.map((name, i) => ({
          order: i + 1,
          playerName: name,
          confirmed: true,
          isGuest: false,
          isGoalkeeper: true,
        }));
        updatedArrivalList = [
          ...gksToAdd,
          ...updatedArrivalList.map((a, i) => ({
            ...a,
            order: gksToAdd.length + i + 1,
            isGoalkeeper: isGoalkeeperPlayer(a.playerName, a.isGoalkeeper),
          })),
        ];
      } else {
        updatedArrivalList = updatedArrivalList.map((a) => ({
          ...a,
          isGoalkeeper: isGoalkeeperPlayer(a.playerName, a.isGoalkeeper),
          note: a.note === '*' ? undefined : a.note,
        }));
      }

      sanitized = {
        ...sanitized,
        arrivalList: updatedArrivalList,
        goalkeepers: syncFixedGoalkeepers(updatedArrivalList),
        teamsGrid: (sanitized.teamsGrid || DEFAULT_INITIAL_SUMULA.teamsGrid).map((row) => {
          const matches = [...row.matches];
          while (matches.length < 15) {
            matches.push('-');
          }
          return { ...row, matches: matches.slice(0, 15) };
        }),
      };
    }
    return sanitized;
  });

  const [savedBadge, setSavedBadge] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const isDeletedRef = useRef<boolean>(false);

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
  const [newTeamPlayerName, setNewTeamPlayerName] = useState('');
  const [newTeamPlayerIsSub, setNewTeamPlayerIsSub] = useState(false);

  // Lista unificada de sugestões para os times (Presenças confirmadas + Elenco oficial + Goleiros)
  const availableTeamPlayerSuggestions = useMemo(() => {
    const list: string[] = [];
    // 1. Presenças confirmadas na súmula
    sumula.arrivalList
      .filter((a) => a.confirmed && a.playerName)
      .forEach((a) => {
        const up = a.playerName.trim().toUpperCase();
        if (!list.includes(up)) list.push(up);
      });
    // 2. Elenco oficial
    OFFICIAL_ELENCO_PLAYERS.forEach((name) => {
      const up = name.trim().toUpperCase();
      if (!list.includes(up)) list.push(up);
    });
    // 3. Goleiros
    OFFICIAL_GOALKEEPER_NAMES.forEach((name) => {
      const up = name.trim().toUpperCase();
      if (!list.includes(up)) list.push(up);
    });
    return list;
  }, [sumula.arrivalList]);

  // 1. Lista de Presença
  const handleAddArrival = () => {
    if (!newArrivalName.trim()) return;
    const name = newArrivalName.trim().toUpperCase();
    const isGk = newArrivalIsGoalkeeper || isGoalkeeperPlayer(name);
    const isOfficial =
      OFFICIAL_ELENCO_PLAYERS.some((p) => p.toUpperCase() === name) ||
      OFFICIAL_GOALKEEPER_NAMES.some((p) => p.toUpperCase() === name);

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
    if (!newCardPlayer.trim()) return;
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
  const handleAddPlayerToTeam = (teamKey: string) => {
    const name = newTeamPlayerName.trim().toUpperCase();
    if (!name) return;

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
          isSub: newTeamPlayerIsSub,
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
  };

  // Remover jogador de um Time da súmula
  const handleRemovePlayerFromTeam = (teamKey: string, pIdx: number) => {
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
    if (!newHighlightPlayer.trim()) return;
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
    if (window.confirm('Deseja reiniciar a súmula para uma nova rodada em branco?')) {
      const fresh: SumulaData = {
        ...DEFAULT_INITIAL_SUMULA,
        id: `pelada-${Date.now()}`,
        matchDate: new Date().toLocaleDateString('pt-BR'),
        lastUpdated: new Date().toISOString(),
      };
      setSumula(fresh);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    }
  };

  return (
    <div className="-mx-2.5 sm:mx-0 space-y-3 pb-8 relative">
      {/* Prancheta Física Estilizada com laterais expandidas */}
      <div className="rounded-xl sm:rounded-2xl bg-white shadow-md border border-slate-300 text-slate-800 overflow-hidden">
        {/* CABEÇALHO DO CARD: EXCLUIR ANTES DO TÍTULO + SÚMULA DE TREINO + DATA/HORA */}
        <div className="bg-slate-900 text-white px-3 sm:px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2">
          {/* Lado Esquerdo: Botão Excluir Súmula + Título Oficial */}
          <div className="flex items-center gap-2 min-w-0">
            {isCoachOrAdmin && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-950/60 hover:bg-red-900/80 text-red-300 px-2 py-1 text-[10px] font-bold transition active:scale-95 shrink-0"
                title="Excluir Súmula"
              >
                <Trash2 className="h-3 w-3 text-red-400" />
                <span>Excluir</span>
              </button>
            )}

            <span className="text-xs font-black uppercase tracking-wider text-slate-200 truncate">
              Data e Horário:
            </span>

            {!isCoachOrAdmin && (
              <span className="rounded bg-blue-900/80 border border-blue-500/30 px-1.5 py-0.2 text-[8px] font-extrabold text-blue-200 shrink-0">
                Leitura
              </span>
            )}
          </div>

          {/* Lado Direito: Data e Início */}
          <div className="flex items-center gap-2 text-xs text-slate-300 shrink-0">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-blue-400 shrink-0" />
              <input
                type="text"
                value={sumula.matchDate}
                onChange={(e) =>
                  setSumula((prev) => ({ ...prev, matchDate: e.target.value }))
                }
                className="bg-transparent border-b border-slate-700 text-white font-mono text-[11px] font-bold w-20 focus:outline-none focus:border-blue-400 text-center"
                title="Data do jogo"
              />
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-blue-400 shrink-0" />
              <input
                type="text"
                disabled={!isCoachOrAdmin}
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
                  className="rounded-xl border border-slate-200 bg-white p-2 shadow-2xs flex flex-col justify-between"
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
                      <div>
                        <input
                          type="text"
                          list={`team-suggestions-${tName}`}
                          value={newTeamPlayerName}
                          onChange={(e) => setNewTeamPlayerName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddPlayerToTeam(tName);
                            }
                          }}
                          placeholder="Nome do atleta..."
                          className="w-full text-[10px] uppercase font-bold px-1.5 py-1 rounded border border-slate-300 bg-white text-slate-800 placeholder:normal-case placeholder:font-normal focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                          autoFocus
                        />
                        <datalist id={`team-suggestions-${tName}`}>
                          {availableTeamPlayerSuggestions.map((name) => (
                            <option key={name} value={name} />
                          ))}
                        </datalist>
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

          {isCoachOrAdmin && (
            <button
              type="button"
              onClick={() => {
                const finalSumula: SumulaData = {
                  ...sumula,
                  timerSeconds: sumulaStopwatch.seconds,
                  isTimerRunning: sumulaStopwatch.isRunning,
                  lastUpdated: new Date().toISOString(),
                };
                saveSumulaToList(finalSumula);
                if (onFinish) {
                  onFinish(finalSumula);
                }
                setShowReceiptModal(true);
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:from-emerald-500 hover:to-teal-500 active:scale-95 transition cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>Gravar & Compartilhar</span>
            </button>
          )}
        </div>
      </div>

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
            teamName: 'Real Planalto FC',
            venueName: 'Arena Planalto Society',
          }}
        />
      )}
    </div>
  );
};
