import { useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, Send, Sparkles, X } from 'lucide-react'
import {
  approvePlan,
  dismissPlan,
  listCoachMessages,
  sendCoachMessage,
} from '../lib/coach.ts'
import { getExercise } from '../lib/exercises.ts'
import type { CoachMessage, WorkoutPlan } from '../types/coach.ts'
import BottomTabBar from '../components/BottomTabBar'

const MAX_IMAGES = 4
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function MessageImages({ images }: { images: string[] }) {
  if (images.length === 0) return null
  return (
    <div className="mb-2 grid grid-cols-2 gap-1.5">
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt="Anexo enviado ao coach"
          className="h-28 w-full rounded-lg object-cover"
        />
      ))}
    </div>
  )
}

function PlanCard({
  plan,
  onApprove,
  onDismiss,
}: {
  plan: WorkoutPlan
  onApprove: () => Promise<void>
  onDismiss: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)

  async function handle(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-(--color-secondary)/40 bg-(--color-secondary)/5 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-(--color-secondary)">
        <Sparkles size={15} /> {plan.name}
      </p>
      {plan.durationWeeks && (
        <p className="mt-0.5 text-xs text-(--color-text-muted)">
          Manter por ~{plan.durationWeeks} semana{plan.durationWeeks > 1 ? 's' : ''}
        </p>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {plan.routines.map((routine) => (
          <div key={routine.id} className="rounded-lg border border-(--color-border) bg-(--color-surface) p-3">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-(--color-text-muted)">
              Treino {routine.label}
            </p>
            <ul className="flex flex-col gap-1">
              {routine.exercises.map((pe) => {
                const exercise = getExercise(pe.exerciseId)
                return (
                  <li key={pe.id} className="text-sm">
                    <span className="font-medium">{exercise?.name ?? pe.exerciseId}</span>{' '}
                    <span className="text-(--color-text-muted)">
                      · {pe.sets}x{pe.repRangeMin}-{pe.repRangeMax} · desc. {pe.restSeconds}s
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      {plan.status === 'proposed' && (
        <div className="mt-3 flex gap-2">
          <button
            disabled={busy}
            onClick={() => handle(onApprove)}
            className="flex-1 rounded-lg bg-(--color-primary) py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Aprovar plano
          </button>
          <button
            disabled={busy}
            onClick={() => handle(onDismiss)}
            className="rounded-lg border border-(--color-border) px-3 py-2 text-sm text-(--color-text-muted)"
          >
            Dispensar
          </button>
        </div>
      )}
      {plan.status === 'active' && (
        <p className="mt-3 text-xs font-medium text-(--color-primary)">✓ Ativo no seu treino</p>
      )}
      {plan.status === 'archived' && (
        <p className="mt-3 text-xs text-(--color-text-muted)">Dispensado</p>
      )}
    </div>
  )
}

export default function CoachScreen() {
  const [messages, setMessages] = useState<CoachMessage[] | null>(null)
  const [input, setInput] = useState('')
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [imageError, setImageError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listCoachMessages().then(setMessages)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function handleFilesPicked(files: FileList | null) {
    if (!files || files.length === 0) return
    setImageError(null)
    const room = MAX_IMAGES - pendingImages.length
    const picked = Array.from(files).slice(0, room)
    if (files.length > room) {
      setImageError(`Só dá pra anexar até ${MAX_IMAGES} imagens por mensagem.`)
    }
    const tooBig = picked.filter((f) => f.size > MAX_IMAGE_BYTES)
    const okFiles = picked.filter((f) => f.size <= MAX_IMAGE_BYTES)
    if (tooBig.length > 0) {
      setImageError(`Imagem muito grande (máx. ${MAX_IMAGE_BYTES / 1024 / 1024}MB): ${tooBig.map((f) => f.name).join(', ')}`)
    }
    const dataUrls = await Promise.all(okFiles.map(readFileAsDataUrl))
    setPendingImages((prev) => [...prev, ...dataUrls])
  }

  function removePendingImage(index: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSend() {
    const content = input.trim()
    if ((!content && pendingImages.length === 0) || sending) return
    const images = pendingImages
    setInput('')
    setPendingImages([])
    setSending(true)
    setMessages((prev) => [
      ...(prev ?? []),
      {
        id: `tmp-${Date.now()}`,
        role: 'user',
        content,
        images,
        proposedPlanId: null,
        proposedPlan: null,
        createdAt: new Date().toISOString(),
      },
    ])
    try {
      const reply = await sendCoachMessage(content, images)
      setMessages((prev) => [...(prev ?? []), reply])
    } finally {
      setSending(false)
    }
  }

  function updatePlanStatus(messageId: string, status: WorkoutPlan['status']) {
    setMessages((prev) =>
      (prev ?? []).map((m) =>
        m.id === messageId && m.proposedPlan ? { ...m, proposedPlan: { ...m.proposedPlan, status } } : m,
      ),
    )
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col px-5 pb-40 pt-10">
      <header className="mb-4">
        <h1 className="text-xl font-bold leading-tight">Coach</h1>
        <p className="text-sm text-(--color-text-muted)">Converse sobre seus treinos e ajustes</p>
      </header>

      <div className="flex-1 overflow-y-auto">
        {messages === null && (
          <p className="text-center text-sm text-(--color-text-muted)">Carregando...</p>
        )}

        {messages?.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-(--color-border) p-10 text-center">
            <Sparkles size={28} className="text-(--color-text-muted)" />
            <p className="text-sm text-(--color-text-muted)">
              Conte pro coach como os treinos recentes foram, ou peça pra revisar sua progressão.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {messages?.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-(--color-primary) px-4 py-2.5 text-white'
                    : 'max-w-[90%] rounded-2xl rounded-bl-sm bg-(--color-surface) px-4 py-2.5'
                }
              >
                <MessageImages images={m.images} />
                {m.content && <p className="whitespace-pre-wrap text-sm">{m.content}</p>}
                {m.proposedPlan && (
                  <PlanCard
                    plan={m.proposedPlan}
                    onApprove={async () => {
                      await approvePlan(m.proposedPlan!.id)
                      updatePlanStatus(m.id, 'active')
                    }}
                    onDismiss={async () => {
                      await dismissPlan(m.proposedPlan!.id)
                      updatePlanStatus(m.id, 'archived')
                    }}
                  />
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-(--color-surface) px-4 py-2.5 text-sm text-(--color-text-muted)">
                Pensando...
              </div>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-lg border-t border-(--color-border) bg-(--color-bg) p-4">
        {imageError && <p className="mb-2 text-xs text-(--color-primary)">{imageError}</p>}
        {pendingImages.length > 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto">
            {pendingImages.map((src, i) => (
              <div key={i} className="relative shrink-0">
                <img src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
                <button
                  onClick={() => removePendingImage(i)}
                  aria-label="Remover imagem"
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-(--color-bg) p-0.5 text-(--color-text-muted) shadow"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              handleFilesPicked(e.target.files)
              e.target.value = ''
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={pendingImages.length >= MAX_IMAGES}
            aria-label="Anexar imagem"
            className="rounded-xl border border-(--color-border) p-3 text-(--color-text-muted) disabled:opacity-40"
          >
            <ImageIcon size={18} />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Escreva pro coach..."
            rows={1}
            className="max-h-32 flex-1 resize-none rounded-xl border border-(--color-border) bg-(--color-surface) px-3 py-2.5 text-sm outline-none focus:border-(--color-primary)"
          />
          <button
            onClick={handleSend}
            disabled={sending || (!input.trim() && pendingImages.length === 0)}
            aria-label="Enviar"
            className="rounded-xl bg-(--color-primary) p-3 text-white disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      <BottomTabBar />
    </div>
  )
}
