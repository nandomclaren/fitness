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

export const OBJECTIVE_DESCRIPTIONS: Record<Objective, string> = {
  hipertrofia:
    'Foco em aumentar o tamanho do músculo ("ganhar massa"). Cargas moderadas, mais repetições por série (6-12) e descansos mais curtos entre séries — é o objetivo mais comum pra quem quer mudar a estética do corpo.',
  forca:
    'Foco em levantar o máximo de peso possível, não necessariamente em crescer o músculo (embora também cresça). Cargas bem altas, poucas repetições (3-8) e descansos longos entre séries pra recuperar o sistema nervoso.',
  emagrecimento:
    'Foco em queimar calorias e preservar músculo enquanto perde gordura. Cargas mais leves, mais repetições (12-20) e descansos curtos, mantendo o coração acelerado — funciona melhor combinado com déficit calórico na alimentação.',
  saude_geral:
    'Foco em se manter ativo, saudável e funcional no dia a dia, sem buscar performance máxima em nenhuma frente. Treino equilibrado (10-15 repetições, descanso moderado) — bom ponto de partida se você não tem certeza do que quer.',
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
