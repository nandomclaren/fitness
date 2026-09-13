import { useEffect, useRef } from 'react'

const ITEM_HEIGHT = 44
const VISIBLE_ITEMS = 3

interface WheelPickerProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  formatValue?: (value: number) => string
  ariaLabel: string
}

/**
 * Seletor tipo "roleta" (como o picker de data do iOS): rola e encaixa no valor mais
 * próximo do centro, em vez de digitar num teclado — mais rápido de usar no meio do
 * treino, com o celular na mão/suor, do que abrir teclado numérico pra cada série.
 */
export default function WheelPicker({
  value,
  onChange,
  min,
  max,
  step,
  formatValue,
  ariaLabel,
}: WheelPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isProgrammatic = useRef(false)
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const count = Math.round((max - min) / step) + 1
  const values = Array.from({ length: count }, (_, i) => Math.round((min + i * step) * 1000) / 1000)

  function indexFor(v: number): number {
    const idx = Math.round((v - min) / step)
    return Math.max(0, Math.min(count - 1, idx))
  }

  // Sincroniza a posição de scroll quando `value` muda de fora (troca de exercício,
  // sugestão de carga baseada no histórico) — sem isso a roleta fica desalinhada.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const targetTop = indexFor(value) * ITEM_HEIGHT
    if (Math.abs(el.scrollTop - targetTop) > 1) {
      isProgrammatic.current = true
      el.scrollTop = targetTop
      requestAnimationFrame(() => {
        isProgrammatic.current = false
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, min, max, step])

  function commitFromScroll() {
    const el = containerRef.current
    if (!el) return
    const idx = Math.max(0, Math.min(count - 1, Math.round(el.scrollTop / ITEM_HEIGHT)))
    const newValue = values[idx]
    if (Math.abs(newValue - value) > step / 2) onChange(newValue)
  }

  function handleScroll() {
    if (isProgrammatic.current) return
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
    // Só confirma o valor depois que o scroll parar de verdade (o snap do CSS ainda
    // está terminando de animar durante o evento de scroll).
    scrollTimeout.current = setTimeout(commitFromScroll, 120)
  }

  function handleItemClick(v: number) {
    const el = containerRef.current
    if (el) el.scrollTo({ top: indexFor(v) * ITEM_HEIGHT, behavior: 'smooth' })
    onChange(v)
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      role="listbox"
      aria-label={ariaLabel}
      className="relative overflow-y-scroll rounded-lg border border-(--color-border) bg-(--color-surface) [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS, scrollSnapType: 'y mandatory' }}
    >
      <div style={{ height: ITEM_HEIGHT }} aria-hidden />
      {values.map((v, i) => (
        <div
          key={i}
          role="option"
          aria-selected={Math.abs(v - value) <= step / 2}
          onClick={() => handleItemClick(v)}
          className={`flex items-center justify-center text-lg font-semibold tabular-nums transition-colors ${
            Math.abs(v - value) <= step / 2 ? 'text-(--color-text)' : 'text-(--color-text-muted)'
          }`}
          style={{ height: ITEM_HEIGHT, scrollSnapAlign: 'center' }}
        >
          {formatValue ? formatValue(v) : v}
        </div>
      ))}
      <div style={{ height: ITEM_HEIGHT }} aria-hidden />

      {/* Faixa central destacada — só decorativa, não captura clique */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 border-y border-(--color-primary)/50"
        style={{ height: ITEM_HEIGHT }}
        aria-hidden
      />
    </div>
  )
}
