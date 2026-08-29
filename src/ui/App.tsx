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
import { TerminationChart } from '../viz/panels/TerminationChart'
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
  // Phase 15: how many episodes "Run Episode" runs — pure UI state, never written into
  // Engine/Core. Once engine.run({ episodes: episodeCount }) is called, the Engine's own
  // remainingEpisodes takes over as the sole source of truth for the in-flight run;
  // changing this state afterward (impossible anyway while RUNNING/PAUSED — the input is
  // disabled) can never retroactively affect it.
  const [episodeCount, setEpisodeCount] = useState(1)
  // Phase 13: locale is pure UI state, entirely separate from the Engine — it never
  // reads from or writes to `engine`, so changing it can never reset/affect Episode,
  // Q-table, Environment, or reward history (no localStorage either, per Phase 13 §6 —
  // still no persistence added in Phase 28, only the initial default below changed).
  // Phase 28 §9: default changed from 'en' to 'ko' — English remains fully available via
  // the existing LanguageSelector, this only changes what a first-ever visit starts on.
  const [locale, setLocale] = useState<Locale>('ko')
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
    // Phase 28 §2: max-width raised from max-w-4xl (56rem/896px) to max-w-7xl
    // (80rem/1280px) — the previous width left large unused margins on common wide
    // viewports (1440/1280) and, more importantly, was already narrower than a single
    // large GridWorld could need (MAX_SIZE=20 cells × 48px = 960px alone, i.e. wider
    // than the entire old container). p-8 keeps the same reasonable minimum gutter this
    // always had — content is never flush against the viewport edge.
    <main className="mx-auto flex max-w-7xl flex-col items-center gap-6 p-8">
      <div className="flex w-full max-w-7xl items-center justify-between">
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
        below gets `md:flex-1 md:max-w-lg` instead of being shrink-to-fit — its box width
        is now determined by leftover flex space (stable, viewport-driven), capped at the
        same max-w-lg every child already used, so switching between InspectorPanel's
        empty/populated content changes what's inside that box, never the box itself.

        Phase 28 §2: `md:justify-center` changed to `md:justify-start` — with a
        symmetric-centered row inside a symmetric-centered <main>, widening <main> alone
        does not actually reduce the empty space around the (narrower) actual content —
        centering nests losslessly, so the slop just moves from outside <main> to inside
        it. Left-aligning this row instead anchors the Grid near the actual left margin,
        so a wider <main> visibly translates into less empty space on the left, with any
        remaining slop pushed to a single block on the right rather than split evenly
        around content that isn't using it. Phase 14/16's own layout-stability guarantee
        (playback-reset/playback-pause-resume-slot never moving BETWEEN engine statuses)
        is unaffected — nothing here varies with `status`.
      */}
      <div className="flex w-full flex-col items-center gap-4 md:flex-row md:items-start md:justify-start">
        {/*
          Phase 37: `flex-none` (shrink:0) is what let a large Grid (e.g. 20x20 @ 48px =
          960px) force this whole row past the viewport width once md:flex-row puts it
          side by side with the right column — the item simply refused to ever shrink
          below its natural content width, so the row (and <main>/<body> with it) grew
          wider than the viewport instead. Dropping it (default flex is `0 1 auto`: still
          won't grow, but can now shrink) plus `min-w-0` (overrides the flex item's
          default `min-width:auto`, the same fix already applied to the right column
          below for the identical reason) lets the browser actually shrink this column
          when space is tight. This alone changes nothing for any grid/viewport
          combination that already fit (there's no pressure to shrink into), so every
          previously-verified breakpoint behavior (Phase 14/16/28) is unaffected — see
          `grid-stack` below for the half of the fix that makes the shrink visually
          correct (a CSS-responsive SVG) rather than just clipped.
        */}
        <div className="flex min-w-0 flex-col items-center gap-4">
          {snapshot.envRenderModel.kind === 'grid' ? (
            <div
              className="relative w-full"
              // Phase 37: caps the grid at its natural full-size pixel dimensions (so
              // wide viewports render exactly as before) while `w-full` lets it shrink
              // below that cap on narrow viewports instead of overflowing. All three
              // overlay layers below are `absolute inset-0`, so they automatically track
              // whatever size this container actually ends up rendering at — no changes
              // needed there.
              style={{ maxWidth: snapshot.envRenderModel.width * CELL_SIZE }}
              data-testid="grid-stack"
            >
              <GridSvg
                renderModel={snapshot.envRenderModel}
                cellSize={CELL_SIZE}
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
                  cellSize={CELL_SIZE}
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
                  cellSize={CELL_SIZE}
                  className="absolute inset-0 h-auto w-full"
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
              {showPath && (
                <TrajectoryOverlay
                  renderModel={snapshot.envRenderModel}
                  episodeStatsHistory={snapshot.stats.episodeStatsHistory}
                  selectedEpisode={selectedEpisode}
                  cellSize={CELL_SIZE}
                  className="absolute inset-0 h-auto w-full"
                  ariaLabel={`${t.episodeTrajectory.ariaLabelPrefix} ${selectedEpisode ?? ''}`}
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
              setShowPath(true)
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
                setShowPath(true)
              }}
              t={t}
              locale={locale}
            />
          ) : null}
        </div>

        {/*
          `min-w-0` overrides the flex item's default `min-width:auto` — without it, a
          child with a large fixed-pixel intrinsic size (RewardChart's SVG is a fixed
          384px wide, not responsive — widened from 320px in Phase 28 §2/§3 to make use
          of the extra space freed up by the wider `<main>`) can force this column wider
          than its flex-computed share once it appears, which is otherwise invisible
          until content actually exceeds the available width (only reproduces at the
          tightest tested viewport, 768px, and only once the Reward Chart replaces its
          empty-state placeholder — see the Phase 16 report). RewardChart.tsx itself also
          gets `overflow-x-auto` as a defensive fallback so if a chart still doesn't fit,
          it scrolls inside its own card instead of pushing the surrounding layout.

          Phase 28 §2/§3: max-w-md (28rem/448px) raised to max-w-lg (32rem/512px) — same
          bump applied to every individual panel's own `w-full max-w-lg` (StatsPanel,
          RewardChart, LearningProgress, EpisodeTrajectory, InspectorPanel, QValueBars,
          EnvEditor), so the extra column width actually reaches the panels themselves
          instead of becoming unused padding around still-448px-capped children.
        */}
        {/*
          Phase 37: `md:flex-1` is shorthand for `flex: 1 1 0%` — a **zero** flex-basis.
          In a genuine space deficit (not enough room for both columns, e.g. a large Grid
          at a narrow viewport), the browser's flex-shrink distribution is weighted by
          each item's flex-basis; with this column's basis pinned at 0, it contributed
          ~0 to the shrink calculation and simply never grew back (flex-grow only
          activates when there's a *surplus*, not a deficit) — so it collapsed to a
          literal 0px box while its own children (charts/tables, not all internally
          shrinkable) still rendered at their natural size and stuck out past that 0px
          box, which is what actually produced the horizontal overflow (verified via
          real-browser measurement: rightColWidth was 0 in every failing case). Phase 39
          fixed that by switching to `md:basis-auto` (content-based size).

          Phase 42: `basis-auto` turned out to have its own defect — it measures this
          column's preferred width from its children's actual rendered content, which
          includes InspectorPanel's `targetFormula` (an unrounded TD-target string whose
          length varies every Step depending on floating-point noise, e.g. 50 vs 86
          characters — see qLearning.ts/sarsa.ts's `targetFormula`, deliberately left
          untouched this Phase per its own instructions). At Grid sizes large enough that
          the row is already space-constrained (empirically: 15x15+ at 1440x900/1280x720,
          14x14+ at 1024x768/768x1024), that per-Step length swing was enough to tip the
          row in and out of a shrink deficit, so this column's resolved width — and the
          Grid's, right next to it — visibly oscillated by exactly the pixel difference
          the two formula lengths produced (measured: 18.703125px) on every Step, for as
          long as a Run kept generating new TD values. Pausing (freezing the content)
          made it stop immediately, confirming the content-length dependency.

          Fix: `md:basis-0` — like Phase 37's original bug, a zero basis makes this
          column's *preferred* size a fixed, content-independent number (0) rather than
          something recomputed from whatever InspectorPanel happens to be showing, so a
          longer or shorter targetFormula string can no longer change how the deficit is
          distributed between the two columns. To avoid reintroducing Phase 37's
          collapse-to-0 regression, `md:min-w-[260px]` gives this column an explicit,
          equally content-independent floor the flex algorithm always honors (CSS clamps
          flex-shrink results to `min-width` before finalizing, redistributing any
          remaining deficit to whichever sibling can still shrink — the Grid column here,
          via its own `min-w-0`) — so this column can shrink under real pressure exactly
          as before, just never below a safe, constant floor, and never because of
          Inspector's own content. `md:grow` still fills any leftover surplus up to
          `md:max-w-lg`, unchanged from every already-working case.
        */}
        <div className="flex min-w-0 flex-col gap-4 md:grow md:shrink md:basis-0 md:min-w-[260px] md:max-w-lg">
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
          {/* Phase 28 §10/§11 — grouped directly with Statistics (its data source),
              showing the Goal/Bomb/Other distribution across all of episodeStatsHistory,
              independent of any selected Episode (Episode Detail already covers that
              single Episode's own termination reason). */}
          <TerminationChart episodeStatsHistory={snapshot.stats.episodeStatsHistory} t={t} />
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
