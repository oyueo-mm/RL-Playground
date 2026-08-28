// ARCHITECTURE.md §8 — SimulationEngine is a plain, React-independent class; this hook
// is the ONLY bridge between it and React. Engine lifetime is owned by the caller (see
// src/ui/engine.ts) — this hook never constructs an Engine itself, it only subscribes.

import { useCallback, useRef, useSyncExternalStore } from 'react'
import type { EngineSnapshot } from '../../core/engine/types'

export interface SubscribableEngine {
  subscribe(listener: (snapshot: EngineSnapshot) => void): () => void
  getSnapshot(): EngineSnapshot
}

/**
 * Subscribes a component to `engine`'s EngineSnapshot. This is the single source of
 * truth for simulation state in the UI — no component should copy snapshot fields into
 * its own useState (ARCHITECTURE.md §8 applies in reverse too: don't duplicate Engine
 * state into React state).
 *
 * `SimulationEngine.getSnapshot()` builds a fresh object on every call (Phase 2's
 * design — see buildSnapshot()), which is NOT referentially stable across renders.
 * `useSyncExternalStore` requires getSnapshot() to return the same reference unless the
 * store actually changed, or React treats every read as a change and loops forever.
 * Rather than changing Engine's contract for this, the fix stays entirely in this
 * hook: cache the exact snapshot object the subscribe listener already receives (the
 * emitted value), and only replace it when the Engine actually emits — the officially
 * recommended pattern for wrapping a "builds a new object each call" store.
 */
export function useSimulationEngine(engine: SubscribableEngine): EngineSnapshot {
  const cachedSnapshot = useRef<EngineSnapshot>(engine.getSnapshot())

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      engine.subscribe((snapshot) => {
        cachedSnapshot.current = snapshot
        onStoreChange()
      }),
    [engine],
  )

  const getSnapshot = useCallback(() => cachedSnapshot.current, [])

  return useSyncExternalStore(subscribe, getSnapshot)
}
