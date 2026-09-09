import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Dumbbell } from 'lucide-react'
import { listSessions, type SessionListItem } from '../lib/session.ts'
import { SPLIT_LABELS_PT } from '../lib/routine.ts'

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

  useEffect(() => {
    listSessions().then(setSessions)
  }, [])

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col px-5 py-10">
      <header className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          aria-label="Voltar"
          className="rounded-full p-2 text-(--color-text-muted) hover:bg-(--color-surface-raised)"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-bold leading-tight">Histórico de treinos</h1>
      </header>

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
                  {SPLIT_LABELS_PT[s.split]} · {formatDate(s.startedAt)}
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
    </div>
  )
}
