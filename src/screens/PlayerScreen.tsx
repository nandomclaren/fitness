import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Cast,
  CheckCircle2,
  ChevronRight,
  Maximize2,
  Minimize2,
  TrendingDown,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react'
import { useWorkout } from '../lib/workout-context'
import { getLastPerformance, suggestNextLoad } from '../lib/progression'
import { logSet } from '../lib/session'
import ExerciseMedia from '../components/ExerciseMedia'
import RestTimer from '../components/RestTimer'
import CastModal from '../components/CastModal'
import type { LastPerformance, ProgressionSuggestion, SetEntry } from '../types/workout'
import { MUSCLE_LABELS_PT } from '../types/muscle'

export default function PlayerScreen() {
  const navigate = useNavigate()
  const {
    session,
    routineItems,
    currentItem,
    currentIndex,
    isLastExercise,
    isTvMode,
    setTvMode,
    goToNextExercise,
    finishWorkout,
  } = useWorkout()

  const currentExercise = currentItem?.exercise ?? null
  const prescription = currentItem?.prescription ?? null

  const [last, setLast] = useState<LastPerformance | null>(null)
  const [suggestion, setSuggestion] = useState<ProgressionSuggestion | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [loggedSets, setLoggedSets] = useState<SetEntry[]>([])
  const [weight, setWeight] = useState(0)
  const [reps, setReps] = useState(10)
  const [rpe, setRpe] = useState(8)
  const [showRest, setShowRest] = useState(false)
  const [lastPR, setLastPR] = useState(false)
  const [castOpen, setCastOpen] = useState(false)

  // Só valida ao montar: se o usuário cair em /treino sem sessão ativa (ex.: refresh),
  // volta para a Home. Não pode reagir a mudanças posteriores de `session`, senão o
  // finishWorkout() (que zera a sessão do contexto) dispara essa mesma checagem e o
  // `replace` sobrescreve a navegação para /desaquecimento que acabou de acontecer.
  useEffect(() => {
    if (!session) navigate('/', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!currentExercise || !prescription) return
    let cancelled = false
    setLoadingHistory(true)
    setLoggedSets([])
    setShowRest(false)
    getLastPerformance(currentExercise.id).then((lp) => {
      if (cancelled) return
      setLast(lp)
      if (lp) {
        const sug = suggestNextLoad(lp)
        setSuggestion(sug)
        setWeight(sug.weightKg)
        setReps(sug.reps)
      } else {
        setSuggestion(null)
        setWeight(0)
        // Sem histórico: usa o meio da faixa de reps prescrita como ponto de partida.
        setReps(Math.round((prescription.repRangeMin + prescription.repRangeMax) / 2))
      }
      setRpe(8)
      setLoadingHistory(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentExercise])

  if (!currentExercise || !prescription || !session) return null

  async function handleLogSet() {
    if (!currentExercise) return
    const result = await logSet({
      sessionId: session!.id,
      exerciseId: currentExercise.id,
      setNumber: loggedSets.length + 1,
      weightKg: weight,
      reps,
      rpe,
    })
    setLoggedSets((prev) => [...prev, result.set])
    setLastPR(result.isNewPR)
    setShowRest(true)
  }

  async function handleAdvance() {
    if (isLastExercise) {
      const sessionId = await finishWorkout()
      if (sessionId) navigate(`/desaquecimento/${sessionId}`)
    } else {
      goToNextExercise()
    }
  }

  const goalMet = loggedSets.length >= prescription.sets

  return (
    <div
      className={`mx-auto flex min-h-svh max-w-2xl flex-col ${isTvMode ? 'text-[1.25em]' : ''}`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-(--color-border) p-4">
        <button
          onClick={() => navigate('/')}
          aria-label="Sair do treino"
          className="rounded-full p-2 text-(--color-text-muted) hover:bg-(--color-surface-raised)"
        >
          <X size={20} />
        </button>
        <p className="text-sm font-semibold text-(--color-text-muted)">
          Exercício {currentIndex + 1} de {routineItems.length}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCastOpen(true)}
            aria-label="Enviar para TV"
            className="rounded-full p-2 text-(--color-text-muted) hover:bg-(--color-surface-raised)"
          >
            <Cast size={20} />
          </button>
          <button
            onClick={() => setTvMode(!isTvMode)}
            aria-label="Alternar modo TV"
            className="rounded-full p-2 text-(--color-text-muted) hover:bg-(--color-surface-raised)"
          >
            {isTvMode ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </header>

      <ExerciseMedia exercise={currentExercise} className="h-64 w-full sm:h-80" />

      <div className="flex-1 px-5 pb-40 pt-5">
        <h1 className="text-2xl font-bold leading-tight">{currentExercise.name}</h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-(--color-primary-dim) px-2.5 py-1 text-xs font-medium">
            {MUSCLE_LABELS_PT[currentExercise.target]}
          </span>
          {currentExercise.secondaryMuscles.map((m) => (
            <span
              key={m}
              className="rounded-full bg-(--color-surface-raised) px-2.5 py-1 text-xs text-(--color-text-muted)"
            >
              {MUSCLE_LABELS_PT[m]}
            </span>
          ))}
        </div>

        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-(--color-text-muted)">
          Meta: {prescription.sets}x{prescription.repRangeMin}-{prescription.repRangeMax} ·
          descanso {prescription.restSeconds}s
          {goalMet && (
            <span className="flex items-center gap-1 text-(--color-success)">
              <CheckCircle2 size={16} /> meta batida
            </span>
          )}
        </p>

        <section className="mt-4 rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
          {loadingHistory ? (
            <p className="text-sm text-(--color-text-muted)">Carregando histórico...</p>
          ) : last ? (
            <>
              <p className="text-sm text-(--color-text-muted)">
                Última sessão: <strong className="text-(--color-text)">{last.weightKg}kg × {last.reps} reps</strong>{' '}
                (RPE {last.rpe})
              </p>
              {suggestion && (
                <p className="mt-2 flex items-start gap-2 text-sm font-medium">
                  {suggestion.weightKg > last.weightKg ? (
                    <TrendingUp size={18} className="mt-0.5 shrink-0 text-(--color-success)" />
                  ) : suggestion.weightKg < last.weightKg ? (
                    <TrendingDown size={18} className="mt-0.5 shrink-0 text-(--color-secondary)" />
                  ) : null}
                  <span>{suggestion.reason}</span>
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-(--color-text-muted)">
              Primeira vez treinando este exercício. Registre sua carga inicial.
            </p>
          )}
        </section>

        {loggedSets.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5">
            {loggedSets.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg bg-(--color-surface-raised) px-3 py-2 text-sm"
              >
                <span>
                  Série {s.setNumber} de {prescription.sets}
                </span>
                <span className="font-medium">
                  {s.weightKg}kg × {s.reps} reps (RPE {s.rpe})
                </span>
              </li>
            ))}
          </ul>
        )}

        {showRest && (
          <div className="mt-4 flex flex-col gap-3">
            {lastPR && (
              <p className="flex items-center gap-2 rounded-lg bg-(--color-secondary)/20 px-3 py-2 text-sm font-semibold text-(--color-secondary)">
                <Trophy size={18} /> Novo recorde pessoal!
              </p>
            )}
            <RestTimer seconds={prescription.restSeconds} />
          </div>
        )}

        {!showRest && (
          <section className="mt-5 grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-(--color-text-muted)">Peso (kg)</span>
              <input
                type="number"
                inputMode="decimal"
                step={0.5}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-3 text-center text-lg font-semibold outline-none focus:border-(--color-primary)"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-(--color-text-muted)">Reps</span>
              <input
                type="number"
                inputMode="numeric"
                value={reps}
                onChange={(e) => setReps(Number(e.target.value))}
                className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-3 text-center text-lg font-semibold outline-none focus:border-(--color-primary)"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-(--color-text-muted)">RPE (1-10)</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                value={rpe}
                onChange={(e) => setRpe(Number(e.target.value))}
                className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-3 text-center text-lg font-semibold outline-none focus:border-(--color-primary)"
              />
            </label>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-2xl gap-3 border-t border-(--color-border) bg-(--color-bg) p-4">
        {!showRest ? (
          <button
            onClick={handleLogSet}
            className="flex-1 rounded-xl bg-(--color-primary) py-4 text-center text-lg font-bold text-white"
          >
            Registrar série ({loggedSets.length + 1} de {prescription.sets})
          </button>
        ) : (
          <button
            onClick={handleAdvance}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-(--color-success) py-4 text-center text-lg font-bold text-white"
          >
            {isLastExercise ? 'Finalizar treino' : 'Próximo exercício'} <ChevronRight size={20} />
          </button>
        )}
      </div>

      {castOpen && <CastModal onClose={() => setCastOpen(false)} />}
    </div>
  )
}
