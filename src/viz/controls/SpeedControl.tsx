// Presentational speed selector. Does NOT touch Engine's Scheduler directly — it only
// reports the user's choice via onChange as a real `SpeedSetting` value (the type
// actually defined in src/core/engine/Scheduler.ts, not a value system invented here).
// The caller (App.tsx) is the one that calls engine.setSpeed(...).

import type { SpeedSetting } from '../../core/engine/Scheduler'

export interface SpeedControlProps {
  speed: SpeedSetting
  onChange: (speed: SpeedSetting) => void
}

interface SpeedPreset {
  label: string
  testId: string
  speed: SpeedSetting
}

// Each preset is a concrete SpeedSetting value straight from Scheduler's own union —
// "interval" (steps paced by a delay, for slow/eyeball-following speeds) or "batch"
// (many steps per animation frame, for fast/bulk training), matching ARCHITECTURE.md
// §5.4's two modes exactly.
const SPEED_PRESETS: SpeedPreset[] = [
  { label: 'Slow', testId: 'speed-slow', speed: { mode: 'interval', intervalMs: 500 } },
  { label: 'Normal', testId: 'speed-normal', speed: { mode: 'interval', intervalMs: 150 } },
  { label: 'Fast', testId: 'speed-fast', speed: { mode: 'batch', stepsPerFrame: 10 } },
  { label: 'Very Fast', testId: 'speed-very-fast', speed: { mode: 'batch', stepsPerFrame: 100 } },
]

function isSameSpeed(a: SpeedSetting, b: SpeedSetting): boolean {
  if (a.mode === 'interval' && b.mode === 'interval') return a.intervalMs === b.intervalMs
  if (a.mode === 'batch' && b.mode === 'batch') return a.stepsPerFrame === b.stepsPerFrame
  return false
}

export function SpeedControl({ speed, onChange }: SpeedControlProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="speed-control">
      <span className="text-sm text-gray-600">Speed:</span>
      {SPEED_PRESETS.map((preset) => {
        const active = isSameSpeed(speed, preset.speed)
        return (
          <button
            key={preset.label}
            type="button"
            aria-pressed={active}
            data-testid={preset.testId}
            onClick={() => onChange(preset.speed)}
            className={`rounded px-3 py-1 text-sm font-medium ${
              active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            {preset.label}
          </button>
        )
      })}
    </div>
  )
}
