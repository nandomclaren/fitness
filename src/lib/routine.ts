import { exercises } from './exercises.ts'
import { normalizeEquipment } from './equipment.ts'
import type { Exercise } from '../types/exercise.ts'
import type { MuscleId } from '../types/muscle.ts'
import type { WorkoutSplit } from '../types/workout.ts'

// Ordem de equipamentos preferida para exercícios-âncora (multiarticulares antes de isolados).
const EQUIPMENT_PRIORITY = ['barbell', 'dumbbell', 'machine', 'cable', 'body only', 'other']

export const SPLIT_MUSCLES: Record<WorkoutSplit, MuscleId[]> = {
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
  // Estilo "Core" (ex.: Apple Fitness+): abdômen, prancha, lombar e cadeia posterior —
  // pensado pra rodar sem equipamento nenhum ou só com halteres/faixas elásticas.
  core: ['abs', 'obliques', 'lower_back', 'hamstrings', 'glutes'],
}

function bestExerciseFor(
  target: MuscleId,
  exclude: Set<string>,
  allowedEquipment: Set<string> | null,
): Exercise | undefined {
  let candidates = exercises.filter((e) => e.target === target && !exclude.has(e.id))
  if (allowedEquipment) {
    const filtered = candidates.filter((e) => allowedEquipment.has(normalizeEquipment(e.equipment)))
    // Se nada bater com o equipamento disponível, prefere mostrar alguma opção a pular
    // o grupo muscular inteiro — cai de volta pra lista sem o filtro.
    if (filtered.length > 0) candidates = filtered
  }
  if (candidates.length === 0) return undefined
  candidates.sort((a, b) => {
    const pa = EQUIPMENT_PRIORITY.indexOf(normalizeEquipment(a.equipment))
    const pb = EQUIPMENT_PRIORITY.indexOf(normalizeEquipment(b.equipment))
    return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb)
  })
  return candidates[0]
}

/**
 * Monta uma rotina sugerida balanceada (um exercício-âncora por grupo muscular do split),
 * respeitando os equipamentos marcados como disponíveis em Ajustes quando informados.
 */
export function buildSuggestedRoutine(split: WorkoutSplit, equipment?: string[]): Exercise[] {
  const targets = SPLIT_MUSCLES[split]
  const allowedEquipment = equipment?.length ? new Set(equipment) : null
  const used = new Set<string>()
  const routine: Exercise[] = []
  for (const target of targets) {
    const exercise = bestExerciseFor(target, used, allowedEquipment)
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
  core: 'Core',
}
