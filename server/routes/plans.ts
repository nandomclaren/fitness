import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../prisma.ts'
import { compactCatalog, exercises } from '../exercises.ts'
import { buildSuggestedRoutine, SPLIT_LABELS_PT } from '../../src/lib/routine.ts'
import { getPrescription } from '../../src/lib/prescription.ts'
import { normalizeEquipment } from '../../src/lib/equipment.ts'
import type { WorkoutSplit } from '../../src/types/workout.ts'
import type { UserGoals } from '../../src/types/goals.ts'

export const plansRouter = Router()

const client = new Anthropic()

// Quantas rotinas distintas o usuário escolheu no wizard -> quais splits compõem o plano.
// Não pedimos pro usuário escolher split por rotina individualmente — mantém o wizard curto.
const ROUTINE_SPLIT_SEQUENCES: Record<number, WorkoutSplit[]> = {
  1: ['full'],
  2: ['upper', 'lower'],
  3: ['upper', 'lower', 'full'],
  4: ['upper', 'lower', 'upper', 'lower'],
}

interface PlanExerciseData {
  exerciseId: string
  sets: number
  repRangeMin: number
  repRangeMax: number
  restSeconds: number
}

interface PlanRoutineData {
  label: string
  rationale: string | null
  exercises: PlanExerciseData[]
}

function routineLabel(split: WorkoutSplit, index: number, splits: WorkoutSplit[]): string {
  const occurrencesBefore = splits.slice(0, index).filter((s) => s === split).length
  const base = SPLIT_LABELS_PT[split]
  return occurrencesBefore === 0 ? base : `${base} ${occurrencesBefore + 1}`
}

function buildRuleBasedRoutines(splits: WorkoutSplit[], goals: UserGoals | null): PlanRoutineData[] {
  // Um único contador de uso compartilhado por TODAS as rotinas do plano — é o que faz
  // duas rotinas "Completo" no mesmo plano saírem com exercícios diferentes em vez de
  // idênticas (ver bestExerciseFor em src/lib/routine.ts). Uma chamada fresca de
  // buildSuggestedRoutine por rotina, como era antes, não tinha memória nenhuma entre elas.
  const usage = new Map<string, number>()
  return splits.map((split, i) => {
    const routineExercises = buildSuggestedRoutine(split, goals?.equipment, usage)
    return {
      label: routineLabel(split, i, splits),
      rationale: null,
      exercises: routineExercises.map((e) => {
        const p = getPrescription(e, goals)
        return { exerciseId: e.id, sets: p.sets, repRangeMin: p.repRangeMin, repRangeMax: p.repRangeMax, restSeconds: p.restSeconds }
      }),
    }
  })
}

const AI_PLAN_TOOL: Anthropic.Tool = {
  name: 'generate_plan',
  description: 'Gera as rotinas do plano de treino multi-semana pedido.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Nome curto do plano.' },
      rationale: {
        type: 'string',
        description: 'Filosofia geral do bloco inteiro (2-4 frases, em português).',
      },
      routines: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            rationale: {
              type: 'string',
              description:
                'Por que ESSA rotina especificamente tem esses exercícios nessa ordem, e o que ela cobre que as outras rotinas do plano não cobrem (1-3 frases, em português).',
            },
            exercises: {
              type: 'array',
              minItems: 3,
              maxItems: 9,
              items: {
                type: 'object',
                properties: {
                  exerciseId: { type: 'string' },
                  sets: { type: 'integer', minimum: 1, maximum: 6 },
                  repRangeMin: { type: 'integer', minimum: 1, maximum: 30 },
                  repRangeMax: { type: 'integer', minimum: 1, maximum: 30 },
                  restSeconds: { type: 'integer', minimum: 15, maximum: 240 },
                },
                required: ['exerciseId', 'sets', 'repRangeMin', 'repRangeMax', 'restSeconds'],
                additionalProperties: false,
              },
            },
          },
          required: ['label', 'rationale', 'exercises'],
          additionalProperties: false,
        },
      },
    },
    required: ['name', 'rationale', 'routines'],
    additionalProperties: false,
  },
  strict: true,
}

function buildSystemPrompt(splits: WorkoutSplit[]): string {
  const splitsText = splits
    .map((s, i) => `Rotina ${i + 1}: split "${s}" (${SPLIT_LABELS_PT[s]})`)
    .join('; ')
  const repeatedSplits = splits.filter((s, i) => splits.indexOf(s) !== i)

  return `Você é um personal trainer com anos de experiência prescrevendo hipertrofia e força
pra alunos reais — não um gerador de listas de exercícios. A pessoa que vai treinar com
esse plano está entregando meses de esforço físico e recuperação a essa prescrição: trate
cada rotina com a mesma precisão que colocaria numa consulta paga. Qualquer coisa
"genérica o suficiente" é uma prescrição ruim.

Monte um plano com exatamente ${splits.length} rotina(s): ${splitsText}.

Regras não-negociáveis, na ordem em que devem pesar na sua decisão:

1. IDs reais: escolha exercícios EXCLUSIVAMENTE pelos IDs do catálogo JSON fornecido a
   seguir. Nunca invente um ID nem altere a grafia de um existente.

2. Cobertura de deltoide em 3 porções: toda vez que uma rotina trabalhar ombro E a rotina
   tiver espaço (5+ exercícios), inclua exercícios distintos para as três porções do
   deltoide em vez de um único exercício de "shoulders" — o catálogo não tem um target
   dedicado pra deltoide posterior, então as três porções vêm de exercícios com target
   "shoulders" mesmo, diferenciados pelo nome: (a) um press ou composto (porção anterior),
   (b) uma elevação lateral pura — nome em inglês contém "lateral" mas NÃO "rear"/"reverse"
   (porção lateral), (c) uma variante "rear"/"reverse" no nome em inglês (rear delt raise,
   reverse fly, etc. — porção posterior) ou remada aberta/face pull. Prescrever só 1
   exercício de ombro numa rotina upper/full com espaço de sobra é exatamente o tipo de
   erro raso que esse plano não pode cometer.

3. Zero duplicação preguiçosa entre rotinas do mesmo plano: quando o mesmo grupo muscular
   aparece em mais de uma rotina do plano (comum quando um split se repete, ex. duas
   rotinas "full body" ou duas "upper" na mesma semana), NUNCA repita o exercício
   idêntico se existir alternativa no catálogo pro mesmo músculo — troque de exercício ou,
   na falta de opção melhor, ao menos de variante (pega invertida/pronada, unilateral,
   inclinado/declinado — normalmente sinalizado no próprio nome em inglês do exercício).
   Duas rotinas com a lista de exercícios idêntica no mesmo plano é uma falha de geração.${
     repeatedSplits.length > 0
       ? ` Este plano especificamente repete o split "${repeatedSplits[0]}" — preste atenção redobrada aí.`
       : ''
   }

4. Compostos antes de isolados dentro de cada rotina: a ordem da lista de exercícios É a
   ordem de execução no treino.

5. Balanceie push/pull e volume por músculo somando TODAS as rotinas do plano, não rotina
   por rotina isolada. Se um músculo aparece em várias rotinas da semana mas o antagonista
   dele aparece em só uma, isso é desbalanceado — ajuste os alvos de cada rotina pra que a
   semana inteira fique equilibrada entre empurrar e puxar, superior e inferior.

6. Séries/reps/descanso seguem o objetivo, nível e limitações do usuário — pense em cada
   exercício, não aplique uma tabela genérica igual pra tudo. Se houver lesão ou
   limitação informada, evite exercícios que a agridam diretamente e prefira alternativas
   mais seguras pro mesmo músculo (ex.: dor no ombro → evite desenvolvimento militar com
   barra atrás da nuca, prefira press com halteres em ângulo neutro ou máquina).

7. O split é um guia de ênfase, não uma lista fixa de músculos: use julgamento pra decidir
   quantos exercícios e quais músculos entram em cada rotina específica, dado o resto do
   plano — não force os mesmos grupos todo "upper" só porque apareceram da última vez.

8. Escreva um "rationale" por rotina (1-3 frases) explicando a lógica ESPECÍFICA daquela
   rotina: por que esses exercícios, nessa ordem, e o que ela cobre que as outras rotinas
   do plano não cobrem. Escreva também um "rationale" geral do plano (2-4 frases) com a
   filosofia do bloco inteiro. Ambos em português, para o próprio usuário ler.

Pense como treinador de verdade: um aluno que treina várias vezes por semana percebe na
hora se a segunda sessão de um mesmo tipo de dia é só um decalque da primeira — isso
transmite que ninguém pensou naquela sessão específica.`
}

async function generateWithAi(
  splits: WorkoutSplit[],
  goals: UserGoals | null,
): Promise<{ name: string; rationale: string; routines: PlanRoutineData[] }> {
  const allowedEquipment = goals?.equipment.length ? new Set(goals.equipment) : null
  let catalog = compactCatalog()
  if (allowedEquipment) {
    const filtered = catalog.filter((e) => allowedEquipment.has(normalizeEquipment(e.equipment)))
    if (filtered.length >= 15) catalog = filtered
  }

  const goalsText = goals
    ? `Objetivo: ${goals.objective}. Nível: ${goals.level}. Equipamentos disponíveis: ${goals.equipment.join(', ') || 'qualquer'}. Limitações/lesões: ${goals.limitations || 'nenhuma informada'}.`
    : 'Nenhum objetivo cadastrado ainda — use um treino balanceado e genérico para o nível intermediário.'

  const stream = client.messages.stream({
    model: 'claude-opus-5',
    max_tokens: 16000,
    output_config: { effort: 'max' },
    tools: [AI_PLAN_TOOL],
    tool_choice: { type: 'tool', name: 'generate_plan' },
    system: buildSystemPrompt(splits),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Catálogo de exercícios disponíveis (JSON):\n${JSON.stringify(catalog)}`,
            cache_control: { type: 'ephemeral' },
          },
          { type: 'text', text: goalsText },
        ],
      },
    ],
  })
  const response = await stream.finalMessage()

  const toolUse = response.content.find((b) => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('IA não retornou a ferramenta esperada')
  }
  const input = toolUse.input as { name: string; rationale: string; routines: PlanRoutineData[] }

  const validIds = new Set(exercises.map((e) => e.id))
  const routines = input.routines
    .map((r) => ({ ...r, exercises: r.exercises.filter((e) => validIds.has(e.exerciseId)) }))
    .filter((r) => r.exercises.length >= 2)

  if (routines.length === 0) throw new Error('IA não retornou exercícios válidos')

  return { name: input.name, rationale: input.rationale, routines }
}

plansRouter.get('/plans', async (_req, res) => {
  const plans = await prisma.workoutPlan.findMany({
    where: { status: { in: ['active', 'archived'] } },
    include: { routines: { include: { exercises: true }, orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })
  plans.sort((a, b) => (a.status === 'active' ? -1 : b.status === 'active' ? 1 : 0))
  res.json(plans)
})

plansRouter.post('/plans/:id/activate', async (req, res) => {
  const plan = await prisma.workoutPlan.findUnique({ where: { id: req.params.id } })
  if (!plan) {
    res.status(404).json({ error: 'plano não encontrado' })
    return
  }
  if (plan.status !== 'active') {
    await prisma.$transaction([
      prisma.workoutPlan.updateMany({ where: { status: 'active' }, data: { status: 'archived' } }),
      prisma.workoutPlan.update({ where: { id: plan.id }, data: { status: 'active', activatedAt: new Date() } }),
    ])
  }
  res.json({ ok: true })
})

plansRouter.post('/plans/:id/archive', async (req, res) => {
  const plan = await prisma.workoutPlan.findUnique({ where: { id: req.params.id } })
  if (!plan || plan.status !== 'active') {
    res.status(404).json({ error: 'plano não encontrado ou não está ativo' })
    return
  }
  await prisma.workoutPlan.update({ where: { id: plan.id }, data: { status: 'archived' } })
  res.json({ ok: true })
})

plansRouter.post('/plans', async (req, res) => {
  const { mode, name, numRoutines, durationWeeks, deload, linearPeriodization } = req.body as {
    mode: 'rule' | 'ai'
    name?: string
    numRoutines: number
    durationWeeks: number
    deload: boolean
    linearPeriodization: boolean
  }

  if (!numRoutines || numRoutines < 1 || numRoutines > 4) {
    res.status(400).json({ error: 'numRoutines deve ser entre 1 e 4' })
    return
  }

  const goalsRow = await prisma.userGoals.findUnique({ where: { id: 'me' } })
  const goals = goalsRow as UserGoals | null
  const splits = ROUTINE_SPLIT_SEQUENCES[numRoutines] ?? ROUTINE_SPLIT_SEQUENCES[1]

  let routinesData: PlanRoutineData[]
  let rationale: string
  let planName =
    name?.trim() ||
    (splits.length === 1
      ? `Plano ${SPLIT_LABELS_PT[splits[0]]}`
      : `Plano ${splits.map((s) => SPLIT_LABELS_PT[s]).join('/')}`)

  if (mode === 'ai') {
    try {
      const generated = await generateWithAi(splits, goals)
      routinesData = generated.routines
      rationale = generated.rationale
      if (!name?.trim()) planName = generated.name
    } catch (err) {
      console.error('Erro ao gerar plano com IA, caindo pra regra fixa:', err)
      routinesData = buildRuleBasedRoutines(splits, goals)
      rationale = 'Não foi possível gerar com IA agora — usando a rotina balanceada padrão.'
    }
  } else {
    routinesData = buildRuleBasedRoutines(splits, goals)
    rationale =
      'Rotina balanceada padrão (regra fixa ACSM/NSCA), um exercício-âncora por grupo muscular do split.'
  }

  const [, plan] = await prisma.$transaction([
    prisma.workoutPlan.updateMany({ where: { status: 'active' }, data: { status: 'archived' } }),
    prisma.workoutPlan.create({
      data: {
        name: planName,
        rationale,
        durationWeeks,
        status: 'active',
        activatedAt: new Date(),
        deload: !!deload,
        linearPeriodization: !!linearPeriodization,
        routines: {
          create: routinesData.map((r, i) => ({
            label: r.label,
            order: i,
            rationale: r.rationale,
            exercises: { create: r.exercises.map((e, j) => ({ ...e, order: j })) },
          })),
        },
      },
      include: { routines: { include: { exercises: true } } },
    }),
  ])

  res.json(plan)
})
