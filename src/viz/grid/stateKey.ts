import type { StateKey } from '../../core/types/rl'

/**
 * Shared "x,y" StateKey parser for the overlay components (PolicyOverlay,
 * ValueHeatmap). GridSvg.tsx has its own private copy of this same logic — left
 * untouched intentionally so its Phase 1~4 rendering/tests are not put at risk by an
 * unrelated refactor in Phase 5.
 */
export function parseStateKey(stateKey: StateKey): { x: number; y: number } {
  const [x, y] = stateKey.split(',').map(Number)
  return { x, y }
}

/** Inverse of parseStateKey — used by EnvEditor (Phase 7) to build a draft EnvRenderModel. */
export function toStateKey(pos: { x: number; y: number }): StateKey {
  return `${pos.x},${pos.y}`
}
