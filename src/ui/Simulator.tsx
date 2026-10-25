import { useEffect, useState } from 'react'
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
import { TerminationChart } from '../viz/panels/TerminationChart'
import { RewardChart } from '../viz/panels/RewardChart'
import { LearningProgress } from '../viz/panels/LearningProgress'
import { EpisodeTrajectory } from '../viz/panels/EpisodeTrajectory'
import { EpisodeStepViewer } from '../viz/panels/EpisodeStepViewer'
import { EnvEditor } from '../viz/controls/EnvEditor'
import { computeResponsiveCellSize } from '../viz/grid/responsiveCellSize'
import { engine } from './engine'
import { useSimulationEngine } from './hooks/useSimulationEngine'
import { useViewportHeight } from './hooks/useViewportHeight'
import { translations, type Locale } from './i18n'

const CELL_SIZE = 48
// Phase 54 — a large Grid (e.g. 20x20 @ 48px/cell = 960px tall) can exceed a short
// viewport's visible height even though the pre-existing horizontal shrink (Phase 37)
// already keeps it from overflowing sideways — the vertical dimension had no equivalent
// mechanism at all. MIN_CELL_SIZE is a floor so an extreme case (very large grid, very
// short viewport) never shrinks cells past legibility/click-target size.
const MIN_CELL_SIZE = 24
// Measured via real-browser getBoundingClientRect(): the Grid's own top edge sits
// ~92px below the viewport top (the h1/language-selector row above it) — consistent
// across every tested viewport width, since that row's height doesn't depend on
// viewport width. GRID_VERTICAL_MARGIN reserves a further ~40px so the grid doesn't sit
// flush against the very bottom edge of the viewport. Together, subtracting both from
// `window.innerHeight` gives the actual pixel budget the grid can render within while
// still fitting on screen without vertical scrolling.
const GRID_TOP_OFFSET = 92
const GRID_VERTICAL_MARGIN = 40

interface SimulatorProps {
  locale?: Locale
  section?: 'environment' | 'editor' | 'results'
  active?: boolean
}

function Simulator({ locale: sharedLocale, section = 'environment', active = true }: SimulatorProps) {
  const Container = sharedLocale === undefined ? 'main' : 'section'
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
  // Phase 46 — Step Viewer's current Step, `null` meaning "not scrubbed yet, show the
  // full path" (visually identical to the last Step — see `effectiveStep` below — so a
  // fresh Episode selection renders exactly like Phase 26 always did, until the user
  // actually moves the slider). Reset to `null` whenever the selected Episode changes,
  // via the effect right below, so a leftover Step from a previously browsed Episode
  // never silently applies to a newly selected one.
  const [viewedStep, setViewedStep] = useState<number | null>(null)
  useEffect(() => {
    setViewedStep(null)
  }, [selectedEpisode])
  const [showPolicy, setShowPolicy] = useState(false)
  const [showValue, setShowValue] = useState(false)
  // Phase 30 §14/§15: toggles only whether TrajectoryOverlay is drawn — independent of
  // which Episode is selected (selecting a different Episode while this is OFF keeps it
  // OFF; the underlying trajectory data/table/charts are never affected either way).
  // Default ON, restored to ON on every path that already resets Episode/Q-table state
  // (plain Reset, Algorithm switch, Environment Apply) — no established UI-preference
  // persistence exists in this project (Phase 13 §6: no localStorage), so plain React
  // state reset is the correct, minimal choice here too.
  const [showPath, setShowPath] = useState(true)
  const [speed, setSpeed] = useState<SpeedSetting>(() => engine.getSpeed())
  const [showEditor, setShowEditor] = useState(false)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  // Phase 15: how many episodes "학습하기"/Train runs — pure UI state, never written into
  // Engine/Core. Once engine.run({ episodes: episodeCount }) is called, the Engine's own
  // remainingEpisodes takes over as the sole source of truth for the in-flight run;
  // changing this state afterward (impossible anyway while RUNNING/PAUSED — the input is
  // disabled) can never retroactively affect it.
  // Phase 46: default raised 1 -> 100 so a fresh session's first Train run already does a
  // meaningful number of episodes instead of exactly one (pairs with lowering the default
  // epsilon 0.2 -> 0.1 in qLearning.ts/sarsa.ts).
  const [episodeCount, setEpisodeCount] = useState(100)
  // Phase 13: locale is pure UI state, entirely separate from the Engine — it never
  // reads from or writes to `engine`, so changing it can never reset/affect Episode,
  // Q-table, Environment, or reward history (no localStorage either, per Phase 13 §6 —
  // still no persistence added in Phase 28, only the initial default below changed).
  // Phase 28 §9: default changed from 'en' to 'ko' — English remains fully available via
  // the existing LanguageSelector, this only changes what a first-ever visit starts on.
  const [localLocale, setLocale] = useState<Locale>('ko')
  const locale = sharedLocale ?? localLocale
  useEffect(() => {
    if (section === 'editor') setShowEditor(true)
    if (section === 'results') setAnalysisOpen(true)
  }, [section])
  useEffect(() => {
    if (!active) return
    const target = section === 'editor' ? '#environment-editor' : section === 'results' && analysisOpen ? '[data-testid=stats-panel]' : analysisOpen ? '#analysis-panel' : null
    if (target) document.querySelector(target)?.scrollIntoView?.({ block: 'start' })
  }, [section, showEditor, active, analysisOpen])
  const t = translations[locale]
  const analysisLabel = locale === 'ko' ? '통계 및 분석' : 'Statistics & analysis'
  const analysisToggle = analysisOpen
    ? (locale === 'ko' ? '통계 숨기기' : 'Hide analysis')
    : (locale === 'ko' ? '통계 보기' : 'Show analysis')

  // Phase 54 — see the responsiveCellSize.ts / useViewportHeight.ts comments for the
  // full reasoning. `liveCellSize` replaces the fixed `CELL_SIZE` constant everywhere
  // the live Grid is actually rendered below; it's still exactly `CELL_SIZE` (48) for
  // any grid that already fits the viewport (every previously-verified size/viewport
  // combination is therefore rendered identically to before), and only shrinks once a
  // tall-enough grid on a short-enough viewport would otherwise not fit.
  const viewportHeight = useViewportHeight()
  const liveCellSize =
    snapshot.envRenderModel.kind === 'grid'
      ? computeResponsiveCellSize({
          defaultCellSize: CELL_SIZE,
          minCellSize: MIN_CELL_SIZE,
          gridHeightCells: snapshot.envRenderModel.height,
          availableHeightPx: viewportHeight - GRID_TOP_OFFSET - GRID_VERTICAL_MARGIN,
        })
      : CELL_SIZE

  // Display width is independent of panel contents. All SVG layers retain their
  // common logical cell size/viewBox and scale together in this larger canvas.
  const displayGridWidth = snapshot.envRenderModel.kind === 'grid'
    ? Math.min(960, Math.max(420, viewportHeight - 280) * snapshot.envRenderModel.width / snapshot.envRenderModel.height)
    : 760

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

  // Phase 46 — the selected Episode's own EpisodeStats (or null), and the Step Viewer's
  // effective (never-null) Step: `viewedStep` if the user has scrubbed, otherwise the
  // Episode's last Step (full path), so TrajectoryOverlay renders identically to before
  // Phase 46 until the slider is actually touched.
  const selectedEpisodeStats =
    selectedEpisode == null ? null : (snapshot.stats.episodeStatsHistory.find((row) => row.episode === selectedEpisode) ?? null)
  const effectiveStep = viewedStep ?? (selectedEpisodeStats ? selectedEpisodeStats.trajectory.length : 0)

  return (
    // Phase 28 §2: max-width raised from max-w-4xl (56rem/896px) to max-w-7xl
    // (80rem/1280px) — the previous width left large unused margins on common wide
    // viewports (1440/1280) and, more importantly, was already narrower than a single
    // large GridWorld could need (MAX_SIZE=20 cells × 48px = 960px alone, i.e. wider
    // than the entire old container). p-8 keeps the same reasonable minimum gutter this
    // always had — content is never flush against the viewport edge.
    <Container className="simulator mx-auto flex max-w-7xl flex-col items-center gap-6 p-8">
      <div className="flex w-full max-w-7xl items-center justify-between" hidden={sharedLocale !== undefined}>
        <h1 className="text-3xl font-semibold">RL Playground</h1>
        <LanguageSelector locale={locale} onChange={setLocale} t={t} />
      </div>
      <div className="lab-toolbar"><div><span className="section-number">GRIDWORLD / LIVE EXPERIMENT</span><p>{locale === 'ko' ? '격자에서 실험하고, 필요한 순간 분석하세요.' : 'Experiment on the grid. Inspect when you need to.'}</p></div><button type="button" className="analysis-toggle" data-testid="toggle-analysis" aria-expanded={analysisOpen} aria-controls="analysis-panel" onClick={() => setAnalysisOpen(open => !open)}>{analysisToggle}<span aria-hidden="true"> {analysisOpen ? '−' : '+'}</span></button></div>
      <div className="lab-layout w-full">
        <div className="experiment-canvas flex min-w-0 flex-col items-center gap-4">
          {snapshot.envRenderModel.kind === 'grid' ? (
            <div
              className="relative w-full"
              // Phase 37: caps the grid at its natural full-size pixel dimensions (so
              // wide viewports render exactly as before) while `w-full` lets it shrink
              // below that cap on narrow viewports instead of overflowing. All three
              // overlay layers below are `absolute inset-0`, so they automatically track
              // whatever size this container actually ends up rendering at — no changes
              // needed there. Phase 54: `liveCellSize` (not the fixed `CELL_SIZE`) —
              // "natural full-size" itself is now viewport-height-aware, see above.
              style={{ maxWidth: displayGridWidth }}
              data-testid="grid-stack"
            >
              <GridSvg
                renderModel={snapshot.envRenderModel}
                cellSize={liveCellSize}
                selectedState={selectedState}
                onStateSelect={handleStateSelect}
                // Phase 37: `viewBox` (already set, matching the intrinsic pixel size)
                // plus `w-full h-auto` is the standard responsive-SVG technique — the
                // browser scales the whole coordinate space uniformly to fit the
                // container's actual width while preserving the aspect ratio, so cells/
                // text/markers all shrink together proportionally rather than clipping.
                // `block` avoids the few px of inline-baseline whitespace an `<svg>`
                // otherwise leaves beneath itself. EnvEditor.tsx's Draft preview passes
                // no className, so its fixed cellSize=32 rendering is untouched.
                className="block h-auto w-full"
              />
              {showValue && (
                <ValueHeatmap
                  renderModel={snapshot.envRenderModel}
                  agentSnapshot={snapshot.agentSnapshot}
                  currentState={snapshot.currentState}
                  cellSize={liveCellSize}
                  // Phase 37: `absolute inset-0` alone only POSITIONS this SVG at the
                  // container's top-left corner — verified via real-browser measurement
                  // that it does NOT stretch a replaced element (an SVG with explicit
                  // width/height attributes) to fill the container the way it would a
                  // plain <div>, so this overlay kept rendering at its own unshrunk
                  // intrinsic pixel size and visibly spilled past the (now-responsive)
                  // Grid underneath it. Adding the same `h-auto w-full` responsive-SVG
                  // sizing GridSvg's own <svg> already uses fixes that — see App.tsx's
                  // grid-stack/GridSvg comments above for the full explanation.
                  className="absolute inset-0 h-auto w-full"
                />
              )}
              {showPolicy && (
                <PolicyOverlay
                  renderModel={snapshot.envRenderModel}
                  agentSnapshot={snapshot.agentSnapshot}
                  currentState={snapshot.currentState}
                  cellSize={liveCellSize}
                  className="absolute inset-0 h-auto w-full"
                />
              )}
              {showPath && (
                <TrajectoryOverlay
                  renderModel={snapshot.envRenderModel}
                  episodeStatsHistory={snapshot.stats.episodeStatsHistory}
                  selectedEpisode={selectedEpisode}
                  cellSize={liveCellSize}
                  className="absolute inset-0 h-auto w-full"
                  ariaLabel={`${t.episodeTrajectory.ariaLabelPrefix} ${selectedEpisode ?? ''}`}
                  // Phase 46 — Step Viewer support: truncates the drawn path to the
                  // currently browsed Step. `effectiveStep` already equals the full
                  // trajectory length until the user scrubs, so this renders identically
                  // to pre-Phase-46 behavior by default.
                  stepIndex={effectiveStep}
                />
              )}
            </div>
          ) : null}
          <div className="lab-run-controls">
          <PlaybackControls
            status={snapshot.status}
            onStep={() => engine.step()}
            // Phase 15: "학습하기"/Train runs the user-specified count via
            // run({ episodes }). Phase 46: the old single-Episode "Run" button
            // (`engine.run({ episodes: 1 })`) was removed — it was redundant with this
            // button at episodeCount=1, and this is now the sole real-learning action.
            onRunEpisode={() => engine.run({ episodes: episodeCount })}
            onPause={() => engine.pause()}
            onResume={() => engine.resume()}
            onReset={() => {
              engine.reset()
              setSelectedEpisode(null)
              setShowPath(true)
            }}
            // Phase 28 §8: "Run Greedy Policy" — exactly the current Episode (same
            // "always 1 Episode" semantics Run already has, Phase 12), but with pure
            // argmax action selection and no Q-table update (see SimulationEngine.ts's
            // run({ greedy: true }) comment). The user's real epsilon/alpha/gamma are
            // never read from or written to for this — nothing to "restore" afterward.
            onRunGreedy={() => engine.run({ episodes: 1, greedy: true })}
            // Phase 36 §6: aborts any in-flight run (Greedy or not) and returns the
            // Environment to episode-start WITHOUT recreating the Agent/Q-table — unlike
            // onReset above, which always fully reinitializes the Agent. See
            // SimulationEngine.ts's restartEpisode() for the exact semantics.
            onRestartEpisode={() => engine.restartEpisode()}
            t={t}
            episodeCount={episodeCount}
            onEpisodeCountChange={setEpisodeCount}
          />

          <SpeedControl speed={speed} onChange={handleSpeedChange} t={t} />
          </div>
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
            <button
              type="button"
              onClick={() => setShowPath((prev) => !prev)}
              aria-pressed={showPath}
              data-testid="toggle-episode-path"
              className="rounded bg-gray-100 px-2 py-1 font-medium text-gray-700 hover:bg-gray-200"
            >
              {showPath ? t.episodePath.hide : t.episodePath.show}
            </button>
          </div>

          {snapshot.envRenderModel.kind === 'grid' && (
            // Phase 54: `liveCellSize`, matching grid-stack's own wrapper above exactly
            // — the Step Viewer's width stays pixel-for-pixel aligned with the Grid's
            // actual rendered width, including when the Grid has shrunk to fit a short
            // viewport's height.
            <div className="w-full" style={{ maxWidth: displayGridWidth }}>
              <EpisodeStepViewer
                episode={selectedEpisodeStats}
                step={effectiveStep}
                onStepChange={setViewedStep}
                allGoals={snapshot.envRenderModel.allGoals ?? []}
                t={t}
              />
            </div>
          )}

          <details className="lab-settings"><summary>{locale === 'ko' ? '알고리즘 및 학습 설정' : 'Algorithm & learning settings'}</summary><div className="lab-settings-content">
          <AlgorithmSelector
            algorithmId={snapshot.algorithmId}
            onChange={(algorithmId) => {
              engine.reset({ algorithmId })
              setSelectedEpisode(null)
              setShowPath(true)
            }}
            disabled={snapshot.status !== 'idle'}
            t={t}
          />
          <EpsilonControl
            epsilon={snapshot.hyperparams.epsilon}
            onChange={(epsilon) => engine.setHyperparams({ epsilon })}
            t={t}
            locale={locale}
          />
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

          </div></details>
          <button
            type="button"
            onClick={() => setShowEditor((prev) => !prev)}
            data-testid="toggle-env-editor"
            className="rounded bg-purple-100 px-4 py-2 text-sm font-medium text-purple-800 hover:bg-purple-200"
          >
            {showEditor ? t.envToggle.hide : t.envToggle.show}
          </button>

          {showEditor && snapshot.envRenderModel.kind === 'grid' ? (
            <div id="environment-editor" className="w-full scroll-mt-24"><EnvEditor
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
                setShowPath(true)
              }}
              t={t}
              locale={locale}
            /></div>
          ) : null}
        </div>
        <section id="analysis-panel" aria-label={analysisLabel} hidden={!analysisOpen} className="analysis-panel" data-testid="analysis-panel"><div className="analysis-heading"><div><span className="section-number">EXPERIMENT INSIGHTS</span><h2>{analysisLabel}</h2></div><button type="button" onClick={() => { setAnalysisOpen(false); document.querySelector<HTMLButtonElement>('[data-testid=toggle-analysis]')?.focus() }}>{locale === 'ko' ? '통계 숨기기' : 'Hide analysis'} −</button></div>
        <div className="analysis-content">
          <InspectorPanel
            lastTransition={snapshot.lastTransition}
            lastActionSelection={snapshot.lastActionSelection}
            lastTdInfo={snapshot.lastTdInfo}
            t={t}
            locale={locale}
          />
          <QValueBars
            selectedState={selectedState}
            currentState={snapshot.currentState}
            agentSnapshot={snapshot.agentSnapshot}
            t={t}
            locale={locale}
          />
          <StatsPanel
            episode={snapshot.episode}
            stats={snapshot.stats}
            t={t}
            selectedEpisode={selectedEpisode}
            onSelectEpisode={setSelectedEpisode}
            // Phase 44: `allGoals` (the static, full Goal list), not `goals` (the
            // live, collection-shrinking list) — StatsPanel's "N / M Goals Collected"
            // needs the true fixed total for its denominator, not the count of
            // Goals still remaining right now. See render.ts's doc comment.
            goals={snapshot.envRenderModel.kind === 'grid' ? (snapshot.envRenderModel.allGoals ?? []) : []}
          />
          <TerminationChart episodeStatsHistory={snapshot.stats.episodeStatsHistory} t={t} />
          <RewardChart
            rewardHistory={snapshot.stats.rewardHistory}
            episodeNumbers={snapshot.stats.episodeStatsHistory.map((row) => row.episode)}
            selectedEpisode={selectedEpisode}
            t={t}
          />
          <LearningProgress
            episodeStatsHistory={snapshot.stats.episodeStatsHistory}
            selectedEpisode={selectedEpisode}
            t={t}
          />
          <EpisodeTrajectory
            key={selectedEpisode ?? 'none'}
            episodeStatsHistory={snapshot.stats.episodeStatsHistory}
            selectedEpisode={selectedEpisode}
            t={t}
            locale={locale}
          />
        </div></section>
      </div>
    </Container>
  )
}

export default Simulator
