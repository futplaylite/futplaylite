import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Check,
  Clock,
  Edit2,
  Lock,
  Share2,
  Star,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { getDivisionBadgeStyle } from '../lib/engine/eloEngine';
import { RosaliaCrest } from './RosaliaCrest';
import { PlayerRatingModal } from './PlayerRatingModal';
import { ShareCardModal } from './ShareCardModal';
import { TeamCrestBadge } from './TeamCrestBadge';
import { getStoredSumulas } from './SumulaPeladaView';
import {
  DominantFoot,
  PlayerPosition,
  ProfileVisibility,
} from '../types/league';

interface AthleteProfileAndCardViewProps {
  initialPlayerId?: string;
  onBack?: () => void;
}

export const AthleteProfileAndCardView: React.FC<
  AthleteProfileAndCardViewProps
> = ({ initialPlayerId, onBack }) => {
  const {
    profiles,
    seasonEntries,
    divisions,
    cities,
    pointTransactions,
    currentUser,
    currentPlayerProfile,
    selectedSeasonId,
    selectedCityId,
    updateOwnProfile,
    deleteUserAccount,
    updatePlayerSkills,
  } = useLeague();

  const [inspectedPlayerId, setInspectedPlayerId] = useState<string>(
    initialPlayerId || currentPlayerProfile?.id || profiles[0].id
  );

  useEffect(() => {
    if (initialPlayerId) {
      setInspectedPlayerId(initialPlayerId);
    } else if (currentPlayerProfile?.id) {
      setInspectedPlayerId(currentPlayerProfile.id);
    }
  }, [initialPlayerId, currentPlayerProfile?.id]);

  const [copiedCard, setCopiedCard] = useState<boolean>(false);
  const [showRatingModal, setShowRatingModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<'card' | 'edit_self'>('card');

  const targetProfile =
    profiles.find((p) => p.id === inspectedPlayerId) || profiles[0];

  const isOwnProfile = currentPlayerProfile?.id === targetProfile.id;

  const [editName, setEditName] = useState(
    currentPlayerProfile?.displayName || ''
  );
  const [editNeighborhood, setEditNeighborhood] = useState(
    currentPlayerProfile?.neighborhood || ''
  );
  const [editPos, setEditPos] = useState<PlayerPosition>(
    currentPlayerProfile?.position || 'atacante'
  );
  const [editFoot, setEditFoot] = useState<DominantFoot>(
    currentPlayerProfile?.dominantFoot || 'direito'
  );
  const [editVis, setEditVis] = useState<ProfileVisibility>(
    currentPlayerProfile?.profileVisibility || 'publico'
  );

  useEffect(() => {
    if (isOwnProfile && currentPlayerProfile) {
      setEditName(currentPlayerProfile.displayName);
      setEditNeighborhood(currentPlayerProfile.neighborhood);
      setEditPos(currentPlayerProfile.position);
      setEditFoot(currentPlayerProfile.dominantFoot);
      setEditVis(currentPlayerProfile.profileVisibility);
    }
  }, [isOwnProfile, currentPlayerProfile]);

  const targetCity =
    cities.find((c) => c.id === targetProfile.cityId) || cities[0];
  const targetDivision =
    divisions.find((d) => d.id === targetProfile.currentDivisionId) ||
    divisions[0];
  const divStyle = getDivisionBadgeStyle(targetDivision.name);

  const userTeamName =
    targetProfile.teamName ||
    (isOwnProfile ? currentUser?.teamName : undefined) ||
    'Real Planalto FC';

  const userTeamCrest =
    targetProfile.teamCrestUrl ||
    (isOwnProfile ? currentUser?.teamCrestUrl : undefined) ||
    profiles.find((p) => p.teamName === userTeamName && p.teamCrestUrl)?.teamCrestUrl;

  const overallStars =
    targetProfile.overallStars ??
    (targetProfile.skills
      ? (targetProfile.skills.finalizacao +
          targetProfile.skills.marcacao +
          targetProfile.skills.passe +
          targetProfile.skills.raca +
          targetProfile.skills.drible) /
        5
      : 0);

  const skills = targetProfile.skills || {
    finalizacao: 0,
    marcacao: 0,
    passe: 0,
    raca: 0,
    drible: 0,
  };

  const targetEntry = seasonEntries.find(
    (se) =>
      se.seasonId === selectedSeasonId && se.playerId === targetProfile.id
  ) || {
    seasonPoints: 0,
    pendingPoints: 0,
    matchesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals: 0,
    assists: 0,
    mvpCount: 0,
    superCapas: 0,
    goalkeeperCapas: 0,
    capaEfficiencyPct: 0,
    yellowCards: 0,
    blueCards: 0,
    redCards: 0,
    cleanSheets: 0,
    defensiveActions: 0,
  };

  const myPointTx = pointTransactions.filter(
    (pt) => pt.playerId === targetProfile.id
  );

  const superCapasVal = targetEntry.superCapas ?? targetEntry.mvpCount ?? 0;
  const gkCapasVal = targetEntry.goalkeeperCapas ?? 0;
  const capaEfficiencyVal =
    targetEntry.capaEfficiencyPct ??
    (targetEntry.matchesPlayed > 0
      ? Math.round((superCapasVal / targetEntry.matchesPlayed) * 100)
      : 0);
  const yellowCardsVal = targetEntry.yellowCards ?? 0;
  const blueCardsVal = targetEntry.blueCards ?? 0;

  // Cartões vermelhos (temporada + súmulas)
  const redCardsFromSumulas = (() => {
    try {
      const sumulas = getStoredSumulas();
      const name = targetProfile.displayName.trim().toUpperCase();
      let count = 0;
      for (const s of sumulas) {
        if (s.redCards) {
          count += s.redCards.filter((p) => p.trim().toUpperCase() === name).length;
        }
      }
      return count;
    } catch {
      return 0;
    }
  })();
  const redCardsVal = (targetEntry.redCards ?? 0) + redCardsFromSumulas;

  const goalsAvgVal =
    targetEntry.matchesPlayed > 0
      ? (targetEntry.goals / targetEntry.matchesPlayed)
          .toFixed(2)
          .replace('.', ',')
      : '0,00';

  const handleCopyShareCard = () => {
    const shareText = `🏆 FUTPLAY LITE · CARTÃO OFICIAL\nAtleta: ${targetProfile.displayName} (${targetProfile.position.toUpperCase()})\nMunicípio: ${targetCity.name}-${targetCity.stateCode}\n⚽ Artilharia: ${targetEntry.goals} gols (Média ${goalsAvgVal}/jogo)\n📅 Presenças: ${targetEntry.matchesPlayed} jogos\n⭐ Super Capas: ${superCapasVal} (${capaEfficiencyVal}% aprov.)\n🟨 Amarelos: ${yellowCardsVal} | 🟦 Azul: ${blueCardsVal} | 🟥 Vermelhos: ${redCardsVal}`;
    navigator.clipboard?.writeText(shareText);
    setCopiedCard(true);
    setTimeout(() => setCopiedCard(false), 3000);
  };

  const handleSaveSelfProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateOwnProfile({
      displayName: editName,
      neighborhood: editNeighborhood,
      position: editPos,
      dominantFoot: editFoot,
      profileVisibility: editVis,
    });
    setActiveSubTab('card');
  };

  return (
    <div className="space-y-4">
      {/* ABA: EDITAR PERFIL */}
      {activeSubTab === 'edit_self' && (
        <form
          onSubmit={handleSaveSelfProfile}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Preferências do Meu Perfil
              </h2>
              <p className="text-[11px] text-slate-500">
                Altere seus dados esportivos e visibilidade
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSubTab('card')}
              className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
            >
              Voltar ao Cartão
            </button>
          </div>

          <div className="space-y-2.5">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Apelido Público"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
            />
            <select
              value={editPos}
              onChange={(e) => setEditPos(e.target.value as PlayerPosition)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800"
            >
              <optgroup label="Tipo: Goleiro">
                <option value="goleiro">🧤 Goleiro</option>
              </optgroup>
              <optgroup label="Tipo: Jogador de Linha">
                <option value="atacante">🏃 Atacante (Linha)</option>
                <option value="meio-campista">🏃 Meio-campista (Linha)</option>
                <option value="defensor">🏃 Defensor (Linha)</option>
              </optgroup>
            </select>
            <select
              value={editVis}
              onChange={(e) => setEditVis(e.target.value as ProfileVisibility)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-blue-700"
            >
              <option value="publico">Visibilidade: Público</option>
              <option value="restrito">Visibilidade: Restrito à Liga</option>
              <option value="privado">Visibilidade: Privado</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-98 transition cursor-pointer"
          >
            Salvar Alterações
          </button>

          {/* Zona de Exclusão de Conta (LGPD) */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Gerenciamento da Conta
            </span>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/80 py-2.5 px-3 text-xs font-bold text-red-600 hover:bg-red-100 hover:border-red-300 active:scale-[0.99] transition cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Excluir Minha Conta</span>
            </button>
            <p className="text-[10px] text-slate-400 text-center">
              A exclusão remove seu perfil esportivo, estatísticas e cartão da liga.
            </p>
          </div>
        </form>
      )}

      {/* ABA: CARTÃO DIGITAL DE ATLETA (PADRÃO OFICIAL COM ESTÁDIO E TIME) */}
      {activeSubTab === 'card' && (
        <div className="space-y-4">
          <div className="w-full rounded-2xl border border-blue-200/80 bg-gradient-to-b from-blue-700 via-blue-800 to-blue-950 p-4 text-white shadow-md relative overflow-hidden">
            {/* Imagem de Fundo Oficial do Estádio com Refletores */}
            <div
              className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-80"
              style={{
                backgroundImage: "url('/images/stadium-super-capas.jpg')",
              }}
            />
            <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#0a1435]/70 via-[#07112c]/80 to-[#030612]/92 pointer-events-none" />
            <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-blue-500/20 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />

            {/* Topo do Cartão: Título, Voltar e Ações */}
            <div className="relative z-10 flex items-center justify-between border-b border-white/15 pb-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-blue-100 uppercase">
                {onBack && !isOwnProfile && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-1 rounded-md bg-white/20 hover:bg-white/30 px-2 py-0.5 text-[10px] font-bold text-white transition active:scale-95 cursor-pointer mr-1"
                    title="Voltar ao elenco"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    <span>Voltar</span>
                  </button>
                )}
                <Award className="h-3.5 w-3.5 text-amber-300" />
                <span>Cartão Oficial de Atleta</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isOwnProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      if (currentPlayerProfile) {
                        setEditName(currentPlayerProfile.displayName);
                        setEditNeighborhood(currentPlayerProfile.neighborhood);
                        setEditPos(currentPlayerProfile.position);
                        setEditFoot(currentPlayerProfile.dominantFoot);
                        setEditVis(currentPlayerProfile.profileVisibility);
                      }
                      setActiveSubTab('edit_self');
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white shadow-xs transition active:scale-90 cursor-pointer"
                    title="Editar Meu Perfil"
                    aria-label="Editar Perfil"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-blue-200" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowShareModal(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-amber-300 shadow-xs transition active:scale-90 cursor-pointer"
                  title="Compartilhar Cartão Oficial (Imagem 9:16)"
                  aria-label="Compartilhar Cartão Oficial"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Corpo do Cartão */}
            <div className="relative z-10 mt-3 text-center">
              {/* Jogador e Time Lado a Lado (Foto/Brasão e Nomes do Mesmo Tamanho) */}
              <div className="grid grid-cols-2 gap-3 items-start">
                {/* Coluna do Atleta */}
                <div className="flex flex-col items-center">
                  <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-white text-2xl font-black text-blue-900 shadow-md border-2 border-amber-300/80 font-display shrink-0">
                    {targetProfile.avatarUrl ? (
                      <img
                        src={targetProfile.avatarUrl}
                        alt={targetProfile.displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      targetProfile.displayName.slice(0, 2).toUpperCase()
                    )}
                  </div>

                  {/* Nome do Atleta */}
                  <h1
                    className="mt-1.5 w-full text-center text-sm sm:text-base font-black tracking-wide text-white uppercase font-display leading-tight line-clamp-2 px-1 min-h-[2.4rem] flex items-center justify-center"
                    title={targetProfile.displayName}
                  >
                    {targetProfile.displayName}
                  </h1>
                </div>

                {/* Coluna do Time */}
                <div className="flex flex-col items-center">
                  <div
                    className="relative flex h-16 w-16 items-center justify-center shrink-0"
                    title={`Time: ${userTeamName}`}
                  >
                    <TeamCrestBadge
                      name={userTeamName}
                      crestUrl={userTeamCrest}
                      size={60}
                      className="drop-shadow-lg"
                    />
                  </div>

                  {/* Nome do Time */}
                  <div
                    className="mt-1.5 w-full text-center text-sm sm:text-base font-black tracking-wide text-amber-300 uppercase font-display leading-tight line-clamp-2 px-1 min-h-[2.4rem] flex items-center justify-center"
                    title={userTeamName}
                  >
                    {userTeamName}
                  </div>
                </div>
              </div>

              {/* Posição, Pé Dominante e Cidade em Linha Compacta */}
              <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-blue-200">
                <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase flex items-center gap-0.5">
                  {targetProfile.position === 'goleiro' ? '🧤 Goleiro' : `🏃 ${targetProfile.position}`}
                </span>
                <span>·</span>
                <span>Pé {targetProfile.dominantFoot}</span>
                <span>·</span>
                <span className="text-white/90 font-medium">
                  {targetCity.name}/{targetCity.stateCode}
                </span>
              </div>

              {/* Avaliação em Estrelas (0 a 5 ⭐) */}
              <div className="mt-2 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setShowRatingModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/40 px-3 py-1 text-[11px] font-bold text-amber-200 transition active:scale-95 cursor-pointer"
                  title="Clique para ver ou avaliar habilidades"
                >
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => {
                      const isFilled = overallStars > 0 && s <= Math.round(overallStars);
                      return (
                        <Star
                          key={s}
                          className={`h-3 w-3 ${
                            isFilled
                              ? 'fill-amber-400 text-amber-300'
                              : 'fill-white/10 text-white/30'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <span className="font-mono text-xs font-black text-amber-300">
                    {overallStars.toFixed(1)} ⭐
                  </span>
                  {overallStars > 0 && (
                    <span className="inline-flex items-center gap-0.5 font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-400/40 rounded px-1 py-0.2 text-[9px]">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                  )}
                </button>
              </div>

              {/* Quesitos de Habilidade (Se já avaliado) */}
              {overallStars > 0 && (
                <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[9px] font-bold text-blue-100/90 bg-white/10 border border-white/15 rounded-lg p-1.5">
                  <div>
                    <span className="block text-[8px] text-blue-300 uppercase">Fin</span>
                    <span className="font-mono text-amber-300">{skills.finalizacao}★</span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-blue-300 uppercase">Mar</span>
                    <span className="font-mono text-amber-300">{skills.marcacao}★</span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-blue-300 uppercase">Pas</span>
                    <span className="font-mono text-amber-300">{skills.passe}★</span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-blue-300 uppercase">Raç</span>
                    <span className="font-mono text-amber-300">{skills.raca}★</span>
                  </div>
                  <div>
                    <span className="block text-[8px] text-blue-300 uppercase">Dri</span>
                    <span className="font-mono text-amber-300">{skills.drible}★</span>
                  </div>
                </div>
              )}

              {/* Métricas Oficiais da Planilha no Cartão */}
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-white/10 border border-white/15 p-2.5 text-center font-mono">
                <div>
                  <div className="text-[10px] text-blue-200 uppercase">Gols (Média)</div>
                  <div className="text-sm font-extrabold text-white">
                    {targetEntry.goals}{' '}
                    <span className="text-[10px] font-bold text-blue-200">({goalsAvgVal})</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-blue-200 uppercase">Presenças</div>
                  <div className="text-sm font-extrabold text-white">{targetEntry.matchesPlayed}J</div>
                </div>
                <div>
                  <div className="text-[10px] text-blue-200 uppercase">
                    {targetProfile.position === 'goleiro' ? 'Capas GK' : 'Super Capas'}
                  </div>
                  <div className="text-sm font-extrabold text-white">
                    {targetProfile.position === 'goleiro'
                      ? gkCapasVal
                      : `${superCapasVal} (${capaEfficiencyVal}%)`}
                  </div>
                </div>
              </div>

              {/* Cartões Disciplinares */}
              <div className="mt-2.5 flex items-center justify-center gap-1.5 text-xs font-mono flex-wrap">
                <span className="rounded-lg bg-amber-400/20 border border-amber-300/40 px-2 py-0.5 text-[11px] font-bold text-amber-100">
                  🟨 Amarelos: {yellowCardsVal}
                </span>
                <span className="rounded-lg bg-blue-400/25 border border-blue-200/40 px-2 py-0.5 text-[11px] font-bold text-white">
                  🟦 Azul: {blueCardsVal}
                </span>
                <span className="rounded-lg bg-red-500/25 border border-red-300/40 px-2 py-0.5 text-[11px] font-bold text-red-200">
                  🟥 Vermelho: {redCardsVal}
                </span>
              </div>

              {/* Botão Compartilhar Imagem 9:16 */}
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="mt-3.5 w-full flex items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-xs font-extrabold text-blue-900 shadow-sm active:scale-[0.99] transition hover:bg-blue-50 cursor-pointer"
              >
                <Share2 className="h-4 w-4 text-blue-600" />
                <span>Compartilhar Cartão Oficial (Imagem 9:16)</span>
              </button>
            </div>
          </div>

          {/* Histórico de Pontos do Atleta */}
          {targetProfile.profileVisibility === 'privado' &&
          !isOwnProfile &&
          currentUser.role === 'player' ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
              <Lock className="mx-auto h-5 w-5 text-slate-400" />
              <p className="mt-1 text-xs font-semibold text-slate-600">
                Histórico detalhado configurado como privado.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2.5">
              <h3 className="text-xs font-bold text-slate-900">
                Histórico de Pontos Recebidos
              </h3>
              {myPointTx.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Nenhuma partida processada neste período.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {myPointTx.map((tx) => (
                    <div
                      key={tx.id}
                      className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-800">
                          Partida #{tx.matchId.slice(-4)}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          {tx.breakdown.goalsCount}G ·{' '}
                          {tx.breakdown.assistsCount}A
                          {tx.breakdown.isMvp ? ' · ⭐ MVP' : ''}
                        </span>
                      </div>
                      <span
                        className={`font-mono text-sm font-bold ${
                          tx.pointsDelta >= 0
                            ? 'text-blue-600'
                            : 'text-red-600'
                        }`}
                      >
                        {tx.pointsDelta >= 0
                          ? `+${tx.pointsDelta}`
                          : tx.pointsDelta}{' '}
                        pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isOwnProfile && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-red-600 transition cursor-pointer py-1.5 px-3 rounded-lg hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Excluir Minha Conta</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal de Avaliação dos 5 Quesitos */}
      {showRatingModal && (() => {
        const isSelfReadOnly = isOwnProfile && currentUser.role === 'player';

        return (
          <PlayerRatingModal
            player={targetProfile}
            isOpen={true}
            readOnly={isSelfReadOnly}
            readOnlyMessage="Você não pode classificar a si mesmo. Suas estrelas são avaliadas pelos companheiros e comissão técnica."
            onClose={() => setShowRatingModal(false)}
            onSave={(playerId, skills) => {
              if (isSelfReadOnly) return;
              updatePlayerSkills(playerId, skills);
            }}
          />
        );
      })()}
      {/* Modal de Compartilhamento em Imagem 9:16 */}
      <ShareCardModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        cardData={{
          displayName: targetProfile.displayName,
          position: targetProfile.position,
          dominantFoot: targetProfile.dominantFoot,
          avatarUrl: targetProfile.avatarUrl,
          teamName: userTeamName,
          teamCrestUrl: userTeamCrest,
          cityName: `${targetCity.name}/${targetCity.stateCode}`,
          overallStars: overallStars,
          skills: skills,
          goals: targetEntry.goals || 0,
          goalsAvg: goalsAvgVal,
          matchesPlayed: targetEntry.matchesPlayed || 0,
          superCapas: superCapasVal,
          capaLabel: targetProfile.position === 'goleiro' ? 'Capas GK' : 'Super Capas',
          capaPct: capaEfficiencyVal,
          yellowCards: yellowCardsVal,
          blueCards: blueCardsVal,
          redCards: redCardsVal,
        }}
      />

      {/* Modal de Confirmação de Exclusão de Conta */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-[380px] rounded-3xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Excluir Conta Definitivamente?
                </h3>
                <p className="text-xs text-slate-500">
                  Esta ação é irreversível.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-red-100 bg-red-50/70 p-3 text-xs text-red-900 space-y-1.5">
              <p className="font-semibold text-slate-700">
                Você está prestes a excluir:
              </p>
              <p className="font-extrabold text-red-700 text-sm">
                {targetProfile.displayName}
              </p>
              <p className="text-[11px] text-red-700/80 leading-relaxed">
                Seu cartão oficial de atleta, estatísticas e dados de acesso serão apagados da liga FUTPLAY LITE.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 active:scale-98 transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setIsDeleting(true);
                  deleteUserAccount(targetProfile.userId || currentUser.id);
                  setShowDeleteModal(false);
                  setIsDeleting(false);
                  window.location.reload();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-red-700 active:scale-98 transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
