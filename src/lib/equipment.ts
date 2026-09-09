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
