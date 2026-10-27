import { describe, expect, it } from 'vitest'
import { SimulationEngine } from './SimulationEngine'
import { createDefaultGridWorldConfig } from '../environments/gridworld/GridWorldEnv'
import type { TimerSource } from './Scheduler'
import type { EngineSnapshot } from './types'

function timer() {
  let time = 0, id = 0
  const pending = new Map<number, () => void>()
  const source: TimerSource = { now: () => time++, setTimeout: fn => { pending.set(++id, fn); return id }, clearTimeout: n => { pending.delete(n) }, requestAnimationFrame: fn => { pending.set(++id, fn); return id }, cancelAnimationFrame: n => { pending.delete(n) } }
  const fire = () => { const first = pending.entries().next().value; if (first) { pending.delete(first[0]); first[1]() } }
  return { source, fire, drain: (engine: SimulationEngine, limit = 100000) => { for (let i = 0; i < limit && engine.getSnapshot().status === 'running'; i++) fire() } }
}
// 3x3, start (0,0), goal (2,0): short episodes; the bomb makes some episodes fail.
const config = { ...createDefaultGridWorldConfig(), width: 3, height: 3, start: { x: 0, y: 0 }, goals: [{ x: 2, y: 0 }], bombs: [{ x: 1, y: 1 }], walls: [] }
const make = (extra: Partial<ConstructorParameters<typeof SimulationEngine>[0]> = {}) => {
  const t = timer()
  const engine = new SimulationEngine({ timerSource: t.source, envConfig: config, speed: { mode: 'batch', stepsPerFrame: 50 }, hyperparams: { alpha: .1, gamma: .9, epsilon: 1 }, resourceBudget: { maxEpisodeSteps: 30 }, ...extra })
  return { t, engine }
}
const emitted = (engine: SimulationEngine) => { const seen: EngineSnapshot[] = []; engine.subscribeUI(s => seen.push(s)); return seen }

describe('completed training request summary', () => {
  it('appears once the requested episodes are all done and reports only this request', () => {
    const { t, engine } = make()
    engine.run({ episodes: 7 }); t.drain(engine)
    const first = engine.getSnapshot().completedRun!
    expect(first).toMatchObject({ id: 1, turbo: false, targetEpisodes: 7, completedEpisodes: 7 })
    engine.run({ episodes: 5 })
    expect(engine.getSnapshot().completedRun).toBeUndefined() // cleared while the next request runs
    t.drain(engine)
    const second = engine.getSnapshot().completedRun!, history = engine.getSnapshot().stats.episodeStatsHistory
    expect(engine.getSnapshot().episode).toBe(12)
    expect(second).toMatchObject({ id: 2, targetEpisodes: 5, completedEpisodes: 5 })
    const mine = history.slice(-5)
    expect(second.successes).toBe(mine.filter(e => e.terminationReason === 'goal').length)
    expect(second.successRate).toBeCloseTo(second.successes / 5, 10)
    expect(second.meanReward).toBeCloseTo(mine.reduce((sum, e) => sum + e.totalReward, 0) / 5, 10) // not the lifetime average
  })
  it('counts truncated and bomb episodes as non-successes', () => {
    const { t, engine } = make({ resourceBudget: { maxEpisodeSteps: 3 } })
    engine.run({ episodes: 40 }); t.drain(engine)
    const run = engine.getSnapshot().completedRun!, h = engine.getSnapshot().stats.episodeStatsHistory
    expect(h.some(e => e.terminationReason !== 'goal')).toBe(true)
    expect(run.successes).toBe(h.filter(e => e.terminationReason === 'goal').length)
    expect(run.successRate).toBeLessThan(1)
  })
  it('is reported by Turbo Training too', () => {
    const { t, engine } = make()
    engine.run({ episodes: 20, turbo: true }); t.drain(engine)
    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().completedRun).toMatchObject({ id: 1, turbo: true, targetEpisodes: 20, completedEpisodes: 20 })
    expect(engine.getUISnapshot().completedRun?.id).toBe(1)
  })
  it('is delivered to UI subscribers with a single id per request', () => {
    const { t, engine } = make(); const seen = emitted(engine)
    engine.run({ episodes: 6 }); t.drain(engine)
    expect(new Set(seen.map(s => s.completedRun?.id).filter(Boolean))).toEqual(new Set([1]))
    expect(seen.slice(0, -1).every(s => !s.completedRun)).toBe(true) // never before the end
    expect(seen.at(-1)!.completedRun?.id).toBe(1)
  })
  it('is not produced while running, paused, or after a user stop', () => {
    const { t, engine } = make(); const seen = emitted(engine)
    engine.run({ episodes: 500 })
    for (let i = 0; i < 3; i++) t.fire()
    expect(engine.getSnapshot().status).toBe('running'); expect(engine.getSnapshot().completedRun).toBeUndefined()
    engine.pause(); expect(engine.getSnapshot().status).toBe('paused'); expect(engine.getSnapshot().completedRun).toBeUndefined()
    engine.restartEpisode() // user stop
    t.drain(engine)
    expect(engine.getSnapshot().status).toBe('idle'); expect(engine.getSnapshot().completedRun).toBeUndefined()
    expect(seen.some(s => s.completedRun)).toBe(false)
  })
  it('stopping a turbo run is not a completion either', () => {
    const { t, engine } = make()
    engine.run({ episodes: 100000, turbo: true }); for (let i = 0; i < 5; i++) t.fire()
    engine.restartEpisode()
    expect(engine.getUISnapshot().completedRun).toBeUndefined()
    expect(engine.getUISnapshot().turbo?.state).toBe('stopped')
  })
  it('paused-then-resumed requests complete exactly once with the whole request counted', () => {
    const { t, engine } = make(); const seen = emitted(engine)
    engine.run({ episodes: 40 })
    for (let i = 0; i < 500 && engine.getSnapshot().episode < 3; i++) t.fire() // frames are tiny in this fake clock: run until a few episodes exist
    engine.pause(); const during = engine.getSnapshot().episode
    expect(during).toBeGreaterThan(0); expect(during).toBeLessThan(40)
    engine.resume(); t.drain(engine)
    expect(engine.getSnapshot().completedRun).toMatchObject({ id: 1, completedEpisodes: 40, targetEpisodes: 40 })
    expect(new Set(seen.map(s => s.completedRun?.id).filter(Boolean)).size).toBe(1)
  })
  it('a resource-limit pause is not a completion; the resumed request then finishes once', () => {
    const { t, engine } = make({ envConfig: { ...config, width: 6, height: 6, goals: [{ x: 5, y: 5 }], bombs: [] }, resourceBudget: { maxEpisodeSteps: 30, maxQStates: 12 } })
    engine.run({ episodes: 200 }); t.drain(engine)
    const s = engine.getSnapshot()
    expect(s.status).toBe('paused'); expect(s.resources!.pauseReason).toBe('q-states')
    expect(s.completedRun).toBeUndefined(); expect(s.episode).toBeLessThan(200)
    engine.setResourceBudget({ maxQStates: 1000 }); engine.resume(); t.drain(engine)
    expect(engine.getSnapshot().completedRun).toMatchObject({ id: 1, completedEpisodes: 200 })
  })
  it('is never produced by greedy playback, single episodes, manual steps, reset or environment changes', () => {
    const { t, engine } = make()
    engine.run({ episodes: 4 }); t.drain(engine)
    expect(engine.getSnapshot().completedRun?.id).toBe(1)
    engine.run({ episodes: 1, greedy: true }); expect(engine.getSnapshot().completedRun).toBeUndefined(); t.drain(engine)
    expect(engine.getSnapshot().completedRun).toBeUndefined()
    engine.runEpisode(); t.drain(engine); expect(engine.getSnapshot().completedRun).toBeUndefined()
    engine.step(); expect(engine.getSnapshot().completedRun).toBeUndefined()
    engine.run({ episodes: 3 }); t.drain(engine); expect(engine.getSnapshot().completedRun?.id).toBe(2)
    engine.reset(); expect(engine.getSnapshot().completedRun).toBeUndefined()
    engine.run({ episodes: 3 }); t.drain(engine); expect(engine.getSnapshot().completedRun?.id).toBe(3) // ids never repeat after reset
    engine.reset({ envConfig: { ...config, goals: [{ x: 2, y: 2 }] } }); expect(engine.getSnapshot().completedRun).toBeUndefined()
  })
  it('keeps the learned Q-table when the summary is read or cleared', () => {
    const { t, engine } = make()
    engine.run({ episodes: 10 }); t.drain(engine)
    const before = engine.getSnapshot().agentSnapshot
    engine.getSnapshot(); engine.getUISnapshot()
    expect(engine.getSnapshot().agentSnapshot).toEqual(before)
    engine.run({ episodes: 1, greedy: true }); t.drain(engine) // clears the summary but not what was learned
    expect(engine.getSnapshot().agentSnapshot).toEqual(before)
  })
})
