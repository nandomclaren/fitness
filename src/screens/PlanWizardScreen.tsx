import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Flame, Layers, Plus, Sparkles, TrendingDown } from 'lucide-react'
import { createPlan } from '../lib/plans.ts'
import { getExercise } from '../lib/exercises.ts'
import { MUSCLE_LABELS_PT } from '../types/muscle.ts'
import type { WorkoutPlan } from '../types/coach.ts'

type Mode = 'rule' | 'ai'
type Step = 'mode' | 'config' | 'review'

const ROUTINE_COUNT_OPTIONS: { value: number; title: string; subtitle: string }[] = [
  { value: 1, title: '1 rotina', subtitle: 'Corpo inteiro toda vez' },
  { value: 2, title: '2 rotinas', subtitle: 'Superior / Inferior' },
  { value: 3, title: '3 rotinas', subtitle: 'Superior / Inferior / Completo' },
  { value: 4, title: '4 rotinas', subtitle: 'Superior / Inferior (x2)' },
]

const DURATION_OPTIONS = [4, 6, 8, 12]

export default function PlanWizardScreen() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('mode')
  const [mode, setMode] = useState<Mode | null>(null)
  const [numRoutines, setNumRoutines] = useState(3)
  const [durationWeeks, setDurationWeeks] = useState(4)
  const [deload, setDeload] = useState(false)
  const [linearPeriodization, setLinearPeriodization] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<WorkoutPlan | null>(null)

  function pickMode(m: Mode) {
    setMode(m)
    setStep('config')
  }

  async function handleGenerate() {
    if (!mode) return
    setLoading(true)
    setError(null)
    try {
      const created = await createPlan({ mode, numRoutines, durationWeeks, deload, linearPeriodization })
      setPlan(created)
      setStep('review')
    } catch {
      setError('Não foi possível criar o plano agora. Tenta de novo.')
    } finally {
      setLoading(false)
    }
  }

  function back() {
    if (step === 'config') setStep('mode')
    else navigate(-1)
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col px-5 pb-10 pt-6">
      <header className="mb-6 flex items-center gap-2">
        <button
          onClick={back}
          aria-label="Voltar"
          className="rounded-full p-2 text-(--color-text-muted) hover:bg-(--color-surface-raised)"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Novo plano</h1>
      </header>

      {step === 'mode' && (
        <div className="flex flex-col gap-3">
          <p className="mb-1 text-sm text-(--color-text-muted)">
            Como você quer montar as semanas de treino?
          </p>
          <button
            onClick={() => pickMode('ai')}
            className="flex items-center gap-3.5 rounded-2xl border border-(--color-border) bg-(--color-surface) p-4 text-left"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-(--color-secondary)/15">
              <Sparkles size={22} className="text-(--color-secondary)" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">Gerador de plano</span>
              <span className="block text-xs text-(--color-text-muted)">
                A IA monta as rotinas com base no seu objetivo e histórico.
              </span>
            </span>
          </button>
          <button
            onClick={() => pickMode('rule')}
            className="flex items-center gap-3.5 rounded-2xl border border-(--color-border) bg-(--color-surface) p-4 text-left"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-(--color-primary)/15">
              <Plus size={22} className="text-(--color-primary)" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">Plano vazio</span>
              <span className="block text-xs text-(--color-text-muted)">
                Rotina balanceada padrão (regra fixa ACSM/NSCA), sem depender da IA.
              </span>
            </span>
          </button>
        </div>
      )}

      {step === 'config' && (
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">
              Quantas rotinas diferentes?
            </h2>
            <div className="flex flex-col gap-2">
              {ROUTINE_COUNT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setNumRoutines(opt.value)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                    numRoutines === opt.value
                      ? 'border-(--color-primary) bg-(--color-primary)/15'
                      : 'border-(--color-border) bg-(--color-surface)'
                  }`}
                >
                  <span>
                    <span className="block font-semibold">{opt.title}</span>
                    <span className="block text-xs text-(--color-text-muted)">{opt.subtitle}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">
              Duração do bloco
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {DURATION_OPTIONS.map((w) => (
                <button
                  key={w}
                  onClick={() => setDurationWeeks(w)}
                  className={`rounded-xl border py-3 text-center font-semibold transition-colors ${
                    durationWeeks === w
                      ? 'border-(--color-primary) bg-(--color-primary)/15 text-(--color-primary)'
                      : 'border-(--color-border) bg-(--color-surface) text-(--color-text)'
                  }`}
                >
                  {w}s
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">
              Opcional
            </h2>
            <label className="flex items-start gap-3 rounded-xl border border-(--color-border) bg-(--color-surface) p-3.5">
              <input
                type="checkbox"
                checked={deload}
                onChange={(e) => setDeload(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-(--color-primary)"
              />
              <span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <TrendingDown size={15} className="text-(--color-secondary)" /> Deload periódico
                </span>
                <span className="mt-0.5 block text-xs text-(--color-text-muted)">
                  A cada 4 semanas, reduz série e mira num RIR mais alto de propósito, pra recuperar.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-(--color-border) bg-(--color-surface) p-3.5">
              <input
                type="checkbox"
                checked={linearPeriodization}
                onChange={(e) => setLinearPeriodization(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-(--color-primary)"
              />
              <span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Layers size={15} className="text-(--color-secondary)" /> Periodização linear
                </span>
                <span className="mt-0.5 block text-xs text-(--color-text-muted)">
                  A faixa de reps desliza da semana 1 (mais reps) até o fim do bloco (menos reps).
                </span>
              </span>
            </label>
          </section>

          {error && <p className="text-sm text-(--color-primary)">{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full rounded-xl bg-(--color-primary) py-4 text-center text-lg font-bold text-white disabled:opacity-60"
          >
            {loading ? 'Montando...' : mode === 'ai' ? 'Gerar com IA' : 'Criar plano'}
          </button>
        </div>
      )}

      {step === 'review' && plan && (
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-(--color-success)/40 bg-(--color-success)/10 p-4">
            <p className="flex items-center gap-2 font-semibold text-(--color-success)">
              <Flame size={18} /> Plano ativado
            </p>
            <p className="mt-1 text-sm text-(--color-text)">{plan.name}</p>
            <p className="mt-1 text-xs text-(--color-text-muted)">{plan.rationale}</p>
          </div>

          {plan.routines.map((r) => (
            <div key={r.id} className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
              <p className="mb-2 font-semibold">{r.label}</p>
              {r.rationale && (
                <p className="mb-3 text-xs leading-relaxed text-(--color-text-muted)">{r.rationale}</p>
              )}
              <ul className="flex flex-col gap-1.5 text-sm text-(--color-text-muted)">
                {r.exercises.map((pe) => {
                  const exercise = getExercise(pe.exerciseId)
                  return (
                    <li key={pe.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{exercise?.name ?? pe.exerciseId}</span>
                      <span className="shrink-0">
                        {pe.sets}x{pe.repRangeMin}-{pe.repRangeMax}
                        {exercise && (
                          <span className="ml-1.5 text-(--color-text-muted)/70">
                            · {MUSCLE_LABELS_PT[exercise.target]}
                          </span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full rounded-xl bg-(--color-primary) py-4 text-center text-lg font-bold text-white"
          >
            Ir para a Home
          </button>
        </div>
      )}
    </div>
  )
}
