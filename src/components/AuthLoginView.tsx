import React, { useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { RosaliaCrest } from './RosaliaCrest';
import { DominantFoot, PlayerPosition } from '../types/league';

interface AuthLoginViewProps {
  onAuthenticated: () => void;
}

export const AuthLoginView: React.FC<AuthLoginViewProps> = ({
  onAuthenticated,
}) => {
  const {
    users,
    selectedCityId,
    switchActiveUser,
    registerNewAthlete,
    notify,
  } = useLeague();

  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login states
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');

  // Google Modal state
  const [showGoogleModal, setShowGoogleModal] = useState<boolean>(false);
  const [customGoogleName, setCustomGoogleName] = useState<string>('');
  const [customGoogleEmail, setCustomGoogleEmail] = useState<string>('');

  // Register states
  const [regName, setRegName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regNeighborhood, setRegNeighborhood] = useState<string>('Centro');
  const [regPosition, setRegPosition] = useState<PlayerPosition>('atacante');
  const [regFoot, setRegFoot] = useState<DominantFoot>('direito');

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const normalizedEmail = loginEmail.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setLoginError('Informe um endereço de e-mail válido.');
      return;
    }
    if (loginPassword.trim().length < 4) {
      setLoginError('Informe sua senha (mínimo 4 caracteres).');
      return;
    }

    // Procura usuário cadastrado pelo e-mail
    const existingUser = users.find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );

    if (existingUser) {
      switchActiveUser(existingUser.id);
      onAuthenticated();
      return;
    }

    setLoginError(
      'E-mail ainda não cadastrado. Toque na aba "Criar Conta" acima para se cadastrar em segundos!'
    );
    setRegEmail(normalizedEmail);
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const trimmedName = regName.trim();
    const trimmedEmail = regEmail.trim().toLowerCase();

    if (trimmedName.length < 2) {
      setLoginError('Informe seu nome ou apelido esportivo (mín. 2 letras).');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setLoginError('Informe um e-mail válido para criar sua conta.');
      return;
    }
    if (regPassword.trim().length < 4) {
      setLoginError('Crie uma senha com pelo menos 4 caracteres.');
      return;
    }

    // Verifica se o e-mail já existe
    const existing = users.find(
      (u) => u.email.toLowerCase() === trimmedEmail
    );
    if (existing) {
      switchActiveUser(existing.id);
      notify(
        'info',
        'Conta já existente!',
        'Identificamos seu e-mail e conectamos você diretamente à sua conta.'
      );
      onAuthenticated();
      return;
    }

    const created = registerNewAthlete({
      displayName: trimmedName,
      email: trimmedEmail,
      cityId: selectedCityId,
      neighborhood: regNeighborhood.trim() || 'Centro',
      position: regPosition,
      dominantFoot: regFoot,
      profileVisibility: 'publico',
    });

    if (created) {
      onAuthenticated();
    }
  };

  const handleGoogleAccountSelect = (name: string, email: string) => {
    const normalized = email.trim().toLowerCase();
    const existing = users.find((u) => u.email.toLowerCase() === normalized);

    if (existing) {
      switchActiveUser(existing.id);
      setShowGoogleModal(false);
      onAuthenticated();
      return;
    }

    const created = registerNewAthlete({
      displayName: name.trim(),
      email: normalized,
      cityId: selectedCityId,
      neighborhood: 'Centro',
      position: 'atacante',
      dominantFoot: 'direito',
      profileVisibility: 'publico',
    });

    if (created) {
      setShowGoogleModal(false);
      onAuthenticated();
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-900 overflow-y-auto overflow-x-hidden flex flex-col items-center py-6 px-4">
      <div className="w-full max-w-[430px] flex flex-col gap-4 pb-16">
        {/* Cabeçalho Oficial Branco & Azul */}
        <div className="rounded-3xl bg-gradient-to-br from-blue-700 to-blue-900 p-6 text-white shadow-md text-center space-y-3">
          <div className="mx-auto flex items-center justify-center">
            <RosaliaCrest size={76} wide transparentBg />
          </div>
          <div>
            <span className="inline-block rounded-full bg-white/15 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-100">
              COMPETIR É MAIS QUE JOGAR, É EVOLUIR
            </span>
            <h1 className="mt-1.5 font-display text-2xl font-extrabold tracking-wide text-white uppercase">
              FUTPLAY LITE
            </h1>
            <p className="text-xs text-blue-100/90 mt-0.5 font-medium">
              Liga de Futebol Amador de Planalto - BA
            </p>
          </div>
        </div>

        {/* Card Principal de Autenticação */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          {/* Seletor de Abas no Topo do Card (Login vs Criar Conta) */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setLoginError('');
              }}
              className={`py-2.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Fazer Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setLoginError('');
              }}
              className={`py-2.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Criar Conta
            </button>
          </div>

          {/* Botão Oficial do Google */}
          <button
            type="button"
            onClick={() => setShowGoogleModal(true)}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white py-3 px-4 text-xs font-bold text-slate-800 shadow-xs hover:bg-slate-50 active:scale-[0.99] transition cursor-pointer"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.08.72-2.45 1.16-4.22 1.16-3.24 0-5.98-2.18-6.96-5.12H1.04v3.14C3.05 21.16 7.21 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.04 14.03c-.25-.72-.38-1.49-.38-2.28s.13-1.56.38-2.28V6.33H1.04C.38 7.64 0 9.13 0 11.75s.38 4.11 1.04 5.42l4-3.14z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.05 2.84 1.04 6.83l4 3.14c.98-2.94 3.72-5.22 6.96-5.22z"
              />
            </svg>
            <span>
              {mode === 'login'
                ? 'Entrar com o Google'
                : 'Cadastrar com o Google'}
            </span>
          </button>

          {/* Divisor */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-medium text-slate-400 shrink-0">
              ou com seu e-mail
            </span>
            <div className="border-t border-slate-200 w-full" />
          </div>

          {loginError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
              {loginError}
            </div>
          )}

          {mode === 'login' ? (
            /* FORMULÁRIO DE LOGIN COM E-MAIL E SENHA */
            <form onSubmit={handleEmailLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.99] transition cursor-pointer"
              >
                <span>Entrar na Liga</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <div className="pt-2 text-center">
                <span className="text-xs text-slate-500">
                  Ainda não tem conta?{' '}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setLoginError('');
                  }}
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Criar minha conta grátis
                </button>
              </div>
            </form>
          ) : (
            /* FORMULÁRIO DE CRIAÇÃO DE CONTA DE ATLETA */
            <form onSubmit={handleCreateAccount} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome ou Apelido Esportivo
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Ex.: Gabriel Camisa 10"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Seu E-mail
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Crie uma Senha
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Posição em Campo
                  </label>
                  <select
                    value={regPosition}
                    onChange={(e) =>
                      setRegPosition(e.target.value as PlayerPosition)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none transition cursor-pointer"
                  >
                    <option value="atacante">Atacante</option>
                    <option value="meio-campista">Meio-campista</option>
                    <option value="defensor">Defensor</option>
                    <option value="goleiro">Goleiro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pé Dominante
                  </label>
                  <select
                    value={regFoot}
                    onChange={(e) =>
                      setRegFoot(e.target.value as DominantFoot)
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none transition cursor-pointer"
                  >
                    <option value="direito">Direito</option>
                    <option value="esquerdo">Esquerdo</option>
                    <option value="ambos">Ambidestro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bairro / Comunidade
                </label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={regNeighborhood}
                    onChange={(e) => setRegNeighborhood(e.target.value)}
                    placeholder="Ex.: Centro, Vila Nova, São José..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-blue-50 border border-blue-100 p-2.5 flex items-center gap-2 text-[11px] text-blue-800">
                <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
                <span>
                  Cadastre-se para ativar seu cartão oficial na liga!
                </span>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.99] transition cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>Criar Conta e Entrar na Liga</span>
              </button>

              <div className="pt-1 text-center">
                <span className="text-xs text-slate-500">Já possui conta? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setLoginError('');
                  }}
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Fazer Login
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Rodapé de Segurança e LGPD */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 py-2">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
          <span>Acesso gratuito · Dados protegidos pela LGPD</span>
        </div>
      </div>

      {/* Modal de Login com Google */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-[380px] rounded-2xl bg-white p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.08.72-2.45 1.16-4.22 1.16-3.24 0-5.98-2.18-6.96-5.12H1.04v3.14C3.05 21.16 7.21 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.04 14.03c-.25-.72-.38-1.49-.38-2.28s.13-1.56.38-2.28V6.33H1.04C.38 7.64 0 9.13 0 11.75s.38 4.11 1.04 5.42l4-3.14z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.05 2.84 1.04 6.83l4 3.14c.98-2.94 3.72-5.22 6.96-5.22z"
                />
              </svg>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Entrar com o Google
                </h3>
                <p className="text-[11px] text-slate-500">
                  Informe seus dados para acessar a Liga
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Seu Nome
                </label>
                <input
                  type="text"
                  value={customGoogleName}
                  onChange={(e) => setCustomGoogleName(e.target.value)}
                  placeholder="Seu Nome ou Apelido"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Seu Gmail
                </label>
                <input
                  type="email"
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                  placeholder="seugmail@gmail.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  const name = customGoogleName.trim() || 'Atleta';
                  const email = customGoogleEmail.trim().toLowerCase();
                  if (!email || !email.includes('@')) {
                    alert('Informe um Gmail válido.');
                    return;
                  }
                  handleGoogleAccountSelect(name, email);
                }}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 active:scale-[0.99] transition cursor-pointer"
              >
                Confirmar e Entrar com Google
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowGoogleModal(false)}
              className="w-full rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
