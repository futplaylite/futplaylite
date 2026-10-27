import React, { useMemo, useState } from 'react';
import {
  ChevronRight,
  MapPin,
  Search,
  Swords,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { getDivisionBadgeStyle } from '../lib/engine/eloEngine';
import { getMatchStatusBadge } from './DashboardView';

interface SearchViewProps {
  onSelectPlayer: (playerId: string) => void;
  onSelectMatch: (matchId: string) => void;
}

type SearchCategory = 'all' | 'players' | 'matches' | 'venues';

export const SearchView: React.FC<SearchViewProps> = ({
  onSelectPlayer,
  onSelectMatch,
}) => {
  const {
    profiles,
    seasonEntries,
    divisions,
    matches,
    matchResults,
    cities,
    selectedCityId,
    selectedSeasonId,
  } = useLeague();

  const [query, setQuery] = useState<string>('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const [selectedPosition, setSelectedPosition] = useState<string>('todas');

  const normalizedQuery = query.trim().toLowerCase();

  const filteredPlayers = useMemo(() => {
    return profiles
      .filter((p) => p.cityId === selectedCityId)
      .filter((p) =>
        selectedPosition === 'todas' ? true : p.position === selectedPosition
      )
      .filter((p) => {
        if (!normalizedQuery) return true;
        const div = divisions.find((d) => d.id === p.currentDivisionId);
        return (
          p.displayName.toLowerCase().includes(normalizedQuery) ||
          p.neighborhood.toLowerCase().includes(normalizedQuery) ||
          p.position.toLowerCase().includes(normalizedQuery) ||
          (div && div.name.toLowerCase().includes(normalizedQuery))
        );
      });
  }, [profiles, selectedCityId, selectedPosition, normalizedQuery, divisions]);

  const filteredMatches = useMemo(() => {
    return matches
      .filter((m) => m.cityId === selectedCityId)
      .filter((m) => {
        if (!normalizedQuery) return true;
        return (
          m.homeTeamName.toLowerCase().includes(normalizedQuery) ||
          m.awayTeamName.toLowerCase().includes(normalizedQuery) ||
          m.venueName.toLowerCase().includes(normalizedQuery) ||
          m.format.toLowerCase().includes(normalizedQuery)
        );
      });
  }, [matches, selectedCityId, normalizedQuery]);

  const venuesList = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; formats: Set<string>; lastMatchId: string }
    >();
    matches
      .filter((m) => m.cityId === selectedCityId)
      .forEach((m) => {
        if (
          normalizedQuery &&
          !m.venueName.toLowerCase().includes(normalizedQuery) &&
          !m.homeTeamName.toLowerCase().includes(normalizedQuery)
        ) {
          return;
        }
        const curr = map.get(m.venueName) || {
          name: m.venueName,
          count: 0,
          formats: new Set<string>(),
          lastMatchId: m.id,
        };
        curr.count += 1;
        curr.formats.add(m.format);
        map.set(m.venueName, curr);
      });
    return Array.from(map.values());
  }, [matches, selectedCityId, normalizedQuery]);

  const activeCity =
    cities.find((c) => c.id === selectedCityId) || cities[0];

  return (
    <div className="space-y-4">
      {/* Cabeçalho e Barra de Busca Limpa */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            Explorador · {activeCity.name}/{activeCity.stateCode}
          </span>
          <h1 className="text-lg font-bold text-slate-900">
            Buscar na Liga
          </h1>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Atleta, bairro, time, arena ou posição..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-9 py-2.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Categorias */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          {(
            [
              { id: 'all', label: 'Tudo' },
              { id: 'players', label: `Atletas (${filteredPlayers.length})` },
              { id: 'matches', label: `Partidas (${filteredMatches.length})` },
              { id: 'venues', label: `Campos (${venuesList.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategory(tab.id)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                category === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filtro Rápido por Posição */}
        {(category === 'all' || category === 'players') && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-slate-100">
            {[
              { id: 'todas', label: 'Todas Posições' },
              { id: 'atacante', label: 'Atacantes' },
              { id: 'meio-campista', label: 'Meias' },
              { id: 'defensor', label: 'Defensores' },
              { id: 'goleiro', label: 'Goleiros' },
            ].map((pos) => (
              <button
                key={pos.id}
                onClick={() => setSelectedPosition(pos.id)}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  selectedPosition === pos.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {pos.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Seção: Atletas Encontrados */}
      {(category === 'all' || category === 'players') && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Users className="h-4 w-4 text-blue-600" />
              Atletas Encontrados
            </h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
              {filteredPlayers.length}
            </span>
          </div>

          {filteredPlayers.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">
              Nenhum atleta encontrado para "{query}".
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredPlayers.map((player) => {
                const entry = seasonEntries.find(
                  (se) =>
                    se.seasonId === selectedSeasonId &&
                    se.playerId === player.id
                );
                const div =
                  divisions.find((d) => d.id === player.currentDivisionId) ||
                  divisions[0];
                const divStyle = getDivisionBadgeStyle(div.name);

                return (
                  <button
                    key={player.id}
                    onClick={() => onSelectPlayer(player.id)}
                    className="w-full py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-left active:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 font-display text-sm font-bold text-blue-700">
                        {player.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {player.displayName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 capitalize">
                          {player.neighborhood} · {player.position}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="font-mono text-xs font-extrabold text-blue-700">
                          {entry?.seasonPoints || 0} pts
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Seção: Partidas Encontradas */}
      {(category === 'all' || category === 'matches') && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Swords className="h-4 w-4 text-blue-600" />
              Partidas da Comunidade
            </h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
              {filteredMatches.length}
            </span>
          </div>

          {filteredMatches.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">
              Nenhuma partida encontrada para "{query}".
            </p>
          ) : (
            <div className="space-y-2.5">
              {filteredMatches.map((m) => {
                const badge = getMatchStatusBadge(m.status);
                const activeRes = matchResults.find(
                  (r) => r.id === m.activeResultVersionId
                );
                return (
                  <button
                    key={m.id}
                    onClick={() => onSelectMatch(m.id)}
                    className="w-full rounded-xl border border-slate-100 bg-slate-50 p-3 text-left space-y-1.5 hover:border-blue-200 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-500">
                        {m.venueName} · {m.format}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                      <span className="truncate max-w-[125px]">
                        {m.homeTeamName}
                      </span>
                      <span className="rounded-lg bg-white border border-slate-200 px-2.5 py-0.5 font-mono text-xs font-extrabold text-blue-700">
                        {m.status === 'validada'
                          ? `${m.officialHomeScore} x ${m.officialAwayScore}`
                          : activeRes
                            ? `${activeRes.homeScore} x ${activeRes.awayScore}`
                            : 'vs'}
                      </span>
                      <span className="truncate max-w-[125px] text-right">
                        {m.awayTeamName}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Seção: Campos e Arenas Comunitárias */}
      {(category === 'all' || category === 'venues') && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-blue-600" />
              Campos & Arenas de {activeCity.name}
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
              {venuesList.length}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {venuesList.map((venue) => (
              <button
                key={venue.name}
                onClick={() => {
                  setQuery(venue.name);
                  setCategory('matches');
                }}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-left hover:border-blue-200 transition"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {venue.name}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    Formatos: {Array.from(venue.formats).join(', ')}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                    {venue.count} {venue.count === 1 ? 'jogo' : 'jogos'}
                  </span>
                  <Trophy className="h-3.5 w-3.5 text-blue-600" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
