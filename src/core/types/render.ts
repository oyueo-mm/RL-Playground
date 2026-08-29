// ARCHITECTURE.md §4.4 — used in place of `unknown` in EngineSnapshot (Phase 2) so
// viz/** can render without casting.

import type { StateKey } from './rl'

export type EnvRenderModel = {
  kind: 'grid'
  width: number
  height: number
  walls: StateKey[]
  /** Phase 20 — Bomb cell positions (terminal, penalty reward — see GridWorldConfig.bombs). */
  bombs: StateKey[]
  /** Phase 20 — the uniform penalty reward for entering any bomb cell. */
  bombPenalty: number
  /**
   * Phase 30 — reward fields the Environment Editor needs to seed its Draft (stepReward
   * for an ordinary move, wallPenalty for a Wall/boundary-blocked attempt — independent
   * of stepReward, goalReward for a Goal's first visit this Episode, shared by every
   * Goal). Optional (unlike bombPenalty, which existing non-Editor consumers already
   * always supply) so the many pre-Phase-30 EnvRenderModel test fixtures across
   * GridSvg/TrajectoryOverlay/ValueHeatmap/PolicyOverlay — which never read these values
   * — did not need to be touched for this addition.
   */
  stepReward?: number
  wallPenalty?: number
  goalReward?: number
  start: StateKey
  /**
   * Phase 30 — Goal positions NOT YET collected this Episode; Episode ends only once
   * every configured Goal has been collected (Phase 32: a collected Goal is removed
   * from this list so it disappears from the live Grid rendering — see GridWorldEnv.ts's
   * getRenderModel()). This list SHRINKS as the Episode progresses, so it must never be
   * used as "the total number of Goals" — use `allGoals` for that (Phase 44).
   */
  goals: StateKey[]
  /**
   * Phase 44 — the full, static set of every Goal this Environment was configured with,
   * unaffected by collection state (never filtered, unlike `goals` above). Added because
   * StatsPanel's "N / M Goals Collected" display was using the live-shrinking `goals`
   * list for BOTH its numerator and denominator.
   *
   * The corruption isn't visible on the very completed Episode being displayed —
   * `SimulationEngine.finishEpisode()` calls `environment.reset()` synchronously as part
   * of finishing an Episode, so by the time "Latest Episode" re-renders with that
   * Episode's completed stats, `goals` has ALREADY been restored to the full list too.
   * It shows up once the NEXT Episode (which auto-started via that same reset()) begins
   * collecting its OWN Goals: "Latest Episode" keeps displaying the PREVIOUS (finished,
   * unchanging) Episode's trajectory, but its denominator/numerator were being read from
   * the CURRENT live `goals` — which now reflects the new Episode's own, currently-
   * shrinking progress, entirely unrelated to the Episode actually on screen. That is how
   * a fixed, already-completed Episode's "N / M" could visibly count down (reported as
   * "31/31 -> 30/30 -> 29/29...") purely because a *different*, later Episode was quietly
   * collecting its own Goals in the background (see the Phase 44 report for the full
   * trace, including confirmation via deliberately reverting this fix and re-running the
   * regression tests below to see them fail with the exact same symptom).
   *
   * Optional, matching the existing `stepReward?`/`wallPenalty?`/`goalReward?` fields'
   * precedent, so the many pre-existing `EnvRenderModel` test fixtures across
   * GridSvg/PolicyOverlay/ValueHeatmap/TrajectoryOverlay — which never read Goal counts —
   * do not need to be touched.
   */
  allGoals?: StateKey[]
  agentPos: StateKey
  cellRewards?: Record<StateKey, number>
}
// Future non-grid environments add a member to this union (e.g. { kind: 'graph'; ... }).

export type AgentSnapshot =
  | { kind: 'Q'; qTable: Record<StateKey, number[]> }
  | { kind: 'V'; vTable: Record<StateKey, number> }
