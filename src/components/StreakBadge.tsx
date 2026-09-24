import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import { getStreak } from '../lib/session.ts'

/** Badge compacto de streak (dias seguidos treinando) pro header da Home — estilo
 * "chama" que a maioria dos apps de hábito usa. Fica quieto (não renderiza nada) sem
 * nenhum treino concluído ainda, pra não mostrar "0 dias" logo de cara pra quem tá
 * começando. */
export default function StreakBadge() {
  const [streak, setStreak] = useState<number | null>(null)

  useEffect(() => {
    getStreak().then((s) => setStreak(s.currentStreak))
  }, [])

  if (!streak) return null

  return (
    <div
      className="flex shrink-0 items-center gap-1 rounded-full bg-(--color-surface-raised) px-2.5 py-1.5"
      title={`${streak} dia${streak > 1 ? 's' : ''} seguidos treinando`}
    >
      <Flame size={16} className="text-(--color-secondary)" />
      <span className="text-sm font-bold">{streak}</span>
    </div>
  )
}
