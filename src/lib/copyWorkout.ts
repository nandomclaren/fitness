import { getExercise } from './exercises.ts'
import type { SetEntry } from '../types/workout.ts'

/**
 * Monta o texto do treino pra copiar/colar em outro app (ex.: Strong, Hevy, notas).
 * Formato: "* Nome do Exercício: peso * séries * reps" (peso omitido se for corporal).
 * Quando as séries de um exercício não são uniformes (peso/reps variam), lista cada
 * série separadamente em vez de comprimir em "séries * reps".
 */
export function buildWorkoutCopyText(sets: SetEntry[]): string {
  const order: string[] = []
  const byExercise = new Map<string, SetEntry[]>()
  for (const set of sets) {
    if (!byExercise.has(set.exerciseId)) {
      byExercise.set(set.exerciseId, [])
      order.push(set.exerciseId)
    }
    byExercise.get(set.exerciseId)!.push(set)
  }

  const lines: string[] = []
  for (const exerciseId of order) {
    const exerciseSets = byExercise
      .get(exerciseId)!
      .slice()
      .sort((a, b) => a.setNumber - b.setNumber)

    const exercise = getExercise(exerciseId)
    const name = exercise?.nameEn ?? exercise?.name ?? exerciseId

    const isBodyweight = exerciseSets.every((s) => s.weightKg === 0)
    const sameWeight = exerciseSets.every((s) => s.weightKg === exerciseSets[0].weightKg)
    const sameReps = exerciseSets.every((s) => s.reps === exerciseSets[0].reps)
    const sameSides = exerciseSets.every((s) => s.sides === exerciseSets[0].sides)

    let detail: string
    if (sameWeight && sameReps) {
      detail = isBodyweight
        ? `${exerciseSets.length} * ${exerciseSets[0].reps}`
        : `${exerciseSets[0].weightKg} kg * ${exerciseSets.length} * ${exerciseSets[0].reps}`
      // Reps unilaterais são por lado — anota isso pra não parecer o total.
      if (sameSides && exerciseSets[0].sides > 1) detail += ' (each side)'
    } else {
      detail = exerciseSets
        .map((s) => {
          const reps = isBodyweight ? `${s.reps}` : `${s.weightKg}kg x${s.reps}`
          return s.sides > 1 ? `${reps} (each side)` : reps
        })
        .join(', ')
    }

    lines.push(`* ${name}: ${detail}`)
  }

  return lines.join('\n')
}
