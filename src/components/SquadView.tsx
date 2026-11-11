import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Check,
  ChevronRight,
  Copy,
  Edit3,
  ImagePlus,
  MapPin,
  MessageCircle,
  Share2,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { AthleteProfileAndCardView } from './AthleteProfileAndCardView';
import { PlayerRatingModal } from './PlayerRatingModal';
import { TeamCrestBadge } from './TeamCrestBadge';
import { PlayerProfile, TeamModality } from '../types/league';
import { processCrestTransparentPng } from '../lib/utils/imageProcessors';

interface SquadViewProps {
  initialPlayerId?: string;
}

const MODALITY_LABELS: Record<TeamModality, string> = {
  society: 'Society 7x7',
  futsal: 'Futsal 5x5',
  futebol_areia: 'Futebol de Areia',
  futebol_campo: 'Futebol de Campo 11x11',
};

export const SquadView: React.FC<SquadViewProps> = ({ initialPlayerId }) => {
  const {
    profiles,
    seasonEntries,
    divisions,
    cities,
    selectedCityId,
    selectedSeasonId,
    currentUser,
    currentPlayerProfile,
    updatePlayerSkills,
    updateTeamInfo,
    peerEvaluations,
    monthlyPayments,
    notify,
  } = useLeague();

  const isCoach =
    currentUser?.role === 'coach' ||
    currentUser?.isTeamOwner === true ||
    currentPlayerProfile?.isTeamOwner === true ||
    currentUser?.role === 'admin';

  // Nome do time ativo
  const userTeamName =
    currentUser?.teamName ||
    currentPlayerProfile?.teamName ||
    'Meu Time';

  const isDemoTeamName =
    userTeamName.trim().toLowerCase() === 'real planalto fc';

  // Brasão do time
  const userTeamCrest =
    currentUser?.teamCrestUrl ||
    currentPlayerProfile?.teamCrestUrl ||
    profiles.find(
      (p) =>
        p.teamName &&
        p.teamName.toLowerCase() === userTeamName.toLowerCase() &&
        p.teamCrestUrl
    )?.teamCrestUrl;

  const activeCity =
    cities?.find((c) => c.id === selectedCityId) ||
    cities?.[0] || { name: 'Planalto', stateCode: 'BA' };

  // Perfil do técnico da equipe
  const coachProfile = profiles.find(
    (p) =>
      (p.teamName &&
        userTeamName !== 'Meu Time' &&
        p.teamName.toLowerCase() === userTeamName.toLowerCase() &&
        p.isTeamOwner) ||
      (p.userId === currentUser.id && isCoach)
  );

  const coachName =
    coachProfile?.displayName ||
    (isCoach
      ? currentPlayerProfile?.displayName || currentUser?.email.split('@')[0]
      : 'Comissão Técnica');

  const teamModality: TeamModality =
    currentUser?.teamModality ||
    currentPlayerProfile?.teamModality ||
    'society';

  const teamInviteCode =
    currentUser?.teamInviteCode ||
    currentPlayerProfile?.teamInviteCode ||
    profiles.find(
      (p) =>
        p.teamName &&
        p.teamName.toLowerCase() === userTeamName.toLowerCase() &&
        p.teamInviteCode
    )?.teamInviteCode ||
    `${userTeamName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'TIME'}-10`;

  // Estados locais
  const [inspectingPlayerId, setInspectingPlayerId] = useState<
    string | undefined
  >(() => {
    if (initialPlayerId) return initialPlayerId;
    try {
      return sessionStorage.getItem('futplay_squad_inspecting_id_v1') || undefined;
    } catch {
      return undefined;
    }
  });

  useEffect(() => {
    try {
      if (inspectingPlayerId) {
        sessionStorage.setItem('futplay_squad_inspecting_id_v1', inspectingPlayerId);
      } else {
        sessionStorage.removeItem('futplay_squad_inspecting_id_v1');
      }
    } catch {}
  }, [inspectingPlayerId]);
  const [ratingModalPlayer, setRatingModalPlayer] = useState<
    PlayerProfile | null
  >(null);

  // Estados do Modal "Editar Time"
  const [isEditingTeam, setIsEditingTeam] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>(
    userTeamName === 'Meu Time' ? '' : userTeamName
  );
  const [editCity, setEditCity] = useState<string>(
    currentUser?.teamCity || currentPlayerProfile?.teamCity || 'Planalto - BA'
  );
  const [editModality, setEditModality] = useState<TeamModality>(teamModality);
  const [editCrestUrl, setEditCrestUrl] = useState<string | undefined>(
    userTeamCrest
  );
  const [isUploadingCrest, setIsUploadingCrest] = useState<boolean>(false);
  const [editError, setEditError] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const crestInputRef = useRef<HTMLInputElement | null>(null);

  // Lista exclusiva dos atletas que pertencem ao time vinculado à conta
  const displayedPlayers = useMemo(() => {
    if (!userTeamName || userTeamName === 'Meu Time' || userTeamName === 'Sem Time') {
      return currentPlayerProfile ? [currentPlayerProfile] : [];
    }
    const target = userTeamName.trim().toLowerCase();
    const matches = profiles.filter(
      (p) => (p.teamName || '').trim().toLowerCase() === target
    );
    if (matches.length === 0 && currentPlayerProfile) {
      return [currentPlayerProfile];
    }
    return matches.sort((a, b) => b.currentRating - a.currentRating);
  }, [profiles, userTeamName, currentPlayerProfile]);

  const counts = useMemo(() => {
    return {
      total: displayedPlayers.length,
      atacante: displayedPlayers.filter((p) => p.position === 'atacante').length,
      meia: displayedPlayers.filter((p) => p.position === 'meio-campista').length,
      defensor: displayedPlayers.filter((p) => p.position === 'defensor').length,
      goleiro: displayedPlayers.filter((p) => p.position === 'goleiro').length,
    };
  }, [displayedPlayers]);

  const getPlayerDisplayStars = (player: PlayerProfile): number => {
    if (player.overallStars && player.overallStars > 0) {
      return player.overallStars;
    }
    if (player.skills) {
      const s = player.skills;
      const sum =
        (s.finalizacao || 0) +
        (s.marcacao || 0) +
        (s.passe || 0) +
        (s.raca || 0) +
        (s.drible || 0);
      const avg = sum / 5;
      if (avg > 0) return Number(avg.toFixed(1));
    }
    return 0;
  };

  const handleCrestUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setEditError('Selecione uma imagem válida (JPG, PNG ou WEBP).');
      return;
    }

    setEditError('');
    setIsUploadingCrest(true);
    try {
      const dataUrl = await processCrestTransparentPng(file);
      setEditCrestUrl(dataUrl);
    } catch {
      setEditError('Não foi possível processar a imagem do escudo.');
    } finally {
      setIsUploadingCrest(false);
    }
  };

  const handleSaveTeam = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');

    if (editName.trim().length < 2) {
      setEditError('Informe o nome do seu time (mínimo 2 letras).');
      return;
    }

    const ok = updateTeamInfo({
      teamName: editName.trim(),
      teamCity: editCity.trim(),
      teamModality: editModality,
      teamCrestUrl: editCrestUrl,
    });

    if (ok) {
      setIsEditingTeam(false);
    }
  };

  // Links de convite para o elenco do time
  const baseAppUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://futplaylite.vercel.app';

  const teamInviteLink = `${baseAppUrl}/?convite=${encodeURIComponent(
    teamInviteCode
  )}&time=${encodeURIComponent(userTeamName)}`;

  const whatsappMessage = `⚽ *CONVOCAÇÃO OFICIAL — FUTPLAY LITE*\n\nVocê foi convidado para jogar no time *${userTeamName}* (${MODALITY_LABELS[teamModality]} · ${activeCity.name}/${activeCity.stateCode})!\n\n🔑 *Código do Time:* ${teamInviteCode}\n👉 *Link direto para entrar no elenco:*\n${teamInviteLink}`;

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(teamInviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(teamInviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, '_blank');
  };

  if (inspectingPlayerId) {
    return (
      <div className="space-y-3">
        <AthleteProfileAndCardView
          key={inspectingPlayerId}
          initialPlayerId={inspectingPlayerId}
          onBack={() => setInspectingPlayerId(undefined)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Aviso amigável caso a equipe esteja com o nome demo anterior */}
      {isCoach && isDemoTeamName && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-amber-900 shadow-xs flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-800">
              <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Personalize seu Time</span>
            </div>
            <p className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed">
              Sua conta de técnico está vinculada ao time de demonstração <strong>Real Planalto FC</strong>. Defina o nome real e o brasão da sua equipe.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditName('');
              setIsEditingTeam(true);
            }}
            className="shrink-0 rounded-xl bg-amber-500 hover:bg-amber-400 text-blue-950 font-black text-xs px-3 py-2 shadow-xs transition active:scale-95 cursor-pointer"
          >
            Editar Time
          </button>
        </div>
      )}

      {/* Card Oficial do Time com Brasão e Informações (Padrão Oficial com Estádio) */}
      <div className="w-full rounded-2xl border border-blue-200/80 bg-gradient-to-b from-blue-700 via-blue-800 to-blue-950 p-4 text-white shadow-md relative overflow-hidden">
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

        <div className="relative z-10 space-y-3.5">
          {/* Cabeçalho do Card: Brasão, Nome, Cidade e Ações */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <TeamCrestBadge
                name={userTeamName}
                crestUrl={userTeamCrest}
                size={56}
                className="shrink-0 drop-shadow-xl"
              />

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-amber-400/20 text-amber-300 border border-amber-300/30 px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wide flex items-center gap-0.5">
                    <Trophy className="h-2.5 w-2.5 text-amber-300" />
                    Time Oficial
                  </span>
                  <span className="text-[10px] text-blue-200 font-medium">
                    {activeCity.name}/{activeCity.stateCode}
                  </span>
                </div>

                <h1 className="text-base sm:text-lg font-black text-amber-300 font-display uppercase tracking-wide truncate mt-0.5">
                  {userTeamName}
                </h1>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-blue-100/90 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3 text-amber-400" />
                    {MODALITY_LABELS[teamModality]}
                  </span>
                  <span>·</span>
                  <span className="text-white font-semibold">
                    Técnico: {coachName}
                  </span>
                </div>
              </div>
            </div>

            {/* Botão de Edição do Time (para Técnicos / Donos) */}
            {isCoach && (
              <button
                type="button"
                onClick={() => {
                  setEditName(userTeamName === 'Meu Time' ? '' : userTeamName);
                  setEditCity(currentUser?.teamCity || activeCity.name);
                  setEditModality(teamModality);
                  setEditCrestUrl(userTeamCrest);
                  setIsEditingTeam(true);
                }}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 px-2.5 py-1.5 text-[11px] font-bold text-white transition active:scale-95 cursor-pointer backdrop-blur-xs"
                title="Editar Nome e Brasão do Time"
              >
                <Edit3 className="h-3.5 w-3.5 text-amber-300" />
                <span className="hidden sm:inline">Editar Time</span>
              </button>
            )}
          </div>

          {/* Barra de Código de Convite & Compartilhamento */}
          <div className="rounded-xl bg-white/10 backdrop-blur-xs p-2.5 border border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] uppercase font-bold text-blue-200">
                Código do Time:
              </span>
              <span className="font-mono text-xs font-black text-amber-300 tracking-wider bg-black/30 px-2 py-0.5 rounded-md border border-amber-300/30">
                {teamInviteCode}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 px-2 py-1 text-[10px] font-bold text-white transition active:scale-95 cursor-pointer"
                title="Copiar Código de Convite"
              >
                {copiedCode ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3 text-blue-200" />
                )}
                <span>{copiedCode ? 'Copiado!' : 'Copiar'}</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 text-[10px] font-black transition active:scale-95 cursor-pointer shadow-xs"
                title="Convidar atletas via WhatsApp"
              >
                <MessageCircle className="h-3 w-3 fill-white" />
                <span>Convidar</span>
              </button>
            </div>
          </div>

          {/* Métricas e Distribuição do Elenco */}
          <div className="grid grid-cols-4 gap-2 text-center pt-1 border-t border-white/10">
            <div className="rounded-xl bg-white/10 backdrop-blur-xs p-1.5 border border-white/5">
              <div className="font-mono text-sm sm:text-base font-black text-white">
                {counts.atacante}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-blue-200">
                Atacantes
              </div>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-xs p-1.5 border border-white/5">
              <div className="font-mono text-sm sm:text-base font-black text-white">
                {counts.meia}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-blue-200">
                Meias
              </div>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-xs p-1.5 border border-white/5">
              <div className="font-mono text-sm sm:text-base font-black text-white">
                {counts.defensor}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-blue-200">
                Defensores
              </div>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur-xs p-1.5 border border-white/5">
              <div className="font-mono text-sm sm:text-base font-black text-white">
                {counts.goleiro}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-blue-200">
                Goleiros
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Título da Lista: Atletas do Elenco */}
      <div className="flex items-center justify-between px-1 pt-1">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
          <Users className="h-4 w-4 text-blue-600" />
          <span>Atletas do Time ({displayedPlayers.length})</span>
        </div>
      </div>

      {/* Lista de Atletas */}
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {displayedPlayers.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 space-y-2">
            <Users className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="font-semibold">Nenhum jogador encontrado no elenco.</p>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              Compartilhe o código de convite <strong>{teamInviteCode}</strong> com seus atletas no WhatsApp para que eles ingressem no elenco do seu time.
            </p>
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 shadow-xs transition active:scale-95 cursor-pointer mt-2"
            >
              <MessageCircle className="h-3.5 w-3.5 fill-white" />
              <span>Convidar Atletas no WhatsApp</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {displayedPlayers.map((player) => {
              const positionLabel =
                player.position === 'goleiro'
                  ? '🧤 Goleiro'
                  : `🏃 ${player.position.charAt(0).toUpperCase() + player.position.slice(1)}`;

              return (
                <div
                  key={player.id}
                  onClick={() => setInspectingPlayerId(player.id)}
                  className="w-full px-2.5 py-2 flex items-center justify-between gap-2.5 text-left hover:bg-slate-50 active:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="shrink-0 flex items-center justify-center">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-blue-50 border border-blue-100 font-display text-xs font-bold text-blue-700 shadow-2xs">
                        {player.avatarUrl ? (
                          <img
                            src={player.avatarUrl}
                            alt={player.displayName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          player.displayName.slice(0, 2).toUpperCase()
                        )}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate uppercase">
                          {player.displayName}
                        </span>
                        {player.isTeamOwner && (
                          <span className="rounded bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.2 uppercase">
                            Técnico
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        <span>{positionLabel}</span>
                        {player.dominantFoot && (
                          <span> · Pé {player.dominantFoot}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(() => {
                      const isSelf =
                        player.id === currentPlayerProfile?.id ||
                        player.userId === currentUser.id;
                      const hasEvaluated = (peerEvaluations || []).some(
                        (e) =>
                          (e.evaluatorId === currentUser.id ||
                            e.evaluatorId === currentPlayerProfile?.id) &&
                          e.targetPlayerId === player.id
                      );
                      const stars = getPlayerDisplayStars(player);

                      // Se já classificou ou é o próprio atleta: exibe somente as estrelas (média geral)
                      if (hasEvaluated || isSelf) {
                        return (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setRatingModalPlayer(player);
                            }}
                            className="font-mono text-[11px] font-black text-amber-500 flex items-center justify-end gap-1 hover:opacity-80 active:scale-95 transition cursor-pointer"
                            title={
                              isSelf
                                ? 'Minhas estrelas atuais'
                                : 'Você já avaliou este atleta. Clique para ver ou editar.'
                            }
                          >
                            <span>{stars > 0 ? stars.toFixed(1) : '0.0'}</span>
                            <Star
                              className={`h-3.5 w-3.5 ${
                                stars > 0
                                  ? 'fill-amber-400 text-amber-500'
                                  : 'text-slate-300'
                              }`}
                            />
                          </div>
                        );
                      }

                      // Se ainda não classificou este jogador: exibe o botão dourado Classificar
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRatingModalPlayer(player);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-blue-950 px-2.5 py-1 text-[10px] font-black shadow-2xs hover:shadow-xs active:scale-95 transition cursor-pointer"
                          title="Classificar os 5 quesitos deste atleta"
                        >
                          <Star className="h-3 w-3 text-blue-950 fill-blue-950" />
                          <span>Classificar</span>
                        </button>
                      );
                    })()}

                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Editar Informações do Time */}
      {isEditingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
                  <Edit3 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Configurações do Time
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Edite o nome oficial, brasão e modalidade
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingTeam(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 font-medium">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveTeam} className="space-y-3.5">
              {/* Brasão do Time */}
              <div className="flex flex-col items-center gap-2 pb-2">
                <div className="relative group">
                  <TeamCrestBadge
                    name={editName || 'Meu Time'}
                    crestUrl={editCrestUrl}
                    size={72}
                    className="drop-shadow-md"
                  />
                  <button
                    type="button"
                    onClick={() => crestInputRef.current?.click()}
                    disabled={isUploadingCrest}
                    className="absolute -bottom-1 -right-1 rounded-full bg-blue-600 p-2 text-white shadow-md hover:bg-blue-700 transition cursor-pointer"
                    title="Alterar Brasão"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  ref={crestInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleCrestUpload}
                />
                <button
                  type="button"
                  onClick={() => crestInputRef.current?.click()}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                >
                  {isUploadingCrest ? 'Processando imagem...' : 'Carregar Imagem do Brasão'}
                </button>
              </div>

              {/* Nome do Time */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome Oficial do Time *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ex.: Real Madrid do Bairro, União Esporte..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs"
                />
              </div>

              {/* Cidade / Região */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cidade / Estado
                </label>
                <input
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  placeholder="Ex.: Planalto - BA"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs"
                />
              </div>

              {/* Modalidade */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Modalidade Principal
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'society', label: 'Society 7x7' },
                      { id: 'futsal', label: 'Futsal 5x5' },
                      { id: 'futebol_campo', label: 'Campo 11x11' },
                      { id: 'futebol_areia', label: 'Areia' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setEditModality(m.id)}
                      className={`rounded-xl border px-2.5 py-2 text-xs font-bold transition text-left cursor-pointer ${
                        editModality === m.id
                          ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-600'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditingTeam(false)}
                  className="flex-1 rounded-xl border border-slate-300 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 py-2.5 text-xs font-bold text-white shadow-md transition active:scale-95 cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Avaliação dos 5 Quesitos */}
      {ratingModalPlayer && (() => {
        const isSelf = currentPlayerProfile?.id === ratingModalPlayer.id;
        const isUserPlayer = currentUser.role === 'player';
        const isSelfReadOnly = isSelf && isUserPlayer;

        const myEval = (peerEvaluations || []).find(
          (e) =>
            (e.evaluatorId === currentUser.id ||
              e.evaluatorId === currentPlayerProfile?.id) &&
            e.targetPlayerId === ratingModalPlayer.id
        );

        const initialSkills = myEval
          ? {
              finalizacao: myEval.finalizacao,
              marcacao: myEval.marcacao,
              passe: myEval.passe,
              raca: myEval.raca,
              drible: myEval.drible,
            }
          : undefined;

        return (
          <PlayerRatingModal
            player={ratingModalPlayer}
            isOpen={true}
            readOnly={isSelfReadOnly}
            readOnlyMessage="Você não pode classificar a si mesmo. Suas estrelas são avaliadas pelos companheiros e comissão técnica."
            initialSkills={initialSkills}
            onClose={() => setRatingModalPlayer(null)}
            onSave={(playerId, skills) => {
              if (isSelfReadOnly) return;
              updatePlayerSkills(playerId, skills);
            }}
          />
        );
      })()}
    </div>
  );
};
