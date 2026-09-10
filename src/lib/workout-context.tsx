import { createContext, useContext, useState, type ReactNode } from 'react'
import type { WorkoutSession } from '../types/workout'
import type { RoutineItem } from './prescription.ts'
import { startSession as startSessionInDb, finishSession as finishSessionInDb } from './session'

interface PendingWorkout {
  /** Split (upper/lower/full/core) ou label de rotina de um plano do coach (ex.: "A"). */
  split: string
  routineItems: RoutineItem[]
  /** Presente quando o treino vem de um WorkoutPlan aprovado, pra registrar a rotação A/B. */
  planRoutineId?: string
}

interface WorkoutContextValue {
  session: WorkoutSession | null
  routineItems: RoutineItem[]
  currentIndex: number
  currentItem: RoutineItem | null
  isLastExercise: boolean
  isTvMode: boolean
  pendingWorkout: PendingWorkout | null
  setTvMode: (on: boolean) => void
  /** Guarda a rotina escolhida sem iniciar a sessão ainda — usado pela tela de aquecimento. */
  preparePendingWorkout: (split: string, routineItems: RoutineItem[], planRoutineId?: string) => void
  /** Inicia de fato a sessão (grava no banco) a partir do que foi preparado. */
  beginPreparedWorkout: () => Promise<void>
  goToNextExercise: () => void
  goToExercise: (index: number) => void
  finishWorkout: () => Promise<string | null>
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null)

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [routineItems, setRoutineItems] = useState<RoutineItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTvMode, setTvMode] = useState(false)
  const [pendingWorkout, setPendingWorkout] = useState<PendingWorkout | null>(null)

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
    setPendingWorkout(null)
  }

  const goToNextExercise = () => {
    setCurrentIndex((i) => Math.min(i + 1, routineItems.length - 1))
  }

  const goToExercise = (index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, routineItems.length - 1)))
  }

  const finishWorkout = async () => {
    if (!session) return null
    await finishSessionInDb(session.id)
    const finishedId = session.id
    setSession(null)
    setRoutineItems([])
    setCurrentIndex(0)
    return finishedId
  }

  const value: WorkoutContextValue = {
    session,
    routineItems,
    currentIndex,
    currentItem: routineItems[currentIndex] ?? null,
    isLastExercise: currentIndex >= routineItems.length - 1,
    isTvMode,
    pendingWorkout,
    setTvMode,
    preparePendingWorkout,
    beginPreparedWorkout,
    goToNextExercise,
    goToExercise,
    finishWorkout,
  }

  return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>
}

export function useWorkout(): WorkoutContextValue {
  const ctx = useContext(WorkoutContext)
  if (!ctx) throw new Error('useWorkout deve ser usado dentro de <WorkoutProvider>')
  return ctx
}
