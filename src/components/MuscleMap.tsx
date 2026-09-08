import { MUSCLE_LABELS_PT, type MuscleId } from '../types/muscle'

type Region =
  | { muscle: MuscleId; shape: 'rect'; x: number; y: number; w: number; h: number; rx: number }
  | { muscle: MuscleId; shape: 'ellipse'; cx: number; cy: number; rx: number; ry: number }

const HEAD = { cx: 100, cy: 26, rx: 15, ry: 17 }
const FEET = [
  { cx: 84, cy: 342, rx: 9, ry: 7 },
  { cx: 116, cy: 342, rx: 9, ry: 7 },
]

const FRONT_REGIONS: Region[] = [
  { muscle: 'neck', shape: 'rect', x: 90, y: 42, w: 20, h: 14, rx: 5 },
  { muscle: 'traps', shape: 'rect', x: 72, y: 54, w: 18, h: 14, rx: 4 },
  { muscle: 'traps', shape: 'rect', x: 110, y: 54, w: 18, h: 14, rx: 4 },
  { muscle: 'shoulders', shape: 'ellipse', cx: 61, cy: 80, rx: 15, ry: 19 },
  { muscle: 'shoulders', shape: 'ellipse', cx: 139, cy: 80, rx: 15, ry: 19 },
  { muscle: 'chest', shape: 'rect', x: 76, y: 62, w: 48, h: 38, rx: 12 },
  { muscle: 'biceps', shape: 'ellipse', cx: 51, cy: 118, rx: 11, ry: 28 },
  { muscle: 'biceps', shape: 'ellipse', cx: 149, cy: 118, rx: 11, ry: 28 },
  { muscle: 'forearms', shape: 'ellipse', cx: 45, cy: 168, rx: 9, ry: 26 },
  { muscle: 'forearms', shape: 'ellipse', cx: 155, cy: 168, rx: 9, ry: 26 },
  { muscle: 'abs', shape: 'rect', x: 82, y: 104, w: 36, h: 58, rx: 8 },
  { muscle: 'obliques', shape: 'rect', x: 68, y: 108, w: 13, h: 50, rx: 6 },
  { muscle: 'obliques', shape: 'rect', x: 119, y: 108, w: 13, h: 50, rx: 6 },
  { muscle: 'adductors', shape: 'rect', x: 94, y: 168, w: 12, h: 66, rx: 6 },
  { muscle: 'quads', shape: 'rect', x: 66, y: 166, w: 30, h: 92, rx: 14 },
  { muscle: 'quads', shape: 'rect', x: 104, y: 166, w: 30, h: 92, rx: 14 },
  { muscle: 'calves', shape: 'ellipse', cx: 82, cy: 300, rx: 14, ry: 34 },
  { muscle: 'calves', shape: 'ellipse', cx: 118, cy: 300, rx: 14, ry: 34 },
]

const BACK_REGIONS: Region[] = [
  { muscle: 'neck', shape: 'rect', x: 90, y: 42, w: 20, h: 14, rx: 5 },
  { muscle: 'traps', shape: 'rect', x: 74, y: 52, w: 52, h: 30, rx: 10 },
  { muscle: 'rear_delts', shape: 'ellipse', cx: 61, cy: 80, rx: 15, ry: 19 },
  { muscle: 'rear_delts', shape: 'ellipse', cx: 139, cy: 80, rx: 15, ry: 19 },
  { muscle: 'triceps', shape: 'ellipse', cx: 51, cy: 118, rx: 11, ry: 28 },
  { muscle: 'triceps', shape: 'ellipse', cx: 149, cy: 118, rx: 11, ry: 28 },
  { muscle: 'forearms', shape: 'ellipse', cx: 45, cy: 168, rx: 9, ry: 26 },
  { muscle: 'forearms', shape: 'ellipse', cx: 155, cy: 168, rx: 9, ry: 26 },
  { muscle: 'lats', shape: 'rect', x: 68, y: 88, w: 20, h: 58, rx: 10 },
  { muscle: 'lats', shape: 'rect', x: 112, y: 88, w: 20, h: 58, rx: 10 },
  { muscle: 'upper_back', shape: 'rect', x: 86, y: 92, w: 28, h: 44, rx: 8 },
  { muscle: 'lower_back', shape: 'rect', x: 82, y: 140, w: 36, h: 26, rx: 8 },
  { muscle: 'glutes', shape: 'ellipse', cx: 84, cy: 182, rx: 20, ry: 20 },
  { muscle: 'glutes', shape: 'ellipse', cx: 116, cy: 182, rx: 20, ry: 20 },
  { muscle: 'abductors', shape: 'rect', x: 58, y: 200, w: 12, h: 52, rx: 6 },
  { muscle: 'abductors', shape: 'rect', x: 130, y: 200, w: 12, h: 52, rx: 6 },
  { muscle: 'hamstrings', shape: 'rect', x: 66, y: 202, w: 30, h: 62, rx: 14 },
  { muscle: 'hamstrings', shape: 'rect', x: 104, y: 202, w: 30, h: 62, rx: 14 },
  { muscle: 'calves', shape: 'ellipse', cx: 82, cy: 300, rx: 14, ry: 34 },
  { muscle: 'calves', shape: 'ellipse', cx: 118, cy: 300, rx: 14, ry: 34 },
]

const TORSO_OUTLINE = 'M62,58 Q60,110 62,164 L138,164 Q140,110 138,58 Q100,44 62,58 Z'

export type MuscleHeat = 'primary' | 'secondary' | 'none'

interface MuscleMapProps {
  heat: Partial<Record<MuscleId, MuscleHeat>>
  intensity: Partial<Record<MuscleId, number>>
}

function colorFor(heat: MuscleHeat | undefined, intensity: number): string {
  if (heat === 'primary') {
    // vermelho intenso, mais opaco quanto maior o volume relativo
    const alpha = 0.55 + intensity * 0.45
    return `rgba(255, 45, 48, ${alpha.toFixed(2)})`
  }
  if (heat === 'secondary') {
    const alpha = 0.5 + intensity * 0.4
    return `rgba(255, 176, 32, ${alpha.toFixed(2)})`
  }
  return 'var(--color-cold)'
}

function Figure({
  regions,
  heat,
  intensity,
  title,
}: {
  regions: Region[]
  heat: Partial<Record<MuscleId, MuscleHeat>>
  intensity: Partial<Record<MuscleId, number>>
  title: string
}) {
  return (
    <svg viewBox="0 0 200 360" className="h-full w-full" role="img" aria-label={title}>
      <path d={TORSO_OUTLINE} fill="var(--color-surface-raised)" opacity={0.5} />
      {regions.map((r, i) => {
        const fill = colorFor(heat[r.muscle], intensity[r.muscle] ?? 0)
        const label = MUSCLE_LABELS_PT[r.muscle]
        if (r.shape === 'rect') {
          return (
            <rect
              key={`${r.muscle}-${i}`}
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              rx={r.rx}
              fill={fill}
              stroke="var(--color-bg)"
              strokeWidth={1.5}
            >
              <title>{label}</title>
            </rect>
          )
        }
        return (
          <ellipse
            key={`${r.muscle}-${i}`}
            cx={r.cx}
            cy={r.cy}
            rx={r.rx}
            ry={r.ry}
            fill={fill}
            stroke="var(--color-bg)"
            strokeWidth={1.5}
          >
            <title>{label}</title>
          </ellipse>
        )
      })}
      <ellipse cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry} fill="var(--color-cold)" />
      {FEET.map((f, i) => (
        <ellipse key={i} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} fill="var(--color-cold)" />
      ))}
    </svg>
  )
}

/** Mapa muscular anatômico (frente/verso) com heatmap: vermelho = primário, laranja = secundário. */
export default function MuscleMap({ heat, intensity }: MuscleMapProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex flex-col items-center gap-1">
        <Figure regions={FRONT_REGIONS} heat={heat} intensity={intensity} title="Vista frontal" />
        <span className="text-xs text-(--color-text-muted)">Frente</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Figure regions={BACK_REGIONS} heat={heat} intensity={intensity} title="Vista posterior" />
        <span className="text-xs text-(--color-text-muted)">Costas</span>
      </div>
    </div>
  )
}
