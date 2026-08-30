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
]
