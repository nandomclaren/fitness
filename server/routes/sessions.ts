import { Router } from 'express'
import { prisma } from '../prisma.ts'
import { getExercise } from '../exercises.ts'
import { estimateOneRepMax } from '../../src/lib/oneRepMax.ts'
import type { MuscleId } from '../../src/types/muscle.ts'

export const sessionsRouter = Router()

sessionsRouter.post('/sessions', async (req, res) => {
  const { split, exerciseIds } = req.body as { split: string; exerciseIds: string[] }
  if (!split || !Array.isArray(exerciseIds) || exerciseIds.length === 0) {
    res.status(400).json({ error: 'split e exerciseIds são obrigatórios' })
    return
  }
  const session = await prisma.workoutSession.create({ data: { split, exerciseIds } })
  res.json(session)
})

sessionsRouter.get('/sessions', async (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 30)
  const sessions = await prisma.workoutSession.findMany({
    where: { finishedAt: { not: null } },
    orderBy: { startedAt: 'desc' },
    take: limit,
    include: { sets: true },
  })
  res.json(
    sessions.map((s) => ({
      id: s.id,
      split: s.split,
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
      totalSets: s.sets.length,
      totalExercises: new Set(s.sets.map((set) => set.exerciseId)).size,
      totalVolumeKg: s.sets.reduce((sum, set) => sum + set.weightKg * set.reps, 0),
    })),
  )
})

sessionsRouter.post('/sessions/:id/finish', async (req, res) => {
  const session = await prisma.workoutSession.update({
    where: { id: req.params.id },
    data: { finishedAt: new Date() },
  })
  res.json(session)
})

sessionsRouter.post('/sessions/:id/sets', async (req, res) => {
  const sessionId = req.params.id
  const { exerciseId, setNumber, weightKg, reps, rpe } = req.body as {
    exerciseId: string
    setNumber: number
    weightKg: number
    reps: number
    rpe: number
  }

  const set = await prisma.setEntry.create({
    data: { sessionId, exerciseId, setNumber, weightKg, reps, rpe },
  })

  const e1rm = estimateOneRepMax(weightKg, reps)
  const existingPR = await prisma.personalRecord.findUnique({ where: { exerciseId } })
  let isNewPR = false
  if (!existingPR || e1rm > existingPR.bestEstOneRepMax) {
    isNewPR = true
    await prisma.personalRecord.upsert({
      where: { exerciseId },
      create: {
        exerciseId,
        bestEstOneRepMax: e1rm,
        bestWeightKg: weightKg,
        bestReps: reps,
        achievedAt: set.completedAt,
        sessionId,
      },
      update: {
        bestEstOneRepMax: e1rm,
        bestWeightKg: weightKg,
        bestReps: reps,
        achievedAt: set.completedAt,
        sessionId,
      },
    })
  }

  res.json({ set, isNewPR })
})

sessionsRouter.get('/exercises/:exerciseId/last-performance', async (req, res) => {
  const { exerciseId } = req.params
  const sets = await prisma.setEntry.findMany({
    where: { exerciseId },
    orderBy: { completedAt: 'asc' },
  })
  if (sets.length === 0) {
    res.json(null)
    return
  }
  const lastSessionId = sets[sets.length - 1].sessionId
  const lastSessionSets = sets.filter((s) => s.sessionId === lastSessionId)
  const topSet = lastSessionSets.reduce((best, s) =>
    s.weightKg > best.weightKg || (s.weightKg === best.weightKg && s.reps > best.reps) ? s : best,
  )
  res.json({
    weightKg: topSet.weightKg,
    reps: topSet.reps,
    rpe: topSet.rpe,
    completedAt: topSet.completedAt,
  })
})

sessionsRouter.get('/sessions/:id/summary', async (req, res) => {
  const sessionId = req.params.id
  const session = await prisma.workoutSession.findUnique({ where: { id: sessionId } })
  if (!session) {
    res.status(404).json({ error: 'sessão não encontrada' })
    return
  }
  const sets = await prisma.setEntry.findMany({ where: { sessionId } })

  const totalVolumeKg = sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0)
  const startedAt = session.startedAt.getTime()
  const finishedAt = session.finishedAt ? session.finishedAt.getTime() : Date.now()
  const durationMinutes = Math.round((finishedAt - startedAt) / 60000)

  const exerciseIdsUsed = [...new Set(sets.map((s) => s.exerciseId))]

  const muscleLoad: Partial<Record<MuscleId, number>> = {}
  for (const exerciseId of exerciseIdsUsed) {
    const exercise = getExercise(exerciseId)
    if (!exercise) continue
    const volume = sets
      .filter((s) => s.exerciseId === exerciseId)
      .reduce((sum, s) => sum + s.weightKg * s.reps, 0)
    muscleLoad[exercise.target] = (muscleLoad[exercise.target] ?? 0) + volume
    for (const secondary of exercise.secondaryMuscles) {
      muscleLoad[secondary] = (muscleLoad[secondary] ?? 0) + volume * 0.4
    }
  }

  const prsBroken: Array<{
    exerciseId: string
    exerciseName: string
    weightKg: number
    reps: number
  }> = []
  for (const exerciseId of exerciseIdsUsed) {
    const pr = await prisma.personalRecord.findUnique({ where: { exerciseId } })
    if (pr?.sessionId === sessionId) {
      const exercise = getExercise(exerciseId)
      prsBroken.push({
        exerciseId,
        exerciseName: exercise?.name ?? exerciseId,
        weightKg: pr.bestWeightKg,
        reps: pr.bestReps,
      })
    }
  }

  res.json({
    session,
    totalVolumeKg,
    durationMinutes,
    totalSets: sets.length,
    totalExercises: exerciseIdsUsed.length,
    prsBroken,
    muscleLoad,
  })
})
