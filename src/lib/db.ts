import Dexie, { type EntityTable } from 'dexie'
import type { SetEntry, WorkoutSession } from '../types/workout'

export interface PersonalRecord {
  exerciseId: string
  bestEstOneRepMax: number
  bestWeightKg: number
  bestReps: number
  achievedAt: string
  sessionId: string
}

class SobrecargaDB extends Dexie {
  sessions!: EntityTable<WorkoutSession, 'id'>
  sets!: EntityTable<SetEntry, 'id'>
  personalRecords!: EntityTable<PersonalRecord, 'exerciseId'>

  constructor() {
    super('sobrecarga-db')
    this.version(1).stores({
      sessions: 'id, split, startedAt, finishedAt',
      sets: 'id, sessionId, exerciseId, completedAt',
      personalRecords: 'exerciseId',
    })
  }
}

export const db = new SobrecargaDB()

/** 1RM estimado pela fórmula de Epley: peso × (1 + reps/30). */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0) return 0
  return weightKg * (1 + reps / 30)
}
