import { useState } from 'react'
import { Info } from 'lucide-react'
import {
  EQUIPMENT_OPTIONS,
  LEVEL_LABELS,
  OBJECTIVE_DESCRIPTIONS,
  OBJECTIVE_LABELS,
  type ExperienceLevel,
  type Objective,
  type UserGoals,
} from '../types/goals.ts'
import { saveGoals } from '../lib/goals.ts'

const OBJECTIVES = Object.keys(OBJECTIVE_LABELS) as Objective[]
const LEVELS = Object.keys(LEVEL_LABELS) as ExperienceLevel[]

interface GoalsFormProps {
  initial: UserGoals | null
  submitLabel: string
  onSaved: () => void
}

export default function GoalsForm({ initial, submitLabel, onSaved }: GoalsFormProps) {
  const [objective, setObjective] = useState<Objective>(initial?.objective ?? 'hipertrofia')
  const [level, setLevel] = useState<ExperienceLevel>(initial?.level ?? 'iniciante')
  const [daysPerWeek, setDaysPerWeek] = useState(initial?.daysPerWeek ?? 3)
  const [equipment, setEquipment] = useState<Set<string>>(
    new Set(initial?.equipment ?? ['barbell', 'dumbbell', 'machine', 'cable', 'body only']),
  )
  const [limitations, setLimitations] = useState(initial?.limitations ?? '')
  const [saving, setSaving] = useState(false)
  const [infoOpen, setInfoOpen] = useState<Objective | null>(null)

  function toggleEquipment(id: string) {
    setEquipment((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await saveGoals({
      objective,
      level,
      daysPerWeek,
      equipment: [...equipment],
      limitations,
    })
    setSaving(false)
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">
          Qual seu objetivo principal?
        </h2>
        <div className="flex flex-col gap-2">
          {OBJECTIVES.map((o) => (
            <div key={o}>
              <div
                className={`flex items-center gap-1 rounded-xl border pr-2 transition-colors ${
                  objective === o
                    ? 'border-(--color-primary) bg-(--color-primary)/15 text-(--color-primary)'
                    : 'border-(--color-border) bg-(--color-surface) hover:bg-(--color-surface-raised)'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setObjective(o)}
                  className="flex-1 px-4 py-3 text-left font-medium"
                >
                  {OBJECTIVE_LABELS[o]}
                </button>
                <button
                  type="button"
                  onClick={() => setInfoOpen((cur) => (cur === o ? null : o))}
                  aria-label={`O que é ${OBJECTIVE_LABELS[o]}?`}
                  aria-expanded={infoOpen === o}
                  className="shrink-0 rounded-full p-1.5 text-(--color-text-muted) hover:bg-(--color-surface-raised) hover:text-(--color-text)"
                >
                  <Info size={18} />
                </button>
              </div>
              {infoOpen === o && (
                <p className="mt-1.5 rounded-lg bg-(--color-surface-raised) p-3 text-sm text-(--color-text-muted)">
                  {OBJECTIVE_DESCRIPTIONS[o]}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">
          Nível de experiência
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((l) => (
            <button
              type="button"
              key={l}
              onClick={() => setLevel(l)}
              className={`rounded-xl border py-3 text-center font-medium transition-colors ${
                level === l
                  ? 'border-(--color-primary) bg-(--color-primary)/15 text-(--color-primary)'
                  : 'border-(--color-border) bg-(--color-surface) hover:bg-(--color-surface-raised)'
              }`}
            >
              {LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">
          Dias de treino por semana: <span className="text-(--color-text)">{daysPerWeek}</span>
        </h2>
        <input
          type="range"
          min={1}
          max={7}
          value={daysPerWeek}
          onChange={(e) => setDaysPerWeek(Number(e.target.value))}
          className="w-full accent-(--color-primary)"
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">
          Equipamentos disponíveis
        </h2>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_OPTIONS.map((eq) => (
            <button
              type="button"
              key={eq.id}
              onClick={() => toggleEquipment(eq.id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                equipment.has(eq.id)
                  ? 'border-(--color-primary) bg-(--color-primary)/15 text-(--color-primary)'
                  : 'border-(--color-border) bg-(--color-surface) text-(--color-text-muted) hover:bg-(--color-surface-raised)'
              }`}
            >
              {eq.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">
          Limitações ou lesões (opcional)
        </h2>
        <textarea
          value={limitations}
          onChange={(e) => setLimitations(e.target.value)}
          placeholder="Ex.: dor no ombro direito, evitar agachamento profundo..."
          rows={3}
          className="w-full resize-none rounded-xl border border-(--color-border) bg-(--color-surface) p-3 text-sm outline-none focus:border-(--color-primary)"
        />
      </section>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-(--color-primary) py-4 text-center text-lg font-bold text-white disabled:opacity-60"
      >
        {saving ? 'Salvando...' : submitLabel}
      </button>
    </form>
  )
}
