import React, { useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  CalendarCheck,
  Percent,
  Shield,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useLeague } from '../lib/store/LeagueContext';
import { getDivisionBadgeStyle } from '../lib/engine/eloEngine';
import { TeamCrestBadge } from './TeamCrestBadge';

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
  | 'cartoes'
  | 'cartoes_amarelos'
  | 'cartao_azul';

const RealisticSoccerBallIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={`${className} shrink-0 drop-shadow-sm`} fill="none">
    <defs>
      <radialGradient id="icon-ballShine" cx="35%" cy="30%" r="65%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="45%" stopColor="#f1f5f9" />
        <stop offset="80%" stopColor="#cbd5e1" />
        <stop offset="100%" stopColor="#64748b" />
      </radialGradient>
      <linearGradient id="icon-patchGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#1e293b" />
        <stop offset="100%" stopColor="#020617" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="10" fill="url(#icon-ballShine)" stroke="#94a3b8" strokeWidth="0.8" />
    <polygon points="12,8 15,10.2 13.8,13.6 10.2,13.6 9,10.2" fill="url(#icon-patchGrad)" />
    <path d="M12 8 L12 4" stroke="#475569" strokeWidth="0.8" strokeLinecap="round" />
    <path d="M15 10.2 L19 8.5" stroke="#475569" strokeWidth="0.8" strokeLinecap="round" />
    <path d="M13.8 13.6 L17 17" stroke="#475569" strokeWidth="0.8" strokeLinecap="round" />
    <path d="M10.2 13.6 L7 17" stroke="#475569" strokeWidth="0.8" strokeLinecap="round" />
    <path d="M9 10.2 L5 8.5" stroke="#475569" strokeWidth="0.8" strokeLinecap="round" />
    <polygon points="10.5,2 13.5,2 12,4" fill="url(#icon-patchGrad)" />
    <polygon points="21,7.5 21.8,11 19,8.5" fill="url(#icon-patchGrad)" />
    <polygon points="18,18.5 15.5,20.5 17,17" fill="url(#icon-patchGrad)" />
    <polygon points="6,18.5 8.5,20.5 7,17" fill="url(#icon-patchGrad)" />
    <polygon points="3,7.5 2.2,11 5,8.5" fill="url(#icon-patchGrad)" />
    <ellipse cx="8.5" cy="7" rx="3" ry="1.5" fill="#ffffff" fillOpacity="0.6" transform="rotate(-30 8.5 7)" />
  </svg>
);

const RealisticCalendarIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={`${className} shrink-0 drop-shadow-sm`} fill="none">
    <defs>
      <linearGradient id="icon-calBody" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#e2e8f0" />
      </linearGradient>
      <linearGradient id="icon-calHeader" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </linearGradient>
      <linearGradient id="icon-ringGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#cbd5e1" />
        <stop offset="50%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#64748b" />
      </linearGradient>
    </defs>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="url(#icon-calBody)" stroke="#cbd5e1" strokeWidth="0.8" />
    <path d="M3.5 8.5 C3.5 6.6 5 5 7 5 L17 5 C19 5 20.5 6.6 20.5 8.5 L20.5 9.5 L3.5 9.5 Z" fill="url(#icon-calHeader)" />
    <rect x="7" y="3" width="2" height="4" rx="1" fill="url(#icon-ringGrad)" stroke="#475569" strokeWidth="0.5" />
    <rect x="15" y="3" width="2" height="4" rx="1" fill="url(#icon-ringGrad)" stroke="#475569" strokeWidth="0.5" />
    <circle cx="12" cy="14.5" r="4" fill="#10b981" />
    <path d="M9.8 14.5 L11.3 16 L14.5 12.8" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RealisticAverageGoalsIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={`${className} shrink-0 drop-shadow-sm`} fill="none">
    <defs>
      <linearGradient id="icon-bar1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#0284c7" />
      </linearGradient>
      <linearGradient id="icon-bar2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#818cf8" />
        <stop offset="100%" stopColor="#4f46e5" />
      </linearGradient>
      <linearGradient id="icon-bar3" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f472b6" />
        <stop offset="100%" stopColor="#db2777" />
      </linearGradient>
    </defs>
    <rect x="2.5" y="19" width="19" height="1.8" rx="0.9" fill="#475569" />
    <rect x="4" y="12" width="3.8" height="7" rx="1" fill="url(#icon-bar1)" stroke="#bae6fd" strokeWidth="0.5" />
    <rect x="10.1" y="8" width="3.8" height="11" rx="1" fill="url(#icon-bar2)" stroke="#e0e7ff" strokeWidth="0.5" />
    <rect x="16.2" y="4.5" width="3.8" height="14.5" rx="1" fill="url(#icon-bar3)" stroke="#fce7f3" strokeWidth="0.5" />
    <path d="M5.5 10 L11.5 6 L18.5 3.5" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 3.5 L18.5 3.5 L18.5 6" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RealisticGoldenStarIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={`${className} shrink-0 drop-shadow-sm`} fill="none">
    <defs>
      <radialGradient id="icon-starShine" cx="50%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="35%" stopColor="#facc15" />
        <stop offset="75%" stopColor="#eab308" />
        <stop offset="100%" stopColor="#ca8a04" />
      </radialGradient>
    </defs>
    <path
      d="M12 2.5 L14.7 8 L20.7 8.9 L16.3 13.2 L17.4 19.2 L12 16.3 L6.6 19.2 L7.7 13.2 L3.3 8.9 L9.3 8 Z"
      fill="url(#icon-starShine)"
      stroke="#b45309"
      strokeWidth="0.8"
      strokeLinejoin="round"
    />
    <path d="M12 2.5 L12 16.3 L14.7 8 Z" fill="#ffffff" fillOpacity="0.4" />
    <path d="M12 2.5 L12 16.3 L9.3 8 Z" fill="#ca8a04" fillOpacity="0.35" />
    <path d="M12 16.3 L16.3 13.2 L17.4 19.2 Z" fill="#92400e" fillOpacity="0.35" />
    <circle cx="12" cy="10" r="1.3" fill="#ffffff" />
  </svg>
);

const RealisticEfficiencyIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={`${className} shrink-0 drop-shadow-sm`} fill="none">
    <defs>
      <radialGradient id="icon-gaugeBg" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#064e3b" />
        <stop offset="100%" stopColor="#022c22" />
      </radialGradient>
      <linearGradient id="icon-greenArc" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#6ee7b7" />
        <stop offset="100%" stopColor="#10b981" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="9.5" fill="url(#icon-gaugeBg)" stroke="#059669" strokeWidth="0.8" />
    <circle cx="12" cy="12" r="7" stroke="#065f46" strokeWidth="2.2" />
    <path
      d="M 7.1 16.9 A 7 7 0 1 1 18.5 13.8"
      stroke="url(#icon-greenArc)"
      strokeWidth="2.4"
      strokeLinecap="round"
      fill="none"
    />
    <text x="12" y="14" textAnchor="middle" fill="#a7f3d0" fontSize="6.5" fontWeight="900" fontFamily="sans-serif">
      %
    </text>
  </svg>
);

const RealisticGoalkeeperIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={`${className} shrink-0 drop-shadow-sm`} fill="none">
    <defs>
      <linearGradient id="icon-gkShield" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="50%" stopColor="#0284c7" />
        <stop offset="100%" stopColor="#0369a1" />
      </linearGradient>
      <linearGradient id="icon-gkGold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="100%" stopColor="#f59e0b" />
      </linearGradient>
    </defs>
    <path
      d="M12 2.5 L19 5.5 C19 13 14.5 18 12 20.5 C9.5 18 5 13 5 5.5 Z"
      fill="url(#icon-gkShield)"
      stroke="#bae6fd"
      strokeWidth="0.8"
    />
    <path
      d="M9.5 9.5 C9.5 8 10.5 7 11.5 7 C12.2 7 12.8 7.5 13.2 8 C13.6 7.5 14.2 7 15 7 C16 7 16.8 8 16.8 9.5 L16.8 12 C16.8 14.5 15 16.5 12.5 16.5 C10.2 16.5 8.5 14.5 8.5 12.5 L8.5 11.2 C7.8 11.2 7.2 10.5 7.2 9.7 C7.2 8.8 7.8 8.2 8.5 8.2 L9.5 9.5 Z"
      fill="url(#icon-gkGold)"
      stroke="#78350f"
      strokeWidth="0.5"
    />
    <path d="M12 3.5 L17.5 6 C17.5 12 14.5 16.5 12 19 Z" fill="#ffffff" fillOpacity="0.25" />
  </svg>
);

const RealisticYellowCardIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={`${className} shrink-0 drop-shadow-sm`} fill="none">
    <defs>
      <linearGradient id="icon-yellowCardGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="40%" stopColor="#facc15" />
        <stop offset="100%" stopColor="#eab308" />
      </linearGradient>
      <linearGradient id="icon-yellowCardSheen" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
        <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
    </defs>
    <rect
      x="7"
      y="4"
      width="11"
      height="16"
      rx="2"
      fill="#713f12"
      transform="rotate(6 12.5 12)"
      opacity="0.3"
    />
    <rect
      x="6.5"
      y="4"
      width="11"
      height="16"
      rx="2"
      fill="url(#icon-yellowCardGrad)"
      stroke="#ca8a04"
      strokeWidth="0.8"
      transform="rotate(-5 12 12)"
    />
    <path
      d="M7.5 5 L15 5 L9.5 18 L7.5 18 Z"
      fill="url(#icon-yellowCardSheen)"
      transform="rotate(-5 12 12)"
    />
  </svg>
);

const RealisticBlueCardIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={`${className} shrink-0 drop-shadow-sm`} fill="none">
    <defs>
      <linearGradient id="icon-blueCardGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="40%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </linearGradient>
      <linearGradient id="icon-blueCardSheen" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
        <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
    </defs>
    <rect
      x="7"
      y="4"
      width="11"
      height="16"
      rx="2"
      fill="#0f172a"
      transform="rotate(6 12.5 12)"
      opacity="0.35"
    />
    <rect
      x="6.5"
      y="4"
      width="11"
      height="16"
      rx="2"
      fill="url(#icon-blueCardGrad)"
      stroke="#1e40af"
      strokeWidth="0.8"
      transform="rotate(-5 12 12)"
    />
    <path
      d="M7.5 5 L15 5 L9.5 18 L7.5 18 Z"
      fill="url(#icon-blueCardSheen)"
      transform="rotate(-5 12 12)"
    />
  </svg>
);

const RealisticThreeCardsIcon: React.FC<{ className?: string }> = ({ className = 'h-4 w-7' }) => (
  <svg viewBox="0 0 28 24" className={`${className} shrink-0 drop-shadow-sm`} fill="none">
    <defs>
      <linearGradient id="icon-3c-yellow" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="45%" stopColor="#facc15" />
        <stop offset="100%" stopColor="#eab308" />
      </linearGradient>
      <linearGradient id="icon-3c-blue" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="45%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </linearGradient>
      <linearGradient id="icon-3c-red" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f87171" />
        <stop offset="45%" stopColor="#ef4444" />
        <stop offset="100%" stopColor="#b91c1c" />
      </linearGradient>
      <linearGradient id="icon-3c-sheen" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
        <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
    </defs>

    {/* Amarelo (Esquerda) */}
    <g transform="rotate(-15 8 13)">
      <rect x="3.5" y="4" width="8.5" height="13.5" rx="1.5" fill="url(#icon-3c-yellow)" stroke="#ca8a04" strokeWidth="0.6" />
      <path d="M4.2 4.5 L10.5 4.5 L5.8 17 L4.2 17 Z" fill="url(#icon-3c-sheen)" />
    </g>

    {/* Azul (Centro) */}
    <g transform="translate(0, -1)">
      <rect x="9.7" y="4" width="8.5" height="13.5" rx="1.5" fill="url(#icon-3c-blue)" stroke="#1e40af" strokeWidth="0.6" />
      <path d="M10.4 4.5 L16.7 4.5 L12 17 L10.4 17 Z" fill="url(#icon-3c-sheen)" />
    </g>

    {/* Vermelho (Direita) */}
    <g transform="rotate(15 20 13)">
      <rect x="15.8" y="4" width="8.5" height="13.5" rx="1.5" fill="url(#icon-3c-red)" stroke="#991b1b" strokeWidth="0.6" />
      <path d="M16.5 4.5 L22.8 4.5 L18.1 17 L16.5 17 Z" fill="url(#icon-3c-sheen)" />
    </g>
  </svg>
);

const getCategoryRealisticIcon = (id: ExcelRankingCategory, className = 'h-4 w-4') => {
  switch (id) {
    case 'artilharia':
      return <RealisticSoccerBallIcon className={className} />;
    case 'presencas':
      return <RealisticCalendarIcon className={className} />;
    case 'media_gols':
      return <RealisticAverageGoalsIcon className={className} />;
    case 'super_capas':
      return <RealisticGoldenStarIcon className={className} />;
    case 'aproveitamento_capas':
      return <RealisticEfficiencyIcon className={className} />;
    case 'capas_goleiro':
      return <RealisticGoalkeeperIcon className={className} />;
    case 'cartoes':
      return <RealisticThreeCardsIcon className={className} />;
    case 'cartoes_amarelos':
      return <RealisticYellowCardIcon className={className} />;
    case 'cartao_azul':
      return <RealisticBlueCardIcon className={className} />;
  }
};

const CATEGORY_TABS: Array<{
  id: ExcelRankingCategory;
  label: string;
  shortLabel: string;
  subtitle: string;
  unit: string;
  barColor: string;
  isWide?: boolean;
}> = [
  {
    id: 'artilharia',
    label: 'Artilharia',
    shortLabel: 'Artilharia',
    subtitle: 'Total de gols marcados na temporada',
    unit: 'gols',
    barColor: 'bg-blue-600',
  },
  {
    id: 'presencas',
    label: 'Presenças Constantes',
    shortLabel: 'Presenças',
    subtitle: 'Assiduidade nos jogos e babas da Liga',
    unit: 'jogos',
    barColor: 'bg-blue-600',
  },
  {
    id: 'media_gols',
    label: 'Média de Gols',
    shortLabel: 'Média Gols',
    subtitle: 'Relação de Gols Marcados ÷ Presenças',
    unit: 'gols/jogo',
    barColor: 'bg-blue-700',
  },
  {
    id: 'super_capas',
    label: 'Super Capas',
    shortLabel: 'Super Capas',
    subtitle: 'Destaques gerais da rodada conquistados',
    unit: 'capas',
    barColor: 'bg-blue-600',
  },
  {
    id: 'aproveitamento_capas',
    label: 'Melhor Aproveitamento Capas',
    shortLabel: 'Aprov. Capas',
    subtitle: 'Percentual de Super Capas por presença confirmada',
    unit: '%',
    barColor: 'bg-blue-600',
  },
  {
    id: 'capas_goleiro',
    label: 'Capas Goleiro',
    shortLabel: 'Capas GK',
    subtitle: 'Ranking exclusivo dos paredões da Liga',
    unit: 'capas',
    barColor: 'bg-blue-600',
  },
  {
    id: 'cartoes',
    label: 'Controle Disciplinar (3 Cartões)',
    shortLabel: '3 Cartões (Amarelo · Azul · Vermelho)',
    subtitle: 'Controle disciplinar oficial dos 3 cartões na temporada',
    unit: 'cartões',
    barColor: 'bg-amber-500',
    isWide: true,
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
    currentUser,
    currentPlayerProfile,
  } = useLeague();

  const userTeamName =
    currentUser?.teamName ||
    currentPlayerProfile?.teamName ||
    'Meu Time';

  const userTeamCrest =
    currentUser?.teamCrestUrl ||
    currentPlayerProfile?.teamCrestUrl ||
    profiles.find((p) => p.teamName === userTeamName && p.teamCrestUrl)?.teamCrestUrl;

  const [category, setCategory] = useState<ExcelRankingCategory>('artilharia');
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
        const redCards = entry.redCards ?? 0;
        const totalCards = yellowCards + blueCards + redCards;
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
          redCards,
          totalCards,
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
      if (category === 'cartoes') {
        return item.totalCards > 0;
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
        case 'cartoes':
          if (b.totalCards !== a.totalCards) return b.totalCards - a.totalCards;
          if (b.redCards !== a.redCards) return b.redCards - a.redCards;
          if (b.blueCards !== a.blueCards) return b.blueCards - a.blueCards;
          return b.yellowCards - a.yellowCards;
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

  const searchedRows = enrichedRows;

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
      case 'cartoes':
        return row.totalCards;
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
      case 'cartoes':
        return `${row.totalCards}`;
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

  const maxSingleCard = useMemo(() => {
    if (enrichedRows.length === 0) return 1;
    const maxVal = Math.max(
      ...enrichedRows.map((r) =>
        Math.max(r.yellowCards, r.blueCards, r.redCards)
      )
    );
    return Math.max(maxVal, 1);
  }, [enrichedRows]);

  return (
    <div className="space-y-3 pb-8">
      {/* 1. Card Oficial Glass com Imagem de Fundo Padrão (Otimizado Mobile) */}
      <div className="w-full rounded-2xl border border-blue-300/30 bg-gradient-to-b from-[#0a1435]/85 via-[#07112c]/90 to-[#030612]/95 p-3 text-white shadow-md relative overflow-hidden backdrop-blur-md space-y-2.5">
        {/* Imagem de Fundo Padrão Oficial do Estádio com Refletores */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-40"
          style={{
            backgroundImage: "url('/images/stadium-super-capas.jpg')",
          }}
        />
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-blue-950/60 via-slate-900/75 to-slate-950/85 pointer-events-none" />

        {/* Efeito Glow Luminoso Decorativo */}
        <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-blue-500/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-2.5">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <TeamCrestBadge
                name={userTeamName}
                crestUrl={userTeamCrest}
                size={38}
                className="shrink-0 drop-shadow-md"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[10px] font-bold text-amber-300 uppercase tracking-wide">
                  <Sparkles className="h-3 w-3 shrink-0" />
                  <span className="truncate">{activeCity.name}-{activeCity.stateCode}</span>
                </div>
                <h1 className="text-xs sm:text-sm font-black uppercase text-white font-display tracking-wide truncate">
                  Estatísticas Oficiais {userTeamName}
                </h1>
                <p className="text-[10px] text-blue-200/80 truncate">
                  {activeTabInfo.label} — {activeTabInfo.subtitle}
                </p>
              </div>
            </div>

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/20 text-amber-300 shadow-sm backdrop-blur-md">
              <Trophy className="h-4 w-4" />
            </div>
          </div>

          {/* Grade de Botões das 8 Categorias do Excel com visual Glass compacto */}
          <div className="grid grid-cols-2 gap-1">
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
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] font-bold transition backdrop-blur-md active:scale-[0.98] ${
                    tab.isWide ? 'col-span-2' : ''
                  } ${
                    isSelected
                      ? 'border-blue-400 bg-blue-600/90 text-white shadow-xs'
                      : 'border-white/15 bg-white/10 text-slate-200 hover:border-white/30 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  <div className="shrink-0 flex items-center justify-center">
                    {getCategoryRealisticIcon(tab.id, tab.isWide ? 'h-4 w-7' : 'h-4 w-4')}
                  </div>
                  <span className="truncate">{tab.shortLabel}</span>
                  {isSelected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_5px_#67e8f9] shrink-0 ml-auto" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Gráfico Visual de Barras (Otimizado Mobile) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            {getCategoryRealisticIcon(category, 'h-4 w-4')}
            <span className="truncate">Gráfico · {activeTabInfo.label}</span>
          </div>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700 shrink-0">
            Top {Math.min(8, searchedRows.length)}
          </span>
        </div>

        <div className="space-y-2">
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
                className="w-full text-left space-y-0.5 group active:scale-[0.99] transition"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-800 group-hover:text-blue-700 truncate max-w-[170px] xs:max-w-[210px]">
                    {row.rankPosition}º {row.profile.displayName}
                  </span>
                  <div className="flex items-center gap-1.5 font-mono shrink-0">
                    {category === 'media_gols' && (
                      <span className="text-[9px] text-slate-400">
                        {row.goals}G/{row.presences}J
                      </span>
                    )}
                    {category === 'aproveitamento_capas' && (
                      <span className="text-[9px] text-slate-400">
                        {row.superCapas}C/{row.presences}J
                      </span>
                    )}
                    {category === 'cartoes' && (
                      <span className="text-[9px] text-slate-500 font-mono">
                        🟨{row.yellowCards} 🟦{row.blueCards} 🟥{row.redCards}
                      </span>
                    )}
                    <span className="font-extrabold text-blue-700 text-xs">
                      {formatMetricDisplay(row)} {activeTabInfo.unit}
                    </span>
                  </div>
                </div>

                {category === 'cartoes' ? (
                  <div className="space-y-1 pt-1">
                    {/* Barra 1: Cartão Amarelo */}
                    <div className="flex items-center gap-1.5 text-[9px] font-mono">
                      <span className="w-13 text-amber-700 font-bold flex items-center gap-1 shrink-0">
                        <span className="inline-block w-2 h-2.5 bg-amber-400 border border-amber-500 rounded-[2px]" />
                        <span>{row.yellowCards} Am</span>
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-amber-400 transition-all duration-300 shadow-2xs"
                          style={{
                            width: `${row.yellowCards > 0 ? Math.max(10, Math.round((row.yellowCards / maxSingleCard) * 100)) : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Barra 2: Cartão Azul */}
                    <div className="flex items-center gap-1.5 text-[9px] font-mono">
                      <span className="w-13 text-blue-700 font-bold flex items-center gap-1 shrink-0">
                        <span className="inline-block w-2 h-2.5 bg-blue-500 border border-blue-600 rounded-[2px]" />
                        <span>{row.blueCards} Az</span>
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-300 shadow-2xs"
                          style={{
                            width: `${row.blueCards > 0 ? Math.max(10, Math.round((row.blueCards / maxSingleCard) * 100)) : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Barra 3: Cartão Vermelho */}
                    <div className="flex items-center gap-1.5 text-[9px] font-mono">
                      <span className="w-13 text-red-700 font-bold flex items-center gap-1 shrink-0">
                        <span className="inline-block w-2 h-2.5 bg-red-500 border border-red-600 rounded-[2px]" />
                        <span>{row.redCards} Vm</span>
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-red-500 transition-all duration-300 shadow-2xs"
                          style={{
                            width: `${row.redCards > 0 ? Math.max(10, Math.round((row.redCards / maxSingleCard) * 100)) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${activeTabInfo.barColor}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Lista Completa da Categoria Selecionada (Otimizada Mobile) */}
      <div className="space-y-2">
        {visibleRows.map((row) => {
          const { profile, rankPosition } = row;

          return (
            <button
              key={row.entry.id}
              type="button"
              onClick={() => onInspectPlayer(profile.id)}
              className="w-full text-left rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs transition active:scale-[0.99] hover:border-blue-300 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-black ${
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
                    <div className="font-extrabold text-xs text-slate-900 truncate">
                      {profile.displayName}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500 capitalize truncate">
                      <span>{profile.position}</span>
                      {profile.neighborhood && (
                        <>
                          <span>·</span>
                          <span className="truncate">{profile.neighborhood}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Valor Principal da Categoria */}
                <div className="text-right font-mono shrink-0">
                  <div className="text-base font-black text-blue-700 leading-none">
                    {formatMetricDisplay(row)}
                  </div>
                  <div className="mt-0.5 text-[9px] font-bold uppercase text-slate-400">
                    {activeTabInfo.unit}
                  </div>
                </div>
              </div>

              {/* Linha de Resumo Completo da Planilha Excel */}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-100 pt-1.5 text-[10px] text-slate-600 font-mono">
                <div className="flex items-center gap-2">
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

                <div className="flex items-center gap-1.5">
                  {profile.position === 'goleiro' ? (
                    <span className="rounded bg-blue-50 px-1.5 py-0.2 text-[9px] font-bold text-blue-700 border border-blue-100">
                      <Shield className="inline h-2.5 w-2.5 mr-0.5" />
                      {row.goalkeeperCapas} Capas GK
                    </span>
                  ) : (
                    <span className="rounded bg-blue-50 px-1.5 py-0.2 text-[9px] font-bold text-blue-700 border border-blue-100">
                      <Award className="inline h-2.5 w-2.5 mr-0.5" />
                      {row.superCapas} Capas ({row.capaEfficiencyPct}%)
                    </span>
                  )}

                  {/* Mostrador dos 3 Cartões Juntos com 3 Barras Coloridas */}
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span
                      title={`Cartões: ${row.yellowCards} Amarelo(s), ${row.blueCards} Azul(is), ${row.redCards} Vermelho(s)`}
                      className="inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-200/90 px-1.5 py-0.2 text-[9px] font-mono font-bold shrink-0 shadow-2xs"
                    >
                      <span className="inline-flex items-center gap-0.5 text-amber-700" title="Amarelos">
                        <span className="inline-block w-2 h-2.5 bg-amber-400 border border-amber-500 rounded-[2px]" />
                        {row.yellowCards}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-0.5 text-blue-700" title="Azuis">
                        <span className="inline-block w-2 h-2.5 bg-blue-500 border border-blue-600 rounded-[2px]" />
                        {row.blueCards}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-0.5 text-red-700" title="Vermelhos">
                        <span className="inline-block w-2 h-2.5 bg-red-500 border border-red-600 rounded-[2px]" />
                        {row.redCards}
                      </span>
                    </span>

                    {/* 3 Barras Visuais uma para cada cartão */}
                    <div className="flex items-center gap-0.5 w-16 h-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{
                          width: `${row.totalCards > 0 ? (row.yellowCards / row.totalCards) * 100 : 0}%`,
                        }}
                      />
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{
                          width: `${row.totalCards > 0 ? (row.blueCards / row.totalCards) * 100 : 0}%`,
                        }}
                      />
                      <div
                        className="h-full bg-red-500 rounded-full transition-all"
                        style={{
                          width: `${row.totalCards > 0 ? (row.redCards / row.totalCards) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        {/* Botão para ver todos ou recolher */}
        {searchedRows.length > 12 && (
          <button
            type="button"
            onClick={() => setShowAllRows((v) => !v)}
            className="w-full rounded-xl border border-blue-200 bg-white py-2.5 text-xs font-bold text-blue-700 shadow-xs hover:bg-blue-50 transition"
          >
            {showAllRows
              ? 'Mostrar Apenas o Top 12'
              : `Ver Todos os ${searchedRows.length} Atletas`}
          </button>
        )}
      </div>
    </div>
  );
};
