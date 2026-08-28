import { useState } from 'react'
import type { SpeedSetting } from '../core/engine/Scheduler'
import type { StateKey } from '../core/types/rl'
import { GridSvg } from '../viz/grid/GridSvg'
import { PolicyOverlay } from '../viz/grid/PolicyOverlay'
import { ValueHeatmap } from '../viz/grid/ValueHeatmap'
import { TrajectoryOverlay } from '../viz/grid/TrajectoryOverlay'
import { PlaybackControls } from '../viz/controls/PlaybackControls'
import { SpeedControl } from '../viz/controls/SpeedControl'
import { AlgorithmSelector } from '../viz/controls/AlgorithmSelector'
import { EpsilonControl } from '../viz/controls/EpsilonControl'
import { AlphaControl } from '../viz/controls/AlphaControl'
import { GammaControl } from '../viz/controls/GammaControl'
import { LanguageSelector } from '../viz/controls/LanguageSelector'
import { InspectorPanel } from '../viz/panels/InspectorPanel'
import { QValueBars } from '../viz/panels/QValueBars'
import { StatsPanel } from '../viz/panels/StatsPanel'
import { RewardChart } from '../viz/panels/RewardChart'
import { LearningProgress } from '../viz/panels/LearningProgress'
import { EpisodeTrajectory } from '../viz/panels/EpisodeTrajectory'
import { EnvEditor } from '../viz/controls/EnvEditor'
import { engine } from './engine'
import { useSimulationEngine } from './hooks/useSimulationEngine'
import { translations, type Locale } from './i18n'

const CELL_SIZE = 48

function App() {
  const snapshot = useSimulationEngine(engine)

  // UI-only state below — none of it duplicates Engine-owned simulation state
  // (Phase 4 §6, Phase 5 §5/§11): selectedState is a UI selection, showPolicy/showValue
  // are overlay visibility toggles, and `speed` mirrors the last speed the user picked
  // purely for highlighting the active SpeedControl preset (EngineSnapshot has no speed
  // field to read back — see the Phase 5 report's "발견된 문제"). The actual execution
  // speed always lives in and is driven by engine.setSpeed()/Scheduler.
  const [selectedState, setSelectedState] = useState<StateKey | null>(null)
  // Phase 24: which Episode History row is selected, by real Episode number (not array
  // index — see StatsPanel.tsx's Phase 24 comment on why). Cleared explicitly on every
  // path that resets Episode numbering back to 0 (plain Reset, Algorithm switch,
  // Environment Editor Apply) — without this, a later Episode reusing the same number
  // (e.g. Episode 3 again after a fresh reset) would silently "resurrect" a stale
  // selection the user never asked for. History-overflow eviction (the 200-entry cap)
  // does NOT need explicit handling here: Episode numbers only ever increase within one
  // experiment, so an evicted Episode's number can never recur, and StatsPanel's
  // `episodeStatsHistory.find()` already degrades to "no selection" (null) safely.
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null)
  const [showPolicy, setShowPolicy] = useState(false)
  const [showValue, setShowValue] = useState(false)
  const [speed, setSpeed] = useState<SpeedSetting>(() => engine.getSpeed())
  const [showEditor, setShowEditor] = useState(false)
  // Phase 15: how many episodes "Run Episode" runs — pure UI state, never written into
  // Engine/Core. Once engine.run({ episodes: episodeCount }) is called, the Engine's own
  // remainingEpisodes takes over as the sole source of truth for the in-flight run;
  // changing this state afterward (impossible anyway while RUNNING/PAUSED — the input is
  // disabled) can never retroactively affect it.
  const [episodeCount, setEpisodeCount] = useState(1)
  // Phase 13: locale is pure UI state, entirely separate from the Engine — it never
  // reads from or writes to `engine`, so changing it can never reset/affect Episode,
  // Q-table, Environment, or reward history (no localStorage either, per Phase 13 §6).
  const [locale, setLocale] = useState<Locale>('en')
  const t = translations[locale]

  const handleSpeedChange = (next: SpeedSetting) => {
    engine.setSpeed(next)
    setSpeed(next)
  }

  // Phase 19 §7: Wall cells are not a real State (the agent can never occupy one — see
  // GridWorldEnv.step()'s wall branch, which always keeps `next = current`), so
  // selecting one should never produce a Q-value/Greedy Value display. GridSvg itself is
  // intentionally left generic (it's reused by EnvEditor's Draft grid, where clicking a
  // wall means "remove this wall," not "select for inspection") — this filter lives here
  // instead, scoped only to the live grid's inspection-selection callback.
  const handleStateSelect = (state: StateKey) => {
    if (snapshot.envRenderModel.kind === 'grid' && snapshot.envRenderModel.walls.includes(state)) return
    setSelectedState(state)
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col items-center gap-6 p-8">
      <div className="flex w-full max-w-4xl items-center justify-between">
        <h1 className="text-3xl font-semibold">RL Playground</h1>
        <LanguageSelector locale={locale} onChange={setLocale} t={t} />
      </div>

      {/*
        Phase 16: this row previously had no explicit width, so it was shrink-to-fit
        content-sized — and `items-center` on <main> re-centers each of its direct
        children as a block. That meant whenever InspectorPanel's rendered width changed
        (its short "empty" placeholder vs. the full populated panel — see Phase 15
        report), the row's own natural width changed, so its centered position shifted,
        dragging the left column (PlaybackControls included) ~18px sideways with it —
        even though nothing in the left column itself had changed.
        Fix: `w-full` makes this row's own width stable (matches <main>'s available
        width, same pattern the h1/language-selector row above already uses), which
        removes it from `items-center`'s content-driven re-centering. The right column
        below gets `md:flex-1 md:max-w-md` instead of being shrink-to-fit — its box width
        is now determined by leftover flex space (stable, viewport-driven), capped at the
        same 28rem/max-w-md every child already used, so switching between InspectorPanel's
        empty/populated content changes what's inside that box, never the box itself.
      */}
      <div className="flex w-full flex-col items-center gap-4 md:flex-row md:items-start md:justify-center">
        <div className="flex flex-none flex-col items-center gap-4">
          {snapshot.envRenderModel.kind === 'grid' ? (
            <div className="relative" data-testid="grid-stack">
              <GridSvg
                renderModel={snapshot.envRenderModel}
                cellSize={CELL_SIZE}
                selectedState={selectedState}
                onStateSelect={handleStateSelect}
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
              {/*
                Phase 26: drawn automatically whenever an Episode is selected (same
                auto-linking behavior Reward Chart/Learning Progress/Episode Detail
                already have since Phase 24/25) — no separate show/hide toggle, since
                selecting a History row is itself already the deliberate "show me this"
                action. Renders nothing (returns null) if the selected Episode isn't
                found or has an empty trajectory, so it never errors on a stale selection.
              */}
              <TrajectoryOverlay
                renderModel={snapshot.envRenderModel}
                episodeStatsHistory={snapshot.stats.episodeStatsHistory}
                selectedEpisode={selectedEpisode}
                cellSize={CELL_SIZE}
                className="absolute inset-0"
                ariaLabel={`${t.episodeTrajectory.ariaLabelPrefix} ${selectedEpisode ?? ''}`}
              />
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
              {t.overlay.policy}
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={showValue}
                onChange={(e) => setShowValue(e.target.checked)}
                data-testid="toggle-value"
              />
              {t.overlay.value}
            </label>
          </div>

          <PlaybackControls
            status={snapshot.status}
            onStep={() => engine.step()}
            // Phase 12: Run always executes exactly the current episode (terminal ->
            // idle) — that meaning is unchanged by Phase 15's episode-count input, which
            // only affects Run Episode.
            onRun={() => engine.run({ episodes: 1 })}
            // Phase 15: Run Episode now runs the user-specified count via the same
            // run({ episodes }) API Run uses (episodeCount defaults to 1, so with no
            // input interaction this is behaviorally identical to Phase 12's
            // engine.runEpisode() default). No Core change needed — run({episodes}) and
            // its remainingEpisodes/runMode bookkeeping already fully support this.
            onRunEpisode={() => engine.run({ episodes: episodeCount })}
            onPause={() => engine.pause()}
            onResume={() => engine.resume()}
            onReset={() => {
              engine.reset()
              setSelectedEpisode(null)
            }}
            t={t}
            episodeCount={episodeCount}
            onEpisodeCountChange={setEpisodeCount}
          />

          <SpeedControl speed={speed} onChange={handleSpeedChange} t={t} />

          {/*
            Phase 23: reads directly from EngineSnapshot.algorithmId (Engine's existing
            source of truth, no mirrored React state). Changing it calls the existing
            reset({ algorithmId }) path (ResetOverrides.algorithmId has existed since
            Phase 1/2) — this gives a fresh Agent/stats/hyperparams for the newly
            selected Algorithm while preserving the current Environment config, exactly
            like the plain Reset button already does. Disabled outside IDLE so the
            update rule can never change mid-Episode.
          */}
          <AlgorithmSelector
            algorithmId={snapshot.algorithmId}
            onChange={(algorithmId) => {
              engine.reset({ algorithmId })
              setSelectedEpisode(null)
            }}
            disabled={snapshot.status !== 'idle'}
            t={t}
          />

          {/*
            Phase 18: reads directly from EngineSnapshot.hyperparams.epsilon rather than
            mirroring its own React state — unlike `speed` above (which has to be
            mirrored because EngineSnapshot doesn't expose it), epsilon IS now in the
            snapshot, so there's a single source of truth and no possibility of drifting
            from the Engine's actual value across reset()/setHyperparams().
          */}
          <EpsilonControl
            epsilon={snapshot.hyperparams.epsilon}
            onChange={(epsilon) => engine.setHyperparams({ epsilon })}
            t={t}
            locale={locale}
          />

          {/* Phase 22 — same source-of-truth reasoning as EpsilonControl above: reads
              directly from EngineSnapshot.hyperparams, never mirrored into local state. */}
          <AlphaControl
            alpha={snapshot.hyperparams.alpha}
            onChange={(alpha) => engine.setHyperparams({ alpha })}
            t={t}
            locale={locale}
          />

          <GammaControl
            gamma={snapshot.hyperparams.gamma}
            onChange={(gamma) => engine.setHyperparams({ gamma })}
            t={t}
            locale={locale}
          />

          <button
            type="button"
            onClick={() => setShowEditor((prev) => !prev)}
            data-testid="toggle-env-editor"
            className="rounded bg-purple-100 px-4 py-2 text-sm font-medium text-purple-800 hover:bg-purple-200"
          >
            {showEditor ? t.envToggle.hide : t.envToggle.show}
          </button>

          {showEditor && snapshot.envRenderModel.kind === 'grid' ? (
            <EnvEditor
              // Re-created (via key) whenever the editor is reopened, so a stale Draft
              // from a previous open never lingers — Draft always starts from whatever
              // the environment looks like right now. Locale is NOT part of this key, so
              // switching languages while the editor is open re-renders it in place
              // (Phase 13 §7/§8 F/G) rather than remounting and losing the Draft.
              key={showEditor ? 'open' : 'closed'}
              currentRenderModel={snapshot.envRenderModel}
              onApply={(config) => {
                engine.reset({ envConfig: config })
                // Phase 10 §5 boundary audit: the previously selected State may not
                // exist in the new Grid (different size, or now off-grid) — clear it
                // rather than leaving QValueBars showing a stale/meaningless selection.
                setSelectedState(null)
                // Phase 24: Apply also resets Episode numbering back to 0 (same reset()
                // call as above), so any selected Episode History row must be cleared too.
                setSelectedEpisode(null)
              }}
              t={t}
              locale={locale}
            />
          ) : null}
        </div>

        {/*
          `min-w-0` overrides the flex item's default `min-width:auto` — without it, a
          child with a large fixed-pixel intrinsic size (RewardChart's SVG is a fixed
          320px wide, not responsive) can force this column wider than its flex-computed
          share once it appears, which is otherwise invisible until content actually
          exceeds the available width (only reproduces at the tightest tested viewport,
          768px, and only once the Reward Chart replaces its empty-state placeholder —
          see the Phase 16 report). RewardChart.tsx itself also gets `overflow-x-auto` as
          a defensive fallback so if a chart still doesn't fit, it scrolls inside its own
          card instead of pushing the surrounding layout.
        */}
        <div className="flex min-w-0 flex-col gap-4 md:flex-1 md:max-w-md">
          <InspectorPanel
            lastTransition={snapshot.lastTransition}
            lastActionSelection={snapshot.lastActionSelection}
            lastTdInfo={snapshot.lastTdInfo}
            t={t}
            locale={locale}
          />
          <QValueBars selectedState={selectedState} agentSnapshot={snapshot.agentSnapshot} t={t} locale={locale} />
          <StatsPanel
            episode={snapshot.episode}
            stats={snapshot.stats}
            t={t}
            selectedEpisode={selectedEpisode}
            onSelectEpisode={setSelectedEpisode}
          />
          <RewardChart
            rewardHistory={snapshot.stats.rewardHistory}
            episodeNumbers={snapshot.stats.episodeStatsHistory.map((row) => row.episode)}
            selectedEpisode={selectedEpisode}
            t={t}
          />
          {/* Phase 25 — reuses the same episodeStatsHistory/selectedEpisode Phase 24
              already established as the single source of truth; no new Engine reads. */}
          <LearningProgress
            episodeStatsHistory={snapshot.stats.episodeStatsHistory}
            selectedEpisode={selectedEpisode}
            t={t}
          />
          {/*
            Phase 26 — `key` remounts this panel whenever the selection changes, so its
            internal "Show all steps" toggle always starts collapsed again for a newly
            selected Episode rather than staying expanded from a previous, unrelated one.
          */}
          <EpisodeTrajectory
            key={selectedEpisode ?? 'none'}
            episodeStatsHistory={snapshot.stats.episodeStatsHistory}
            selectedEpisode={selectedEpisode}
            t={t}
            locale={locale}
          />
        </div>
      </div>
    </main>
  )
}

export default App
