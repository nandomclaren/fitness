import { api } from './api.ts'
import type { ActiveWorkoutPlan, CoachMessage } from '../types/coach.ts'

export async function listCoachMessages(): Promise<CoachMessage[]> {
  return api.get<CoachMessage[]>('/coach/messages')
}

export async function sendCoachMessage(content: string): Promise<CoachMessage> {
  return api.post<CoachMessage>('/coach/messages', { content })
}

export async function approvePlan(planId: string): Promise<void> {
  await api.post(`/coach/plans/${planId}/approve`)
}

export async function dismissPlan(planId: string): Promise<void> {
  await api.post(`/coach/plans/${planId}/dismiss`)
}

export async function getActivePlan(): Promise<ActiveWorkoutPlan | null> {
  return api.get<ActiveWorkoutPlan | null>('/plan/active')
}
