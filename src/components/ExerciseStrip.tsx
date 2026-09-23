import { Check } from 'lucide-react'
import type { RoutineItem } from '../lib/prescription.ts'
import type { SetEntry } from '../types/workout.ts'

interface ExerciseStripProps {
  routineItems: RoutineItem[]
  currentIndex: number
  sessionSets: Record<string, SetEntry[]>
  onSelect: (index: number) => void
}

/** Navegação livre entre exercícios do treino — tocar em qualquer miniatura pula direto
 * pra ela, sem exigir que o exercício atual esteja concluído primeiro. */
export default function ExerciseStrip({
  routineItems,
  currentIndex,
  sessionSets,
  onSelect,
}: ExerciseStripProps) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
      {routineItems.map((item, index) => {
        const loggedCount = sessionSets[item.exercise.id]?.length ?? 0
        const done = loggedCount >= item.prescription.sets
        const isCurrent = index === currentIndex
        return (
          <button
            key={item.exercise.id}
            onClick={() => onSelect(index)}
            aria-label={`${item.exercise.name}${done ? ' — concluído' : ''}`}
            aria-current={isCurrent}
            className={`relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-xl bg-(--color-surface-raised) ${
              done ? 'opacity-55' : ''
            } ${isCurrent ? 'ring-2 ring-(--color-primary)' : ''}`}
          >
            <img
              src={item.exercise.gifUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
            {done && (
              <span className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-(--color-bg) bg-(--color-success)">
                <Check size={9} strokeWidth={3.5} className="text-(--color-bg)" />
              </span>
            )}
            {!done && loggedCount > 0 && (
              <span className="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-(--color-bg) bg-(--color-secondary) text-[9px] font-extrabold text-(--color-bg)">
                {loggedCount}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
