import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import GoalsForm from '../components/GoalsForm.tsx'
import { getGoals } from '../lib/goals.ts'
import type { UserGoals } from '../types/goals.ts'

export default function GoalsScreen() {
  const navigate = useNavigate()
  const [goals, setGoals] = useState<UserGoals | null | undefined>(undefined)

  useEffect(() => {
    getGoals().then(setGoals)
  }, [])

  if (goals === undefined) {
    return (
      <div className="flex min-h-svh items-center justify-center text-(--color-text-muted)">
        Carregando...
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col px-5 py-10">
      <header className="mb-8 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          aria-label="Voltar"
          className="rounded-full p-2 text-(--color-text-muted) hover:bg-(--color-surface-raised)"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-bold leading-tight">Seus objetivos</h1>
      </header>

      <GoalsForm initial={goals} submitLabel="Salvar" onSaved={() => navigate('/')} />
    </div>
  )
}
