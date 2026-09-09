import { Pause, Play, RotateCcw } from 'lucide-react'
import { useCountdown } from '../hooks/useCountdown.ts'

interface BigCountdownProps {
  seconds: number
  onFinish?: () => void
}

export default function BigCountdown({ seconds, onFinish }: BigCountdownProps) {
  const { remaining, running, toggle, reset } = useCountdown(seconds, onFinish)

  const mm = String(Math.floor(Math.max(0, remaining) / 60)).padStart(2, '0')
  const ss = String(Math.max(0, remaining) % 60).padStart(2, '0')
  const pct = Math.max(0, Math.min(1, remaining / seconds))

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative h-56 w-56">
        <svg viewBox="0 0 100 100" className="h-56 w-56 -rotate-90">
          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--color-cold)" strokeWidth="6" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={remaining === 0 ? 'var(--color-success)' : 'var(--color-secondary)'}
            strokeWidth="6"
            strokeDasharray={2 * Math.PI * 45}
            strokeDashoffset={2 * Math.PI * 45 * (1 - pct)}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-5xl font-bold tabular-nums">
          {mm}:{ss}
        </span>
      </div>
      <div className="flex gap-3">
        <button
          onClick={toggle}
          aria-label={running ? 'Pausar' : 'Continuar'}
          className="rounded-full bg-(--color-surface-raised) p-4 text-(--color-text)"
        >
          {running ? <Pause size={24} /> : <Play size={24} />}
        </button>
        <button
          onClick={reset}
          aria-label="Reiniciar"
          className="rounded-full bg-(--color-surface-raised) p-4 text-(--color-text)"
        >
          <RotateCcw size={24} />
        </button>
      </div>
    </div>
  )
}
