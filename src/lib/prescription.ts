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
  /** true quando essa prescrição já é a de uma semana de deload de um plano — muda o alvo
   * de RIR da sugestão de progressão (ver progression.ts) em vez de tentar progredir. */
  deload?: boolean
}

export interface RoutineItem {
  exercise: Exercise
  prescription: Prescription
}

// --- Progressão de plano multi-semana (deload + periodização linear) -----------------

/** Semana atual do plano (1-based, travada em [1, durationWeeks]), a partir da data em que
 * foi ativado. Sem durationWeeks (plano "indefinido"), sempre semana 1 — sem periodização. */
export function currentPlanWeek(activatedAt: string, durationWeeks: number | null): number {
  if (!durationWeeks || durationWeeks <= 1) return 1
  const daysSince = Math.floor((Date.now() - new Date(activatedAt).getTime()) / 86_400_000)
  const week = Math.floor(daysSince / 7) + 1
  return Math.min(Math.max(week, 1), durationWeeks)
}

/** A cada 4 semanas do bloco é deload — deixa a última semana de um bloco de 4 sempre mais
 * leve antes de reiniciar o ciclo. */
export function isDeloadWeek(week: number): boolean {
  return week % 4 === 0
}

/**
 * Aplica deload e/ou periodização linear a uma prescrição base, pra semana atual do plano.
 * Nunca muda a prescrição base guardada (`PlanExercise`) — só o que é exibido/usado
 * naquela semana específica, calculado on-the-fly.
 */
export function applyWeekAdjustments(
  base: Omit<Prescription, 'deload'>,
  week: number,
  durationWeeks: number | null,
  opts: { deload: boolean; linearPeriodization: boolean },
): Prescription {
  let { sets, repRangeMin, repRangeMax, restSeconds } = base

  if (opts.linearPeriodization && durationWeeks && durationWeeks > 1) {
    // Semana 1 = faixa original (mais reps); última semana do bloco = faixa desloca até
    // 3 reps pra baixo (menos reps, mais perto de força) — interpolado linear no meio.
    const progress = (week - 1) / (durationWeeks - 1)
    const shift = Math.round(progress * 3)
    repRangeMin = Math.max(3, repRangeMin - shift)
    repRangeMax = Math.max(repRangeMin + 2, repRangeMax - shift)
  }

  const deload = opts.deload && isDeloadWeek(week)
  if (deload) {
    sets = Math.max(1, sets - 1)
  }

  return { sets, repRangeMin, repRangeMax, restSeconds, deload }
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
