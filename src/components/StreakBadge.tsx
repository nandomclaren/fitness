import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import { getStreak } from '../lib/session.ts'

/** Badge compacto de streak pro header da Home — estilo "chama" que a maioria dos apps de
 * hábito usa. É streak SEMANAL (semanas seguidas com pelo menos 1 treino), não diário — um
 * dia de descanso não deveria "quebrar" nada num app de treino (mesmo mecanismo do Alpha
 * Progression: o "🔥 Xw" em destaque lá também é semanal). Fica quieto (não renderiza nada)
 * sem nenhum treino concluído ainda, pra não mostrar "0" logo de cara pra quem tá começando. */
export default function StreakBadge() {
  const [streak, setStreak] = useState<number | null>(null)

  useEffect(() => {
    getStreak().then((s) => setStreak(s.currentStreak))
  }, [])

  if (!streak) return null

  return (
    <div
      className="flex shrink-0 items-center gap-1 rounded-full bg-(--color-surface-raised) px-2.5 py-1.5"
      title={`${streak} semana${streak > 1 ? 's' : ''} seguidas treinando`}
    >
      <Flame size={16} className="text-(--color-secondary)" />
      <span className="text-sm font-bold">{streak}w</span>
    </div>
  )
}
