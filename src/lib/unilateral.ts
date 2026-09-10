import type { Exercise } from '../types/exercise.ts'

/**
 * Detecta heuristicamente exercícios unilaterais (um lado do corpo por vez) pelo nome —
 * o catálogo não tem um campo dedicado pra isso. Cobre a maioria dos casos reais
 * (single arm/leg, one arm/leg, alternados, side plank, pistol squat), mas é só um
 * palpite inicial: o usuário pode corrigir na tela do treino se a detecção errar.
 */
const UNILATERAL_PATTERN =
  /single[\s-]?arm|single[\s-]?leg|one[\s-]?arm|one[\s-]?leg|one[\s-]?legged|alternat(e|ing)|side plank|pistol squat|suitcase|unilateral/i

export function isUnilateralExercise(exercise: Pick<Exercise, 'nameEn' | 'name'>): boolean {
  return UNILATERAL_PATTERN.test(exercise.nameEn) || UNILATERAL_PATTERN.test(exercise.name)
}
