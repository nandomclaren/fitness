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
  exercises: PlanExerciseData[]
}

function routineLabel(split: WorkoutSplit, index: number, splits: WorkoutSplit[]): string {
  const occurrencesBefore = splits.slice(0, index).filter((s) => s === split).length
  const base = SPLIT_LABELS_PT[split]
  return occurrencesBefore === 0 ? base : `${base} ${occurrencesBefore + 1}`
}

function buildRuleBasedRoutines(splits: WorkoutSplit[], goals: UserGoals | null): PlanRoutineData[] {
  return splits.map((split, i) => {
    const routineExercises = buildSuggestedRoutine(split, goals?.equipment)
    return {
      label: routineLabel(split, i, splits),
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
      rationale: { type: 'string', description: 'Raciocínio (2-4 frases, em português).' },
      routines: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
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
          required: ['label', 'exercises'],
          additionalProperties: false,
        },
      },
    },
    required: ['name', 'rationale', 'routines'],
    additionalProperties: false,
  },
  strict: true,
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

  const splitsText = splits
    .map((s, i) => `Rotina ${i + 1}: split "${s}" (${SPLIT_LABELS_PT[s]})`)
    .join('; ')

  const response = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 8000,
    output_config: { effort: 'medium' },
    tools: [AI_PLAN_TOOL],
    tool_choice: { type: 'tool', name: 'generate_plan' },
    system:
      'Você é um personal trainer especialista em hipertrofia e força. Monte um plano de ' +
      `treino com exatamente ${splits.length} rotina(s): ${splitsText}. Escolha exercícios ` +
      'EXCLUSIVAMENTE pelos IDs do catálogo fornecido (nunca invente IDs), balanceando os ' +
      'grupos musculares de cada split e priorizando compostos antes de isolados. Adapte ' +
      'séries/reps/descanso ao objetivo, nível e limitações do usuário.',
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
            exercises: { create: r.exercises.map((e, j) => ({ ...e, order: j })) },
          })),
        },
      },
      include: { routines: { include: { exercises: true } } },
    }),
  ])

  res.json(plan)
})
