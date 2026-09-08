/** 1RM estimado pela fórmula de Epley: peso × (1 + reps/30). Usado no cliente e no servidor. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0) return 0
  return weightKg * (1 + reps / 30)
}
