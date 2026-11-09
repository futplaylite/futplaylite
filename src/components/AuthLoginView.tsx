import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { supabaseService, isSupabaseConfigured } from '../lib/supabase';
import { RosaliaCrest } from './RosaliaCrest';
import { PWAInstallBanner } from './PWAInstallBanner';
import { DominantFoot, PlayerPosition, ProfileVisibility, User, PlayerProfile } from '../types/league';

interface AuthLoginViewProps {
  onAuthenticated: () => void;
}

const POSITION_OPTIONS: { value: PlayerPosition; label: string }[] = [
  { value: 'atacante', label: 'Atacante' },
  { value: 'meio-campista', label: 'Meio-campista' },
  { value: 'defensor', label: 'Defensor' },
  { value: 'goleiro', label: 'Goleiro' },
];

const FOOT_OPTIONS: { value: DominantFoot; label: string; sub: string }[] = [
  { value: 'direito', label: 'Direito', sub: 'Destro' },
  { value: 'esquerdo', label: 'Esquerdo', sub: 'Canhoto' },
  { value: 'ambos', label: 'Ambos', sub: 'Ambidestro' },
];

/**
 * Formata a entrada do usuário: se parecer número, aplica máscara de celular (DDD) 9XXXX-XXXX;
 * se contiver letras ou @, mantém texto puro de e-mail.
 */
function formatIdentifierInput(raw: string): string {
  if (/[a-zA-Z@]/.test(raw)) {
    return raw;
  }
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export const AuthLoginView: React.FC<AuthLoginViewProps> = ({
  onAuthenticated,
}) => {
  const {
    users,
    profiles,
    selectedCityId,
    switchActiveUser,
    setActiveUserWithData,
    removeLocalUserSilently,
    registerNewAthlete,
    notify,
  } = useLeague();

  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login states (E-mail ou Telefone)
  const [loginIdentifier, setLoginIdentifier] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');

  // Register states
  const [regName, setRegName] = useState<string>('');
  const [regIdentifier, setRegIdentifier] = useState<string>('');
  const [regConfirmIdentifier, setRegConfirmIdentifier] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>('');
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [regNeighborhood, setRegNeighborhood] = useState<string>('Centro');
  const [regPosition, setRegPosition] = useState<PlayerPosition>('atacante');
  const [regFoot, setRegFoot] = useState<DominantFoot>('direito');
  const [openPositionDropdown, setOpenPositionDropdown] = useState<boolean>(false);
  const [openFootDropdown, setOpenFootDropdown] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const errorBoxRef = useRef<HTMLDivElement>(null);

  // Sempre que surgir um erro, rola a tela até a mensagem (no celular ela ficava fora da tela)
  useEffect(() => {
    if (loginError && errorBoxRef.current) {
      errorBoxRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [loginError]);

  /**
   * Localiza usuário existente comparando por e-mail ou por dígitos de telefone/WhatsApp
   */
  const findUserByIdentifier = (input: string) => {
    const trimmed = input.trim();
    const digits = trimmed.replace(/\D/g, '');
    const isEmail = trimmed.includes('@');

    return users.find((u) => {
      // 1. Match exato por e-mail
      if (isEmail && u.email.toLowerCase() === trimmed.toLowerCase()) {
        return true;
      }

      // 2. Match por telefone/WhatsApp
      if (digits.length >= 8) {
        const userPhoneDigits = (u.whatsappNumber || '').replace(/\D/g, '');
        if (userPhoneDigits) {
          if (
            userPhoneDigits === digits ||
            userPhoneDigits.endsWith(digits) ||
            digits.endsWith(userPhoneDigits)
          ) {
            return true;
          }
        }

        // Se cadastrou com celular direto
        if (u.email.toLowerCase().startsWith(digits)) {
          return true;
        }
      }

      // 3. Fallback genérico de e-mail
      if (u.email.toLowerCase() === trimmed.toLowerCase()) {
        return true;
      }

      return false;
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const trimmed = loginIdentifier.trim();
    const digits = trimmed.replace(/\D/g, '');
    const isEmail = trimmed.includes('@');

    if (!isEmail && digits.length < 8) {
      setLoginError('Informe um e-mail válido ou seu telefone celular com DDD.');
      return;
    }
    if (isEmail && (!trimmed.includes('.') || trimmed.length < 5)) {
      setLoginError('Informe um endereço de e-mail válido.');
      return;
    }
    if (loginPassword.trim().length < 4) {
      setLoginError('Informe sua senha (mínimo 4 caracteres).');
      return;
    }

    setIsSubmitting(true);

    let existingUser: User | undefined;
    let matchedProfile: PlayerProfile | undefined;
    let supabaseChecked = false;

    // 1. Consulta SEMPRE o Supabase primeiro como fonte oficial da verdade
    if (isSupabaseConfigured()) {
      try {
        const remoteMatch = await supabaseService.findUserByIdentifier(trimmed);
        supabaseChecked = true;
        if (remoteMatch) {
          existingUser = remoteMatch.user;
          matchedProfile = remoteMatch.profile;

          // Se tiver senha salva no banco Supabase, valida
          if (remoteMatch.password && remoteMatch.password !== loginPassword.trim()) {
            setIsSubmitting(false);
            setLoginError('Senha incorreta para este usuário.');
            return;
          }

          // Cache local da senha para acesso offline
          try {
            const stored = JSON.parse(
              localStorage.getItem('futplay_user_passwords') || '{}'
            );
            stored[existingUser.id] = loginPassword.trim();
            if (digits) stored[digits] = loginPassword.trim();
            if (existingUser.email) {
              stored[existingUser.email.toLowerCase()] = loginPassword.trim();
            }
            localStorage.setItem('futplay_user_passwords', JSON.stringify(stored));
          } catch {
            // Ignora falha local
          }
        } else {
          // Se o Supabase respondeu e a conta não existe mais lá, limpa eventual rastro local
          const staleLocal = findUserByIdentifier(trimmed);
          if (staleLocal) {
            removeLocalUserSilently(staleLocal.id);
          }
        }
      } catch (err) {
        console.warn('Falha ao consultar Supabase no login:', err);
      }
    }

    // 2. Fallback local (APENAS caso esteja sem conexão com a internet / Supabase inacessível)
    if (!existingUser && !supabaseChecked) {
      existingUser = findUserByIdentifier(trimmed);
      matchedProfile = existingUser
        ? profiles.find((p) => p.userId === existingUser?.id)
        : undefined;
    }

    setIsSubmitting(false);

    if (existingUser) {
      // Valida senha se houver cadastrada localmente
      try {
        const stored = JSON.parse(
          localStorage.getItem('futplay_user_passwords') || '{}'
        );
        const expected =
          stored[existingUser.id] ||
          (digits ? stored[digits] : undefined) ||
          stored[existingUser.email?.toLowerCase()];
        if (expected && expected !== loginPassword.trim()) {
          setLoginError('Senha incorreta para este usuário.');
          return;
        }
      } catch {
        // Ignora falha local
      }

      // Ativa o usuário e perfil no estado da liga e persiste sessão, preservando dados do time
      const localUser = findUserByIdentifier(trimmed);
      const localProfile = localUser
        ? profiles.find((p) => p.userId === localUser.id)
        : undefined;

      const finalUserToActivate: User = {
        ...existingUser,
        teamName: existingUser.teamName || localUser?.teamName,
        teamCrestUrl: existingUser.teamCrestUrl || localUser?.teamCrestUrl,
        teamCity: existingUser.teamCity || localUser?.teamCity,
        teamModality: existingUser.teamModality || localUser?.teamModality,
        teamInviteCode: existingUser.teamInviteCode || localUser?.teamInviteCode,
        isTeamOwner:
          existingUser.isTeamOwner !== undefined
            ? existingUser.isTeamOwner
            : localUser?.isTeamOwner,
        onboardingCompleted: true,
        onboardingStep: 4,
      };

      const finalProfileToActivate: PlayerProfile | undefined = matchedProfile
        ? {
            ...matchedProfile,
            teamName:
              matchedProfile.teamName ||
              localProfile?.teamName ||
              finalUserToActivate.teamName,
            teamCrestUrl:
              matchedProfile.teamCrestUrl ||
              localProfile?.teamCrestUrl ||
              finalUserToActivate.teamCrestUrl,
            teamCity:
              matchedProfile.teamCity ||
              localProfile?.teamCity ||
              finalUserToActivate.teamCity,
            teamModality:
              matchedProfile.teamModality ||
              localProfile?.teamModality ||
              finalUserToActivate.teamModality,
            teamInviteCode:
              matchedProfile.teamInviteCode ||
              localProfile?.teamInviteCode ||
              finalUserToActivate.teamInviteCode,
            isTeamOwner:
              matchedProfile.isTeamOwner !== undefined
                ? matchedProfile.isTeamOwner
                : (localProfile?.isTeamOwner ?? finalUserToActivate.isTeamOwner),
          }
        : localProfile;

      setActiveUserWithData(finalUserToActivate, finalProfileToActivate);
      onAuthenticated();
      return;
    }

    setLoginError(
      'Conta ainda não cadastrada com este e-mail ou telefone. Toque na aba "Criar Conta" acima para se cadastrar em segundos!'
    );
    setRegIdentifier(trimmed);
    setRegConfirmIdentifier(trimmed);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const trimmedName = regName.trim();
    const trimmedIdentifier = regIdentifier.trim();
    const digits = trimmedIdentifier.replace(/\D/g, '');
    const isEmail = trimmedIdentifier.includes('@');

    if (trimmedName.length < 2) {
      setLoginError('Informe seu nome ou apelido esportivo (mín. 2 letras).');
      return;
    }
    if (!isEmail && digits.length < 8) {
      setLoginError('Informe um e-mail válido ou telefone celular com DDD.');
      return;
    }
    if (isEmail && (!trimmedIdentifier.includes('.') || trimmedIdentifier.length < 5)) {
      setLoginError('Informe um endereço de e-mail válido para criar sua conta.');
      return;
    }

    const trimmedConfirmIdentifier = regConfirmIdentifier.trim();
    if (!trimmedConfirmIdentifier) {
      setLoginError('Confirme seu e-mail ou telefone redigitando-o no campo de confirmação.');
      return;
    }
    if (trimmedIdentifier.toLowerCase() !== trimmedConfirmIdentifier.toLowerCase()) {
      setLoginError('A confirmação do e-mail/celular não confere com o que foi digitado.');
      return;
    }

    if (regPassword.trim().length < 4) {
      setLoginError('Crie uma senha com pelo menos 4 caracteres.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setLoginError('A confirmação da senha não confere com a senha digitada.');
      return;
    }

    setIsSubmitting(true);

    // Verifica se já existe conta: o Supabase é a fonte oficial
    let existing = findUserByIdentifier(trimmedIdentifier);
    let staleLocalUserId: string | undefined;

    if (isSupabaseConfigured()) {
      let remoteUser: User | undefined;
      try {
        const supAccount = await supabaseService.findUserByIdentifier(trimmedIdentifier);
        if (supAccount) {
          remoteUser = supAccount.user;
        }
      } catch {
        // Ignora falha de consulta
      }

      if (remoteUser) {
        existing = remoteUser;
      } else if (existing) {
        // Conta antiga que ficou só neste aparelho e nunca chegou ao banco:
        // não bloqueia o cadastro; será substituída após salvar no Supabase.
        staleLocalUserId = existing.id;
        existing = undefined;
      }
    }

    if (existing) {
      setIsSubmitting(false);
      setLoginError('Já existe uma conta cadastrada com este e-mail ou telefone. Toque em "Fazer Login" para entrar.');
      return;
    }

    const finalEmail = isEmail
      ? trimmedIdentifier.toLowerCase()
      : `${digits}@celular.futplay.com`;

    const finalWhatsapp = !isEmail
      ? formatIdentifierInput(digits)
      : undefined;

    // Registra o novo atleta no estado da liga
    const created = registerNewAthlete({
      displayName: trimmedName,
      email: finalEmail,
      whatsappNumber: finalWhatsapp,
      password: regPassword.trim(),
      cityId: selectedCityId,
      neighborhood: regNeighborhood.trim() || 'Centro',
      position: regPosition,
      dominantFoot: regFoot,
      profileVisibility: 'publico',
    });

    if (created) {
      // Salva a senha com segurança localmente para próximos logins offline
      try {
        const stored = JSON.parse(localStorage.getItem('futplay_user_passwords') || '{}');
        stored[created.userId] = regPassword.trim();
        if (digits) {
          stored[digits] = regPassword.trim();
        }
        if (finalEmail) {
          stored[finalEmail.toLowerCase()] = regPassword.trim();
        }
        localStorage.setItem('futplay_user_passwords', JSON.stringify(stored));
      } catch {
        // Ignora falha local
      }

      // Sincroniza e aguarda explicitamente o salvamento no Supabase
      if (isSupabaseConfigured()) {
        const supUser: User = {
          id: created.userId,
          email: finalEmail,
          whatsappNumber: finalWhatsapp,
          role: 'player',
          status: 'ativa',
          createdAt: new Date().toISOString(),
        };
        const supProfile: PlayerProfile = {
          ...created,
        };
        try {
          const supSync = await supabaseService.registerAthleteInSupabase({
            user: supUser,
            profile: supProfile,
            password: regPassword.trim(),
          });
          if (!supSync.success) {
            console.error('Falha de sincronização no Supabase:', supSync.error);
            // Desfaz o registro local para não deixar conta "fantasma" no aparelho
            removeLocalUserSilently(created.userId);
            setIsSubmitting(false);
            setLoginError(`Erro ao salvar no banco de dados: ${supSync.error || 'Falha na resposta do servidor'}`);
            return;
          }
        } catch (syncErr) {
          console.error('Erro ao conectar com Supabase durante registro:', syncErr);
          removeLocalUserSilently(created.userId);
          setIsSubmitting(false);
          setLoginError(`Erro de conexão com o Supabase: ${syncErr instanceof Error ? syncErr.message : String(syncErr)}`);
          return;
        }

        // Conta salva no banco: descarta a conta antiga que existia só no aparelho
        if (staleLocalUserId && staleLocalUserId !== created.userId) {
          removeLocalUserSilently(staleLocalUserId);
        }
      }

      setActiveUserWithData(
        {
          id: created.userId,
          email: finalEmail,
          whatsappNumber: finalWhatsapp,
          role: 'player',
          status: 'ativa',
          createdAt: new Date().toISOString(),
          onboardingStep: 1,
          onboardingCompleted: false,
        },
        created
      );

      notify(
        'success',
        'Conta criada com sucesso!',
        `Bem-vindo à liga, ${trimmedName}! Seu cartão de atleta oficial foi ativado e sincronizado com o Supabase.`
      );
      onAuthenticated();
    } else {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-900 overflow-y-auto overflow-x-hidden flex flex-col items-center py-6 px-4">
      <div className="w-full max-w-[430px] flex flex-col gap-4 pb-16">
        {/* Banner de Instalação PWA */}
        <PWAInstallBanner />
        {/* Cabeçalho Oficial Branco & Azul */}
        <div
          className={`rounded-3xl bg-gradient-to-br from-blue-700 to-blue-900 text-white shadow-md text-center transition-all duration-300 ${
            mode === 'login' ? 'p-6 space-y-3' : 'py-3.5 px-4 space-y-1'
          }`}
        >
          {mode === 'login' && (
            <>
              <div className="mx-auto flex items-center justify-center">
                <RosaliaCrest size={76} wide transparentBg />
              </div>
              <div>
                <span className="inline-block rounded-full bg-white/15 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-100">
                  COMPETIR É MAIS QUE JOGAR, É EVOLUIR
                </span>
              </div>
            </>
          )}
          <div>
            <h1
              className={`font-display font-extrabold tracking-wide text-white uppercase ${
                mode === 'login' ? 'mt-1.5 text-2xl' : 'text-xl'
              }`}
            >
              FUTPLAY LITE
            </h1>
            <p className="text-xs text-blue-100/90 font-medium">
              {mode === 'login'
                ? 'Liga de Futebol Amador de Planalto - BA'
                : 'Cadastro de Atleta · Planalto - BA'}
            </p>
          </div>
        </div>

        {/* Card Principal de Autenticação */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          {loginError && (
            <div
              ref={errorBoxRef}
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
            >
              {loginError}
            </div>
          )}

          {mode === 'login' ? (
            /* FORMULÁRIO DE LOGIN COM E-MAIL OU TELEFONE E SENHA */
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  E-mail ou Celular
                </label>
                <div className="relative">
                  {loginIdentifier && !loginIdentifier.includes('@') && loginIdentifier.replace(/\D/g, '').length > 0 ? (
                    <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600" />
                  ) : (
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  )}
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(formatIdentifierInput(e.target.value))}
                    placeholder="seuemail@exemplo.com ou (77) 99999-8888"
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
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.99] transition cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Consultando banco de dados...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar na Liga</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
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
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Criar minha conta
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
                  E-mail ou Celular
                </label>
                <div className="relative">
                  {regIdentifier && !regIdentifier.includes('@') && regIdentifier.replace(/\D/g, '').length > 0 ? (
                    <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600" />
                  ) : (
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  )}
                  <input
                    type="text"
                    required
                    value={regIdentifier}
                    onChange={(e) => setRegIdentifier(formatIdentifierInput(e.target.value))}
                    placeholder="seuemail@exemplo.com ou (77) 99999-8888"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirmar E-mail ou Celular
                </label>
                <div className="relative">
                  {regConfirmIdentifier && !regConfirmIdentifier.includes('@') && regConfirmIdentifier.replace(/\D/g, '').length > 0 ? (
                    <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600" />
                  ) : (
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  )}
                  <input
                    type="text"
                    required
                    value={regConfirmIdentifier}
                    onChange={(e) => setRegConfirmIdentifier(formatIdentifierInput(e.target.value))}
                    placeholder="Redigite seu e-mail ou telefone"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none transition"
                  />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  Você usará este e-mail ou número de telefone para entrar na sua conta.
                </p>
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Redigite sua senha"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 relative">
                {/* Backdrop invisível para fechar menu ao tocar fora */}
                {(openPositionDropdown || openFootDropdown) && (
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => {
                      setOpenPositionDropdown(false);
                      setOpenFootDropdown(false);
                    }}
                  />
                )}

                {/* Seletor Customizado Inline: Posição */}
                <div className="relative z-20">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Posição em Campo
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenPositionDropdown((prev) => !prev);
                      setOpenFootDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between rounded-xl border bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-900 transition cursor-pointer text-left ${
                      openPositionDropdown
                        ? 'border-blue-600 bg-white ring-2 ring-blue-100'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="truncate">
                      {POSITION_OPTIONS.find((p) => p.value === regPosition)?.label || 'Atacante'}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        openPositionDropdown ? 'rotate-180 text-blue-600' : ''
                      }`}
                    />
                  </button>

                  {/* Lista inline que surge logo abaixo da caixa sem abrir popup nativo */}
                  {openPositionDropdown && (
                    <div className="absolute left-0 top-full mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-1 shadow-xl z-30 animate-in fade-in zoom-in-95 duration-150">
                      {POSITION_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setRegPosition(opt.value);
                            setOpenPositionDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition cursor-pointer text-left ${
                            regPosition === opt.value
                              ? 'bg-blue-50 text-blue-700 font-bold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {regPosition === opt.value && (
                            <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Seletor Customizado Inline: Pé Dominante */}
                <div className="relative z-20">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pé Dominante
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenFootDropdown((prev) => !prev);
                      setOpenPositionDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between rounded-xl border bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-900 transition cursor-pointer text-left ${
                      openFootDropdown
                        ? 'border-blue-600 bg-white ring-2 ring-blue-100'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="truncate">
                      {FOOT_OPTIONS.find((f) => f.value === regFoot)?.label || 'Direito'}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        openFootDropdown ? 'rotate-180 text-blue-600' : ''
                      }`}
                    />
                  </button>

                  {/* Lista inline que surge logo abaixo da caixa sem abrir popup nativo */}
                  {openFootDropdown && (
                    <div className="absolute left-0 top-full mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-1 shadow-xl z-30 animate-in fade-in zoom-in-95 duration-150">
                      {FOOT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setRegFoot(opt.value);
                            setOpenFootDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition cursor-pointer text-left ${
                            regFoot === opt.value
                              ? 'bg-blue-50 text-blue-700 font-bold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <span>{opt.label}</span>
                            <span className="text-[10px] text-slate-400">({opt.sub})</span>
                          </div>
                          {regFoot === opt.value && (
                            <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
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



              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.99] transition cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Criando sua conta...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span>Criar Conta e Entrar na Liga</span>
                  </>
                )}
              </button>

              <div className="pt-1 text-center">
                <span className="text-xs text-slate-500">Já possui conta? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setLoginError('');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
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
