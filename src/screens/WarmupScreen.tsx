import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame } from 'lucide-react'
import { useWorkout } from '../lib/workout-context.tsx'
import BigCountdown from '../components/BigCountdown.tsx'

const WARMUP_SECONDS = 5 * 60

export default function WarmupScreen() {
  const navigate = useNavigate()
  const { pendingWorkout, beginPreparedWorkout } = useWorkout()

  useEffect(() => {
    if (!pendingWorkout) navigate('/', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleContinue() {
    await beginPreparedWorkout()
    navigate('/treino')
  }

  if (!pendingWorkout) return null

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col items-center px-5 py-10 text-center">
      <div className="mb-2 rounded-xl bg-(--color-secondary)/15 p-3">
        <Flame size={28} className="text-(--color-secondary)" />
      </div>
      <h1 className="text-2xl font-bold">Aquecimento</h1>
      <p className="mt-2 max-w-xs text-sm text-(--color-text-muted)">
        5 minutos de aquecimento cardiovascular leve (esteira, bike ou polichinelos) +
        mobilidade articular geral antes de começar a puxar peso.
      </p>

      <div className="mt-10">
        <BigCountdown seconds={WARMUP_SECONDS} />
      </div>

      <div className="mt-auto w-full pt-10">
        <button
          onClick={handleContinue}
          className="w-full rounded-xl bg-(--color-primary) py-4 text-center text-lg font-bold text-white"
        >
          Concluir e iniciar treino
        </button>
        <button
          onClick={handleContinue}
          className="mt-3 w-full py-2 text-center text-sm text-(--color-text-muted) underline"
        >
          Pular aquecimento
        </button>
      </div>
    </div>
  )
}
