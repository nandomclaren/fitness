import { api } from './api.ts'
import type { MuscleId } from '../types/muscle.ts'
import type { SetEntry, WorkoutSession, WorkoutSplit } from '../types/workout.ts'

export async function startSession(
  split: WorkoutSplit,
  exerciseIds: string[],
): Promise<WorkoutSession> {
  return api.post<WorkoutSession>('/sessions', { split, exerciseIds })
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

export async function logSet(input: LogSetInput): Promise<LogSetResult> {
  const { sessionId, ...body } = input
  return api.post<LogSetResult>(`/sessions/${sessionId}/sets`, body)
}

export async function finishSession(sessionId: string): Promise<void> {
  await api.post(`/sessions/${sessionId}/finish`)
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

export async function getSessionSummary(sessionId: string): Promise<SessionSummary> {
  return api.get<SessionSummary>(`/sessions/${sessionId}/summary`)
}
