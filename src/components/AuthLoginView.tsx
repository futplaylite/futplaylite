import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import { ConfirmationResult } from 'firebase/auth';
import { sendFirebaseSmsCode, confirmFirebaseSmsCode } from '../lib/firebase/phoneAuth';
import { useLeague } from '../lib/store/LeagueContext';
import { RosaliaCrest } from './RosaliaCrest';
import { PWAInstallBanner } from './PWAInstallBanner';
import { DominantFoot, PlayerPosition, ProfileVisibility } from '../types/league';

interface AuthLoginViewProps {
  onAuthenticated: () => void;
}

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
    selectedCityId,
    switchActiveUser,
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

  // SMS Verification State (Firebase)
  const [showSmsModal, setShowSmsModal] = useState<boolean>(false);
  const [smsCode, setSmsCode] = useState<string>('');
  const [isSendingSms, setIsSendingSms] = useState<boolean>(false);
  const [isVerifyingSms, setIsVerifyingSms] = useState<boolean>(false);
  const [smsError, setSmsError] = useState<string>('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [pendingRegistrationData, setPendingRegistrationData] = useState<{
    displayName: string;
    email: string;
    whatsappNumber?: string;
    cityId: string;
    neighborhood: string;
    position: PlayerPosition;
    dominantFoot: DominantFoot;
    profileVisibility: ProfileVisibility;
  } | null>(null);

  const handleVerifySmsCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) {
      setSmsError('Sessão de verificação expirada. Tente reenviar o código.');
      return;
    }
    const cleanCode = smsCode.trim();
    if (cleanCode.length < 6) {
      setSmsError('Digite o código de 6 dígitos recebido por SMS.');
      return;
    }

    setIsVerifyingSms(true);
    setSmsError('');

    try {
      await confirmFirebaseSmsCode(confirmationResult, cleanCode);
      
      // Código confirmado com sucesso pelo Firebase!
      if (pendingRegistrationData) {
        const created = registerNewAthlete(pendingRegistrationData);
        if (created) {
          setShowSmsModal(false);
          notify(
            'success',
            'Telefone Confirmado!',
            'Seu número foi verificado com sucesso via SMS.'
          );
          onAuthenticated();
        }
      }
    } catch (err: unknown) {
      console.error('Erro ao validar código SMS:', err);
      const errorObj = err as { code?: string; message?: string };
      if (errorObj?.code === 'auth/invalid-verification-code') {
        setSmsError('Código incorreto. Verifique o SMS recebido e digite novamente.');
      } else if (errorObj?.code === 'auth/code-expired') {
        setSmsError('O código expirou. Clique em "Reenviar SMS" abaixo.');
      } else {
        setSmsError('Falha ao validar o código. Tente novamente.');
      }
    } finally {
      setIsVerifyingSms(false);
    }
  };

  const handleResendSms = async () => {
    if (!pendingRegistrationData?.whatsappNumber) return;
    setIsSendingSms(true);
    setSmsError('');
    try {
      const digits = pendingRegistrationData.whatsappNumber.replace(/\D/g, '');
      const result = await sendFirebaseSmsCode(digits, 'recaptcha-container');
      setConfirmationResult(result);
      notify('info', 'SMS Reenviado', 'Um novo código de 6 dígitos foi enviado para seu celular.');
    } catch (err: unknown) {
      console.error('Erro ao reenviar SMS:', err);
      setSmsError('Não foi possível reenviar o SMS agora. Aguarde um instante.');
    } finally {
      setIsSendingSms(false);
    }
  };

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

  const handleLogin = (e: React.FormEvent) => {
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

    // Procura usuário cadastrado por e-mail ou telefone
    const existingUser = findUserByIdentifier(trimmed);

    if (existingUser) {
      switchActiveUser(existingUser.id);
      onAuthenticated();
      return;
    }

    setLoginError(
      'Conta ainda não cadastrada com este e-mail ou telefone. Toque na aba "Criar Conta" acima para se cadastrar em segundos!'
    );
    setRegIdentifier(trimmed);
    setRegConfirmIdentifier(trimmed);
  };

  const handleCreateAccount = (e: React.FormEvent) => {
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

    // Verifica se já existe uma conta cadastrada com esse e-mail ou telefone
    const existing = findUserByIdentifier(trimmedIdentifier);
    if (existing) {
      switchActiveUser(existing.id);
      notify(
        'info',
        'Conta já existente!',
        'Identificamos seu cadastro e conectamos você diretamente à sua conta.'
      );
      onAuthenticated();
      return;
    }

    const finalEmail = isEmail
      ? trimmedIdentifier.toLowerCase()
      : `${digits}@celular.futplay.com`;

    const finalWhatsapp = !isEmail
      ? formatIdentifierInput(digits)
      : undefined;

    // Se informou telefone / celular, envia SMS de confirmação via Firebase
    if (!isEmail) {
      setIsSendingSms(true);
      setSmsError('');
      setSmsCode('');
      setPendingRegistrationData({
        displayName: trimmedName,
        email: finalEmail,
        whatsappNumber: finalWhatsapp,
        cityId: selectedCityId,
        neighborhood: regNeighborhood.trim() || 'Centro',
        position: regPosition,
        dominantFoot: regFoot,
        profileVisibility: 'publico',
      });

      sendFirebaseSmsCode(digits, 'recaptcha-container')
        .then((result) => {
          setConfirmationResult(result);
          setShowSmsModal(true);
          setIsSendingSms(false);
        })
        .catch((err: unknown) => {
          console.error('Erro ao enviar SMS Firebase:', err);
          setIsSendingSms(false);
          const errorObj = err as { code?: string; message?: string };
          let msg = 'Erro ao enviar SMS de verificação.';
          if (errorObj?.code === 'auth/operation-not-allowed') {
            msg = 'O provedor de Telefone precisa ser ativado no Firebase Console (Authentication > Sign-in method > Telefone).';
          } else if (errorObj?.code === 'auth/invalid-phone-number') {
            msg = 'Número de telefone inválido para envio de SMS.';
          } else if (errorObj?.code === 'auth/too-many-requests') {
            msg = 'Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar novamente.';
          } else if (errorObj?.message) {
            msg = errorObj.message;
          }
          setLoginError(msg);
        });
      return;
    }

    // Se informou e-mail, registra diretamente
    const created = registerNewAthlete({
      displayName: trimmedName,
      email: finalEmail,
      whatsappNumber: finalWhatsapp,
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
                disabled={isSendingSms}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.99] transition cursor-pointer disabled:opacity-60"
              >
                {isSendingSms ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Enviando SMS de Confirmação...</span>
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

      {/* Modal de Validação de SMS (Firebase Phone Auth) */}
      {showSmsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-[390px] rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 text-blue-700 font-bold text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <span>Confirmação por SMS</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSmsModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-center space-y-1">
              <p className="text-xs text-slate-600">
                Enviamos um código de verificação para:
              </p>
              <p className="text-sm font-extrabold text-blue-900 font-mono">
                {pendingRegistrationData?.whatsappNumber}
              </p>
            </div>

            <form onSubmit={handleVerifySmsCode} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 text-center">
                  Código de 6 Dígitos
                </label>
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  required
                  value={smsCode}
                  onChange={(e) => {
                    setSmsError('');
                    setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  }}
                  placeholder="000000"
                  className="w-full rounded-2xl border-2 border-blue-200 bg-blue-50/50 py-3 text-center font-mono text-2xl font-black tracking-[0.35em] text-blue-950 focus:border-blue-600 focus:bg-white focus:outline-none transition"
                />
              </div>

              {smsError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700 text-center">
                  {smsError}
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifyingSms || smsCode.length < 6}
                className="w-full rounded-2xl bg-blue-600 py-3 text-xs font-bold text-white shadow-md hover:bg-blue-700 active:scale-[0.99] transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isVerifyingSms ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verificando código...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Confirmar Código e Entrar</span>
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={handleResendSms}
                disabled={isSendingSms}
                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-semibold cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSendingSms ? 'animate-spin' : ''}`} />
                <span>Reenviar SMS</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSmsModal(false)}
                className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
              >
                Alterar número
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Container invisível para reCAPTCHA do Firebase */}
      <div id="recaptcha-container" />


    </div>
  );
};
