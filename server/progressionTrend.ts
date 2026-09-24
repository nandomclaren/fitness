/**
 * Cálculo de tendência de progressão por exercício, a partir da série de topo (maior
 * peso, depois mais reps) de cada sessão em que o exercício apareceu. Compartilhado entre
 * a geração de plano (`plans.ts`, evolução plano-a-plano) e o chat do coach (`coach.ts`,
 * check-ins gerais tipo "estou evoluindo?") pra não duplicar a mesma lógica de comparação
 * duas vezes.
 */

export interface SessionWithSets {
  sets: Array<{ exerciseId: string; weightKg: number; reps: number; rir: number }>
}

export interface TopSet {
  weightKg: number
  reps: number
  rir: number
}

/** Série de topo por sessão (em que o exercício apareceu), na ordem cronológica em que as
 * sessões foram passadas. */
export function topSetPerSession(sessions: SessionWithSets[], exerciseId: string): TopSet[] {
  return sessions
    .map((s): TopSet | null => {
      const setsForExercise = s.sets.filter((set) => set.exerciseId === exerciseId)
      if (setsForExercise.length === 0) return null
      const top = setsForExercise.reduce((best, set) =>
        set.weightKg > best.weightKg || (set.weightKg === best.weightKg && set.reps > best.reps)
          ? set
          : best,
      )
      return { weightKg: top.weightKg, reps: top.reps, rir: top.rir }
    })
    .filter((s): s is TopSet => s !== null)
}

/** Compara a primeira e a última série de topo pra classificar a tendência em texto,
 * pronto pra entrar num prompt. Nunca inventa progressão a partir de 1 sessão só. */
export function describeProgressionTrend(topSets: TopSet[]): string {
  if (topSets.length < 2) {
    return 'só 1 sessão registrada — dado insuficiente pra avaliar tendência'
  }
  const first = topSets[0]
  const last = topSets[topSets.length - 1]
  if (last.weightKg > first.weightKg || (last.weightKg === first.weightKg && last.reps > first.reps)) {
    return `evoluiu de ${first.weightKg}kg×${first.reps} (RIR ${first.rir}) para ${last.weightKg}kg×${last.reps} (RIR ${last.rir}) — progredindo bem`
  }
  if (last.weightKg === first.weightKg && last.reps === first.reps) {
    return `estagnado em ${last.weightKg}kg×${last.reps} (RIR ${last.rir}) por ${topSets.length} sessões`
  }
  return `caiu de ${first.weightKg}kg×${first.reps} (RIR ${first.rir}) para ${last.weightKg}kg×${last.reps} (RIR ${last.rir}) — investigar fadiga/recuperação`
}
