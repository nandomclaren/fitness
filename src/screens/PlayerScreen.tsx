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
import { isUnilateralExercise } from '../lib/unilateral'
import ExerciseMedia from '../components/ExerciseMedia'
import RestTimer from '../components/RestTimer'
import CastModal from '../components/CastModal'
import type { LastPerformance, ProgressionSuggestion, SetEntry } from '../types/workout'
import { MUSCLE_LABELS_PT } from '../types/muscle'

/** Aceita "," ou "." como separador decimal; string vazia ou inválida vira 0. */
function parseLocaleNumber(text: string): number {
  const n = Number(text.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

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
  // Guardados como texto (não number) pra não travar no zero: um <input> controlado com
  // value=number força Number('')=0 de volta pra tela a cada tecla apagada, então o
  // usuário nunca consegue esvaziar o campo pra digitar outro número por cima.
  const [weightText, setWeightText] = useState('0')
  const [repsText, setRepsText] = useState('10')
  const [rpeText, setRpeText] = useState('8')
  const weight = parseLocaleNumber(weightText)
  const reps = parseLocaleNumber(repsText)
  const rpe = parseLocaleNumber(rpeText)
  const [showRest, setShowRest] = useState(false)
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
    setLoggedSets([])
    setShowRest(false)
    setUnilateral(isUnilateralExercise(currentExercise))
    getLastPerformance(currentExercise.id).then((lp) => {
      if (cancelled) return
      setLast(lp)
      if (lp) {
        const sug = suggestNextLoad(lp)
        setSuggestion(sug)
        setWeightText(String(sug.weightKg))
        // Encaixa a sugestão (baseada no histórico) dentro da faixa de reps prescrita
        // atual — se o objetivo mudou desde a última vez, o histórico pode sugerir um
        // número de reps fora da meta de hoje.
        const clampedReps = Math.min(
          prescription.repRangeMax,
          Math.max(prescription.repRangeMin, sug.reps),
        )
        setRepsText(String(clampedReps))
      } else {
        setSuggestion(null)
        setWeightText('0')
        // Sem histórico: usa o meio da faixa de reps prescrita como ponto de partida.
        setRepsText(String(Math.round((prescription.repRangeMin + prescription.repRangeMax) / 2)))
      }
      setRpeText('8')
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
      sides: unilateral ? 2 : 1,
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

  // Depois do descanso: se a meta de séries do exercício ainda não foi batida, volta pro
  // formulário pra registrar a próxima série (não avança pro próximo exercício sozinho).
  async function handleContinueAfterRest() {
    if (goalMet) {
      await handleAdvance()
    } else {
      setShowRest(false)
    }
  }

  return (
    <div
      className={`mx-auto flex min-h-svh max-w-2xl flex-col ${isTvMode ? 'text-[1.25em]' : ''}`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-(--color-border) p-4">
        <button
          onClick={() => setShowExitConfirm(true)}
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

        <label className="mt-2 flex w-fit items-center gap-2 text-sm text-(--color-text-muted)">
          <input
            type="checkbox"
            checked={unilateral}
            onChange={(e) => setUnilateral(e.target.checked)}
            className="h-4 w-4 accent-(--color-primary)"
          />
          Um lado de cada vez (registra as reps de cada lado, dobra o volume)
        </label>

        <section className="mt-4 rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
          {loadingHistory ? (
            <p className="text-sm text-(--color-text-muted)">Carregando histórico...</p>
          ) : last ? (
            <>
              <p className="text-sm text-(--color-text-muted)">
                Última sessão:{' '}
                <strong className="text-(--color-text)">
                  {last.weightKg}kg × {last.reps} reps{last.sides > 1 ? ` (${last.sides} lados)` : ''}
                </strong>{' '}
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
                  {s.weightKg}kg × {s.reps} reps{s.sides > 1 ? ` × ${s.sides} lados` : ''} (RPE{' '}
                  {s.rpe})
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
                type="text"
                inputMode="decimal"
                value={weightText}
                onChange={(e) => setWeightText(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-3 text-center text-lg font-semibold outline-none focus:border-(--color-primary)"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-(--color-text-muted)">
                {unilateral ? 'Reps (por lado)' : 'Reps'}
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={repsText}
                onChange={(e) => setRepsText(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-3 text-center text-lg font-semibold outline-none focus:border-(--color-primary)"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-(--color-text-muted)">RPE (1-10)</span>
              <input
                type="text"
                inputMode="numeric"
                value={rpeText}
                onChange={(e) => setRpeText(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-3 text-center text-lg font-semibold outline-none focus:border-(--color-primary)"
              />
            </label>
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-2xl flex-col gap-2 border-t border-(--color-border) bg-(--color-bg) p-4">
        <div className="flex gap-3">
          {!showRest ? (
            <button
              onClick={handleLogSet}
              className="flex-1 rounded-xl bg-(--color-primary) py-4 text-center text-lg font-bold text-white"
            >
              Registrar série ({loggedSets.length + 1} de {prescription.sets})
            </button>
          ) : (
            <button
              onClick={handleContinueAfterRest}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-(--color-success) py-4 text-center text-lg font-bold text-white"
            >
              {goalMet
                ? isLastExercise
                  ? 'Finalizar treino'
                  : 'Próximo exercício'
                : `Próxima série (${loggedSets.length + 1} de ${prescription.sets})`}{' '}
              <ChevronRight size={20} />
            </button>
          )}
        </div>
        {showRest && !goalMet && (
          <button
            onClick={handleAdvance}
            className="text-center text-sm text-(--color-text-muted) underline"
          >
            {isLastExercise ? 'Pular direto para o resumo' : 'Pular para o próximo exercício'}
          </button>
        )}
      </div>

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
