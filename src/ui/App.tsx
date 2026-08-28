import { useState } from 'react'
import type { SpeedSetting } from '../core/engine/Scheduler'
import type { StateKey } from '../core/types/rl'
import { GridSvg } from '../viz/grid/GridSvg'
import { PolicyOverlay } from '../viz/grid/PolicyOverlay'
import { ValueHeatmap } from '../viz/grid/ValueHeatmap'
import { PlaybackControls } from '../viz/controls/PlaybackControls'
import { SpeedControl } from '../viz/controls/SpeedControl'
import { InspectorPanel } from '../viz/panels/InspectorPanel'
import { QValueBars } from '../viz/panels/QValueBars'
import { StatsPanel } from '../viz/panels/StatsPanel'
import { RewardChart } from '../viz/panels/RewardChart'
import { EnvEditor } from '../viz/controls/EnvEditor'
import { engine } from './engine'
import { useSimulationEngine } from './hooks/useSimulationEngine'

const CELL_SIZE = 48

// No episode-count input exists yet (FR-22 is Post-MVP — ARCHITECTURE.md §11), so "Run"
// starts a long run that the user stops with Pause, per Phase 5 §16 Scenario A/E.
const RUN_EPISODES = 1000

function App() {
  const snapshot = useSimulationEngine(engine)

  // UI-only state below — none of it duplicates Engine-owned simulation state
  // (Phase 4 §6, Phase 5 §5/§11): selectedState is a UI selection, showPolicy/showValue
  // are overlay visibility toggles, and `speed` mirrors the last speed the user picked
  // purely for highlighting the active SpeedControl preset (EngineSnapshot has no speed
  // field to read back — see the Phase 5 report's "발견된 문제"). The actual execution
  // speed always lives in and is driven by engine.setSpeed()/Scheduler.
  const [selectedState, setSelectedState] = useState<StateKey | null>(null)
  const [showPolicy, setShowPolicy] = useState(false)
  const [showValue, setShowValue] = useState(false)
  const [speed, setSpeed] = useState<SpeedSetting>(() => engine.getSpeed())
  const [showEditor, setShowEditor] = useState(false)

  const handleSpeedChange = (next: SpeedSetting) => {
    engine.setSpeed(next)
    setSpeed(next)
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col items-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">RL Playground</h1>

      <div className="flex flex-col items-center gap-4 md:flex-row md:items-start md:justify-center">
        <div className="flex flex-col items-center gap-4">
          {snapshot.envRenderModel.kind === 'grid' ? (
            <div className="relative" data-testid="grid-stack">
              <GridSvg
                renderModel={snapshot.envRenderModel}
                cellSize={CELL_SIZE}
                selectedState={selectedState}
                onStateSelect={setSelectedState}
              />
              {showValue && (
                <ValueHeatmap
                  renderModel={snapshot.envRenderModel}
                  agentSnapshot={snapshot.agentSnapshot}
                  cellSize={CELL_SIZE}
                  className="absolute inset-0"
                />
              )}
              {showPolicy && (
                <PolicyOverlay
                  renderModel={snapshot.envRenderModel}
                  agentSnapshot={snapshot.agentSnapshot}
                  cellSize={CELL_SIZE}
                  className="absolute inset-0"
                />
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={showPolicy}
                onChange={(e) => setShowPolicy(e.target.checked)}
                data-testid="toggle-policy"
              />
              Policy
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={showValue}
                onChange={(e) => setShowValue(e.target.checked)}
                data-testid="toggle-value"
              />
              Value
            </label>
          </div>

          <PlaybackControls
            status={snapshot.status}
            onStep={() => engine.step()}
            onRun={() => engine.run({ episodes: RUN_EPISODES })}
            onRunEpisode={() => engine.runEpisode()}
            onPause={() => engine.pause()}
            onResume={() => engine.resume()}
            onReset={() => engine.reset()}
          />

          <SpeedControl speed={speed} onChange={handleSpeedChange} />

          <button
            type="button"
            onClick={() => setShowEditor((prev) => !prev)}
            data-testid="toggle-env-editor"
            className="rounded bg-purple-100 px-4 py-2 text-sm font-medium text-purple-800 hover:bg-purple-200"
          >
            {showEditor ? 'Hide Environment Editor' : 'Edit Environment'}
          </button>

          {showEditor && snapshot.envRenderModel.kind === 'grid' ? (
            <EnvEditor
              // Re-created (via key) whenever the editor is reopened, so a stale Draft
              // from a previous open never lingers — Draft always starts from whatever
              // the environment looks like right now.
              key={showEditor ? 'open' : 'closed'}
              currentRenderModel={snapshot.envRenderModel}
              onApply={(config) => {
                engine.reset({ envConfig: config })
                // Phase 10 §5 boundary audit: the previously selected State may not
                // exist in the new Grid (different size, or now off-grid) — clear it
                // rather than leaving QValueBars showing a stale/meaningless selection.
                setSelectedState(null)
              }}
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <InspectorPanel
            lastTransition={snapshot.lastTransition}
            lastActionSelection={snapshot.lastActionSelection}
            lastTdInfo={snapshot.lastTdInfo}
          />
          <QValueBars selectedState={selectedState} agentSnapshot={snapshot.agentSnapshot} />
          <StatsPanel episode={snapshot.episode} stats={snapshot.stats} />
          <RewardChart rewardHistory={snapshot.stats.rewardHistory} />
        </div>
      </div>
    </main>
  )
}

export default App
