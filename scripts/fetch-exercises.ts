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
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { ProxyAgent, setGlobalDispatcher } from 'undici'
import { normalizeMuscleName, type MuscleId } from '../src/types/muscle'

// Respeita HTTPS_PROXY/HTTP_PROXY se definida (ex.: redes corporativas, sandboxes) — o
// fetch nativo do Node, ao contrário de curl/git/npm, não lê essa variável sozinho.
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl))
}
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
  instructions?: string[]
  // A listagem da API atual NÃO inclui gifUrl — o GIF só vem de um endpoint à parte
  // (ver fetchExerciseDbCuratedGifs), que gasta 1 requisição de cota por exercício.
}

async function fetchAllExerciseDbItems(headers: Record<string, string>): Promise<ExerciseDbItem[]> {
  // O plano gratuito da RapidAPI para a ExerciseDB ignora um `limit` maior e sempre
  // devolve no máximo 10 itens por página — por isso paginamos até vir uma página vazia,
  // avançando o offset pelo tamanho real recebido (nunca pelo limit pedido).
  const limit = 100
  let offset = 0
  const all: ExerciseDbItem[] = []
  console.log('Baixando lista de exercícios da ExerciseDB via RapidAPI...')
  for (;;) {
    const url = `https://exercisedb.p.rapidapi.com/exercises?limit=${limit}&offset=${offset}`
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`ExerciseDB HTTP ${res.status}: ${await res.text()}`)
    const page: ExerciseDbItem[] = await res.json()
    if (page.length === 0) break
    all.push(...page)
    console.log(`  -> offset ${offset}: +${page.length} (total ${all.length})`)
    offset += page.length
    // Pausa curta entre requisições para não estourar o limite de taxa por segundo do plano gratuito.
    await new Promise((r) => setTimeout(r, 250))
  }
  return all
}

// Ordem de prioridade de equipamento nos valores usados pela ExerciseDB (diferem dos
// valores do free-exercise-db). Usada só para escolher QUAIS exercícios merecem gastar
// cota baixando o GIF real — não afeta o restante do catálogo.
const EXERCISEDB_EQUIPMENT_PRIORITY = [
  'barbell',
  'ez barbell',
  'olympic barbell',
  'trap bar',
  'dumbbell',
  'smith machine',
  'leverage machine',
  'sled machine',
  'cable',
  'kettlebell',
  'body weight',
]

function equipmentRank(equipment: string): number {
  const idx = EXERCISEDB_EQUIPMENT_PRIORITY.indexOf(equipment.toLowerCase())
  return idx === -1 ? 99 : idx
}

// Máximo de exercícios por músculo para os quais baixamos o GIF real (cada download
// gasta 1 requisição da cota mensal gratuita da RapidAPI — ver README).
const MAX_GIFS_PER_MUSCLE = 15
const GIF_RESOLUTION = 180

/**
 * Baixa a lista completa de metadados da ExerciseDB (barata: ~140 requisições no total,
 * já que cada página custa 1 requisição independente do tamanho) e, a partir dela,
 * seleciona um subconjunto prioritário (os exercícios mais "âncora" por músculo,
 * priorizando barra/halteres/máquina) para baixar o GIF animado de verdade — o único
 * jeito de exibir a mídia real no navegador, já que o endpoint de imagem exige um header
 * de autenticação que uma tag <img> não consegue enviar, então a imagem precisa ser
 * baixada aqui (com a chave) e re-hospedada em public/exercises/gifs/.
 *
 * Esse subconjunto é ADICIONADO ao catálogo existente (não substitui o free-exercise-db),
 * já que baixar o GIF de todos os ~1357 exercícios estouraria a cota gratuita mensal.
 */
async function fetchExerciseDbCuratedGifs(): Promise<Exercise[]> {
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

  const all = await fetchAllExerciseDbItems(headers)

  const byMuscle = new Map<MuscleId, ExerciseDbItem[]>()
  for (const item of all) {
    const target = normalizeMuscleName(item.target)
    if (!target) continue
    const list = byMuscle.get(target) ?? []
    list.push(item)
    byMuscle.set(target, list)
  }

  const selected: ExerciseDbItem[] = []
  for (const items of byMuscle.values()) {
    items.sort((a, b) => equipmentRank(a.equipment) - equipmentRank(b.equipment))
    selected.push(...items.slice(0, MAX_GIFS_PER_MUSCLE))
  }

  console.log(
    `\nSelecionados ${selected.length} exercícios prioritários para baixar o GIF real ` +
      `(até ${MAX_GIFS_PER_MUSCLE} por músculo) — isso gasta ${selected.length} requisições da cota.`,
  )

  mkdirSync('public/exercises/gifs', { recursive: true })

  const out: Exercise[] = []
  for (const [i, item] of selected.entries()) {
    const target = normalizeMuscleName(item.target)
    if (!target) continue
    const secondaryMuscles = Array.from(
      new Set(
        item.secondaryMuscles
          .map(normalizeMuscleName)
          .filter((m): m is MuscleId => !!m && m !== target),
      ),
    )

    const imageUrl = `https://exercisedb.p.rapidapi.com/image?resolution=${GIF_RESOLUTION}&exerciseId=${item.id}`
    const res = await fetch(imageUrl, { headers })
    if (!res.ok) {
      console.log(`  -> [${i + 1}/${selected.length}] falha ao baixar GIF de ${item.id}: HTTP ${res.status}`)
      await new Promise((r) => setTimeout(r, 300))
      continue
    }
    const gifBuffer = Buffer.from(await res.arrayBuffer())
    writeFileSync(`public/exercises/gifs/${item.id}.gif`, gifBuffer)
    console.log(`  -> [${i + 1}/${selected.length}] ${item.id} ${item.name}`)

    out.push({
      id: `edb-${item.id}`,
      name: translateName(item.name),
      bodyPart: REGION_BY_MUSCLE[target],
      target,
      secondaryMuscles,
      equipment: item.equipment,
      gifUrl: `/exercises/gifs/${item.id}.gif`,
      instructions: item.instructions,
    })

    // Pausa curta entre downloads para não estourar o limite de taxa por segundo.
    await new Promise((r) => setTimeout(r, 300))
  }

  return out
}

async function main() {
  const sourceArg = process.argv.find((a) => a.startsWith('--source='))
  const source = sourceArg ? sourceArg.split('=')[1] : 'free'

  let exercises: Exercise[]

  if (source === 'exercisedb') {
    // Modo aditivo: mantém o catálogo já existente (free-exercise-db) e acrescenta o
    // subconjunto prioritário com GIFs reais da ExerciseDB, em vez de substituir tudo
    // (baixar o GIF de todos os ~1357 exercícios estouraria a cota gratuita mensal).
    const existing: Exercise[] = JSON.parse(readFileSync(OUT_PATH, 'utf-8'))
    const curated = await fetchExerciseDbCuratedGifs()
    const existingWithoutEdb = existing.filter((e) => !e.id.startsWith('edb-'))
    exercises = [...curated, ...existingWithoutEdb]
  } else {
    exercises = await fetchFreeExerciseDb()
  }

  exercises.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  writeFileSync(OUT_PATH, JSON.stringify(exercises, null, 2) + '\n')
  console.log(`\n✔ ${exercises.length} exercícios salvos em src/data/exercises.json (fonte: ${source})`)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
