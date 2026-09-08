import { Cast, MonitorSmartphone, X } from 'lucide-react'

export default function CastModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-(--color-border) bg-(--color-surface) p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Cast size={20} /> Enviar para a TV
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-2 text-(--color-text-muted) hover:bg-(--color-surface-raised)"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4 text-sm">
          <div className="rounded-xl bg-(--color-surface-raised) p-4">
            <p className="mb-1 font-semibold">Android TV / Chromecast</p>
            <p className="text-(--color-text-muted)">
              No Chrome, toque no menu (⋮) e escolha <strong>Transmitir</strong>. Selecione sua
              TV/Chromecast na lista. A aba será espelhada na tela grande.
            </p>
          </div>
          <div className="rounded-xl bg-(--color-surface-raised) p-4">
            <p className="mb-1 font-semibold">Apple TV / Mac</p>
            <p className="text-(--color-text-muted)">
              Abra a Central de Controle (iPhone/iPad) ou a barra de menu (Mac) e toque em{' '}
              <strong>Espelhamento/AirPlay</strong>. Escolha sua Apple TV.
            </p>
          </div>
          <p className="flex items-start gap-2 text-xs text-(--color-text-muted)">
            <MonitorSmartphone size={16} className="mt-0.5 shrink-0" />
            Ative o <strong>Modo TV</strong> antes de espelhar para textos e contrastes maiores,
            legíveis à distância.
          </p>
        </div>
      </div>
    </div>
  )
}
