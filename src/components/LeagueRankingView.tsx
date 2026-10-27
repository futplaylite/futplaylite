import React, { useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  CalendarCheck,
  Percent,
  Search,
  Shield,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { getDivisionBadgeStyle } from '../lib/engine/eloEngine';

interface LeagueRankingViewProps {
  onInspectPlayer: (playerId: string) => void;
}

type ExcelRankingCategory =
  | 'artilharia'
  | 'presencas'
  | 'media_gols'
  | 'super_capas'
  | 'aproveitamento_capas'
  | 'capas_goleiro'
  | 'cartoes_amarelos'
  | 'cartao_azul';

const CATEGORY_TABS: Array<{
  id: ExcelRankingCategory;
  label: string;
  shortLabel: string;
  subtitle: string;
  unit: string;
  barColor: string;
}> = [
  {
    id: 'artilharia',
    label: 'Artilharia',
    shortLabel: '⚽ Artilharia',
    subtitle: 'Total de gols marcados na temporada',
    unit: 'gols',
    barColor: 'bg-blue-600',
  },
  {
    id: 'presencas',
    label: 'Presenças Constantes',
    shortLabel: '📅 Presenças',
    subtitle: 'Assiduidade nos jogos e babas da Liga',
    unit: 'jogos',
    barColor: 'bg-blue-600',
  },
  {
    id: 'media_gols',
    label: 'Média de Gols',
    shortLabel: '📊 Média de Gols',
    subtitle: 'Relação de Gols Marcados ÷ Presenças',
    unit: 'gols/jogo',
    barColor: 'bg-blue-700',
  },
  {
    id: 'super_capas',
    label: 'Super Capas',
    shortLabel: '⭐ Super Capas',
    subtitle: 'Destaques gerais da rodada conquistados',
    unit: 'capas',
    barColor: 'bg-blue-600',
  },
  {
    id: 'aproveitamento_capas',
    label: 'Melhor Aproveitamento Capas',
    shortLabel: '📈 Aprov. Capas %',
    subtitle: 'Percentual de Super Capas por presença confirmada',
    unit: '%',
    barColor: 'bg-blue-600',
  },
  {
    id: 'capas_goleiro',
    label: 'Capas Goleiro',
    shortLabel: '🧤 Capas Goleiro',
    subtitle: 'Ranking exclusivo dos paredões da Liga',
    unit: 'capas',
    barColor: 'bg-blue-600',
  },
  {
    id: 'cartoes_amarelos',
    label: 'Cartões Amarelos',
    shortLabel: '🟨 Cartões Amarelos',
    subtitle: 'Controle disciplinar de cartões amarelos',
    unit: 'amarelos',
    barColor: 'bg-amber-500',
  },
  {
    id: 'cartao_azul',
    label: 'Cartão Azul',
    shortLabel: '🟦 Cartão Azul',
    subtitle: 'Controle disciplinar de cartões azuis',
    unit: 'azul',
    barColor: 'bg-blue-600',
  },
];

export const LeagueRankingView: React.FC<LeagueRankingViewProps> = ({
  onInspectPlayer,
}) => {
  const {
    profiles,
    seasonEntries,
    divisions,
    cities,
    selectedCityId,
    selectedSeasonId,
  } = useLeague();

  const [category, setCategory] = useState<ExcelRankingCategory>('artilharia');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAllRows, setShowAllRows] = useState<boolean>(false);

  const activeCity =
    cities.find((c) => c.id === selectedCityId) || cities[0];
  const activeTabInfo =
    CATEGORY_TABS.find((t) => t.id === category) || CATEGORY_TABS[0];

  const enrichedRows = useMemo(() => {
    const entries = seasonEntries.filter(
      (se) => se.seasonId === selectedSeasonId
    );

    const joined = entries
      .map((entry) => {
        const profile = profiles.find((p) => p.id === entry.playerId);
        if (!profile || profile.cityId !== selectedCityId) return null;

        const division =
          divisions.find((d) => d.id === entry.divisionId) ||
          divisions.find((d) => d.id === profile.currentDivisionId) ||
          divisions[0];

        const goals = entry.goals || 0;
        const presences = entry.matchesPlayed || 0;
        const superCapas = entry.superCapas ?? entry.mvpCount ?? 0;
        const goalkeeperCapas = entry.goalkeeperCapas ?? 0;
        const capaEfficiencyPct =
          entry.capaEfficiencyPct ??
          (presences > 0 ? Math.round((superCapas / presences) * 100) : 0);
        const yellowCards = entry.yellowCards ?? 0;
        const blueCards = entry.blueCards ?? 0;
        const goalsAverage =
          presences > 0 ? Number((goals / presences).toFixed(2)) : 0;

        return {
          entry,
          profile,
          division,
          goals,
          presences,
          superCapas,
          goalkeeperCapas,
          capaEfficiencyPct,
          yellowCards,
          blueCards,
          goalsAverage,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Filtra de acordo com a categoria selecionada (igual aos gráficos da planilha Excel)
    const filteredByCategory = joined.filter((item) => {
      if (category === 'capas_goleiro') {
        return item.profile.position === 'goleiro' || item.goalkeeperCapas > 0;
      }
      if (category === 'artilharia') {
        return item.goals > 0;
      }
      if (category === 'media_gols') {
        return item.goals > 0 && item.presences > 0;
      }
      if (category === 'super_capas') {
        return item.superCapas > 0;
      }
      if (category === 'aproveitamento_capas') {
        return item.capaEfficiencyPct > 0 && item.profile.position !== 'goleiro';
      }
      if (category === 'cartoes_amarelos') {
        return item.yellowCards > 0;
      }
      if (category === 'cartao_azul') {
        return item.blueCards > 0;
      }
      return item.presences > 0;
    });

    // Ordenação oficial de cada gráfico da planilha Excel
    filteredByCategory.sort((a, b) => {
      switch (category) {
        case 'artilharia':
          if (b.goals !== a.goals) return b.goals - a.goals;
          return b.presences - a.presences;
        case 'presencas':
          if (b.presences !== a.presences) return b.presences - a.presences;
          return b.goals - a.goals;
        case 'media_gols':
          if (b.goals !== a.goals) return b.goals - a.goals;
          return b.goalsAverage - a.goalsAverage;
        case 'super_capas':
          if (b.superCapas !== a.superCapas) return b.superCapas - a.superCapas;
          return b.goals - a.goals;
        case 'aproveitamento_capas':
          if (b.capaEfficiencyPct !== a.capaEfficiencyPct) {
            return b.capaEfficiencyPct - a.capaEfficiencyPct;
          }
          return b.superCapas - a.superCapas;
        case 'capas_goleiro':
          if (b.goalkeeperCapas !== a.goalkeeperCapas) {
            return b.goalkeeperCapas - a.goalkeeperCapas;
          }
          return b.presences - a.presences;
        case 'cartoes_amarelos':
          if (b.yellowCards !== a.yellowCards) {
            return b.yellowCards - a.yellowCards;
          }
          return b.goals - a.goals;
        case 'cartao_azul':
          if (b.blueCards !== a.blueCards) return b.blueCards - a.blueCards;
          return b.goals - a.goals;
      }
    });

    return filteredByCategory.map((row, idx) => ({
      ...row,
      rankPosition: idx + 1,
    }));
  }, [
    seasonEntries,
    selectedSeasonId,
    profiles,
    selectedCityId,
    divisions,
    category,
  ]);

  const searchedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return enrichedRows;
    return enrichedRows.filter((r) =>
      r.profile.displayName.toLowerCase().includes(q)
    );
  }, [enrichedRows, searchQuery]);

  const visibleRows = showAllRows ? searchedRows : searchedRows.slice(0, 12);

  const getPrimaryMetricValue = (row: (typeof enrichedRows)[number]): number => {
    switch (category) {
      case 'artilharia':
        return row.goals;
      case 'presencas':
        return row.presences;
      case 'media_gols':
        return row.goalsAverage;
      case 'super_capas':
        return row.superCapas;
      case 'aproveitamento_capas':
        return row.capaEfficiencyPct;
      case 'capas_goleiro':
        return row.goalkeeperCapas;
      case 'cartoes_amarelos':
        return row.yellowCards;
      case 'cartao_azul':
        return row.blueCards;
    }
  };

  const formatMetricDisplay = (row: (typeof enrichedRows)[number]): string => {
    switch (category) {
      case 'artilharia':
        return `${row.goals}`;
      case 'presencas':
        return `${row.presences}`;
      case 'media_gols':
        return row.goalsAverage.toFixed(2).replace('.', ',');
      case 'super_capas':
        return `${row.superCapas}`;
      case 'aproveitamento_capas':
        return `${row.capaEfficiencyPct}%`;
      case 'capas_goleiro':
        return `${row.goalkeeperCapas}`;
      case 'cartoes_amarelos':
        return `${row.yellowCards}`;
      case 'cartao_azul':
        return `${row.blueCards}`;
    }
  };

  const maxMetricValue = useMemo(() => {
    if (enrichedRows.length === 0) return 1;
    return Math.max(...enrichedRows.map((r) => getPrimaryMetricValue(r)), 1);
  }, [enrichedRows, category]);

  return (
    <div className="space-y-4">
      {/* 1. Cabeçalho e Seletores das 8 Categorias da Planilha Excel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 uppercase tracking-wide">
              <Sparkles className="h-3.5 w-3.5" />
              Estatísticas Oficiais · {activeCity.name}-{activeCity.stateCode}
            </span>
            <h1 className="text-lg font-extrabold text-slate-900 uppercase font-display tracking-wide">
              {activeTabInfo.label}
            </h1>
            <p className="text-xs text-slate-500">{activeTabInfo.subtitle}</p>
          </div>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100 text-blue-600">
            <Trophy className="h-5 w-5" />
          </div>
        </div>

        {/* Grade de Botões das 8 Categorias do Excel */}
        <div className="grid grid-cols-2 gap-1.5">
          {CATEGORY_TABS.map((tab) => {
            const isSelected = category === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setCategory(tab.id);
                  setShowAllRows(false);
                }}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                  isSelected
                    ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-white'
                }`}
              >
                <span className="truncate">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Busca rápida por nome de atleta */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar atleta (ex.: Henrique, Melquiz, Palito, Deda...)"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* 2. Gráfico Visual de Barras (Espelhando o Painel Excel no Tema Branco & Azul) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            <span>Gráfico · {activeTabInfo.label}</span>
          </div>
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
            Top {Math.min(8, searchedRows.length)} em destaque
          </span>
        </div>

        <div className="space-y-2.5">
          {searchedRows.slice(0, 8).map((row) => {
            const val = getPrimaryMetricValue(row);
            const widthPct = Math.max(
              10,
              Math.round((val / maxMetricValue) * 100)
            );
            return (
              <button
                key={`chart-${row.profile.id}`}
                type="button"
                onClick={() => onInspectPlayer(row.profile.id)}
                className="w-full text-left space-y-1 group"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 group-hover:text-blue-700 truncate">
                    {row.rankPosition}º {row.profile.displayName}
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    {category === 'media_gols' && (
                      <span className="text-[10px] text-slate-400">
                        {row.goals}G / {row.presences}J
                      </span>
                    )}
                    {category === 'aproveitamento_capas' && (
                      <span className="text-[10px] text-slate-400">
                        {row.superCapas} capas / {row.presences}J
                      </span>
                    )}
                    <span className="font-extrabold text-blue-700">
                      {formatMetricDisplay(row)} {activeTabInfo.unit}
                    </span>
                  </div>
                </div>

                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${activeTabInfo.barColor}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Lista Completa da Categoria Selecionada */}
      <div className="space-y-2.5">
        {visibleRows.map((row) => {
          const { profile, division, rankPosition } = row;
          const divStyle = getDivisionBadgeStyle(division.name);

          return (
            <button
              key={row.entry.id}
              type="button"
              onClick={() => onInspectPlayer(profile.id)}
              className="w-full text-left rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition active:scale-[0.99] hover:border-blue-300"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-extrabold ${
                      rankPosition === 1
                        ? 'bg-blue-600 text-white shadow-xs'
                        : rankPosition <= 3
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {rankPosition}º
                  </span>

                  <div className="min-w-0">
                    <div className="font-extrabold text-sm text-slate-900 truncate">
                      {profile.displayName}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 capitalize">
                      <span>{profile.position}</span>
                      <span>·</span>
                      <span>{profile.neighborhood}</span>
                    </div>
                  </div>
                </div>

                {/* Valor Principal da Categoria */}
                <div className="text-right font-mono shrink-0">
                  <div className="text-lg font-extrabold text-blue-700 leading-none">
                    {formatMetricDisplay(row)}
                  </div>
                  <div className="mt-1 text-[10px] font-bold uppercase text-slate-400">
                    {activeTabInfo.unit}
                  </div>
                </div>
              </div>

              {/* Linha de Resumo Completo da Planilha Excel */}
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-600 font-mono">
                <div className="flex items-center gap-2.5">
                  <span title="Gols (Artilharia)">
                    ⚽ <strong>{row.goals}</strong>G
                  </span>
                  <span title="Presenças Constantes">
                    <CalendarCheck className="inline h-3 w-3 text-blue-600 mr-0.5" />
                    <strong>{row.presences}</strong>J
                  </span>
                  <span title="Média de Gols por Jogo">
                    📊 <strong>{row.goalsAverage.toFixed(2).replace('.', ',')}</strong>/J
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {profile.position === 'goleiro' ? (
                    <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                      <Shield className="inline h-3 w-3 mr-0.5" />
                      {row.goalkeeperCapas} Capas GK
                    </span>
                  ) : (
                    <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                      <Award className="inline h-3 w-3 mr-0.5" />
                      {row.superCapas} Capas ({row.capaEfficiencyPct}
                      <Percent className="inline h-2.5 w-2.5" />)
                    </span>
                  )}

                  {(row.yellowCards > 0 || row.blueCards > 0) && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold">
                      {row.yellowCards > 0 && (
                        <span className="rounded bg-amber-100 border border-amber-300 px-1.5 py-0.2 text-amber-800">
                          🟨 {row.yellowCards}
                        </span>
                      )}
                      {row.blueCards > 0 && (
                        <span className="rounded bg-blue-100 border border-blue-300 px-1.5 py-0.2 text-blue-800">
                          🟦 {row.blueCards}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {/* Botão para ver todos os 33 atletas ou recolher */}
        {searchedRows.length > 12 && (
          <button
            type="button"
            onClick={() => setShowAllRows((v) => !v)}
            className="w-full rounded-2xl border border-blue-200 bg-white py-3 text-xs font-bold text-blue-700 shadow-xs hover:bg-blue-50 transition"
          >
            {showAllRows
              ? 'Mostrar Apenas o Top 12'
              : `Ver Todos os ${searchedRows.length} Atletas desta Categoria`}
          </button>
        )}
      </div>
    </div>
  );
};
