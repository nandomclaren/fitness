import { useNavigate, useParams } from 'react-router-dom'
import { Wind } from 'lucide-react'
import BigCountdown from '../components/BigCountdown.tsx'

const COOLDOWN_SECONDS = 5 * 60

export default function CooldownScreen() {
  const navigate = useNavigate()
  const { sessionId } = useParams<{ sessionId: string }>()

  function handleContinue() {
    navigate(`/resumo/${sessionId}`)
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col items-center px-5 py-10 text-center">
      <div className="mb-2 rounded-xl bg-(--color-secondary)/15 p-3">
        <Wind size={28} className="text-(--color-secondary)" />
      </div>
      <h1 className="text-2xl font-bold">Desaquecimento</h1>
      <p className="mt-2 max-w-xs text-sm text-(--color-text-muted)">
        5 minutos de alongamento leve dos grupos musculares trabalhados, respirando
        fundo pra baixar a frequência cardíaca antes de encerrar.
      </p>

      <div className="mt-10">
        <BigCountdown seconds={COOLDOWN_SECONDS} />
      </div>

      <div className="mt-auto w-full pt-10">
        <button
          onClick={handleContinue}
          className="w-full rounded-xl bg-(--color-primary) py-4 text-center text-lg font-bold text-white"
        >
          Concluir treino
        </button>
        <button
          onClick={handleContinue}
          className="mt-3 w-full py-2 text-center text-sm text-(--color-text-muted) underline"
        >
          Pular desaquecimento
        </button>
      </div>
    </div>
  )
}
