import { requiresPullupBar } from './pullupBar.ts'
import type { Exercise } from '../types/exercise.ts'

/**
 * Normaliza os valores de "equipment" das duas fontes de dados (free-exercise-db e
 * ExerciseDB, que usam grafias diferentes) para os mesmos IDs usados na seleção de
 * equipamentos disponíveis em Ajustes (`EQUIPMENT_OPTIONS`). Assim, filtrar exercícios
 * pelo que o usuário marcou como disponível funciona igual não importa de onde o
 * exercício veio.
 */
const EQUIPMENT_ALIASES: Record<string, string> = {
  barbell: 'barbell',
  'olympic barbell': 'barbell',
  'ez barbell': 'barbell',
  'e-z curl bar': 'barbell',
  'trap bar': 'barbell',
  dumbbell: 'dumbbell',
  machine: 'machine',
  'leverage machine': 'machine',
  'smith machine': 'machine',
  'sled machine': 'machine',
  cable: 'cable',
  'body only': 'body only',
  'body weight': 'body only',
  kettlebell: 'kettlebells',
  kettlebells: 'kettlebells',
  bands: 'bands',
  'resistance band': 'bands',
}

export function normalizeEquipment(raw: string): string {
  return EQUIPMENT_ALIASES[raw.toLowerCase()] ?? raw.toLowerCase()
}

/**
 * Equipamento "de verdade" necessário pro exercício, pra fins de FILTRAGEM por
 * disponibilidade — corrige o caso de exercícios que a fonte de dados tagueia como
 * "body only"/"body weight" (sem peso externo) mas que na prática exigem um equipamento
 * físico específico (barra fixa: ver `pullupBar.ts`). Use esta função em vez de
 * `normalizeEquipment(exercise.equipment)` sempre que o objetivo for decidir se o usuário
 * consegue fazer o exercício com o que tem disponível — `normalizeEquipment` sozinha ainda
 * serve pra exibição/ranking onde o dado bruto (sem essa correção) é o que interessa.
 *
 * A correção só entra quando o equipamento cru já normaliza pra "body only" — variantes de
 * pull-up já tagueadas com equipamento de verdade (ex.: "leverage machine" nas máquinas de
 * pull-up assistido) não devem virar "pull-up bar": elas continuam certas como estão,
 * exigem a máquina, não uma barra. Sem essa guarda, o nome bater com o padrão de
 * `requiresPullupBar` reclassificava até essas máquinas incorretamente (bug encontrado ao
 * testar a correção original).
 */
export function effectiveEquipment(exercise: Pick<Exercise, 'name' | 'nameEn' | 'equipment'>): string {
  const normalized = normalizeEquipment(exercise.equipment)
  if (normalized === 'body only' && requiresPullupBar(exercise)) return 'pull-up bar'
  return normalized
}
