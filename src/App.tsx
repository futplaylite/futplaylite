import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Pause,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Swords,
  Trophy,
  UserCircle2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { LeagueProvider, useLeague, NotificationBanner } from './lib/store/LeagueContext';
import { TeamCrestBadge } from './components/TeamCrestBadge';
import { AuthLoginView } from './components/AuthLoginView';
import { WhatsappOnboardingView } from './components/WhatsappOnboardingView';
import { AthleteOnboardingWizard } from './components/AthleteOnboardingWizard';
import { DashboardView } from './components/DashboardView';
import { LeagueRankingView } from './components/LeagueRankingView';
import { MatchesAndValidationView } from './components/MatchesAndValidationView';
import { SearchView } from './components/SearchView';
import { SquadView } from './components/SquadView';
import { AdminAndHomologationView } from './components/AdminAndHomologationView';
import { MonthlyFeesView } from './components/MonthlyFeesView';
import { PWAInstallBanner } from './components/PWAInstallBanner';

type ActiveTab =
  | 'dashboard'
  | 'matches'
  | 'search'
  | 'squad'
  | 'ranking'
  | 'admin';

const formatStopwatchTime = (totalSecs: number) => {
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const MainMobileShell: React.FC = () => {
  const {
    profiles,
    matches,
    currentUser,
    notification,
    clearNotification,
    sumulaStopwatch,
  } = useLeague();

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return (
        localStorage.getItem('futplay_lite_auth_session_v3') === 'true' &&
        Boolean(currentUser.id)
      );
    } catch {
      return false;
    }
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    try {
      const saved = sessionStorage.getItem('futplay_nav_active_tab_v1') as ActiveTab | null;
      if (
        saved === 'dashboard' ||
        saved === 'matches' ||
        saved === 'search' ||
        saved === 'squad' ||
        saved === 'ranking' ||
        saved === 'admin'
      ) {
        return saved;
      }
    } catch {
      // Ignore
    }
    return 'dashboard';
  });
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const [showMonthlyFeesPage, setShowMonthlyFeesPage] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('futplay_nav_show_finance_v1') === 'true';
    } catch {
      return false;
    }
  });
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  // Fecha o menu de opções do perfil ao clicar em qualquer lugar da tela
  useEffect(() => {
    if (!showProfileMenu) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(target) &&
        profileButtonRef.current &&
        !profileButtonRef.current.contains(target)
      ) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [showProfileMenu]);
  const [publicUrl, setPublicUrl] = useState<string>(
    'https://concert-mask-never-seniors.trycloudflare.com'
  );
  const [lanUrl, setLanUrl] = useState<string>('http://192.168.0.102:3000');
  const [matchIdToOpen, setMatchIdToOpen] = useState<string | undefined>(() => {
    try {
      return sessionStorage.getItem('futplay_nav_match_id_v1') || undefined;
    } catch {
      return undefined;
    }
  });
  const [playerIdToOpen, setPlayerIdToOpen] = useState<string | undefined>(() => {
    try {
      return sessionStorage.getItem('futplay_nav_player_id_v1') || undefined;
    } catch {
      return undefined;
    }
  });

  // Persiste a página/aba atual por guia para não voltar ao início ao atualizar a página (F5)
  useEffect(() => {
    try {
      sessionStorage.setItem('futplay_nav_active_tab_v1', activeTab);
    } catch {}
  }, [activeTab]);

  useEffect(() => {
    try {
      sessionStorage.setItem('futplay_nav_show_finance_v1', String(showMonthlyFeesPage));
    } catch {}
  }, [showMonthlyFeesPage]);

  useEffect(() => {
    try {
      if (matchIdToOpen) sessionStorage.setItem('futplay_nav_match_id_v1', matchIdToOpen);
      else sessionStorage.removeItem('futplay_nav_match_id_v1');
    } catch {}
  }, [matchIdToOpen]);

  useEffect(() => {
    try {
      if (playerIdToOpen) sessionStorage.setItem('futplay_nav_player_id_v1', playerIdToOpen);
      else sessionStorage.removeItem('futplay_nav_player_id_v1');
    } catch {}
  }, [playerIdToOpen]);

  // Se uma conta não-admin restaurar 'admin', retorna com segurança para 'dashboard'
  useEffect(() => {
    if (currentUser.id && activeTab === 'admin' && currentUser.role !== 'admin') {
      setActiveTab('dashboard');
    }
  }, [currentUser.id, currentUser.role, activeTab]);

  // Notificação temporária no cabeçalho (substitui o nome do app por 2 segundos com Fade in / Fade out)
  const [activeHeaderNotice, setActiveHeaderNotice] =
    useState<NotificationBanner | null>(null);
  const [isFading, setIsFading] = useState<boolean>(false);

  useEffect(() => {
    if (!notification) {
      setActiveHeaderNotice(null);
      setIsFading(false);
      return;
    }

    setActiveHeaderNotice(notification);
    setIsFading(false);

    // Inicia o fade out suave exatamente aos 2000ms (2 segundos)
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 2000);

    // Conclui o fade out e restaura o nome do app aos 2350ms
    const clearTimer = setTimeout(() => {
      clearNotification();
      setActiveHeaderNotice(null);
      setIsFading(false);
    }, 2350);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(clearTimer);
    };
  }, [notification, clearNotification]);

  useEffect(() => {
    let mounted = true;
    const fetchTunnelInfo = async () => {
      try {
        const res = await fetch('/api/mobile-url');
        if (res.ok) {
          const data = await res.json();
          if (mounted && data.publicUrl) setPublicUrl(data.publicUrl);
          if (mounted && data.lanUrl) setLanUrl(data.lanUrl);
        }
      } catch {
        // Static fallback
      }
    };
    fetchTunnelInfo();
    const timer = setInterval(fetchTunnelInfo, 5000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const handleNavigate = (
    tab: ActiveTab,
    matchId?: string,
    playerId?: string
  ) => {
    try {
      if (!playerId) {
        sessionStorage.removeItem('futplay_squad_inspecting_id_v1');
      }
      if (tab !== 'matches' || (!matchId && activeTab !== 'matches')) {
        sessionStorage.removeItem('futplay_matches_sumula_view_v1');
        sessionStorage.removeItem('futplay_matches_sumula_id_v1');
      }
    } catch {}
    setShowMonthlyFeesPage(false);
    setMatchIdToOpen(matchId);
    setPlayerIdToOpen(playerId);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 1. TELA INICIAL: LOGIN OU CRIAR CONTA (Exibida para qualquer novo visitante)
  if (!isAuthenticated || !currentUser.id) {
    return (
      <AuthLoginView
        onAuthenticated={() => {
          try {
            localStorage.setItem('futplay_lite_auth_session_v3', 'true');
          } catch {
            // Ignore
          }
          setIsAuthenticated(true);
          setShowMonthlyFeesPage(false);
          setActiveTab('dashboard');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  // Contas de Administrador da Liga nunca passam pelos passos de integração de atletas
  const isAdmin = currentUser.role === 'admin';

  // 2. TELA DE PRIMEIRO ACESSO: BOAS-VINDAS + CADASTRO DE WHATSAPP PARA NOTIFICAÇÕES
  // Exibe APENAS no primeiro acesso da conta de atleta (nunca para administradores)
  if (!isAdmin && !currentUser.onboardingCompleted && !currentUser.whatsappNumber) {
    return (
      <WhatsappOnboardingView
        onComplete={() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  // 3. PASSOS DE PRIMEIRO ACESSO APÓS SALVAR O WHATSAPP (Passos 1, 2 e 3)
  // Ao confirmar a entrada no time ou concluir os convites, encerra os passos definitivamente e nunca se repete
  if (
    !isAdmin &&
    !currentUser.onboardingCompleted &&
    (currentUser.onboardingStep || 1) < 4
  ) {
    return (
      <AthleteOnboardingWizard
        onCompleteWizard={() => {
          setActiveTab('dashboard');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  const pendingMatchesCount = matches.filter(
    (m) =>
      m.status === 'aguardando_confirmacoes' || m.status === 'contestada'
  ).length;

  const currentPlayerProfile = profiles.find((p) => p.userId === currentUser.id);
  const userTeamName =
    currentUser.teamName ||
    currentPlayerProfile?.teamName ||
    'Meu Time';
  const userTeamCrest =
    currentUser.teamCrestUrl || currentPlayerProfile?.teamCrestUrl;
  const userDisplayName =
    currentPlayerProfile?.displayName || currentUser.email.split('@')[0];
  const userAvatarUrl =
    currentPlayerProfile?.avatarUrl || currentUser.avatarUrl;
  const isCoach = currentUser.role === 'coach' || currentUser.isTeamOwner;
  const isTeamCreator =
    currentUser?.isTeamOwner ||
    currentUser?.role === 'coach' ||
    currentPlayerProfile?.isTeamOwner ||
    currentUser?.id === 'user-paredao';

  return (
    <div className="min-h-dvh w-full bg-slate-50 text-slate-900 relative">
      {/* Backdrop global para fechar o menu ao clicar em qualquer lugar da tela */}
      {showProfileMenu && (
        <div
          className="fixed inset-0 z-40 bg-black/25 transition-opacity"
          onClick={() => setShowProfileMenu(false)}
          onTouchStart={() => setShowProfileMenu(false)}
          aria-hidden="true"
        />
      )}

      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-slate-50">
        {/* Cabeçalho Principal do App */}
        <header
          className={`sticky top-0 z-50 transition-colors duration-200 ${
            sumulaStopwatch.isActive
              ? 'border-b border-slate-800 bg-slate-900 text-white px-3 py-2.5 sm:py-3 shadow-lg'
              : 'border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-2.5'
          }`}
        >
          {sumulaStopwatch.isActive ? (
            /* Modo Cronômetro da Súmula Ativa (Barra Ampliada e Mais Legível) */
            <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 min-h-[48px] sm:min-h-[54px]">
              {/* Esquerda: Indicador e Título */}
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <span
                  className={`inline-block h-3 w-3 rounded-full shrink-0 ${
                    sumulaStopwatch.isRunning
                      ? 'bg-emerald-400 animate-pulse ring-4 ring-emerald-500/25'
                      : sumulaStopwatch.seconds > 0
                      ? 'bg-amber-400 ring-4 ring-amber-500/25'
                      : 'bg-slate-500'
                  }`}
                />
                <div className="min-w-0 flex flex-col justify-center leading-tight">
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-blue-300 truncate">
                    {sumulaStopwatch.title || 'Tempo de Jogo'}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    {sumulaStopwatch.isRunning
                      ? '● Ao Vivo'
                      : sumulaStopwatch.seconds > 0
                      ? '⏸ Pausado'
                      : '⏹ Zerado'}
                  </span>
                </div>
              </div>

              {/* Centro: Display Digital do Cronômetro Ampliado */}
              <div className="flex items-center shrink-0 bg-slate-950 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-slate-800 shadow-inner">
                <span className="font-mono text-2xl sm:text-3xl font-black text-emerald-400 tracking-wider drop-shadow-[0_0_10px_rgba(52,211,153,0.45)] leading-none">
                  {formatStopwatchTime(sumulaStopwatch.seconds)}
                </span>
              </div>

              {/* Direita: Botões Play/Pausa e Zerar Ampliados */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={sumulaStopwatch.toggle}
                  className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-black shadow-sm transition active:scale-95 ${
                    sumulaStopwatch.isRunning
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                  title={sumulaStopwatch.isRunning ? 'Pausar Cronômetro' : 'Iniciar Cronômetro'}
                >
                  {sumulaStopwatch.isRunning ? (
                    <>
                      <Pause className="h-3.5 w-3.5 fill-current" />
                      <span>Pausar</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Iniciar</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={sumulaStopwatch.reset}
                  className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95 transition"
                  title="Zerar Cronômetro (00:00)"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                  <span>Zerar</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            {/* Canto Esquerdo: Nome do app OU Notificação temporária com Fade In / Fade Out */}
            <div className="relative flex items-center justify-start min-w-0 h-9">
              {/* Notificação Temporária (visível por 2s e desaparece com fade out suave) */}
              <div
                className={`absolute inset-0 flex items-center gap-1.5 min-w-0 transition-all duration-300 ${
                  activeHeaderNotice && !isFading
                    ? 'opacity-100 translate-y-0 pointer-events-auto z-10'
                    : 'opacity-0 -translate-y-1 pointer-events-none z-0'
                }`}
                title={
                  activeHeaderNotice
                    ? `${activeHeaderNotice.title}: ${activeHeaderNotice.message}`
                    : ''
                }
              >
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 animate-pulse ${
                    activeHeaderNotice?.type === 'error'
                      ? 'bg-red-500 ring-2 ring-red-200'
                      : activeHeaderNotice?.type === 'warning'
                        ? 'bg-amber-500 ring-2 ring-amber-200'
                        : 'bg-emerald-500 ring-2 ring-emerald-200'
                  }`}
                />
                <div className="min-w-0 flex flex-col justify-center leading-none">
                  <span className="text-[11px] font-black tracking-tight text-blue-950 uppercase truncate">
                    {activeHeaderNotice?.title}
                  </span>
                  {activeHeaderNotice?.message && (
                    <span className="text-[9px] font-semibold text-slate-500 truncate mt-0.5">
                      {activeHeaderNotice.message}
                    </span>
                  )}
                </div>
              </div>

              {/* Nome Padrão do App (FUTPLAY LITE) com transição Fade In / Fade Out */}
              <button
                onClick={() => handleNavigate('dashboard')}
                className={`flex items-center gap-1.5 font-display text-base font-black tracking-wider text-blue-900 uppercase hover:text-blue-700 transition-all duration-300 truncate ${
                  activeHeaderNotice && !isFading
                    ? 'opacity-0 translate-y-1 pointer-events-none'
                    : 'opacity-100 translate-y-0 pointer-events-auto'
                }`}
                title="FUTPLAY LITE - Início"
              >
                <img
                  src="/favicon.png"
                  alt="FutPlay Lite"
                  className="h-5 w-5 rounded-md object-contain shrink-0 drop-shadow-xs"
                />
                <span className="truncate">FUTPLAY LITE</span>
              </button>
            </div>

            {/* Centro: brasão do seu time */}
            <div className="flex items-center justify-center">
              <button
                onClick={() => handleNavigate('squad')}
                className="flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                title={`Time: ${userTeamName}`}
                aria-label={`Ver time ${userTeamName}`}
              >
                <TeamCrestBadge
                  name={userTeamName}
                  crestUrl={userTeamCrest}
                  size={38}
                />
              </button>
            </div>

            {/* Canto Direito: seu perfil com sua foto */}
            <div className="relative flex items-center justify-end">
              <button
                ref={profileButtonRef}
                onClick={() => setShowProfileMenu((v) => !v)}
                className="relative flex items-center justify-center rounded-full p-0.5 hover:ring-2 hover:ring-blue-500 transition focus:outline-none"
                title={`Meu perfil: ${userDisplayName}`}
                aria-label="Abrir menu do perfil"
              >
                {userAvatarUrl ? (
                  <img
                    src={userAvatarUrl}
                    alt={userDisplayName}
                    className="h-9 w-9 rounded-full object-cover border-2 border-blue-600 shadow-xs"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs shadow-xs border-2 border-white">
                    {userDisplayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </button>

              {/* Menu Suspenso do Perfil (Calibrado para Celular) */}
              {showProfileMenu && (
                <div
                  ref={profileMenuRef}
                  className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl transition-all text-slate-800"
                >
                  {/* Cabeçalho do Perfil Compacto */}
                  <div className="flex items-center gap-2.5 border-b border-slate-100 pb-2">
                    {userAvatarUrl ? (
                      <img
                        src={userAvatarUrl}
                        alt={userDisplayName}
                        className="h-9 w-9 rounded-full object-cover border border-blue-600 shrink-0"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs shrink-0">
                        {userDisplayName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {userDisplayName}
                        </span>
                        <span
                          className={`inline-block rounded px-1 py-0.2 text-[9px] font-bold ${
                            isCoach
                              ? 'bg-amber-100 text-amber-800'
                              : isAdmin
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {isCoach ? 'Técnico' : isAdmin ? 'Admin' : 'Jogador'}
                        </span>
                      </div>
                      <span className="block text-[10px] text-slate-500 truncate">
                        {userTeamName}
                      </span>
                    </div>
                  </div>

                  {/* Ações Rápidas Reorganizadas */}
                  <div className="py-1.5 space-y-0.5">
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          handleNavigate('admin');
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 transition text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-purple-600" />
                          <span>Painel do Administrador</span>
                        </div>
                        <span className="font-mono text-[9px] font-black text-purple-700 bg-purple-200/80 px-1.5 py-0.2 rounded-full">
                          ADMIN
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          if (currentPlayerProfile) {
                            handleNavigate('squad', undefined, currentPlayerProfile.id);
                          } else {
                            handleNavigate('squad');
                          }
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition text-left cursor-pointer"
                      >
                        <UserCircle2 className="h-3.5 w-3.5 text-blue-600" />
                        <span>Meu Perfil & Card</span>
                      </button>
                    )}

                    {!isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          setShowMonthlyFeesPage(true);
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Financeiro</span>
                        </div>
                        <span className="font-mono text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                          Caixa & Extrato
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Ações da Conta: Sair */}
                  <div className="border-t border-slate-100 pt-1 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          localStorage.removeItem('futplay_lite_auth_session_v1');
                          localStorage.removeItem('futplay_lite_auth_session_v2');
                          localStorage.removeItem('futplay_lite_auth_session_v3');
                          localStorage.removeItem('futplay_lite_active_user_id_v3');
                          sessionStorage.removeItem('futplay_nav_active_tab_v1');
                          sessionStorage.removeItem('futplay_nav_show_finance_v1');
                          sessionStorage.removeItem('futplay_nav_match_id_v1');
                          sessionStorage.removeItem('futplay_nav_player_id_v1');
                          sessionStorage.removeItem('futplay_finance_subtab_v1');
                          sessionStorage.removeItem('futplay_matches_sumula_view_v1');
                          sessionStorage.removeItem('futplay_matches_sumula_id_v1');
                        } catch {
                          // Ignore
                        }
                        clearNotification();
                        setShowMonthlyFeesPage(false);
                        setActiveTab('dashboard');
                        setIsAuthenticated(false);
                        setShowProfileMenu(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition text-left cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5 text-slate-500" />
                      <span>Sair da Conta</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </header>

        {/* Banner de Instalação PWA */}
        <PWAInstallBanner />

        {/* Conteúdo Principal */}
        <main className="flex-1 px-4 pt-4 pb-24 space-y-4">
          {showMonthlyFeesPage ? (
            <MonthlyFeesView onBack={() => setShowMonthlyFeesPage(false)} />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  onNavigate={handleNavigate}
                  onOpenMonthlyFees={() => setShowMonthlyFeesPage(true)}
                  onOpenFinancial={() => setShowMonthlyFeesPage(true)}
                />
              )}
              {activeTab === 'matches' && (
                <MatchesAndValidationView
                  initialMatchId={matchIdToOpen}
                  onNavigateToAdmin={(mid) => handleNavigate('admin', mid)}
                />
              )}
              {activeTab === 'search' && (
                <SearchView
                  onSelectPlayer={(pid) => handleNavigate('squad', undefined, pid)}
                  onSelectMatch={(mid) => handleNavigate('matches', mid)}
                />
              )}
              {activeTab === 'squad' && (
                <SquadView
                  key={playerIdToOpen || 'elenco-list'}
                  initialPlayerId={playerIdToOpen}
                />
              )}
              {activeTab === 'ranking' && (
                <LeagueRankingView
                  onInspectPlayer={(pid) =>
                    handleNavigate('squad', undefined, pid)
                  }
                />
              )}
              {activeTab === 'admin' && (
                <AdminAndHomologationView initialMatchId={matchIdToOpen} />
              )}
            </>
          )}
        </main>

        {/* Menu Inferior Fixo e Padrão (Sem transparência, sem mexer, sem contador) */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[430px] bg-white border-t border-slate-200 px-2 py-1.5 shadow-lg">
          <div className="grid grid-cols-5 gap-1">
            {(
              [
                {
                  id: 'dashboard',
                  label: 'Início',
                  icon: LayoutDashboard,
                },
                {
                  id: 'matches',
                  label: 'Partidas',
                  icon: Swords,
                },
                {
                  id: 'search',
                  label: 'Buscar',
                  icon: Search,
                },
                {
                  id: 'squad',
                  label: 'Elenco',
                  icon: Users,
                },
                {
                  id: 'ranking',
                  label: 'Ranking',
                  icon: Trophy,
                },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`flex h-12 w-full flex-col items-center justify-center rounded-xl py-1 px-1 transition-colors duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'text-slate-500 hover:text-blue-600 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="mt-1 text-[10px] leading-tight truncate">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};

export function App() {
  return (
    <LeagueProvider>
      <MainMobileShell />
    </LeagueProvider>
  );
}

export default App;
