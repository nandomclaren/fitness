import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { getGoals, saveGoals } from '../lib/goals.ts'
import type { UserGoals } from '../types/goals.ts'
import EquipmentPicker from '../components/EquipmentPicker.tsx'

/**
 * Tela dedicada de equipamento — editável a qualquer momento fora do onboarding (gap do
 * roadmap: "hoje só existe dentro do onboarding"). `PUT /goals` exige o objeto de goals
 * inteiro (não é um PATCH parcial), então essa tela busca o registro atual e reenvia tudo
 * de volta trocando só o campo `equipment`.
 */
export default function EquipmentScreen() {
  const navigate = useNavigate()
  const [goals, setGoals] = useState<UserGoals | null | undefined>(undefined)
  const [equipment, setEquipment] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getGoals().then((g) => {
      setGoals(g)
      setEquipment(new Set(g?.equipment ?? []))
    })
  }, [])

  function toggleEquipment(id: string) {
    setEquipment((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave() {
    if (!goals) return
    setSaving(true)
    await saveGoals({
      objective: goals.objective,
      level: goals.level,
      daysPerWeek: goals.daysPerWeek,
      limitations: goals.limitations,
      equipment: [...equipment],
    })
    setSaving(false)
    navigate(-1)
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col px-5 pb-10 pt-6">
      <header className="mb-6 flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="rounded-full p-2 text-(--color-text-muted) hover:bg-(--color-surface-raised)"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Equipamento</h1>
      </header>

      {goals === undefined && <p className="text-sm text-(--color-text-muted)">Carregando...</p>}

      {goals === null && (
        <p className="rounded-xl border border-dashed border-(--color-border) p-6 text-center text-sm text-(--color-text-muted)">
          Complete o onboarding primeiro pra poder editar o equipamento depois.
        </p>
      )}

      {goals && (
        <>
          <p className="mb-4 text-sm text-(--color-text-muted)">
            Marque o que você tem disponível — usado tanto pra montar suas rotinas quanto
            pra decidir quais exercícios sugerir.
          </p>
          <EquipmentPicker value={equipment} onToggle={toggleEquipment} />

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-8 w-full rounded-xl bg-(--color-primary) py-4 text-center text-lg font-bold text-white disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      )}
    </div>
  )
}
