import React, { useEffect, useState } from 'react';
import {
  X,
  Star,
  Check,
  Sparkles,
  Target,
  Shield,
  Compass,
  Zap,
  Wand2,
} from 'lucide-react';
import { PlayerProfile, PlayerSkillRatings } from '../types/league';

interface PlayerRatingModalProps {
  player: PlayerProfile;
  isOpen: boolean;
  onClose: () => void;
  readOnly?: boolean;
  readOnlyMessage?: string;
  initialSkills?: PlayerSkillRatings;
  onSave: (
    playerId: string,
    skills: {
      finalizacao: number;
      marcacao: number;
      passe: number;
      raca: number;
      drible: number;
    }
  ) => void;
}

export const PlayerRatingModal: React.FC<PlayerRatingModalProps> = ({
  player,
  isOpen,
  onClose,
  readOnly = false,
  readOnlyMessage,
  initialSkills,
  onSave,
}) => {
  const currentSkills: PlayerSkillRatings = initialSkills || player.skills || {
    finalizacao: 0,
    marcacao: 0,
    passe: 0,
    raca: 0,
    drible: 0,
  };

  const [ratings, setRatings] = useState<{
    finalizacao: number;
    marcacao: number;
    passe: number;
    raca: number;
    drible: number;
  }>({
    finalizacao: currentSkills.finalizacao ?? 0,
    marcacao: currentSkills.marcacao ?? 0,
    passe: currentSkills.passe ?? 0,
    raca: currentSkills.raca ?? 0,
    drible: currentSkills.drible ?? 0,
  });

  useEffect(() => {
    const s = initialSkills || player.skills || {
      finalizacao: 0,
      marcacao: 0,
      passe: 0,
      raca: 0,
      drible: 0,
    };
    setRatings({
      finalizacao: s.finalizacao ?? 0,
      marcacao: s.marcacao ?? 0,
      passe: s.passe ?? 0,
      raca: s.raca ?? 0,
      drible: s.drible ?? 0,
    });
  }, [player.id, initialSkills]);

  const [savedFeedback, setSavedFeedback] = useState(false);

  if (!isOpen) return null;

  const currentOverall = Number(
    (
      (ratings.finalizacao +
        ratings.marcacao +
        ratings.passe +
        ratings.raca +
        ratings.drible) /
      5
    ).toFixed(1)
  );

  const criteriaList = [
    {
      key: 'finalizacao' as const,
      label: 'Finalização / Faro de Gol',
      desc: 'Chute, precisão e faro de artilheiro',
      icon: Target,
      color: 'text-rose-500',
      bgColor: 'bg-rose-50',
    },
    {
      key: 'marcacao' as const,
      label: 'Marcação / Desarme',
      desc: 'Recuperação de bola e combate defensivo',
      icon: Shield,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      key: 'passe' as const,
      label: 'Passe / Visão de Jogo',
      desc: 'Distribuição, lançamentos e visão tática',
      icon: Compass,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-50',
    },
    {
      key: 'raca' as const,
      label: 'Raça / Fôlego',
      desc: 'Intensidade, fôlego e entrega em campo',
      icon: Zap,
      color: 'text-amber-500',
      bgColor: 'bg-amber-50',
    },
    {
      key: 'drible' as const,
      label: 'Drible / Finta',
      desc: 'Habilidade no 1 contra 1 e agilidade',
      icon: Wand2,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
    },
  ];

  const handleSetRating = (
    key: 'finalizacao' | 'marcacao' | 'passe' | 'raca' | 'drible',
    value: number
  ) => {
    if (readOnly) return;

    // Se clicar na mesma estrela que já está selecionada, zera para 0 estrelas
    const newValue = ratings[key] === value ? 0 : value;
    const nextRatings = {
      ...ratings,
      [key]: newValue,
    };
    setRatings(nextRatings);

    // Salva imediatamente
    onSave(player.id, nextRatings);

    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Top Header */}
        <div className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-950 p-4 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 pr-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10 border border-white/20 font-display text-base font-extrabold text-white">
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-400" />
                Avaliação de Habilidades
              </span>
              <h2 className="text-base font-bold text-white truncate">
                {player.displayName}
              </h2>
              <p className="text-xs text-blue-200 capitalize">
                {player.position} · {player.neighborhood}
              </p>
            </div>
          </div>

          {/* Banner de Média Atual */}
          <div className="mt-3.5 flex items-center justify-between rounded-2xl bg-white/10 backdrop-blur-md p-3 border border-white/15">
            <div>
              <div className="text-[10px] font-bold text-blue-200 uppercase tracking-wider">
                Média Geral de Estrelas
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {[1, 2, 3, 4, 5].map((starIdx) => {
                  const isFilled = starIdx <= Math.round(currentOverall);
                  return (
                    <Star
                      key={starIdx}
                      className={`h-4 w-4 ${
                        isFilled
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-white/10 text-white/30'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="text-right">
              <div className="text-2xl font-black font-mono text-amber-400 leading-none">
                {currentOverall > 0 ? currentOverall.toFixed(1) : '0.0'}
              </div>
              <div className="text-[10px] font-medium text-white/80 mt-0.5">
                {currentOverall >= 4.5
                  ? '🏆 Craque Nato'
                  : currentOverall >= 3.8
                  ? '🌟 Destaque'
                  : currentOverall >= 3.0
                  ? '🟢 Regular'
                  : currentOverall > 0
                  ? '⚪ Composição'
                  : 'Ainda não avaliado'}
              </div>
            </div>
          </div>

          {/* Indicativo de Média Coletiva */}
          <div className="mt-2 flex items-center justify-between text-[10px] text-blue-200/90 px-1">
            <span>👥 {player.skills?.totalVotes ? `${player.skills.totalVotes} avaliação(ões) computadas` : 'Primeira avaliação deste atleta'}</span>
            <span className="text-amber-300 font-bold bg-amber-400/20 px-2 py-0.5 rounded-full border border-amber-300/30">Média Coletiva</span>
          </div>
        </div>

        {/* Alerta de Modo Somente Leitura (ex: jogador visualizando suas próprias estrelas) */}
        {readOnly && (
          <div className="bg-amber-50 text-amber-800 text-xs font-semibold px-4 py-2.5 flex items-center gap-2 border-b border-amber-200">
            <span className="text-base">🔒</span>
            <span>
              {readOnlyMessage ||
                'Um jogador não pode classificar a si mesmo. Suas estrelas são avaliadas pelos companheiros e comissão.'}
            </span>
          </div>
        )}

        {/* Feedback visual de auto-salvo */}
        {!readOnly && savedFeedback && (
          <div className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-4 py-1.5 flex items-center justify-center gap-1.5 border-b border-emerald-100 transition animate-in fade-in">
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            Salvo automaticamente!
          </div>
        )}

        {/* Lista dos 5 Quesitos com toque para selecionar */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1 divide-y divide-slate-100">
          {criteriaList.map((crit) => {
            const Icon = crit.icon;
            const val = ratings[crit.key];

            return (
              <div key={crit.key} className="pt-3.5 first:pt-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${crit.bgColor} ${crit.color}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">
                        {crit.label}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {crit.desc}
                      </div>
                    </div>
                  </div>

                  <span className="font-mono text-xs font-bold text-slate-700 shrink-0">
                    {val} / 5
                  </span>
                </div>

                {/* Seletor de 5 estrelas interativas */}
                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-1.5 border border-slate-100">
                  {[1, 2, 3, 4, 5].map((starNum) => {
                    const active = starNum <= val;
                    return (
                      <button
                        key={starNum}
                        type="button"
                        onClick={() => handleSetRating(crit.key, starNum)}
                        className={`flex-1 py-1.5 flex items-center justify-center rounded-lg transition active:scale-95 ${
                          active
                            ? 'text-amber-500 hover:bg-amber-50/60'
                            : 'text-slate-300 hover:text-slate-400 hover:bg-white'
                        }`}
                        title={`${starNum} estrelas`}
                      >
                        <Star
                          className={`h-5 w-5 ${
                            active ? 'fill-amber-400 text-amber-500' : ''
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer com botão de Fechar/Concluído */}
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white py-2.5 text-xs font-bold shadow-md shadow-blue-500/20 active:scale-[0.99] transition"
          >
            <Check className="h-4 w-4" />
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};
