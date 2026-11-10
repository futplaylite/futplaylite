import React, { useState } from 'react';
import {
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  Crown,
  Handshake,
  MapPin,
  Share2,
  Sparkles,
  Trophy,
} from 'lucide-react';

export const STADIUM_SUPER_CAPAS_BG = '/images/stadium-super-capas.jpg';

export interface SuperCapasPlayer {
  name: string;
  goals: number;
  isSub?: boolean;
  wins: number;
  draws: number;
  yellowCards?: number;
  blueCards?: number;
  redCards?: number;
}

export interface SuperCapasData {
  sumulaId?: string;
  matchDate: string;
  teamName: string;
  wins: number;
  draws: number;
  totalGoals: number;
  venueName?: string;
  players: SuperCapasPlayer[];
  isActive?: boolean;
}

interface SuperCapasCardProps {
  data: SuperCapasData;
  photoUrl: string;
  onPhotoUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onShare: () => void;
  onToggleActive?: () => void;
  isCoachOrAdmin?: boolean;
}

/**
 * Ícone 3D em SVG do Troféu Dourado com Coroa (Idêntico ao card de referência)
 */
export const Trophy3DIcon: React.FC<{ className?: string }> = ({
  className = 'w-16 h-16 sm:w-20 sm:h-20',
}) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 drop-shadow-[0_0_15px_rgba(250,204,21,0.65)]`}
  >
    <defs>
      <linearGradient id="goldCupGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="35%" stopColor="#FACC15" />
        <stop offset="70%" stopColor="#EAB308" />
        <stop offset="100%" stopColor="#B45309" />
      </linearGradient>
      <linearGradient id="goldShineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
        <stop offset="45%" stopColor="#FEF08A" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#CA8A04" stopOpacity="0.8" />
      </linearGradient>
    </defs>
    {/* Coroa no topo do troféu */}
    <path
      d="M38 18L44 26L50 16L56 26L62 18L60 30H40L38 18Z"
      fill="url(#goldCupGrad)"
      stroke="#FEF08A"
      strokeWidth="1.2"
    />
    {/* Alça Esquerda */}
    <path
      d="M35 38C22 38 20 54 34 60L36 55C26 51 27 42 36 42V38Z"
      fill="url(#goldCupGrad)"
    />
    {/* Alça Direita */}
    <path
      d="M65 38C78 38 80 54 66 60L64 55C74 51 73 42 64 42V38Z"
      fill="url(#goldCupGrad)"
    />
    {/* Corpo do Cálice */}
    <path
      d="M34 32H66V46C66 58 56 64 50 64C44 64 34 58 34 46V32Z"
      fill="url(#goldCupGrad)"
    />
    {/* Borda superior do cálice */}
    <rect x="32" y="30" width="36" height="4" rx="2" fill="#FEF08A" />
    {/* Brilho do cálice */}
    <path
      d="M38 34H43C42 45 44 56 46 62C42 60 38 54 38 46V34Z"
      fill="url(#goldShineGrad)"
    />
    {/* Haste Central */}
    <path d="M47 64H53V74H47V64Z" fill="url(#goldCupGrad)" />
    <rect x="44" y="72" width="12" height="3" rx="1.5" fill="#FEF08A" />
    {/* Base do Troféu */}
    <path d="M40 75H60L65 84H35L40 75Z" fill="url(#goldCupGrad)" />
    <rect
      x="32"
      y="84"
      width="36"
      height="5"
      rx="2"
      fill="#78350F"
      stroke="#FEF08A"
      strokeWidth="1"
    />
    {/* Estrelas de Brilho */}
    <circle cx="28" cy="22" r="1.5" fill="#FFFFFF" />
    <circle cx="72" cy="26" r="1.5" fill="#FFFFFF" />
    <circle cx="68" cy="68" r="1.5" fill="#FEF08A" />
  </svg>
);

/**
 * Ícone em SVG da Camisa de Futebol (Amarela para artilheiro, Azul para elenco)
 */
export const SoccerJerseyIcon: React.FC<{
  type: 'yellow' | 'blue';
  className?: string;
}> = ({ type, className = 'w-7 h-7 sm:w-8 sm:h-8' }) => {
  const isYellow = type === 'yellow';
  const mainColor = isYellow ? '#FACC15' : '#2563EB';
  const darkTrim = isYellow ? '#0F172A' : '#FFFFFF';
  const shadowColor = isYellow ? '#CA8A04' : '#1D4ED8';
  const highlightColor = isYellow ? '#FEF08A' : '#60A5FA';

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} shrink-0 drop-shadow-md`}
    >
      {/* Corpo e mangas da camisa */}
      <path
        d="M20 14L8 23C7 24 7 26 8 27L14 34C15 35 17 35 18 34L22 30V52C22 53.5 23.5 55 25 55H39C40.5 55 42 53.5 42 52V30L46 34C47 35 49 35 50 34L56 27C57 26 57 24 56 23L44 14C41 19 23 19 20 14Z"
        fill={mainColor}
      />
      {/* Sombreamento lateral */}
      <path
        d="M22 30V52C22 53.5 23.5 55 25 55H28V30H22Z"
        fill={shadowColor}
        opacity="0.35"
      />
      <path
        d="M42 30V52C42 53.5 40.5 55 39 55H36V30H42Z"
        fill={shadowColor}
        opacity="0.35"
      />
      {/* Brilho no ombro esquerdo */}
      <path
        d="M20 14L10 22L13 25L21 17L20 14Z"
        fill={highlightColor}
        opacity="0.45"
      />
      {/* Gola da Camisa */}
      <path
        d="M26 14C26 20 38 20 38 14C35 17 29 17 26 14Z"
        fill={darkTrim}
      />
      <path
        d="M28 14C28 18 36 18 36 14C34 16 30 16 28 14Z"
        fill={isYellow ? '#0F172A' : '#1E3A8A'}
      />
      {/* Punhos das Mangas */}
      <path
        d="M8 27L14 34L16 32L10 25L8 27Z"
        fill={darkTrim}
        opacity="0.9"
      />
      <path
        d="M56 27L50 34L48 32L54 25L56 27Z"
        fill={darkTrim}
        opacity="0.9"
      />
    </svg>
  );
};

export const SuperCapasCard: React.FC<SuperCapasCardProps> = ({
  data,
  photoUrl,
  onPhotoUpload,
  onShare,
  onToggleActive,
  isCoachOrAdmin,
}) => {
  const [photoIndex, setPhotoIndex] = useState<number>(0);

  const venueName = data.venueName || 'Arena Society Planalto - BA';

  return (
    <div className="w-full rounded-3xl border-2 border-blue-500/80 bg-gradient-to-b from-[#0a1435] via-[#07112c] to-[#040817] p-3.5 sm:p-5 text-white shadow-[0_0_25px_rgba(37,99,235,0.4)] relative overflow-hidden">
      {/* Imagem de Fundo Oficial do Estádio com Refletores */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-top bg-no-repeat pointer-events-none opacity-85"
        style={{
          backgroundImage: `url(${STADIUM_SUPER_CAPAS_BG})`,
        }}
      />
      {/* Camada Noturna com Gradiente Translúcido para Máxima Legibilidade */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#0a1435]/70 via-[#07112c]/80 to-[#030612]/92 pointer-events-none" />

      {/* Efeitos de Luz Estelar / Glow de Fundo */}
      <div className="absolute -top-12 -left-12 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-12 h-44 w-44 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

      {/* 2. CABEÇALHO PRINCIPAL: Troféu 3D + "SUPER CAPAS DA SEMANA" À ESQUERDA */}
      <div className="relative z-10 flex items-center justify-start gap-3 sm:gap-4 my-1.5">
        <Trophy3DIcon className="w-14 h-14 sm:w-18 sm:h-18" />

        <div className="text-left">
          <div className="text-2xl sm:text-4xl font-black italic tracking-tighter text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] leading-none uppercase">
            SUPER CAPAS
          </div>
          <div className="text-2xl sm:text-4xl font-black italic tracking-tighter bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_4px_12px_rgba(245,158,11,0.5)] leading-none uppercase mt-1">
            DA SEMANA
          </div>
        </div>
      </div>

      {/* 3. SUB-BADGES: Equipe Campeã e Semana Lado a Lado */}
      <div className="relative z-10 grid grid-cols-2 gap-2 mt-2.5">
        <div className="flex items-center justify-center gap-1.5 rounded-full bg-blue-950/85 border border-blue-400/70 px-2.5 py-1.5 text-[10px] sm:text-xs font-black uppercase text-amber-300 shadow-sm truncate">
          <span className="shrink-0">⭐</span>
          <span className="truncate">EQUIPE CAMPEÃ: {data.teamName}</span>
        </div>

        <div className="flex items-center justify-center gap-1.5 rounded-full bg-blue-950/85 border border-blue-400/70 px-2.5 py-1.5 text-[10px] sm:text-xs font-bold uppercase text-blue-100 shadow-sm truncate">
          <Calendar className="h-3.5 w-3.5 text-cyan-300 shrink-0" />
          <span className="truncate">SEMANA DE {data.matchDate}</span>
        </div>
      </div>

      {/* 4. FOTO EM MODO PAISAGEM COM MOLDURA DOURADA VIBRANTE */}
      <div className="relative z-10 mt-3.5 w-full aspect-[16/9] sm:aspect-[21/9] rounded-2xl overflow-hidden border-2 sm:border-[2.5px] border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.55)] group">
        <img
          src={photoUrl}
          alt={`Equipe Campeã ${data.teamName}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Selo no Canto Superior Esquerdo da Foto: TIME CAMPEÃO */}
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-2 rounded-xl bg-blue-950/90 backdrop-blur-md border border-amber-400/80 px-2.5 py-1.5 shadow-lg">
          <Crown className="h-4 w-4 text-amber-300 shrink-0" />
          <div className="leading-none text-left">
            <div className="text-[9px] font-black uppercase text-white tracking-wide">
              {data.teamName}
            </div>
            <div className="text-[11px] font-black uppercase text-amber-300 tracking-wider mt-0.5">
              CAMPEÃO
            </div>
          </div>
        </div>

        {/* Botões de Ação no Canto Superior Direito: Compartilhar + Trocar Foto + Ativar/Ocultar */}
        <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5">
          {isCoachOrAdmin && onToggleActive && (
            <button
              type="button"
              onClick={onToggleActive}
              className={`flex items-center gap-1 rounded-full backdrop-blur-md px-2.5 py-1 text-[10px] font-bold border transition active:scale-95 shadow-md cursor-pointer ${
                data.isActive !== false
                  ? 'bg-emerald-950/85 text-emerald-300 border-emerald-500/60 hover:bg-emerald-900/90'
                  : 'bg-amber-950/85 text-amber-300 border-amber-500/60 hover:bg-amber-900/90'
              }`}
              title={
                data.isActive !== false
                  ? 'Card ATIVO para todos os jogadores do time. Clique para ocultar.'
                  : 'Card OCULTO para os jogadores. Clique para ativar.'
              }
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  data.isActive !== false ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span>{data.isActive !== false ? 'Ativo no Time' : 'Oculto'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onShare}
            className="flex items-center gap-1 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-white border border-white/20 cursor-pointer transition active:scale-95 shadow-md"
            title="Compartilhar Foto Oficial dos Super Capas"
          >
            <Share2 className="h-3 w-3 text-amber-300" />
            <span>Compartilhar</span>
          </button>

          {onPhotoUpload && (
            <label
              className="flex items-center gap-1 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-white border border-white/20 cursor-pointer transition active:scale-95 shadow-md"
              title="Renovar foto real da equipe campeã (Exclusivo do Treinador)"
            >
              <Camera className="h-3 w-3 text-amber-300" />
              <span>Renovar Foto</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPhotoUpload}
              />
            </label>
          )}
        </div>

        {/* Setas de Carrossel Laterais */}
        <button
          type="button"
          onClick={() => setPhotoIndex((p) => Math.max(0, p - 1))}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-black/55 hover:bg-black/80 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white cursor-pointer transition active:scale-90"
          aria-label="Foto anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setPhotoIndex((p) => p + 1)}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-black/55 hover:bg-black/80 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white cursor-pointer transition active:scale-90"
          aria-label="Próxima foto"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Localização sutil no Canto Inferior Direito da Foto */}
        {venueName && (
          <div className="absolute right-2.5 bottom-2.5 z-20 flex items-center gap-1 rounded-full bg-black/65 backdrop-blur-md px-2.5 py-1 border border-white/20 text-[9px] sm:text-[10px] font-bold text-blue-100 shadow-md">
            <MapPin className="h-3 w-3 text-cyan-400 shrink-0" />
            <span>{venueName}</span>
          </div>
        )}
      </div>

      {/* 5. PAINEL DE MÉTRICAS EM 3 CARDS NEON AZUIS */}
      <div className="relative z-10 mt-3.5 grid grid-cols-3 gap-2 sm:gap-3">
        {/* Card 1: Vitórias */}
        <div className="rounded-2xl border border-blue-400/80 bg-gradient-to-b from-blue-900/40 to-blue-950/80 p-2 sm:p-2.5 text-center flex items-center justify-center gap-2 sm:gap-3 shadow-[0_0_12px_rgba(59,130,246,0.3)]">
          <Trophy className="h-6 w-6 sm:h-7 sm:w-7 text-amber-300 shrink-0 drop-shadow" />
          <div className="text-left">
            <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-blue-100 font-sans">
              VITÓRIAS
            </div>
            <div className="text-xl sm:text-3xl font-black italic tracking-normal text-emerald-400 drop-shadow-[0_2px_8px_rgba(74,222,128,0.55)] leading-none mt-0.5 select-none pr-1">
              {data.wins}V
            </div>
          </div>
        </div>

        {/* Card 2: Empates */}
        <div className="rounded-2xl border border-blue-400/80 bg-gradient-to-b from-blue-900/40 to-blue-950/80 p-2 sm:p-2.5 text-center flex items-center justify-center gap-2 sm:gap-3 shadow-[0_0_12px_rgba(59,130,246,0.3)]">
          <Handshake className="h-6 w-6 sm:h-7 sm:w-7 text-amber-300 shrink-0 drop-shadow" />
          <div className="text-left">
            <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-blue-100 font-sans">
              EMPATES
            </div>
            <div className="text-xl sm:text-3xl font-black italic tracking-normal text-amber-300 drop-shadow-[0_2px_8px_rgba(245,158,11,0.55)] leading-none mt-0.5 select-none pr-1">
              {data.draws}E
            </div>
          </div>
        </div>

        {/* Card 3: Gols */}
        <div className="rounded-2xl border border-blue-400/80 bg-gradient-to-b from-blue-900/40 to-blue-950/80 p-2 sm:p-2.5 text-center flex items-center justify-center gap-2 sm:gap-3 shadow-[0_0_12px_rgba(59,130,246,0.3)]">
          <div className="h-6 w-6 sm:h-7 sm:w-7 rounded-full bg-blue-600 border border-blue-300/50 flex items-center justify-center text-xs shrink-0 shadow-sm">
            ⚽
          </div>
          <div className="text-left">
            <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-blue-100 font-sans">
              GOLS
            </div>
            <div className="text-xl sm:text-3xl font-black italic tracking-normal text-amber-300 drop-shadow-[0_2px_8px_rgba(245,158,11,0.55)] leading-none mt-0.5 select-none pr-1">
              {data.totalGoals}
            </div>
          </div>
        </div>
      </div>

      {/* 6. CONTAINER DO ELENCO DOS ATLETAS VENCEDORES */}
      <div className="relative z-10 mt-3.5 rounded-2xl border border-blue-500/80 bg-gradient-to-b from-blue-950/90 via-blue-900/30 to-blue-950/95 p-3 sm:p-4 shadow-[0_0_15px_rgba(59,130,246,0.25)]">
        {/* Cabeçalho do Elenco */}
        <div className="flex items-center justify-between pb-2 border-b border-blue-400/20">
          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black uppercase tracking-wider text-white">
            <Crown className="h-4 w-4 text-amber-300 shrink-0" />
            <span>ELENCO DOS ATLETAS VENCEDORES</span>
            <span className="text-amber-300">(SUPER CAPAS)</span>
          </div>

          <div className="text-[10px] sm:text-xs font-semibold text-blue-300">
            {data.players.length} Atletas Campeões
          </div>
        </div>

        {/* Lista de Atletas com Medalha 3D + Camisa SVG + Estatísticas e Cartões */}
        <div className="mt-2.5 space-y-2">
          {data.players.map((player, idx) => {
            const isTopScorer = idx === 0 && player.goals > 0;
            const yellowCount = player.yellowCards || 0;
            const blueCount = player.blueCards || 0;
            const redCount = player.redCards || 0;
            const hasCards = yellowCount > 0 || blueCount > 0 || redCount > 0;

            // Medalha de Posição
            let rankBadgeClass =
              'bg-gradient-to-b from-slate-600 via-slate-700 to-slate-800 border-slate-500/60 text-slate-200';
            if (idx === 0) {
              rankBadgeClass =
                'bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 border-yellow-200 text-blue-950 shadow-[0_0_10px_rgba(251,191,36,0.5)]';
            } else if (idx === 1) {
              rankBadgeClass =
                'bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 border-white text-slate-800 shadow-sm';
            } else if (idx === 2) {
              rankBadgeClass =
                'bg-gradient-to-b from-amber-600 via-amber-700 to-amber-800 border-amber-400/60 text-amber-100 shadow-sm';
            }

            return (
              <div
                key={player.name}
                className={`flex items-center justify-between p-2 sm:p-2.5 rounded-xl transition ${
                  isTopScorer
                    ? 'border border-amber-400/80 bg-gradient-to-r from-amber-500/25 via-yellow-500/15 to-transparent shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                }`}
              >
                {/* Lado Esquerdo: Medalha + Camisa + Nome + Artilheiro + Cartões */}
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 mr-2">
                  {/* Medalha Circular com Número */}
                  <div
                    className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full border flex items-center justify-center font-black text-xs sm:text-sm font-mono shrink-0 ${rankBadgeClass}`}
                  >
                    {idx + 1}
                  </div>

                  {/* Camisa de Futebol: Amarela para o artilheiro, Azul para os outros */}
                  <SoccerJerseyIcon
                    type={isTopScorer ? 'yellow' : 'blue'}
                    className="w-7 h-7 sm:w-8 sm:h-8 shrink-0"
                  />

                  {/* Informações do Atleta */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wide truncate">
                        {player.name}
                      </span>
                      {isTopScorer && (
                        <span className="rounded-full bg-amber-400 text-blue-950 px-2 py-0.5 text-[8px] sm:text-[9px] font-black uppercase tracking-wider shadow-xs shrink-0">
                          ARTILHEIRO
                        </span>
                      )}
                      {player.isSub && (
                        <span className="text-[8px] text-blue-300 font-mono shrink-0">
                          (Reserva)
                        </span>
                      )}
                    </div>

                    {/* Cartões recebidos na Súmula */}
                    <div className="mt-0.5">
                      {hasCards ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          {yellowCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-400/25 border border-amber-400/60 px-1.5 py-0.5 text-[9px] font-black text-amber-200 shadow-xs">
                              <span className="w-1.5 h-2.5 rounded-[1px] bg-amber-400 shrink-0 shadow-xs" />
                              <span>{yellowCount} {yellowCount === 1 ? 'Amarelo' : 'Amarelos'}</span>
                            </span>
                          )}
                          {blueCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-500/25 border border-blue-400/60 px-1.5 py-0.5 text-[9px] font-black text-blue-200 shadow-xs">
                              <span className="w-1.5 h-2.5 rounded-[1px] bg-blue-500 shrink-0 shadow-xs" />
                              <span>{blueCount} {blueCount === 1 ? 'Azul' : 'Azuis'}</span>
                            </span>
                          )}
                          {redCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded bg-red-500/25 border border-red-400/60 px-1.5 py-0.5 text-[9px] font-black text-red-200 shadow-xs">
                              <span className="w-1.5 h-2.5 rounded-[1px] bg-red-500 shrink-0 shadow-xs" />
                              <span>{redCount} {redCount === 1 ? 'Vermelho' : 'Vermelhos'}</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-[10px] sm:text-[11px] text-emerald-300 font-medium flex items-center gap-1 truncate">
                          <span className="text-[9px] font-bold text-emerald-400">✓</span>
                          <span>Nenhum cartão</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cantinho Direito: SOMENTE a Quantidade de Gols com Tipografia Bonita e Espaçamento Seguro SEM CORTAR */}
                <div className="shrink-0 text-right flex items-baseline justify-end gap-1 pl-2 pr-2 py-1 whitespace-nowrap overflow-visible">
                  <span className="inline-block text-2xl sm:text-3xl font-black italic tracking-normal text-amber-300 drop-shadow-[0_2px_8px_rgba(245,158,11,0.65)] pr-1 leading-none select-none">
                    {player.goals}
                  </span>
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-amber-200/90 font-sans leading-none">
                    {player.goals === 1 ? 'gol' : 'gols'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7. RODAPÉ DE CERTIFICAÇÃO DA LIGA */}
      <div className="relative z-10 mt-3 pt-2 text-center border-t border-white/10">
        <div className="flex items-center justify-center gap-2 mb-0.5">
          <div className="h-px w-10 sm:w-16 bg-gradient-to-r from-transparent to-amber-400/60" />
          <span className="text-xs text-amber-300">🏆</span>
          <div className="h-px w-10 sm:w-16 bg-gradient-to-l from-transparent to-amber-400/60" />
        </div>
        <div className="text-[9px] sm:text-[10px] font-black tracking-widest text-slate-300 uppercase">
          COMPARTILHADO VIA FUTPLAY LITE
        </div>
        <div className="text-[8px] tracking-wider text-blue-300/80 uppercase">
          IDENTIDADE OFICIAL DA LIGA
        </div>
      </div>
    </div>
  );
};
