// Mirrors GridWorldEnv's action encoding exactly (src/core/environments/gridworld/GridWorldEnv.ts
// applyAction: 0=up, 1=down, 2=left, 3=right — same as LEGACY_ANALYSIS.md §2). Core does not
// expose per-index action names (Action is just `number`), so this label table is a
// viz-only concern; it is NOT a redefinition of the action encoding, only a display label
// for the one environment that currently exists.
export const GRIDWORLD_ACTION_LABELS = ['Up', 'Down', 'Left', 'Right'] as const

export function actionLabel(action: number): string {
  return GRIDWORLD_ACTION_LABELS[action] ?? `Action ${action}`
}
