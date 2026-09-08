import { Router } from 'express'
import { prisma } from '../prisma.ts'

export const goalsRouter = Router()

const GOALS_ID = 'me'

goalsRouter.get('/goals', async (_req, res) => {
  const goals = await prisma.userGoals.findUnique({ where: { id: GOALS_ID } })
  res.json(goals)
})

goalsRouter.put('/goals', async (req, res) => {
  const { objective, level, daysPerWeek, equipment, limitations } = req.body as {
    objective: string
    level: string
    daysPerWeek: number
    equipment: string[]
    limitations?: string
  }

  if (!objective || !level || !daysPerWeek || !Array.isArray(equipment)) {
    res.status(400).json({ error: 'objective, level, daysPerWeek e equipment são obrigatórios' })
    return
  }

  const data = { objective, level, daysPerWeek, equipment, limitations: limitations ?? '' }
  const goals = await prisma.userGoals.upsert({
    where: { id: GOALS_ID },
    create: { id: GOALS_ID, ...data },
    update: data,
  })
  res.json(goals)
})
