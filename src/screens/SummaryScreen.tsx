import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, Clock, Copy, Dumbbell, ListChecks, Trophy } from 'lucide-react'
import { getSessionSummary, type SessionSummary } from '../lib/session'
import { getExercise } from '../lib/exercises'
import { buildWorkoutCopyText } from '../lib/copyWorkout.ts'
import MuscleMap, { type MuscleHeat } from '../components/MuscleMap'
import type { MuscleId } from '../types/muscle'

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
      <div className="text-(--color-primary)">{icon}</div>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-xs text-(--color-text-muted)">{label}</span>
    </div>
  )
}

export default function SummaryScreen() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    getSessionSummary(sessionId).then(setSummary)
  }, [sessionId])

  async function handleCopy() {
    if (!summary) return
    const text = buildWorkoutCopyText(summary.sets)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const { heat, intensity } = useMemo(() => {
    if (!summary) return { heat: {}, intensity: {} }

    const primary = new Set<MuscleId>()
    const secondary = new Set<MuscleId>()
    for (const exerciseId of summary.session.exerciseIds) {
      const exercise = getExercise(exerciseId)
      if (!exercise) continue
      primary.add(exercise.target)
      for (const m of exercise.secondaryMuscles) secondary.add(m)
    }

    const heat: Partial<Record<MuscleId, MuscleHeat>> = {}
    for (const m of secondary) heat[m] = 'secondary'
    for (const m of primary) heat[m] = 'primary' // primário tem precedência

    const maxVolume = Math.max(1, ...Object.values(summary.muscleLoad))
    const intensity: Partial<Record<MuscleId, number>> = {}
    for (const [m, vol] of Object.entries(summary.muscleLoad)) {
      intensity[m as MuscleId] = Math.min(1, (vol ?? 0) / maxVolume)
    }

    return { heat, intensity }
  }, [summary])

  if (!summary) {
    return (
      <div className="flex min-h-svh items-center justify-center text-(--color-text-muted)">
        Calculando resumo do treino...
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col px-5 pb-10 pt-10">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Treino concluído!</h1>
        <p className="text-sm text-(--color-text-muted)">Confira o resumo da sua sessão</p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Dumbbell size={20} />}
          label="Volume total"
          value={`${Math.round(summary.totalVolumeKg).toLocaleString('pt-BR')} kg`}
        />
        <StatCard icon={<Clock size={20} />} label="Duração" value={`${summary.durationMinutes} min`} />
        <StatCard
          icon={<ListChecks size={20} />}
          label="Séries / Exercícios"
          value={`${summary.totalSets} / ${summary.totalExercises}`}
        />
        <StatCard
          icon={<Trophy size={20} />}
          label="Recordes pessoais"
          value={`${summary.prsBroken.length}`}
        />
      </section>

      <button
        onClick={handleCopy}
        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-colors ${
          copied
            ? 'border-(--color-success) bg-(--color-success)/15 text-(--color-success)'
            : 'border-(--color-border) bg-(--color-surface) text-(--color-text) hover:bg-(--color-surface-raised)'
        }`}
      >
        {copied ? (
          <>
            <Check size={16} /> Copiado!
          </>
        ) : (
          <>
            <Copy size={16} /> Copiar treino
          </>
        )}
      </button>

      {summary.prsBroken.length > 0 && (
        <section className="mt-5 rounded-xl border border-(--color-secondary)/40 bg-(--color-secondary)/10 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-(--color-secondary)">
            <Trophy size={18} /> Recordes batidos nesta sessão
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {summary.prsBroken.map((pr) => (
              <li key={pr.exerciseId}>
                <strong>{pr.exerciseName}</strong> — {pr.weightKg}kg × {pr.reps} reps
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">
          Mapa muscular
        </h2>
        <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
          <MuscleMap heat={heat} intensity={intensity} />
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-(--color-text-muted)">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full" style={{ background: 'rgba(255,45,48,0.9)' }} />
              Primário
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full" style={{ background: 'rgba(255,176,32,0.8)' }} />
              Secundário
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-(--color-cold)" />
              Não trabalhado
            </span>
          </div>
        </div>
      </section>

      <button
        onClick={() => navigate('/')}
        className="mt-8 w-full rounded-xl bg-(--color-primary) py-4 text-center text-lg font-bold text-white"
      >
        Novo treino
      </button>
    </div>
  )
}
