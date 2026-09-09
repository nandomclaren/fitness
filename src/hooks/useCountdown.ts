import { useEffect, useRef, useState } from 'react'

export function useCountdown(seconds: number, onFinish?: () => void) {
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning] = useState(true)
  const onFinishRef = useRef(onFinish)

  useEffect(() => {
    onFinishRef.current = onFinish
  }, [onFinish])

  useEffect(() => {
    setRemaining(seconds)
    setRunning(true)
  }, [seconds])

  useEffect(() => {
    if (!running || remaining <= 0) return
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(t)
  }, [running, remaining])

  useEffect(() => {
    if (remaining === 0) onFinishRef.current?.()
  }, [remaining])

  return {
    remaining,
    running,
    toggle: () => setRunning((r) => !r),
    reset: () => setRemaining(seconds),
  }
}
