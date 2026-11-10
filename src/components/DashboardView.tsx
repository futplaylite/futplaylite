import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Calendar,
  CalendarCheck,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Crown,
  Edit3,
  FilePlus2,
  Flame,
  MapPin,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { Match, MatchStatus } from '../types/league';
import { TeamCrestBadge } from './TeamCrestBadge';
import { PlayerRatingModal } from './PlayerRatingModal';
import { ShareCardModal } from './ShareCardModal';
import { ShareSuperCapasModal } from './ShareSuperCapasModal';
import { SuperCapasCard } from './SuperCapasCard';
import {
  getStoredSumulas,
  saveSumulaToList,
  syncFixedGoalkeepers,
  SumulaData,
  DEFAULT_INITIAL_SUMULA,
} from './SumulaPeladaView';
import { isSupabaseConfigured, supabaseService } from '../lib/supabase';

export interface PeladaScheduleConfig {
  date: string; // 'YYYY-MM-DD'
  time: string; // '16:00'
  venueName: string; // 'Arena Society Planalto - BA'
  neighborhood: string; // 'Vila Rosália'
}

export const DEFAULT_SUPER_CAPAS_PHOTO =
  '/images/stadium-super-capas.jpg';

export const DEFAULT_PELADA_CONFIG: PeladaScheduleConfig = {
  date: '2026-10-31',
  time: '16:00',
  venueName: 'Arena Society Planalto - BA',
  neighborhood: 'Vila Rosália',
};

export function getInitialPeladaSchedule(): PeladaScheduleConfig {
  try {
    const raw = localStorage.getItem('futplay_pelada_schedule_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date && parsed.time) return parsed;
    }
  } catch {}

  try {
    const sumulas = getStoredSumulas();
    if (sumulas.length > 0 && sumulas[0].matchDate) {
      const parts = sumulas[0].matchDate.split('/');
      if (parts.length === 3) {
        const yyyyMmDd = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        return {
          date: yyyyMmDd,
          time: sumulas[0].startTime || '16:00',
          venueName: 'Arena Society Planalto - BA',
          neighborhood: 'Vila Rosália',
        };
      }
    }
  } catch {}

  return DEFAULT_PELADA_CONFIG;
}

export function formatMatchTime(str?: string): string {
  if (!str) return '16:00';
  try {
    if (str.includes('T')) {
      const timePart = str.split('T')[1];
      const [h, m] = timePart.split(':');
      return `${h}:${m}`;
    }
    if (str.includes(' ')) {
      const timePart = str.split(' ')[1];
      const [h, m] = timePart.split(':');
      return `${h}:${m}`;
    }
  } catch {}
  return '16:00';
}

export function formatPeladaDateExtended(dateStr: string) {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
    const dayMonth = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${dayMonth}`;
  } catch {
    return dateStr;
  }
}

export function calculatePeladaCountdown(dateStr: string, timeStr: string) {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = (timeStr || '16:00').split(':').map(Number);
    const targetDate = new Date(year, month - 1, day, hours || 0, minutes || 0, 0);
    const now = new Date();

    const diffMs = targetDate.getTime() - now.getTime();

    const isSameDay =
      now.getFullYear() === targetDate.getFullYear() &&
      now.getMonth() === targetDate.getMonth() &&
      now.getDate() === targetDate.getDate();

    if (diffMs <= 0) {
      if (isSameDay) {
        return {
          days: 0,
          hours: 0,
          minutes: 0,
          isToday: true,
          isTomorrow: false,
          isPast: false,
          badgeText: '🔥 É HOJE!',
        };
      }
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        isToday: false,
        isTomorrow: false,
        isPast: true,
        badgeText: 'Finalizada / Agendar',
      };
    }

    const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const remainingHours = Math.floor((totalSeconds % 86400) / 3600);
    const remainingMinutes = Math.floor((totalSeconds % 3600) / 60);

    if (isSameDay) {
      return {
        days: 0,
        hours: remainingHours,
        minutes: remainingMinutes,
        isToday: true,
        isTomorrow: false,
        isPast: false,
        badgeText: '🔥 É HOJE!',
      };
    }

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTargetTomorrow =
      tomorrow.getFullYear() === targetDate.getFullYear() &&
      tomorrow.getMonth() === targetDate.getMonth() &&
      tomorrow.getDate() === targetDate.getDate();

    if (isTargetTomorrow) {
      return {
        days: 1,
        hours: remainingHours,
        minutes: remainingMinutes,
        isToday: false,
        isTomorrow: true,
        isPast: false,
        badgeText: '⚡ É AMANHÃ!',
      };
    }

    return {
      days,
      hours: remainingHours,
      minutes: remainingMinutes,
      isToday: false,
      isTomorrow: false,
      isPast: false,
      badgeText: `⏳ Faltam ${days} ${days === 1 ? 'dia' : 'dias'}`,
    };
  } catch {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      isToday: false,
      isTomorrow: false,
      isPast: false,
      badgeText: 'A Definir',
    };
  }
}

interface DashboardViewProps {
  onNavigate: (
    tab: 'dashboard' | 'matches' | 'search' | 'squad' | 'ranking' | 'admin',
    matchIdToOpen?: string,
    playerIdToOpen?: string
  ) => void;
}

export function getMatchStatusBadge(status: MatchStatus) {
  switch (status) {
    case 'validada':
      return {
        label: 'Validada',
        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: CheckCircle2,
      };
    case 'aguardando_confirmacoes':
    case 'resultado_enviado':
      return {
        label: 'Pendente',
        cls: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: Clock,
      };
    case 'contestada':
    case 'analise_moderacao':
      return {
        label: 'Contestada',
        cls: 'bg-red-50 text-red-700 border-red-200',
        icon: AlertTriangle,
      };
    case 'escalacao_confirmada':
    case 'partida_cadastrada':
      return {
        label: 'A Jogar',
        cls: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: Users,
      };
    case 'anulada':
    case 'cancelada':
    default:
      return {
        label: 'Anulada',
        cls: 'bg-slate-100 text-slate-600 border-slate-200',
        icon: ShieldAlert,
      };
  }
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const {
    currentUser,
    currentPlayerProfile,
    profiles,
    seasonEntries,
    divisions,
    cities,
    matches,
    selectedCityId,
    selectedSeasonId,
    updatePlayerSkills,
    notify,
  } = useLeague();

  const activeProfile = currentPlayerProfile || profiles[0];
  const activeCity =
    cities.find((c) => c.id === selectedCityId) || cities[0];



  const [copiedCard, setCopiedCard] = useState<boolean>(false);
  const [showRatingModal, setShowRatingModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [showSuperCapasShareModal, setShowSuperCapasShareModal] = useState<boolean>(false);

  // Foto em modo paisagem do Time Vencedor (Super Capas)
  const [superCapasPhoto, setSuperCapasPhoto] = useState<string>(() => {
    try {
      return localStorage.getItem('futplay_super_capas_team_photo_v1') || DEFAULT_SUPER_CAPAS_PHOTO;
    } catch {
      return DEFAULT_SUPER_CAPAS_PHOTO;
    }
  });

  const isCoach = currentUser?.role === 'coach' || currentUser?.isTeamOwner;
  const isAdmin = currentUser?.role === 'admin';
  const canRenewSuperCapasPhoto = isCoach || isAdmin;

  // Estados do Card do Dia da Pelada com Dias Contados
  const [peladaConfig, setPeladaConfig] = useState<PeladaScheduleConfig>(getInitialPeladaSchedule);
  const [showEditScheduleModal, setShowEditScheduleModal] = useState<boolean>(false);
  const [editDate, setEditDate] = useState<string>(peladaConfig.date);
  const [editTime, setEditTime] = useState<string>(peladaConfig.time);
  const [editVenue, setEditVenue] = useState<string>(peladaConfig.venueName);
  const [storedSumulas, setStoredSumulas] = useState<SumulaData[]>(getStoredSumulas);
  const [presenceFeedback, setPresenceFeedback] = useState<string | null>(null);

  // Mantém a lista de súmulas atualizada no dashboard quando houver sincronização remota ou local
  useEffect(() => {
    const handleSumulasChanged = () => {
      setStoredSumulas(getStoredSumulas());
    };
    window.addEventListener('futplay_sumulas_changed', handleSumulasChanged);

    // Busca súmulas online no Supabase na montagem para garantir sincronização entre aparelhos
    if (isSupabaseConfigured()) {
      supabaseService.getPeladaSumulas().then((remote) => {
        if (remote && remote.length > 0) {
          const ALL_KEY = 'futplay_todas_sumulas_peladas_v1';
          const local = getStoredSumulas();
          const localMap = new Map(local.map((s) => [s.id, s]));
          let hasChanges = false;
          for (const r of remote) {
            const loc = localMap.get(r.id);
            if (!loc) {
              localMap.set(r.id, r);
              hasChanges = true;
            } else {
              const locT = new Date(loc.lastUpdated || 0).getTime();
              const remT = new Date(r.lastUpdated || 0).getTime();
              if (remT > locT) {
                localMap.set(r.id, r);
                hasChanges = true;
              }
            }
          }
          if (hasChanges) {
            const merged = Array.from(localMap.values()).sort((a, b) => {
              const tA = new Date(a.lastUpdated || a.matchDate || 0).getTime();
              const tB = new Date(b.lastUpdated || b.matchDate || 0).getTime();
              return tB - tA;
            });
            localStorage.setItem(ALL_KEY, JSON.stringify(merged));
            setStoredSumulas(merged);
          }
        }
      });
    }

    return () => {
      window.removeEventListener('futplay_sumulas_changed', handleSumulasChanged);
    };
  }, []);

  const normalizeText = (text: string) =>
    (text || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  // Nome do time do usuário atual (atleta ou treinador)
  const resolvedTeamName = (
    currentUser?.teamName ||
    currentPlayerProfile?.teamName ||
    activeProfile?.teamName ||
    profiles.find((p) => p.userId === currentUser?.id)?.teamName ||
    ''
  ).trim();

  const userTeamNormalized = normalizeText(resolvedTeamName);
  const userTeamNameLower = userTeamNormalized;

  // Filtra as súmulas pertencentes ao time vinculado ao atleta/treinador
  const myTeamSumulas = useMemo(() => {
    const myNameNorm = normalizeText(
      currentPlayerProfile?.displayName || activeProfile?.displayName || ''
    );

    return storedSumulas.filter((s) => {
      if (currentUser?.role === 'admin') return true;
      const sTeamNorm = normalizeText(s.teamName || '');
      // 1. Mesmo time vinculado
      if (sTeamNorm && userTeamNormalized && sTeamNorm === userTeamNormalized) return true;
      // 2. Criado pelo usuário
      if (s.createdByUserId && s.createdByUserId === currentUser?.id) return true;
      // 3. Atleta presente na lista de chegada
      if (myNameNorm && s.arrivalList?.some((a) => normalizeText(a.playerName) === myNameNorm)) return true;
      // 4. Atleta em qualquer escalação da súmula
      if (
        myNameNorm &&
        Object.values(s.teamLineups || {}).some((lineup) =>
          lineup.some((p) => normalizeText(p.player) === myNameNorm)
        )
      ) {
        return true;
      }
      return false;
    });
  }, [
    storedSumulas,
    currentUser?.role,
    currentUser?.id,
    userTeamNormalized,
    currentPlayerProfile?.displayName,
    activeProfile?.displayName,
  ]);

  // Encontra a súmula mais recente do time que possui jogos realizados com vitórias/empates
  const latestSumulaWithGames = useMemo(() => {
    return myTeamSumulas.find((s) =>
      (s.teamsGrid || []).some((row) =>
        (row.matches || []).some((m) => m === 'V' || m === 'E' || m === 'D')
      )
    );
  }, [myTeamSumulas]);

  const handleSuperCapasPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canRenewSuperCapasPhoto) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      if (res) {
        setSuperCapasPhoto(res);
        try {
          localStorage.setItem('futplay_super_capas_team_photo_v1', res);
        } catch {}

        // Sincroniza a foto na própria súmula ativa dos Super Capas para que todos os jogadores recebam pelo Supabase
        if (latestSumulaWithGames) {
          const updated: SumulaData = {
            ...latestSumulaWithGames,
            superCapasPhotoUrl: res,
            lastUpdated: new Date().toISOString(),
          };
          saveSumulaToList(updated, true);
          setStoredSumulas(getStoredSumulas());
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleToggleSuperCapasActive = () => {
    if (!canRenewSuperCapasPhoto || !latestSumulaWithGames) return;
    const currentActive = latestSumulaWithGames.isSuperCapasActive !== false;
    const newStatus = !currentActive;
    const updated: SumulaData = {
      ...latestSumulaWithGames,
      isSuperCapasActive: newStatus,
      lastUpdated: new Date().toISOString(),
    };
    saveSumulaToList(updated, true);
    setStoredSumulas(getStoredSumulas());
    notify(
      'success',
      newStatus ? 'Super Capas Ativado' : 'Super Capas Ocultado',
      newStatus
        ? 'O card dos Super Capas da Semana agora está visível para todos os jogadores vinculados ao time.'
        : 'O card dos Super Capas foi ocultado do painel dos jogadores.'
    );
  };

  // Cálculo dos Super Capas da Semana baseado na última rodada com jogos realizados do time
  const superCapasInfo = useMemo(() => {
    try {
      const sumula = latestSumulaWithGames;
      if (!sumula || !sumula.teamsGrid || sumula.teamsGrid.length === 0) return null;

      const hasPlayedGames = sumula.teamsGrid.some((row) =>
        (row.matches || []).some((m) => m === 'V' || m === 'E' || m === 'D')
      );
      if (!hasPlayedGames) return null;

      // Calcula pontuação e estatísticas de cada time na súmula
      const teamsStats = sumula.teamsGrid.map((row) => {
        const wins = (row.matches || []).filter((m) => m === 'V').length;
        const draws = (row.matches || []).filter((m) => m === 'E').length;
        const points = wins * 3 + draws * 1;

        // Jogadores e gols deste time
        const lineup = (sumula.teamLineups && sumula.teamLineups[row.teamName]) || [];
        const totalGoals = lineup.reduce((acc, p) => acc + (Number(p.goals) || 0), 0);

        return {
          teamName: row.teamName,
          wins,
          draws,
          points,
          totalGoals,
          lineup,
        };
      });

      // Ordena pelo maior número de pontos, depois vitórias, depois gols
      teamsStats.sort((a, b) => b.points - a.points || b.wins - a.wins || b.totalGoals - a.totalGoals);
      const winner = teamsStats[0];
      if (!winner) return null;

      // Jogadores vencedores ordenados por número de gols marcados e com contagem de cartões da súmula
      const winningPlayers = [...winner.lineup]
        .map((p) => {
          const pNameUpper = p.player.trim().toUpperCase();
          const yellowCards = (sumula.yellowCards || []).filter(
            (c) => c.trim().toUpperCase() === pNameUpper
          ).length;
          const blueCards = (sumula.blueCards || []).filter(
            (c) => c.trim().toUpperCase() === pNameUpper
          ).length;
          const redCards = (sumula.redCards || []).filter(
            (c) => c.trim().toUpperCase() === pNameUpper
          ).length;

          return {
            name: p.player,
            goals: Number(p.goals) || 0,
            isSub: Boolean(p.isSub),
            wins: winner.wins,
            draws: winner.draws,
            yellowCards,
            blueCards,
            redCards,
          };
        })
        .sort((a, b) => b.goals - a.goals);

      // Data de vigência de uma semana
      const matchDateStr = sumula.matchDate || new Date().toLocaleDateString('pt-BR');

      return {
        sumulaId: sumula.id,
        matchDate: matchDateStr,
        teamName: winner.teamName,
        wins: winner.wins,
        draws: winner.draws,
        totalGoals: winner.totalGoals,
        players: winningPlayers,
        photoUrl: sumula.superCapasPhotoUrl,
        isActive: sumula.isSuperCapasActive !== false,
      };
    } catch (e) {
      console.warn('Erro ao calcular Super Capas da Semana:', e);
      return null;
    }
  }, [latestSumulaWithGames]);

  // Verificação de Hoje vs Dia da Pelada
  const now = new Date();
  const currentYyyy = now.getFullYear();
  const currentMm = String(now.getMonth() + 1).padStart(2, '0');
  const currentDd = String(now.getDate()).padStart(2, '0');
  const todayDateStr = `${currentYyyy}-${currentMm}-${currentDd}`;

  // Dia selecionado no carrossel (por padrão, o dia de hoje)
  const [selectedDayDate, setSelectedDayDate] = useState<string>(todayDateStr);

  const isPeladaToday = peladaConfig.date === todayDateStr;

  // Mapeamento de Jogos Oficiais por data (YYYY-MM-DD)
  const officialMatchesByDate = useMemo(() => {
    const map = new Map<string, Match[]>();
    if (!matches || !Array.isArray(matches)) return map;

    for (const m of matches) {
      if (m.status === 'cancelada' || m.status === 'anulada') continue;
      let dStr = '';
      if (m.scheduledAt) {
        if (m.scheduledAt.includes('T')) {
          dStr = m.scheduledAt.split('T')[0];
        } else if (m.scheduledAt.includes(' ')) {
          dStr = m.scheduledAt.split(' ')[0];
        } else {
          dStr = m.scheduledAt;
        }
      }
      if (dStr) {
        const list = map.get(dStr) || [];
        list.push(m);
        map.set(dStr, list);
      }
    }
    return map;
  }, [matches]);

  const todayOfficialMatches = officialMatchesByDate.get(todayDateStr) || [];

  // Timer para contagem regressiva em tempo real (1s se for hoje, 30s se for outro dia)
  const [timerTick, setTimerTick] = useState<number>(0);
  useEffect(() => {
    const interval = setInterval(() => setTimerTick((t) => t + 1), isPeladaToday ? 1000 : 30000);
    return () => clearInterval(interval);
  }, [isPeladaToday]);

  // Data atual formatada (ex.: Quarta-feira, 28 de Outubro de 2026)
  const todayFormatted = useMemo(() => {
    const d = new Date();
    const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
    const dayMonthYear = d.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${dayMonthYear}`;
  }, [timerTick]);

  // Data atual formatada compacta (ex.: Qua, 28 Out)
  const compactTodayFormatted = useMemo(() => {
    const d = new Date();
    const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    const dayMonth = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
    const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    const dayMonthCap = dayMonth.charAt(0).toUpperCase() + dayMonth.slice(1);
    return `${weekdayCap}, ${dayMonthCap}`;
  }, [timerTick]);

  // Carrossel horizontal de dias com centralização no dia atual
  const carouselRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);

  // Drag suave com mouse ou toque diretamente nos números + efeito de zoom no deslize
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);

  // Centraliza e seleciona o dia mais próximo do centro do carrossel
  const snapToClosestDay = () => {
    if (!carouselRef.current) return;
    const container = carouselRef.current;
    const center = container.scrollLeft + container.offsetWidth / 2;
    const items = container.querySelectorAll<HTMLElement>('[data-date]');
    let closestItem: HTMLElement | null = null;
    let minDiff = Infinity;

    items.forEach((item) => {
      const itemCenter = item.offsetLeft + item.offsetWidth / 2;
      const diff = Math.abs(itemCenter - center);
      if (diff < minDiff) {
        minDiff = diff;
        closestItem = item;
      }
    });

    if (closestItem) {
      const activeEl = closestItem as HTMLElement;
      const targetDate = activeEl.getAttribute('data-date');
      if (targetDate) {
        setSelectedDayDate(targetDate);
      }
      const scrollLeft =
        activeEl.offsetLeft - container.offsetWidth / 2 + activeEl.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }
  };

  // Ao deslizar, detecta o dia no centro e aplica o efeito ampliado dinamicamente
  const handleCarouselScroll = () => {
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      if (!carouselRef.current) return;
      const container = carouselRef.current;
      const center = container.scrollLeft + container.offsetWidth / 2;
      const items = container.querySelectorAll<HTMLElement>('[data-date]');
      let closestDate = '';
      let minDiff = Infinity;

      items.forEach((item) => {
        const d = item.getAttribute('data-date');
        if (!d) return;
        const itemCenter = item.offsetLeft + item.offsetWidth / 2;
        const diff = Math.abs(itemCenter - center);
        if (diff < minDiff) {
          minDiff = diff;
          closestDate = d;
        }
      });

      if (closestDate && minDiff < 32) {
        setSelectedDayDate((prev) => (prev === closestDate ? prev : closestDate));
      }
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!carouselRef.current) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.pageX - carouselRef.current.offsetLeft;
    scrollLeftRef.current = carouselRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !carouselRef.current) return;
    const x = e.pageX - carouselRef.current.offsetLeft;
    const walk = x - startXRef.current;
    if (Math.abs(walk) > 4) {
      hasMovedRef.current = true;
    }
    carouselRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current && hasMovedRef.current) {
      snapToClosestDay();
    }
    isDraggingRef.current = false;
  };

  const handleTouchStart = () => {
    hasMovedRef.current = false;
  };

  const handleTouchMove = () => {
    hasMovedRef.current = true;
  };

  const handleTouchEnd = () => {
    if (hasMovedRef.current) {
      snapToClosestDay();
    }
  };

  const handleDayClick = (dayDate: string, targetEl: HTMLElement | null) => {
    if (hasMovedRef.current) return;
    setSelectedDayDate(dayDate);
    if (targetEl && carouselRef.current) {
      const container = carouselRef.current;
      const scrollLeft = targetEl.offsetLeft - container.offsetWidth / 2 + targetEl.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }
  };

  const handleResetToToday = () => {
    setSelectedDayDate(todayDateStr);
    if (todayRef.current && carouselRef.current) {
      const container = carouselRef.current;
      const target = todayRef.current;
      const scrollLeft = target.offsetLeft - container.offsetWidth / 2 + target.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }
  };

  // Lista de dias do carrossel: 4 dias no passado e 20 dias no futuro
  const carouselDays = useMemo(() => {
    const list = [];
    const base = new Date();
    base.setHours(12, 0, 0, 0);

    // Conjunto de datas de súmulas cadastradas
    const sumulaDates = new Set<string>();
    try {
      for (const s of storedSumulas) {
        if (s.matchDate) {
          const parts = s.matchDate.split('/');
          if (parts.length === 3) {
            sumulaDates.add(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
          }
        }
      }
    } catch {}

    // Dia da semana habitual de pelada (baseado na data configurada, ex: sábado = 6)
    let peladaDayOfWeek = 6;
    try {
      const [py, pm, pd] = peladaConfig.date.split('-').map(Number);
      peladaDayOfWeek = new Date(py, pm - 1, pd, 12, 0, 0).getDay();
    } catch {}

    const myTeamLower = (
      activeProfile.teamName ||
      currentUser?.teamName ||
      ''
    ).toLowerCase().trim();

    for (let offset = -4; offset <= 20; offset++) {
      const d = new Date(base);
      d.setDate(base.getDate() + offset);

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const isToday = dateStr === todayDateStr;
      const isExactConfig = dateStr === peladaConfig.date;
      const isSumula = sumulaDates.has(dateStr);
      const isWeeklyPelada = d.getDay() === peladaDayOfWeek;
      const isPelada = isExactConfig || isSumula || isWeeklyPelada;

      const dayOfficialMatches = officialMatchesByDate.get(dateStr) || [];
      const hasOfficialMatch = dayOfficialMatches.length > 0;
      const hasMyTeamMatch = dayOfficialMatches.some(
        (m) =>
          (m.homeTeamName && m.homeTeamName.toLowerCase().trim() === myTeamLower) ||
          (m.awayTeamName && m.awayTeamName.toLowerCase().trim() === myTeamLower)
      );

      const weekdayShort = d
        .toLocaleDateString('pt-BR', { weekday: 'short' })
        .replace('.', '')
        .toUpperCase();

      const monthShort = d
        .toLocaleDateString('pt-BR', { month: 'short' })
        .replace('.', '')
        .toUpperCase();

      list.push({
        dateStr,
        dayNumber: d.getDate(),
        weekdayShort,
        monthShort,
        isToday,
        isPelada,
        isExactConfig,
        hasOfficialMatch,
        officialMatches: dayOfficialMatches,
        hasMyTeamMatch,
        isPast: offset < 0,
      });
    }
    return list;
  }, [todayDateStr, peladaConfig.date, storedSumulas, officialMatchesByDate, activeProfile.teamName, currentUser?.teamName]);

  // Centraliza no dia atual quando o carrossel é montado ou a data muda
  useEffect(() => {
    const timer = setTimeout(() => {
      if (todayRef.current && carouselRef.current) {
        const container = carouselRef.current;
        const target = todayRef.current;
        const scrollLeft = target.offsetLeft - container.offsetWidth / 2 + target.offsetWidth / 2;
        container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [todayDateStr]);

  const handleScrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const delta = direction === 'left' ? -180 : 180;
      carouselRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  // Contagem regressiva em HORAS para o horário da pelada (quando é o dia da pelada)
  const todayHourlyCountdown = useMemo(() => {
    if (!isPeladaToday) return null;
    const [h, m] = (peladaConfig.time || '16:00').split(':').map(Number);
    const d = new Date();
    const matchTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h || 0, m || 0, 0);
    const diffMs = matchTime.getTime() - Date.now();

    if (diffMs <= 0) {
      return {
        hours: 0,
        minutes: 0,
        seconds: 0,
        isUnderway: true,
      };
    }

    const totalSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    return {
      hours,
      minutes,
      seconds,
      isUnderway: false,
    };
  }, [isPeladaToday, peladaConfig.time, timerTick]);

  const countdown = useMemo(
    () => calculatePeladaCountdown(peladaConfig.date, peladaConfig.time),
    [peladaConfig.date, peladaConfig.time, timerTick]
  );

  const formattedMatchDate = useMemo(
    () => formatPeladaDateExtended(peladaConfig.date),
    [peladaConfig.date]
  );



  // Status de Presença do atleta na súmula da rodada atual do seu time
  const activeSumula = myTeamSumulas[0];
  const myNameUpper = activeProfile.displayName.trim().toUpperCase();
  const myArrivalEntry = activeSumula?.arrivalList?.find(
    (a) => a.playerName.trim().toUpperCase() === myNameUpper
  );
  const isMyPresenceConfirmed = Boolean(myArrivalEntry?.confirmed);
  const confirmedCount =
    activeSumula?.arrivalList?.filter((a) => a.confirmed).length || 0;
  const totalRosterCount = activeSumula?.arrivalList?.length || 0;

  // Alternar presença do atleta diretamente no Card (conta admin não participa)
  const handleToggleMyPresence = () => {
    if (isAdmin) return;
    try {
      const all = getStoredSumulas();
      let current = all.find(
        (s) => (s.teamName || '').trim().toLowerCase() === userTeamNameLower && s.status === 'em_andamento'
      ) || myTeamSumulas.find((s) => s.status === 'em_andamento') || myTeamSumulas[0];
      const isGk = activeProfile.position === 'goleiro';

      if (!current) {
        // Se ainda não existir súmula para o time E o usuário NÃO for treinador/coach, NÃO cria súmula!
        if (!isCoach) {
          setPresenceFeedback('Aguarde o treinador abrir a súmula da rodada.');
          setTimeout(() => setPresenceFeedback(null), 3000);
          return;
        }

        // Se for treinador, cria a súmula oficial do time:
        const teamProfiles = profiles.filter((p) => {
          const pTeam = (p.teamName || '').trim().toLowerCase();
          return pTeam === userTeamNameLower;
        });
        const activeAthletes = teamProfiles.length > 0 ? teamProfiles : [activeProfile];
        const initialArrivals: SumulaData['arrivalList'] = activeAthletes.map((p, idx) => ({
          order: idx + 1,
          playerName: p.displayName.trim().toUpperCase(),
          confirmed: p.id === activeProfile.id,
          isGuest: false,
          isGoalkeeper: p.position === 'goleiro',
          note: p.position === 'goleiro' ? 'Goleiro' : undefined,
        }));

        const fresh: SumulaData = {
          id: `sumula-pelada-${Date.now()}`,
          status: 'em_andamento',
          matchDate: formatPeladaDateExtended(peladaConfig.date),
          startTime: peladaConfig.time,
          lastUpdated: new Date().toISOString(),
          teamName: activeProfile.teamName || currentUser?.teamName || 'Meu Time',
          createdByUserId: currentUser?.id,
          createdByName: activeProfile.displayName,
          timerSeconds: 0,
          isTimerRunning: false,
          arrivalList: initialArrivals,
          yellowCards: [],
          blueCards: [],
          redCards: [],
          goalkeepers: syncFixedGoalkeepers(initialArrivals),
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

        saveSumulaToList(fresh);
        setStoredSumulas(getStoredSumulas());
        setPresenceFeedback('✓ Sua presença na pelada foi confirmada!');
        setTimeout(() => setPresenceFeedback(null), 3000);
        return;
      }

      let found = false;
      const updatedArrivals = (current.arrivalList || []).map((a) => {
        if (a.playerName.trim().toUpperCase() === myNameUpper) {
          found = true;
          return {
            ...a,
            confirmed: !a.confirmed,
            isGoalkeeper: isGk,
          };
        }
        return a;
      });

      if (!found) {
        updatedArrivals.push({
          order: updatedArrivals.length + 1,
          playerName: activeProfile.displayName,
          confirmed: true,
          isGuest: false,
          isGoalkeeper: isGk,
        });
      }

      const updatedSumula: SumulaData = {
        ...current,
        arrivalList: updatedArrivals,
        goalkeepers: syncFixedGoalkeepers(updatedArrivals),
        lastUpdated: new Date().toISOString(),
      };

      saveSumulaToList(updatedSumula);
      setStoredSumulas(getStoredSumulas());

      const willBeConfirmed = !isMyPresenceConfirmed;
      setPresenceFeedback(
        willBeConfirmed
          ? '✓ Sua presença na pelada foi confirmada!'
          : 'Presença desmarcada na súmula.'
      );
      setTimeout(() => setPresenceFeedback(null), 3000);
    } catch (e) {
      console.warn('Erro ao atualizar presença na pelada:', e);
    }
  };

  // Salvar novo dia e horário da pelada
  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: PeladaScheduleConfig = {
      date: editDate,
      time: editTime,
      venueName: editVenue.trim() || 'Arena Society Planalto - BA',
      neighborhood: peladaConfig.neighborhood,
    };
    setPeladaConfig(updated);
    try {
      localStorage.setItem('futplay_pelada_schedule_v1', JSON.stringify(updated));

      // Sincroniza a data e horário também na súmula da rodada atual se existir
      const [y, m, d] = updated.date.split('-');
      const dateBr = `${d}/${m}/${y}`;
      const current = myTeamSumulas[0];
      if (current) {
        const syncedSumula: SumulaData = {
          ...current,
          matchDate: dateBr,
          startTime: updated.time,
          lastUpdated: new Date().toISOString(),
        };
        saveSumulaToList(syncedSumula);
        setStoredSumulas(getStoredSumulas());
      }
    } catch (err) {
      console.warn('Erro ao salvar agendamento da pelada:', err);
    }
    setShowEditScheduleModal(false);
  };

  // Atalhos de datas no modal de edição
  const handleSetPresetDate = (type: 'sabado' | 'quarta' | 'hoje') => {
    const now = new Date();
    if (type === 'hoje') {
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      setEditDate(`${yyyy}-${mm}-${dd}`);
      return;
    }
    const targetDayOfWeek = type === 'sabado' ? 6 : 3;
    const currentDay = now.getDay();
    let daysUntil = (targetDayOfWeek - currentDay + 7) % 7;
    if (daysUntil === 0) daysUntil = 7;
    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + daysUntil);
    const yyyy = nextDate.getFullYear();
    const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
    const dd = String(nextDate.getDate()).padStart(2, '0');
    setEditDate(`${yyyy}-${mm}-${dd}`);
  };

  const userTeamName =
    currentUser?.teamName ||
    activeProfile.teamName ||
    'Meu Time';
  const userTeamCrest =
    currentUser?.teamCrestUrl || activeProfile.teamCrestUrl;

  const mySeasonEntry = seasonEntries.find(
    (se) =>
      se.seasonId === selectedSeasonId && se.playerId === activeProfile.id
  ) || {
    id: 'temp',
    seasonId: selectedSeasonId,
    playerId: activeProfile.id,
    divisionId: activeProfile.currentDivisionId,
    seasonPoints: 0,
    pendingPoints: 0,
    matchesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals: 0,
    assists: 0,
    mvpCount: 0,
    superCapas: 0,
    goalkeeperCapas: 0,
    capaEfficiencyPct: 0,
    yellowCards: 0,
    blueCards: 0,
    redCards: 0,
    cleanSheets: 0,
    defensiveActions: 0,
    status: 'provisorio' as const,
    updatedAt: activeProfile.updatedAt,
  };

  const myDivision =
    divisions.find((d) => d.id === activeProfile.currentDivisionId) ||
    divisions[0];

  const cityEntriesWithProfile = seasonEntries
    .filter((se) => se.seasonId === selectedSeasonId)
    .map((entry) => ({
      entry,
      profile: profiles.find((p) => p.id === entry.playerId)!,
    }))
    .filter((item) => item.profile && item.profile.cityId === selectedCityId);

  const sortedByGoals = [...cityEntriesWithProfile].sort(
    (a, b) => b.entry.goals - a.entry.goals
  );
  const myRankByGoals =
    sortedByGoals.findIndex((i) => i.profile.id === activeProfile.id) + 1;

  const sortedByPresences = [...cityEntriesWithProfile].sort(
    (a, b) => b.entry.matchesPlayed - a.entry.matchesPlayed
  );
  const myRankByPresences =
    sortedByPresences.findIndex((i) => i.profile.id === activeProfile.id) + 1;

  const myGoals = mySeasonEntry.goals || 0;
  const myPresences = mySeasonEntry.matchesPlayed || 0;
  const myGoalsAvg =
    myPresences > 0
      ? (myGoals / myPresences).toFixed(2).replace('.', ',')
      : '0,00';
  const mySuperCapas =
    mySeasonEntry.superCapas ?? mySeasonEntry.mvpCount ?? 0;
  const myGoalkeeperCapas = mySeasonEntry.goalkeeperCapas ?? 0;
  const myCapaPct =
    mySeasonEntry.capaEfficiencyPct ??
    (myPresences > 0 ? Math.round((mySuperCapas / myPresences) * 100) : 0);
  const myYellowCards = mySeasonEntry.yellowCards ?? 0;
  const myBlueCards = mySeasonEntry.blueCards ?? 0;

  // Cartões vermelhos (da temporada + súmulas de peladas registradas)
  const myRedCardsFromSumulas = (() => {
    try {
      const sumulas = getStoredSumulas();
      const name = activeProfile.displayName.trim().toUpperCase();
      let count = 0;
      for (const s of sumulas) {
        if (s.redCards) {
          count += s.redCards.filter((p) => p.trim().toUpperCase() === name).length;
        }
      }
      return count;
    } catch {
      return 0;
    }
  })();
  const myRedCards = (mySeasonEntry.redCards ?? 0) + myRedCardsFromSumulas;

  const overallStars =
    activeProfile.overallStars ??
    (activeProfile.skills
      ? (activeProfile.skills.finalizacao +
          activeProfile.skills.marcacao +
          activeProfile.skills.passe +
          activeProfile.skills.raca +
          activeProfile.skills.drible) /
        5
      : 0);

  const skills = activeProfile.skills || {
    finalizacao: 0,
    marcacao: 0,
    passe: 0,
    raca: 0,
    drible: 0,
  };

  const handleCopyShareCard = () => {
    const shareText = `⚽ FUTPLAY LITE • CARTÃO OFICIAL\nAtleta: ${activeProfile.displayName} (${activeProfile.position.toUpperCase()})\nTime: ${userTeamName}\nMunicípio: ${activeCity.name}-${activeCity.stateCode}\n⭐ Avaliação: ${(overallStars || 0).toFixed(1)} ⭐\n⚽ Gols: ${myGoals} (Média ${myGoalsAvg}/jogo)\n🏟️ Presenças: ${myPresences} jogos\n✨ Destaques: ${activeProfile.position === 'goleiro' ? myGoalkeeperCapas : mySuperCapas} (${myCapaPct}%)\n🟨 Amarelos: ${myYellowCards} | 🟦 Azuis: ${myBlueCards} | 🟥 Vermelhos: ${myRedCards}`;
    try {
      navigator.clipboard.writeText(shareText);
      setCopiedCard(true);
      setTimeout(() => setCopiedCard(false), 2500);
    } catch {
      // Fallback
    }
  };

  const [sharedSuperCapasFeedback, setSharedSuperCapasFeedback] = useState<boolean>(false);

  const handleShareSuperCapas = async () => {
    if (!superCapasInfo) return;
    const playersText = superCapasInfo.players
      .map(
        (p, idx) =>
          `${idx === 0 ? '👑 ' : '⚽ '}${p.name}: ${p.goals} ${p.goals === 1 ? 'gol' : 'gols'} (${p.wins}V - ${p.draws}E)`
      )
      .join('\n');

    const text = `🏆 SUPER CAPAS DA SEMANA • FUTPLAY LITE\n⭐ Equipe Campeã: ${superCapasInfo.teamName}\n📅 Rodada: ${superCapasInfo.matchDate}\n🏟️ Arena Society Planalto - BA\n📊 Desempenho: ${superCapasInfo.wins} Vitórias · ${superCapasInfo.draws} Empates · ${superCapasInfo.totalGoals} Gols\n\n👑 ELENCO DOS SUPER CAPAS:\n${playersText}\n\n⚽ Acompanhe a Liga Society Planalto - BA no FutPlay Lite!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `🏆 Super Capas da Semana - ${superCapasInfo.teamName}`,
          text: text,
        });
        return;
      } catch (err) {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setSharedSuperCapasFeedback(true);
      setTimeout(() => setSharedSuperCapasFeedback(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="space-y-4">
      {/* ================================================================= */}
      {/* 1. CARD: SUPER CAPAS DA SEMANA (NO INÍCIO DO DASHBOARD)           */}
      {/* Exibido para todos os jogadores vinculados ao time quando ativo   */}
      {/* ================================================================= */}
      {superCapasInfo && (isCoach || isAdmin || superCapasInfo.isActive) && (
        <SuperCapasCard
          data={{
            sumulaId: superCapasInfo.sumulaId,
            matchDate: superCapasInfo.matchDate,
            teamName: superCapasInfo.teamName,
            wins: superCapasInfo.wins,
            draws: superCapasInfo.draws,
            totalGoals: superCapasInfo.totalGoals,
            venueName: 'Arena Society Planalto - BA',
            players: superCapasInfo.players,
            isActive: superCapasInfo.isActive,
          }}
          photoUrl={superCapasInfo.photoUrl || superCapasPhoto || DEFAULT_SUPER_CAPAS_PHOTO}
          onPhotoUpload={canRenewSuperCapasPhoto ? handleSuperCapasPhotoUpload : undefined}
          onShare={() => setShowSuperCapasShareModal(true)}
          onToggleActive={canRenewSuperCapasPhoto ? handleToggleSuperCapasActive : undefined}
          isCoachOrAdmin={canRenewSuperCapasPhoto}
        />
      )}

      {/* 2. PAINEL DE CONTROLE (ADMIN) OU CARTÃO OFICIAL DE ATLETA (JOGADOR) */}
      {isAdmin ? (
        <div className="w-full rounded-2xl border border-purple-300/80 bg-gradient-to-b from-purple-800 via-indigo-900 to-slate-950 p-4 text-white shadow-md relative overflow-hidden">
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-purple-950/70 via-indigo-950/80 to-slate-950/95 pointer-events-none" />
          <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-purple-500/20 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />

          <div className="relative z-10 space-y-3">
            <div className="flex items-center justify-between border-b border-white/15 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-purple-500/20 p-2 text-purple-300 border border-purple-400/30">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase text-purple-200 tracking-wide">
                    Painel do Administrador
                  </h2>
                  <p className="text-[10px] text-purple-300/80">
                    Conta Gestora da Liga · {currentUser.email}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                ADMIN
              </span>
            </div>

            <div className="rounded-xl bg-white/10 backdrop-blur-xs p-3 border border-white/10 text-xs text-purple-100 font-medium leading-relaxed">
              Você possui acesso administrativo completo para gerenciar e auditar súmulas, partidas e configurações de todos os times. <strong>Esta conta não participa como atleta</strong> e não é listada em súmulas ou rankings esportivos.
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white p-2.5 text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer text-left"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-purple-200" />
                <div>
                  <div className="leading-tight">Homologação</div>
                  <div className="text-[9px] text-purple-200 font-normal">Auditar resultados</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('matches')}
                className="flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 text-white p-2.5 text-xs font-bold border border-white/20 shadow-xs transition active:scale-95 cursor-pointer text-left"
              >
                <Swords className="h-4 w-4 shrink-0 text-amber-300" />
                <div>
                  <div className="leading-tight">Todas as Súmulas</div>
                  <div className="text-[9px] text-blue-200 font-normal">Acessar partidas</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full rounded-2xl border border-blue-200/80 bg-gradient-to-b from-blue-700 via-blue-800 to-blue-950 p-3.5 text-white shadow-md relative overflow-hidden">
        {/* Imagem de Fundo Oficial do Estádio com Refletores */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-80"
          style={{
            backgroundImage: "url('/images/stadium-super-capas.jpg')",
          }}
        />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#0a1435]/70 via-[#07112c]/80 to-[#030612]/92 pointer-events-none" />

        {/* Efeito Glow Luminoso Decorativo */}
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-blue-500/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />

        {/* Topo do Cartão: Título e Compartilhar */}
        <div className="relative z-10 flex items-center justify-between border-b border-white/15 pb-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-blue-100 uppercase">
            <Award className="h-3.5 w-3.5 text-amber-300" />
            <span>Cartão Oficial de Atleta</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-amber-300 shadow-xs transition active:scale-90 cursor-pointer"
              title="Compartilhar Cartão Oficial (Imagem 9:16)"
              aria-label="Compartilhar Cartão Oficial"
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Corpo do Cartão */}
        <div className="relative z-10 mt-3 text-center">
          {/* Jogador e Time Lado a Lado (Foto/Brasão e Nomes do Mesmo Tamanho) */}
          <div className="grid grid-cols-2 gap-3 items-start">
            {/* Coluna do Atleta */}
            <div className="flex flex-col items-center">
              <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-white text-2xl font-black text-blue-900 shadow-md border-2 border-amber-300/80 font-display shrink-0">
                {activeProfile.avatarUrl ? (
                  <img
                    src={activeProfile.avatarUrl}
                    alt={activeProfile.displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  activeProfile.displayName.slice(0, 2).toUpperCase()
                )}
              </div>

              {/* Nome do Atleta */}
              <h1
                className="mt-1.5 w-full text-center text-sm sm:text-base font-black tracking-wide text-white uppercase font-display leading-tight line-clamp-2 px-1 min-h-[2.4rem] flex items-center justify-center"
                title={activeProfile.displayName}
              >
                {activeProfile.displayName}
              </h1>
            </div>

            {/* Coluna do Time */}
            <div className="flex flex-col items-center">
              <div
                className="relative flex h-16 w-16 items-center justify-center shrink-0"
                title={`Time: ${userTeamName}`}
              >
                <TeamCrestBadge
                  name={userTeamName}
                  crestUrl={userTeamCrest}
                  size={60}
                  className="drop-shadow-lg"
                />
              </div>

              {/* Nome do Time */}
              <div
                className="mt-1.5 w-full text-center text-sm sm:text-base font-black tracking-wide text-amber-300 uppercase font-display leading-tight line-clamp-2 px-1 min-h-[2.4rem] flex items-center justify-center"
                title={userTeamName}
              >
                {userTeamName}
              </div>
            </div>
          </div>

          {/* Posição, Pé Dominante e Cidade em Linha Compacta */}
          <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-blue-200">
            <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase flex items-center gap-0.5">
              {activeProfile.position === 'goleiro' ? '🧤 Goleiro' : `🏃 ${activeProfile.position}`}
            </span>
            <span>·</span>
            <span>Pé {activeProfile.dominantFoot}</span>
            <span>·</span>
            <span className="text-white/90 font-medium">
              {activeCity.name}/{activeCity.stateCode}
            </span>
          </div>

          {/* Avaliação em Estrelas (0 a 5 ⭐) */}
          <div className="mt-2 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setShowRatingModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/40 px-3 py-1 text-[11px] font-bold text-amber-200 transition active:scale-95"
              title="Clique para ver a avaliação de habilidades"
            >
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => {
                  const isFilled = overallStars > 0 && s <= Math.round(overallStars);
                  return (
                    <Star
                      key={s}
                      className={`h-3 w-3 ${
                        isFilled
                          ? 'fill-amber-400 text-amber-300'
                          : 'fill-white/10 text-white/30'
                      }`}
                    />
                  );
                })}
              </div>
              <span className="font-mono text-xs font-black text-amber-300">
                {overallStars.toFixed(1)} ⭐
              </span>
              {overallStars > 0 && (
                <span className="inline-flex items-center gap-0.5 font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-400/40 rounded px-1 py-0.2 text-[9px]">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </span>
              )}
            </button>
          </div>

          {/* Quesitos de Habilidade (Se já avaliado) */}
          {overallStars > 0 && (
            <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[9px] font-bold text-blue-100/90 bg-white/10 border border-white/15 rounded-lg p-1.5">
              <div>
                <span className="block text-[8px] text-blue-300 uppercase">Fin</span>
                <span className="font-mono text-amber-300">{skills.finalizacao}★</span>
              </div>
              <div>
                <span className="block text-[8px] text-blue-300 uppercase">Mar</span>
                <span className="font-mono text-amber-300">{skills.marcacao}★</span>
              </div>
              <div>
                <span className="block text-[8px] text-blue-300 uppercase">Pas</span>
                <span className="font-mono text-amber-300">{skills.passe}★</span>
              </div>
              <div>
                <span className="block text-[8px] text-blue-300 uppercase">Raç</span>
                <span className="font-mono text-amber-300">{skills.raca}★</span>
              </div>
              <div>
                <span className="block text-[8px] text-blue-300 uppercase">Dri</span>
                <span className="font-mono text-amber-300">{skills.drible}★</span>
              </div>
            </div>
          )}

          {/* Painel de Métricas Oficiais da Liga */}
          <div className="mt-2.5 grid grid-cols-3 gap-1.5 rounded-xl bg-white/10 border border-white/15 p-2 text-center font-mono">
            <div>
              <div className="text-[9px] text-blue-200 uppercase tracking-wider font-sans">
                Gols (Média)
              </div>
              <div className="text-sm font-black text-white mt-0.5">
                {myGoals}{' '}
                <span className="text-[10px] font-bold text-blue-200">
                  ({myGoalsAvg})
                </span>
              </div>
            </div>
            <div>
              <div className="text-[9px] text-blue-200 uppercase tracking-wider font-sans">
                Presenças
              </div>
              <div className="text-sm font-black text-white mt-0.5">
                {myPresences}J
              </div>
            </div>
            <div>
              <div className="text-[9px] text-blue-200 uppercase tracking-wider font-sans">
                {activeProfile.position === 'goleiro' ? 'Capas GK' : 'Super Capas'}
              </div>
              <div className="text-sm font-black text-white mt-0.5">
                {activeProfile.position === 'goleiro'
                  ? myGoalkeeperCapas
                  : `${mySuperCapas} (${myCapaPct}%)`}
              </div>
            </div>
          </div>

          {/* Disciplina: Amarelos, Azuis e Vermelhos */}
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-mono flex-wrap">
            <span className="rounded bg-amber-400/20 border border-amber-300/30 px-2 py-0.5 font-bold text-amber-100">
              🟨 {myYellowCards} Amarelos
            </span>
            <span className="rounded bg-blue-400/20 border border-blue-300/30 px-2 py-0.5 font-bold text-white">
              🟦 {myBlueCards} Azuis
            </span>
            <span className="rounded bg-red-500/20 border border-red-400/30 px-2 py-0.5 font-bold text-red-200">
              🟥 {myRedCards} Vermelhos
            </span>
          </div>
        </div>
      </div>
      )}

      {/* ================================================================= */}
      {/* 2. CARD DO DIA DA PELADA COM DATA ATUAL OU CONTAGEM EM HORAS     */}
      {/* ================================================================= */}
      <div className="w-full rounded-2xl border border-blue-200/80 bg-gradient-to-b from-blue-700 via-blue-800 to-blue-950 p-3.5 text-white shadow-md relative overflow-hidden">
        {/* Imagem de Fundo Oficial do Estádio com Refletores */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-80"
          style={{
            backgroundImage: "url('/images/stadium-super-capas.jpg')",
          }}
        />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#0a1435]/70 via-[#07112c]/80 to-[#030612]/92 pointer-events-none" />

        {/* Efeito Glow Luminoso Decorativo Idêntico ao Card de Atleta */}
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-blue-500/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />

        {/* Topo Compacto do Card: Data Atual e Controles de Navegação */}
        <div className="relative z-10 flex items-center justify-between pb-1.5 border-b border-white/10">
          <div className="flex items-center gap-1.5 text-xs font-black text-white uppercase tracking-wider">
            <Calendar className="h-3.5 w-3.5 text-amber-300 shrink-0" />
            <span>{compactTodayFormatted}</span>
          </div>

          {/* Botões de Rolagem do Carrossel */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleScrollCarousel('left')}
              className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white transition active:scale-90"
              title="Ver dias anteriores"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleScrollCarousel('right')}
              className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white transition active:scale-90"
              title="Ver próximos dias"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Carrossel de Dias: Deslize com o Toque/Mouse diretamente nos Números com Efeito de Zoom no Centro */}
        <div className="relative z-10 mt-2">
          <div
            ref={carouselRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onScroll={handleCarouselScroll}
            className="flex items-center gap-2 overflow-x-auto py-3 px-3 scroll-smooth no-scrollbar cursor-grab active:cursor-grabbing select-none touch-pan-x"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {carouselDays.map((day) => {
              const isSelected = day.dateStr === selectedDayDate;
              // Aumento rigorosamente padronizado e idêntico para todos os dias ao selecionar ou deslizar
              const baseCardStyle = `w-[50px] h-[70px] shrink-0 rounded-2xl flex flex-col items-center justify-between py-1.5 px-1 text-center select-none cursor-pointer transition-all duration-300 ${
                isSelected
                  ? 'scale-115 -translate-y-1.5 z-20 shadow-xl shadow-black/70 ring-2 ring-amber-300 opacity-100'
                  : 'scale-90 opacity-75 hover:opacity-100 z-0 shadow-md'
              }`;

              // 1. DIA ATUAL COM JOGO OFICIAL
              if (day.isToday && day.hasOfficialMatch) {
                return (
                  <div
                    key={day.dateStr}
                    data-date={day.dateStr}
                    ref={todayRef}
                    onClick={(e) => handleDayClick(day.dateStr, e.currentTarget)}
                    className={`${baseCardStyle} bg-gradient-to-b from-amber-400 to-emerald-500 border-2 border-white animate-pulse`}
                  >
                    <span className="h-4 flex items-center justify-center gap-0.5 text-[8.5px] font-black text-slate-950 uppercase tracking-tight">
                      <Trophy className="h-2 w-2" />
                      {day.weekdayShort}
                    </span>
                    <div className="h-6 w-6 rounded-full bg-emerald-950 text-emerald-300 font-black text-xs flex items-center justify-center font-mono shadow-xs">
                      {String(day.dayNumber).padStart(2, '0')}
                    </div>
                    <span className="h-3.5 flex items-center justify-center text-[7.5px] font-black text-slate-950 uppercase">
                      🏆 HOJE!
                    </span>
                  </div>
                );
              }

              // 2. DIA ATUAL COM PELADA
              if (day.isToday && day.isPelada) {
                return (
                  <div
                    key={day.dateStr}
                    data-date={day.dateStr}
                    ref={todayRef}
                    onClick={(e) => handleDayClick(day.dateStr, e.currentTarget)}
                    className={`${baseCardStyle} bg-gradient-to-b from-amber-400 to-amber-500 border-2 border-white animate-pulse`}
                  >
                    <span className="h-4 flex items-center justify-center gap-0.5 text-[8.5px] font-black text-blue-950 uppercase tracking-tight">
                      <Flame className="h-2 w-2 fill-blue-950" />
                      {day.weekdayShort}
                    </span>
                    <div className="h-6 w-6 rounded-full bg-blue-950 text-amber-300 font-black text-xs flex items-center justify-center font-mono shadow-xs">
                      {String(day.dayNumber).padStart(2, '0')}
                    </div>
                    <span className="h-3.5 flex items-center justify-center text-[7.5px] font-black text-blue-950 uppercase">
                      🔥 HOJE!
                    </span>
                  </div>
                );
              }

              // 3. DIA ATUAL (NORMAL, SEM JOGO) - NÃO FICA AZUL, FICA COM AUMENTO PADRÃO
              if (day.isToday) {
                return (
                  <div
                    key={day.dateStr}
                    data-date={day.dateStr}
                    ref={todayRef}
                    onClick={(e) => handleDayClick(day.dateStr, e.currentTarget)}
                    className={`${baseCardStyle} bg-white/20 backdrop-blur-md border-2 border-white/70 text-white`}
                  >
                    <span className="h-4 flex items-center justify-center text-[8.5px] font-black text-amber-300 uppercase tracking-tight">
                      {day.weekdayShort}
                    </span>
                    <div className="h-6 w-6 rounded-full bg-white text-slate-900 font-black text-xs flex items-center justify-center font-mono shadow-xs">
                      {String(day.dayNumber).padStart(2, '0')}
                    </div>
                    <span className="h-3.5 flex items-center justify-center rounded-full bg-white px-1.5 text-[7px] font-black text-slate-900 uppercase">
                      HOJE
                    </span>
                  </div>
                );
              }

              // 4. DIA COM JOGO OFICIAL MARCADO NA LIGA
              if (day.hasOfficialMatch) {
                return (
                  <div
                    key={day.dateStr}
                    data-date={day.dateStr}
                    onClick={(e) => handleDayClick(day.dateStr, e.currentTarget)}
                    className={`${baseCardStyle} bg-gradient-to-b from-emerald-500/30 via-emerald-600/25 to-teal-800/30 border-2 border-emerald-300/90 text-white ${
                      day.hasMyTeamMatch ? 'ring-2 ring-emerald-300/70' : ''
                    }`}
                  >
                    <span className="h-4 flex items-center justify-center gap-0.5 text-[8.5px] font-black text-emerald-300 uppercase tracking-tight">
                      <Trophy className="h-2 w-2" />
                      {day.weekdayShort}
                    </span>
                    <div className="h-6 w-6 rounded-full bg-emerald-400 text-emerald-950 font-black text-xs flex items-center justify-center font-mono shadow-xs">
                      {String(day.dayNumber).padStart(2, '0')}
                    </div>
                    <span className="h-3.5 flex items-center justify-center text-[7.5px] font-black text-emerald-200 uppercase tracking-tight truncate max-w-[46px]">
                      🏆 OFICIAL
                    </span>
                  </div>
                );
              }

              // 5. DIA DE PELADA
              if (day.isPelada) {
                return (
                  <div
                    key={day.dateStr}
                    data-date={day.dateStr}
                    onClick={(e) => handleDayClick(day.dateStr, e.currentTarget)}
                    className={`${baseCardStyle} bg-gradient-to-b from-amber-400/25 via-amber-500/20 to-amber-600/25 border-2 border-amber-300/90 text-white`}
                  >
                    <span className="h-4 flex items-center justify-center text-[8.5px] font-black text-amber-200 uppercase tracking-tight">
                      {day.weekdayShort}
                    </span>
                    <div className="h-6 w-6 rounded-full bg-amber-400 text-blue-950 font-black text-xs flex items-center justify-center font-mono shadow-xs">
                      {String(day.dayNumber).padStart(2, '0')}
                    </div>
                    <span className="h-3.5 flex items-center justify-center text-[7.5px] font-extrabold text-amber-300 font-mono">
                      ⚽ PELADA
                    </span>
                  </div>
                );
              }

              // 6. DIA NORMAL
              return (
                <div
                  key={day.dateStr}
                  data-date={day.dateStr}
                  onClick={(e) => handleDayClick(day.dateStr, e.currentTarget)}
                  className={`${baseCardStyle} bg-white/10 backdrop-blur-md border border-white/15 text-white`}
                >
                  <span className="h-4 flex items-center justify-center text-[8.5px] font-bold text-blue-200 uppercase tracking-tight">
                    {day.weekdayShort}
                  </span>
                  <div className="h-6 w-6 rounded-full bg-white/15 text-white font-mono font-black text-xs flex items-center justify-center border border-white/20">
                    {String(day.dayNumber).padStart(2, '0')}
                  </div>
                  <span className="h-3.5 flex items-center justify-center text-[7.5px] text-blue-300/80 font-mono uppercase">
                    {day.monthShort}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Corpo do Card: Informações do Jogo ou Data Selecionada */}
        <div className="relative z-10 mt-2 text-center">
          {selectedDayDate !== todayDateStr ? (
            /* VISUALIZAÇÃO DE DIA ESPECÍFICO SELECIONADO NO CARROSSEL */
            (() => {
              const selectedMatches = officialMatchesByDate.get(selectedDayDate) || [];
              const selectedDayObj = carouselDays.find((d) => d.dateStr === selectedDayDate);
              const isPeladaDay = selectedDayObj?.isPelada;

              if (selectedMatches.length > 0) {
                const match = selectedMatches[0];
                return (
                  <div className="rounded-xl bg-emerald-500/20 border border-emerald-400/40 p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-black text-emerald-300 uppercase">
                      <Trophy className="h-3 w-3" />
                      <span>Jogo Oficial da Liga Marcado</span>
                      {selectedDayObj?.hasMyTeamMatch && (
                        <span className="rounded bg-emerald-400 text-emerald-950 px-1.5 py-0.2 text-[8px] font-black">
                          SEU TIME JOGA!
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm font-black text-white uppercase font-display">
                      {match.homeTeamName} vs {match.awayTeamName}
                    </div>
                    <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px] text-emerald-200">
                      <Clock className="h-2.5 w-2.5" />
                      <span>{formatMatchTime(match.scheduledAt)}h</span>
                      <span>·</span>
                      <MapPin className="h-2.5 w-2.5" />
                      <span>{match.venueName}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigate && onNavigate('matches', match.id)}
                        className="rounded-lg bg-emerald-400 text-emerald-950 font-extrabold px-3 py-1 text-[11px] hover:bg-emerald-300 transition shadow-xs active:scale-95"
                      >
                        Ver Partida na Liga
                      </button>
                      <button
                        type="button"
                        onClick={handleResetToToday}
                        className="rounded-lg bg-white/15 hover:bg-white/25 text-white font-bold px-3 py-1 text-[11px] transition active:scale-95"
                      >
                        Voltar para Hoje
                      </button>
                    </div>
                  </div>
                );
              }

              if (isPeladaDay) {
                return (
                  <div className="rounded-xl bg-amber-400/20 border border-amber-300/40 p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-black text-amber-300 uppercase">
                      <Calendar className="h-3 w-3" />
                      <span>Pelada Agendada para este dia</span>
                    </div>
                    <div className="mt-0.5 text-sm font-black text-white uppercase font-display">
                      {formatPeladaDateExtended(selectedDayDate)}
                    </div>
                    <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px] text-amber-200">
                      <Clock className="h-2.5 w-2.5" />
                      <span>{peladaConfig.time}h</span>
                      <span>·</span>
                      <MapPin className="h-2.5 w-2.5" />
                      <span>{peladaConfig.venueName}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={handleResetToToday}
                        className="rounded-lg bg-white/15 hover:bg-white/25 text-white font-bold px-3 py-1 text-[11px] transition active:scale-95"
                      >
                        Voltar para Hoje
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="rounded-xl bg-white/10 border border-white/15 p-2 text-center">
                  <div className="text-xs text-blue-200">
                    Nenhum jogo oficial ou pelada agendada nesta data.
                  </div>
                  <button
                    type="button"
                    onClick={handleResetToToday}
                    className="mt-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-bold px-3 py-1 text-[11px] transition active:scale-95"
                  >
                    Voltar para Hoje
                  </button>
                </div>
              );
            })()
          ) : (
            /* VISUALIZAÇÃO PADRÃO DO DIA DE HOJE */
            <>
              {/* Notificação extra se hoje tiver jogo oficial */}
              {todayOfficialMatches.length > 0 && (
                <div className="mb-2 rounded-xl bg-emerald-500/25 border border-emerald-400/40 p-2 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-[10px] font-black text-emerald-300 uppercase">
                    <Trophy className="h-3 w-3" />
                    <span>Jogo Oficial Marcado Hoje!</span>
                  </div>
                  <div className="text-xs font-black text-white mt-0.5">
                    {todayOfficialMatches[0]?.homeTeamName} vs {todayOfficialMatches[0]?.awayTeamName}
                  </div>
                  <div className="text-[10px] text-emerald-200 mt-0.5">
                    ⏰ {formatMatchTime(todayOfficialMatches[0]?.scheduledAt)}h · {todayOfficialMatches[0]?.venueName}
                  </div>
                </div>
              )}

              {/* Legenda e Informação do Jogo em Linha Compacta */}
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-blue-200 flex-wrap">
                {isPeladaToday ? (
                  <>
                    <span className="rounded bg-amber-400/20 border border-amber-300/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-100 uppercase">
                      ⏰ Bola rolando às {peladaConfig.time}h
                    </span>
                    <span>·</span>
                    <span className="text-white font-medium flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-amber-300 shrink-0" />
                      {peladaConfig.venueName}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                      Sem pelada hoje
                    </span>
                    <span>·</span>
                    <span className="text-white font-medium">
                      Próxima: {formattedMatchDate} às {peladaConfig.time}h
                    </span>
                  </>
                )}
              </div>
            </>
          )}

          {/* Painel de Métricas: SE HOJE FOR O DIA DA PELADA -> CONTAGEM EM HORAS */}
          {isPeladaToday ? (
            todayHourlyCountdown?.isUnderway ? (
              <div className="mt-2.5 rounded-xl bg-amber-400/20 border border-amber-300/40 p-2.5 text-center">
                <div className="text-sm font-black text-amber-300 animate-pulse font-mono uppercase">
                  ⚽ BOLA ROLANDO! PELADA EM ANDAMENTO
                </div>
                <div className="text-[10px] text-amber-200 font-sans mt-0.5">
                  Horário marcado: {peladaConfig.time}h · {peladaConfig.venueName}
                </div>
              </div>
            ) : (
              <div className="mt-2.5 grid grid-cols-3 gap-1.5 rounded-xl bg-white/10 border border-white/15 p-2 text-center font-mono">
                <div>
                  <div className="text-[9px] text-blue-200 uppercase tracking-wider font-sans">
                    Horas Restantes
                  </div>
                  <div className="text-sm font-black text-white mt-0.5">
                    {String(todayHourlyCountdown?.hours ?? 0).padStart(2, '0')}{' '}
                    <span className="text-[10px] font-bold text-blue-200">horas</span>
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-blue-200 uppercase tracking-wider font-sans">
                    Minutos
                  </div>
                  <div className="text-sm font-black text-white mt-0.5">
                    {String(todayHourlyCountdown?.minutes ?? 0).padStart(2, '0')}m
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-blue-200 uppercase tracking-wider font-sans">
                    Segundos
                  </div>
                  <div className="text-sm font-black text-amber-300 mt-0.5">
                    {String(todayHourlyCountdown?.seconds ?? 0).padStart(2, '0')}s
                  </div>
                </div>
              </div>
            )
          ) : (
            /* SE NÃO FOR O DIA DA PELADA -> Exibe detalhes da próxima pelada */
            <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-xl bg-white/10 border border-white/15 p-2 text-center font-mono">
              <div>
                <div className="text-[9px] text-blue-200 uppercase tracking-wider font-sans">
                  Próxima Pelada
                </div>
                <div className="text-sm font-black text-white mt-0.5">
                  {countdown.days > 0 ? (countdown.days === 1 ? '1 dia' : `${countdown.days} dias`) : 'Em breve'}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-blue-200 uppercase tracking-wider font-sans">
                  Horário
                </div>
                <div className="text-sm font-black text-white mt-0.5">
                  {peladaConfig.time}h
                </div>
              </div>
            </div>
          )}

          {/* Feedback temporário de presença */}
          {presenceFeedback && (
            <div className="mt-2 rounded-lg bg-emerald-500/20 border border-emerald-400/40 px-3 py-1.5 text-center text-[11px] font-bold text-emerald-200 animate-fadeIn">
              {presenceFeedback}
            </div>
          )}

          {/* Espaço Reservado com Design para Confirmados e Confirmação de Presença */}
          <div className="mt-2.5 rounded-xl bg-white/10 border border-white/15 p-2.5 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-white">
                <Users className="h-3.5 w-3.5 text-blue-200" />
                <span>Confirmados na Pelada</span>
              </div>
              <span className="rounded-full bg-white/20 border border-white/30 px-2 py-0.5 text-[10px] font-mono font-black text-white">
                👥 {confirmedCount} Confirmados
              </span>
            </div>

            {/* Botão Interativo: Para atletas confirma presença; Para admin abre a súmula */}
            {isAdmin ? (
              <button
                type="button"
                onClick={() => onNavigate('matches')}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-black bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition-all active:scale-[0.98] cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4 text-purple-200" />
                <span>Gerenciar Súmula da Partida (Admin)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleToggleMyPresence}
                className={`mt-2 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-black transition-all active:scale-[0.98] shadow-sm cursor-pointer ${
                  isMyPresenceConfirmed
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-950/40 ring-1 ring-emerald-300'
                    : 'bg-white/15 hover:bg-white/25 text-white border border-white/25 hover:border-white/40'
                }`}
              >
                {isMyPresenceConfirmed ? (
                  <>
                    <Check className="h-4 w-4 stroke-[3] text-white" />
                    <span>Presença confirmada!</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-blue-200" />
                    <span>Clique aqui para confirmar presença</span>
                  </>
                )}
              </button>
            )}

            {/* Atalho Rápido para Mensalidades da Pelada */}
            <button
              type="button"
              onClick={() => onNavigate('squad')}
              className="mt-2 w-full flex items-center justify-between py-1.5 px-3 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition active:scale-[0.98]"
            >
              <div className="flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-emerald-400" />
                <span>Mensalidades da Pelada</span>
              </div>
              <span className="text-emerald-300 font-mono text-[10px]">
                Acessar no Elenco ›
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal para Ajustar Data e Horário da Pelada */}
      {showEditScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 font-bold">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                    Ajustar Dia da Pelada
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Defina o dia e horário para a contagem regressiva
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowEditScheduleModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-3.5">
              {/* Atalhos Rápidos */}
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Atalhos Rápidos:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSetPresetDate('sabado')}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition"
                  >
                    Próximo Sábado
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPresetDate('quarta')}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800 hover:bg-blue-100 transition"
                  >
                    Próxima Quarta
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPresetDate('hoje')}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition"
                  >
                    Hoje!
                  </button>
                </div>
              </div>

              {/* Data da Pelada */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Data da Próxima Pelada *
                </label>
                <input
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-extrabold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Horário de Início */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Horário de Início *
                </label>
                <input
                  type="time"
                  required
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-extrabold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Local / Arena */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Local / Arena da Pelada
                </label>
                <input
                  type="text"
                  value={editVenue}
                  onChange={(e) => setEditVenue(e.target.value)}
                  placeholder="Ex.: Arena Society Planalto - BA"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditScheduleModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-98 transition"
                >
                  Salvar Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Compartilhamento do Cartão em Imagem 9:16 */}
      <ShareCardModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        cardData={{
          displayName: activeProfile.displayName,
          position: activeProfile.position,
          dominantFoot: activeProfile.dominantFoot,
          avatarUrl: activeProfile.avatarUrl,
          teamName: userTeamName,
          teamCrestUrl: userTeamCrest,
          cityName: `${activeCity.name}/${activeCity.stateCode}`,
          overallStars: overallStars,
          skills: activeProfile.skills,
          goals: myGoals,
          goalsAvg: myGoalsAvg,
          matchesPlayed: myPresences,
          superCapas:
            activeProfile.position === 'goleiro'
              ? myGoalkeeperCapas
              : mySuperCapas,
          capaLabel:
            activeProfile.position === 'goleiro'
              ? 'Capas GK'
              : 'Super Capas',
          capaPct: myCapaPct,
          yellowCards: myYellowCards,
          blueCards: myBlueCards,
          redCards: myRedCards,
        }}
      />

      {/* Modal de Avaliação de Estrelas (quando clicado) */}
      {showRatingModal && (
        <PlayerRatingModal
          player={activeProfile}
          isOpen={showRatingModal}
          onClose={() => setShowRatingModal(false)}
          readOnly={activeProfile.userId === currentUser.id}
          readOnlyMessage="Você está visualizando seu próprio cartão. Não é permitido avaliar a si mesmo."
          onSave={(playerId, newSkills) => {
            updatePlayerSkills(playerId, newSkills);
            setShowRatingModal(false);
          }}
        />
      )}

      {/* Modal de Compartilhamento da Foto dos Super Capas da Semana */}
      {superCapasInfo && (
        <ShareSuperCapasModal
          isOpen={showSuperCapasShareModal}
          onClose={() => setShowSuperCapasShareModal(false)}
          data={{
            teamName: superCapasInfo.teamName,
            matchDate: superCapasInfo.matchDate,
            teamPhotoUrl: superCapasInfo.photoUrl || superCapasPhoto || DEFAULT_SUPER_CAPAS_PHOTO,
            wins: superCapasInfo.wins,
            draws: superCapasInfo.draws,
            totalGoals: superCapasInfo.totalGoals,
            venueName: 'Arena Society Planalto - BA',
            players: superCapasInfo.players,
          }}
        />
      )}
    </div>
  );
};
