import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../prisma.ts'
import { compactCatalog, exercises } from '../exercises.ts'

export const coachRouter = Router()

const client = new Anthropic()

const PROPOSE_PLAN_TOOL: Anthropic.Tool = {
  name: 'propose_plan',
  description:
    'Salva uma proposta de plano de treino estruturado (uma ou mais rotinas nomeadas, ' +
    'ex.: "A"/"B", cada uma com exercícios e prescrição fixos). Só use quando o usuário ' +
    'já concordou com uma direção concreta na conversa — não proponha a cada mensagem.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Nome curto do plano, ex.: "Treino A/B — Hipertrofia".' },
      rationale: {
        type: 'string',
        description: 'Explicação (3-6 frases, em português) do raciocínio por trás do plano.',
      },
      durationWeeks: {
        type: 'integer',
        description: 'Por quantas semanas manter esse esquema antes de revisar. Omita se indefinido.',
      },
      routines: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Nome da rotina, ex.: "A", "B", "Superior".' },
            exercises: {
              type: 'array',
              minItems: 2,
              maxItems: 10,
              items: {
                type: 'object',
                properties: {
                  exerciseId: { type: 'string', description: 'ID do catálogo fornecido.' },
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
}

const SYSTEM_PROMPT =
  'Você é um coach de musculação experiente, especialista em treinamento baseado em ' +
  'evidência (diretrizes ACSM e NSCA de progressão de treinamento resistido). Converse em ' +
  'português, de forma direta e prática, olhando o histórico real de treinos do usuário ' +
  '(cargas, reps e RPE logados) para decidir e explicar ajustes de progressão de carga, ' +
  'volume ou esquema de séries/reps.\n\n' +
  'Regras importantes:\n' +
  '- Nunca invente números sem justificativa: baseie ajustes de carga em sinais reais do ' +
  'histórico (ex.: bateu o teto da faixa de reps em várias sessões seguidas → sugerir +2.5 a ' +
  '5% de carga; RPE consistentemente muito alto ou queda de desempenho → sugerir manter ou ' +
  'reduzir, possível deload).\n' +
  '- Fique dentro de faixas fisiologicamente sensatas: 1-6 séries por exercício, 1-30 reps, ' +
  '15-240s de descanso.\n' +
  '- Só use a ferramenta propose_plan depois que o usuário concordar com uma direção concreta ' +
  '(ex.: "faz sentido, monta um A/B pra mim"). Não proponha um plano na primeira mensagem sem ' +
  'contexto suficiente — faça perguntas antes se precisar (frequência semanal, quais treinos ' +
  'estão travados, dores/limitações).\n' +
  '- exerciseId sempre vem do catálogo fornecido — nunca invente IDs.\n' +
  '- Depois de chamar propose_plan, o plano fica pendente de aprovação explícita do usuário ' +
  'na interface — você não precisa pedir confirmação de novo no texto, só resumir o que foi ' +
  'proposto.'

interface HistorySession {
  split: string
  date: string
  sets: Array<{ exerciseId: string; weightKg: number; reps: number; rpe: number }>
}

async function buildContextText(): Promise<string> {
  const [goals, activePlan, recentSessions] = await Promise.all([
    prisma.userGoals.findUnique({ where: { id: 'me' } }),
    prisma.workoutPlan.findFirst({
      where: { status: 'active' },
      include: { routines: { include: { exercises: true }, orderBy: { order: 'asc' } } },
    }),
    prisma.workoutSession.findMany({
      where: { finishedAt: { not: null } },
      orderBy: { startedAt: 'desc' },
      take: 12,
      include: { sets: true },
    }),
  ])

  const goalsText = goals
    ? `Objetivo: ${goals.objective}. Nível: ${goals.level}. Dias/semana: ${goals.daysPerWeek}. ` +
      `Equipamentos disponíveis: ${goals.equipment.join(', ') || 'qualquer'}. ` +
      `Limitações/lesões: ${goals.limitations || 'nenhuma informada'}.`
    : 'Usuário ainda não preencheu objetivos.'

  const planText = activePlan
    ? `Plano ativo no momento: "${activePlan.name}" (${activePlan.routines.length} rotina(s): ` +
      `${activePlan.routines.map((r) => r.label).join(', ')}).`
    : 'Nenhum plano estruturado ativo — o usuário está usando a sugestão automática por split.'

  const history: HistorySession[] = recentSessions.map((s) => ({
    split: s.split,
    date: s.startedAt.toISOString().slice(0, 10),
    sets: s.sets.map((set) => ({
      exerciseId: set.exerciseId,
      weightKg: set.weightKg,
      reps: set.reps,
      rpe: set.rpe,
    })),
  }))

  return (
    `${goalsText}\n${planText}\n\n` +
    `Histórico das últimas ${history.length} sessões concluídas (mais recente primeiro, ` +
    `séries na ordem em que foram feitas):\n${JSON.stringify(history)}`
  )
}

coachRouter.get('/coach/messages', async (_req, res) => {
  const messages = await prisma.coachMessage.findMany({
    orderBy: { createdAt: 'asc' },
    include: { proposedPlan: { include: { routines: { include: { exercises: true } } } } },
  })
  res.json(messages)
})

coachRouter.post('/coach/messages', async (req, res) => {
  const { content } = req.body as { content: string }
  if (!content?.trim()) {
    res.status(400).json({ error: 'mensagem vazia' })
    return
  }

  await prisma.coachMessage.create({ data: { role: 'user', content } })

  const priorMessages = await prisma.coachMessage.findMany({
    orderBy: { createdAt: 'asc' },
  })

  const contextText = await buildContextText()
  const catalog = compactCatalog()

  try {
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2048,
      output_config: { effort: 'medium' },
      tools: [PROPOSE_PLAN_TOOL],
      system: [
        { type: 'text', text: SYSTEM_PROMPT },
        {
          type: 'text',
          text: `Catálogo de exercícios disponíveis (JSON):\n${JSON.stringify(catalog)}`,
          cache_control: { type: 'ephemeral' },
        },
        { type: 'text', text: contextText },
      ],
      messages: priorMessages.map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      })),
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const replyText = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    const toolUse = response.content.find((b) => b.type === 'tool_use')

    let proposedPlanId: string | undefined

    if (toolUse && toolUse.type === 'tool_use' && toolUse.name === 'propose_plan') {
      const input = toolUse.input as {
        name: string
        rationale: string
        durationWeeks?: number
        routines: Array<{
          label: string
          exercises: Array<{
            exerciseId: string
            sets: number
            repRangeMin: number
            repRangeMax: number
            restSeconds: number
          }>
        }>
      }

      const validIds = new Set(exercises.map((e) => e.id))
      const routinesWithValidExercises = input.routines
        .map((r) => ({ ...r, exercises: r.exercises.filter((e) => validIds.has(e.exerciseId)) }))
        .filter((r) => r.exercises.length >= 2)

      if (routinesWithValidExercises.length > 0) {
        const plan = await prisma.workoutPlan.create({
          data: {
            name: input.name,
            rationale: input.rationale,
            durationWeeks: input.durationWeeks,
            status: 'proposed',
            routines: {
              create: routinesWithValidExercises.map((r, order) => ({
                label: r.label,
                order,
                exercises: {
                  create: r.exercises.map((e, exOrder) => ({
                    exerciseId: e.exerciseId,
                    order: exOrder,
                    sets: e.sets,
                    repRangeMin: e.repRangeMin,
                    repRangeMax: e.repRangeMax,
                    restSeconds: e.restSeconds,
                  })),
                },
              })),
            },
          },
        })
        proposedPlanId = plan.id
      }
    }

    const assistantMessage = await prisma.coachMessage.create({
      data: {
        role: 'assistant',
        content: replyText || 'Plano proposto — veja o card acima para aprovar.',
        proposedPlanId,
      },
      include: { proposedPlan: { include: { routines: { include: { exercises: true } } } } },
    })

    res.json(assistantMessage)
  } catch (err) {
    console.error('Erro ao conversar com o coach de IA:', err)
    const assistantMessage = await prisma.coachMessage.create({
      data: {
        role: 'assistant',
        content: 'Não consegui pensar nisso agora — tenta de novo em instantes.',
      },
    })
    res.json(assistantMessage)
  }
})

coachRouter.post('/coach/plans/:id/approve', async (req, res) => {
  const { id } = req.params
  const plan = await prisma.workoutPlan.findUnique({ where: { id } })
  if (!plan || plan.status !== 'proposed') {
    res.status(404).json({ error: 'plano não encontrado ou já resolvido' })
    return
  }

  await prisma.$transaction([
    prisma.workoutPlan.updateMany({ where: { status: 'active' }, data: { status: 'archived' } }),
    prisma.workoutPlan.update({
      where: { id },
      data: { status: 'active', activatedAt: new Date() },
    }),
  ])

  res.json({ ok: true })
})

coachRouter.post('/coach/plans/:id/dismiss', async (req, res) => {
  const { id } = req.params
  const plan = await prisma.workoutPlan.findUnique({ where: { id } })
  if (!plan || plan.status !== 'proposed') {
    res.status(404).json({ error: 'plano não encontrado ou já resolvido' })
    return
  }
  await prisma.workoutPlan.update({ where: { id }, data: { status: 'archived' } })
  res.json({ ok: true })
})

coachRouter.get('/plan/active', async (_req, res) => {
  const plan = await prisma.workoutPlan.findFirst({
    where: { status: 'active' },
    include: { routines: { include: { exercises: true }, orderBy: { order: 'asc' } } },
  })
  if (!plan) {
    res.json(null)
    return
  }

  // Alternância round-robin: a próxima rotina é a que vem depois da última usada
  // numa sessão concluída deste plano. Sem histórico ainda, começa pela primeira.
  const routineIds = plan.routines.map((r) => r.id)
  const lastSession = await prisma.workoutSession.findFirst({
    where: { finishedAt: { not: null }, planRoutineId: { in: routineIds } },
    orderBy: { startedAt: 'desc' },
  })
  const lastIndex = lastSession
    ? plan.routines.findIndex((r) => r.id === lastSession.planRoutineId)
    : -1
  const nextIndex = (lastIndex + 1) % plan.routines.length
  const nextRoutineId = plan.routines[nextIndex]?.id ?? null

  res.json({ ...plan, nextRoutineId })
})
