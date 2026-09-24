import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../prisma.ts'
import { compactCatalog, exercises, idsForEquipment } from '../exercises.ts'
import { buildSuggestedRoutine, SPLIT_MUSCLES } from '../../src/lib/routine.ts'
import type { WorkoutSplit } from '../../src/types/workout.ts'

export const routineRouter = Router()

// Catálogo de exercícios (somente leitura) — usado por integrações externas (ex.: Helm)
// que precisam resolver o nome/músculo de um exerciseId retornado por outros endpoints
// (como /plan/active), que só expõem o ID.
routineRouter.get('/exercises', (_req, res) => {
  res.json(compactCatalog())
})

const client = new Anthropic()

const PROPOSE_ROUTINE_TOOL: Anthropic.Tool = {
  name: 'propose_routine',
  description: 'Propõe a lista de exercícios do treino de hoje.',
  input_schema: {
    type: 'object',
    properties: {
      exerciseIds: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Entre 3 e 9 IDs de exercícios do catálogo fornecido, na ordem de execução sugerida.',
      },
      rationale: {
        type: 'string',
        description: 'Explicação curta (2-4 frases, em português) do porquê dessa escolha.',
      },
    },
    required: ['exerciseIds', 'rationale'],
    additionalProperties: false,
  },
  strict: true,
}

routineRouter.post('/routine/suggested', async (req, res) => {
  const { split } = req.body as { split: WorkoutSplit }
  if (!split || !SPLIT_MUSCLES[split]) {
    res.status(400).json({ error: 'split inválido' })
    return
  }

  // Declarado fora do try/catch: o fallback de erro (catch, abaixo) também precisa
  // filtrar pelo equipamento disponível do usuário, não só a chamada feliz da IA.
  let goals: Awaited<ReturnType<typeof prisma.userGoals.findUnique>> = null
  try {
    goals = await prisma.userGoals.findUnique({ where: { id: 'me' } })
    const recentSessions = await prisma.workoutSession.findMany({
      where: { finishedAt: { not: null } },
      orderBy: { startedAt: 'desc' },
      take: 6,
      include: { sets: true },
    })

    const targetMuscles = SPLIT_MUSCLES[split]
    let catalog = compactCatalog().filter((e) => targetMuscles.includes(e.target))
    if (goals?.equipment.length) {
      const allowedIds = idsForEquipment(goals.equipment)
      const filtered = catalog.filter((e) => allowedIds.has(e.id))
      // Só aplica o filtro se sobrar catálogo suficiente pra IA escolher de verdade.
      if (filtered.length >= 10) catalog = filtered
    }

    const history = recentSessions.map((s) => ({
      split: s.split,
      date: s.startedAt.toISOString().slice(0, 10),
      exercises: [...new Set(s.sets.map((set) => set.exerciseId))],
    }))

    const goalsText = goals
      ? `Objetivo: ${goals.objective}. Nível: ${goals.level}. Dias/semana disponíveis: ${goals.daysPerWeek}. Equipamentos: ${goals.equipment.join(', ') || 'qualquer'}. Limitações/lesões: ${goals.limitations || 'nenhuma informada'}.`
      : 'Nenhum objetivo cadastrado ainda — use um treino balanceado e genérico para o nível intermediário.'

    const response = await client.messages.create({
      // Sonnet 5: seleção mecânica de exercícios seguindo regras já explícitas no
      // prompt — não precisa do topo de linha.
      model: 'claude-sonnet-5',
      // Mesmo motivo do endpoint do coach: 2048 é baixo demais pro orçamento de
      // max_tokens (thinking adaptativo consome do mesmo total).
      max_tokens: 8000,
      output_config: { effort: 'medium' },
      tools: [PROPOSE_ROUTINE_TOOL],
      tool_choice: { type: 'tool', name: 'propose_routine' },
      system:
        'Você é um personal trainer especialista em hipertrofia e força. Monte o treino do dia ' +
        `(split: "${split}") escolhendo exercícios EXCLUSIVAMENTE pelos IDs do catálogo fornecido ` +
        '(nunca invente IDs). Balanceie grupos musculares do split, priorize compostos ' +
        '(barra/halteres/máquina) antes de isolados, e adapte ao objetivo, nível e limitações do ' +
        'usuário. Escolha entre 4 e 8 exercícios.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Catálogo de exercícios disponíveis (JSON):\n${JSON.stringify(catalog)}`,
              cache_control: { type: 'ephemeral' },
            },
            {
              type: 'text',
              text: `${goalsText}\n\nHistórico recente de treinos (mais recente primeiro):\n${JSON.stringify(history)}`,
            },
          ],
        },
      ],
    })

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('IA não retornou a ferramenta esperada')
    }
    const input = toolUse.input as { exerciseIds: string[]; rationale: string }

    const validIds = new Set(exercises.map((e) => e.id))
    const filteredIds = input.exerciseIds.filter((id) => validIds.has(id)).slice(0, 9)

    if (filteredIds.length < 3) {
      const fallback = buildSuggestedRoutine(split, goals?.equipment)
      res.json({
        exerciseIds: fallback.map((e) => e.id),
        rationale:
          'A IA não retornou exercícios válidos suficientes — usando a rotina balanceada padrão.',
      })
      return
    }

    res.json({ exerciseIds: filteredIds, rationale: input.rationale })
  } catch (err) {
    console.error('Erro ao gerar rotina sugerida por IA:', err)
    const fallback = buildSuggestedRoutine(split, goals?.equipment)
    res.json({
      exerciseIds: fallback.map((e) => e.id),
      rationale: 'Não foi possível consultar a IA agora — usando a rotina balanceada padrão.',
    })
  }
})
