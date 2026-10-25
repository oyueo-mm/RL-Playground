import { describe, expect, it, vi } from 'vitest'
import { SimulationEngine } from './SimulationEngine'
import { createDefaultGridWorldConfig } from '../environments/gridworld/GridWorldEnv'
import { ENVIRONMENT_PRESETS as COMPLEX_PRESETS } from '../../viz/controls/environmentPresets'
import { draftToGridWorldConfig } from '../../viz/controls/envEditorDraft'
import type { TimerSource } from './Scheduler'

describe('Bounded records independent of learning', () => {
  it.each(['q-learning', 'sarsa'])('keeps identical %s updates with tiny or generous detailed retention', algorithmId => {
    const run = (maxRecordedSteps: number) => {
      let seed = 17
      const random = vi.spyOn(Math, 'random').mockImplementation(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 })
      const engine = new SimulationEngine({ algorithmId, resourceBudget: { maxRecordedSteps, maxEpisodeSteps: 13, maxDetailedEpisodes: 2 } })
      for (let i = 0; i < 1000; i++) engine.step()
      random.mockRestore()
      return engine.getSnapshot()
    }
    const tiny = run(5), generous = run(500000)
    expect(tiny.agentSnapshot).toEqual(generous.agentSnapshot)
    expect(tiny.lastTdInfo).toEqual(generous.lastTdInfo)
    expect(tiny.currentState).toBe(generous.currentState)
    expect(tiny.stats.totalReward).toBe(generous.stats.totalReward)
    expect(tiny.resources?.lifetime).toEqual(generous.resources?.lifetime)
    expect(tiny.resources!.recordedSteps).toBeLessThanOrEqual(5)
  })
  it('evicts detached records without corrupting old snapshots, abort accounting or summaries', () => {
    const engine = new SimulationEngine({ resourceBudget: { maxRecordedSteps: 5, maxEpisodeSteps: 2 } })
    engine.step(); engine.step()
    const old = engine.getSnapshot()
    for (let i = 0; i < 12; i++) engine.step()
    expect(old.stats.latestEpisodeStats!.trajectory).toHaveLength(2)
    const next = engine.getSnapshot()
    expect(next.stats.episodeStatsHistory[0].trajectoryStatus).toBe('evicted')
    expect(next.resources!.lifetime!.exploration + next.resources!.lifetime!.exploitation).toBe(14)
    engine.setResourceBudget({ maxRecordedSteps: 1 }); engine.step(); engine.restartEpisode()
    expect(engine.getResourceMetrics().recordedSteps).toBeGreaterThanOrEqual(0)
    expect(engine.getResourceMetrics().recordedSteps).toBeLessThanOrEqual(1)
  })
  it('bounds summaries while retaining cumulative episode counts and reason totals', () => {
    const engine = new SimulationEngine({ envConfig: { ...createDefaultGridWorldConfig(), start: { x: 0, y: 1 }, goals: [{ x: 0, y: 0 }] }, resourceBudget: { maxEpisodeSteps: 1 } })
    for (let i = 0; i < 11001; i++) engine.step()
    const snapshot = engine.getSnapshot()
    expect(snapshot.episode).toBe(11001)
    expect(snapshot.stats.episodeStatsHistory.length).toBeLessThanOrEqual(10000)
    expect(Object.values(snapshot.resources!.lifetime!.reasons).reduce((a, b) => a + b, 0)).toBe(11001)
    expect(snapshot.stats.rewardHistory).toHaveLength(snapshot.stats.episodeStatsHistory.length)
    expect(snapshot.stats.episodeStatsHistory.at(-1)!.episode).toBe(11001)
  })
  it('keeps SARSA learning beyond 500,000 steps without discarding its pending action cache', () => {
    let seed = 42
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 })
    try {
      const engine = new SimulationEngine({ algorithmId: 'sarsa', resourceBudget: { maxQStates: 1_000_000 }, envConfig: draftToGridWorldConfig(COMPLEX_PRESETS.at(-1)!.draft), hyperparams: { alpha: .1, gamma: .9, epsilon: .3 } })
      for (let i = 0; i < 500100; i++) engine.step()
      expect(engine.getResourceMetrics().totalSteps).toBe(500100)
      expect(engine.getResourceMetrics().pauseReason).toBeNull()
      expect(engine.getResourceMetrics().recordedSteps).toBeLessThanOrEqual(500000)
    } finally { random.mockRestore() }
  }, 120000)
  it.each([...COMPLEX_PRESETS.slice(0, 8), COMPLEX_PRESETS.at(-1)!])('$id continues beyond 500,000 real learning steps with bounded records', preset => {
    let seed = 42
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 })
    try {
      let now = 0, scheduled: (() => void) | null = null
      const timer: TimerSource = { now: () => now, requestAnimationFrame: fn => { scheduled = fn; return 1 }, setTimeout: fn => { scheduled = fn; return 1 }, cancelAnimationFrame: () => { scheduled = null }, clearTimeout: () => { scheduled = null } }
      const engine = new SimulationEngine({ timerSource: timer, speed: { mode: 'batch', stepsPerFrame: 100 }, envConfig: draftToGridWorldConfig(preset.draft), hyperparams: { alpha: .1, gamma: .9, epsilon: .3 }, resourceBudget: { maxQStates: 1_000_000, maxRecordedSteps: 500_000, maxDetailedEpisodes: 100 } })
      const started = performance.now()
      engine.run({ episodes: 1_000_000 })
      while (engine.getResourceMetrics().totalSteps < 500_100) {
        expect(scheduled).not.toBeNull()
        const next = scheduled!; scheduled = null; now += 16; next()
      }
      const metrics = engine.getResourceMetrics()
      expect(metrics.totalSteps).toBe(500100)
      expect(metrics.pauseReason).toBeNull()
      expect(metrics.recordedSteps).toBeLessThanOrEqual(500000)
      expect(metrics.lifetime!.exploration + metrics.lifetime!.exploitation).toBe(500100)
      expect(engine.getSnapshot().status).toBe('running')
      engine.pause(); expect(engine.getSnapshot().status).toBe('paused')
      engine.resume(); expect(engine.getSnapshot().status).toBe('running')
      const q = engine.getSnapshot().agentSnapshot
      engine.restartEpisode(); expect(engine.getSnapshot().agentSnapshot).toEqual(q)
      console.log(JSON.stringify({ preset: preset.id, elapsedMs: performance.now() - started, ...metrics }))
    } finally { random.mockRestore() }
  }, 120000)
})
