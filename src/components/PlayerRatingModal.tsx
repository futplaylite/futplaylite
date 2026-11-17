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
  Users,
} from 'lucide-react';
import { PlayerProfile, PlayerSkillRatings } from '../types/league';
import { useLeague } from '../lib/store/LeagueContext';

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
  const { peerEvaluations, currentUser, currentPlayerProfile, profiles } = useLeague();

  // Garante que usamos a versão mais recente do perfil com as notas recalculadas
  const freshPlayer = profiles.find((p) => p.id === player.id) || player;

  const isSelf =
    freshPlayer.id === currentPlayerProfile?.id ||
    freshPlayer.userId === currentUser?.id;

  // Resolução do time do usuário logado
  let myTeam = (currentUser?.teamName || currentPlayerProfile?.teamName || '').trim().toLowerCase();
  let myCode = (currentUser?.teamInviteCode || currentPlayerProfile?.teamInviteCode || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  try {
    const rawTeams = localStorage.getItem('futplay_registered_teams_v1');
    if (rawTeams) {
      const list = JSON.parse(rawTeams);
      if (Array.isArray(list)) {
        const t = list.find((item: any) =>
          item.ownerUserId === currentUser?.id ||
          (item.ownerName && currentPlayerProfile?.displayName && item.ownerName.trim().toLowerCase() === currentPlayerProfile.displayName.trim().toLowerCase())
        );
        if (t) {
          if (!myTeam || myTeam === 'meu time' || myTeam === 'sem time') myTeam = (t.name || '').trim().toLowerCase();
          if (!myCode) myCode = (t.inviteCode || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        }
      }
    }
  } catch {}

  const playerTeam = (freshPlayer?.teamName || '').trim().toLowerCase();
  const playerCode = (freshPlayer?.teamInviteCode || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  const isSameTeam =
    Boolean(playerTeam) &&
    playerTeam !== 'sem time' &&
    playerTeam !== 'meu time' &&
    (playerTeam === myTeam || (Boolean(playerCode) && playerCode === myCode));

  const isDifferentTeam = !isSelf && !isSameTeam && currentUser?.role !== 'admin';

  const effectiveReadOnly = readOnly || isDifferentTeam || (isSelf && currentUser?.role === 'player');
  const effectiveReadOnlyMessage =
    readOnlyMessage ||
    (isDifferentTeam
      ? 'Jogadores de times diferentes não podem avaliar jogadores de outros times, apenas do seu mesmo time.'
      : isSelf
      ? 'Você não pode classificar a si mesmo. Suas estrelas são avaliadas pelos companheiros do seu time.'
      : undefined);

  // Busca a classificação que o usuário atual já fez para este atleta (se existir)
  const myExistingEval = (peerEvaluations || []).find(
    (e) =>
      (e.evaluatorId === currentUser?.id ||
        (currentPlayerProfile && e.evaluatorId === currentPlayerProfile.id) ||
        (currentPlayerProfile?.userId && e.evaluatorId === currentPlayerProfile.userId)) &&
      (e.targetPlayerId === player.id || (player.userId && e.targetPlayerId === player.userId))
  );

  // Inicializa notas individuais do avaliador:
  // Se readOnly (próprio jogador ou time diferente), reflete a média geral.
  // Se for avaliador do mesmo time, parte do que ele mesmo já salvou (ou zero se primeira vez).
  const getStartingSkills = () => {
    if (initialSkills) return initialSkills;
    if (myExistingEval) {
      return {
        finalizacao: myExistingEval.finalizacao ?? 0,
        marcacao: myExistingEval.marcacao ?? 0,
        passe: myExistingEval.passe ?? 0,
        raca: myExistingEval.raca ?? 0,
        drible: myExistingEval.drible ?? 0,
      };
    }
    if (effectiveReadOnly && freshPlayer.skills) {
      return freshPlayer.skills;
    }
    return {
      finalizacao: 0,
      marcacao: 0,
      passe: 0,
      raca: 0,
      drible: 0,
    };
  };

  const [ratings, setRatings] = useState<{
    finalizacao: number;
    marcacao: number;
    passe: number;
    raca: number;
    drible: number;
  }>(getStartingSkills);

  useEffect(() => {
    setRatings(getStartingSkills());
  }, [player.id, initialSkills, myExistingEval?.updatedAt, effectiveReadOnly]);

  const [savedFeedback, setSavedFeedback] = useState(false);

  if (!isOpen) return null;

  // Todas as avaliações ativas de outros atletas para este jogador
  const allTargetEvals = (peerEvaluations || []).filter(
    (e) =>
      (e.targetPlayerId === player.id || (player.userId && e.targetPlayerId === player.userId)) &&
      (e.finalizacao > 0 || e.marcacao > 0 || e.passe > 0 || e.raca > 0 || e.drible > 0)
  );

  const totalVoters = freshPlayer.skills?.totalVotes ?? allTargetEvals.length;

  const collectiveOverall =
    freshPlayer.overallStars ??
    (allTargetEvals.length > 0
      ? Number(
          (
            allTargetEvals.reduce(
              (acc, cur) =>
                acc + (cur.finalizacao + cur.marcacao + cur.passe + cur.raca + cur.drible) / 5,
              0
            ) / allTargetEvals.length
          ).toFixed(1)
        )
      : 0);

  const collectiveSkills = freshPlayer.skills || {
    finalizacao: allTargetEvals.length
      ? Number((allTargetEvals.reduce((a, b) => a + (b.finalizacao || 0), 0) / allTargetEvals.length).toFixed(1))
      : 0,
    marcacao: allTargetEvals.length
      ? Number((allTargetEvals.reduce((a, b) => a + (b.marcacao || 0), 0) / allTargetEvals.length).toFixed(1))
      : 0,
    passe: allTargetEvals.length
      ? Number((allTargetEvals.reduce((a, b) => a + (b.passe || 0), 0) / allTargetEvals.length).toFixed(1))
      : 0,
    raca: allTargetEvals.length
      ? Number((allTargetEvals.reduce((a, b) => a + (b.raca || 0), 0) / allTargetEvals.length).toFixed(1))
      : 0,
    drible: allTargetEvals.length
      ? Number((allTargetEvals.reduce((a, b) => a + (b.drible || 0), 0) / allTargetEvals.length).toFixed(1))
      : 0,
  };

  // Média individual do avaliador
  const myIndividualAvg = Number(
    (
      (ratings.finalizacao +
        ratings.marcacao +
        ratings.passe +
        ratings.raca +
        ratings.drible) /
      5
    ).toFixed(1)
  );

  const hasMyEvaluation = Boolean(
    myExistingEval ||
      ratings.finalizacao > 0 ||
      ratings.marcacao > 0 ||
      ratings.passe > 0 ||
      ratings.raca > 0 ||
      ratings.drible > 0
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
    if (effectiveReadOnly) return;

    // Se clicar na mesma estrela já marcada, desmarca para 0
    const newValue = ratings[key] === value ? 0 : value;
    const nextRatings = {
      ...ratings,
      [key]: newValue,
    };
    setRatings(nextRatings);

    // Salva e grava imediatamente no sistema
    onSave(player.id, nextRatings);

    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 1400);
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
                Classificação de Habilidades
              </span>
              <h2 className="text-base font-bold text-white truncate">
                {player.displayName}
              </h2>
              <p className="text-xs text-blue-200 capitalize">
                {player.position} · {player.neighborhood || 'Atleta'}
              </p>
            </div>
          </div>

          {/* Banner de Média Geral Coletiva (Todos os jogadores que o classificaram) */}
          <div className="mt-3.5 rounded-2xl bg-white/10 backdrop-blur-md p-3 border border-white/15 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-blue-200 uppercase tracking-wider flex items-center gap-1">
                  <Users className="h-3 w-3 text-blue-300" />
                  <span>Média Geral dos Jogadores</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {[1, 2, 3, 4, 5].map((starIdx) => {
                    const isFilled = collectiveOverall > 0 && starIdx <= Math.round(collectiveOverall);
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
                  {collectiveOverall > 0 ? collectiveOverall.toFixed(1) : '0.0'}
                </div>
                <div className="text-[10px] font-medium text-white/80 mt-0.5">
                  {totalVoters === 0
                    ? 'Ainda sem avaliações'
                    : totalVoters === 1
                    ? '1 jogador avaliou'
                    : `${totalVoters} jogadores avaliaram`}
                </div>
              </div>
            </div>

            {/* Quesitos da Média Geral Coletiva */}
            <div className="grid grid-cols-5 gap-1 pt-1.5 border-t border-white/10 text-center text-[9px] font-bold">
              <div className="bg-white/5 rounded-lg py-1">
                <span className="block text-[8px] text-blue-300 uppercase">Fin</span>
                <span className="font-mono text-amber-300 font-extrabold">
                  {collectiveSkills.finalizacao > 0 ? collectiveSkills.finalizacao.toFixed(1) : '0.0'}★
                </span>
              </div>
              <div className="bg-white/5 rounded-lg py-1">
                <span className="block text-[8px] text-blue-300 uppercase">Mar</span>
                <span className="font-mono text-amber-300 font-extrabold">
                  {collectiveSkills.marcacao > 0 ? collectiveSkills.marcacao.toFixed(1) : '0.0'}★
                </span>
              </div>
              <div className="bg-white/5 rounded-lg py-1">
                <span className="block text-[8px] text-blue-300 uppercase">Pas</span>
                <span className="font-mono text-amber-300 font-extrabold">
                  {collectiveSkills.passe > 0 ? collectiveSkills.passe.toFixed(1) : '0.0'}★
                </span>
              </div>
              <div className="bg-white/5 rounded-lg py-1">
                <span className="block text-[8px] text-blue-300 uppercase">Raç</span>
                <span className="font-mono text-amber-300 font-extrabold">
                  {collectiveSkills.raca > 0 ? collectiveSkills.raca.toFixed(1) : '0.0'}★
                </span>
              </div>
              <div className="bg-white/5 rounded-lg py-1">
                <span className="block text-[8px] text-blue-300 uppercase">Dri</span>
                <span className="font-mono text-amber-300 font-extrabold">
                  {collectiveSkills.drible > 0 ? collectiveSkills.drible.toFixed(1) : '0.0'}★
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Alerta de Modo Somente Leitura (ex: jogador visualizando suas próprias estrelas ou jogador de outro time) */}
        {effectiveReadOnly && (
          <div className="bg-amber-50 text-amber-900 text-xs font-semibold px-4 py-2.5 flex items-center gap-2 border-b border-amber-200">
            <span className="text-base">🔒</span>
            <span>
              {effectiveReadOnlyMessage ||
                'Você não pode classificar a si mesmo. Sua média geral é calculada a partir das avaliações que seus companheiros atribuem a você.'}
            </span>
          </div>
        )}

        {/* Feedback visual de auto-salvo */}
        {!effectiveReadOnly && savedFeedback && (
          <div className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-4 py-1.5 flex items-center justify-center gap-1.5 border-b border-emerald-100 transition animate-in fade-in">
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            Classificação gravada! Média geral recalculada.
          </div>
        )}

        {/* Cabeçalho da Seção de Avaliação do Usuário */}
        {!effectiveReadOnly && (
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-1 text-slate-700">
              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              <span>Sua Classificação Individual</span>
            </div>
            {hasMyEvaluation ? (
              <span className="text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1">
                <Check className="h-3 w-3 stroke-[3]" />
                Gravada ({myIndividualAvg.toFixed(1)} ⭐)
              </span>
            ) : (
              <span className="text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                Pendente
              </span>
            )}
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
                        disabled={effectiveReadOnly}
                        onClick={() => handleSetRating(crit.key, starNum)}
                        className={`flex-1 py-1.5 flex items-center justify-center rounded-lg transition active:scale-95 ${
                          active
                            ? 'text-amber-500 hover:bg-amber-50/60'
                            : 'text-slate-300 hover:text-slate-400 hover:bg-white'
                        } ${effectiveReadOnly ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                        title={effectiveReadOnly ? `${starNum} estrelas` : `Classificar com ${starNum} estrelas`}
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
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white py-2.5 text-xs font-bold shadow-md shadow-blue-500/20 active:scale-[0.99] transition cursor-pointer"
          >
            <Check className="h-4 w-4" />
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
};
