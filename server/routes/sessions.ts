import { Router } from 'express'
import { prisma } from '../prisma.ts'
import { getExercise } from '../exercises.ts'
import { estimateOneRepMax } from '../../src/lib/oneRepMax.ts'
import type { MuscleId } from '../../src/types/muscle.ts'

export const sessionsRouter = Router()

/** Volume de uma série: peso × reps × lados (exercícios unilaterais valem pelos dois lados). */
function setVolume(s: { weightKg: number; reps: number; sides: number }): number {
  return s.weightKg * s.reps * s.sides
}

sessionsRouter.post('/sessions', async (req, res) => {
  const { split, exerciseIds, planRoutineId } = req.body as {
    split: string
    exerciseIds: string[]
    planRoutineId?: string
  }
  if (!split || !Array.isArray(exerciseIds) || exerciseIds.length === 0) {
    res.status(400).json({ error: 'split e exerciseIds são obrigatórios' })
    return
  }
  const session = await prisma.workoutSession.create({
    data: { split, exerciseIds, planRoutineId },
  })
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
      totalVolumeKg: s.sets.reduce((sum, set) => sum + setVolume(set), 0),
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

/** Atualiza o recorde pessoal do exercício se essa marca (peso/reps -> e1RM) superar a atual. */
async function maybeUpdatePR(
  exerciseId: string,
  weightKg: number,
  reps: number,
  sessionId: string,
  achievedAt: Date,
): Promise<boolean> {
  const e1rm = estimateOneRepMax(weightKg, reps)
  const existingPR = await prisma.personalRecord.findUnique({ where: { exerciseId } })
  if (existingPR && e1rm <= existingPR.bestEstOneRepMax) return false
  await prisma.personalRecord.upsert({
    where: { exerciseId },
    create: { exerciseId, bestEstOneRepMax: e1rm, bestWeightKg: weightKg, bestReps: reps, achievedAt, sessionId },
    update: { bestEstOneRepMax: e1rm, bestWeightKg: weightKg, bestReps: reps, achievedAt, sessionId },
  })
  return true
}

sessionsRouter.post('/sessions/:id/sets', async (req, res) => {
  const sessionId = req.params.id
  const { exerciseId, setNumber, weightKg, reps, rir, sides } = req.body as {
    exerciseId: string
    setNumber: number
    weightKg: number
    reps: number
    rir: number
    sides?: number
  }

  const set = await prisma.setEntry.create({
    data: { sessionId, exerciseId, setNumber, weightKg, reps, rir, sides: sides ?? 1 },
  })

  const isNewPR = await maybeUpdatePR(exerciseId, weightKg, reps, sessionId, set.completedAt)

  res.json({ set, isNewPR })
})

// Correção de uma série já registrada (ex.: digitou peso errado sem querer). Não mexe em
// setNumber/exerciseId — só nos valores medidos. Um recorde editado pra baixo não é
// "desfeito" automaticamente (caso raro, fora de escopo).
sessionsRouter.patch('/sessions/:id/sets/:setId', async (req, res) => {
  const { setId } = req.params
  const { weightKg, reps, rir, sides } = req.body as {
    weightKg: number
    reps: number
    rir: number
    sides?: number
  }

  const set = await prisma.setEntry.update({
    where: { id: setId },
    data: { weightKg, reps, rir, sides: sides ?? 1 },
  })

  const isNewPR = await maybeUpdatePR(set.exerciseId, weightKg, reps, set.sessionId, set.completedAt)

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
  const lastSessionSets = sets
    .filter((s) => s.sessionId === lastSessionId)
    .sort((a, b) => a.setNumber - b.setNumber)
  const topSet = lastSessionSets.reduce((best, s) =>
    s.weightKg > best.weightKg || (s.weightKg === best.weightKg && s.reps > best.reps) ? s : best,
  )
  const lastSession = await prisma.workoutSession.findUnique({ where: { id: lastSessionId } })

  res.json({
    weightKg: topSet.weightKg,
    reps: topSet.reps,
    sides: topSet.sides,
    rir: topSet.rir,
    completedAt: topSet.completedAt,
    // Data da sessão inteira (não só dessa série) — usada pra rotular o card "sessão anterior".
    sessionDate: lastSession?.startedAt ?? topSet.completedAt,
    // Todas as séries daquela sessão pra esse exercício (não só a de topo) — mostradas como
    // referência completa na tela do exercício, não só o comparativo de uma série.
    sets: lastSessionSets.map((s) => ({
      setNumber: s.setNumber,
      weightKg: s.weightKg,
      reps: s.reps,
      rir: s.rir,
      sides: s.sides,
    })),
  })
})

sessionsRouter.get('/sessions/:id/summary', async (req, res) => {
  const sessionId = req.params.id
  const session = await prisma.workoutSession.findUnique({ where: { id: sessionId } })
  if (!session) {
    res.status(404).json({ error: 'sessão não encontrada' })
    return
  }
  const sets = await prisma.setEntry.findMany({
    where: { sessionId },
    orderBy: [{ completedAt: 'asc' }, { setNumber: 'asc' }],
  })

  const totalVolumeKg = sets.reduce((sum, s) => sum + setVolume(s), 0)
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
      .reduce((sum, s) => sum + setVolume(s), 0)
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
    sets,
    totalVolumeKg,
    durationMinutes,
    totalSets: sets.length,
    totalExercises: exerciseIdsUsed.length,
    prsBroken,
    muscleLoad,
  })
})

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS

/** Conta a maior sequência de itens consecutivos (dias ou semanas, ambos como timestamps
 * já alinhados a um múltiplo de `stepMs`) e devolve também a sequência "atual" (a que
 * termina no item mais recente) — zerada se o item mais recente não for nem o período
 * corrente nem o imediatamente anterior (`currentPeriodStart`/`previousPeriodStart`; ex.:
 * streak de dias fica vivo treinando hoje OU ontem; de semanas, essa semana OU a passada).
 * Comparar por início-de-período exato em vez de "há quanto tempo" evita contar errado
 * conforme a hora do dia em que o cálculo roda. */
function computeStreaks(
  sortedTimestamps: number[],
  stepMs: number,
  currentPeriodStart: number,
  previousPeriodStart: number,
): { current: number; longest: number } {
  if (sortedTimestamps.length === 0) return { current: 0, longest: 0 }

  let longest = 1
  let run = 1
  for (let i = 1; i < sortedTimestamps.length; i++) {
    run = sortedTimestamps[i] - sortedTimestamps[i - 1] === stepMs ? run + 1 : 1
    longest = Math.max(longest, run)
  }

  const last = sortedTimestamps[sortedTimestamps.length - 1]
  if (last !== currentPeriodStart && last !== previousPeriodStart) return { current: 0, longest }

  let current = 1
  for (let i = sortedTimestamps.length - 1; i > 0; i--) {
    if (sortedTimestamps[i] - sortedTimestamps[i - 1] === stepMs) current += 1
    else break
  }
  return { current, longest }
}

/**
 * Streak diário + semanal + contagem total de treinos. "Semanal" é o streak principal
 * mostrado no app (bate com o Alpha Progression, que usa o mesmo mecanismo: o "🔥 Xw"
 * mostrado em destaque é streak de SEMANAS com pelo menos 1 treino, não de dias — faz mais
 * sentido pra um app de treino, já que um dia de descanso não deveria "quebrar" nada).
 * Diário fica como métrica secundária. Dia/semana usam `startedAt` em UTC (mesma convenção
 * já usada em `coach.ts` pro histórico da conversa) — sem timezone do usuário guardado no
 * schema, o desvio de "virou o dia/semana 1-2h errado perto da virada" é aceitável pra um
 * app de uso pessoal. Semana começa no domingo, mesma convenção do `WeekStrip` do frontend.
 */
sessionsRouter.get('/streak', async (_req, res) => {
  const sessions = await prisma.workoutSession.findMany({
    where: { finishedAt: { not: null } },
    select: { startedAt: true },
    orderBy: { startedAt: 'asc' },
  })

  const totalWorkouts = sessions.length

  const dayTimestamps = [
    ...new Set(sessions.map((s) => new Date(s.startedAt.toISOString().slice(0, 10) + 'T00:00:00Z').getTime())),
  ].sort((a, b) => a - b)

  const weekTimestamps = [
    ...new Set(
      sessions.map((s) => {
        const d = new Date(s.startedAt.toISOString().slice(0, 10) + 'T00:00:00Z')
        const sundayOffset = d.getUTCDay() * DAY_MS
        return d.getTime() - sundayOffset
      }),
    ),
  ].sort((a, b) => a - b)

  const todayStart = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime()
  const yesterdayStart = todayStart - DAY_MS
  const thisWeekStart = todayStart - new Date(todayStart).getUTCDay() * DAY_MS
  const lastWeekStart = thisWeekStart - WEEK_MS

  const daily = computeStreaks(dayTimestamps, DAY_MS, todayStart, yesterdayStart)
  const weekly = computeStreaks(weekTimestamps, WEEK_MS, thisWeekStart, lastWeekStart)

  res.json({
    currentStreak: weekly.current,
    longestStreak: weekly.longest,
    currentDailyStreak: daily.current,
    longestDailyStreak: daily.longest,
    totalWorkouts,
  })
})
