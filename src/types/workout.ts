export type WorkoutSplit = 'upper' | 'lower' | 'full' | 'core'

export interface SetEntry {
  id: string
  sessionId: string
  exerciseId: string
  setNumber: number
  weightKg: number
  reps: number
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
  rpe: number
  completedAt: string
}

export interface ProgressionSuggestion {
  weightKg: number
  reps: number
  reason: string
}
