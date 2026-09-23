import { useState } from 'react'
import { Check, Target } from 'lucide-react'
import WheelPicker from './WheelPicker.tsx'
import { estimateNRepMax } from '../lib/oneRepMax.ts'
import type { SetEntry, ProgressionSuggestion } from '../types/workout.ts'

interface SetTableProps {
  sets: SetEntry[]
  totalSets: number
  showWeight: boolean
  unilateral: boolean
  /** Valores controlados da próxima série (linha ativa) — o PlayerScreen é dono deles
   * porque dependem da sugestão de carga (histórico), não só da tabela em si. */
  nextWeight: number
  nextReps: number
  nextRir: number
  onNextWeightChange: (v: number) => void
  onNextRepsChange: (v: number) => void
  onNextRirChange: (v: number) => void
  onLogNext: () => void
  onUpdateSet: (setId: string, data: { weightKg: number; reps: number; rir: number; sides: number }) => void
  /** Sugestão de progressão (dupla progressão: reps antes de carga) pra próxima série —
   * null quando não há histórico suficiente. Mostrada como linha separada, opcional. */
  suggestion: ProgressionSuggestion | null
  onApplySuggestion: (s: ProgressionSuggestion) => void
}

type EditValues = { weightKg: number; reps: number; rir: number; sides: number }

function formatRir(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

function ConfirmButton({ onClick, variant }: { onClick: () => void; variant: 'done' | 'pending' }) {
  return (
    <button
      onClick={onClick}
      aria-label={variant === 'pending' ? 'Registrar série' : 'Salvar correção'}
      className={`flex h-9 w-9 items-center justify-center self-center rounded-full ${
        variant === 'pending'
          ? 'bg-(--color-success) text-white'
          : 'bg-(--color-surface-raised) text-(--color-text-muted)'
      }`}
    >
      <Check size={variant === 'pending' ? 18 : 13} strokeWidth={3} />
    </button>
  )
}

export default function SetTable({
  sets,
  totalSets,
  showWeight,
  unilateral,
  nextWeight,
  nextReps,
  nextRir,
  onNextWeightChange,
  onNextRepsChange,
  onNextRirChange,
  onLogNext,
  onUpdateSet,
  suggestion,
  onApplySuggestion,
}: SetTableProps) {
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<EditValues | null>(null)

  const gridCols = showWeight ? '24px 1fr 1fr 1fr 1fr 40px' : '24px 1fr 1fr 1fr 40px'

  function startEditing(set: SetEntry) {
    setEditingSetId(set.id)
    setEditValues({ weightKg: set.weightKg, reps: set.reps, rir: set.rir, sides: set.sides })
  }

  function confirmEdit(setId: string) {
    if (!editValues) return
    onUpdateSet(setId, editValues)
    setEditingSetId(null)
    setEditValues(null)
  }

  // A sugestão só faz sentido oferecer enquanto os valores dela ainda não são os que já
  // estão dialados na linha ativa — depois de aplicada, ela some sozinha (sem precisar de
  // estado extra pra controlar "aplicada ou não").
  const suggestionPending =
    suggestion &&
    (suggestion.weightKg !== nextWeight || suggestion.reps !== nextReps || suggestion.rir !== nextRir)

  return (
    <div>
      <div
        className="grid items-center gap-1.5 px-0.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-(--color-text-muted)"
        style={{ gridTemplateColumns: gridCols }}
      >
        <span>#</span>
        {showWeight && <span>Kg</span>}
        <span>{unilateral ? 'Reps/lado' : 'Reps'}</span>
        <span>RIR</span>
        <span>10RM</span>
        <span />
      </div>

      {sets.map((set) => {
        const isEditing = editingSetId === set.id
        const tenRm = estimateNRepMax(set.weightKg, set.reps)
        if (isEditing && editValues) {
          return (
            <div
              key={set.id}
              className="grid items-center gap-1.5 border-t border-(--color-surface-raised) py-2"
              style={{ gridTemplateColumns: gridCols }}
            >
              <span className="text-sm font-bold">{set.setNumber}</span>
              {showWeight && (
                <WheelPicker
                  ariaLabel="Peso em quilos"
                  value={editValues.weightKg}
                  onChange={(v) => setEditValues({ ...editValues, weightKg: v })}
                  min={0}
                  max={300}
                  step={0.5}
                  formatValue={(v) => v.toFixed(1)}
                />
              )}
              <WheelPicker
                ariaLabel="Repetições"
                value={editValues.reps}
                onChange={(v) => setEditValues({ ...editValues, reps: v })}
                min={0}
                max={50}
                step={1}
              />
              <WheelPicker
                ariaLabel="RIR"
                value={editValues.rir}
                onChange={(v) => setEditValues({ ...editValues, rir: v })}
                min={0}
                max={5}
                step={0.5}
                formatValue={formatRir}
              />
              <span className="text-center text-xs text-(--color-text-muted)">
                {estimateNRepMax(editValues.weightKg, editValues.reps).toFixed(1)}
              </span>
              <ConfirmButton variant="done" onClick={() => confirmEdit(set.id)} />
            </div>
          )
        }

        return (
          <button
            key={set.id}
            onClick={() => startEditing(set)}
            aria-label={`Série ${set.setNumber} — toque para corrigir`}
            className="grid w-full items-center gap-1.5 border-t border-(--color-surface-raised) py-2.5 text-left text-sm text-(--color-text-muted)"
            style={{ gridTemplateColumns: gridCols }}
          >
            <span>{set.setNumber}</span>
            {showWeight && <span>{set.weightKg}</span>}
            <span>{set.reps}</span>
            <span>{formatRir(set.rir)}</span>
            <span>{tenRm.toFixed(1)}</span>
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-(--color-surface-raised)">
              <Check size={12} strokeWidth={3} className="text-(--color-text-muted)" />
            </span>
          </button>
        )
      })}

      {sets.length < totalSets && (
        <>
          <div
            className="grid items-center gap-1.5 border-t border-(--color-surface-raised) py-3"
            style={{ gridTemplateColumns: gridCols }}
          >
            <span className="text-sm font-bold">{sets.length + 1}</span>
            {showWeight && (
              <WheelPicker
                ariaLabel="Peso em quilos"
                value={nextWeight}
                onChange={onNextWeightChange}
                min={0}
                max={300}
                step={0.5}
                formatValue={(v) => v.toFixed(1)}
              />
            )}
            <WheelPicker ariaLabel="Repetições" value={nextReps} onChange={onNextRepsChange} min={0} max={50} step={1} />
            <WheelPicker
              ariaLabel="RIR"
              value={nextRir}
              onChange={onNextRirChange}
              min={0}
              max={5}
              step={0.5}
              formatValue={formatRir}
            />
            <span className="text-center text-xs text-(--color-text-muted)">
              {estimateNRepMax(nextWeight, nextReps).toFixed(1)}
            </span>
            <ConfirmButton variant="pending" onClick={onLogNext} />
          </div>

          {suggestionPending && suggestion && (
            <>
              <button
                onClick={() => onApplySuggestion(suggestion)}
                className="mt-1.5 grid w-full items-center gap-1.5 rounded-xl py-2.5 text-left"
                style={{ gridTemplateColumns: gridCols, background: 'rgba(255,176,32,0.14)' }}
              >
                <span className="flex items-center justify-center text-(--color-secondary)">
                  <Target size={15} />
                </span>
                {showWeight && (
                  <span className="text-sm font-extrabold text-(--color-secondary)">{suggestion.weightKg}</span>
                )}
                <span className="text-sm font-extrabold text-(--color-secondary)">{suggestion.reps}</span>
                <span className="text-sm font-extrabold text-(--color-secondary)">{formatRir(suggestion.rir)}</span>
                <span className="text-xs text-(--color-secondary)">
                  {estimateNRepMax(suggestion.weightKg, suggestion.reps).toFixed(1)}
                </span>
                <span className="text-center text-[10px] font-bold text-(--color-secondary)">USAR</span>
              </button>
              <p className="mt-1 px-0.5 text-xs leading-snug text-(--color-secondary)">{suggestion.reason}</p>
            </>
          )}
        </>
      )}
    </div>
  )
}
