import { api } from './api.ts'
import type { WorkoutPlan } from '../types/coach.ts'

export interface CreatePlanInput {
  mode: 'rule' | 'ai'
  name?: string
  numRoutines: number
  durationWeeks: number
  deload: boolean
  linearPeriodization: boolean
}

export async function listPlans(): Promise<WorkoutPlan[]> {
  return api.get<WorkoutPlan[]>('/plans')
}

export async function createPlan(input: CreatePlanInput): Promise<WorkoutPlan> {
  return api.post<WorkoutPlan>('/plans', input)
}

export async function activatePlan(planId: string): Promise<void> {
  await api.post(`/plans/${planId}/activate`)
}

export async function archivePlan(planId: string): Promise<void> {
  await api.post(`/plans/${planId}/archive`)
}
