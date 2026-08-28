// Minimal type-safe pub/sub. No React/DOM dependency — SimulationEngine uses this to
// notify subscribers (e.g. a future useSyncExternalStore hook) of new EngineSnapshots.

export type Listener<T> = (value: T) => void

export class EventEmitter<T> {
  private readonly listeners = new Set<Listener<T>>()

  /** Returns an unsubscribe function, so callers don't need to keep the listener reference. */
  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener)
    return () => this.unsubscribe(listener)
  }

  unsubscribe(listener: Listener<T>): void {
    this.listeners.delete(listener)
  }

  emit(value: T): void {
    for (const listener of this.listeners) {
      listener(value)
    }
  }
}
