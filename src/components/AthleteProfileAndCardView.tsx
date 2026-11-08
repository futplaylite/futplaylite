import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  Check,
  Clock,
  Lock,
  Share2,
  Star,
  Trash2,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { getDivisionBadgeStyle } from '../lib/engine/eloEngine';
import { RosaliaCrest } from './RosaliaCrest';
import { PlayerRatingModal } from './PlayerRatingModal';
import { ShareCardModal } from './ShareCardModal';
import { getStoredSumulas } from './SumulaPeladaView';
import {
  DominantFoot,
  PlayerPosition,
  ProfileVisibility,
} from '../types/league';

interface AthleteProfileAndCardViewProps {
  initialPlayerId?: string;
}

export const AthleteProfileAndCardView: React.FC<
  AthleteProfileAndCardViewProps
> = ({ initialPlayerId }) => {
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
    registerNewAthlete,
    updateOwnProfile,
    deleteUserAccount,
    updatePlayerSkills,
  } = useLeague();

  const [inspectedPlayerId, setInspectedPlayerId] = useState<string>(
    initialPlayerId || currentPlayerProfile?.id || profiles[0].id
  );
  const [copiedCard, setCopiedCard] = useState<boolean>(false);
  const [showRatingModal, setShowRatingModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<
    'card' | 'edit_self' | 'onboarding'
  >('card');

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

  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newNeighborhood, setNewNeighborhood] = useState('Vila Rosália');
  const [newPos, setNewPos] = useState<PlayerPosition>('atacante');
  const [newFoot, setNewFoot] = useState<DominantFoot>('direito');

  const targetCity =
    cities.find((c) => c.id === targetProfile.cityId) || cities[0];
  const targetDivision =
    divisions.find((d) => d.id === targetProfile.currentDivisionId) ||
    divisions[0];
  const divStyle = getDivisionBadgeStyle(targetDivision.name);

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

  const handleOnboardingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const created = registerNewAthlete({
      displayName: newDisplayName,
      email: newEmail,
      cityId: selectedCityId,
      neighborhood: newNeighborhood,
      position: newPos,
      dominantFoot: newFoot,
      profileVisibility: 'publico',
    });
    if (created) {
      setInspectedPlayerId(created.id);
      setActiveSubTab('card');
      setNewDisplayName('');
      setNewEmail('');
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Seletor de Atleta & Abas Limpas */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-2.5">
        <select
          aria-label="Selecionar Atleta"
          value={targetProfile.id}
          onChange={(e) => {
            setInspectedPlayerId(e.target.value);
            setActiveSubTab('card');
          }}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800"
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName} — {p.position.toUpperCase()}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setActiveSubTab('card')}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-bold transition ${
              activeSubTab === 'card'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600'
            }`}
          >
            <Award className="h-3.5 w-3.5" />
            Cartão
          </button>

          <button
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
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-bold transition ${
              activeSubTab === 'edit_self'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Editar
          </button>

          <button
            onClick={() => setActiveSubTab('onboarding')}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-bold transition ${
              activeSubTab === 'onboarding'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-blue-700'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Novo
          </button>
        </div>
      </div>

      {/* ABA: NOVO ATLETA */}
      {activeSubTab === 'onboarding' && (
        <form
          onSubmit={handleOnboardingSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
        >
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Novo Jogador na Liga
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cadastre o jogador para integrar a liga.
            </p>
          </div>

          <div className="space-y-2.5">
            <input
              type="text"
              required
              placeholder="Apelido Esportivo *"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
            />
            <input
              type="email"
              required
              placeholder="E-mail (Privado) *"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={newPos}
                onChange={(e) => setNewPos(e.target.value as PlayerPosition)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-800"
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
                value={newFoot}
                onChange={(e) => setNewFoot(e.target.value as DominantFoot)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-800"
              >
                <option value="direito">Pé Direito</option>
                <option value="esquerdo">Pé Esquerdo</option>
                <option value="ambos">Ambidestro</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-sm"
          >
            Cadastrar Atleta
          </button>
        </form>
      )}

      {/* ABA: EDITAR PERFIL */}
      {activeSubTab === 'edit_self' && (
        <form
          onSubmit={handleSaveSelfProfile}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
        >
          <h2 className="text-sm font-bold text-slate-900">
            Preferências do Meu Perfil
          </h2>

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

      {/* ABA: CARTÃO DIGITAL DE ATLETA (BRANCO E AZUL LIMPO) */}
      {activeSubTab === 'card' && (
        <div className="space-y-4">
          <div className="w-full rounded-3xl border border-blue-200 bg-gradient-to-b from-blue-700 via-blue-800 to-blue-950 p-5 text-white shadow-lg relative overflow-hidden">
            {/* Imagem de Fundo Oficial do Estádio com Refletores */}
            <div
              className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-80"
              style={{
                backgroundImage: "url('/images/stadium-super-capas.jpg')",
              }}
            />
            <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#0a1435]/70 via-[#07112c]/80 to-[#030612]/92 pointer-events-none" />

            <div className="relative z-10 flex items-center justify-between border-b border-white/15 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-blue-100 block">
                  FutPlay Lite · Cartão Oficial
                </span>
              </div>
              <img
                src="/favicon.png"
                alt="FutPlay Lite"
                className="h-8 w-8 object-contain rounded-lg drop-shadow-md"
              />
            </div>

            <div className="mt-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white text-xl font-extrabold text-blue-800 shadow font-display">
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

              <h2 className="mt-2.5 text-xl font-extrabold text-white tracking-wide">
                {targetProfile.displayName}
              </h2>
              <p className="text-xs font-medium text-blue-200 capitalize flex items-center justify-center gap-1.5 flex-wrap">
                <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-bold text-white uppercase inline-flex items-center gap-1">
                  {targetProfile.position === 'goleiro' ? '🧤 Goleiro' : `🏃 ${targetProfile.position}`}
                </span>
                <span>·</span>
                <span>Pé {targetProfile.dominantFoot}</span>
                <span>·</span>
                <span>{targetCity.name}/{targetCity.stateCode}</span>
              </p>

              <div className="mt-2.5 flex justify-center items-center gap-2 flex-wrap">
                {/* 🌟 Botão de 5 Estrelas no Cartão */}
                <button
                  type="button"
                  onClick={() => setShowRatingModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/40 px-3 py-0.5 text-xs font-bold text-amber-200 transition active:scale-95"
                  title="Clique para avaliar os 5 quesitos de estrelas"
                >
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => {
                      const overall = targetProfile.overallStars ?? (targetProfile.skills ? (targetProfile.skills.finalizacao + targetProfile.skills.marcacao + targetProfile.skills.passe + targetProfile.skills.raca + targetProfile.skills.drible) / 5 : 0);
                      const isFilled = overall > 0 && s <= Math.round(overall);
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
                  <span className="font-mono text-amber-300">
                    {(targetProfile.overallStars ?? 0).toFixed(1)} ⭐
                  </span>

                  {(targetProfile.overallStars ?? 0) > 0 ? (
                    <span className="inline-flex items-center gap-0.5 font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-400/40 rounded px-1.5 py-0.2 text-[10px]">
                      <Check className="h-3 w-3 text-emerald-400 stroke-[3]" />
                      v
                    </span>
                  ) : !isOwnProfile ? (
                    <span className="text-[10px] text-amber-200 underline font-medium">
                      classificar
                    </span>
                  ) : null}
                </button>

                {targetProfile.isProvisional && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 border border-amber-300/40 px-2.5 py-0.5 text-[10px] font-bold text-amber-200">
                    <Clock className="h-3 w-3" />
                    Provisório
                  </span>
                )}
              </div>
            </div>

            {/* Métricas Oficiais da Planilha no Cartão */}
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-white/10 border border-white/15 p-3 text-center font-mono">
              <div>
                <div className="text-[10px] text-blue-200 uppercase">
                  Gols (Média)
                </div>
                <div className="text-base font-extrabold text-white">
                  {targetEntry.goals}{' '}
                  <span className="text-[11px] font-bold text-blue-200">
                    ({goalsAvgVal})
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-blue-200 uppercase">
                  Presenças
                </div>
                <div className="text-base font-extrabold text-white">
                  {targetEntry.matchesPlayed}J
                </div>
              </div>
              <div>
                <div className="text-[10px] text-blue-200 uppercase">
                  {targetProfile.position === 'goleiro'
                    ? 'Capas GK'
                    : 'Super Capas'}
                </div>
                <div className="text-base font-extrabold text-white">
                  {targetProfile.position === 'goleiro'
                    ? gkCapasVal
                    : `${superCapasVal} (${capaEfficiencyVal}%)`}
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-center gap-2 text-xs font-mono flex-wrap">
              <span className="rounded-lg bg-amber-400/20 border border-amber-300/40 px-2.5 py-1 font-bold text-amber-100">
                🟨 Amarelos: {yellowCardsVal}
              </span>
              <span className="rounded-lg bg-blue-400/25 border border-blue-200/40 px-2.5 py-1 font-bold text-white">
                🟦 Azul: {blueCardsVal}
              </span>
              <span className="rounded-lg bg-red-500/25 border border-red-300/40 px-2.5 py-1 font-bold text-red-200">
                🟥 Vermelho: {redCardsVal}
              </span>
            </div>

            <button
              onClick={() => setShowShareModal(true)}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-xs font-extrabold text-blue-800 shadow-sm active:scale-[0.99] transition hover:bg-blue-50"
            >
              <Share2 className="h-4 w-4 text-blue-600" />
              <span>Compartilhar Cartão (Imagem 9:16)</span>
            </button>
          </div>

          {/* Conquistas e Nota por Posição */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">
                Nota na Posição (Experimental)
              </span>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-mono text-xs font-extrabold text-blue-700">
                {targetProfile.experimentalPositionScore ?? '--'} / 100
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5">
              {targetProfile.badges.map((b) => (
                <span
                  key={b}
                  className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-800"
                >
                  ★ {b}
                </span>
              ))}
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
          teamName: targetProfile.teamName || 'Real Planalto FC',
          teamCrestUrl: targetProfile.teamCrestUrl,
          cityName: `${targetCity.name}/${targetCity.stateCode}`,
          overallStars: targetProfile.overallStars ?? 0,
          skills: targetProfile.skills,
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
