export interface PlanExercise {
  id: string
  exerciseId: string
  order: number
  sets: number
  repRangeMin: number
  repRangeMax: number
  restSeconds: number
}

export interface PlanRoutine {
  id: string
  planId: string
  label: string
  order: number
  exercises: PlanExercise[]
}

export type WorkoutPlanStatus = 'proposed' | 'active' | 'archived'

export interface WorkoutPlan {
  id: string
  name: string
  rationale: string
  durationWeeks: number | null
  status: WorkoutPlanStatus
  activatedAt: string | null
  createdAt: string
  routines: PlanRoutine[]
}

export interface ActiveWorkoutPlan extends WorkoutPlan {
  nextRoutineId: string | null
}

export interface CoachMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** Data URLs ("data:image/jpeg;base64,...") anexadas pelo usuário. */
  images: string[]
  proposedPlanId: string | null
  proposedPlan: WorkoutPlan | null
  createdAt: string
}
