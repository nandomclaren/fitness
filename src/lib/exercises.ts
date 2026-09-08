import rawExercises from '../data/exercises.json' with { type: 'json' }
import type { Exercise } from '../types/exercise.ts'

export const exercises: Exercise[] = rawExercises as Exercise[]

const byId = new Map(exercises.map((e) => [e.id, e]))

export function getExercise(id: string): Exercise | undefined {
  return byId.get(id)
}

export function exercisesByRegion(region: Exercise['bodyPart']): Exercise[] {
  return exercises.filter((e) => e.bodyPart === region)
}
