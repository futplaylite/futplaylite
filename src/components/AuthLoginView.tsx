import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
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
    profiles,
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

    // Procura usuário cadastrado pelo e-mail ou nome
    const existingUser = users.find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );

    if (existingUser) {
      switchActiveUser(existingUser.id);
      onAuthenticated();
      return;
    }

    // Se digitou um e-mail que ainda não existe, sugere criar conta preenchida ou cria
    setLoginError(
      'E-mail ainda não cadastrado. Toque em "Criar Conta" abaixo para concluir seu cadastro em segundos!'
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
    <div className="min-h-dvh w-full bg-slate-50 text-slate-900 flex flex-col justify-between">
      <div className="mx-auto w-full max-w-[430px] px-4 py-6 space-y-4">
        {/* Cabeçalho Oficial Branco & Azul com Mini Campo Animado */}
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
              Liga de Jogadores de Futebol Amador de Planalto - BA
            </p>
          </div>
        </div>

        {/* Card Principal de Autenticação */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          {/* Botão Oficial do Google */}
          <button
            type="button"
            onClick={() => setShowGoogleModal(true)}
            className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white py-3 px-4 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 active:scale-[0.99] transition"
          >
            {/* Ícone Oficial do Google em SVG */}
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
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
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.99] transition"
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
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  Criar minha conta grátis
                </button>
              </div>
            </form>
          ) : (
            /* FORMULÁRIO DE CRIAÇÃO DE CONTA DE ATLETA */
            <form onSubmit={handleCreateAccount} className="space-y-3">
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
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
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.99] transition"
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
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  Fazer Login
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Card de Acesso Rápido (Atletas da Liga para Teste em 1 Toque) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Users className="h-4 w-4 text-blue-600" />
              Entrar Rápido com Atleta da Liga
            </span>
            <span className="text-[10px] font-semibold text-blue-600">
              1 toque
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {profiles.slice(0, 3).map((prof) => {
              const u = users.find((user) => user.id === prof.userId);
              if (!u) return null;
              return (
                <button
                  key={prof.id}
                  type="button"
                  onClick={() => {
                    switchActiveUser(u.id);
                    onAuthenticated();
                  }}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-left hover:border-blue-300 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 font-display text-xs font-bold text-white">
                      {prof.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {prof.displayName}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {u.email} · {prof.position}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-blue-600 shrink-0">
                    Entrar →
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Rodapé de Segurança */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pb-4">
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
                  Escolha uma Conta do Google
                </h3>
                <p className="text-[11px] text-slate-500">
                  Para prosseguir para FutPlay Lite
                </p>
              </div>
            </div>

            {/* Contas Google Sugeridas */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() =>
                  handleGoogleAccountSelect(
                    'Lucas "Raio" Oliveira',
                    'lucas.raio@rosalia.esp.br'
                  )
                }
                className="w-full flex items-center gap-3 rounded-xl border border-slate-200 p-2.5 text-left hover:bg-blue-50/50 hover:border-blue-200 transition"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  LR
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    Lucas "Raio" Oliveira
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    lucas.raio@gmail.com
                  </div>
                </div>
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
              </button>

              {/* Informar outra conta Google */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 block">
                  Ou entre com seu próprio Gmail:
                </span>
                <input
                  type="text"
                  value={customGoogleName}
                  onChange={(e) => setCustomGoogleName(e.target.value)}
                  placeholder="Seu Nome (ex.: João Silva)"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <input
                  type="email"
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                  placeholder="seugmail@gmail.com"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = customGoogleName.trim() || 'Atleta Google';
                    const email =
                      customGoogleEmail.trim() || 'atleta.google@gmail.com';
                    handleGoogleAccountSelect(name, email);
                  }}
                  className="w-full rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
                >
                  Continuar com este Gmail
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGoogleModal(false)}
              className="w-full rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
