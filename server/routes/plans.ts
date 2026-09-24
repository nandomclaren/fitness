import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../prisma.ts'
import { compactCatalog, exercises, getExercise, idsForEquipment } from '../exercises.ts'
import { buildSuggestedRoutine, SPLIT_LABELS_PT } from '../../src/lib/routine.ts'
import { getPrescription } from '../../src/lib/prescription.ts'
import { MUSCLE_LABELS_PT } from '../../src/types/muscle.ts'
import { describeProgressionTrend, topSetPerSession } from '../progressionTrend.ts'
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
        description: 'Entre 1 e 4 rotinas — exatamente a quantidade pedida no prompt.',
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
              description: 'Entre 3 e 9 exercícios por rotina.',
              items: {
                type: 'object',
                properties: {
                  exerciseId: { type: 'string' },
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

function buildSystemPrompt(splits: WorkoutSplit[], hasHistory: boolean): string {
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

9. ${
    hasHistory
      ? 'Um resumo da progressão real do plano anterior (peso/reps/RIR por exercício, sessão a sessão) vem depois do catálogo. ESTE NÃO É O PRIMEIRO PLANO do usuário — trate-o como evolução do bloco anterior, não como recomeço do zero: pro que está "progredindo bem", mantenha ênfase ou intensifique de propósito (mais série, faixa de rep mais pesada, ou o mesmo exercício com prescrição mais exigente); pro que está "estagnado", troque de exercício ou ao menos de variante — repetir a prescrição que já não gera resultado é o oposto de pensar como coach; pro que "caiu", seja mais conservador (menos volume/intensidade) até a recuperação voltar. Evite repetir a lista de exercícios do plano anterior quase idêntica — mostre que esse plano é o próximo passo, não uma cópia. Cite essa evolução no "rationale" do plano quando fizer sentido.'
      : 'Nenhum histórico de treino foi fornecido — este É o primeiro plano do usuário nesse app. Monte algo generalista, seguro e bem balanceado; não invente progressão que ainda não existe.'
  }

Pense como treinador de verdade: um aluno que treina várias vezes por semana percebe na
hora se a segunda sessão de um mesmo tipo de dia é só um decalque da primeira — isso
transmite que ninguém pensou naquela sessão específica.`
}

/**
 * Resume a progressão real do plano anterior (peso/reps/RIR por exercício, do primeiro pro
 * último treino registrado) pra alimentar a IA com dado de verdade, não só o formulário de
 * objetivo/nível. Sem isso, todo plano gerado seria tão genérico quanto o primeiro — pedido
 * explícito do usuário: "a primeira série é mais generalista, mas todas elas a partir daí
 * tendem a ser evolutivas em cima da anterior". Retorna null quando não há plano anterior
 * (primeiro plano do usuário) ou quando o plano anterior nunca chegou a ser treinado de
 * fato — nesses casos a IA deve continuar gerando um plano genérico e seguro.
 */
async function buildHistorySummary(): Promise<string | null> {
  const previousPlan = await prisma.workoutPlan.findFirst({
    where: { status: { in: ['active', 'archived'] } },
    orderBy: { createdAt: 'desc' },
    include: { routines: { include: { exercises: true } } },
  })
  if (!previousPlan) return null

  const routineIds = previousPlan.routines.map((r) => r.id)
  const sessions = await prisma.workoutSession.findMany({
    where: { planRoutineId: { in: routineIds }, finishedAt: { not: null } },
    orderBy: { startedAt: 'asc' },
    include: { sets: true },
  })
  if (sessions.length === 0) return null

  const exerciseIds = [
    ...new Set(previousPlan.routines.flatMap((r) => r.exercises.map((e) => e.exerciseId))),
  ]

  const lines: string[] = []
  for (const exerciseId of exerciseIds) {
    const exercise = getExercise(exerciseId)
    if (!exercise) continue

    const topSets = topSetPerSession(sessions, exerciseId)
    if (topSets.length === 0) continue

    const muscleLabel = MUSCLE_LABELS_PT[exercise.target]
    lines.push(`- ${exercise.name} (${muscleLabel}): ${topSets.length} sessão(ões), ${describeProgressionTrend(topSets)}`)
  }

  if (lines.length === 0) return null

  return (
    `Plano anterior: "${previousPlan.name}" (${previousPlan.routines.length} rotina(s)), ` +
    `${sessions.length} sessão(ões) concluída(s). Progressão registrada por exercício:\n` +
    lines.join('\n')
  )
}

async function generateWithAi(
  splits: WorkoutSplit[],
  goals: UserGoals | null,
  historySummary: string | null,
): Promise<{ name: string; rationale: string; routines: PlanRoutineData[] }> {
  let catalog = compactCatalog()
  if (goals?.equipment.length) {
    const allowedIds = idsForEquipment(goals.equipment)
    const filtered = catalog.filter((e) => allowedIds.has(e.id))
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
    system: buildSystemPrompt(splits, historySummary !== null),
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
          ...(historySummary ? [{ type: 'text' as const, text: historySummary }] : []),
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

  // O schema da tool não consegue mais validar faixas numéricas/tamanho de array (a API
  // rejeita minItems/maxItems/minimum/maximum em tool custom com 400 — só ficaram como
  // texto na description), então esses limites viram clamp aqui em vez de garantia do
  // schema.
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)))
  const validIds = new Set(exercises.map((e) => e.id))
  const routines = input.routines
    .slice(0, 4)
    .map((r) => ({
      ...r,
      exercises: r.exercises
        .filter((e) => validIds.has(e.exerciseId))
        .slice(0, 9)
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

  if (routines.length === 0) throw new Error('IA não retornou exercícios válidos')

  return { name: input.name, rationale: input.rationale, routines }
}

/**
 * Ativa sozinho qualquer plano "scheduled" cuja data já chegou — sem worker/cron dedicado,
 * então roda sob demanda (chamada no início das rotas que listam/consultam planos) em vez
 * de um agendador de verdade, suficiente pra um app de uso pessoal onde o usuário abre o
 * app com frequência. Se mais de um plano agendado já estiver vencido (usuário ficou
 * sumido um tempo), processa em ordem cronológica — o de data mais recente entre os
 * vencidos acaba sendo o que fica ativo no final, que é o comportamento certo.
 */
export async function activateDueScheduledPlans(): Promise<void> {
  const due = await prisma.workoutPlan.findMany({
    where: { status: 'scheduled', scheduledFor: { lte: new Date() } },
    orderBy: { scheduledFor: 'asc' },
  })
  for (const plan of due) {
    await prisma.$transaction([
      prisma.workoutPlan.updateMany({ where: { status: 'active' }, data: { status: 'archived' } }),
      prisma.workoutPlan.update({
        where: { id: plan.id },
        data: { status: 'active', activatedAt: new Date() },
      }),
    ])
  }
}

plansRouter.get('/plans', async (_req, res) => {
  await activateDueScheduledPlans()
  const plans = await prisma.workoutPlan.findMany({
    where: { status: { in: ['scheduled', 'active', 'archived'] } },
    include: { routines: { include: { exercises: true }, orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })
  const statusOrder: Record<string, number> = { active: 0, scheduled: 1, archived: 2 }
  plans.sort((a, b) => statusOrder[a.status] - statusOrder[b.status])
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
  // Também serve pra cancelar um plano "scheduled" antes da data chegar — arquivar um
  // agendamento futuro é conceitualmente o mesmo gesto que arquivar um ativo (o resto do
  // app só se importa com "não é isso que vale agora").
  if (!plan || (plan.status !== 'active' && plan.status !== 'scheduled')) {
    res.status(404).json({ error: 'plano não encontrado, ou não está ativo nem agendado' })
    return
  }
  await prisma.workoutPlan.update({ where: { id: plan.id }, data: { status: 'archived' } })
  res.json({ ok: true })
})

plansRouter.post('/plans', async (req, res) => {
  const { mode, name, numRoutines, durationWeeks, deload, linearPeriodization, startDate } = req.body as {
    mode: 'rule' | 'ai'
    name?: string
    numRoutines: number
    durationWeeks: number
    deload: boolean
    linearPeriodization: boolean
    /** "YYYY-MM-DD" — data em que o usuário quer que o plano comece. Omitido ou hoje =
     * ativa na hora (comportamento de sempre); data futura = fica "scheduled" até lá. */
    startDate?: string
  }

  if (!numRoutines || numRoutines < 1 || numRoutines > 4) {
    res.status(400).json({ error: 'numRoutines deve ser entre 1 e 4' })
    return
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  if (startDate && startDate < todayStr) {
    res.status(400).json({ error: 'startDate não pode ser no passado' })
    return
  }
  const isFutureStart = !!startDate && startDate > todayStr

  await activateDueScheduledPlans()

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
      const historySummary = await buildHistorySummary()
      const generated = await generateWithAi(splits, goals, historySummary)
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

  const baseData = {
    name: planName,
    rationale,
    durationWeeks,
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
  }

  let plan
  if (isFutureStart) {
    // Data futura: cria "scheduled" e não mexe no plano ativo atual — ele continua
    // valendo até a data chegar (ver activateDueScheduledPlans) ou outro plano ser
    // ativado manualmente antes disso.
    plan = await prisma.workoutPlan.create({
      data: { ...baseData, status: 'scheduled', scheduledFor: new Date(`${startDate}T00:00:00Z`) },
      include: { routines: { include: { exercises: true } } },
    })
  } else {
    const [, created] = await prisma.$transaction([
      prisma.workoutPlan.updateMany({ where: { status: 'active' }, data: { status: 'archived' } }),
      prisma.workoutPlan.create({
        data: { ...baseData, status: 'active', activatedAt: new Date() },
        include: { routines: { include: { exercises: true } } },
      }),
    ])
    plan = created
  }

  res.json(plan)
})
