import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cast, Flag, Maximize2, Minimize2, Trophy, X } from 'lucide-react'
import { useWorkout } from '../lib/workout-context'
import { getLastPerformance, suggestNextLoad } from '../lib/progression'
import { isUnilateralExercise } from '../lib/unilateral'
import { normalizeEquipment } from '../lib/equipment'
import { SPLIT_LABELS_PT } from '../lib/routine'
import ExerciseMedia from '../components/ExerciseMedia'
import ExerciseStrip from '../components/ExerciseStrip'
import SetTable from '../components/SetTable'
import PreviousSessionCard from '../components/PreviousSessionCard'
import RestTimer from '../components/RestTimer'
import CastModal from '../components/CastModal'
import type { LastPerformance, ProgressionSuggestion, WorkoutSplit } from '../types/workout'
import { MUSCLE_LABELS_PT } from '../types/muscle'

export default function PlayerScreen() {
  const navigate = useNavigate()
  const {
    session,
    routineItems,
    currentItem,
    currentIndex,
    isTvMode,
    sessionSets,
    restTimer,
    allExercisesComplete,
    setTvMode,
    goToExercise,
    logSet,
    updateSet,
    finishWorkout,
  } = useWorkout()

  const currentExercise = currentItem?.exercise ?? null
  const prescription = currentItem?.prescription ?? null

  const [last, setLast] = useState<LastPerformance | null>(null)
  const [suggestion, setSuggestion] = useState<ProgressionSuggestion | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [weight, setWeight] = useState(0)
  const [reps, setReps] = useState(10)
  const [rir, setRir] = useState(2)
  const [lastPR, setLastPR] = useState(false)
  const [castOpen, setCastOpen] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  // Detecção automática pelo nome do exercício (ver lib/unilateral.ts) — o usuário pode
  // corrigir manualmente se a detecção errar pra esse exercício específico.
  const [unilateral, setUnilateral] = useState(false)

  // Só valida ao montar: se o usuário cair em /treino sem sessão ativa (ex.: refresh),
  // volta para a Home. Não pode reagir a mudanças posteriores de `session`, senão o
  // finishWorkout() (que zera a sessão do contexto) dispara essa mesma checagem e o
  // `replace` sobrescreve a navegação para /desaquecimento que acabou de acontecer.
  useEffect(() => {
    if (!session) navigate('/', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // O gesto de voltar do Android (swipe na borda) e o botão físico de voltar disparam
  // popstate como se fosse um tap comum — sem isso, saem do treino sem aviso e perdem
  // o progresso da sessão em andamento. Empurra um estado extra no histórico assim que
  // entra no treino; qualquer "voltar" só remove esse estado (sem sair da tela de fato)
  // e mostra a confirmação em vez de deixar a navegação acontecer.
  useEffect(() => {
    window.history.pushState(null, '', window.location.href)
    function handlePopState() {
      window.history.pushState(null, '', window.location.href)
      setShowExitConfirm(true)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!currentExercise || !prescription) return
    let cancelled = false
    setLoadingHistory(true)
    setLastPR(false)
    setUnilateral(isUnilateralExercise(currentExercise))
    getLastPerformance(currentExercise.id).then((lp) => {
      if (cancelled) return
      setLast(lp)
      if (lp) {
        // A linha ativa começa repetindo exatamente a última sessão — é o ponto de
        // partida mais simples pra registrar direto. A sugestão de progressão (dupla
        // progressão: reps antes de carga) fica como linha separada e opcional logo
        // abaixo, pro usuário decidir se aplica.
        setSuggestion(suggestNextLoad(lp, prescription))
        setWeight(lp.weightKg)
        setReps(lp.reps)
      } else {
        setSuggestion(null)
        setWeight(0)
        // Sem histórico: usa o meio da faixa de reps prescrita como ponto de partida.
        setReps(Math.round((prescription.repRangeMin + prescription.repRangeMax) / 2))
      }
      setRir(2)
      setLoadingHistory(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentExercise])

  if (!currentExercise || !prescription || !session) return null

  const loggedSets = sessionSets[currentExercise.id] ?? []
  const showWeight = normalizeEquipment(currentExercise.equipment) !== 'body only'
  const splitLabel = SPLIT_LABELS_PT[session.split as WorkoutSplit] ?? session.split

  async function handleLogSet() {
    if (!currentExercise) return
    const result = await logSet(currentExercise.id, {
      weightKg: weight,
      reps,
      rir,
      sides: unilateral ? 2 : 1,
    })
    setLastPR(result.isNewPR)
  }

  function handleUpdateSet(setId: string, data: { weightKg: number; reps: number; rir: number; sides: number }) {
    if (!currentExercise) return
    updateSet(currentExercise.id, setId, data)
  }

  function handleApplySuggestion(s: ProgressionSuggestion) {
    setWeight(s.weightKg)
    setReps(s.reps)
    setRir(s.rir)
  }

  async function handleFinishWorkout() {
    const sessionId = await finishWorkout()
    if (sessionId) navigate(`/desaquecimento/${sessionId}`)
  }

  return (
    <div
      className={`mx-auto flex min-h-svh max-w-2xl flex-col ${isTvMode ? 'text-[1.25em]' : ''}`}
    >
      <header className="flex items-center justify-between gap-2 p-4 pb-2">
        <button
          onClick={() => setShowExitConfirm(true)}
          aria-label="Sair do treino"
          className="rounded-full p-2 text-(--color-text-muted) hover:bg-(--color-surface-raised)"
        >
          <X size={20} />
        </button>
        <p className="text-sm font-bold text-(--color-primary)">{splitLabel}</p>
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

      <ExerciseStrip
        routineItems={routineItems}
        currentIndex={currentIndex}
        sessionSets={sessionSets}
        onSelect={goToExercise}
      />

      <div className="border-t border-(--color-border)">
        <ExerciseMedia exercise={currentExercise} className="h-64 w-full sm:h-80" />
      </div>

      <div className="flex-1 px-5 pb-32 pt-5">
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

        <p className="mt-3 text-sm font-medium text-(--color-text-muted)">
          Meta: {prescription.sets}x{prescription.repRangeMin}-{prescription.repRangeMax} ·
          descanso {prescription.restSeconds}s
        </p>

        <label className="mt-2 flex w-fit items-center gap-2 text-sm text-(--color-text-muted)">
          <input
            type="checkbox"
            checked={unilateral}
            onChange={(e) => setUnilateral(e.target.checked)}
            className="h-4 w-4 accent-(--color-primary)"
          />
          Um lado de cada vez (registra as reps de cada lado, dobra o volume)
        </label>

        {loadingHistory && (
          <p className="mt-4 text-sm text-(--color-text-muted)">Carregando histórico...</p>
        )}
        {!loadingHistory && !last && (
          <p className="mt-4 rounded-xl border border-(--color-border) bg-(--color-surface) p-4 text-sm text-(--color-text-muted)">
            Primeira vez treinando este exercício. Registre sua carga inicial.
          </p>
        )}

        {lastPR && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-(--color-secondary)/20 px-3 py-2 text-sm font-semibold text-(--color-secondary)">
            <Trophy size={18} /> Novo recorde pessoal!
          </p>
        )}

        <div className="mt-5">
          <SetTable
            sets={loggedSets}
            totalSets={prescription.sets}
            showWeight={showWeight}
            unilateral={unilateral}
            nextWeight={weight}
            nextReps={reps}
            nextRir={rir}
            onNextWeightChange={setWeight}
            onNextRepsChange={setReps}
            onNextRirChange={setRir}
            onLogNext={handleLogSet}
            onUpdateSet={handleUpdateSet}
            suggestion={suggestion}
            onApplySuggestion={handleApplySuggestion}
          />
        </div>

        {last && (
          <div className="mt-5">
            <PreviousSessionCard sessionDate={last.sessionDate} sets={last.sets} showWeight={showWeight} />
          </div>
        )}
      </div>

      {restTimer && !allExercisesComplete && <RestTimer key={restTimer.key} seconds={restTimer.seconds} />}

      {allExercisesComplete && (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-2xl border-t border-(--color-border) bg-(--color-bg) p-4">
          <button
            onClick={handleFinishWorkout}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-(--color-success) py-4 text-center text-lg font-bold text-white"
          >
            <Flag size={20} /> Concluir treino
          </button>
        </div>
      )}

      {castOpen && <CastModal onClose={() => setCastOpen(false)} />}

      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl border border-(--color-border) bg-(--color-surface) p-5 sm:rounded-2xl">
            <h2 className="text-lg font-semibold">Sair do treino?</h2>
            <p className="mt-1 text-sm text-(--color-text-muted)">
              As séries já registradas ficam salvas, mas o treino não vai ser marcado como
              concluído e o restante dos exercícios não será feito agora.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 rounded-xl bg-(--color-primary) py-3 text-center font-semibold text-white"
              >
                Continuar treino
              </button>
              <button
                onClick={() => navigate('/', { replace: true })}
                className="flex-1 rounded-xl border border-(--color-border) py-3 text-center font-semibold text-(--color-text-muted)"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
