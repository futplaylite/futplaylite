import React, { useMemo, useState } from 'react';
import { ChevronRight, Search, Star, X } from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { TeamCrestBadge } from './TeamCrestBadge';
import { PlayerProfile } from '../types/league';

interface SearchViewProps {
  onSelectPlayer: (playerId: string) => void;
  onSelectMatch?: (matchId: string) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  onSelectPlayer,
}) => {
  const { profiles, seasonEntries, selectedSeasonId } = useLeague();
  const [query, setQuery] = useState<string>('');

  const getTeamCrest = (teamName?: string, directCrest?: string) => {
    if (directCrest) return directCrest;
    if (!teamName) return undefined;
    const match = profiles.find((prof) => prof.teamName === teamName && prof.teamCrestUrl);
    return match?.teamCrestUrl;
  };

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

  const normalizedQuery = query.trim().toLowerCase();

  const filteredPlayers = useMemo(() => {
    return [...profiles]
      .filter((p) => {
        if (!normalizedQuery) return true;
        return (
          p.displayName.toLowerCase().includes(normalizedQuery) ||
          (p.teamName && p.teamName.toLowerCase().includes(normalizedQuery)) ||
          (p.position && p.position.toLowerCase().includes(normalizedQuery)) ||
          (p.neighborhood && p.neighborhood.toLowerCase().includes(normalizedQuery))
        );
      })
      .sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'pt-BR', { sensitivity: 'base' })
      );
  }, [profiles, normalizedQuery]);

  return (
    <div className="space-y-3">
      {/* Barra de Pesquisa */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar jogador na liga..."
          className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-10 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none transition"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Lista de Atletas em Ordem Alfabética */}
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {filteredPlayers.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Nenhum jogador encontrado.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredPlayers.map((player) => {
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
                <button
                  key={player.id}
                  type="button"
                  onClick={() => onSelectPlayer(player.id)}
                  className="w-full px-2.5 py-2 flex items-center justify-between gap-2.5 text-left hover:bg-slate-50 active:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="shrink-0 flex items-center justify-center">
                      <TeamCrestBadge
                        name={player.teamName || 'Sem Time'}
                        crestUrl={player.teamCrestUrl || getTeamCrest(player.teamName)}
                        size={34}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate uppercase">
                          {player.displayName}
                        </span>
                        {player.teamName && (
                          <span className="shrink-0 text-[9px] text-amber-700 font-bold bg-amber-50 border border-amber-200/80 rounded px-1.5 py-0.5 truncate max-w-[110px]">
                            {player.teamName}
                          </span>
                        )}
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

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="text-right">
                      {(() => {
                        const stars = getPlayerDisplayStars(player);
                        return stars > 0 ? (
                          <div className="font-mono text-[11px] font-black text-amber-500 flex items-center justify-end gap-1">
                            <span>{stars.toFixed(1)}</span>
                            <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                          </div>
                        ) : (
                          <div className="font-mono text-[11px] font-medium text-slate-300 flex items-center justify-end gap-1" title="Ainda não avaliado">
                            <span>0.0</span>
                            <Star className="h-3 w-3 text-slate-300" />
                          </div>
                        );
                      })()}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
