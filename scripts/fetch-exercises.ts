#!/usr/bin/env tsx
/**
 * Script de ingestão de exercícios.
 *
 * Consolida a biblioteca de exercícios em um arquivo estático local
 * (`src/data/exercises.json`), para que o app NUNCA dependa de chamadas de API em
 * tempo real durante a execução do treino.
 *
 * Fontes suportadas:
 *  - `free` (padrão): free-exercise-db (github.com/yuhonas/free-exercise-db), aberta,
 *    sem necessidade de chave. Usada como semente inicial do projeto.
 *  - `exercisedb`: ExerciseDB via RapidAPI (https://rapidapi.com/exercisedb/api/exercisedb).
 *    Requer a variável de ambiente RAPIDAPI_KEY. Veja instruções no README.
 *
 * Uso:
 *   npm run fetch-exercises                      # fonte "free" (sem chave)
 *   RAPIDAPI_KEY=xxxx npm run fetch-exercises -- --source=exercisedb
 */
import { writeFileSync } from 'node:fs'
import { normalizeMuscleName, type MuscleId } from '../src/types/muscle'
import type { BodyRegion, Exercise } from '../src/types/exercise'
import { NAME_TRANSLATIONS_PT } from './translations-pt'

const OUT_PATH = new URL('../src/data/exercises.json', import.meta.url)

const REGION_BY_MUSCLE: Record<MuscleId, BodyRegion> = {
  neck: 'upper body',
  traps: 'upper body',
  shoulders: 'upper body',
  rear_delts: 'upper body',
  chest: 'upper body',
  biceps: 'upper body',
  triceps: 'upper body',
  forearms: 'upper body',
  abs: 'core',
  obliques: 'core',
  lats: 'upper body',
  upper_back: 'upper body',
  lower_back: 'core',
  glutes: 'lower body',
  quads: 'lower body',
  hamstrings: 'lower body',
  adductors: 'lower body',
  abductors: 'lower body',
  calves: 'lower body',
}

function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
}

function translateName(englishName: string): string {
  const key = englishName.trim().toLowerCase()
  return NAME_TRANSLATIONS_PT[key] ?? toTitleCase(englishName)
}

function slugId(name: string, fallback: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return slug || fallback
}

interface FreeExerciseDbItem {
  id: string
  name: string
  category: string
  equipment: string | null
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  images: string[]
}

const STRENGTH_CATEGORIES = new Set([
  'strength',
  'powerlifting',
  'strongman',
  'olympic weightlifting',
])

async function fetchFreeExerciseDb(): Promise<Exercise[]> {
  const url =
    'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
  console.log(`Baixando free-exercise-db de ${url} ...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Falha ao baixar free-exercise-db: HTTP ${res.status}`)
  const items: FreeExerciseDbItem[] = await res.json()
  console.log(`  -> ${items.length} exercícios recebidos.`)

  const imageBase =
    'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'

  const out: Exercise[] = []
  for (const item of items) {
    if (!STRENGTH_CATEGORIES.has(item.category)) continue

    const target = item.primaryMuscles.map(normalizeMuscleName).find((m): m is MuscleId => !!m)
    if (!target) continue

    const secondaryMuscles = Array.from(
      new Set(
        item.secondaryMuscles
          .map(normalizeMuscleName)
          .filter((m): m is MuscleId => !!m && m !== target),
      ),
    )

    if (!item.images?.length) continue

    out.push({
      id: slugId(item.id, `free-${out.length}`),
      name: translateName(item.name),
      bodyPart: REGION_BY_MUSCLE[target],
      target,
      secondaryMuscles,
      equipment: item.equipment ?? 'nenhum',
      gifUrl: `${imageBase}/${item.images[0]}`,
      loopFrameUrl: item.images[1] ? `${imageBase}/${item.images[1]}` : undefined,
      instructions: item.instructions,
    })
  }
  return out
}

interface ExerciseDbItem {
  id: string
  name: string
  bodyPart: string
  target: string
  secondaryMuscles: string[]
  equipment: string
  gifUrl: string
  instructions?: string[]
}

async function fetchExerciseDb(): Promise<Exercise[]> {
  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) {
    throw new Error(
      'RAPIDAPI_KEY não definida. Rode: RAPIDAPI_KEY=sua_chave npm run fetch-exercises -- --source=exercisedb\n' +
        'Veja como obter a chave gratuita em https://rapidapi.com/exercisedb/api/exercisedb (seção README).',
    )
  }

  const headers = {
    'X-RapidAPI-Key': apiKey,
    'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
  }

  const limit = 100
  let offset = 0
  const all: ExerciseDbItem[] = []
  console.log('Baixando ExerciseDB via RapidAPI...')
  for (;;) {
    const url = `https://exercisedb.p.rapidapi.com/exercises?limit=${limit}&offset=${offset}`
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`ExerciseDB HTTP ${res.status}: ${await res.text()}`)
    const page: ExerciseDbItem[] = await res.json()
    if (page.length === 0) break
    all.push(...page)
    console.log(`  -> offset ${offset}: +${page.length} (total ${all.length})`)
    offset += limit
    if (page.length < limit) break
  }

  const out: Exercise[] = []
  for (const item of all) {
    const target = normalizeMuscleName(item.target)
    if (!target) continue
    const secondaryMuscles = Array.from(
      new Set(
        item.secondaryMuscles
          .map(normalizeMuscleName)
          .filter((m): m is MuscleId => !!m && m !== target),
      ),
    )
    out.push({
      id: item.id,
      name: translateName(item.name),
      bodyPart: REGION_BY_MUSCLE[target],
      target,
      secondaryMuscles,
      equipment: item.equipment,
      gifUrl: item.gifUrl,
      instructions: item.instructions,
    })
  }
  return out
}

async function main() {
  const sourceArg = process.argv.find((a) => a.startsWith('--source='))
  const source = sourceArg ? sourceArg.split('=')[1] : 'free'

  const exercises =
    source === 'exercisedb' ? await fetchExerciseDb() : await fetchFreeExerciseDb()

  exercises.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  writeFileSync(OUT_PATH, JSON.stringify(exercises, null, 2) + '\n')
  console.log(`\n✔ ${exercises.length} exercícios salvos em src/data/exercises.json (fonte: ${source})`)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
