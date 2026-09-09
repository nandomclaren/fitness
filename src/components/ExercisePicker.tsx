import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { exercises } from '../lib/exercises'
import { MUSCLE_LABELS_PT } from '../types/muscle'
import type { Exercise } from '../types/exercise'

interface ExercisePickerProps {
  excludeIds: Set<string>
  onPick: (exercise: Exercise) => void
  onClose: () => void
}

export default function ExercisePicker({ excludeIds, onPick, onClose }: ExercisePickerProps) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return exercises
      .filter((e) => !excludeIds.has(e.id))
      .filter((e) => (q ? e.name.toLowerCase().includes(q) : true))
      .slice(0, 60)
  }, [query, excludeIds])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="flex h-[85vh] w-full max-w-lg flex-col rounded-t-2xl sm:rounded-2xl border border-(--color-border) bg-(--color-surface) shadow-xl">
        <div className="flex items-center justify-between border-b border-(--color-border) p-4">
          <h2 className="text-lg font-semibold">Adicionar exercício</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-2 text-(--color-text-muted) hover:bg-(--color-surface-raised)"
          >
            <X size={20} />
          </button>
        </div>
        <div className="border-b border-(--color-border) p-3">
          <div className="flex items-center gap-2 rounded-lg bg-(--color-surface-raised) px-3 py-2">
            <Search size={18} className="text-(--color-text-muted)" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar exercício..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-(--color-text-muted)"
            />
          </div>
        </div>
        <ul className="no-scrollbar flex-1 overflow-y-auto p-2">
          {results.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => onPick(e)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left hover:bg-(--color-surface-raised)"
              >
                <span className="font-medium">{e.name}</span>
                <span className="shrink-0 rounded-full bg-(--color-primary-dim) px-2 py-0.5 text-xs text-(--color-text)">
                  {MUSCLE_LABELS_PT[e.target]}
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="p-6 text-center text-sm text-(--color-text-muted)">
              Nenhum exercício encontrado.
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
