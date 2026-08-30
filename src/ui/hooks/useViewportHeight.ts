// Phase 54 — tracks `window.innerHeight` so the live Grid (and, in EnvEditor.tsx, the
// Draft preview Grid) can size their cells small enough that a large environment
// (e.g. 20x20) fits inside the visible viewport without vertical scrolling, on top of
// the pre-existing horizontal shrink (Phase 37/39/42's w-full + maxWidth mechanism,
// completely untouched). `useSyncExternalStore` is the same external-store pattern
// useSimulationEngine.ts already uses for the Engine — reused here for the browser's
// own `resize` event instead of a custom EventEmitter.

import { useSyncExternalStore } from 'react'

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('resize', onStoreChange)
  return () => window.removeEventListener('resize', onStoreChange)
}

function getSnapshot(): number {
  return window.innerHeight
}

// Only relevant in tests (jsdom) — a real browser always has a `window`.
function getServerSnapshot(): number {
  return 900
}

export function useViewportHeight(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
