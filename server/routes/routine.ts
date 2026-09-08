import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../prisma.ts'
import { compactCatalog, exercises } from '../exercises.ts'
import { buildSuggestedRoutine } from '../../src/lib/routine.ts'
import type { WorkoutSplit } from '../../src/types/workout.ts'

export const routineRouter = Router()

const client = new Anthropic()

const SPLIT_REGIONS: Record<WorkoutSplit, string[]> = {
  upper: ['upper body', 'core'],
  lower: ['lower body', 'core'],
  full: ['upper body', 'lower body', 'core'],
}

const PROPOSE_ROUTINE_TOOL: Anthropic.Tool = {
  name: 'propose_routine',
  description: 'Propõe a lista de exercícios do treino de hoje.',
  input_schema: {
    type: 'object',
    properties: {
      exerciseIds: {
        type: 'array',
        items: { type: 'string' },
        minItems: 3,
        maxItems: 9,
        description: 'IDs de exercícios do catálogo fornecido, na ordem de execução sugerida.',
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
  if (!split || !SPLIT_REGIONS[split]) {
    res.status(400).json({ error: 'split inválido' })
    return
  }

  try {
    const goals = await prisma.userGoals.findUnique({ where: { id: 'me' } })
    const recentSessions = await prisma.workoutSession.findMany({
      where: { finishedAt: { not: null } },
      orderBy: { startedAt: 'desc' },
      take: 6,
      include: { sets: true },
    })

    const regions = SPLIT_REGIONS[split]
    const catalog = compactCatalog().filter((e) => regions.includes(e.bodyPart))

    const history = recentSessions.map((s) => ({
      split: s.split,
      date: s.startedAt.toISOString().slice(0, 10),
      exercises: [...new Set(s.sets.map((set) => set.exerciseId))],
    }))

    const goalsText = goals
      ? `Objetivo: ${goals.objective}. Nível: ${goals.level}. Dias/semana disponíveis: ${goals.daysPerWeek}. Equipamentos: ${goals.equipment.join(', ') || 'qualquer'}. Limitações/lesões: ${goals.limitations || 'nenhuma informada'}.`
      : 'Nenhum objetivo cadastrado ainda — use um treino balanceado e genérico para o nível intermediário.'

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2048,
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
    const filteredIds = input.exerciseIds.filter((id) => validIds.has(id))

    if (filteredIds.length < 3) {
      const fallback = buildSuggestedRoutine(split)
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
    const fallback = buildSuggestedRoutine(split)
    res.json({
      exerciseIds: fallback.map((e) => e.id),
      rationale: 'Não foi possível consultar a IA agora — usando a rotina balanceada padrão.',
    })
  }
})
