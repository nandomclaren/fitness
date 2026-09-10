export type WorkoutSplit = 'upper' | 'lower' | 'full' | 'core'

export interface SetEntry {
  id: string
  sessionId: string
  exerciseId: string
  setNumber: number
  weightKg: number
  /** Reps feitas de um lado (exercícios unilaterais) ou reps normais (sides=1). */
  reps: number
  /** 1 = bilateral/normal; 2 = exercício unilateral, reps feitas dos dois lados. */
  sides: number
  rpe: number
  completedAt: string
}

export interface WorkoutSession {
  id: string
  /** Split (upper/lower/full/core) ou label de rotina de um plano do coach (ex.: "A"). */
  split: string
  exerciseIds: string[]
  startedAt: string
  finishedAt: string | null
}

export interface LastPerformance {
  weightKg: number
  reps: number
  sides: number
  rpe: number
  completedAt: string
}

export interface ProgressionSuggestion {
  weightKg: number
  reps: number
  reason: string
}
