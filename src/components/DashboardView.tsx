import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  FilePlus2,
  MapPin,
  Share2,
  ShieldAlert,
  Sparkles,
  Star,
  Trophy,
  Users,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { MatchStatus } from '../types/league';
import { TeamCrestBadge } from './TeamCrestBadge';
import { PlayerRatingModal } from './PlayerRatingModal';
import { ShareCardModal } from './ShareCardModal';
import { getStoredSumulas } from './SumulaPeladaView';

interface DashboardViewProps {
  onNavigate: (
    tab: 'dashboard' | 'matches' | 'search' | 'squad' | 'ranking' | 'admin',
    matchIdToOpen?: string,
    playerIdToOpen?: string
  ) => void;
}

export function getMatchStatusBadge(status: MatchStatus) {
  switch (status) {
    case 'validada':
      return {
        label: 'Validada',
        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: CheckCircle2,
      };
    case 'aguardando_confirmacoes':
    case 'resultado_enviado':
      return {
        label: 'Pendente',
        cls: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: Clock,
      };
    case 'contestada':
    case 'analise_moderacao':
      return {
        label: 'Contestada',
        cls: 'bg-red-50 text-red-700 border-red-200',
        icon: AlertTriangle,
      };
    case 'escalacao_confirmada':
    case 'partida_cadastrada':
      return {
        label: 'A Jogar',
        cls: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: Users,
      };
    case 'anulada':
    case 'cancelada':
    default:
      return {
        label: 'Anulada',
        cls: 'bg-slate-100 text-slate-600 border-slate-200',
        icon: ShieldAlert,
      };
  }
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const {
    currentUser,
    currentPlayerProfile,
    profiles,
    seasonEntries,
    divisions,
    cities,
    selectedCityId,
    selectedSeasonId,
    updatePlayerSkills,
  } = useLeague();

  const [copiedCard, setCopiedCard] = useState<boolean>(false);
  const [showRatingModal, setShowRatingModal] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);

  const activeProfile = currentPlayerProfile || profiles[0];
  const activeCity =
    cities.find((c) => c.id === selectedCityId) || cities[0];

  const userTeamName =
    currentUser?.teamName ||
    activeProfile.teamName ||
    'Real Planalto FC';
  const userTeamCrest =
    currentUser?.teamCrestUrl || activeProfile.teamCrestUrl;
  const isCoach = currentUser?.role === 'coach' || currentUser?.isTeamOwner;
  const isAdmin = currentUser?.role === 'admin';

  const mySeasonEntry = seasonEntries.find(
    (se) =>
      se.seasonId === selectedSeasonId && se.playerId === activeProfile.id
  ) || {
    id: 'temp',
    seasonId: selectedSeasonId,
    playerId: activeProfile.id,
    divisionId: activeProfile.currentDivisionId,
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
    status: 'provisorio' as const,
    updatedAt: activeProfile.updatedAt,
  };

  const myDivision =
    divisions.find((d) => d.id === activeProfile.currentDivisionId) ||
    divisions[0];

  const cityEntriesWithProfile = seasonEntries
    .filter((se) => se.seasonId === selectedSeasonId)
    .map((entry) => ({
      entry,
      profile: profiles.find((p) => p.id === entry.playerId)!,
    }))
    .filter((item) => item.profile && item.profile.cityId === selectedCityId);

  const sortedByGoals = [...cityEntriesWithProfile].sort(
    (a, b) => b.entry.goals - a.entry.goals
  );
  const myRankByGoals =
    sortedByGoals.findIndex((i) => i.profile.id === activeProfile.id) + 1;

  const sortedByPresences = [...cityEntriesWithProfile].sort(
    (a, b) => b.entry.matchesPlayed - a.entry.matchesPlayed
  );
  const myRankByPresences =
    sortedByPresences.findIndex((i) => i.profile.id === activeProfile.id) + 1;

  const myGoals = mySeasonEntry.goals || 0;
  const myPresences = mySeasonEntry.matchesPlayed || 0;
  const myGoalsAvg =
    myPresences > 0
      ? (myGoals / myPresences).toFixed(2).replace('.', ',')
      : '0,00';
  const mySuperCapas =
    mySeasonEntry.superCapas ?? mySeasonEntry.mvpCount ?? 0;
  const myGoalkeeperCapas = mySeasonEntry.goalkeeperCapas ?? 0;
  const myCapaPct =
    mySeasonEntry.capaEfficiencyPct ??
    (myPresences > 0 ? Math.round((mySuperCapas / myPresences) * 100) : 0);
  const myYellowCards = mySeasonEntry.yellowCards ?? 0;
  const myBlueCards = mySeasonEntry.blueCards ?? 0;

  // Cartões vermelhos (da temporada + súmulas de peladas registradas)
  const myRedCardsFromSumulas = (() => {
    try {
      const sumulas = getStoredSumulas();
      const name = activeProfile.displayName.trim().toUpperCase();
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
  const myRedCards = (mySeasonEntry.redCards ?? 0) + myRedCardsFromSumulas;

  const overallStars =
    activeProfile.overallStars ??
    (activeProfile.skills
      ? (activeProfile.skills.finalizacao +
          activeProfile.skills.marcacao +
          activeProfile.skills.passe +
          activeProfile.skills.raca +
          activeProfile.skills.drible) /
        5
      : 0);

  const skills = activeProfile.skills || {
    finalizacao: 0,
    marcacao: 0,
    passe: 0,
    raca: 0,
    drible: 0,
  };

  const handleCopyShareCard = () => {
    const shareText = `⚽ FUTPLAY LITE • CARTÃO OFICIAL\nAtleta: ${activeProfile.displayName} (${activeProfile.position.toUpperCase()})\nTime: ${userTeamName}\nMunicípio: ${activeCity.name}-${activeCity.stateCode}\n⭐ Avaliação: ${(overallStars || 0).toFixed(1)} ⭐\n⚽ Gols: ${myGoals} (Média ${myGoalsAvg}/jogo)\n🏟️ Presenças: ${myPresences} jogos\n✨ Destaques: ${activeProfile.position === 'goleiro' ? myGoalkeeperCapas : mySuperCapas} (${myCapaPct}%)\n🟨 Amarelos: ${myYellowCards} | 🟦 Azuis: ${myBlueCards} | 🟥 Vermelhos: ${myRedCards}`;
    try {
      navigator.clipboard.writeText(shareText);
      setCopiedCard(true);
      setTimeout(() => setCopiedCard(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-4">
      {/* CARTÃO DIGITAL DE ATLETA (CARD OFICIAL COMPACTO) */}
      <div className="w-full rounded-2xl border border-blue-200/80 bg-gradient-to-b from-blue-700 via-blue-800 to-blue-950 p-3.5 text-white shadow-md relative overflow-hidden">
        {/* Efeito Glow Luminoso Decorativo */}
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-blue-500/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />

        {/* Topo do Cartão: Título e Brasão */}
        <div className="relative z-10 flex items-center justify-between border-b border-white/15 pb-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-blue-100 uppercase">
            <Award className="h-3.5 w-3.5 text-amber-300" />
            <span>Cartão Oficial de Atleta</span>
          </div>

          <div className="shrink-0" title={`Time: ${userTeamName}`}>
            <TeamCrestBadge
              name={userTeamName}
              crestUrl={userTeamCrest}
              size={32}
            />
          </div>
        </div>

        {/* Corpo do Cartão */}
        <div className="relative z-10 mt-2.5 text-center">
          {/* Foto de Perfil com Anel e Efeito de Destaque Compacto */}
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-white text-2xl font-black text-blue-900 shadow-md border-2 border-amber-300/80 font-display">
            {activeProfile.avatarUrl ? (
              <img
                src={activeProfile.avatarUrl}
                alt={activeProfile.displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              activeProfile.displayName.slice(0, 2).toUpperCase()
            )}
          </div>

          {/* Nome do Atleta */}
          <h1 className="mt-1.5 text-lg font-black tracking-wide text-white uppercase font-display leading-tight">
            {activeProfile.displayName}
          </h1>

          {/* Posição, Pé Dominante e Time em Linha Compacta */}
          <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-blue-200">
            <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase flex items-center gap-0.5">
              {activeProfile.position === 'goleiro' ? '🧤 Goleiro' : `🏃 ${activeProfile.position}`}
            </span>
            <span>·</span>
            <span>Pé {activeProfile.dominantFoot}</span>
            <span>·</span>
            <span className="text-white font-medium">{userTeamName}</span>
          </div>

          {/* Avaliação em Estrelas (0 a 5 ⭐) */}
          <div className="mt-2 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setShowRatingModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/40 px-3 py-1 text-[11px] font-bold text-amber-200 transition active:scale-95"
              title="Clique para ver a avaliação de habilidades"
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

          {/* Painel de Métricas Oficiais da Liga */}
          <div className="mt-2.5 grid grid-cols-3 gap-1.5 rounded-xl bg-white/10 border border-white/15 p-2 text-center font-mono">
            <div>
              <div className="text-[9px] text-blue-200 uppercase tracking-wider font-sans">
                Gols (Média)
              </div>
              <div className="text-sm font-black text-white mt-0.5">
                {myGoals}{' '}
                <span className="text-[10px] font-bold text-blue-200">
                  ({myGoalsAvg})
                </span>
              </div>
            </div>
            <div>
              <div className="text-[9px] text-blue-200 uppercase tracking-wider font-sans">
                Presenças
              </div>
              <div className="text-sm font-black text-white mt-0.5">
                {myPresences}J
              </div>
            </div>
            <div>
              <div className="text-[9px] text-blue-200 uppercase tracking-wider font-sans">
                {activeProfile.position === 'goleiro' ? 'Capas GK' : 'Super Capas'}
              </div>
              <div className="text-sm font-black text-white mt-0.5">
                {activeProfile.position === 'goleiro'
                  ? myGoalkeeperCapas
                  : `${mySuperCapas} (${myCapaPct}%)`}
              </div>
            </div>
          </div>

          {/* Disciplina: Amarelos, Azuis e Vermelhos */}
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-mono flex-wrap">
            <span className="rounded bg-amber-400/20 border border-amber-300/30 px-2 py-0.5 font-bold text-amber-100">
              🟨 {myYellowCards} Amarelos
            </span>
            <span className="rounded bg-blue-400/20 border border-blue-300/30 px-2 py-0.5 font-bold text-white">
              🟦 {myBlueCards} Azuis
            </span>
            <span className="rounded bg-red-500/20 border border-red-400/30 px-2 py-0.5 font-bold text-red-200">
              🟥 {myRedCards} Vermelhos
            </span>
          </div>

          {/* Botão de Compartilhar Cartão em Imagem 9:16 */}
          <div className="mt-2.5">
            <button
              onClick={() => setShowShareModal(true)}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-white py-2 px-3 text-[11px] font-extrabold text-blue-900 shadow-sm active:scale-[0.99] transition hover:bg-blue-50"
            >
              <Share2 className="h-3.5 w-3.5 text-blue-600" />
              <span>Compartilhar Cartão (Imagem 9:16)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Compartilhamento do Cartão em Imagem 9:16 */}
      <ShareCardModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        cardData={{
          displayName: activeProfile.displayName,
          position: activeProfile.position,
          dominantFoot: activeProfile.dominantFoot,
          avatarUrl: activeProfile.avatarUrl,
          teamName: userTeamName,
          teamCrestUrl: userTeamCrest,
          cityName: `${activeCity.name}/${activeCity.stateCode}`,
          overallStars: overallStars,
          skills: activeProfile.skills,
          goals: myGoals,
          goalsAvg: myGoalsAvg,
          matchesPlayed: myPresences,
          superCapas:
            activeProfile.position === 'goleiro'
              ? myGoalkeeperCapas
              : mySuperCapas,
          capaLabel:
            activeProfile.position === 'goleiro'
              ? 'Capas GK'
              : 'Super Capas',
          capaPct: myCapaPct,
          yellowCards: myYellowCards,
          blueCards: myBlueCards,
          redCards: myRedCards,
        }}
      />

      {/* Modal de Avaliação de Estrelas (quando clicado) */}
      {showRatingModal && (
        <PlayerRatingModal
          player={activeProfile}
          isOpen={showRatingModal}
          onClose={() => setShowRatingModal(false)}
          readOnly={activeProfile.userId === currentUser.id}
          readOnlyMessage="Você está visualizando seu próprio cartão. Não é permitido avaliar a si mesmo."
          onSave={(playerId, newSkills) => {
            updatePlayerSkills(playerId, newSkills);
            setShowRatingModal(false);
          }}
        />
      )}
    </div>
  );
};
