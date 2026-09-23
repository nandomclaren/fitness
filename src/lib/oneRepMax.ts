/** 1RM estimado pela fórmula de Epley: peso × (1 + reps/30). Usado no cliente e no servidor. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0) return 0
  return weightKg * (1 + reps / 30)
}

/**
 * Carga equivalente pra um número-alvo de reps (ex.: "10RM"), a partir do 1RM estimado —
 * mesma fórmula de Epley, só invertida. Serve como referência comparável entre sessões
 * mesmo quando o número de reps feito varia (diferente do peso bruto, que não é comparável
 * sozinho se as reps mudaram).
 */
export function estimateNRepMax(weightKg: number, reps: number, targetReps = 10): number {
  return estimateOneRepMax(weightKg, reps) / (1 + targetReps / 30)
}
