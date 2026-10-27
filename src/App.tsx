import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  LayoutDashboard,
  LogOut,
  QrCode,
  Search,
  Smartphone,
  Swords,
  Trophy,
  UserCircle2,
  Users,
  X,
} from 'lucide-react';
import { LeagueProvider, useLeague } from './lib/store/LeagueContext';
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

type ActiveTab =
  | 'dashboard'
  | 'matches'
  | 'search'
  | 'squad'
  | 'ranking'
  | 'admin';

const MainMobileShell: React.FC = () => {
  const {
    users,
    profiles,
    matches,
    currentUser,
    notification,
    clearNotification,
    switchActiveUser,
  } = useLeague();

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem('futplay_lite_auth_session_v1') === 'true';
    } catch {
      return false;
    }
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
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
  const [matchIdToOpen, setMatchIdToOpen] = useState<string | undefined>(
    undefined
  );
  const [playerIdToOpen, setPlayerIdToOpen] = useState<string | undefined>(
    undefined
  );

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
    setMatchIdToOpen(matchId);
    setPlayerIdToOpen(playerId);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 1. TELA INICIAL: LOGIN (E-mail e Senha, Google ou Criar Conta)
  if (!isAuthenticated) {
    return (
      <AuthLoginView
        onAuthenticated={() => {
          try {
            localStorage.setItem('futplay_lite_auth_session_v1', 'true');
          } catch {
            // Ignore
          }
          setIsAuthenticated(true);
          setActiveTab('dashboard');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  // 2. TELA DE PRIMEIRO ACESSO: BOAS-VINDAS + CADASTRO DE WHATSAPP PARA NOTIFICAÇÕES
  // Exibe APENAS no primeiro acesso da conta (nunca se repete após concluir a confirmação)
  if (!currentUser.onboardingCompleted && !currentUser.whatsappNumber) {
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
    'Real Planalto FC';
  const userTeamCrest =
    currentUser.teamCrestUrl || currentPlayerProfile?.teamCrestUrl;
  const userDisplayName =
    currentPlayerProfile?.displayName || currentUser.email.split('@')[0];
  const userAvatarUrl =
    currentPlayerProfile?.avatarUrl || currentUser.avatarUrl;
  const isCoach = currentUser.role === 'coach' || currentUser.isTeamOwner;
  const isAdmin = currentUser.role === 'admin';

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
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-2.5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            {/* Canto Esquerdo: apenas o nome do app */}
            <div className="flex items-center justify-start min-w-0">
              <button
                onClick={() => handleNavigate('dashboard')}
                className="font-display text-base font-black tracking-wider text-blue-900 uppercase hover:text-blue-700 transition truncate"
                title="FUTPLAY LITE - Início"
              >
                FUTPLAY LITE
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

              {/* Menu Suspenso do Perfil */}
              {showProfileMenu && (
                <div
                  ref={profileMenuRef}
                  className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl transition-all"
                >
                    {/* Cabeçalho do Perfil */}
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                      {userAvatarUrl ? (
                        <img
                          src={userAvatarUrl}
                          alt={userDisplayName}
                          className="h-12 w-12 rounded-full object-cover border-2 border-blue-600 shrink-0"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm shrink-0">
                          {userDisplayName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-slate-900 truncate">
                            {userDisplayName}
                          </span>
                          <span
                            className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                              isCoach
                                ? 'bg-amber-100 text-amber-800'
                                : isAdmin
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {isCoach ? 'Treinador' : isAdmin ? 'Admin' : 'Jogador'}
                          </span>
                        </div>
                        <span className="block text-xs text-slate-500 truncate mt-0.5">
                          {userTeamName}
                        </span>
                      </div>
                    </div>

                    {/* Ações Rápidas */}
                    <div className="py-2 space-y-1">
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          if (currentPlayerProfile) {
                            handleNavigate('squad', undefined, currentPlayerProfile.id);
                          } else {
                            handleNavigate('squad');
                          }
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition text-left"
                      >
                        <UserCircle2 className="h-4 w-4 text-blue-600" />
                        <span>Ver Meu Perfil e Card</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          setShowQrModal(true);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition text-left"
                      >
                        <QrCode className="h-4 w-4 text-blue-600" />
                        <span>Compartilhar Link / QR Code</span>
                      </button>
                    </div>

                    {/* Alternar Usuário */}
                    <div className="border-t border-slate-100 pt-2.5 pb-1">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 px-1">
                        Alternar Usuário
                      </span>
                      <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
                        <select
                          aria-label="Alternar conta"
                          value={currentUser.id}
                          onChange={(e) => {
                            switchActiveUser(e.target.value);
                            setShowProfileMenu(false);
                          }}
                          className="w-full bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                        >
                          {users.map((u) => {
                            const prof = profiles.find((p) => p.userId === u.id);
                            const uCoach = u.role === 'coach' || u.isTeamOwner;
                            const uAdmin = u.role === 'admin';
                            const roleTag = uCoach
                              ? ' (Treinador)'
                              : uAdmin
                                ? ' (Admin)'
                                : '';
                            return (
                              <option key={u.id} value={u.id}>
                                {(prof ? prof.displayName : 'Moderador') + roleTag}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    {/* Botão Sair */}
                    <div className="border-t border-slate-100 pt-2 mt-2">
                      <button
                        onClick={() => {
                          try {
                            localStorage.removeItem('futplay_lite_auth_session_v1');
                          } catch {
                            // Ignore
                          }
                          clearNotification();
                          setIsAuthenticated(false);
                          setShowProfileMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition text-left"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sair da Conta</span>
                      </button>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </header>

        {/* Modal de QR Code para Compartilhar */}
        {showQrModal && (
          <div className="mx-4 mt-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-lg space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                <Smartphone className="h-4 w-4" />
                Link de Acesso no Celular
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col items-center text-center space-y-2.5">
              <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(publicUrl)}`}
                  alt="QR Code"
                  className="h-40 w-40"
                />
              </div>
              <div className="w-full space-y-1.5 text-xs">
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-2.5">
                  <span className="text-[10px] text-blue-600 font-semibold uppercase block">
                    Link Direto (4G, 5G ou Wi-Fi):
                  </span>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs font-bold text-blue-700 underline break-all"
                  >
                    {publicUrl}
                  </a>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-2 text-[11px] text-slate-600">
                  Wi-Fi Local: <strong className="font-mono">{lanUrl}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast de Notificação */}
        {notification && (
          <div className="px-4 pt-3">
            <div
              className={`flex items-start justify-between gap-2.5 rounded-2xl border p-3 shadow-sm text-xs ${
                notification.type === 'success'
                  ? 'border-blue-200 bg-blue-50 text-blue-950'
                  : notification.type === 'error'
                    ? 'border-red-200 bg-red-50 text-red-900'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">
                <strong className="font-bold block">
                  {notification.title}
                </strong>
                <span className="text-[11px] opacity-85">
                  {notification.message}
                </span>
              </div>
              <button
                onClick={clearNotification}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Conteúdo Principal */}
        <main className="flex-1 px-4 pt-4 pb-24 space-y-4">
          {activeTab === 'dashboard' && (
            <DashboardView onNavigate={handleNavigate} />
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
        </main>

        {/* Menu Inferior com exatamente: Início, Partidas, Buscar, Elenco e Ranking */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[430px] border-t border-slate-200 bg-white/95 backdrop-blur-md px-2 py-2">
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
                  badge: pendingMatchesCount,
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
                  onClick={() => handleNavigate(item.id)}
                  className={`relative flex flex-col items-center justify-center rounded-xl py-1.5 transition ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-blue-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="mt-0.5 text-[10px] font-semibold">
                    {item.label}
                  </span>
                  {'badge' in item && item.badge && item.badge > 0 ? (
                    <span
                      className={`absolute top-1 right-2.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                        isActive
                          ? 'bg-white text-blue-700'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
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
