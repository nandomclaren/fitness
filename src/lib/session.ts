import { db, estimateOneRepMax } from './db'
import { getExercise } from './exercises'
import type { MuscleId } from '../types/muscle'
import type { SetEntry, WorkoutSession, WorkoutSplit } from '../types/workout'

function uid(): string {
  return crypto.randomUUID()
}

export async function startSession(
  split: WorkoutSplit,
  exerciseIds: string[],
): Promise<WorkoutSession> {
  const session: WorkoutSession = {
    id: uid(),
    split,
    exerciseIds,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  }
  await db.sessions.add(session)
  return session
}

export interface LogSetInput {
  sessionId: string
  exerciseId: string
  setNumber: number
  weightKg: number
  reps: number
  rpe: number
}

export interface LogSetResult {
  set: SetEntry
  isNewPR: boolean
}

/** Registra uma série e atualiza o recorde pessoal (por 1RM estimado) se for o caso. */
export async function logSet(input: LogSetInput): Promise<LogSetResult> {
  const set: SetEntry = {
    id: uid(),
    sessionId: input.sessionId,
    exerciseId: input.exerciseId,
    setNumber: input.setNumber,
    weightKg: input.weightKg,
    reps: input.reps,
    rpe: input.rpe,
    completedAt: new Date().toISOString(),
  }
  await db.sets.add(set)

  const e1rm = estimateOneRepMax(input.weightKg, input.reps)
  const existingPR = await db.personalRecords.get(input.exerciseId)
  let isNewPR = false
  if (!existingPR || e1rm > existingPR.bestEstOneRepMax) {
    isNewPR = true
    await db.personalRecords.put({
      exerciseId: input.exerciseId,
      bestEstOneRepMax: e1rm,
      bestWeightKg: input.weightKg,
      bestReps: input.reps,
      achievedAt: set.completedAt,
      sessionId: input.sessionId,
    })
  }

  return { set, isNewPR }
}

export async function finishSession(sessionId: string): Promise<void> {
  await db.sessions.update(sessionId, { finishedAt: new Date().toISOString() })
}

export interface SessionSummary {
  session: WorkoutSession
  totalVolumeKg: number
  durationMinutes: number
  totalSets: number
  totalExercises: number
  prsBroken: { exerciseId: string; exerciseName: string; weightKg: number; reps: number }[]
  muscleLoad: Partial<Record<MuscleId, number>>
}

/** Calcula as métricas pós-treino: volume, duração, PRs quebrados e carga por músculo (para o heatmap). */
export async function getSessionSummary(sessionId: string): Promise<SessionSummary> {
  const session = await db.sessions.get(sessionId)
  if (!session) throw new Error(`Sessão ${sessionId} não encontrada`)

  const sets = await db.sets.where('sessionId').equals(sessionId).toArray()

  const totalVolumeKg = sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0)
  const startedAt = new Date(session.startedAt).getTime()
  const finishedAt = session.finishedAt ? new Date(session.finishedAt).getTime() : Date.now()
  const durationMinutes = Math.round((finishedAt - startedAt) / 60000)

  const exerciseIdsUsed = new Set(sets.map((s) => s.exerciseId))

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

  const prsBroken: SessionSummary['prsBroken'] = []
  for (const exerciseId of exerciseIdsUsed) {
    const pr = await db.personalRecords.get(exerciseId)
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

  return {
    session,
    totalVolumeKg,
    durationMinutes,
    totalSets: sets.length,
    totalExercises: exerciseIdsUsed.size,
    prsBroken,
    muscleLoad,
  }
}
