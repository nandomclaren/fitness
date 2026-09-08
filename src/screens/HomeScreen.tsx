import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, GripVertical, Plus, X } from 'lucide-react'
import { buildSuggestedRoutine, SPLIT_LABELS_PT } from '../lib/routine'
import { useWorkout } from '../lib/workout-context'
import { MUSCLE_LABELS_PT } from '../types/muscle'
import type { Exercise } from '../types/exercise'
import type { WorkoutSplit } from '../types/workout'
import ExercisePicker from '../components/ExercisePicker'

const SPLITS: WorkoutSplit[] = ['upper', 'lower', 'full']

export default function HomeScreen() {
  const navigate = useNavigate()
  const { startWorkout } = useWorkout()
  const [split, setSplit] = useState<WorkoutSplit | null>(null)
  const [routine, setRoutine] = useState<Exercise[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [starting, setStarting] = useState(false)

  function selectSplit(s: WorkoutSplit) {
    setSplit(s)
    setRoutine(buildSuggestedRoutine(s))
  }

  function removeExercise(id: string) {
    setRoutine((prev) => prev.filter((e) => e.id !== id))
  }

  function addExercise(exercise: Exercise) {
    setRoutine((prev) => [...prev, exercise])
    setPickerOpen(false)
  }

  async function handleStart() {
    if (!split || routine.length === 0) return
    setStarting(true)
    await startWorkout(split, routine)
    navigate('/treino')
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col px-5 pb-28 pt-10">
      <header className="mb-8 flex items-center gap-3">
        <div className="rounded-xl bg-(--color-primary) p-2.5">
          <Dumbbell size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight">Sobrecarga</h1>
          <p className="text-sm text-(--color-text-muted)">Seu personal trainer digital</p>
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">
          Qual treino de hoje?
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {SPLITS.map((s) => (
            <button
              key={s}
              onClick={() => selectSplit(s)}
              className={`rounded-xl border py-4 text-center font-semibold transition-colors ${
                split === s
                  ? 'border-(--color-primary) bg-(--color-primary)/15 text-(--color-primary)'
                  : 'border-(--color-border) bg-(--color-surface) text-(--color-text) hover:bg-(--color-surface-raised)'
              }`}
            >
              {SPLIT_LABELS_PT[s]}
            </button>
          ))}
        </div>
      </section>

      {split && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">
              Exercícios ({routine.length})
            </h2>
            <button
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1 text-sm font-medium text-(--color-primary)"
            >
              <Plus size={16} /> Adicionar
            </button>
          </div>

          <ul className="flex flex-col gap-2">
            {routine.map((exercise) => (
              <li
                key={exercise.id}
                className="flex items-center gap-3 rounded-xl border border-(--color-border) bg-(--color-surface) p-3"
              >
                <GripVertical size={18} className="shrink-0 text-(--color-text-muted)" />
                <img
                  src={exercise.gifUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg object-cover bg-(--color-surface-raised)"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{exercise.name}</p>
                  <p className="text-xs text-(--color-text-muted)">
                    {MUSCLE_LABELS_PT[exercise.target]}
                  </p>
                </div>
                <button
                  onClick={() => removeExercise(exercise.id)}
                  aria-label={`Remover ${exercise.name}`}
                  className="shrink-0 rounded-full p-1.5 text-(--color-text-muted) hover:bg-(--color-surface-raised) hover:text-(--color-primary)"
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>

          {routine.length === 0 && (
            <p className="rounded-xl border border-dashed border-(--color-border) p-6 text-center text-sm text-(--color-text-muted)">
              Nenhum exercício na lista. Adicione ao menos um para começar.
            </p>
          )}
        </section>
      )}

      {split && routine.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-lg border-t border-(--color-border) bg-(--color-bg) p-4">
          <button
            onClick={handleStart}
            disabled={starting}
            className="w-full rounded-xl bg-(--color-primary) py-4 text-center text-lg font-bold text-white transition-opacity disabled:opacity-60"
          >
            {starting ? 'Iniciando...' : 'Iniciar Treino'}
          </button>
        </div>
      )}

      {pickerOpen && (
        <ExercisePicker
          excludeIds={new Set(routine.map((e) => e.id))}
          onPick={addExercise}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
