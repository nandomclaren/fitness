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
  split: WorkoutSplit
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
