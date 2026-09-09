import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Exercise } from '../types/exercise'
import type { WorkoutSession, WorkoutSplit } from '../types/workout'
import { startSession as startSessionInDb, finishSession as finishSessionInDb } from './session'

interface WorkoutContextValue {
  session: WorkoutSession | null
  exerciseList: Exercise[]
  currentIndex: number
  currentExercise: Exercise | null
  isLastExercise: boolean
  isTvMode: boolean
  setTvMode: (on: boolean) => void
  startWorkout: (split: WorkoutSplit, exercises: Exercise[]) => Promise<void>
  goToNextExercise: () => void
  goToExercise: (index: number) => void
  finishWorkout: () => Promise<string | null>
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null)

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [exerciseList, setExerciseList] = useState<Exercise[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTvMode, setTvMode] = useState(false)

  const startWorkout = async (split: WorkoutSplit, exercises: Exercise[]) => {
    const newSession = await startSessionInDb(
      split,
      exercises.map((e) => e.id),
    )
    setSession(newSession)
    setExerciseList(exercises)
    setCurrentIndex(0)
  }

  const goToNextExercise = () => {
    setCurrentIndex((i) => Math.min(i + 1, exerciseList.length - 1))
  }

  const goToExercise = (index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, exerciseList.length - 1)))
  }

  const finishWorkout = async () => {
    if (!session) return null
    await finishSessionInDb(session.id)
    const finishedId = session.id
    setSession(null)
    setExerciseList([])
    setCurrentIndex(0)
    return finishedId
  }

  const value: WorkoutContextValue = {
    session,
    exerciseList,
    currentIndex,
    currentExercise: exerciseList[currentIndex] ?? null,
    isLastExercise: currentIndex >= exerciseList.length - 1,
    isTvMode,
    setTvMode,
    startWorkout,
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
