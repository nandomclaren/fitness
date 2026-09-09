import type { MuscleId } from './muscle.ts'

export type BodyRegion = 'upper body' | 'lower body' | 'core'

export interface Exercise {
  id: string
  name: string
  /** Nome original em inglês (antes da tradução) — usado ao exportar/copiar o treino. */
  nameEn: string
  bodyPart: BodyRegion
  target: MuscleId
  secondaryMuscles: MuscleId[]
  equipment: string
  gifUrl: string
  /**
   * Segundo quadro (posição final do movimento), usado apenas quando a fonte de dados não
   * fornece um GIF animado real (ex.: free-exercise-db). O player alterna gifUrl <-> loopFrameUrl
   * para simular a execução em loop.
   */
  loopFrameUrl?: string
  instructions?: string[]
}
