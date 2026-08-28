// ARCHITECTURE.md §5.4 — Scheduler is deliberately separate from SimulationEngine and
// knows nothing about RL semantics: it only repeats a caller-supplied "unit of work" at
// a configured cadence, using a generation token so that a stale timer/rAF callback
// (left over from before a speed change, pause, or reset) can never resume driving
// steps once it has been superseded.

/** Injected timing API so Scheduler never touches `window` directly (Node/Vitest safe). */
export interface TimerSource {
  now(): number
  setTimeout(fn: () => void, ms: number): number
  clearTimeout(id: number): void
  requestAnimationFrame(fn: () => void): number
  cancelAnimationFrame(id: number): void
}

function hasFn<K extends string>(obj: unknown, key: K): obj is Record<K, (...args: never[]) => unknown> {
  return typeof obj === 'object' && obj !== null && typeof (obj as Record<string, unknown>)[key] === 'function'
}

/**
 * Browser-first default. Falls back to a ~60fps setTimeout when requestAnimationFrame
 * isn't available (Node/Vitest has no DOM) — feature-detected via globalThis, never a
 * direct `window.requestAnimationFrame` reference, so tests never crash on a missing API.
 */
export const defaultTimerSource: TimerSource = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id),
  requestAnimationFrame: (fn) => {
    if (hasFn(globalThis, 'requestAnimationFrame')) {
      return globalThis.requestAnimationFrame(fn)
    }
    return globalThis.setTimeout(fn, 16)
  },
  cancelAnimationFrame: (id) => {
    if (hasFn(globalThis, 'cancelAnimationFrame')) {
      globalThis.cancelAnimationFrame(id)
      return
    }
    globalThis.clearTimeout(id)
  },
}

export type SpeedSetting =
  | { mode: 'interval'; intervalMs: number }
  | { mode: 'batch'; stepsPerFrame: number }

export interface SchedulerCallbacks {
  /** Perform exactly one RL step. Return false when the run should stop. */
  performUnit(): boolean
  /** Called once after each scheduled batch (one interval tick, or one animation frame's worth of steps). */
  afterBatch(): void
  /** Called once when the loop stops itself because performUnit() returned false. */
  onStop?(): void
}

export class Scheduler {
  private generation = 0
  private activeTimerId: number | null = null
  private running = false
  private callbacks: SchedulerCallbacks | null = null

  private readonly timerSource: TimerSource
  private speed: SpeedSetting

  constructor(timerSource: TimerSource, speed: SpeedSetting) {
    this.timerSource = timerSource
    this.speed = speed
  }

  isRunning(): boolean {
    return this.running
  }

  getSpeed(): SpeedSetting {
    return this.speed
  }

  /**
   * Changing speed while running cancels the pending timer/rAF and re-arms under a new
   * generation — it does NOT execute an extra batch immediately, only reschedules the
   * next one under the new cadence.
   */
  setSpeed(speed: SpeedSetting): void {
    this.speed = speed
    if (!this.running) return
    this.cancelActiveTimer()
    this.generation += 1
    this.armNext()
  }

  start(callbacks: SchedulerCallbacks): void {
    if (this.running) return // never spin up a second concurrent loop
    this.callbacks = callbacks
    this.running = true
    this.runBatch()
  }

  /**
   * External stop (pause(), reset()). Bumps the generation so any callback already
   * queued in setTimeout/rAF becomes a no-op when it eventually fires. Does NOT invoke
   * onStop — callers (Engine) own the resulting status transition themselves.
   */
  stop(): void {
    this.generation += 1
    this.cancelActiveTimer()
    this.running = false
    this.callbacks = null
  }

  private cancelActiveTimer(): void {
    if (this.activeTimerId === null) return
    if (this.speed.mode === 'interval') {
      this.timerSource.clearTimeout(this.activeTimerId)
    } else {
      this.timerSource.cancelAnimationFrame(this.activeTimerId)
    }
    this.activeTimerId = null
  }

  private armNext(): void {
    const myGeneration = this.generation
    const fire = () => {
      if (myGeneration !== this.generation) return // stale callback — superseded, do nothing
      this.runBatch()
    }
    this.activeTimerId =
      this.speed.mode === 'interval'
        ? this.timerSource.setTimeout(fire, this.speed.intervalMs)
        : this.timerSource.requestAnimationFrame(fire)
  }

  private runBatch(): void {
    const callbacks = this.callbacks
    if (!callbacks) return
    const myGeneration = this.generation

    let keepGoing = true
    if (this.speed.mode === 'interval') {
      keepGoing = callbacks.performUnit()
    } else {
      for (let i = 0; i < this.speed.stepsPerFrame && keepGoing; i++) {
        keepGoing = callbacks.performUnit()
      }
    }

    // A pause()/reset()/setSpeed() may have fired synchronously from inside
    // performUnit() (e.g. a subscriber reacting to emit). If so, this generation is
    // already stale — don't touch running state or schedule anything further.
    if (myGeneration !== this.generation) return
    callbacks.afterBatch()

    if (!keepGoing) {
      this.running = false
      this.callbacks = null
      callbacks.onStop?.()
      return
    }
    if (myGeneration !== this.generation) return
    this.armNext()
  }
}
