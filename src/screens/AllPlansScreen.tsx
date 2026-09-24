import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus } from 'lucide-react'
import { listPlans, activatePlan, archivePlan } from '../lib/plans.ts'
import type { WorkoutPlan } from '../types/coach.ts'

export default function AllPlansScreen() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<WorkoutPlan[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  function reload() {
    listPlans().then(setPlans)
  }

  useEffect(reload, [])

  async function handleActivate(id: string) {
    setBusyId(id)
    try {
      await activatePlan(id)
      reload()
    } finally {
      setBusyId(null)
    }
  }

  async function handleArchive(id: string) {
    setBusyId(id)
    try {
      await archivePlan(id)
      reload()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col px-5 pb-10 pt-6">
      <header className="mb-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            aria-label="Voltar"
            className="rounded-full p-2 text-(--color-text-muted) hover:bg-(--color-surface-raised)"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-lg font-bold">Meus planos</h1>
        </div>
        <button
          onClick={() => navigate('/planos/novo')}
          className="flex items-center gap-1 text-sm font-semibold text-(--color-primary)"
        >
          <Plus size={16} /> Criar
        </button>
      </header>

      {plans === null && <p className="text-sm text-(--color-text-muted)">Carregando...</p>}

      {plans?.length === 0 && (
        <p className="rounded-xl border border-dashed border-(--color-border) p-6 text-center text-sm text-(--color-text-muted)">
          Nenhum plano ainda. Crie um pra organizar suas semanas de treino.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {plans?.map((plan) => {
          const isActive = plan.status === 'active'
          return (
            <div
              key={plan.id}
              className={`rounded-2xl border p-4 ${
                isActive ? 'border-(--color-primary)' : 'border-(--color-border) opacity-80'
              }`}
            >
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  isActive
                    ? 'bg-(--color-primary)/15 text-(--color-primary)'
                    : 'bg-(--color-surface-raised) text-(--color-text-muted)'
                }`}
              >
                {isActive ? 'Ativo' : 'Arquivado'}
              </span>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{plan.name}</p>
                  <p className="text-xs text-(--color-text-muted)">
                    {plan.routines.length} rotina{plan.routines.length !== 1 ? 's' : ''}
                    {plan.durationWeeks ? ` · ${plan.durationWeeks} semanas` : ''}
                    {plan.deload ? ' · deload' : ''}
                    {plan.linearPeriodization ? ' · periodização' : ''}
                  </p>
                </div>
                {!isActive ? (
                  <button
                    onClick={() => handleActivate(plan.id)}
                    disabled={busyId === plan.id}
                    className="shrink-0 rounded-full bg-(--color-primary)/10 px-3.5 py-2 text-xs font-semibold text-(--color-primary) disabled:opacity-60"
                  >
                    {busyId === plan.id ? '...' : 'Reativar'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleArchive(plan.id)}
                    disabled={busyId === plan.id}
                    className="shrink-0 rounded-full bg-(--color-surface-raised) px-3.5 py-2 text-xs font-semibold text-(--color-text-muted) disabled:opacity-60"
                  >
                    {busyId === plan.id ? '...' : 'Arquivar'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {plans && plans.length > 0 && (
        <p className="mt-5 text-xs leading-relaxed text-(--color-text-muted)">
          Reativar um plano arquivado arquiva automaticamente o que estava ativo — só um por
          vez, mas nada se perde.
        </p>
      )}
    </div>
  )
}
