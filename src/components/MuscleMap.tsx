import Model, { type Muscle } from 'react-body-highlighter'
import type { MuscleId } from '../types/muscle'

export type MuscleHeat = 'primary' | 'secondary' | 'none'

interface MuscleMapProps {
  heat: Partial<Record<MuscleId, MuscleHeat>>
}

// Nosso MuscleId -> slug esperado pela react-body-highlighter. "lats" e "upper_back"
// caem os dois em "upper-back" porque a biblioteca não distingue dorsais de costas
// superior como regiões separadas no SVG.
const MUSCLE_TO_LIB: Partial<Record<MuscleId, Muscle>> = {
  neck: 'neck',
  traps: 'trapezius',
  shoulders: 'front-deltoids',
  rear_delts: 'back-deltoids',
  chest: 'chest',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearm',
  abs: 'abs',
  obliques: 'obliques',
  lats: 'upper-back',
  upper_back: 'upper-back',
  lower_back: 'lower-back',
  glutes: 'gluteal',
  quads: 'quadriceps',
  hamstrings: 'hamstring',
  adductors: 'adductor',
  abductors: 'abductors',
  calves: 'calves',
}

const SECONDARY_COLOR = '#ffb020'
const PRIMARY_COLOR = '#ff2d30'

function buildExerciseData(heat: Partial<Record<MuscleId, MuscleHeat>>) {
  const data: { name: string; muscles: Muscle[]; frequency: number }[] = []
  for (const key of Object.keys(heat) as MuscleId[]) {
    const level = heat[key]
    const libMuscle = MUSCLE_TO_LIB[key]
    if (!libMuscle || !level || level === 'none') continue
    // frequency é o índice+1 em highlightedColors: 1 = secundário (laranja), 2 = primário (vermelho).
    data.push({ name: key, muscles: [libMuscle], frequency: level === 'primary' ? 2 : 1 })
  }
  return data
}

/** Mapa muscular anatômico (frente/verso) com heatmap: vermelho = primário, laranja = secundário. */
export default function MuscleMap({ heat }: MuscleMapProps) {
  const data = buildExerciseData(heat)

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex flex-col items-center gap-1">
        <Model
          data={data}
          type="anterior"
          bodyColor="var(--color-cold)"
          highlightedColors={[SECONDARY_COLOR, PRIMARY_COLOR]}
          style={{ width: '100%', maxWidth: '11rem' }}
        />
        <span className="text-xs text-(--color-text-muted)">Frente</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <Model
          data={data}
          type="posterior"
          bodyColor="var(--color-cold)"
          highlightedColors={[SECONDARY_COLOR, PRIMARY_COLOR]}
          style={{ width: '100%', maxWidth: '11rem' }}
        />
        <span className="text-xs text-(--color-text-muted)">Costas</span>
      </div>
    </div>
  )
}
