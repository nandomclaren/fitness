import type { Exercise } from '../types/exercise.ts'
import type { MuscleId } from '../types/muscle.ts'
import type { ExperienceLevel, Objective, UserGoals } from '../types/goals.ts'

/**
 * Prescrição de séries/reps/descanso por objetivo e nível — baseada nas diretrizes
 * padrão da área (ACSM, "Progression Models in Resistance Training for Healthy Adults",
 * Med Sci Sports Exerc, 2009; NSCA, "Essentials of Strength Training and Conditioning"),
 * não em estimativa livre. Regra fixa, não IA: previsível e auditável.
 *
 * Resumo das faixas usadas:
 *  - Força:        3-5 séries, 3-8 reps,   descanso 2-3min (grande) / 90s (pequeno)
 *  - Hipertrofia:  3-4 séries, 6-12 reps,  descanso 90s-2min (grande) / 60-90s (pequeno)
 *  - Emagrecimento: 2-3 séries, 12-20 reps, descanso 30-45s
 *  - Saúde geral:  2-3 séries, 10-15 reps, descanso ~60s
 * O nível de experiência ajusta o número de séries dentro da faixa (iniciante no piso,
 * avançado no teto) — praticantes novos precisam de menos volume pra se adaptar.
 */
export interface Prescription {
  sets: number
  repRangeMin: number
  repRangeMax: number
  restSeconds: number
}

export interface RoutineItem {
  exercise: Exercise
  prescription: Prescription
}

interface ObjectiveGuideline {
  setsByLevel: Record<ExperienceLevel, number>
  repRangeMin: number
  repRangeMax: number
  restLargeMuscleSeconds: number
  restSmallMuscleSeconds: number
}

const GUIDELINES: Record<Objective, ObjectiveGuideline> = {
  forca: {
    setsByLevel: { iniciante: 3, intermediario: 4, avancado: 5 },
    repRangeMin: 3,
    repRangeMax: 8,
    restLargeMuscleSeconds: 150,
    restSmallMuscleSeconds: 90,
  },
  hipertrofia: {
    setsByLevel: { iniciante: 3, intermediario: 3, avancado: 4 },
    repRangeMin: 6,
    repRangeMax: 12,
    restLargeMuscleSeconds: 100,
    restSmallMuscleSeconds: 75,
  },
  emagrecimento: {
    setsByLevel: { iniciante: 2, intermediario: 3, avancado: 3 },
    repRangeMin: 12,
    repRangeMax: 20,
    restLargeMuscleSeconds: 40,
    restSmallMuscleSeconds: 30,
  },
  saude_geral: {
    setsByLevel: { iniciante: 2, intermediario: 3, avancado: 3 },
    repRangeMin: 10,
    repRangeMax: 15,
    restLargeMuscleSeconds: 60,
    restSmallMuscleSeconds: 60,
  },
}

// Grupos musculares grandes recebem mais descanso entre séries (ACSM): exigem mais
// recrutamento neuromuscular e geram mais fadiga sistêmica que exercícios de isolamento.
const LARGE_MUSCLE_GROUPS = new Set<MuscleId>([
  'chest',
  'lats',
  'upper_back',
  'quads',
  'hamstrings',
  'glutes',
  'shoulders',
])

const DEFAULT_OBJECTIVE: Objective = 'hipertrofia'
const DEFAULT_LEVEL: ExperienceLevel = 'iniciante'

export function getPrescription(exercise: Exercise, goals: UserGoals | null): Prescription {
  const objective = goals?.objective ?? DEFAULT_OBJECTIVE
  const level = goals?.level ?? DEFAULT_LEVEL
  const guideline = GUIDELINES[objective] ?? GUIDELINES[DEFAULT_OBJECTIVE]
  const sets = guideline.setsByLevel[level] ?? guideline.setsByLevel[DEFAULT_LEVEL]
  const isLargeMuscle = LARGE_MUSCLE_GROUPS.has(exercise.target)
  const restSeconds = isLargeMuscle
    ? guideline.restLargeMuscleSeconds
    : guideline.restSmallMuscleSeconds
  return { sets, repRangeMin: guideline.repRangeMin, repRangeMax: guideline.repRangeMax, restSeconds }
}

export function buildRoutineItems(exercises: Exercise[], goals: UserGoals | null): RoutineItem[] {
  return exercises.map((exercise) => ({ exercise, prescription: getPrescription(exercise, goals) }))
}

// Tempo médio assumido por série (execução + transição), usado só pra estimar a duração
// total do treino na Home — não é uma medição real, é uma estimativa grosseira.
const ASSUMED_SECONDS_PER_SET = 40
const WARMUP_MINUTES = 5
const COOLDOWN_MINUTES = 5

/** Estimativa de duração total do treino (aquecimento + séries + descansos + desaquecimento), em minutos. */
export function estimateWorkoutMinutes(items: RoutineItem[]): number {
  const workSeconds = items.reduce(
    (sum, item) => sum + item.prescription.sets * (ASSUMED_SECONDS_PER_SET + item.prescription.restSeconds),
    0,
  )
  return WARMUP_MINUTES + Math.round(workSeconds / 60) + COOLDOWN_MINUTES
}
