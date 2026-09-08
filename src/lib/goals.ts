import { api } from './api.ts'
import type { UserGoals } from '../types/goals.ts'

export async function getGoals(): Promise<UserGoals | null> {
  return api.get<UserGoals | null>('/goals')
}

export interface SaveGoalsInput {
  objective: string
  level: string
  daysPerWeek: number
  equipment: string[]
  limitations: string
}

export async function saveGoals(input: SaveGoalsInput): Promise<UserGoals> {
  return api.put<UserGoals>('/goals', input)
}
