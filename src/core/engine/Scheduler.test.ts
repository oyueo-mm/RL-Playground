import { describe, expect, it, vi } from 'vitest'
import { Scheduler, type SchedulerCallbacks, type TimerSource } from './Scheduler'

/**
 * A TimerSource whose scheduled callbacks are fireable by id even after
 * clearTimeout/cancelAnimationFrame was called on them — this reproduces the real-world
 * race the generation token protects against (a timer that had already fired/queued in
 * the event loop by the time cancellation was requested). If Scheduler didn't have a
 * generation guard, firing a "cancelled" id here would incorrectly drive another step.
 */
function createManualTimerSource(): TimerSource & { fire(id: number): void } {
  let nextId = 1
  const scheduled = new Map<number, () => void>()

  return {
    now: () => 0,
    setTimeout: (fn) => {
      const id = nextId++
      scheduled.set(id, fn)
      return id
    },
    clearTimeout: () => {
      /* intentionally a no-op: see class doc comment above */
    },
    requestAnimationFrame: (fn) => {
      const id = nextId++
      scheduled.set(id, fn)
      return id
    },
    cancelAnimationFrame: () => {
      /* intentionally a no-op: see class doc comment above */
    },
    fire(id: number) {
      const fn = scheduled.get(id)
      if (!fn) throw new Error(`no callback scheduled with id ${id}`)
      fn()
    },
  }
}

function callbacksAlwaysContinue(): SchedulerCallbacks & { performUnit: ReturnType<typeof vi.fn> } {
  return {
    performUnit: vi.fn(() => true),
    afterBatch: vi.fn(),
    onStop: vi.fn(),
  }
}

describe('Scheduler — interval mode', () => {
  it('runs one performUnit synchronously on start(), then arms the next via setTimeout', () => {
    const timer = createManualTimerSource()
    const scheduler = new Scheduler(timer, { mode: 'interval', intervalMs: 100 })
    const callbacks = callbacksAlwaysContinue()

    scheduler.start(callbacks)

    expect(callbacks.performUnit).toHaveBeenCalledTimes(1)
    expect(callbacks.afterBatch).toHaveBeenCalledTimes(1)
  })

  it('does not start a second concurrent loop if already running', () => {
    const timer = createManualTimerSource()
    const scheduler = new Scheduler(timer, { mode: 'interval', intervalMs: 100 })
    const callbacks = callbacksAlwaysContinue()

    scheduler.start(callbacks)
    scheduler.start(callbacks) // second call while already running

    expect(callbacks.performUnit).toHaveBeenCalledTimes(1) // not 2
  })

  it('calls onStop and stops rearming once performUnit returns false', () => {
    const timer = createManualTimerSource()
    const scheduler = new Scheduler(timer, { mode: 'interval', intervalMs: 100 })
    const callbacks: SchedulerCallbacks = {
      performUnit: vi.fn(() => false),
      afterBatch: vi.fn(),
      onStop: vi.fn(),
    }

    scheduler.start(callbacks)

    expect(callbacks.onStop).toHaveBeenCalledTimes(1)
    expect(scheduler.isRunning()).toBe(false)
  })
})

describe('Scheduler — batch (fast) mode', () => {
  it('runs stepsPerFrame performUnit calls but only one afterBatch per frame', () => {
    const timer = createManualTimerSource()
    const scheduler = new Scheduler(timer, { mode: 'batch', stepsPerFrame: 100 })
    const callbacks = callbacksAlwaysContinue()

    scheduler.start(callbacks)

    expect(callbacks.performUnit).toHaveBeenCalledTimes(100)
    expect(callbacks.afterBatch).toHaveBeenCalledTimes(1)
  })

  it('stops mid-batch as soon as performUnit returns false, without exceeding the target', () => {
    const timer = createManualTimerSource()
    const scheduler = new Scheduler(timer, { mode: 'batch', stepsPerFrame: 100 })
    let count = 0
    const callbacks: SchedulerCallbacks = {
      performUnit: vi.fn(() => {
        count += 1
        return count < 5 // stop after the 5th call
      }),
      afterBatch: vi.fn(),
      onStop: vi.fn(),
    }

    scheduler.start(callbacks)

    expect(callbacks.performUnit).toHaveBeenCalledTimes(5)
    expect(callbacks.onStop).toHaveBeenCalledTimes(1)
  })
})

describe('Scheduler — generation token', () => {
  // Note on ids: start() runs the first batch synchronously and only THEN arms a
  // timer/rAF, so the first ever scheduled callback is id 1 (not 2). Each subsequent
  // cancel+rearm (setSpeed, or start() after stop()) consumes the next id in sequence.

  it('a stale callback that fires after a speed change does not drive another step', () => {
    const timer = createManualTimerSource()
    const scheduler = new Scheduler(timer, { mode: 'interval', intervalMs: 100 })
    const callbacks = callbacksAlwaysContinue()

    scheduler.start(callbacks) // performUnit call #1, arms "callback A" as id 1
    expect(callbacks.performUnit).toHaveBeenCalledTimes(1)

    scheduler.setSpeed({ mode: 'interval', intervalMs: 50 }) // generation bump, arms "callback B" as id 2

    // The old ("A") callback fires late — must be a no-op.
    timer.fire(1)
    expect(callbacks.performUnit).toHaveBeenCalledTimes(1) // unchanged

    // The new ("B") callback fires normally.
    timer.fire(2)
    expect(callbacks.performUnit).toHaveBeenCalledTimes(2)
  })

  it('low -> high speed switch invalidates the pending low-speed callback', () => {
    const timer = createManualTimerSource()
    const scheduler = new Scheduler(timer, { mode: 'interval', intervalMs: 1000 })
    const callbacks = callbacksAlwaysContinue()

    scheduler.start(callbacks) // arms id 1 (interval)
    scheduler.setSpeed({ mode: 'batch', stepsPerFrame: 10 }) // arms id 2 (batch)

    timer.fire(1) // stale interval callback

    expect(callbacks.performUnit).toHaveBeenCalledTimes(1) // unchanged since start()
  })

  it('high -> low speed switch invalidates the pending high-speed callback', () => {
    const timer = createManualTimerSource()
    const scheduler = new Scheduler(timer, { mode: 'batch', stepsPerFrame: 10 })
    const callbacks = callbacksAlwaysContinue()

    scheduler.start(callbacks) // 10 synchronous performUnit calls, arms id 1 (batch)
    expect(callbacks.performUnit).toHaveBeenCalledTimes(10)

    scheduler.setSpeed({ mode: 'interval', intervalMs: 1000 }) // arms id 2 (interval)
    timer.fire(1) // stale batch callback

    expect(callbacks.performUnit).toHaveBeenCalledTimes(10) // unchanged
  })

  it('pause (stop) -> resume (start) invalidates any callback pending from before the pause', () => {
    const timer = createManualTimerSource()
    const scheduler = new Scheduler(timer, { mode: 'interval', intervalMs: 100 })
    const callbacks = callbacksAlwaysContinue()

    scheduler.start(callbacks) // performUnit #1, arms id 1
    scheduler.stop() // pause()
    scheduler.start(callbacks) // resume(): performUnit #2, arms id 2
    expect(callbacks.performUnit).toHaveBeenCalledTimes(2)

    timer.fire(1) // callback armed before the pause

    expect(callbacks.performUnit).toHaveBeenCalledTimes(2) // unchanged
  })

  it('reset (stop) mid-flight invalidates a callback that was already queued', () => {
    const timer = createManualTimerSource()
    const scheduler = new Scheduler(timer, { mode: 'interval', intervalMs: 100 })
    const callbacks = callbacksAlwaysContinue()

    scheduler.start(callbacks) // performUnit #1, arms id 1
    scheduler.stop() // reset()

    timer.fire(1)

    expect(callbacks.performUnit).toHaveBeenCalledTimes(1) // only the initial synchronous call
    expect(scheduler.isRunning()).toBe(false)
  })

  it('repeated speed changes only ever leave the latest generation live', () => {
    const timer = createManualTimerSource()
    const scheduler = new Scheduler(timer, { mode: 'interval', intervalMs: 100 })
    const callbacks = callbacksAlwaysContinue()

    scheduler.start(callbacks) // arms id 1
    for (let i = 0; i < 5; i++) {
      scheduler.setSpeed({ mode: 'interval', intervalMs: 100 - i }) // arms ids 2..6
    }

    // ids 1-5 are now all stale; only id 6 is live.
    for (const staleId of [1, 2, 3, 4, 5]) {
      timer.fire(staleId)
    }
    expect(callbacks.performUnit).toHaveBeenCalledTimes(1) // still just the initial call

    timer.fire(6)
    expect(callbacks.performUnit).toHaveBeenCalledTimes(2) // only the final, live generation fires
  })
})
