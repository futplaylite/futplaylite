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
import { PWAInstallBanner } from './PWAInstallBanner';
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



  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-900 overflow-y-auto overflow-x-hidden flex flex-col items-center py-6 px-4">
      <div className="w-full max-w-[430px] flex flex-col gap-4 pb-16">
        {/* Banner de Instalação PWA */}
        <PWAInstallBanner />
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
          <span>Acesso exclusivo · Dados protegidos pela LGPD</span>
        </div>
      </div>


    </div>
  );
};
