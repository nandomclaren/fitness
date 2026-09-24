import type { Exercise } from '../types/exercise.ts'

/**
 * Detecta heuristicamente exercícios que precisam de barra fixa pelo nome — a fonte de
 * dados tagueia esses exercícios como equipment "body only"/"body weight" (nenhum peso
 * EXTERNO é adicionado), mas isso ignora que ainda assim precisa de um equipamento físico
 * pra pendurar/apoiar, diferente de um push-up ou agachamento livre. Sem essa correção,
 * qualquer usuário que marcasse "peso do corpo" como disponível (praticamente todo mundo)
 * recebia sugestão de barra fixa mesmo sem ter uma em casa — bug real reportado pelo
 * usuário (IA e fallback os dois sugeriram). Mesmo padrão de correção heurística por nome
 * já usado em `unilateral.ts`.
 */
const PULLUP_BAR_PATTERN =
  /pull-?up|chin-?up|muscle-?up|toes?[\s-]?to[\s-]?bar|hanging|bar hang|dead hang|barra fixa/i

export function requiresPullupBar(exercise: Pick<Exercise, 'nameEn' | 'name'>): boolean {
  return PULLUP_BAR_PATTERN.test(exercise.nameEn) || PULLUP_BAR_PATTERN.test(exercise.name)
}
