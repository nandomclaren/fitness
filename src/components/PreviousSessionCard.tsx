import { estimateNRepMax } from '../lib/oneRepMax.ts'
import type { LastPerformanceSet } from '../types/workout.ts'

interface PreviousSessionCardProps {
  sessionDate: string
  sets: LastPerformanceSet[]
  showWeight: boolean
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatRir(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

/** Referência completa da sessão anterior pra esse exercício — todas as séries, não só a de
 * topo — com as mesmas colunas da tabela ativa (inclusive 10RM) pra comparação direta. */
export default function PreviousSessionCard({ sessionDate, sets, showWeight }: PreviousSessionCardProps) {
  const weekday = capitalize(new Date(sessionDate).toLocaleDateString('pt-BR', { weekday: 'long' }))
  const gridCols = showWeight ? '24px 1fr 1fr 1fr 1fr' : '24px 1fr 1fr 1fr'

  return (
    <div className="overflow-hidden rounded-xl border border-(--color-border)">
      <p className="bg-(--color-surface) px-3 py-2.5 text-xs font-semibold text-(--color-text-muted)">
        Sessão anterior · {weekday}
      </p>
      <div
        className="grid items-center gap-1.5 px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-wide text-(--color-text-muted)"
        style={{ gridTemplateColumns: gridCols }}
      >
        <span>#</span>
        {showWeight && <span>Kg</span>}
        <span>Reps</span>
        <span>RIR</span>
        <span>10RM</span>
      </div>
      {sets.map((s) => (
        <div
          key={s.setNumber}
          className="grid items-center gap-1.5 px-3 py-1 text-sm text-(--color-text-muted) last:pb-2.5"
          style={{ gridTemplateColumns: gridCols }}
        >
          <span>{s.setNumber}</span>
          {showWeight && <span>{s.weightKg}</span>}
          <span>{s.reps}</span>
          <span>{formatRir(s.rir)}</span>
          <span>{estimateNRepMax(s.weightKg, s.reps).toFixed(1)}</span>
        </div>
      ))}
    </div>
  )
}
