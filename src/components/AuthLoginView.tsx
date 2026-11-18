import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Crown,
  Eye,
  EyeOff,
  ImagePlus,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Shield,
  ShieldCheck,
  Trash2,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { supabase, supabaseService, isSupabaseConfigured } from '../lib/supabase';
import { RosaliaCrest } from './RosaliaCrest';
import { PWAInstallBanner } from './PWAInstallBanner';
import { DominantFoot, PlayerPosition, User, PlayerProfile, TeamModality, UserRole } from '../types/league';

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

const MODALITY_OPTIONS: { id: TeamModality; label: string; desc: string }[] = [
  { id: 'society', label: 'Society', desc: 'Gramado sintético · 6v6 / 7v7' },
  { id: 'futsal', label: 'Futsal', desc: 'Quadra esportiva · 5v5' },
  { id: 'futebol_campo', label: 'Futebol de Campo', desc: 'Campo oficial · 11v11' },
  { id: 'futebol_areia', label: 'Futebol de Areia', desc: 'Quadra de areia · Beach Soccer' },
];

/**
 * Processa o Brasão / Escudo do Time mantendo 100% do fundo transparente (PNG Alpha)
 * e sem cortar nenhuma ponta do escudo.
 */
function processCrestTransparentPng(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o brasão.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem inválido.'));
      img.onload = () => {
        const maxDim = 320;
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
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
    profiles,
    selectedCityId,
    switchActiveUser,
    setActiveUserWithData,
    removeLocalUserSilently,
    registerNewAthlete,
    notify,
  } = useLeague();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot_password'>('login');

  // Login states (E-mail ou Telefone)
  const [loginIdentifier, setLoginIdentifier] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');

  // Estados de Recuperação de Senha Esquecida
  const [recoveryPhone, setRecoveryPhone] = useState<string>('');
  const [recoveryBirthDate, setRecoveryBirthDate] = useState<string>('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState<string>('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState<string>('');
  const [showRecoveryNewPass, setShowRecoveryNewPass] = useState<boolean>(false);
  const [recoverySuccessMsg, setRecoverySuccessMsg] = useState<string>('');
  const [isRecovering, setIsRecovering] = useState<boolean>(false);

  // Estados de Redefinição Obrigatória de Senha (Etapa 5 / Supabase Auth)
  const [mustResetPassword, setMustResetPassword] = useState<boolean>(false);
  const [newResetPassword, setNewResetPassword] = useState<string>('');
  const [confirmResetPassword, setConfirmResetPassword] = useState<string>('');
  const [showResetPassword, setShowResetPassword] = useState<boolean>(false);
  const [pendingUserToActivate, setPendingUserToActivate] = useState<User | null>(null);
  const [pendingProfileToActivate, setPendingProfileToActivate] = useState<PlayerProfile | undefined>(undefined);

  // Register states
  const [regName, setRegName] = useState<string>('');
  const [regIdentifier, setRegIdentifier] = useState<string>('');
  const [regConfirmIdentifier, setRegConfirmIdentifier] = useState<string>('');
  const [regBirthDate, setRegBirthDate] = useState<string>('');
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

  // Estados do Vínculo com a Equipe
  const [teamAction, setTeamAction] = useState<'create' | 'join'>('create');
  const [regTeamName, setRegTeamName] = useState<string>('');
  const [regTeamModality, setRegTeamModality] = useState<TeamModality>('society');
  const [regTeamCity, setRegTeamCity] = useState<string>('Planalto - BA');
  const [regTeamCrestUrl, setRegTeamCrestUrl] = useState<string | undefined>(undefined);
  const [isUploadingCrest, setIsUploadingCrest] = useState<boolean>(false);
  const crestInputRef = useRef<HTMLInputElement | null>(null);

  const [ownerInviteSuffix] = useState<number>(() => Math.floor(10 + Math.random() * 89));
  const generatedOwnerCode = useMemo(() => {
    const prefix = regTeamName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'TIME';
    return `${prefix}-${ownerInviteSuffix}`;
  }, [regTeamName, ownerInviteSuffix]);

  // Código digitado pelo atleta para entrar em um time existente
  const [regJoinCode, setRegJoinCode] = useState<string>('');
  const [asyncRemoteTeam, setAsyncRemoteTeam] = useState<any | null>(null);
  const [isSearchingTeam, setIsSearchingTeam] = useState<boolean>(false);
  const foundTeamsCache = useRef<Map<string, any>>(new Map());

  // Auto-preenchimento caso venha de link com ?convite=XYZ
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get('convite');
      if (urlCode) {
        setMode('register');
        setTeamAction('join');
        setRegJoinCode(urlCode.toUpperCase());
      }
    }
  }, []);

  // Notificação caso a sessão anterior tenha sido desconectada por login simultâneo em outro aparelho
  useEffect(() => {
    try {
      const conflictMsg = sessionStorage.getItem('futplay_session_conflict_notice');
      if (conflictMsg) {
        setLoginError(conflictMsg);
        sessionStorage.removeItem('futplay_session_conflict_notice');
      }
    } catch {}
  }, []);

  const normalizeCode = (code?: string) =>
    (code || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  // Catálogo completo de times (perfis de atletas, contas de usuários e cache)
  const allAvailableTeams = useMemo(() => {
    const teamsMap = new Map<string, any>();

    const MODALITY_LABELS: Record<string, string> = {
      society: 'Society',
      futsal: 'Futsal',
      futebol_campo: 'Futebol de Campo',
      futebol_areia: 'Futebol de Areia',
    };

    const registerTeamInMap = (key: string, teamObj: any) => {
      if (!key) return;
      teamsMap.set(key, teamObj);
      foundTeamsCache.current.set(key, teamObj);
    };

    // 1. Chave dedicada de times salvos no aparelho (futplay_registered_teams_v1)
    try {
      const stored = localStorage.getItem('futplay_registered_teams_v1');
      if (stored) {
        const list = JSON.parse(stored);
        if (Array.isArray(list)) {
          list.forEach((t: any) => {
            if (t && t.name) {
              const code = (t.inviteCode || '').trim();
              const key = normalizeCode(code || t.name);
              const mod = (t.modality || 'society') as TeamModality;
              const teamObj = {
                id: t.id || `team-${key}`,
                inviteCode: (code || key).toUpperCase(),
                name: t.name,
                city: t.city || 'Planalto - BA',
                neighborhood: t.neighborhood || 'Centro',
                crestUrl: t.crestUrl,
                modality: mod,
                modalityLabel: MODALITY_LABELS[mod] || 'Society',
                ownerName: t.ownerName || 'Treinador',
              };
              registerTeamInMap(key, teamObj);
              if (code) registerTeamInMap(code.toUpperCase(), teamObj);
              const namePrefix = normalizeCode(t.name).slice(0, 4);
              if (namePrefix) registerTeamInMap(namePrefix, teamObj);
            }
          });
        }
      }
    } catch {}

    // 2. Extrai times de todos os perfis cadastrados (profiles)
    profiles.forEach((p) => {
      const rawCode = (p.teamInviteCode || '').trim();
      const rawName = (p.teamName || '').trim();
      if (!rawName) return;

      const codeKey = rawCode
        ? normalizeCode(rawCode)
        : normalizeCode(rawName.slice(0, 4));

      let team = teamsMap.get(codeKey);
      const mod = (p.teamModality || 'society') as TeamModality;

      if (!team) {
        team = {
          id: `profile-${p.id}`,
          inviteCode: (rawCode || codeKey).toUpperCase(),
          name: rawName,
          city: p.teamCity || 'Planalto - BA',
          neighborhood: p.neighborhood || 'Centro',
          crestUrl: p.teamCrestUrl,
          modality: mod,
          modalityLabel: MODALITY_LABELS[mod] || 'Society',
          ownerName: p.displayName || 'Treinador',
        };
        registerTeamInMap(codeKey, team);
        if (rawCode) registerTeamInMap(rawCode.toUpperCase(), team);
        const namePrefix = normalizeCode(rawName).slice(0, 4);
        if (namePrefix) registerTeamInMap(namePrefix, team);
      } else {
        if (!team.crestUrl && p.teamCrestUrl) team.crestUrl = p.teamCrestUrl;
        if (p.isTeamOwner && p.displayName) team.ownerName = p.displayName;
      }
    });

    // 3. Extrai times de todas as contas de usuário (users)
    users.forEach((u) => {
      const rawCode = (u.teamInviteCode || '').trim();
      const rawName = (u.teamName || '').trim();
      if (!rawName) return;

      const codeKey = rawCode
        ? normalizeCode(rawCode)
        : normalizeCode(rawName.slice(0, 4));

      let team = teamsMap.get(codeKey);
      const mod = (u.teamModality || 'society') as TeamModality;

      if (!team) {
        team = {
          id: `user-${u.id}`,
          inviteCode: (rawCode || codeKey).toUpperCase(),
          name: rawName,
          city: u.teamCity || 'Planalto - BA',
          neighborhood: 'Centro',
          crestUrl: u.teamCrestUrl,
          modality: mod,
          modalityLabel: MODALITY_LABELS[mod] || 'Society',
          ownerName: u.email?.split('@')[0] || 'Treinador',
        };
        registerTeamInMap(codeKey, team);
        if (rawCode) registerTeamInMap(rawCode.toUpperCase(), team);
        const namePrefix = normalizeCode(rawName).slice(0, 4);
        if (namePrefix) registerTeamInMap(namePrefix, team);
      } else {
        if (!team.crestUrl && u.teamCrestUrl) team.crestUrl = u.teamCrestUrl;
      }
    });

    return Array.from(teamsMap.values());
  }, [profiles, users]);

  // Reconhecimento do time em tempo real: Time reconhecido NUNCA some
  const matchedTeam = useMemo(() => {
    const raw = regJoinCode.trim();
    if (!raw || raw.length < 2) return null;
    const clean = normalizeCode(raw);
    if (!clean) return null;

    // 1. Checa cache de times já encontrados
    const cached =
      foundTeamsCache.current.get(clean) ||
      foundTeamsCache.current.get(raw.toUpperCase()) ||
      (clean.length >= 4 ? foundTeamsCache.current.get(clean.slice(0, 4)) : undefined);
    if (cached) return cached;

    // 2. Procura na lista local completa (instantâneo, sem latência de rede)
    const local = allAvailableTeams.find((t) => {
      const tNorm = normalizeCode(t.inviteCode);
      const namePrefix = normalizeCode(t.name).slice(0, 4);
      return (
        tNorm === clean ||
        t.inviteCode.toUpperCase() === raw.toUpperCase() ||
        tNorm.replace(/[^a-zA-Z0-9]/g, '') === clean ||
        (clean.length >= 4 && namePrefix && (clean === namePrefix || clean.startsWith(namePrefix)))
      );
    });
    if (local) {
      foundTeamsCache.current.set(clean, local);
      return local;
    }

    // 3. Se não achou localmente, checa se já veio da consulta assíncrona ao Supabase
    if (asyncRemoteTeam) {
      const rNorm = normalizeCode(asyncRemoteTeam.inviteCode);
      const namePrefix = normalizeCode(asyncRemoteTeam.name).slice(0, 4);
      if (
        rNorm === clean ||
        asyncRemoteTeam.inviteCode.toUpperCase() === raw.toUpperCase() ||
        rNorm.replace(/[^a-zA-Z0-9]/g, '') === clean ||
        (clean.length >= 4 && namePrefix && (clean === namePrefix || clean.startsWith(namePrefix)))
      ) {
        foundTeamsCache.current.set(clean, asyncRemoteTeam);
        return asyncRemoteTeam;
      }
    }

    return null;
  }, [regJoinCode, allAvailableTeams, asyncRemoteTeam]);

  // Busca remota no Supabase apenas se o time não estiver em memória local (com proteção contra cancelamento)
  useEffect(() => {
    const raw = regJoinCode.trim();
    if (!raw || raw.length < 2) {
      setIsSearchingTeam(false);
      return;
    }

    const clean = normalizeCode(raw);
    if (!clean) {
      setIsSearchingTeam(false);
      return;
    }

    // Se já foi encontrado localmente ou no cache, nem precisa chamar a nuvem nem exibir loading
    const alreadyFound =
      foundTeamsCache.current.has(clean) ||
      allAvailableTeams.some((t) => {
        const tNorm = normalizeCode(t.inviteCode);
        const namePrefix = normalizeCode(t.name).slice(0, 4);
        return (
          tNorm === clean ||
          t.inviteCode.toUpperCase() === raw.toUpperCase() ||
          tNorm.replace(/[^a-zA-Z0-9]/g, '') === clean ||
          (clean.length >= 4 && namePrefix && clean.startsWith(namePrefix))
        );
      });

    if (alreadyFound) {
      setIsSearchingTeam(false);
      return;
    }

    let active = true;
    setIsSearchingTeam(true);

    const timer = setTimeout(async () => {
      try {
        if (isSupabaseConfigured()) {
          const remote = await supabaseService.findTeamByInviteCode(clean);
          if (active && remote) {
            foundTeamsCache.current.set(clean, remote);
            foundTeamsCache.current.set(normalizeCode(remote.inviteCode), remote);
            const prefix = normalizeCode(remote.name).slice(0, 4);
            if (prefix) foundTeamsCache.current.set(prefix, remote);
            setAsyncRemoteTeam(remote);
          }
        }
      } catch {
        // Ignora erro de conexão silenciosamente
      } finally {
        if (active) {
          setIsSearchingTeam(false);
        }
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [regJoinCode]);

  const handleCrestSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLoginError('Selecione uma imagem válida (PNG, JPG) para o escudo do time.');
      return;
    }

    setLoginError('');
    setIsUploadingCrest(true);
    try {
      const dataUrl = await processCrestTransparentPng(file);
      setRegTeamCrestUrl(dataUrl);
    } catch {
      setLoginError('Não foi possível processar a imagem do escudo.');
    } finally {
      setIsUploadingCrest(false);
    }
  };

  // Validações em tempo real se os campos de confirmação coincidem
  const isIdentifierMatching = useMemo(() => {
    const id1 = regIdentifier.trim();
    const id2 = regConfirmIdentifier.trim();
    if (!id1 || !id2) return null;
    const isEmail1 = id1.includes('@');
    const isEmail2 = id2.includes('@');
    if (isEmail1 || isEmail2) {
      return id1.toLowerCase() === id2.toLowerCase();
    }
    const d1 = id1.replace(/\D/g, '');
    const d2 = id2.replace(/\D/g, '');
    return d1 === d2;
  }, [regIdentifier, regConfirmIdentifier]);

  const isPasswordMatching = useMemo(() => {
    if (!regPassword || !regConfirmPassword) return null;
    return regPassword === regConfirmPassword;
  }, [regPassword, regConfirmPassword]);

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

      // 2. Match por telefone/WhatsApp (estritamente com no mínimo 8 dígitos para evitar falsos positivos)
      if (digits.length >= 8) {
        const userPhoneDigits = (u.whatsappNumber || '').replace(/\D/g, '');
        if (userPhoneDigits.length >= 8) {
          const uLast8 = userPhoneDigits.slice(-8);
          const inLast8 = digits.slice(-8);
          if (userPhoneDigits === digits || uLast8 === inLast8) {
            return true;
          }
        }

        // Se cadastrou com celular direto
        if (u.email && u.email.toLowerCase().startsWith(`${digits}@`)) {
          return true;
        }
      }

      // 3. Match por nome do atleta / apelido
      if (!isEmail && digits.length < 8 && trimmed.length >= 2) {
        const prof = profiles.find((p) => p.userId === u.id);
        if (prof?.displayName && prof.displayName.trim().toLowerCase() === trimmed.toLowerCase()) {
          return true;
        }
      }

      // 4. Fallback genérico de e-mail
      if (u.email.toLowerCase() === trimmed.toLowerCase()) {
        return true;
      }

      return false;
    });
  };

  const handleCompletePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const newPass = newResetPassword.trim();
    if (newPass.length < 6) {
      setLoginError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPass !== confirmResetPassword.trim()) {
      setLoginError('A confirmação da nova senha não confere com a nova senha digitada.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await supabaseService.completeMandatoryPasswordReset(newPass);
      if (!res.success) {
        setIsSubmitting(false);
        setLoginError(res.error || 'Falha ao redefinir credenciais no banco de dados.');
        return;
      }

      setIsSubmitting(false);
      setMustResetPassword(false);

      if (pendingUserToActivate) {
        await supabaseService.registerActiveSession(pendingUserToActivate.id);
        setActiveUserWithData(pendingUserToActivate, pendingProfileToActivate);
        try {
          localStorage.setItem('futplay_lite_auth_session_v3', 'true');
          localStorage.setItem('futplay_lite_active_user_id_v3', pendingUserToActivate.id);
        } catch {}
        notify(
          'success',
          'Senha Redefinida com Sucesso!',
          'Sua conta foi ativada com segurança e está pronta para uso.'
        );
        onAuthenticated();
      }
    } catch (err) {
      setIsSubmitting(false);
      setLoginError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setRecoverySuccessMsg('');

    const cleanPhone = recoveryPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      setLoginError('Informe o número de telefone celular cadastrado com DDD.');
      return;
    }

    if (!recoveryBirthDate) {
      setLoginError('Informe a data de nascimento cadastrada.');
      return;
    }

    if (recoveryNewPassword.length < 6) {
      setLoginError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (recoveryNewPassword !== recoveryConfirmPassword) {
      setLoginError('A confirmação da nova senha não confere com a nova senha digitada.');
      return;
    }

    setIsRecovering(true);
    try {
      const res = await supabaseService.recoverPasswordWithBirthdate({
        phone: cleanPhone,
        birthDate: recoveryBirthDate,
        newPassword: recoveryNewPassword,
      });

      setIsRecovering(false);
      if (!res.success) {
        setLoginError(res.error || 'Dados de identificação incorretos.');
        return;
      }

      setRecoverySuccessMsg('Senha redefinida com sucesso! Você já pode fazer login com a nova senha.');
      setMode('login');
      setLoginIdentifier(recoveryPhone);
      setLoginPassword('');
      setRecoveryNewPassword('');
      setRecoveryConfirmPassword('');
      notify('success', 'Senha Redefinida', 'Sua senha foi redefinida com sucesso. Faça login agora.');
    } catch (err) {
      setIsRecovering(false);
      setLoginError(err instanceof Error ? err.message : 'Falha ao redefinir senha.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const trimmed = loginIdentifier.trim();
    const digits = trimmed.replace(/\D/g, '');
    const isEmail = trimmed.includes('@');

    if (!isEmail && digits.length < 8 && trimmed.length < 2) {
      setLoginError('Informe seu e-mail, telefone celular com DDD ou apelido.');
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

    // 1. Autentica no Supabase Auth oficial (GoTrue + verificação de flag de redefinição)
    if (isSupabaseConfigured()) {
      try {
        const authResult = await supabaseService.signInWithSupabaseAuth(trimmed, loginPassword);
        if (!authResult.success) {
          setIsSubmitting(false);
          setLoginError(authResult.error || 'Credenciais inválidas.');
          return;
        }

        if (authResult.mustResetPassword && authResult.user) {
          setIsSubmitting(false);
          setPendingUserToActivate(authResult.user);
          setPendingProfileToActivate(authResult.profile);
          setMustResetPassword(true);
          return;
        }

        if (authResult.user) {
          existingUser = authResult.user;
          matchedProfile = authResult.profile;
          supabaseChecked = true;
        }
      } catch (err) {
        console.warn('Falha ao autenticar no Supabase Auth:', err);
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
      // Ativa o usuário e perfil no estado da liga e persiste sessão, preservando dados do time
      const localUser = findUserByIdentifier(trimmed);
      const localProfile = localUser
        ? profiles.find((p) => p.userId === localUser.id)
        : undefined;

      const isOwner =
        existingUser.isTeamOwner !== undefined
          ? existingUser.isTeamOwner
          : Boolean(localUser?.isTeamOwner || matchedProfile?.isTeamOwner || localProfile?.isTeamOwner);

      const finalTeamName = existingUser.teamName || localUser?.teamName || matchedProfile?.teamName || localProfile?.teamName;
      const finalTeamCode = existingUser.teamInviteCode || localUser?.teamInviteCode || matchedProfile?.teamInviteCode || localProfile?.teamInviteCode;
      const hasTeam = Boolean(
        (finalTeamName && finalTeamName !== 'Meu Time' && finalTeamName !== 'Sem Time') ||
        finalTeamCode
      );
      const isCompleted =
        existingUser.role === 'admin' ||
        isOwner ||
        hasTeam ||
        (existingUser.onboardingCompleted === true && (existingUser.onboardingStep || 1) >= 4);

      const finalUserToActivate: User = {
        ...existingUser,
        teamName: finalTeamName,
        teamCrestUrl: existingUser.teamCrestUrl || localUser?.teamCrestUrl || matchedProfile?.teamCrestUrl || localProfile?.teamCrestUrl,
        teamCity: existingUser.teamCity || localUser?.teamCity || matchedProfile?.teamCity || localProfile?.teamCity,
        teamModality: existingUser.teamModality || localUser?.teamModality || matchedProfile?.teamModality || localProfile?.teamModality,
        teamInviteCode: finalTeamCode,
        isTeamOwner: isOwner,
        role:
          existingUser.role === 'admin'
            ? 'admin'
            : isOwner || existingUser.role === 'coach'
            ? 'coach'
            : existingUser.role || 'player',
        onboardingCompleted: isCompleted,
        onboardingStep: isCompleted ? 4 : (existingUser.onboardingStep || 1),
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
            isTeamOwner: isOwner,
          }
        : localProfile;

      await supabaseService.registerActiveSession(finalUserToActivate.id);
      setActiveUserWithData(finalUserToActivate, finalProfileToActivate);
      try {
        localStorage.setItem('futplay_lite_auth_session_v3', 'true');
        localStorage.setItem('futplay_lite_active_user_id_v3', finalUserToActivate.id);
      } catch {}
      onAuthenticated();
      return;
    }

    setLoginError(
      'Conta ainda não cadastrada com este e-mail, telefone ou apelido. Toque em "Criar minha conta" abaixo para se cadastrar em segundos!'
    );
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

    // Valida se o apelido já existe localmente
    const nameUpper = trimmedName.toUpperCase();
    const isNickTakenLocally = profiles.some(
      (p) => p.displayName.trim().toUpperCase() === nameUpper
    );
    if (isNickTakenLocally) {
      setLoginError(
        `O apelido "${trimmedName}" já está cadastrado por outro atleta na liga. Por favor, escolha outro apelido ou adicione seu sobrenome.`
      );
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
      setLoginError(
        isEmail
          ? 'Confirme seu e-mail redigitando-o no campo de confirmação.'
          : 'Confirme seu telefone celular redigitando-o no campo de confirmação.'
      );
      return;
    }

    const identifiersMatch = isEmail
      ? trimmedIdentifier.toLowerCase() === trimmedConfirmIdentifier.toLowerCase()
      : digits === trimmedConfirmIdentifier.replace(/\D/g, '');

    if (!identifiersMatch) {
      setLoginError(
        isEmail
          ? 'Os e-mails informados não coincidem. Certifique-se de que foram preenchidos exatamente iguais.'
          : 'Os números de celular informados não coincidem. Certifique-se de que foram preenchidos exatamente iguais.'
      );
      return;
    }

    if (!regBirthDate.trim()) {
      setLoginError('Informe sua data de nascimento para segurança da conta.');
      return;
    }

    const birthDateObj = new Date(regBirthDate);
    const today = new Date();
    const age = today.getFullYear() - birthDateObj.getFullYear();
    if (isNaN(birthDateObj.getTime()) || birthDateObj >= today || age < 5 || age > 120) {
      setLoginError('Data de nascimento inválida. A idade deve estar entre 5 e 120 anos.');
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

    // Valida se o apelido já existe no banco Supabase
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: nickMatches } = await supabase
          .from('player_profiles')
          .select('id, display_name')
          .ilike('display_name', trimmedName)
          .limit(1);

        if (nickMatches && nickMatches.length > 0) {
          setIsSubmitting(false);
          setLoginError(
            `O apelido "${trimmedName}" já está cadastrado por outro atleta no banco da liga. Por favor, escolha outro apelido.`
          );
          return;
        }
      } catch {
        // Ignora falha de verificação remota
      }
    }

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

    // Validação da Equipe selecionada (passos integrados diretamente no cadastro)
    let finalTeamName: string | undefined;
    let finalTeamCrest: string | undefined;
    let finalTeamCity = 'Planalto - BA';
    let finalTeamModality: TeamModality = 'society';
    let finalTeamInviteCode: string | undefined;
    let finalIsOwner = false;
    let finalRole: UserRole = 'player';

    if (teamAction === 'create') {
      if (regTeamName.trim().length < 2) {
        setIsSubmitting(false);
        setLoginError('Informe o nome da sua equipe / pelada (mínimo 2 letras).');
        return;
      }
      finalTeamName = regTeamName.trim();
      finalTeamCrest = regTeamCrestUrl;
      finalTeamCity = regTeamCity.trim() || 'Planalto - BA';
      finalTeamModality = regTeamModality;
      finalTeamInviteCode = generatedOwnerCode;
      finalIsOwner = true;
      finalRole = 'coach';
    } else if (teamAction === 'join') {
      if (!regJoinCode.trim()) {
        setIsSubmitting(false);
        setLoginError('Informe o código de convite da sua equipe para entrar no elenco.');
        return;
      }
      if (!matchedTeam) {
        setIsSubmitting(false);
        setLoginError(`Nenhum time encontrado com o código "${regJoinCode.toUpperCase()}". Solicite o código correto ao treinador.`);
        return;
      }
      finalTeamName = matchedTeam.name;
      finalTeamCrest = matchedTeam.crestUrl;
      finalTeamCity = matchedTeam.city || 'Planalto - BA';
      finalTeamModality = matchedTeam.modality || 'society';
      finalTeamInviteCode = matchedTeam.inviteCode || regJoinCode.trim().toUpperCase();
      finalIsOwner = false;
      finalRole = 'player';
    }

    // Registra o novo atleta no estado da liga com os dados do time e sem passos posteriores
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
      teamName: finalTeamName,
      teamCity: finalTeamCity,
      teamCrestUrl: finalTeamCrest,
      teamModality: finalTeamModality,
      teamInviteCode: finalTeamInviteCode,
      isTeamOwner: finalIsOwner,
    });

    if (created) {
      // Sincroniza e aguarda explicitamente o salvamento no Supabase
      if (isSupabaseConfigured()) {
        const supUser: User = {
          id: created.userId,
          email: finalEmail,
          whatsappNumber: finalWhatsapp,
          role: finalRole,
          teamName: finalTeamName,
          teamCrestUrl: finalTeamCrest,
          teamCity: finalTeamCity,
          teamModality: finalTeamModality,
          teamInviteCode: finalTeamInviteCode,
          isTeamOwner: finalIsOwner,
          status: 'ativa',
          createdAt: new Date().toISOString(),
          onboardingStep: 4,
          onboardingCompleted: true,
        };
        const supProfile: PlayerProfile = {
          ...created,
          teamName: finalTeamName,
          teamCrestUrl: finalTeamCrest,
          teamCity: finalTeamCity,
          teamModality: finalTeamModality,
          teamInviteCode: finalTeamInviteCode,
          isTeamOwner: finalIsOwner,
        };
        try {
          const supSync = await supabaseService.registerAthleteInSupabase({
            user: supUser,
            profile: supProfile,
            password: regPassword.trim(),
            birthDate: regBirthDate.trim(),
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
          role: finalRole,
          teamName: finalTeamName,
          teamCrestUrl: finalTeamCrest,
          teamCity: finalTeamCity,
          teamModality: finalTeamModality,
          teamInviteCode: finalTeamInviteCode,
          isTeamOwner: finalIsOwner,
          status: 'ativa',
          createdAt: new Date().toISOString(),
          onboardingStep: 4,
          onboardingCompleted: true,
        },
        {
          ...created,
          teamName: finalTeamName,
          teamCrestUrl: finalTeamCrest,
          teamCity: finalTeamCity,
          teamModality: finalTeamModality,
          teamInviteCode: finalTeamInviteCode,
          isTeamOwner: finalIsOwner,
        }
      );

      try {
        localStorage.setItem('futplay_lite_auth_session_v3', 'true');
        localStorage.setItem('futplay_lite_active_user_id_v3', created.userId);
      } catch {}

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

          {mustResetPassword ? (
            /* FORMULÁRIO DE REDEFINIÇÃO OBRIGATÓRIA DE SENHA (ETAPA 5) */
            <form onSubmit={handleCompletePasswordReset} noValidate className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs">
                  <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Redefinição Obrigatória de Senha</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Por diretriz de integridade e segurança da liga, sua conta requer a definição de uma nova senha pessoal definitiva (mínimo 6 caracteres).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nova Senha Definitiva
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    value={confirmResetPassword}
                    onChange={(e) => setConfirmResetPassword(e.target.value)}
                    placeholder="Redigite a nova senha"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || newResetPassword.length < 6 || newResetPassword !== confirmResetPassword}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 py-3 text-xs font-black uppercase text-white shadow-md hover:from-blue-700 hover:to-blue-900 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Salvar Senha & Ativar Conta</span>
                  </>
                )}
              </button>
            </form>
          ) : mode === 'login' ? (
            /* FORMULÁRIO DE LOGIN COM E-MAIL OU TELEFONE E SENHA */
            <form onSubmit={handleLogin} noValidate className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  E-mail, Celular ou Apelido
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
                    placeholder="E-mail, (77) 99999-8888 ou Apelido"
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

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot_password');
                    setLoginError('');
                    setRecoverySuccessMsg('');
                    const clean = loginIdentifier.replace(/\D/g, '');
                    setRecoveryPhone(clean.length >= 8 ? formatIdentifierInput(clean) : '');
                  }}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                >
                  Esqueci minha senha
                </button>
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
                    setShowPassword(false);
                    setShowConfirmPassword(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Criar minha conta
                </button>
              </div>
            </form>
          ) : mode === 'forgot_password' ? (
            /* FORMULÁRIO DE RECUPERAÇÃO DE SENHA ESQUECIDA */
            <form onSubmit={handleRecoverPassword} noValidate className="space-y-3.5">
              <div className="text-center pb-1">
                <h3 className="text-sm font-bold text-slate-800">Recuperação de Acesso</h3>
                <p className="text-[11px] text-slate-500">
                  Informe o telefone e a data de nascimento cadastrados para criar uma nova senha.
                </p>
              </div>

              {recoverySuccessMsg && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{recoverySuccessMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Telefone Cadastrado (com DDD)
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={recoveryPhone}
                    onChange={(e) => setRecoveryPhone(formatIdentifierInput(e.target.value))}
                    placeholder="(77) 99999-8888"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Data de Nascimento Cadastrada
                </label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={recoveryBirthDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setRecoveryBirthDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nova Senha (mínimo 6 caracteres)
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showRecoveryNewPass ? 'text' : 'password'}
                    required
                    value={recoveryNewPassword}
                    onChange={(e) => setRecoveryNewPassword(e.target.value)}
                    placeholder="Digite a nova senha"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-10 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRecoveryNewPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showRecoveryNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={recoveryConfirmPassword}
                    onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isRecovering}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.99] transition cursor-pointer disabled:opacity-60"
              >
                {isRecovering ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Validando e redefinindo...</span>
                  </>
                ) : (
                  <>
                    <span>Redefinir Senha</span>
                    <ShieldCheck className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setLoginError('');
                    setRecoverySuccessMsg('');
                  }}
                  className="text-xs font-bold text-slate-600 hover:text-blue-600 hover:underline cursor-pointer"
                >
                  ← Voltar para o Login
                </button>
              </div>
            </form>
          ) : (
            /* FORMULÁRIO DE CRIAÇÃO DE CONTA DE ATLETA */
            <form onSubmit={handleCreateAccount} noValidate className="space-y-3.5">
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
                    className={`w-full rounded-xl border pl-10 pr-10 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none transition ${
                      isIdentifierMatching === true
                        ? 'border-emerald-500 bg-emerald-50/20 focus:border-emerald-600'
                        : isIdentifierMatching === false
                        ? 'border-rose-500 bg-rose-50/20 focus:border-rose-600'
                        : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                    }`}
                  />
                  {isIdentifierMatching === true && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-600 flex items-center pointer-events-none">
                      <Check className="h-4 w-4 stroke-[2.5]" />
                    </div>
                  )}
                  {isIdentifierMatching === false && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-rose-500 flex items-center pointer-events-none">
                      <AlertCircle className="h-4 w-4" />
                    </div>
                  )}
                </div>
                {isIdentifierMatching === true && (
                  <p className="mt-1 text-[10px] font-bold text-emerald-600 flex items-center gap-1 animate-in fade-in">
                    <Check className="h-3 w-3 stroke-[2.5]" />
                    {regIdentifier.includes('@') ? 'Os e-mails coincidem perfeitamente!' : 'Os telefones celulares coincidem perfeitamente!'}
                  </p>
                )}
                {isIdentifierMatching === false && (
                  <p className="mt-1 text-[10px] font-bold text-rose-600 flex items-center gap-1 animate-in fade-in">
                    <AlertCircle className="h-3 w-3" />
                    {regIdentifier.includes('@') ? 'Os e-mails digitados não coincidem.' : 'Os telefones celulares digitados não coincidem.'}
                  </p>
                )}
                {isIdentifierMatching === null && (
                  <p className="mt-1 text-[10px] text-slate-500">
                    Você usará este e-mail ou número de telefone para entrar na sua conta.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Data de Nascimento <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={regBirthDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setRegBirthDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none transition"
                  />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  🔒 Armazenada em cofre privado para segurança e recuperação de senha.
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
                    className={`w-full rounded-xl border pl-10 pr-10 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none transition ${
                      isPasswordMatching === true
                        ? 'border-emerald-500 bg-emerald-50/20 focus:border-emerald-600'
                        : isPasswordMatching === false
                        ? 'border-rose-500 bg-rose-50/20 focus:border-rose-600'
                        : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                    }`}
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
                {isPasswordMatching === true && (
                  <p className="mt-1 text-[10px] font-bold text-emerald-600 flex items-center gap-1 animate-in fade-in">
                    <Check className="h-3 w-3 stroke-[2.5]" />
                    As senhas coincidem!
                  </p>
                )}
                {isPasswordMatching === false && (
                  <p className="mt-1 text-[10px] font-bold text-rose-600 flex items-center gap-1 animate-in fade-in">
                    <AlertCircle className="h-3 w-3" />
                    As senhas não coincidem.
                  </p>
                )}
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

              {/* Vínculo com a Equipe / Baba (Passos integrados no cadastro) */}
              <div className="rounded-2xl border border-blue-200/90 bg-blue-50/40 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900">Vínculo com a Equipe / Baba</span>
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                    Obrigatório
                  </span>
                </div>

                {/* Seletor de Criar vs Entrar */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setTeamAction('create');
                      setLoginError('');
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      teamAction === 'create'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Crown className="h-3.5 w-3.5" />
                    <span>Criar Meu Time</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTeamAction('join');
                      setLoginError('');
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      teamAction === 'join'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Entrar com Código</span>
                  </button>
                </div>

                {/* Opção A: Criar Meu Time (Dono / Treinador) */}
                {teamAction === 'create' && (
                  <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nome da Equipe / Baba <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={regTeamName}
                        onChange={(e) => setRegTeamName(e.target.value)}
                        placeholder="Ex.: Paredão FC, Rosália Baba, Elite..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Modalidade
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {MODALITY_OPTIONS.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setRegTeamModality(m.id)}
                            className={`flex flex-col text-left p-2 rounded-xl border transition cursor-pointer ${
                              regTeamModality === m.id
                                ? 'border-blue-600 bg-blue-100/70 ring-1 ring-blue-600'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <span className="text-xs font-bold text-slate-800">{m.label}</span>
                            <span className="text-[10px] text-slate-500 line-clamp-1">{m.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Escudo / Brasão do Time (PNG Transparente Opcional) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Escudo do Time (Opcional)
                      </label>
                      <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200">
                        <div className="relative h-11 w-11 shrink-0 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                          {regTeamCrestUrl ? (
                            <img
                              src={regTeamCrestUrl}
                              alt="Escudo"
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <Shield className="h-5 w-5 text-blue-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <input
                            ref={crestInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleCrestSelect}
                            className="hidden"
                          />
                          <button
                            type="button"
                            disabled={isUploadingCrest}
                            onClick={() => crestInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            {isUploadingCrest ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ImagePlus className="h-3.5 w-3.5 text-blue-600" />
                            )}
                            <span>{regTeamCrestUrl ? 'Trocar Escudo' : 'Adicionar Escudo'}</span>
                          </button>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                            PNG transparente ou foto do escudo
                          </p>
                        </div>
                        {regTeamCrestUrl && (
                          <button
                            type="button"
                            onClick={() => setRegTeamCrestUrl(undefined)}
                            className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                            title="Remover escudo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Código de Convite Automático */}
                    <div className="rounded-xl border border-blue-200 bg-blue-100/50 p-2.5 flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                          Código de Convite do seu time:
                        </span>
                        <span className="text-sm font-extrabold text-blue-900 tracking-wider">
                          {generatedOwnerCode}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-blue-700 bg-white px-2 py-0.5 rounded-md">
                        Treinador / Dono
                      </span>
                    </div>
                  </div>
                )}

                {/* Opção B: Entrar com Código de Convite */}
                {teamAction === 'join' && (
                  <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Código de Convite da Equipe <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={regJoinCode}
                          onChange={(e) => setRegJoinCode(e.target.value.toUpperCase())}
                          placeholder="Ex.: TIME-84, PARE-12"
                          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 uppercase tracking-wider focus:border-blue-600 focus:outline-none transition"
                        />
                        {isSearchingTeam && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-600" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Peça o código de convite ao dono ou treinador do seu time.
                      </p>
                    </div>

                    {/* Card de Time Reconhecido */}
                    {matchedTeam ? (
                      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 flex items-center gap-3 animate-in fade-in">
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-white border border-emerald-200 flex items-center justify-center overflow-hidden">
                          {matchedTeam.crestUrl ? (
                            <img
                              src={matchedTeam.crestUrl}
                              alt={matchedTeam.name}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <Shield className="h-5 w-5 text-emerald-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-emerald-950 truncate">
                              {matchedTeam.name}
                            </span>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          </div>
                          <span className="block text-[10px] text-emerald-700 truncate">
                            Treinador: {matchedTeam.ownerName || 'Oficial'} · {matchedTeam.city || 'Planalto - BA'}
                          </span>
                        </div>
                      </div>
                    ) : regJoinCode.trim().length >= 3 && !isSearchingTeam ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 flex items-center gap-2 text-xs text-amber-800">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                        <span className="text-[11px]">Nenhum time encontrado com esse código ainda.</span>
                      </div>
                    ) : null}
                  </div>
                )}
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
                    setShowPassword(false);
                    setShowConfirmPassword(false);
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
