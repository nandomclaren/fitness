import { useEffect, useState } from 'react'
import type { Exercise } from '../types/exercise'

interface ExerciseMediaProps {
  exercise: Exercise
  className?: string
}

/**
 * Demonstração do exercício em loop contínuo. Quando a fonte já fornece um GIF animado
 * (ExerciseDB), apenas o exibe. Quando só há duas fotos (posição inicial/final, como no
 * free-exercise-db), simula o loop alternando os dois quadros com crossfade.
 */
export default function ExerciseMedia({ exercise, className }: ExerciseMediaProps) {
  const [showFrame2, setShowFrame2] = useState(false)

  useEffect(() => {
    setShowFrame2(false)
    if (!exercise.loopFrameUrl) return
    const interval = setInterval(() => setShowFrame2((v) => !v), 900)
    return () => clearInterval(interval)
  }, [exercise.id, exercise.loopFrameUrl])

  return (
    <div className={`relative overflow-hidden bg-(--color-surface-raised) ${className ?? ''}`}>
      <img
        src={exercise.gifUrl}
        alt={exercise.name}
        className="absolute inset-0 h-full w-full object-contain transition-opacity duration-500"
        style={{ opacity: exercise.loopFrameUrl && showFrame2 ? 0 : 1 }}
      />
      {exercise.loopFrameUrl && (
        <img
          src={exercise.loopFrameUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-contain transition-opacity duration-500"
          style={{ opacity: showFrame2 ? 1 : 0 }}
        />
      )}
    </div>
  )
}
