import exercisesJson from '../src/data/exercises.json' with { type: 'json' }
import type { Exercise } from '../src/types/exercise.ts'
import type { MuscleId } from '../src/types/muscle.ts'

export const exercises: Exercise[] = exercisesJson as Exercise[]

const byId = new Map(exercises.map((e) => [e.id, e]))

export function getExercise(id: string): Exercise | undefined {
  return byId.get(id)
}

/** Versão compacta do catálogo (sem gifUrl/instructions) para caber no prompt da IA. */
export function compactCatalog(): Array<{
  id: string
  name: string
  bodyPart: string
  target: MuscleId
  secondaryMuscles: MuscleId[]
  equipment: string
}> {
  return exercises.map((e) => ({
    id: e.id,
    name: e.name,
    bodyPart: e.bodyPart,
    target: e.target,
    secondaryMuscles: e.secondaryMuscles,
    equipment: e.equipment,
  }))
}
