import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Check,
  ChevronRight,
  MapPin,
  Shield,
  Star,
  Trophy,
  Users,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { getDivisionBadgeStyle } from '../lib/engine/eloEngine';
import { AthleteProfileAndCardView } from './AthleteProfileAndCardView';
import { PlayerRatingModal } from './PlayerRatingModal';
import { TeamCrestBadge } from './TeamCrestBadge';
import { PlayerProfile } from '../types/league';

interface SquadViewProps {
  initialPlayerId?: string;
}

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
    peerEvaluations,
    monthlyPayments,
    monthlyConfig,
  } = useLeague();

  const userTeamName =
    currentUser?.teamName ||
    currentPlayerProfile?.teamName ||
    'Real Planalto FC';

  const userTeamCrest =
    currentUser?.teamCrestUrl ||
    currentPlayerProfile?.teamCrestUrl ||
    profiles.find((p) => p.teamName === userTeamName && p.teamCrestUrl)?.teamCrestUrl;

  const activeCity =
    cities?.find((c) => c.id === selectedCityId) ||
    cities?.[0] || { name: 'Planalto', stateCode: 'BA' };

  const coachProfile = profiles.find((p) => p.isTeamOwner || p.userId === 'user-paredao');
  const coachName = coachProfile?.displayName || 'Palito Paredão';

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

  const [inspectingPlayerId, setInspectingPlayerId] = useState<
    string | undefined
  >(initialPlayerId);
  const [ratingModalPlayer, setRatingModalPlayer] = useState<
    PlayerProfile | null
  >(null);

  const cityPlayers = useMemo(() => {
    return profiles
      .filter((p) => p.cityId === selectedCityId)
      .sort((a, b) => b.currentRating - a.currentRating);
  }, [profiles, selectedCityId]);

  const currentYearMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const monthlyStats = useMemo(() => {
    const cityPlayerIds = new Set(cityPlayers.map((p) => p.id));
    const paidSet = new Set<string>();
    (monthlyPayments || []).forEach((m) => {
      if (m.yearMonth === currentYearMonth && m.isPaid && cityPlayerIds.has(m.playerId)) {
        paidSet.add(m.playerId);
      }
    });
    return {
      paidCount: paidSet.size,
      totalCount: cityPlayers.length,
      paidSet,
    };
  }, [cityPlayers, monthlyPayments, currentYearMonth]);

  const counts = useMemo(() => {
    const all = profiles.filter((p) => p.cityId === selectedCityId);
    return {
      total: all.length,
      atacante: all.filter((p) => p.position === 'atacante').length,
      meia: all.filter((p) => p.position === 'meio-campista').length,
      defensor: all.filter((p) => p.position === 'defensor').length,
      goleiro: all.filter((p) => p.position === 'goleiro').length,
    };
  }, [profiles, selectedCityId]);

  if (inspectingPlayerId) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setInspectingPlayerId(undefined)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-blue-700 shadow-sm active:scale-[0.99]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o Elenco Completo
        </button>

        <AthleteProfileAndCardView
          key={inspectingPlayerId}
          initialPlayerId={inspectingPlayerId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
          {/* Cabeçalho do Card: Somente o Brasão (sem moldura quadrada), Nome e Informações do Time */}
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
                    Society 7x7
                  </span>
                  <span>·</span>
                  <span className="text-white font-semibold">
                    Técnico: {coachName}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Métricas e Distribuição do Elenco do Time */}
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

          {/* Barra de resumo com total de atletas do elenco */}
          <div className="flex items-center justify-between text-[11px] text-blue-200/90 pt-0.5">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-blue-300" />
              <span><strong>{counts.total}</strong> atletas inscritos no elenco</span>
            </span>
            <span className="font-mono font-bold text-amber-300 text-[10px] bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
              Série Principal
            </span>
          </div>
        </div>
      </div>

      {/* Lista de Atletas no mesmo padrão da aba Buscar (com Foto de Perfil) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {cityPlayers.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Nenhum jogador encontrado no elenco.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {cityPlayers.map((player) => {
              const entry = seasonEntries.find(
                (se) =>
                  se.seasonId === selectedSeasonId &&
                  se.playerId === player.id
              );

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
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        <span>{positionLabel}</span>
                        {player.dominantFoot && (
                          <span> · Pé {player.dominantFoot}</span>
                        )}
                        {player.neighborhood && (
                          <span> · {player.neighborhood}</span>
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
