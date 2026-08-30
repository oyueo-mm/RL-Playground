// Phase 30 §16-21 — static, in-code Environment Presets. Selecting one loads its Draft
// (GridEditorDraft) into the Environment Editor's Draft state only — it never touches the
// live Environment, following the same Draft->Apply flow every other Draft edit already
// goes through (EnvEditor.tsx's handleApply()). A Preset is a starting point, not a lock:
// every field can be freely edited afterward, same as a hand-built Draft.

import type { GridEditorDraft } from './envEditorDraft'

export interface EnvironmentPreset {
  id: string
  draft: GridEditorDraft
}

function draft(overrides: Partial<GridEditorDraft>): GridEditorDraft {
  return {
    width: 7,
    height: 7,
    start: { x: 0, y: 0 },
    goals: [{ x: 6, y: 6 }],
    walls: [],
    bombs: [],
    stepReward: -0.1,
    wallPenalty: -0.1,
    goalReward: 10,
    bombPenalty: -10,
    ...overrides,
  }
}

export const ENVIRONMENT_PRESETS: EnvironmentPreset[] = [
  {
    // Phase 56 §2A — a genuinely obstacle-free tutorial environment (the existing
    // 'corridor' preset below already has boundary Walls forming a 1-wide tunnel, so it
    // doesn't actually serve this "first run, nothing to think about yet" role): a small
    // open field with a single Start, a single Goal, and nothing else. Placed first in
    // the list since it's the natural starting point for a new user.
    id: 'basic',
    draft: draft({
      width: 6,
      height: 6,
      start: { x: 0, y: 0 },
      goals: [{ x: 5, y: 5 }],
    }),
  },
  {
    // A single-cell-wide corridor (walled top and bottom, MIN_SIZE=3 requires at least 3
    // rows) — the simplest possible demo of the reward structure and how Q-Learning/SARSA
    // converge on a direct path.
    id: 'corridor',
    draft: draft({
      width: 7,
      height: 3,
      start: { x: 0, y: 1 },
      goals: [{ x: 6, y: 1 }],
      walls: [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 },
        { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 6, y: 2 },
      ],
    }),
  },
  {
    // A zigzag maze: three near-full-width wall rows, each with a single gap on the
    // opposite side from the previous one — forces real exploration and rewards a higher
    // gamma (the goal is many steps away from any early decision point).
    id: 'maze',
    draft: draft({
      width: 7,
      height: 7,
      start: { x: 0, y: 0 },
      goals: [{ x: 6, y: 6 }],
      walls: [
        { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 },
        { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 },
        { x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 },
      ],
      wallPenalty: -0.5,
    }),
  },
  {
    // Many bombs scattered around the direct path — rewards risk-averse policies (a
    // higher effective bombPenalty magnitude relative to goalReward).
    id: 'bombField',
    draft: draft({
      width: 7,
      height: 7,
      start: { x: 0, y: 0 },
      goals: [{ x: 6, y: 6 }],
      bombs: [
        { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 2 }, { x: 2, y: 4 },
        { x: 4, y: 4 }, { x: 1, y: 5 }, { x: 5, y: 1 }, { x: 3, y: 5 }, { x: 5, y: 3 },
      ],
      bombPenalty: -15,
    }),
  },
  {
    // Three Goals with no bombs/walls — a direct demonstration of Phase 30's "all Goals
    // must be collected" termination semantics with nothing else to complicate it.
    id: 'multiGoal',
    draft: draft({
      width: 5,
      height: 5,
      start: { x: 0, y: 0 },
      goals: [{ x: 4, y: 0 }, { x: 0, y: 4 }, { x: 4, y: 4 }],
    }),
  },
  {
    // Multiple Goals + Bombs + Walls together — the most realistic experiment: the agent
    // must learn to collect every Goal while routing around both Walls and Bombs.
    id: 'treasureHunt',
    draft: draft({
      width: 8,
      height: 8,
      start: { x: 0, y: 0 },
      goals: [{ x: 7, y: 0 }, { x: 0, y: 7 }, { x: 7, y: 7 }],
      bombs: [{ x: 3, y: 3 }, { x: 4, y: 4 }, { x: 2, y: 5 }],
      walls: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }],
      wallPenalty: -0.2,
    }),
  },
  {
    // Phase 56 §2B — a single Wall column blocks the direct Start-to-Goal row entirely
    // EXCEPT for one gap (at y=0), forcing exactly one detour: the direct straight-line
    // path is impossible, but there is exactly one way around, unlike 'maze' below
    // (multiple gaps/choices) — a clearer, simpler "must route around an obstacle" demo
    // than either 'corridor' (no real choice at all) or 'maze' (several choices).
    id: 'obstacleCourse',
    draft: draft({
      width: 7,
      height: 7,
      start: { x: 0, y: 3 },
      goals: [{ x: 6, y: 3 }],
      walls: [
        { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 3, y: 5 }, { x: 3, y: 6 },
      ],
      wallPenalty: -0.3,
    }),
  },
  {
    // Phase 56 §2E — the showcase preset: a large (15x15) grid combining every feature
    // this project supports at once (multiple Goals, Walls, Bombs) to exercise Multi-Goal
    // collection, longer-horizon exploration, and risk-avoidance together. The single
    // Wall row only spans the middle columns (x=2..12 at y=7), deliberately leaving both
    // edge columns (x=0-1 and x=13-14) open — this guarantees every Goal stays reachable
    // (no need for a hand-traced path through the gap) while still forcing a real
    // decision about which side to route through. Bombs sit off that Wall row, in open
    // space away from Start/Goals/Walls, so they add risk without blocking any path.
    id: 'complexMaze',
    draft: draft({
      width: 15,
      height: 15,
      start: { x: 0, y: 0 },
      goals: [{ x: 14, y: 0 }, { x: 0, y: 14 }, { x: 14, y: 14 }],
      walls: [
        { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 },
        { x: 8, y: 7 }, { x: 9, y: 7 }, { x: 10, y: 7 }, { x: 11, y: 7 }, { x: 12, y: 7 },
      ],
      bombs: [{ x: 5, y: 5 }, { x: 9, y: 9 }, { x: 5, y: 9 }, { x: 9, y: 5 }],
      wallPenalty: -0.3,
      bombPenalty: -15,
    }),
  },
  // Phase 58 — three additions, each a genuinely different learning experience from
  // every existing preset. Deliberately NOT adding an "Open Field", "Zigzag/Winding", or
  // second "Large Showcase" preset — 'basic' (no obstacles at all), 'maze' (three
  // staggered gap-rows forcing repeated direction changes), and 'complexMaze' (15x15,
  // Multi-Goal + Walls + Bombs) already fill those exact roles; adding near-duplicates
  // would violate this Phase's own "의미 없는 유사 preset을 대량으로 추가하지 않는다"
  // instruction rather than satisfy it.
  {
    // Phase 58 — a real dead-end: two small 1-cell pockets, each reachable only from a
    // single open neighbor (walled on the other 3 sides), so entering one means the
    // agent must back out the exact way it came before the real route continues. This is
    // a genuinely different experience from every existing preset — 'maze' only ever
    // forces a direction CHANGE (every gap eventually leads somewhere), it has no cell
    // that's a true trap. The main route itself stays simple (a single divider Wall with
    // one gap, same technique as 'obstacleCourse') so the dead ends are what stands out,
    // not incidental maze complexity.
    id: 'deadEndMaze',
    draft: draft({
      width: 9,
      height: 7,
      start: { x: 0, y: 3 },
      goals: [{ x: 8, y: 3 }],
      walls: [
        // Divider: blocks the x=4 column everywhere except the y=0 gap.
        { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 6 },
        // Dead-end pocket at (2,5): open only from (2,4) above.
        { x: 1, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 6 },
        // Dead-end pocket at (6,2): open only from (6,3) below.
        { x: 5, y: 2 }, { x: 7, y: 2 }, { x: 6, y: 1 },
      ],
      wallPenalty: -0.2,
    }),
  },
  {
    // Phase 58 — an open field with a single freestanding Wall "island" in the middle
    // (touching none of the Grid's edges), so the agent has a genuine CHOICE of routes
    // around it (over the top or under the bottom) rather than a single forced detour —
    // distinct from 'obstacleCourse' (exactly one gap, no real choice) and from 'maze'
    // (a fixed sequence of forced turns). Both routes are viable and roughly comparable
    // in length, making the shortest-vs-longer-path difference easy to observe.
    id: 'multipleRoute',
    draft: draft({
      width: 9,
      height: 9,
      start: { x: 0, y: 4 },
      goals: [{ x: 8, y: 4 }],
      walls: [
        { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 },
        { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 },
        { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 },
      ],
    }),
  },
  {
    // Phase 58 — the direct Start-to-Goal row is the shortest path but is lined with
    // Bombs; the only Bomb-free route is a detour through the (walled-off, only reachable
    // via the far left/right edge columns) rows above/below. Unlike 'bombField' (an open
    // field where avoiding scattered Bombs costs almost nothing extra), the Walls here
    // structurally force a real short-risky vs. long-safe trade-off — the reward
    // structure (bombPenalty vs. the extra steps' stepReward cost), not just distance,
    // determines which route a trained policy actually prefers.
    id: 'riskyPath',
    draft: draft({
      width: 9,
      height: 9,
      start: { x: 0, y: 4 },
      goals: [{ x: 8, y: 4 }],
      bombs: [{ x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 }],
      walls: [
        { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 }, { x: 7, y: 3 },
        { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 },
      ],
      bombPenalty: -12,
    }),
  },
]
