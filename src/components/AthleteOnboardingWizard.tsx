import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  ImagePlus,
  KeyRound,
  Link2,
  Lock,
  MapPin,
  MessageCircle,
  PlusCircle,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { RosaliaCrest } from './RosaliaCrest';
import { getDivisionBadgeStyle } from '../lib/engine/eloEngine';
import { PlayerPosition, TeamModality } from '../types/league';

interface AthleteOnboardingWizardProps {
  onCompleteWizard: () => void;
}

interface RosterMemberPreview {
  id: string;
  name: string;
  position: PlayerPosition;
  rating: number;
  divisionName: 'Bronze' | 'Prata' | 'Ouro' | 'Platina' | 'Diamante';
  avatarUrl?: string;
  isCaptain?: boolean;
}

interface RegisteredTeamInfo {
  id: string;
  inviteCode: string;
  name: string;
  city: string;
  neighborhood: string;
  foundedYear: string;
  crestUrl?: string;
  crestColor: string;
  modality: TeamModality;
  modalityLabel: string;
  ownerName: string;
  roster: RosterMemberPreview[];
}

const DEFAULT_TEAMS_PLANALTO: RegisteredTeamInfo[] = [];

const MODALITY_OPTIONS: Array<{
  id: TeamModality;
  title: string;
  subtitle: string;
}> = [
  {
    id: 'society',
    title: 'Society',
    subtitle: 'Gramado sintético · 6v6 / 7v7',
  },
  {
    id: 'futsal',
    title: 'Futsal',
    subtitle: 'Quadra esportiva · 5v5',
  },
  {
    id: 'futebol_areia',
    title: 'Futebol de Areia',
    subtitle: 'Quadra de areia · Beach Soccer',
  },
  {
    id: 'futebol_campo',
    title: 'Futebol de Campo',
    subtitle: 'Campo oficial · 11v11',
  },
];

const MODALITY_LABELS: Record<TeamModality, string> = {
  society: 'Society',
  futsal: 'Futsal',
  futebol_areia: 'Futebol de Areia',
  futebol_campo: 'Futebol de Campo',
};

/**
 * Brasão Transparente em SVG para os times que não possuem PNG customizado,
 * garantindo que sempre apareça apenas o brasão sem fundo quadrado.
 */
const TransparentTeamShieldSvg: React.FC<{
  name: string;
  color?: string;
  size?: number;
}> = ({ name, color = '#1D4ED8', size = 76 }) => {
  const initials = name.trim().slice(0, 2).toUpperCase() || 'FC';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 112"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-sm shrink-0"
    >
      <path
        d="M50 4L92 19.5V54C92 81 73.5 100.5 50 108C26.5 100.5 8 81 8 54V19.5L50 4Z"
        fill={color}
        stroke="#FFFFFF"
        strokeWidth="4"
      />
      <path
        d="M50 12L84 24.5V53.5C84 75 68.5 91.5 50 98.5C31.5 91.5 16 75 16 53.5V24.5L50 12Z"
        fill="#FFFFFF"
        fillOpacity="0.14"
      />
      <circle
        cx="50"
        cy="48"
        r="21"
        fill="#FFFFFF"
        stroke={color}
        strokeWidth="2.5"
      />
      <text
        x="50"
        y="55"
        textAnchor="middle"
        fill={color}
        fontSize="19"
        fontWeight="900"
        fontFamily="Oswald, sans-serif"
      >
        {initials}
      </text>
      <path
        d="M50 76L52.3 80.7L57.5 81.4L53.7 85L54.6 90.2L50 87.7L45.4 90.2L46.3 85L42.5 81.4L47.7 80.7L50 76Z"
        fill="#FACC15"
      />
    </svg>
  );
};

/**
 * Redimensiona a foto de perfil para 320x320.
 */
function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem inválido.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 320;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;

        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

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

export const AthleteOnboardingWizard: React.FC<
  AthleteOnboardingWizardProps
> = ({ onCompleteWizard }) => {
  const {
    profiles,
    divisions,
    currentUser,
    currentPlayerProfile,
    saveOnboardingStep1,
    saveOnboardingStep2,
    saveOnboardingStep3,
  } = useLeague();

  const initialStep = useMemo<1 | 2 | 3>(() => {
    const step = currentUser.onboardingStep || 1;
    if (step === 3) return 3;
    if (step === 2) return 2;
    return 1;
  }, [currentUser.onboardingStep]);

  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(initialStep);

  // ============================================================================
  // ESTADOS DO PASSO 1 (Nome reconhecido + Foto de Perfil)
  // ============================================================================
  const recognizedName =
    currentPlayerProfile?.displayName ||
    currentUser.email.split('@')[0] ||
    '';

  const [displayName, setDisplayName] = useState<string>(recognizedName);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
    currentPlayerProfile?.avatarUrl || currentUser.avatarUrl
  );
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);

  // ============================================================================
  // ESTADOS DO PASSO 2 (Criar Meu Time vs Entrar no Time com Código)
  // ============================================================================
  const [teamAction, setTeamAction] = useState<'create' | 'join'>(
    currentPlayerProfile?.isTeamOwner === false ? 'join' : 'create'
  );
  const [teamName, setTeamName] = useState<string>(
    currentPlayerProfile?.teamName || ''
  );
  const [teamCity, setTeamCity] = useState<string>(
    currentPlayerProfile?.teamCity || 'Planalto - BA'
  );
  const [teamCrestUrl, setTeamCrestUrl] = useState<string | undefined>(
    currentPlayerProfile?.teamCrestUrl
  );
  const [teamModality, setTeamModality] = useState<TeamModality>(
    currentPlayerProfile?.teamModality || 'society'
  );
  const [isUploadingCrest, setIsUploadingCrest] = useState<boolean>(false);

  // Posição selecionada pelo atleta para o elenco (Goleiro vs Linha)
  const [selectedPosition, setSelectedPosition] = useState<PlayerPosition>(
    currentPlayerProfile?.position || 'atacante'
  );

  // Código gerado para o dono do time
  const [ownerInviteSuffix] = useState<number>(() =>
    Math.floor(10 + Math.random() * 89)
  );
  const generatedOwnerCode = useMemo(() => {
    if (currentPlayerProfile?.teamInviteCode && teamAction === 'create') {
      return currentPlayerProfile.teamInviteCode;
    }
    const prefix =
      teamName
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 4)
        .toUpperCase() || 'TIME';
    return `${prefix}-${ownerInviteSuffix}`;
  }, [
    teamName,
    ownerInviteSuffix,
    currentPlayerProfile?.teamInviteCode,
    teamAction,
  ]);

  // Código digitado pelo jogador que escolhe "Integrar um Time já Existente"
  const [joinInviteCode, setJoinInviteCode] = useState<string>('');
  const [pendingTeamToConfirm, setPendingTeamToConfirm] =
    useState<RegisteredTeamInfo | null>(null);

  // ============================================================================
  // ESTADOS DO PASSO 3 (Convidar Jogadores OU Confirmar Entrada no Time)
  // ============================================================================
  const [activeInviteCode, setActiveInviteCode] = useState<string>(
    currentPlayerProfile?.teamInviteCode || ''
  );
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [baseAppUrl, setBaseAppUrl] = useState<string>(
    typeof window !== 'undefined' ? window.location.origin : ''
  );

  const [error, setError] = useState<string>('');

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const crestInputRef = useRef<HTMLInputElement | null>(null);

  // Busca a URL pública ativa para montar o link de convite compartilhável
  useEffect(() => {
    let mounted = true;
    fetch('/api/mobile-url')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data?.publicUrl) {
          setBaseAppUrl(data.publicUrl);
        }
      })
      .catch(() => {
        // Fallback para window.location.origin
      });

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get('convite');
      if (urlCode) {
        setTeamAction('join');
        setJoinInviteCode(urlCode.toUpperCase());
      }
    }

    return () => {
      mounted = false;
    };
  }, []);

  // Lista unificada de times (times criados por usuários + times oficiais de Planalto - BA)
  const allAvailableTeams = useMemo<RegisteredTeamInfo[]>(() => {
    const customTeams: RegisteredTeamInfo[] = [];
    profiles.forEach((p) => {
      if (p.teamName && p.teamInviteCode && p.isTeamOwner) {
        const mod = p.teamModality || 'society';
        // Busca todos os perfis que já estão vinculados a esse código de time
        const teamMembers: RosterMemberPreview[] = profiles
          .filter(
            (member) =>
              member.teamInviteCode?.toUpperCase() ===
              p.teamInviteCode?.toUpperCase()
          )
          .map((member) => {
            const div = divisions.find(
              (d) => d.id === member.currentDivisionId
            );
            return {
              id: member.id,
              name: member.displayName,
              position: member.position,
              rating: member.currentRating,
              divisionName: div?.name || 'Bronze',
              avatarUrl: member.avatarUrl,
              isCaptain: member.id === p.id,
            };
          });

        customTeams.push({
          id: `custom-${p.id}`,
          inviteCode: p.teamInviteCode.toUpperCase(),
          name: p.teamName,
          city: p.teamCity || 'Planalto - BA',
          neighborhood: p.neighborhood || 'Centro',
          foundedYear: '2026',
          crestUrl: p.teamCrestUrl,
          crestColor: '#1D4ED8',
          modality: mod,
          modalityLabel: MODALITY_LABELS[mod],
          ownerName: p.displayName,
          roster: teamMembers,
        });
      }
    });
    return [...customTeams, ...DEFAULT_TEAMS_PLANALTO];
  }, [profiles, divisions]);

  // Verifica se o código digitado encontra um time válido
  const matchedTeamByCode = useMemo<RegisteredTeamInfo | undefined>(() => {
    const cleaned = joinInviteCode.trim().toUpperCase();
    if (!cleaned) return undefined;
    return allAvailableTeams.find(
      (t) =>
        t.inviteCode.toUpperCase() === cleaned ||
        t.inviteCode.replace('-', '').toUpperCase() ===
          cleaned.replace('-', '')
    );
  }, [joinInviteCode, allAvailableTeams]);

  const isJoinCodeEntered = joinInviteCode.trim().length > 0;
  const isJoinCodeRecognized = Boolean(matchedTeamByCode);
  const isJoinCodeWrong = isJoinCodeEntered && !isJoinCodeRecognized;

  // Upload de Foto de Perfil (Passo 1)
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem válido (JPG, PNG ou WEBP).');
      return;
    }

    setError('');
    setIsUploadingAvatar(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setAvatarUrl(dataUrl);
    } catch {
      setError('Não foi possível processar a foto selecionada.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Upload do Escudo do Time (Passo 2 - Preserva PNG Transparente)
  const handleCrestSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Selecione uma imagem válida para o escudo do time.');
      return;
    }

    setError('');
    setIsUploadingCrest(true);
    try {
      const dataUrl = await processCrestTransparentPng(file);
      setTeamCrestUrl(dataUrl);
    } catch {
      setError('Não foi possível processar o escudo selecionado.');
    } finally {
      setIsUploadingCrest(false);
    }
  };

  // Salvar Passo 1 -> Ir para o Passo 2
  const handleSubmitStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (displayName.trim().length < 2) {
      setError('Digite seu nome ou apelido com pelo menos 2 letras.');
      return;
    }

    const ok = saveOnboardingStep1({
      displayName: displayName.trim(),
      avatarUrl,
    });

    if (ok) {
      setActiveStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Salvar Passo 2 ->
  // - Se "create": salva o novo time e vai para o Passo 3 (Convidar Jogadores)
  // - Se "join": valida o código e vai para a Página de Confirmação do Time (Passo 3) mostrando Brasão, Informações e Elenco!
  const handleSubmitStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (teamAction === 'create') {
      if (teamName.trim().length < 2) {
        setError('Informe o nome do seu time (mínimo 2 letras).');
        return;
      }
      if (teamCity.trim().length < 2) {
        setError('Informe a cidade do seu time.');
        return;
      }

      const finalCode = generatedOwnerCode;
      const ok = saveOnboardingStep2({
        mode: 'create',
        teamName: teamName.trim(),
        teamCity: teamCity.trim(),
        teamCrestUrl,
        teamModality,
        teamInviteCode: finalCode,
        position: selectedPosition,
      });

      if (ok) {
        setPendingTeamToConfirm(null);
        setActiveInviteCode(finalCode);
        setActiveStep(3);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    // Se escolheu "Integrar um Time já Existente" -> confirma diretamente nesta mesma página!
    if (!joinInviteCode.trim()) {
      setError(
        'Digite o código de convite fornecido pelo dono do seu time para continuar.'
      );
      return;
    }

    if (!matchedTeamByCode) {
      setError(
        `Nenhum time encontrado com o código "${joinInviteCode.toUpperCase()}". Solicite o código correto ao dono do time.`
      );
      return;
    }

    // Salva a entrada oficial no time e conclui o primeiro acesso sem precisar ir para outra página
    const ok = saveOnboardingStep2({
      mode: 'join',
      teamName: matchedTeamByCode.name,
      teamCity: matchedTeamByCode.city,
      teamCrestUrl: matchedTeamByCode.crestUrl,
      teamModality: matchedTeamByCode.modality,
      teamInviteCode: matchedTeamByCode.inviteCode,
      position: selectedPosition,
    });

    if (ok) {
      saveOnboardingStep3();
      onCompleteWizard();
    }
  };

  // Confirmar entrada oficial no time após visualizar o Brasão, Informações e Elenco na Página de Confirmação
  const handleConfirmJoinTeamOnStep3 = () => {
    const target = pendingTeamToConfirm || matchedTeamByCode;
    if (!target) return;

    const ok = saveOnboardingStep2({
      mode: 'join',
      teamName: target.name,
      teamCity: target.city,
      teamCrestUrl: target.crestUrl,
      teamModality: target.modality,
      teamInviteCode: target.inviteCode,
      position: selectedPosition,
    });

    if (ok) {
      saveOnboardingStep3();
      onCompleteWizard();
    }
  };

  // Dados ativos do time para exibir no Passo 3 quando o usuário criou seu próprio time
  const finalTeamName =
    teamName.trim() || currentPlayerProfile?.teamName || 'Meu Time';
  const finalTeamCity =
    teamCity.trim() || currentPlayerProfile?.teamCity || 'Planalto - BA';
  const finalTeamCrest = teamCrestUrl || currentPlayerProfile?.teamCrestUrl;
  const finalTeamModality =
    teamModality || currentPlayerProfile?.teamModality || 'society';
  const finalInviteCode =
    activeInviteCode ||
    currentPlayerProfile?.teamInviteCode ||
    generatedOwnerCode;

  const teamInviteLink = `${baseAppUrl}/?convite=${encodeURIComponent(
    finalInviteCode
  )}&time=${encodeURIComponent(finalTeamName)}`;

  const whatsappInviteMessage = `⚽ *CONVOCAÇÃO OFICIAL — FUTPLAY LITE*\n\nVocê foi convidado para jogar no time *${finalTeamName}* (${MODALITY_LABELS[finalTeamModality]} · ${finalTeamCity}) na Liga de Planalto - BA!\n\n🔑 *Código do Time:* ${finalInviteCode}\n👉 *Link direto para entrar no elenco:*\n${teamInviteLink}`;

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(finalInviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard?.writeText(teamInviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Convite para o time ${finalTeamName} · FutPlay Lite`,
          text: `Entre para o time ${finalTeamName} usando o código ${finalInviteCode}!`,
          url: teamInviteLink,
        });
        return;
      } catch {
        // Fallback
      }
    }
    handleCopyInviteLink();
  };

  const handleFinishOwnerStep3 = () => {
    const ok = saveOnboardingStep3();
    if (ok) {
      onCompleteWizard();
    }
  };

  const initials = (displayName.trim() || 'FP').slice(0, 2).toUpperCase();
  const teamInitials = (finalTeamName || 'TM').slice(0, 2).toUpperCase();

  const teamToConfirm = pendingTeamToConfirm || matchedTeamByCode;
  const isJoinConfirmationScreen =
    activeStep === 3 && (teamAction === 'join' || !!pendingTeamToConfirm);

  return (
    <div className="min-h-dvh w-full bg-slate-50 text-slate-900 flex flex-col justify-between">
      <div className="mx-auto w-full max-w-[430px] px-4 py-6 space-y-4">
        {/* Cabeçalho dos 3 Passos de Primeiro Acesso (Branco & Azul Limpo) */}
        <div className="rounded-3xl bg-gradient-to-br from-blue-700 to-blue-900 p-5 text-white shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-100">
              <Sparkles className="h-3.5 w-3.5 text-white" />
              Passo {activeStep} de 3 · Primeiro Acesso
            </span>
            <img
              src="/favicon.png"
              alt="FutPlay Lite"
              className="h-8 w-8 object-contain rounded-lg drop-shadow-md"
            />
          </div>

          <div>
            <h1 className="font-display text-xl font-extrabold tracking-wide text-white uppercase">
              {activeStep === 1
                ? 'SEU PERFIL DE ATLETA'
                : activeStep === 2
                  ? 'SUA EQUIPE NA LIGA'
                  : isJoinConfirmationScreen
                    ? 'CONFIRMAÇÃO DA EQUIPE'
                    : 'CONVIDAR JOGADORES'}
            </h1>
            <p className="text-xs text-blue-100/90 mt-0.5">
              {activeStep === 1
                ? 'Confirme como seu nome e sua foto aparecerão na Liga de Planalto - BA.'
                : activeStep === 2
                  ? 'Fundar um novo time ou defender uma equipe que já está em campo?'
                  : isJoinConfirmationScreen
                    ? 'Confira o brasão, as informações do time e o elenco antes de confirmar seu ingresso.'
                    : `Compartilhe o código e o link oficial para convocar atletas para o ${finalTeamName}.`}
            </p>
          </div>

          {/* Barra Visual dos 3 Passos de Primeiro Acesso */}
          <div className="pt-1">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((step) => {
                const isCurrent = step === activeStep;
                const isDone = step < activeStep;
                return (
                  <div key={step} className="space-y-1 text-center">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        isCurrent
                          ? 'bg-white shadow-xs'
                          : isDone
                            ? 'bg-blue-300'
                            : 'bg-white/25'
                      }`}
                    />
                    <span
                      className={`block text-[10px] font-bold ${
                        isCurrent
                          ? 'text-white'
                          : isDone
                            ? 'text-blue-200'
                            : 'text-blue-200/60'
                      }`}
                    >
                      {step}º Passo
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* PASSO 1 DE 5: NOME RECONHECIDO + UPLOAD DE FOTO DE PERFIL             */}
        {/* ===================================================================== */}
        {activeStep === 1 && (
          <form
            onSubmit={handleSubmitStep1}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5"
          >
            {/* 1. Upload de Foto de Perfil */}
            <div className="flex flex-col items-center text-center space-y-3">
              <span className="text-xs font-bold text-slate-700">
                Foto de Perfil do Atleta
              </span>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="group relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-blue-300 bg-blue-50/70 shadow-sm hover:border-blue-600 transition"
                  title="Enviar foto de perfil"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Foto de perfil"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-blue-700">
                      <span className="font-display text-2xl font-extrabold">
                        {initials}
                      </span>
                      <span className="mt-1 text-[10px] font-semibold text-blue-600">
                        Adicionar Foto
                      </span>
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1.5 -right-1.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md hover:bg-blue-700 transition"
                  title="Escolher foto"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>

              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarSelect}
                className="hidden"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 border border-blue-200 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition"
                >
                  <ImagePlus className="h-4 w-4" />
                  {isUploadingAvatar
                    ? 'Carregando foto...'
                    : avatarUrl
                      ? 'Trocar Foto'
                      : 'Fazer Upload de Foto'}
                </button>

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(undefined)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remover
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* 2. Reconhecimento Automático do Nome + Caixa Editável */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  Seu Nome ou Apelido no App
                </label>
                {recognizedName && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
                    <CheckCircle2 className="h-3 w-3 text-blue-600" />
                    Reconhecido da conta
                  </span>
                )}
              </div>

              <div className="relative">
                <UserCheck className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Digite seu nome ou apelido esportivo..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-3 text-sm font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Reconhecemos automaticamente <strong>{recognizedName}</strong>{' '}
                da sua conta ({currentUser.email}). Você pode manter assim ou
                redigitar na caixa acima como preferir ser chamado.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.99] transition"
            >
              <span>Confirmar e Ir para o 2º Passo</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}

        {/* ===================================================================== */}
        {/* PASSO 2 DE 5: CRIAR MEU TIME OU DIGITAR CÓDIGO DO TIME                */}
        {/* ===================================================================== */}
        {activeStep === 2 && (
          <form
            onSubmit={handleSubmitStep2}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
          >
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Como você vai participar?
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Crie seu time ou entre com o código do elenco:
              </p>
            </div>

            {/* 2 Opções lado a lado com mesmo design dos cards de Partidas/Súmulas */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Opção 1: Fundar / Criar Meu Time */}
              <button
                type="button"
                onClick={() => {
                  setTeamAction('create');
                  setError('');
                }}
                className={`p-3 rounded-2xl border text-left transition active:scale-[0.98] cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                  teamAction === 'create'
                    ? 'bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 border-blue-400 text-white shadow-md ring-2 ring-blue-500/30'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`p-2 rounded-xl ${
                      teamAction === 'create'
                        ? 'bg-white/20 text-white'
                        : 'bg-blue-50 text-blue-700 border border-blue-100'
                    }`}
                  >
                    <PlusCircle className="h-4 w-4" />
                  </div>
                  <span
                    className={`text-[10px] font-black uppercase rounded-full px-2 py-0.5 ${
                      teamAction === 'create'
                        ? 'bg-white/25 text-white'
                        : 'bg-blue-50 text-blue-700 border border-blue-100'
                    }`}
                  >
                    Treinador
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <h3
                      className={`text-xs font-black uppercase tracking-tight ${
                        teamAction === 'create' ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      Criar Time
                    </h3>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        teamAction === 'create'
                          ? 'bg-blue-500/40 text-blue-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      Dono
                    </span>
                  </div>
                  <p
                    className={`text-[10px] mt-1 leading-snug ${
                      teamAction === 'create' ? 'text-blue-100' : 'text-slate-500'
                    }`}
                  >
                    Funde sua equipe e gerencie o elenco
                  </p>
                </div>
              </button>

              {/* Opção 2: Integrar um Time já Existente via Código */}
              <button
                type="button"
                onClick={() => {
                  setTeamAction('join');
                  setError('');
                }}
                className={`p-3 rounded-2xl border text-left transition active:scale-[0.98] cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                  teamAction === 'join'
                    ? 'bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 border-amber-300 text-white shadow-md ring-2 ring-amber-400/30'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`p-2 rounded-xl ${
                      teamAction === 'join'
                        ? 'bg-white/25 text-white'
                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}
                  >
                    <Users className="h-4 w-4" />
                  </div>
                  <span
                    className={`text-[10px] font-black uppercase rounded-full px-2 py-0.5 ${
                      teamAction === 'join'
                        ? 'bg-white/25 text-white'
                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}
                  >
                    Jogador
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <h3
                      className={`text-xs font-black uppercase tracking-tight ${
                        teamAction === 'join' ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      Entrar no Time
                    </h3>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        teamAction === 'join'
                          ? 'bg-amber-400/40 text-amber-100'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      Código
                    </span>
                  </div>
                  <p
                    className={`text-[10px] mt-1 leading-snug ${
                      teamAction === 'join' ? 'text-amber-100' : 'text-slate-500'
                    }`}
                  >
                    Entre no elenco com o código do dono
                  </p>
                </div>
              </button>
            </div>

            {/* ================================================================= */}
            {/* FORMULÁRIO ABERTO NO MESMO PASSO: CRIAR MEU TIME                  */}
            {/* ================================================================= */}
            {teamAction === 'create' && (
              <div className="rounded-2xl border border-blue-100 bg-slate-50/80 p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                  <span className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-blue-600" />
                    Dados do Seu Novo Time
                  </span>
                  <span className="text-[10px] font-semibold text-blue-600">
                    Dono / Capitão
                  </span>
                </div>

                {/* 1. Upload do Escudo do Time (Quando enviado, exibe SOMENTE o brasão transparente sem caixa/borda) */}
                <div className="flex items-center gap-3.5">
                  <button
                    type="button"
                    onClick={() => crestInputRef.current?.click()}
                    className={
                      teamCrestUrl
                        ? 'relative flex h-20 w-20 shrink-0 items-center justify-center bg-transparent transition hover:scale-105'
                        : 'relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-blue-300 bg-white shadow-xs hover:border-blue-600 transition'
                    }
                    title="Enviar escudo do time"
                  >
                    {teamCrestUrl ? (
                      <img
                        src={teamCrestUrl}
                        alt="Brasão do time"
                        className="h-20 w-20 object-contain drop-shadow-sm"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-blue-700">
                        <Shield className="h-6 w-6 text-blue-600" />
                        <span className="mt-0.5 text-[9px] font-bold">
                          {teamInitials}
                        </span>
                      </div>
                    )}
                  </button>

                  <input
                    ref={crestInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCrestSelect}
                    className="hidden"
                  />

                  <div className="space-y-1.5">
                    <span className="block text-xs font-bold text-slate-800">
                      Brasão do Time (PNG Transparente)
                    </span>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Ao enviar em PNG sem fundo, apenas o brasão aparecerá.
                    </p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => crestInputRef.current?.click()}
                        disabled={isUploadingCrest}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-blue-700 transition"
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        {isUploadingCrest
                          ? 'Carregando...'
                          : teamCrestUrl
                            ? 'Trocar Brasão'
                            : 'Upload de Brasão'}
                      </button>
                      {teamCrestUrl && (
                        <button
                          type="button"
                          onClick={() => setTeamCrestUrl(undefined)}
                          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-red-600"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Nome do Time */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome do Time *
                  </label>
                  <div className="relative">
                    <Trophy className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600" />
                    <input
                      type="text"
                      required
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Ex.: Real Planalto FC, Unidos do Centro..."
                      className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 3. Cidade do Time */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cidade *
                  </label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600" />
                    <input
                      type="text"
                      required
                      value={teamCity}
                      onChange={(e) => setTeamCity(e.target.value)}
                      placeholder="Ex.: Planalto - BA"
                      className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 4. Tipo / Modalidade do Time */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Modalidade do Time *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {MODALITY_OPTIONS.map((mod) => {
                      const selected = teamModality === mod.id;
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => setTeamModality(mod.id)}
                          className={`flex flex-col justify-between rounded-xl border p-2.5 text-left transition ${
                            selected
                              ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                              : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold">
                              {mod.title}
                            </span>
                            {selected && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-white shrink-0" />
                            )}
                          </div>
                          <span
                            className={`mt-1 text-[10px] leading-tight ${
                              selected ? 'text-blue-100' : 'text-slate-500'
                            }`}
                          >
                            {mod.subtitle}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Posição do Dono / Atleta no Time */}
                <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">
                      Sua Posição no Elenco *
                    </label>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 border border-blue-200 px-2 py-0.5 rounded-full">
                      {selectedPosition === 'goleiro' ? '🧤 Goleiro' : `🏃 ${selectedPosition}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedPosition('goleiro')}
                      className={`flex items-center gap-1.5 rounded-lg border py-1.5 px-2 text-left transition ${
                        selectedPosition === 'goleiro'
                          ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300'
                      }`}
                    >
                      <span className="text-lg shrink-0">🧤</span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-black leading-tight">Goleiro</div>
                        <div className={`text-[9px] leading-tight ${selectedPosition === 'goleiro' ? 'text-blue-100' : 'text-slate-500'}`}>Paredão · GK</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPosition('atacante')}
                      className={`flex items-center gap-1.5 rounded-lg border py-1.5 px-2 text-left transition ${
                        selectedPosition === 'atacante'
                          ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300'
                      }`}
                    >
                      <span className="text-lg shrink-0">⚡</span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-black leading-tight">Atacante</div>
                        <div className={`text-[9px] leading-tight ${selectedPosition === 'atacante' ? 'text-blue-100' : 'text-slate-500'}`}>Linha · Gols</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPosition('meio-campista')}
                      className={`flex items-center gap-1.5 rounded-lg border py-1.5 px-2 text-left transition ${
                        selectedPosition === 'meio-campista'
                          ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300'
                      }`}
                    >
                      <span className="text-lg shrink-0">🎯</span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-black leading-tight">Meia</div>
                        <div className={`text-[9px] leading-tight ${selectedPosition === 'meio-campista' ? 'text-blue-100' : 'text-slate-500'}`}>Linha · Criação</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPosition('defensor')}
                      className={`flex items-center gap-1.5 rounded-lg border py-1.5 px-2 text-left transition ${
                        selectedPosition === 'defensor'
                          ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300'
                      }`}
                    >
                      <span className="text-lg shrink-0">🛡️</span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-black leading-tight">Defensor</div>
                        <div className={`text-[9px] leading-tight ${selectedPosition === 'defensor' ? 'text-blue-100' : 'text-slate-500'}`}>Linha · Marcação</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* FORMULÁRIO ABERTO NO MESMO PASSO: DIGITAR CÓDIGO DO TIME          */}
            {/* ================================================================= */}
            {teamAction === 'join' && (
              <div className="rounded-2xl border border-blue-100 bg-slate-50/80 p-4 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                  <span className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4 text-blue-600" />
                    Ingressar com Código do Time
                  </span>
                  <span className="text-[10px] font-semibold text-blue-600">
                    Convite Oficial
                  </span>
                </div>

                {/* 1. Campo de Código do Time (Subido para cima do card de posições) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Código do Time *
                  </label>
                  <div className="relative">
                    <KeyRound
                      className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors ${
                        isJoinCodeRecognized
                          ? 'text-emerald-600'
                          : isJoinCodeWrong
                          ? 'text-rose-500'
                          : 'text-blue-600'
                      }`}
                    />
                    <input
                      type="text"
                      required
                      value={joinInviteCode}
                      onChange={(e) => {
                        setError('');
                        setJoinInviteCode(e.target.value.toUpperCase());
                      }}
                      placeholder="Ex.: REAL-77"
                      className={`w-full rounded-xl border pl-10 pr-10 py-3 font-mono text-sm font-extrabold uppercase tracking-wider text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 transition-colors focus:outline-none ${
                        isJoinCodeRecognized
                          ? 'border-emerald-500 bg-emerald-50/20 focus:border-emerald-600'
                          : isJoinCodeWrong
                          ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500'
                          : 'border-slate-200 bg-white focus:border-blue-600'
                      }`}
                    />
                    {isJoinCodeRecognized && (
                      <CheckCircle2 className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600 animate-fadeIn" />
                    )}
                    {isJoinCodeWrong && (
                      <AlertCircle className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-500 animate-fadeIn" />
                    )}
                  </div>

                  {/* Mensagem abaixo da caixa se o código estiver errado */}
                  {isJoinCodeWrong && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-rose-600 animate-fadeIn">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                      <span>Código de time não encontrado. Verifique e tente novamente.</span>
                    </div>
                  )}

                  {!isJoinCodeEntered && (
                    <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
                      Informe o código para carregar o elenco e definir sua posição.
                    </p>
                  )}
                </div>

                {/* Brasão e Informações do Time (Exibido imediatamente abaixo da caixa de código ao reconhecer) */}
                {isJoinCodeRecognized && matchedTeamByCode && (
                  <div className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-50/60 to-white p-3.5 shadow-xs space-y-2.5 animate-fadeIn">
                    <div className="flex items-center gap-3">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white p-1 border border-emerald-100 shadow-2xs">
                        {matchedTeamByCode.crestUrl ? (
                          <img
                            src={matchedTeamByCode.crestUrl}
                            alt={matchedTeamByCode.name}
                            className="h-14 w-14 object-contain drop-shadow-sm"
                          />
                        ) : (
                          <TransparentTeamShieldSvg
                            name={matchedTeamByCode.name}
                            color={matchedTeamByCode.crestColor}
                            size={52}
                          />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200/80 px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            #{matchedTeamByCode.inviteCode}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            {matchedTeamByCode.modalityLabel}
                          </span>
                        </div>
                        <h3 className="font-display text-base font-extrabold text-slate-900 uppercase tracking-wide truncate mt-0.5">
                          {matchedTeamByCode.name}
                        </h3>
                        <p className="text-[11px] font-medium text-slate-500 truncate flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                          {matchedTeamByCode.city} · {matchedTeamByCode.roster.length} jogadores no elenco
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Seleção de Posição no Elenco (Abaixo da caixa de código, liberada ao reconhecer) */}
                <div
                  className={`rounded-xl border p-3 space-y-2 transition-all duration-300 ${
                    isJoinCodeRecognized
                      ? 'border-blue-200/90 bg-white shadow-xs ring-1 ring-blue-500/10'
                      : 'border-slate-200/70 bg-slate-100/60 opacity-40 pointer-events-none select-none grayscale-[40%]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Sua Posição no Elenco *</span>
                    </label>
                    {isJoinCodeRecognized ? (
                      <span className="text-[10px] font-extrabold text-blue-700 bg-blue-100/70 border border-blue-200 px-2 py-0.5 rounded-full animate-fadeIn">
                        {selectedPosition === 'goleiro'
                          ? '🧤 Goleiro'
                          : `🏃 ${selectedPosition.charAt(0).toUpperCase() + selectedPosition.slice(1)}`}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 border border-slate-300/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" />
                        Aguardando código
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] leading-snug">
                    {isJoinCodeRecognized ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                        Código reconhecido! Selecione sua função no time:
                      </span>
                    ) : (
                      <span className="text-slate-500">
                        🔒 Digite o código do time acima para liberar a seleção de posição:
                      </span>
                    )}
                  </p>

                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    {/* Goleiro */}
                    <button
                      type="button"
                      disabled={!isJoinCodeRecognized}
                      onClick={() => setSelectedPosition('goleiro')}
                      className={`flex items-center gap-1.5 rounded-lg border py-1.5 px-2 text-left transition ${
                        selectedPosition === 'goleiro'
                          ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300'
                      }`}
                    >
                      <span className="text-lg shrink-0">🧤</span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-black leading-tight">Goleiro</div>
                        <div
                          className={`text-[9px] leading-tight ${
                            selectedPosition === 'goleiro'
                              ? 'text-blue-100'
                              : 'text-slate-500'
                          }`}
                        >
                          Tipo Goleiro · Súmula
                        </div>
                      </div>
                    </button>

                    {/* Atacante */}
                    <button
                      type="button"
                      disabled={!isJoinCodeRecognized}
                      onClick={() => setSelectedPosition('atacante')}
                      className={`flex items-center gap-1.5 rounded-lg border py-1.5 px-2 text-left transition ${
                        selectedPosition === 'atacante'
                          ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300'
                      }`}
                    >
                      <span className="text-lg shrink-0">⚡</span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-black leading-tight">Atacante</div>
                        <div
                          className={`text-[9px] leading-tight ${
                            selectedPosition === 'atacante'
                              ? 'text-blue-100'
                              : 'text-slate-500'
                          }`}
                        >
                          Linha · Finalizador
                        </div>
                      </div>
                    </button>

                    {/* Meio-campista */}
                    <button
                      type="button"
                      disabled={!isJoinCodeRecognized}
                      onClick={() => setSelectedPosition('meio-campista')}
                      className={`flex items-center gap-1.5 rounded-lg border py-1.5 px-2 text-left transition ${
                        selectedPosition === 'meio-campista'
                          ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300'
                      }`}
                    >
                      <span className="text-lg shrink-0">🎯</span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-black leading-tight">Meia</div>
                        <div
                          className={`text-[9px] leading-tight ${
                            selectedPosition === 'meio-campista'
                              ? 'text-blue-100'
                              : 'text-slate-500'
                          }`}
                        >
                          Linha · Criação
                        </div>
                      </div>
                    </button>

                    {/* Defensor */}
                    <button
                      type="button"
                      disabled={!isJoinCodeRecognized}
                      onClick={() => setSelectedPosition('defensor')}
                      className={`flex items-center gap-1.5 rounded-lg border py-1.5 px-2 text-left transition ${
                        selectedPosition === 'defensor'
                          ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300'
                      }`}
                    >
                      <span className="text-lg shrink-0">🛡️</span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-black leading-tight">Defensor</div>
                        <div
                          className={`text-[9px] leading-tight ${
                            selectedPosition === 'defensor'
                              ? 'text-blue-100'
                              : 'text-slate-500'
                          }`}
                        >
                          Linha · Marcação
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            {/* Botões de Navegação do Passo 2 */}
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setActiveStep(1);
                }}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white py-3.5 px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>

              <button
                type="submit"
                disabled={teamAction === 'join' && !isJoinCodeRecognized}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3.5 px-4 text-xs font-bold transition shadow-sm ${
                  teamAction === 'create' || isJoinCodeRecognized
                    ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.99]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {teamAction === 'join' && isJoinCodeRecognized ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                <span>
                  {teamAction === 'create'
                    ? 'Criar Meu Time e Avançar'
                    : isJoinCodeRecognized && matchedTeamByCode
                    ? `Confirmar Entrada no ${matchedTeamByCode.name}`
                    : 'Digite o Código do Time para Entrar'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* ===================================================================== */}
        {/* PASSO 3 DE 5 (OPÇÃO A - JOIN): PÁGINA DE CONFIRMAÇÃO DO TIME          */}
        {/* Mostra Brasão Transparente, Informações do Time e Elenco Completo     */}
        {/* ===================================================================== */}
        {isJoinConfirmationScreen && teamToConfirm && (
          <div className="space-y-4">
            {/* 1. Card de Identidade e Brasão do Time */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-center space-y-3">
              <div className="mx-auto flex items-center justify-center">
                {teamToConfirm.crestUrl ? (
                  <img
                    src={teamToConfirm.crestUrl}
                    alt={teamToConfirm.name}
                    className="h-24 w-24 object-contain drop-shadow-sm"
                  />
                ) : (
                  <TransparentTeamShieldSvg
                    name={teamToConfirm.name}
                    color={teamToConfirm.crestColor}
                    size={84}
                  />
                )}
              </div>

              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-3 py-0.5 font-mono text-[11px] font-extrabold text-blue-700">
                  CÓDIGO #{teamToConfirm.inviteCode}
                </span>
                <h2 className="mt-2 font-display text-2xl font-extrabold text-slate-900 uppercase tracking-wide">
                  {teamToConfirm.name}
                </h2>
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  {teamToConfirm.city} · Bairro {teamToConfirm.neighborhood}
                </p>
              </div>

              {/* Grade 2x2 de Informações do Time */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 text-left">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Modalidade Oficial
                  </span>
                  <span className="mt-0.5 text-xs font-extrabold text-blue-700 block">
                    {teamToConfirm.modalityLabel}
                  </span>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Dono / Capitão
                  </span>
                  <span className="mt-0.5 text-xs font-extrabold text-slate-900 truncate block">
                    {teamToConfirm.ownerName}
                  </span>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Cidade Sede
                  </span>
                  <span className="mt-0.5 text-xs font-bold text-slate-800 block">
                    {teamToConfirm.city}
                  </span>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Atletas no Elenco
                  </span>
                  <span className="mt-0.5 text-xs font-extrabold text-slate-900 block">
                    {teamToConfirm.roster.length} jogadores ativos
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Card do Elenco Atual do Time */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-blue-600" />
                  Elenco Oficial · {teamToConfirm.name}
                </h3>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
                  {teamToConfirm.roster.length} atletas
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {/* Linha de destaque mostrando o próprio usuário que vai integrar o elenco */}
                <div className="py-2.5 first:pt-0 flex items-center justify-between gap-2.5 rounded-xl bg-blue-50/70 px-3 mb-2 border border-blue-200">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-600 font-display text-xs font-extrabold text-white">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-blue-950 truncate">
                          {displayName || recognizedName} (Você)
                        </span>
                      </div>
                      <div className="text-[10px] font-semibold text-blue-700">
                        {selectedPosition === 'goleiro'
                          ? '🧤 Goleiro Oficial'
                          : `🏃 Jogador de Linha (${selectedPosition.toUpperCase()})`}{' '}
                        · Novo Integrante
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-[9px] font-black uppercase text-white shrink-0">
                    {selectedPosition === 'goleiro' ? '🧤 Goleiro' : selectedPosition}
                  </span>
                </div>

                {/* Jogadores Atuais do Time */}
                {teamToConfirm.roster.map((member) => {
                  const divStyle = getDivisionBadgeStyle(member.divisionName);
                  return (
                    <div
                      key={member.id}
                      className="py-2.5 last:pb-0 flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 border border-slate-200 font-display text-xs font-bold text-blue-800">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={member.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            member.name.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {member.name}
                            </span>
                            {member.isCaptain && (
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-blue-800">
                                Capitão
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 capitalize">
                            {member.position}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          {member.position}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Confirmação / Ajuste de Posição Escolhida */}
            <div className="rounded-2xl border border-blue-200 bg-white p-3.5 space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Sua Posição no Time:
                </span>
                <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full capitalize">
                  {selectedPosition === 'goleiro' ? '🧤 Goleiro' : `🏃 ${selectedPosition}`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Você pode alternar sua posição antes de confirmar sua entrada:
              </p>
              <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                {(
                  [
                    { pos: 'goleiro', icon: '🧤', label: 'Goleiro' },
                    { pos: 'atacante', icon: '⚡', label: 'Atacante' },
                    { pos: 'meio-campista', icon: '🎯', label: 'Meia' },
                    { pos: 'defensor', icon: '🛡️', label: 'Defensor' },
                  ] as const
                ).map(({ pos, icon, label }) => {
                  const isSelected = selectedPosition === pos;
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setSelectedPosition(pos as PlayerPosition)}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-[10px] font-bold transition ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white shadow-xs ring-1 ring-blue-600'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-base">{icon}</span>
                      <span className="mt-0.5 truncate">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Botões de Confirmação de Entrada no Time */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setPendingTeamToConfirm(null);
                  setActiveStep(2);
                }}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white py-3.5 px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Outro Código
              </button>

              <button
                type="button"
                onClick={handleConfirmJoinTeamOnStep3}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.99] transition"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Confirmar Entrada no {teamToConfirm.name}</span>
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* PASSO 3 DE 5 (OPÇÃO B - CREATE): CONVIDAR JOGADORES PARA O SEU TIME   */}
        {/* ===================================================================== */}
        {activeStep === 3 && !isJoinConfirmationScreen && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
            {/* Resumo do Time Criado */}
            <div className="flex items-center gap-3.5 rounded-2xl border border-blue-100 bg-blue-50/70 p-3.5">
              {finalTeamCrest ? (
                <img
                  src={finalTeamCrest}
                  alt={finalTeamName}
                  className="h-14 w-14 shrink-0 object-contain drop-shadow-sm"
                />
              ) : (
                <TransparentTeamShieldSvg
                  name={finalTeamName}
                  color="#1D4ED8"
                  size={56}
                />
              )}

              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                  <CheckCircle2 className="h-3 w-3 text-blue-600" />
                  Equipe Pronta para Convocação
                </span>
                <h2 className="text-base font-extrabold text-slate-900 truncate">
                  {finalTeamName}
                </h2>
                <p className="text-xs text-slate-600 truncate">
                  {MODALITY_LABELS[finalTeamModality]} · {finalTeamCity}
                </p>
              </div>
            </div>

            {/* 1. Código do Time para Compartilhar */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <KeyRound className="h-4 w-4 text-blue-600" />
                  Código do Time para Compartilhar
                </span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                  Acesso Direto
                </span>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Envie este código aos jogadores do seu elenco. Ao digitarem este
                código, eles verão a página do <strong>{finalTeamName}</strong>{' '}
                e confirmarão a entrada:
              </p>

              <div className="flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-2xs">
                <span className="font-mono text-xl font-extrabold tracking-widest text-blue-800">
                  {finalInviteCode}
                </span>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-[0.98] transition"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar Código
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 2. Link Convidando o Jogador para o Seu Time */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Link2 className="h-4 w-4 text-blue-600" />
                  Link de Convite para o Seu Time
                </span>
                <UserPlus className="h-4 w-4 text-blue-600" />
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Ou compartilhe o link direto convidando o jogador para o{' '}
                <strong>{finalTeamName}</strong>:
              </p>

              <div className="rounded-xl border border-slate-200 bg-white p-3 font-mono text-[11px] font-semibold text-blue-700 break-all select-all">
                {teamInviteLink}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-white py-2.5 px-3 text-xs font-bold text-blue-700 hover:bg-blue-50 transition"
                >
                  {copiedLink ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" />
                      Link Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar Link
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleShareNative}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  <Share2 className="h-4 w-4 text-blue-600" />
                  Compartilhar
                </button>
              </div>

              {/* Botão Direto para Enviar Convite no WhatsApp */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(whatsappInviteMessage)}`}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 px-4 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Enviar Convite no WhatsApp</span>
              </a>
            </div>

            {/* Botões de Navegação do Passo 3 */}
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setActiveStep(2);
                }}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white py-3.5 px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>

              <button
                type="button"
                onClick={handleFinishOwnerStep3}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 px-4 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-[0.99] transition"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Concluir e Entrar no App</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
