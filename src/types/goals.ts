export type Objective = 'hipertrofia' | 'forca' | 'emagrecimento' | 'saude_geral'
export type ExperienceLevel = 'iniciante' | 'intermediario' | 'avancado'

export interface UserGoals {
  id: string
  objective: Objective
  level: ExperienceLevel
  daysPerWeek: number
  equipment: string[]
  limitations: string
  updatedAt: string
}

export const OBJECTIVE_LABELS: Record<Objective, string> = {
  hipertrofia: 'Hipertrofia (ganho de massa)',
  forca: 'Força',
  emagrecimento: 'Emagrecimento',
  saude_geral: 'Saúde geral / condicionamento',
}

export const LEVEL_LABELS: Record<ExperienceLevel, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
}

export const EQUIPMENT_OPTIONS: { id: string; label: string }[] = [
  { id: 'barbell', label: 'Barra' },
  { id: 'dumbbell', label: 'Halteres' },
  { id: 'machine', label: 'Máquinas' },
  { id: 'cable', label: 'Cabo/Polia' },
  { id: 'body only', label: 'Peso do corpo' },
  { id: 'kettlebells', label: 'Kettlebell' },
  { id: 'bands', label: 'Elásticos' },
]
