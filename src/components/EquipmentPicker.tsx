import { EQUIPMENT_OPTIONS } from '../types/goals.ts'

interface EquipmentPickerProps {
  value: Set<string>
  onToggle: (id: string) => void
}

/** Grade de toggles de equipamento disponível — usada tanto no onboarding (inline) quanto
 * na tela dedicada de equipamento (`EquipmentScreen`), pra não duplicar a lista/estilo. */
export default function EquipmentPicker({ value, onToggle }: EquipmentPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {EQUIPMENT_OPTIONS.map((eq) => (
        <button
          type="button"
          key={eq.id}
          onClick={() => onToggle(eq.id)}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            value.has(eq.id)
              ? 'border-(--color-primary) bg-(--color-primary)/15 text-(--color-primary)'
              : 'border-(--color-border) bg-(--color-surface) text-(--color-text-muted) hover:bg-(--color-surface-raised)'
          }`}
        >
          {eq.label}
        </button>
      ))}
    </div>
  )
}
