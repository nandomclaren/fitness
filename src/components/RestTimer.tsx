import { Pause, Play, RotateCcw } from 'lucide-react'
import { useCountdown } from '../hooks/useCountdown.ts'

interface RestTimerProps {
  seconds: number
  onFinish?: () => void
}

export default function RestTimer({ seconds, onFinish }: RestTimerProps) {
  const { remaining, running, toggle, reset } = useCountdown(seconds, onFinish)

  const mm = String(Math.floor(Math.max(0, remaining) / 60)).padStart(2, '0')
  const ss = String(Math.max(0, remaining) % 60).padStart(2, '0')
  const pct = Math.max(0, Math.min(1, remaining / seconds))

  return (
    <div className="flex items-center gap-4 rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
      <div className="relative h-16 w-16 shrink-0">
        <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
          <circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-cold)" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke={remaining === 0 ? 'var(--color-success)' : 'var(--color-secondary)'}
            strokeWidth="3"
            strokeDasharray={2 * Math.PI * 16}
            strokeDashoffset={2 * Math.PI * 16 * (1 - pct)}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">
          {mm}:{ss}
        </span>
      </div>
      <p className="flex-1 text-sm text-(--color-text-muted)">
        {remaining === 0 ? 'Descanso concluído — hora da próxima série!' : 'Descanso entre séries'}
      </p>
      <div className="flex gap-2">
        <button
          onClick={toggle}
          aria-label={running ? 'Pausar' : 'Continuar'}
          className="rounded-full bg-(--color-surface-raised) p-2.5 text-(--color-text)"
        >
          {running ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          onClick={reset}
          aria-label="Reiniciar"
          className="rounded-full bg-(--color-surface-raised) p-2.5 text-(--color-text)"
        >
          <RotateCcw size={18} />
        </button>
      </div>
    </div>
  )
}
