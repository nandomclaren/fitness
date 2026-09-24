import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Dumbbell, Flame, Trophy } from 'lucide-react'
import { listSessions, getStreak, type SessionListItem, type StreakStats } from '../lib/session.ts'
import { SPLIT_LABELS_PT } from '../lib/routine.ts'
import BottomTabBar from '../components/BottomTabBar'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function HistoryScreen() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<SessionListItem[] | null>(null)
  const [streak, setStreak] = useState<StreakStats | null>(null)

  useEffect(() => {
    listSessions().then(setSessions)
    getStreak().then(setStreak)
  }, [])

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col px-5 pb-24 pt-10">
      <header className="mb-6">
        <h1 className="text-xl font-bold leading-tight">Histórico de treinos</h1>
      </header>

      {streak && streak.totalWorkouts > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center gap-1 rounded-xl border border-(--color-border) bg-(--color-surface) py-3">
            <Flame size={18} className="text-(--color-secondary)" />
            <span className="text-lg font-bold">{streak.currentStreak}</span>
            <span className="text-[11px] text-(--color-text-muted)">semanas seguidas</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl border border-(--color-border) bg-(--color-surface) py-3">
            <Trophy size={18} className="text-(--color-secondary)" />
            <span className="text-lg font-bold">{streak.longestStreak}</span>
            <span className="text-[11px] text-(--color-text-muted)">recorde de semanas</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl border border-(--color-border) bg-(--color-surface) py-3">
            <Flame size={18} className="text-(--color-text-muted)" />
            <span className="text-lg font-bold">{streak.currentDailyStreak}</span>
            <span className="text-[11px] text-(--color-text-muted)">dias seguidos</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl border border-(--color-border) bg-(--color-surface) py-3">
            <Dumbbell size={18} className="text-(--color-text-muted)" />
            <span className="text-lg font-bold">{streak.totalWorkouts}</span>
            <span className="text-[11px] text-(--color-text-muted)">treinos no total</span>
          </div>
        </div>
      )}

      {sessions === null && (
        <p className="text-center text-sm text-(--color-text-muted)">Carregando...</p>
      )}

      {sessions?.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-(--color-border) p-10 text-center">
          <Dumbbell size={28} className="text-(--color-text-muted)" />
          <p className="text-sm text-(--color-text-muted)">
            Nenhum treino concluído ainda. Termine um treino pra ele aparecer aqui.
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {sessions?.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => navigate(`/resumo/${s.id}`)}
              className="flex w-full items-center gap-3 rounded-xl border border-(--color-border) bg-(--color-surface) p-4 text-left hover:bg-(--color-surface-raised)"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {SPLIT_LABELS_PT[s.split as keyof typeof SPLIT_LABELS_PT] ?? s.split} ·{' '}
                  {formatDate(s.startedAt)}
                </p>
                <p className="text-sm text-(--color-text-muted)">
                  {Math.round(s.totalVolumeKg).toLocaleString('pt-BR')} kg · {s.totalSets} séries ·{' '}
                  {s.totalExercises} exercícios
                </p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-(--color-text-muted)" />
            </button>
          </li>
        ))}
      </ul>

      <BottomTabBar />
    </div>
  )
}
