import { useNavigate } from 'react-router-dom'
import { Dumbbell } from 'lucide-react'
import GoalsForm from '../components/GoalsForm.tsx'

export default function OnboardingScreen() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col px-5 py-10">
      <header className="mb-8 flex items-center gap-3">
        <div className="rounded-xl bg-(--color-primary) p-2.5">
          <Dumbbell size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight">Bem-vindo!</h1>
          <p className="text-sm text-(--color-text-muted)">
            Conte seus objetivos pra IA montar treinos sob medida
          </p>
        </div>
      </header>

      <GoalsForm initial={null} submitLabel="Começar" onSaved={() => navigate('/')} />
    </div>
  )
}
