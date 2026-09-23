import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, Timer } from 'lucide-react'
import { useCountdown } from '../hooks/useCountdown.ts'

interface RestTimerProps {
  seconds: number
  onFinish?: () => void
}

/**
 * Pill flutuante e não-bloqueante: fica sobre o resto da tela sem esconder os
 * campos de peso/reps/RPE. Cada instância é descartada (remontada com uma
 * nova `key` pelo PlayerScreen) sempre que o usuário registra a próxima série
 * ou avança de exercício — não há necessidade de sincronizar cancelamento
 * manualmente com o ciclo de vida do componente.
 */
export default function RestTimer({ seconds, onFinish }: RestTimerProps) {
  const { remaining, running, toggle, reset } = useCountdown(seconds, onFinish)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Fecha ao tocar fora, sem interceptar o toque — assim um toque em "Registrar
  // série" (ou qualquer outro botão da tela) fecha o popover E executa sua própria
  // ação no mesmo gesto, em vez de exigir dois toques.
  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const overrun = remaining < 0
  const abs = Math.abs(remaining)
  const mm = String(Math.floor(abs / 60)).padStart(2, '0')
  const ss = String(abs % 60).padStart(2, '0')

  return (
    <div ref={rootRef} className="fixed inset-x-0 bottom-24 z-50 flex justify-center">
        {open && (
          <div className="absolute bottom-full mb-2 flex gap-1 rounded-2xl border border-(--color-border) bg-(--color-surface-raised) p-2 shadow-xl">
            <button
              onClick={toggle}
              className="flex flex-col items-center gap-1 rounded-xl px-4 py-1.5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-(--color-surface) text-(--color-text)">
                {running ? <Pause size={16} /> : <Play size={16} />}
              </span>
              <span className="text-[11px] font-medium text-(--color-text-muted)">
                {running ? 'Pausar' : 'Continuar'}
              </span>
            </button>
            <button
              onClick={reset}
              className="flex flex-col items-center gap-1 rounded-xl px-4 py-1.5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-(--color-surface) text-(--color-text)">
                <RotateCcw size={16} />
              </span>
              <span className="text-[11px] font-medium text-(--color-text-muted)">Reiniciar</span>
            </button>
          </div>
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Timer de descanso — toque para pausar ou reiniciar"
          className={`flex items-center gap-2 rounded-full px-4 py-2.5 font-extrabold text-white shadow-lg ${
            overrun ? 'bg-(--color-primary)' : 'bg-(--color-success)'
          }`}
        >
          <Timer size={18} />
          <span className="text-lg tabular-nums">
            {overrun ? '-' : ''}
            {mm}:{ss}
          </span>
        </button>
    </div>
  )
}
