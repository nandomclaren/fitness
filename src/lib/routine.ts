import { exercises } from './exercises.ts'
import { normalizeEquipment } from './equipment.ts'
import type { Exercise } from '../types/exercise.ts'
import type { MuscleId } from '../types/muscle.ts'
import type { WorkoutSplit } from '../types/workout.ts'

// Ordem de equipamentos preferida para exercícios-âncora (multiarticulares antes de isolados).
const EQUIPMENT_PRIORITY = ['barbell', 'dumbbell', 'machine', 'cable', 'body only', 'other']

// Todo split inclui abs + obliques — não existe mais um dia dedicado só a "Core"; cada
// treino de força carrega algum trabalho de core junto, do jeito que a maioria dos splits
// reais funciona na prática. "shoulders" não entra na lista simples — ver
// pickShoulderExercises: o catálogo nunca tagueia nada com target "rear_delts" (checado:
// zero exercícios), então cobertura de ombro completo (anterior/lateral/posterior) exige
// um tratamento especial dentro do próprio target "shoulders", não um segundo target.
export const SPLIT_MUSCLES: Record<WorkoutSplit, MuscleId[]> = {
  upper: ['chest', 'lats', 'upper_back', 'shoulders', 'biceps', 'triceps', 'abs', 'obliques'],
  lower: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abs', 'obliques'],
  full: ['chest', 'lats', 'quads', 'hamstrings', 'shoulders', 'glutes', 'biceps', 'triceps', 'abs', 'obliques'],
}

// Heurísticas por nome pra diferenciar as três porções do deltoide dentro do único target
// "shoulders" do catálogo (anterior = press composto; lateral = elevação lateral pura;
// posterior = variantes "rear"/"reverse" — rear delt raise, reverse fly, etc.).
const SHOULDER_PRESS_PATTERN = /press/i
const SHOULDER_REAR_PATTERN = /rear|reverse/i
const SHOULDER_LATERAL_PATTERN = /lateral/i

/**
 * Escolhe o melhor exercício pra um alvo muscular, considerando quantas vezes cada
 * candidato já foi usado no plano inteiro (não só nessa rotina). Sem exclusão rígida:
 * quando todo candidato "novo" já foi usado (catálogo pequeno pro alvo), prefere repetir o
 * MENOS usado em vez de travar sempre no mesmo — é isso que dá variedade entre rotinas
 * repetidas (ex.: full body 1 e full body 3 de um plano de 3 rotinas) em vez de duplicar
 * exercício por exercício.
 */
function bestExerciseFor(
  target: MuscleId,
  usage: Map<string, number>,
  allowedEquipment: Set<string> | null,
  namePattern?: RegExp,
  excludePattern?: RegExp,
): Exercise | undefined {
  let candidates = exercises.filter((e) => e.target === target)
  if (namePattern) {
    candidates = candidates.filter((e) => namePattern.test(e.nameEn) || namePattern.test(e.name))
  }
  if (excludePattern) {
    candidates = candidates.filter((e) => !excludePattern.test(e.nameEn) && !excludePattern.test(e.name))
  }
  if (allowedEquipment) {
    const filtered = candidates.filter((e) => allowedEquipment.has(normalizeEquipment(e.equipment)))
    // Se nada bater com o equipamento disponível, prefere mostrar alguma opção a pular
    // o grupo muscular inteiro — cai de volta pra lista sem o filtro.
    if (filtered.length > 0) candidates = filtered
  }
  if (candidates.length === 0) return undefined
  candidates.sort((a, b) => {
    const usageDiff = (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0)
    if (usageDiff !== 0) return usageDiff
    const pa = EQUIPMENT_PRIORITY.indexOf(normalizeEquipment(a.equipment))
    const pb = EQUIPMENT_PRIORITY.indexOf(normalizeEquipment(b.equipment))
    return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb)
  })
  return candidates[0]
}

function markUsed(usage: Map<string, number>, exercise: Exercise) {
  usage.set(exercise.id, (usage.get(exercise.id) ?? 0) + 1)
}

/**
 * Cobertura de ombro em até `maxSlots` exercícios (anterior/lateral/posterior, nessa
 * ordem de prioridade) em vez de 1 só — um único exercício-âncora de "shoulders" nunca
 * cobre a cabeça lateral nem a posterior de propósito. `maxSlots` é 3 só pro split
 * "upper" (dia com espaço de sobra pra dedicar a ombro); no "full" fica em 1, senão um dia
 * de corpo inteiro — que já cobre vários outros grupos musculares — ficaria com 3
 * exercícios só de ombro, desproporcional ao resto da rotina (o próprio Alpha Progression,
 * usado de referência, também só dedica múltiplos exercícios de ombro no dia upper).
 */
function pickShoulderExercises(
  usage: Map<string, number>,
  allowedEquipment: Set<string> | null,
  maxSlots: number,
): Exercise[] {
  const picked: Exercise[] = []
  if (maxSlots <= 0) return picked

  const press =
    bestExerciseFor('shoulders', usage, allowedEquipment, SHOULDER_PRESS_PATTERN) ??
    bestExerciseFor('shoulders', usage, allowedEquipment)
  if (press) {
    markUsed(usage, press)
    picked.push(press)
  }
  if (picked.length >= maxSlots) return picked

  const lateral = bestExerciseFor(
    'shoulders',
    usage,
    allowedEquipment,
    SHOULDER_LATERAL_PATTERN,
    SHOULDER_REAR_PATTERN,
  )
  if (lateral && !picked.some((e) => e.id === lateral.id)) {
    markUsed(usage, lateral)
    picked.push(lateral)
  }
  if (picked.length >= maxSlots) return picked

  const rear = bestExerciseFor('shoulders', usage, allowedEquipment, SHOULDER_REAR_PATTERN)
  if (rear && !picked.some((e) => e.id === rear.id)) {
    markUsed(usage, rear)
    picked.push(rear)
  }

  return picked
}

/**
 * Monta uma rotina sugerida balanceada (um exercício-âncora por grupo muscular do split,
 * com cobertura de ombro em 3 porções quando o split inclui "shoulders"), respeitando os
 * equipamentos marcados como disponíveis em Ajustes quando informados.
 *
 * `usage` é opcional e, quando compartilhado entre várias chamadas (um plano com várias
 * rotinas), garante variedade entre rotinas repetidas do mesmo split em vez de gerar a
 * lista idêntica toda vez — ver `buildRuleBasedRoutines` em `server/routes/plans.ts`.
 */
export function buildSuggestedRoutine(
  split: WorkoutSplit,
  equipment?: string[],
  usage: Map<string, number> = new Map<string, number>(),
): Exercise[] {
  const targets = SPLIT_MUSCLES[split]
  const allowedEquipment = equipment?.length ? new Set(equipment) : null
  const shoulderSlots = split === 'upper' ? 3 : 1
  const routine: Exercise[] = []
  for (const target of targets) {
    if (target === 'shoulders') {
      routine.push(...pickShoulderExercises(usage, allowedEquipment, shoulderSlots))
      continue
    }
    const exercise = bestExerciseFor(target, usage, allowedEquipment)
    if (exercise) {
      markUsed(usage, exercise)
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
