import { createContext, useContext, useState, type ReactNode } from 'react'
import type { SetEntry, WorkoutSession } from '../types/workout'
import type { RoutineItem } from './prescription.ts'
import {
  startSession as startSessionInDb,
  finishSession as finishSessionInDb,
  logSet as logSetInDb,
  updateSet as updateSetInDb,
} from './session'

interface PendingWorkout {
  /** Split (upper/lower/full/core) ou label de rotina de um plano do coach (ex.: "A"). */
  split: string
  routineItems: RoutineItem[]
  /** Presente quando o treino vem de um WorkoutPlan aprovado, pra registrar a rotação A/B. */
  planRoutineId?: string
}

/** Timer de descanso: pertence ao treino inteiro, não à tela do exercício em foco — ver
 * `logSet` abaixo. `key` muda a cada série registrada pra forçar o componente da pill a
 * remontar (cancela o countdown anterior e começa um novo do zero). */
interface RestTimerState {
  seconds: number
  key: number
}

interface LogSetData {
  weightKg: number
  reps: number
  rpe: number
  sides: number
}

interface WorkoutContextValue {
  session: WorkoutSession | null
  routineItems: RoutineItem[]
  currentIndex: number
  currentItem: RoutineItem | null
  isLastExercise: boolean
  isTvMode: boolean
  pendingWorkout: PendingWorkout | null
  /** Séries já registradas nesta sessão, por exerciseId — sobrevive à navegação entre exercícios. */
  sessionSets: Record<string, SetEntry[]>
  /** null = nenhum descanso pendente (ex.: treino acabou de começar, ou todos os exercícios já bateram a meta). */
  restTimer: RestTimerState | null
  /** true quando todo exercício da rotina já bateu a meta de séries prescrita. */
  allExercisesComplete: boolean
  setTvMode: (on: boolean) => void
  /** Guarda a rotina escolhida sem iniciar a sessão ainda — usado pela tela de aquecimento. */
  preparePendingWorkout: (split: string, routineItems: RoutineItem[], planRoutineId?: string) => void
  /** Inicia de fato a sessão (grava no banco) a partir do que foi preparado. */
  beginPreparedWorkout: () => Promise<void>
  goToNextExercise: () => void
  goToExercise: (index: number) => void
  /** Registra uma nova série do exercício informado. Reinicia o timer de descanso; se essa
   * série completa a meta do exercício e ainda sobra outro pendente, avança automaticamente
   * pra tela do próximo (por posição) — o timer continua contando independente da tela. */
  logSet: (exerciseId: string, data: LogSetData) => Promise<{ isNewPR: boolean }>
  /** Corrige uma série já registrada (peso/reps/RPE). Não mexe no timer nem navega. */
  updateSet: (exerciseId: string, setId: string, data: LogSetData) => Promise<{ isNewPR: boolean }>
  finishWorkout: () => Promise<string | null>
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null)

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [routineItems, setRoutineItems] = useState<RoutineItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTvMode, setTvMode] = useState(false)
  const [pendingWorkout, setPendingWorkout] = useState<PendingWorkout | null>(null)
  const [sessionSets, setSessionSets] = useState<Record<string, SetEntry[]>>({})
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null)

  const preparePendingWorkout = (split: string, items: RoutineItem[], planRoutineId?: string) => {
    setPendingWorkout({ split, routineItems: items, planRoutineId })
  }

  const beginPreparedWorkout = async () => {
    if (!pendingWorkout) return
    const newSession = await startSessionInDb(
      pendingWorkout.split,
      pendingWorkout.routineItems.map((item) => item.exercise.id),
      pendingWorkout.planRoutineId,
    )
    setSession(newSession)
    setRoutineItems(pendingWorkout.routineItems)
    setCurrentIndex(0)
    setSessionSets({})
    setRestTimer(null)
    setPendingWorkout(null)
  }

  const goToNextExercise = () => {
    setCurrentIndex((i) => Math.min(i + 1, routineItems.length - 1))
  }

  const goToExercise = (index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, routineItems.length - 1)))
  }

  const logSet = async (exerciseId: string, data: LogSetData) => {
    if (!session) throw new Error('logSet chamado sem sessão ativa')
    const item = routineItems.find((i) => i.exercise.id === exerciseId)
    if (!item) throw new Error(`Exercício ${exerciseId} não faz parte da rotina atual`)

    const setNumber = (sessionSets[exerciseId]?.length ?? 0) + 1
    const result = await logSetInDb({ sessionId: session.id, exerciseId, setNumber, ...data })

    const updatedSetsForExercise = [...(sessionSets[exerciseId] ?? []), result.set]
    setSessionSets((prev) => ({ ...prev, [exerciseId]: updatedSetsForExercise }))

    const exerciseComplete = updatedSetsForExercise.length >= item.prescription.sets
    if (exerciseComplete) {
      const allComplete = routineItems.every((routineItem) => {
        const sets =
          routineItem.exercise.id === exerciseId
            ? updatedSetsForExercise
            : (sessionSets[routineItem.exercise.id] ?? [])
        return sets.length >= routineItem.prescription.sets
      })
      if (allComplete) {
        // Nada mais pra descansar — a tela mostra "Concluir treino" em vez da pill.
        setRestTimer(null)
      } else {
        setRestTimer({ seconds: item.prescription.restSeconds, key: Date.now() })
        goToNextExercise()
      }
    } else {
      setRestTimer({ seconds: item.prescription.restSeconds, key: Date.now() })
    }

    return { isNewPR: result.isNewPR }
  }

  const updateSet = async (exerciseId: string, setId: string, data: LogSetData) => {
    if (!session) throw new Error('updateSet chamado sem sessão ativa')
    const result = await updateSetInDb(session.id, setId, data)
    setSessionSets((prev) => ({
      ...prev,
      [exerciseId]: (prev[exerciseId] ?? []).map((s) => (s.id === setId ? result.set : s)),
    }))
    return { isNewPR: result.isNewPR }
  }

  const finishWorkout = async () => {
    if (!session) return null
    await finishSessionInDb(session.id)
    const finishedId = session.id
    setSession(null)
    setRoutineItems([])
    setCurrentIndex(0)
    setSessionSets({})
    setRestTimer(null)
    return finishedId
  }

  const allExercisesComplete =
    routineItems.length > 0 &&
    routineItems.every((item) => (sessionSets[item.exercise.id]?.length ?? 0) >= item.prescription.sets)

  const value: WorkoutContextValue = {
    session,
    routineItems,
    currentIndex,
    currentItem: routineItems[currentIndex] ?? null,
    isLastExercise: currentIndex >= routineItems.length - 1,
    isTvMode,
    pendingWorkout,
    sessionSets,
    restTimer,
    allExercisesComplete,
    setTvMode,
    preparePendingWorkout,
    beginPreparedWorkout,
    goToNextExercise,
    goToExercise,
    logSet,
    updateSet,
    finishWorkout,
  }

  return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>
}

export function useWorkout(): WorkoutContextValue {
  const ctx = useContext(WorkoutContext)
  if (!ctx) throw new Error('useWorkout deve ser usado dentro de <WorkoutProvider>')
  return ctx
}
