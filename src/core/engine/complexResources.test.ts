import { describe, expect, it, vi } from 'vitest'
import { SimulationEngine } from './SimulationEngine'
import { TabularQAgent } from '../agents/TabularQAgent'
import { GridWorldEnv, createDefaultGridWorldConfig } from '../environments/gridworld/GridWorldEnv'
import { stateSpaceDetails, validateFeatures } from '../environments/gridworld/features'
import { draftFromRenderModel, validateDraft } from '../../viz/controls/envEditorDraft'
import { parseEnvImport, serializeEnvExport } from '../../viz/controls/envEditorIO'
import { Scheduler, type TimerSource } from './Scheduler'

function clock() {
  let now = 0, next: (() => void) | null = null
  const timer: TimerSource = { now: () => now, setTimeout: fn => { next = fn; return 1 }, requestAnimationFrame: fn => { next = fn; return 1 }, clearTimeout: () => { next = null }, cancelAnimationFrame: () => { next = null } }
  return { timer, tick(ms = 100) { now += ms; const fn = next; next = null; fn?.() } }
}
const huge = () => ({ ...createDefaultGridWorldConfig(), width: 20, height: 20, goals: [{ x: 19, y: 19 }], fragiles: Array.from({ length: 200 }, (_, i) => ({ x: (i + 1) % 20, y: Math.floor((i + 1) / 20) })) })

describe('Complexity is informational', () => {
  it('accepts a huge theoretical space via engine, draft and JSON without allocating all states', () => {
    const config = huge()
    expect(validateFeatures(config)).toEqual([])
    expect(stateSpaceDetails(config).large).toBe(true)
    expect(stateSpaceDetails(config).text).toContain('10^')
    expect(stateSpaceDetails(config).text).not.toMatch(/Infinity|NaN/)
    const engine = new SimulationEngine({ envConfig: config })
    expect(engine.getResourceMetrics().qStates).toBe(0)
    for (let i = 0; i < 100; i++) engine.step()
    expect(engine.getResourceMetrics().qStates).toBeLessThanOrEqual(101)
    const draft = draftFromRenderModel(new GridWorldEnv(config).getRenderModel())
    expect(validateDraft(draft)).toEqual([])
    expect(parseEnvImport(serializeEnvExport(draft)).ok).toBe(true)
  })
  it('formats beyond floating-point range safely and still rejects structural errors', () => {
    expect(stateSpaceDetails({ ...huge(), goals: Array.from({ length: 2000 }, () => ({ x: 1, y: 1 })) }).text).not.toMatch(/Infinity|NaN/)
    expect(validateFeatures({ ...huge(), portals: [{ id: 'P', ends: [{ x: 19, y: 18 }] }] }).join(' ')).toContain('two endpoints')
    expect(validateFeatures({ ...huge(), start: { x: -1, y: 0 } }).length).toBeGreaterThan(0)
  })
  it('preserves fragile and toggle bits beyond 64 bits', () => {
    const fragiles = Array.from({ length: 70 }, (_, i) => ({ x: i % 20, y: Math.floor(i / 20) }))
    const env = new GridWorldEnv({ ...huge(), start: { x: 10, y: 3 }, fragiles })
    env.step(2); env.step(3)
    expect(env.getState().split(',')[3]).toBe((1n << 69n).toString(16))
    const switches = fragiles.map((p, i) => ({ ...p, groupId: `G${String(i).padStart(3, '0')}` }))
    const toggleWalls = switches.map((p, i) => ({ x: (200 + i) % 20, y: Math.floor((200 + i) / 20), groupId: p.groupId }))
    const grouped = new GridWorldEnv({ ...huge(), start: { x: 10, y: 3 }, fragiles: [], switches, toggleWalls })
    expect(grouped.step(2).nextState.split(',')[4]).toBe((1n << 69n).toString(16))
  })
  it('rebuilds static indexes after config replacement and isolates config arrays', () => {
    const config = createDefaultGridWorldConfig()
    const env = new GridWorldEnv(config)
    config.walls.push({ x: 1, y: 0 })
    expect(env.step(3).nextState).toBe('1,0,0')
    env.setConfig({ ...createDefaultGridWorldConfig(), walls: [{ x: 1, y: 0 }] }); env.reset()
    expect(env.step(3).nextState).toBe('0,0,0')
    const goals = [{ x: 0, y: 0 }, { x: 2, y: 2 }]
    const collected = new GridWorldEnv({ ...createDefaultGridWorldConfig(), start: { x: 0, y: 1 }, goals })
    collected.step(0)
    collected.setConfig({ ...createDefaultGridWorldConfig(), goals: goals.slice().reverse() })
    expect(collected.getState()).toBe('0,0,2')
  })
})

describe('Bounded and consistent UI projections', () => {
  it('does not materialize untouched rows and detaches every projected vector at its revision', () => {
    const agent = new TabularQAgent(4)
    agent.applyUpdate('1,1,0,0,1', 0, { algorithm: 'seed', target: 4, targetFormula: '', previousEstimate: 0, error: 4, updatedEstimate: 4 })
    const old = agent.toVisibleSnapshot(['1,1,0,0,1', 'missing'])
    expect(agent.size).toBe(1)
    expect(old.kind).toBe('Q')
    agent.applyUpdate('1,1,0,0,1', 0, { algorithm: 'seed', target: 9, targetFormula: '', previousEstimate: 4, error: 5, updatedEstimate: 9 })
    if (old.kind !== 'Q') throw new Error('Expected Q')
    expect(old.qTable['1,1,0,0,1'][0]).toBe(4)
    expect(Object.isFrozen(old.qTable['1,1,0,0,1'])).toBe(true)
    expect(agent.version).toBeGreaterThan(old.version!)
  })
  it('never calls full Q snapshots for UI subscriptions and bounds visible rows by grid cells', () => {
    const engine = new SimulationEngine({ envConfig: huge() })
    const full = vi.spyOn(TabularQAgent.prototype, 'toSnapshot')
    const seen: number[] = []
    const unsubscribe = engine.subscribeUI(snapshot => { if (snapshot.agentSnapshot.kind === 'Q') { seen.push(Object.keys(snapshot.agentSnapshot.qTable).length); expect(snapshot.agentSnapshot.version).toBe(snapshot.resources?.qVersion) } })
    for (let i = 0; i < 500; i++) engine.step()
    expect(full).not.toHaveBeenCalled()
    expect(Math.max(...seen)).toBeLessThanOrEqual(400)
    engine.getSnapshot(); expect(full).toHaveBeenCalledOnce()
    unsubscribe(); full.mockRestore()
  })
  it('throttles ongoing UI publications but immediately publishes first batch and pause/stop', () => {
    const c = clock()
    const engine = new SimulationEngine({ timerSource: c.timer, speed: { mode: 'batch', stepsPerFrame: 10 } })
    const listener = vi.fn(); engine.subscribeUI(listener)
    engine.run({ episodes: 100 }); expect(listener).toHaveBeenCalledOnce()
    for (let i = 0; i < 7; i++) c.tick(10)
    expect(listener).toHaveBeenCalledOnce()
    c.tick(10); expect(listener).toHaveBeenCalledTimes(2)
    engine.pause(); expect(listener.mock.lastCall?.[0].status).toBe('paused')
    engine.restartEpisode(); expect(listener.mock.lastCall?.[0].status).toBe('idle')
  })
})

describe('Actual resource boundaries and truncation', () => {
  it('yields long batches at the work budget and executes every requested learning step', () => {
    let now = 0, steps = 0
    const scheduled: (() => void)[] = []
    const timer: TimerSource = { now: () => now, requestAnimationFrame: fn => { scheduled.push(fn); return 1 }, setTimeout: fn => { scheduled.push(fn); return 1 }, clearTimeout: () => {}, cancelAnimationFrame: () => {} }
    const scheduler = new Scheduler(timer, { mode: 'batch', stepsPerFrame: 10000 })
    scheduler.start({ performUnit: () => { steps++; now += 3; return steps < 20 }, afterBatch: () => {} })
    expect(steps).toBe(3)
    while (scheduled.length) scheduled.shift()!()
    expect(steps).toBe(20); expect(scheduler.isRunning()).toBe(false)
  })
  it.each(['q-learning', 'sarsa'])('retains nonzero bootstrapping on a %s time limit', algorithmId => {
    const engine = new SimulationEngine({ algorithmId, envConfig: { ...createDefaultGridWorldConfig(), width: 3, height: 3, start: { x: 1, y: 1 }, goals: [{ x: 2, y: 2 }], walls: [{ x: 1, y: 0 }, { x: 1, y: 2 }, { x: 0, y: 1 }, { x: 2, y: 1 }], wallPenalty: -1 }, hyperparams: { alpha: 1, gamma: .9, epsilon: 0 }, resourceBudget: { maxEpisodeSteps: 1 } })
    for (let i = 0; i < 5; i++) engine.step()
    expect(engine.getSnapshot().lastTransition).toMatchObject({ done: false, truncated: true })
    expect(engine.getSnapshot().lastTdInfo?.target).toBeCloseTo(-1.9)
  })
  it('pauses before exhausting actual Q rows, resumes with a larger budget and preserves learned data', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(.99)
    const c = clock()
    const engine = new SimulationEngine({ envConfig: { ...createDefaultGridWorldConfig(), width: 20, height: 20, goals: [{ x: 19, y: 19 }] }, timerSource: c.timer, speed: { mode: 'batch', stepsPerFrame: 100 }, hyperparams: { alpha: .1, gamma: .9, epsilon: 1 }, resourceBudget: { maxQStates: 10 } })
    engine.run({ episodes: 100 })
    const paused = engine.getSnapshot()
    expect(paused.status).toBe('paused'); expect(paused.resources?.pauseReason).toBe('q-states')
    expect(paused.resources?.qStates).toBeLessThanOrEqual(10)
    engine.setResourceBudget({ maxQStates: 100 }); engine.resume(); expect(engine.getSnapshot().status).toBe('running')
    engine.pause(); const learned = engine.getSnapshot().agentSnapshot
    engine.restartEpisode(); expect(engine.getSnapshot().agentSnapshot).toEqual(learned)
    random.mockRestore()
  })
  it('records time limits separately, bootstraps TD targets and preserves all completed history at pause', () => {
    const c = clock()
    const engine = new SimulationEngine({ timerSource: c.timer, speed: { mode: 'batch', stepsPerFrame: 100 }, resourceBudget: { maxEpisodeSteps: 2, maxRecordedSteps: 5 } })
    engine.run({ episodes: 100 })
    const snapshot = engine.getSnapshot()
    expect(snapshot.status).toBe('paused'); expect(snapshot.resources?.pauseReason).toBe('recorded-steps')
    expect(snapshot.stats.episodeStatsHistory).toHaveLength(2)
    expect(snapshot.stats.successCount).toBe(0)
    expect(snapshot.stats.episodeStatsHistory.every(row => row.terminationReason === 'truncated')).toBe(true)
    const last = snapshot.stats.episodeStatsHistory[0].trajectory.at(-1)!
    expect(last.done).toBe(false); expect(last.truncated).toBe(true)
    engine.restartEpisode()
    expect(engine.getSnapshot().stats.episodeStatsHistory).toEqual(snapshot.stats.episodeStatsHistory)
    expect(engine.getResourceMetrics().recordedSteps).toBe(4)
  })
  it.each(['q-learning', 'sarsa'])('keeps %s termination distinct from a time limit on the same step', algorithmId => {
    const engine = new SimulationEngine({ algorithmId, envConfig: { ...createDefaultGridWorldConfig(), start: { x: 0, y: 1 }, goals: [{ x: 0, y: 0 }] }, hyperparams: { alpha: .5, gamma: .9, epsilon: 0 }, resourceBudget: { maxEpisodeSteps: 1 } })
    engine.step()
    expect(engine.getSnapshot().lastTransition).toMatchObject({ done: true })
    expect(engine.getSnapshot().lastTransition?.truncated).toBeUndefined()
    expect(engine.getSnapshot().stats.latestEpisodeStats?.terminationReason).toBe('goal')
    expect(engine.getSnapshot().lastTdInfo?.target).toBe(10)
  })
  it('rejects malformed resource budgets without changing the running state', () => {
    const engine = new SimulationEngine()
    expect(() => engine.setResourceBudget({ maxEpisodeSteps: 0 })).toThrow()
    expect(() => new SimulationEngine({ resourceBudget: { maxQStates: 0 } })).toThrow()
    expect(engine.getSnapshot().status).toBe('idle')
  })
})
