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
  /** Reps in Reserve: 0 = falha, 5 = folga bastante. Passos de 0.5. */
  rir: number
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

export interface LastPerformanceSet {
  setNumber: number
  weightKg: number
  reps: number
  rir: number
  sides: number
}

export interface LastPerformance {
  weightKg: number
  reps: number
  sides: number
  rir: number
  completedAt: string
  /** Data da sessão inteira (não só dessa série) — pra rotular o card de referência. */
  sessionDate: string
  /** Todas as séries daquela sessão pra esse exercício, não só a de topo. */
  sets: LastPerformanceSet[]
}

export interface ProgressionSuggestion {
  weightKg: number
  reps: number
  rir: number
  reason: string
}
