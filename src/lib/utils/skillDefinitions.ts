import { PlayerPosition } from '../../types/league';

export type SkillKey = 'finalizacao' | 'marcacao' | 'passe' | 'raca' | 'drible';

export type SkillIconKey =
  | 'target'
  | 'shield'
  | 'compass'
  | 'zap'
  | 'wand'
  | 'crosshair'
  | 'send'
  | 'swords'
  | 'hand';

export interface SkillDefinition {
  key: SkillKey;
  shortLabel: string;
  label: string;
  desc: string;
  color: string;
  bgColor: string;
  iconKey: SkillIconKey;
}

/**
 * Marco de reinício das avaliações (Scout) para goleiros.
 * Avaliações de goleiros gravadas antes desta data usavam critérios de jogador de linha
 * e são desconsideradas para permitir novas avaliações com critérios exclusivos de goleiro.
 */
export const GOALKEEPER_SCOUT_RESET_AT = '2026-11-19T20:30:00.000Z';
export const GOALKEEPER_SCOUT_RESET_MS = new Date(GOALKEEPER_SCOUT_RESET_AT).getTime();

export function isGoalkeeperPosition(position?: PlayerPosition | string | null): boolean {
  return (position || '').trim().toLowerCase() === 'goleiro';
}

export function isEvaluationValidForPosition(
  evaluation: { updatedAt?: string; createdAt?: string } | null | undefined,
  position?: PlayerPosition | string | null
): boolean {
  if (!evaluation) return false;
  if (!isGoalkeeperPosition(position)) return true;
  const ts = new Date(evaluation.updatedAt || evaluation.createdAt || 0).getTime();
  return ts >= GOALKEEPER_SCOUT_RESET_MS;
}

export const LINE_SKILL_DEFINITIONS: SkillDefinition[] = [
  {
    key: 'finalizacao',
    shortLabel: 'FIN',
    label: 'Finalização / Faro de Gol',
    desc: 'Chute, precisão e faro de artilheiro',
    color: 'text-rose-500',
    bgColor: 'bg-rose-50',
    iconKey: 'target',
  },
  {
    key: 'marcacao',
    shortLabel: 'MAR',
    label: 'Marcação / Desarme',
    desc: 'Recuperação de bola e combate defensivo',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    iconKey: 'shield',
  },
  {
    key: 'passe',
    shortLabel: 'PAS',
    label: 'Passe / Visão de Jogo',
    desc: 'Distribuição, lançamentos e visão tática',
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50',
    iconKey: 'compass',
  },
  {
    key: 'raca',
    shortLabel: 'RAÇ',
    label: 'Raça / Fôlego',
    desc: 'Intensidade, fôlego e entrega em campo',
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    iconKey: 'zap',
  },
  {
    key: 'drible',
    shortLabel: 'DRI',
    label: 'Drible / Finta',
    desc: 'Habilidade no 1 contra 1 e agilidade',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
    iconKey: 'wand',
  },
];

export const GOALKEEPER_SKILL_DEFINITIONS: SkillDefinition[] = [
  {
    key: 'finalizacao',
    shortLabel: 'REF',
    label: 'Reflexo / Elasticidade',
    desc: 'Tempo de reação em chutes à queima-roupa e defesas difíceis',
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    iconKey: 'zap',
  },
  {
    key: 'marcacao',
    shortLabel: 'POS',
    label: 'Posicionamento / Fechamento',
    desc: 'Leitura de ângulo, cobertura da meta e antecipação',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    iconKey: 'crosshair',
  },
  {
    key: 'passe',
    shortLabel: 'REP',
    label: 'Reposição / Jogo com os Pés',
    desc: 'Saída de bola, lançamentos precisos e qualidade com os pés',
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-50',
    iconKey: 'send',
  },
  {
    key: 'raca',
    shortLabel: 'SAÍ',
    label: 'Saída do Gol / 1 contra 1',
    desc: 'Coragem no mano a mano, saída nos pés do atacante e bolas aéreas',
    color: 'text-rose-500',
    bgColor: 'bg-rose-50',
    iconKey: 'swords',
  },
  {
    key: 'drible',
    shortLabel: 'FIR',
    label: 'Firmeza / Encaixe',
    desc: 'Mão firme, segurança sem dar rebote e liderança defensiva',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
    iconKey: 'hand',
  },
];

export function getSkillDefinitions(position?: PlayerPosition | string | null): SkillDefinition[] {
  return isGoalkeeperPosition(position) ? GOALKEEPER_SKILL_DEFINITIONS : LINE_SKILL_DEFINITIONS;
}
