import { useEffect, useRef, useState } from 'react'

export function useCountdown(seconds: number, onFinish?: () => void) {
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning] = useState(true)
  const onFinishRef = useRef(onFinish)
  // Garante que onFinish dispare uma única vez ao cruzar zero, mesmo que a
  // contagem continue (negativa) depois disso — ver reset() abaixo.
  const firedRef = useRef(false)

  useEffect(() => {
    onFinishRef.current = onFinish
  }, [onFinish])

  useEffect(() => {
    setRemaining(seconds)
    setRunning(true)
    firedRef.current = false
  }, [seconds])

  useEffect(() => {
    if (!running) return
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(t)
  }, [running, remaining])

  useEffect(() => {
    if (remaining <= 0 && !firedRef.current) {
      firedRef.current = true
      onFinishRef.current?.()
    }
  }, [remaining])

  return {
    remaining,
    running,
    toggle: () => setRunning((r) => !r),
    reset: () => {
      setRemaining(seconds)
      firedRef.current = false
    },
  }
}
