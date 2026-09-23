import { useState } from 'react'
import { Check } from 'lucide-react'
import WheelPicker from './WheelPicker.tsx'
import type { SetEntry } from '../types/workout.ts'

interface SetTableProps {
  sets: SetEntry[]
  totalSets: number
  showWeight: boolean
  unilateral: boolean
  /** Valores controlados da próxima série (linha ativa) — o PlayerScreen é dono deles
   * porque dependem da sugestão de carga (histórico), não só da tabela em si. */
  nextWeight: number
  nextReps: number
  nextRpe: number
  onNextWeightChange: (v: number) => void
  onNextRepsChange: (v: number) => void
  onNextRpeChange: (v: number) => void
  onLogNext: () => void
  onUpdateSet: (setId: string, data: { weightKg: number; reps: number; rpe: number; sides: number }) => void
}

type EditValues = { weightKg: number; reps: number; rpe: number; sides: number }

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
  nextRpe,
  onNextWeightChange,
  onNextRepsChange,
  onNextRpeChange,
  onLogNext,
  onUpdateSet,
}: SetTableProps) {
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<EditValues | null>(null)

  const gridCols = showWeight ? '28px 1fr 1fr 1fr 40px' : '28px 1fr 1fr 40px'

  function startEditing(set: SetEntry) {
    setEditingSetId(set.id)
    setEditValues({ weightKg: set.weightKg, reps: set.reps, rpe: set.rpe, sides: set.sides })
  }

  function confirmEdit(setId: string) {
    if (!editValues) return
    onUpdateSet(setId, editValues)
    setEditingSetId(null)
    setEditValues(null)
  }

  return (
    <div>
      <div
        className="grid items-center gap-1.5 px-0.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-(--color-text-muted)"
        style={{ gridTemplateColumns: gridCols }}
      >
        <span>#</span>
        {showWeight && <span>Kg</span>}
        <span>{unilateral ? 'Reps/lado' : 'Reps'}</span>
        <span>RPE</span>
        <span />
      </div>

      {sets.map((set) => {
        const isEditing = editingSetId === set.id
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
                ariaLabel="RPE"
                value={editValues.rpe}
                onChange={(v) => setEditValues({ ...editValues, rpe: v })}
                min={1}
                max={10}
                step={1}
              />
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
            <span>{set.rpe}</span>
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-(--color-surface-raised)">
              <Check size={12} strokeWidth={3} className="text-(--color-text-muted)" />
            </span>
          </button>
        )
      })}

      {sets.length < totalSets && (
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
          <WheelPicker ariaLabel="RPE" value={nextRpe} onChange={onNextRpeChange} min={1} max={10} step={1} />
          <ConfirmButton variant="pending" onClick={onLogNext} />
        </div>
      )}
    </div>
  )
}
