import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Dumbbell, GripVertical, Plus, Sparkles, X } from 'lucide-react'
import BottomTabBar from '../components/BottomTabBar'
import { buildSuggestedRoutine, SPLIT_LABELS_PT } from '../lib/routine'
import { useWorkout } from '../lib/workout-context'
import { getGoals } from '../lib/goals.ts'
import { api } from '../lib/api.ts'
import { getActivePlan } from '../lib/coach.ts'
import { getExercise } from '../lib/exercises.ts'
import { buildRoutineItems, estimateWorkoutMinutes, type RoutineItem } from '../lib/prescription.ts'
import { MUSCLE_LABELS_PT } from '../types/muscle'
import type { UserGoals } from '../types/goals.ts'
import type { Exercise } from '../types/exercise'
import type { WorkoutSplit } from '../types/workout'
import type { ActiveWorkoutPlan } from '../types/coach.ts'
import ExercisePicker from '../components/ExercisePicker'

const SPLITS: WorkoutSplit[] = ['upper', 'lower', 'full', 'core']

interface AiRoutineResponse {
  exerciseIds: string[]
  rationale: string
}

export default function HomeScreen() {
  const navigate = useNavigate()
  const { preparePendingWorkout } = useWorkout()
  const [goals, setGoals] = useState<UserGoals | null>(null)
  const [split, setSplit] = useState<WorkoutSplit | null>(null)
  const [routine, setRoutine] = useState<Exercise[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiRationale, setAiRationale] = useState<string | null>(null)
  const [activePlan, setActivePlan] = useState<ActiveWorkoutPlan | null | undefined>(undefined)
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null)
  const [useAutoInstead, setUseAutoInstead] = useState(false)

  useEffect(() => {
    getGoals().then((g) => {
      if (!g) navigate('/onboarding', { replace: true })
      else setGoals(g)
    })
    getActivePlan().then((plan) => {
      setActivePlan(plan)
      if (plan) setSelectedRoutineId(plan.nextRoutineId ?? plan.routines[0]?.id ?? null)
    })
  }, [navigate])

  const routineItems = useMemo(() => buildRoutineItems(routine, goals), [routine, goals])
  const estimatedMinutes = useMemo(() => estimateWorkoutMinutes(routineItems), [routineItems])

  const selectedRoutine = activePlan?.routines.find((r) => r.id === selectedRoutineId) ?? null
  const planRoutineItems: RoutineItem[] = useMemo(() => {
    if (!selectedRoutine) return []
    return selectedRoutine.exercises
      .map((pe) => {
        const exercise = getExercise(pe.exerciseId)
        if (!exercise) return null
        return {
          exercise,
          prescription: {
            sets: pe.sets,
            repRangeMin: pe.repRangeMin,
            repRangeMax: pe.repRangeMax,
            restSeconds: pe.restSeconds,
          },
        }
      })
      .filter((item): item is RoutineItem => item !== null)
  }, [selectedRoutine])
  const planEstimatedMinutes = useMemo(
    () => estimateWorkoutMinutes(planRoutineItems),
    [planRoutineItems],
  )

  const showPlanMode = !!activePlan && !useAutoInstead

  function selectSplit(s: WorkoutSplit) {
    setSplit(s)
    setRoutine(buildSuggestedRoutine(s, goals?.equipment))
    setAiRationale(null)
  }

  function removeExercise(id: string) {
    setRoutine((prev) => prev.filter((e) => e.id !== id))
  }

  function addExercise(exercise: Exercise) {
    setRoutine((prev) => [...prev, exercise])
    setPickerOpen(false)
  }

  async function generateWithAi() {
    if (!split) return
    setAiLoading(true)
    try {
      const result = await api.post<AiRoutineResponse>('/routine/suggested', { split })
      const exercises = result.exerciseIds
        .map((id) => getExercise(id))
        .filter((e): e is Exercise => !!e)
      setRoutine(exercises)
      setAiRationale(result.rationale)
    } finally {
      setAiLoading(false)
    }
  }

  function handleStart() {
    if (!split || routineItems.length === 0) return
    preparePendingWorkout(split, routineItems)
    navigate('/aquecimento')
  }

  function handleStartPlan() {
    if (!selectedRoutine || planRoutineItems.length === 0) return
    preparePendingWorkout(selectedRoutine.label, planRoutineItems, selectedRoutine.id)
    navigate('/aquecimento')
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col px-5 pb-44 pt-10">
      <header className="mb-8 flex items-center gap-3">
        <div className="rounded-xl bg-(--color-primary) p-2.5">
          <Dumbbell size={24} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold leading-tight">Maromba</h1>
          <p className="text-sm text-(--color-text-muted)">Seu personal trainer digital</p>
        </div>
      </header>

      {showPlanMode && activePlan && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">
              Plano do coach
            </h2>
            <button
              onClick={() => setUseAutoInstead(true)}
              className="text-xs font-medium text-(--color-text-muted) underline"
            >
              Usar sugestão automática
            </button>
          </div>
          <p className="mb-3 text-sm font-medium">{activePlan.name}</p>
          <div className="flex gap-3">
            {activePlan.routines.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRoutineId(r.id)}
                className={`flex-1 rounded-xl border py-4 text-center font-semibold transition-colors ${
                  selectedRoutineId === r.id
                    ? 'border-(--color-primary) bg-(--color-primary)/15 text-(--color-primary)'
                    : 'border-(--color-border) bg-(--color-surface) text-(--color-text) hover:bg-(--color-surface-raised)'
                }`}
              >
                Treino {r.label}
                {activePlan.nextRoutineId === r.id && (
                  <span className="mt-0.5 block text-xs font-normal text-(--color-text-muted)">
                    próximo
                  </span>
                )}
              </button>
            ))}
          </div>

          <ul className="mt-6 flex flex-col gap-2">
            {planRoutineItems.map(({ exercise, prescription }) => (
              <li
                key={exercise.id}
                className="flex items-center gap-3 rounded-xl border border-(--color-border) bg-(--color-surface) p-3"
              >
                <img
                  src={exercise.gifUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg object-cover bg-(--color-surface-raised)"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{exercise.name}</p>
                  <p className="text-xs text-(--color-text-muted)">
                    {MUSCLE_LABELS_PT[exercise.target]} · {prescription.sets}x
                    {prescription.repRangeMin}-{prescription.repRangeMax} · desc.{' '}
                    {prescription.restSeconds}s
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!showPlanMode && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">
              Qual treino de hoje?
            </h2>
            {activePlan && (
              <button
                onClick={() => setUseAutoInstead(false)}
                className="text-xs font-medium text-(--color-text-muted) underline"
              >
                Usar plano do coach
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
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
      )}

      {!showPlanMode && split && (
        <section className="mt-4">
          <button
            onClick={generateWithAi}
            disabled={aiLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-(--color-secondary)/50 bg-(--color-secondary)/10 py-3 text-sm font-semibold text-(--color-secondary) disabled:opacity-60"
          >
            <Sparkles size={16} />
            {aiLoading ? 'Gerando com IA...' : 'Treino sugerido pela IA'}
          </button>
          {aiRationale && (
            <p className="mt-2 text-xs text-(--color-text-muted)">{aiRationale}</p>
          )}
        </section>
      )}

      {!showPlanMode && split && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">
              Exercícios ({routineItems.length})
            </h2>
            <button
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1 text-sm font-medium text-(--color-primary)"
            >
              <Plus size={16} /> Adicionar
            </button>
          </div>

          <ul className="flex flex-col gap-2">
            {routineItems.map(({ exercise, prescription }) => (
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
                    {MUSCLE_LABELS_PT[exercise.target]} · {prescription.sets}x
                    {prescription.repRangeMin}-{prescription.repRangeMax} · desc.{' '}
                    {prescription.restSeconds}s
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

          {routineItems.length === 0 && (
            <p className="rounded-xl border border-dashed border-(--color-border) p-6 text-center text-sm text-(--color-text-muted)">
              Nenhum exercício na lista. Adicione ao menos um para começar.
            </p>
          )}
        </section>
      )}

      {!showPlanMode && split && routineItems.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-lg border-t border-(--color-border) bg-(--color-bg) p-4">
          <p className="mb-2 flex items-center justify-center gap-1.5 text-xs text-(--color-text-muted)">
            <Clock size={14} /> ~{estimatedMinutes} min estimados (aquecimento + treino + desaquecimento)
          </p>
          <button
            onClick={handleStart}
            className="w-full rounded-xl bg-(--color-primary) py-4 text-center text-lg font-bold text-white transition-opacity"
          >
            Iniciar Treino
          </button>
        </div>
      )}

      {showPlanMode && planRoutineItems.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-lg border-t border-(--color-border) bg-(--color-bg) p-4">
          <p className="mb-2 flex items-center justify-center gap-1.5 text-xs text-(--color-text-muted)">
            <Clock size={14} /> ~{planEstimatedMinutes} min estimados (aquecimento + treino + desaquecimento)
          </p>
          <button
            onClick={handleStartPlan}
            className="w-full rounded-xl bg-(--color-primary) py-4 text-center text-lg font-bold text-white transition-opacity"
          >
            Iniciar Treino {selectedRoutine?.label}
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

      <BottomTabBar />
    </div>
  )
}
