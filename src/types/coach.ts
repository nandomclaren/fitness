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
  /** Raciocínio específico dessa rotina — só preenchido no caminho de IA. */
  rationale: string | null
  exercises: PlanExercise[]
}

export type WorkoutPlanStatus = 'proposed' | 'scheduled' | 'active' | 'archived'

export interface WorkoutPlan {
  id: string
  name: string
  rationale: string
  durationWeeks: number | null
  status: WorkoutPlanStatus
  /** Insere uma semana de deload (menos série, RIR alvo mais alto) a cada 4 semanas do plano. */
  deload: boolean
  /** Desliza a faixa de reps prescrita da semana 1 até a última semana do bloco. */
  linearPeriodization: boolean
  /** Só presente quando status="scheduled": data em que o plano vira ativo sozinho. */
  scheduledFor: string | null
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
