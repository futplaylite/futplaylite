import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Check,
  ChevronRight,
  MapPin,
  Star,
  Users,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { getDivisionBadgeStyle } from '../lib/engine/eloEngine';
import { AthleteProfileAndCardView } from './AthleteProfileAndCardView';
import { PlayerRatingModal } from './PlayerRatingModal';
import { PlayerProfile } from '../types/league';

interface SquadViewProps {
  initialPlayerId?: string;
}

export const SquadView: React.FC<SquadViewProps> = ({ initialPlayerId }) => {
  const {
    profiles,
    seasonEntries,
    divisions,
    selectedCityId,
    selectedSeasonId,
    currentUser,
    currentPlayerProfile,
    updatePlayerSkills,
  } = useLeague();

  const [selectedPosition, setSelectedPosition] = useState<string>('todos');
  const [inspectingPlayerId, setInspectingPlayerId] = useState<
    string | undefined
  >(initialPlayerId);
  const [ratingModalPlayer, setRatingModalPlayer] = useState<
    PlayerProfile | null
  >(null);

  const cityPlayers = useMemo(() => {
    return profiles
      .filter((p) => p.cityId === selectedCityId)
      .filter((p) =>
        selectedPosition === 'todos' ? true : p.position === selectedPosition
      )
      .sort((a, b) => b.currentRating - a.currentRating);
  }, [profiles, selectedCityId, selectedPosition]);

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

        <AthleteProfileAndCardView initialPlayerId={inspectingPlayerId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo do Elenco (Branco & Azul Organizado) */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-700 to-blue-900 p-4 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
              Atletas Registrados
            </span>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-200" />
              Elenco da Liga ({counts.total})
            </h1>
          </div>

          {currentPlayerProfile && (
            <button
              onClick={() => setInspectingPlayerId(currentPlayerProfile.id)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-blue-800 shadow-sm"
            >
              <Award className="h-4 w-4 text-blue-600" />
              Meu Cartão
            </button>
          )}
        </div>

        {/* Contadores por Posição */}
        <div className="mt-3.5 grid grid-cols-4 gap-2 text-center">
          <div className="rounded-xl bg-white/10 p-2">
            <div className="font-mono text-base font-extrabold text-white">
              {counts.atacante}
            </div>
            <div className="text-[10px] font-medium text-blue-100">
              Atacantes
            </div>
          </div>
          <div className="rounded-xl bg-white/10 p-2">
            <div className="font-mono text-base font-extrabold text-white">
              {counts.meia}
            </div>
            <div className="text-[10px] font-medium text-blue-100">Meias</div>
          </div>
          <div className="rounded-xl bg-white/10 p-2">
            <div className="font-mono text-base font-extrabold text-white">
              {counts.defensor}
            </div>
            <div className="text-[10px] font-medium text-blue-100">
              Defensores
            </div>
          </div>
          <div className="rounded-xl bg-white/10 p-2">
            <div className="font-mono text-base font-extrabold text-white">
              {counts.goleiro}
            </div>
            <div className="text-[10px] font-medium text-blue-100">
              Goleiros
            </div>
          </div>
        </div>
      </div>

      {/* Abas de Filtro por Posição */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {[
          { id: 'todos', label: `Todos (${counts.total})` },
          { id: 'atacante', label: `Atacantes (${counts.atacante})` },
          { id: 'meio-campista', label: `Meias (${counts.meia})` },
          { id: 'defensor', label: `Defensores (${counts.defensor})` },
          { id: 'goleiro', label: `Goleiros (${counts.goleiro})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedPosition(tab.id)}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              selectedPosition === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:text-blue-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cards Organizados dos Jogadores do Elenco */}
      <div className="space-y-3">
        {cityPlayers.map((player) => {
          const entry = seasonEntries.find(
            (se) =>
              se.seasonId === selectedSeasonId && se.playerId === player.id
          );
          const div =
            divisions.find((d) => d.id === player.currentDivisionId) ||
            divisions[0];
          const divStyle = getDivisionBadgeStyle(div.name);

          return (
            <div
              key={player.id}
              onClick={() => setInspectingPlayerId(player.id)}
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300 transition space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-50 border border-blue-100 font-display text-base font-extrabold text-blue-700">
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

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {player.displayName}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 capitalize">
                      {player.position} · Pé {player.dominantFoot} ·{' '}
                      {player.neighborhood}
                    </p>

                    {/* 🌟 5 Estrelas Clicáveis para Classificação */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setRatingModalPlayer(player);
                      }}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200/70 px-2 py-0.5 text-xs transition active:scale-95"
                      title="Clique para avaliar os 5 quesitos de estrelas deste atleta"
                    >
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((starIdx) => {
                          const overall = player.overallStars ?? (player.skills ? (player.skills.finalizacao + player.skills.marcacao + player.skills.passe + player.skills.raca + player.skills.drible) / 5 : 0);
                          const isFilled = overall > 0 && starIdx <= Math.round(overall);
                          return (
                            <Star
                              key={starIdx}
                              className={`h-3.5 w-3.5 ${
                                isFilled
                                  ? 'fill-amber-400 text-amber-500'
                                  : 'fill-slate-200 text-slate-300'
                              }`}
                            />
                          );
                        })}
                      </div>
                      <span className="font-mono text-[11px] font-black text-amber-700">
                        {(player.overallStars ?? 0).toFixed(1)}
                      </span>

                      {/* V verde se classificado, ou 'classificar' apenas se for outro atleta */}
                      {(player.overallStars ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-0.5 font-bold text-emerald-600 bg-emerald-100/90 rounded px-1 text-[10px]">
                          <Check className="h-3 w-3 text-emerald-600 stroke-[3]" />
                          v
                        </span>
                      ) : player.id !== currentPlayerProfile?.id && player.userId !== currentUser.id ? (
                        <span className="text-[10px] text-amber-700 underline font-semibold">
                          classificar
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
              </div>

              {/* Métricas da Planilha Excel Organizadas em 4 Colunas */}
              <div className="grid grid-cols-4 gap-2 rounded-xl bg-slate-50 border border-slate-100 p-2.5 text-center">
                <div>
                  <div className="font-mono text-xs font-extrabold text-blue-700">
                    {entry?.goals || 0}G
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Méd{' '}
                    {entry && entry.matchesPlayed > 0
                      ? (entry.goals / entry.matchesPlayed).toFixed(1)
                      : '0.0'}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-xs font-extrabold text-slate-900">
                    {entry?.matchesPlayed || 0}
                  </div>
                  <div className="text-[10px] text-slate-500">Presenças</div>
                </div>
                <div>
                  <div className="font-mono text-xs font-bold text-blue-800">
                    {player.position === 'goleiro'
                      ? `${entry?.goalkeeperCapas || 0} GK`
                      : `${entry?.superCapas || 0} (${entry?.capaEfficiencyPct || 0}%)`}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {player.position === 'goleiro' ? 'Capas GK' : 'Super Capas'}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-xs font-bold text-slate-800">
                    🟨{entry?.yellowCards || 0} · 🟦{entry?.blueCards || 0} · 🟥{entry?.redCards || 0}
                  </div>
                  <div className="text-[10px] text-slate-500">Cartões</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-0.5 text-[11px]">
                <span className="text-slate-500 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" />
                  {player.neighborhood}
                </span>
                <span className="font-bold text-blue-600">
                  Ver Cartão Oficial →
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Avaliação dos 5 Quesitos */}
      {ratingModalPlayer && (() => {
        const isSelf = currentPlayerProfile?.id === ratingModalPlayer.id;
        const isUserPlayer = currentUser.role === 'player';
        const isSelfReadOnly = isSelf && isUserPlayer;

        return (
          <PlayerRatingModal
            player={ratingModalPlayer}
            isOpen={true}
            readOnly={isSelfReadOnly}
            readOnlyMessage="Você não pode classificar a si mesmo. Suas estrelas são avaliadas pelos companheiros e comissão técnica."
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
