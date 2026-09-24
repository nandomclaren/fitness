import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../prisma.ts'
import { compactCatalog, exercises, getExercise, idsForEquipment } from '../exercises.ts'
import { describeProgressionTrend, topSetPerSession } from '../progressionTrend.ts'
import { MUSCLE_LABELS_PT } from '../../src/types/muscle.ts'
import { activateDueScheduledPlans } from './plans.ts'

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
        description: 'Entre 1 e 4 rotinas.',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Nome da rotina, ex.: "A", "B", "Superior".' },
            exercises: {
              type: 'array',
              description: 'Entre 2 e 10 exercícios por rotina.',
              items: {
                type: 'object',
                properties: {
                  exerciseId: { type: 'string', description: 'ID do catálogo fornecido.' },
                  sets: { type: 'integer', description: 'Entre 1 e 6.' },
                  repRangeMin: { type: 'integer', description: 'Entre 1 e 30.' },
                  repRangeMax: { type: 'integer', description: 'Entre 1 e 30, maior ou igual a repRangeMin.' },
                  restSeconds: { type: 'integer', description: 'Entre 15 e 240.' },
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
  '(cargas, reps e RIR — reps in reserve — logados) para decidir e explicar ajustes de ' +
  'progressão de carga, volume ou esquema de séries/reps.\n\n' +
  'Essa conversa não serve só pra ajustar séries — é o espaço pro usuário marcar, na prática, ' +
  'uma consulta com você como marcaria com um personal de verdade. Pergunte com naturalidade e ' +
  'trate como parte normal do seu trabalho perguntas como "estou evoluindo?", "vale a pena ' +
  'comprar anilhas novas?" ou "compro fita elástica ou uma barra pra diversificar o treino?" — ' +
  'nunca responda essas perguntas de forma genérica; use o resumo de tendência de progressão ' +
  'por exercício (fornecido no contexto, dos últimos ~90 dias) e o equipamento que o usuário ' +
  'já tem (também no contexto) pra dar uma resposta concreta e pessoal:\n' +
  '- "Estou evoluindo?": olhe a tendência por exercício — se a maioria progrediu (peso/reps ' +
  'subiram), diga isso com números reais; se vários estagnaram, aponte quais e por quê ' +
  '(plateau real, falta de variedade, recuperação insuficiente); nunca dê um "sim"/"não" vago.\n' +
  '- Recomendação de compra de equipamento: raciocine a partir do que trava a evolução hoje. ' +
  'Ex.: halteres fixos limitando progressão de carga em vários exercícios estagnados → ' +
  'halteres ajustáveis ou anilhas extras tende a valer mais que um acessório novo; falta de ' +
  'variedade de estímulo (mesmos exercícios há semanas) → um equipamento que abra ângulos/ ' +
  'padrões de movimento novos (ex.: faixa elástica pra trabalho unilateral e resistência ' +
  'variável) pode valer mais que duplicar o que já existe. Sempre parta do que já está ' +
  'disponível — nunca recomende comprar algo que resolve um problema que os dados não mostram.\n\n' +
  'Regras importantes:\n' +
  '- Nunca invente números sem justificativa: baseie ajustes de carga em sinais reais do ' +
  'histórico (ex.: bateu o teto da faixa de reps em várias sessões seguidas com RIR alto → ' +
  'sugerir +2.5 a 5% de carga; RIR consistentemente muito baixo (perto da falha) ou queda de ' +
  'desempenho → sugerir manter ou reduzir, possível deload). Prefira sugerir progressão via ' +
  'reps (dentro da faixa prescrita) antes de progressão via carga quando ambas forem ' +
  'plausíveis — é mais prático pra quem treina com equipamento limitado (halteres fixos, ' +
  'poucas anilhas), e é o método de "dupla progressão" padrão da literatura.\n' +
  '- Fique dentro de faixas fisiologicamente sensatas: 1-6 séries por exercício, 1-30 reps, ' +
  '15-240s de descanso.\n' +
  '- Só use a ferramenta propose_plan depois que o usuário concordar com uma direção concreta ' +
  '(ex.: "faz sentido, monta um A/B pra mim"). Não proponha um plano na primeira mensagem sem ' +
  'contexto suficiente — faça perguntas antes se precisar (frequência semanal, quais treinos ' +
  'estão travados, dores/limitações).\n' +
  '- exerciseId sempre vem do catálogo fornecido — nunca invente IDs.\n' +
  '- O catálogo cobre SÓ exercícios de força/musculação — não tem cardio (corrida, ' +
  'caminhada, remo, bike, natação etc.). Se o usuário descrever uma rotina ou agenda de ' +
  'cardio, NÃO tente encaixar isso em propose_plan (não existe exerciseId pra isso, a ' +
  'chamada falha silenciosamente). Trate cardio como orientação em texto normal na ' +
  'conversa; use propose_plan só pra estruturar os dias de musculação, se houver.\n' +
  '- Depois de chamar propose_plan, o plano fica pendente de aprovação explícita do usuário ' +
  'na interface — você não precisa pedir confirmação de novo no texto, só resumir o que foi ' +
  'proposto.\n\n' +
  'O usuário pode anexar fotos (planilha ou caderno de treino escrito à mão, quadro de ' +
  'academia, print de outro app, foto do display de uma máquina, etc.). Leia atentamente o ' +
  'conteúdo da imagem — nomes de exercícios, cargas, séries, repetições, datas — antes de ' +
  'responder, e transcreva os dados relevantes na sua resposta pra confirmar que leu certo ' +
  '(letra ruim ou fotos tortas podem gerar erro de leitura; se algum número ficar ambíguo, ' +
  'pergunte em vez de chutar). Nunca invente um exerciseId a partir da imagem sem achar o ' +
  'equivalente real no catálogo fornecido.'

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const MAX_IMAGES_PER_MESSAGE = 4

interface ParsedImage {
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  data: string
}

/** Faz o parse de uma data URL ("data:image/jpeg;base64,...") pro formato aceito pela API da Anthropic. */
function parseImageDataUrl(dataUrl: string): ParsedImage | null {
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl)
  if (!match) return null
  const [, mediaType, data] = match
  if (!SUPPORTED_IMAGE_TYPES.has(mediaType)) return null
  return { mediaType: mediaType as ParsedImage['mediaType'], data }
}

/** Monta o content multimodal (texto + imagens) de uma mensagem pro formato da API da Anthropic. */
function toAnthropicContent(message: { content: string; images: string[] }): Anthropic.MessageParam['content'] {
  const images = message.images
    .map(parseImageDataUrl)
    .filter((img): img is ParsedImage => img !== null)
  if (images.length === 0) return message.content

  const blocks: Anthropic.ContentBlockParam[] = images.map((img) => ({
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: img.mediaType, data: img.data },
  }))
  if (message.content.trim()) {
    blocks.push({ type: 'text', text: message.content })
  }
  return blocks
}

interface HistorySession {
  split: string
  date: string
  sets: Array<{ exerciseId: string; weightKg: number; reps: number; rir: number }>
}

// Janela mais longa que as "últimas 12 sessões" de baixo — 12 sessões cobre só ~1 mês pra
// quem treina 3x/semana, curto demais pra responder "estou evoluindo?" sobre um bloco
// inteiro. 90 dias dá uma visão de bloco completo sem deixar o prompt crescer sem limite
// conforme o histórico do usuário acumula meses/anos de uso.
const PROGRESSION_WINDOW_DAYS = 90

async function buildContextText(): Promise<string> {
  const windowStart = new Date(Date.now() - PROGRESSION_WINDOW_DAYS * 86_400_000)

  const [goals, activePlan, recentSessions, windowSessions] = await Promise.all([
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
    prisma.workoutSession.findMany({
      where: { finishedAt: { not: null }, startedAt: { gte: windowStart } },
      orderBy: { startedAt: 'asc' },
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
      rir: set.rir,
    })),
  }))

  // Tendência por exercício nos últimos ~90 dias — é a base real pra responder "estou
  // evoluindo?" sobre o bloco inteiro, não só o ajuste fino de carga da sessão mais recente
  // (que já vem coberto pelo histórico detalhado acima).
  const exerciseIdsInWindow = [
    ...new Set(windowSessions.flatMap((s) => s.sets.map((set) => set.exerciseId))),
  ]
  const progressionLines = exerciseIdsInWindow
    .map((exerciseId) => {
      const exercise = getExercise(exerciseId)
      if (!exercise) return null
      const topSets = topSetPerSession(windowSessions, exerciseId)
      if (topSets.length < 2) return null
      const muscleLabel = MUSCLE_LABELS_PT[exercise.target]
      return `- ${exercise.name} (${muscleLabel}): ${topSets.length} sessões em ~${PROGRESSION_WINDOW_DAYS}d, ${describeProgressionTrend(topSets)}`
    })
    .filter((line): line is string => line !== null)

  const progressionText =
    progressionLines.length > 0
      ? `Tendência de progressão por exercício nos últimos ${PROGRESSION_WINDOW_DAYS} dias ` +
        `(comparando a série de topo da primeira sessão com a mais recente no período):\n` +
        progressionLines.join('\n')
      : `Sem dados suficientes ainda pra calcular tendência de progressão (menos de 2 ` +
        `sessões por exercício nos últimos ${PROGRESSION_WINDOW_DAYS} dias).`

  return (
    `${goalsText}\n${planText}\n\n${progressionText}\n\n` +
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
  const { content, images } = req.body as { content: string; images?: string[] }
  const safeImages = Array.isArray(images) ? images.slice(0, MAX_IMAGES_PER_MESSAGE) : []
  if (!content?.trim() && safeImages.length === 0) {
    res.status(400).json({ error: 'mensagem vazia' })
    return
  }
  if (safeImages.some((img) => !parseImageDataUrl(img))) {
    res.status(400).json({ error: 'formato de imagem não suportado (use jpeg, png, gif ou webp)' })
    return
  }

  await prisma.coachMessage.create({
    data: { role: 'user', content: content ?? '', images: safeImages },
  })

  const priorMessages = await prisma.coachMessage.findMany({
    orderBy: { createdAt: 'asc' },
  })

  const contextText = await buildContextText()
  let catalog = compactCatalog()
  const goalsRow = await prisma.userGoals.findUnique({ where: { id: 'me' } })
  if (goalsRow?.equipment.length) {
    const allowedIds = idsForEquipment(goalsRow.equipment)
    const filtered = catalog.filter((e) => allowedIds.has(e.id))
    // Mesmo critério do gerador de plano: só aplica o filtro se sobrar catálogo
    // suficiente pra IA ter opção de verdade — evita travar numa lista minúscula se o
    // usuário marcou pouco equipamento.
    if (filtered.length >= 15) catalog = filtered
  }

  try {
    const response = await client.messages.create({
      // Sonnet 5: as regras de prescrição (ACSM/NSCA) já vêm explícitas no prompt, então
      // o modelo não precisa "descobrir" nada sozinho — Opus seria custo desnecessário
      // pra esse tipo de tarefa guiada.
      model: 'claude-sonnet-5',
      // 2048 era baixo demais: com thinking adaptativo ligado por padrão nos modelos
      // atuais, o raciocínio consome tokens do mesmo orçamento de max_tokens, e podia
      // estourar o limite antes de gerar qualquer texto ou tool_use visível.
      max_tokens: 16000,
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
        content: toAnthropicContent(m),
      })),
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const replyText = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    const toolUse = response.content.find((b) => b.type === 'tool_use')

    let proposedPlanId: string | undefined
    let planCreationFailed = false

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

      // Schema não valida mais faixa numérica/tamanho de array (a API rejeita
      // minItems/maxItems/minimum/maximum em tool custom com 400) — vira clamp aqui.
      const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)))
      const validIds = new Set(exercises.map((e) => e.id))
      const routinesWithValidExercises = input.routines
        .slice(0, 4)
        .map((r) => ({
          ...r,
          exercises: r.exercises
            .filter((e) => validIds.has(e.exerciseId))
            .slice(0, 10)
            .map((e) => {
              const repRangeMin = clamp(e.repRangeMin, 1, 30)
              return {
                ...e,
                sets: clamp(e.sets, 1, 6),
                repRangeMin,
                repRangeMax: clamp(e.repRangeMax, repRangeMin, 30),
                restSeconds: clamp(e.restSeconds, 15, 240),
              }
            }),
        }))
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
      } else {
        planCreationFailed = true
      }
    }

    // O texto de "plano proposto" só pode aparecer quando um plano de verdade foi
    // criado (proposedPlanId setado) — senão a mensagem mente sobre um card que não
    // existe. Isso acontece, por exemplo, quando a IA tenta encaixar num plano
    // atividades fora do catálogo (cardio como corrida/caminhada/remo), e todos os
    // exerciseIds inventados são filtrados por não existirem de verdade.
    let replyContent = replyText
    if (!replyContent) {
      replyContent = proposedPlanId
        ? 'Plano proposto — veja o card acima para aprovar.'
        : planCreationFailed
          ? 'Não consegui montar um plano estruturado a partir disso — meu catálogo de ' +
            'exercícios cobre treino de força (musculação), não atividades como corrida, ' +
            'caminhada ou remo. Me conta a parte de musculação que você quer estruturar, ' +
            'ou seguimos combinando o cardio só aqui na conversa mesmo.'
          : // Nenhum texto e nenhuma tool_use: resposta veio vazia (ex.: truncada por
            // max_tokens antes de gerar saída visível). Não inventa "Ok!" — avisa.
            'Minha resposta ficou incompleta — tenta perguntar de novo.'
    }

    const assistantMessage = await prisma.coachMessage.create({
      data: { role: 'assistant', content: replyContent, proposedPlanId },
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
  await activateDueScheduledPlans()
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
