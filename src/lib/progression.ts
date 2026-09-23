import { api } from './api.ts'
import type { LastPerformance, ProgressionSuggestion } from '../types/workout.ts'
import type { Prescription } from './prescription.ts'

/** Busca a sessão anterior completa (todas as séries) que incluiu o exercício, mais a série
 * de topo (maior peso, depois mais reps) pra facilitar comparação rápida. */
export async function getLastPerformance(exerciseId: string): Promise<LastPerformance | null> {
  return api.get<LastPerformance | null>(`/exercises/${exerciseId}/last-performance`)
}

function roundToHalfKg(value: number): number {
  return Math.max(0, Math.round(value * 2) / 2)
}

// RIR alvo pra qual as sugestões convergem: folga o suficiente pra manter técnica e ainda
// treinar perto da falha o bastante pra estimular hipertrofia (Helms/Zourdos).
const TARGET_RIR = 2

/**
 * Cérebro de sobrecarga progressiva: analisa o RIR da última sessão e sugere o ajuste do dia,
 * pelo método de "dupla progressão" — sobe reps dentro da faixa prescrita antes de subir
 * carga. Mais prático em academia caseira (halteres fixos, poucas anilhas): trocar peso dá
 * mais trabalho que fazer mais uma ou duas reps, então preferimos isso sempre que possível.
 *
 *  - RIR ≤1 (quase falha/falhou): reduz ~5% da carga, reps voltam pro teto da faixa (peso
 *    menor deve permitir mais reps de novo).
 *  - RIR ≥3 (sobrou folga): se ainda não bateu o teto da faixa de reps, soma reps na mesma
 *    carga; só sobe peso (e reinicia no piso da faixa) quando o teto já foi alcançado.
 *  - RIR ==2 (moderado): mantém carga e reps, consolida a técnica.
 */
export function suggestNextLoad(last: LastPerformance, prescription: Prescription): ProgressionSuggestion {
  if (last.rir <= 1) {
    return {
      weightKg: roundToHalfKg(last.weightKg * 0.95),
      reps: prescription.repRangeMax,
      rir: TARGET_RIR,
      reason: 'RIR baixo (≤1) na última sessão — reduza a carga em ~5% para manter a técnica.',
    }
  }

  if (last.rir >= 3) {
    if (last.reps < prescription.repRangeMax) {
      return {
        weightKg: last.weightKg,
        reps: Math.min(prescription.repRangeMax, last.reps + 2),
        rir: TARGET_RIR,
        reason: `RIR alto (${last.rir}) — ainda dá pra ganhar reps antes de mexer no peso. Tente +2 reps.`,
      }
    }
    return {
      weightKg: roundToHalfKg(last.weightKg + 2),
      reps: prescription.repRangeMin,
      rir: TARGET_RIR,
      reason: `Já bateu o teto da faixa de reps (${prescription.repRangeMax}) com folga — hora de subir 2kg e recomeçar a faixa.`,
    }
  }

  return {
    weightKg: last.weightKg,
    reps: last.reps,
    rir: TARGET_RIR,
    reason: 'RIR moderado (2) — mantenha a carga e as reps para consolidar a técnica.',
  }
}
