import { api } from './api.ts'
import type { LastPerformance, ProgressionSuggestion } from '../types/workout.ts'

/** Busca o "top set" (maior peso, depois mais reps) da sessão mais recente que incluiu o exercício. */
export async function getLastPerformance(exerciseId: string): Promise<LastPerformance | null> {
  return api.get<LastPerformance | null>(`/exercises/${exerciseId}/last-performance`)
}

function roundToHalfKg(value: number): number {
  return Math.max(0, Math.round(value * 2) / 2)
}

/**
 * Cérebro de sobrecarga progressiva: analisa o RPE da última sessão e sugere o ajuste do dia.
 *  - RPE ≤ 7 (sobrou folga): sobe 2 kg mantendo as reps.
 *  - RPE 8 (esforço alto, mas controlado): mantém carga e reps para consolidar.
 *  - RPE ≥ 9 (quase falha / falhou): reduz ~5% da carga para preservar a técnica.
 */
export function suggestNextLoad(last: LastPerformance): ProgressionSuggestion {
  if (last.rpe <= 7) {
    return {
      weightKg: roundToHalfKg(last.weightKg + 2),
      reps: last.reps,
      reason: 'RPE baixo (≤7) na última sessão — hora de progredir. Suba 2kg ou tente +2 reps.',
    }
  }
  if (last.rpe === 8) {
    return {
      weightKg: last.weightKg,
      reps: last.reps,
      reason: 'RPE moderado (8) — mantenha a carga e consolide a técnica.',
    }
  }
  return {
    weightKg: roundToHalfKg(last.weightKg * 0.95),
    reps: last.reps,
    reason: 'RPE muito alto (≥9) — reduza a carga para manter a técnica e evitar lesões.',
  }
}
