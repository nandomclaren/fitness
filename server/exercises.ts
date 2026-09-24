import exercisesJson from '../src/data/exercises.json' with { type: 'json' }
import type { Exercise } from '../src/types/exercise.ts'
import type { MuscleId } from '../src/types/muscle.ts'
import { effectiveEquipment } from '../src/lib/equipment.ts'

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

/**
 * IDs de exercícios cujo equipamento EFETIVO (`effectiveEquipment` — corrige o caso de
 * exercícios tagueados "body only" que na prática exigem barra fixa, ver `pullupBar.ts`)
 * está entre os disponíveis. Calculado a partir dos objetos completos (`exercises`, que
 * têm `nameEn` — a tradução em português às vezes não carrega o sinal necessário, ex.:
 * "Elevação de Pernas na Barra" não bate com nenhum padrão, só o `nameEn`
 * "Hanging Leg Raise" bate) pra não precisar inflar `compactCatalog()` com um campo extra
 * só pra essa checagem e gastar token à toa no prompt da IA.
 */
export function idsForEquipment(equipmentList: string[]): Set<string> {
  const allowed = new Set(equipmentList)
  return new Set(exercises.filter((e) => allowed.has(effectiveEquipment(e))).map((e) => e.id))
}
