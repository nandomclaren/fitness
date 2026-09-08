import { exercises } from './exercises.ts'
import type { Exercise } from '../types/exercise.ts'
import type { MuscleId } from '../types/muscle.ts'
import type { WorkoutSplit } from '../types/workout.ts'

// Ordem de equipamentos preferida para exercícios-âncora (multiarticulares antes de isolados).
const EQUIPMENT_PRIORITY = ['barbell', 'dumbbell', 'machine', 'cable', 'body only', 'other']

const SPLIT_MUSCLES: Record<WorkoutSplit, MuscleId[]> = {
  upper: [
    'chest',
    'lats',
    'upper_back',
    'shoulders',
    'biceps',
    'triceps',
    'rear_delts',
    'abs',
  ],
  lower: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abs'],
  full: [
    'chest',
    'lats',
    'quads',
    'hamstrings',
    'shoulders',
    'glutes',
    'biceps',
    'triceps',
    'abs',
  ],
}

function bestExerciseFor(target: MuscleId, exclude: Set<string>): Exercise | undefined {
  const candidates = exercises.filter((e) => e.target === target && !exclude.has(e.id))
  if (candidates.length === 0) return undefined
  candidates.sort((a, b) => {
    const pa = EQUIPMENT_PRIORITY.indexOf(a.equipment)
    const pb = EQUIPMENT_PRIORITY.indexOf(b.equipment)
    return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb)
  })
  return candidates[0]
}

/** Monta uma rotina sugerida balanceada (um exercício-âncora por grupo muscular do split). */
export function buildSuggestedRoutine(split: WorkoutSplit): Exercise[] {
  const targets = SPLIT_MUSCLES[split]
  const used = new Set<string>()
  const routine: Exercise[] = []
  for (const target of targets) {
    const exercise = bestExerciseFor(target, used)
    if (exercise) {
      used.add(exercise.id)
      routine.push(exercise)
    }
  }
  return routine
}

export const SPLIT_LABELS_PT: Record<WorkoutSplit, string> = {
  upper: 'Superior',
  lower: 'Inferior',
  full: 'Completo',
}
