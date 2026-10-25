import { test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

test('repeated browser engine and snapshot benchmark', async ({ page }) => {
  await page.goto('./')
  const results = await page.evaluate(async () => {
    const engineURL = '/RL-Playground/src/core/engine/SimulationEngine.ts'
    const agentURL = '/RL-Playground/src/core/agents/TabularQAgent.ts'
    const envURL = '/RL-Playground/src/core/environments/gridworld/GridWorldEnv.ts'
    const { SimulationEngine } = await import(engineURL) as typeof import('../src/core/engine/SimulationEngine')
    const { TabularQAgent } = await import(agentURL) as typeof import('../src/core/agents/TabularQAgent')
    const { createDefaultGridWorldConfig } = await import(envURL) as typeof import('../src/core/environments/gridworld/GridWorldEnv')
    const heap = () => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null
    const snapshotCosts = []
    for (const count of [1000, 10000, 50000]) {
      const agent = new TabularQAgent(4)
      for (let i = 0; i < count; i++) agent.applyUpdate(`${i},0,0`, 0, { algorithm: 'seed', target: 1, error: 1, previousEstimate: 0, updatedEstimate: 1, targetFormula: '' })
      const start = performance.now()
      for (let repeat = 0; repeat < 20; repeat++) agent.toSnapshot()
      const fullMs = (performance.now() - start) / 20
      const projected = agent as typeof agent & { toVisibleSnapshot?: (keys: string[]) => unknown }
      const keys = Array.from({ length: 400 }, (_, i) => `${i},0,0`)
      const projectStart = performance.now()
      for (let repeat = 0; repeat < 100; repeat++) projected.toVisibleSnapshot?.(keys)
      snapshotCosts.push({ count, fullMs, visibleMs: projected.toVisibleSnapshot ? (performance.now() - projectStart) / 100 : null })
    }
    const runs = []
    for (let repetition = 0; repetition < 2; repetition++) for (const size of [7, 14, 20]) {
      let seed = 12345
      const originalRandom = Math.random
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
      const engine = new SimulationEngine({ envConfig: { ...createDefaultGridWorldConfig(), width: size, height: size, goals: [{ x: size - 1, y: size - 1 }], fragiles: Array.from({ length: size === 7 ? 0 : 5 }, (_, i) => ({ x: i + 1, y: 2 })) }, resourceBudget: { maxEpisodeSteps: 1_000_000, maxRecordedSteps: 10_000_000, maxQStates: 1_000_000 }, hyperparams: { alpha: .1, gamma: .9, epsilon: .3 }, speed: { mode: 'batch', stepsPerFrame: 100 } })
      const light = engine as typeof engine & { subscribeUI?: typeof engine.subscribe; getUISnapshot?: typeof engine.getSnapshot }
      let updates = 0
      const unsubscribe = (light.subscribeUI ?? engine.subscribe).call(engine, () => { updates++ })
      const samples = []
      const started = performance.now()
      engine.run({ episodes: 1_000_000 })
      for (let second = 0; second < 10; second++) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        const snapshotStart = performance.now()
        const snapshot = engine.getSnapshot()
        samples.push({ elapsedMs: performance.now() - started, episode: snapshot.episode, episodeSteps: snapshot.stepInCurrentEpisode, totalSteps: snapshot.stats.episodeStatsHistory.reduce((n, row) => n + row.steps, 0) + snapshot.stepInCurrentEpisode, qStates: snapshot.agentSnapshot.kind === 'Q' ? Object.keys(snapshot.agentSnapshot.qTable).length : 0, snapshotMs: performance.now() - snapshotStart, heapBytes: heap() })
      }
      const pauseAt = performance.now(); engine.pause(); const pauseMs = performance.now() - pauseAt
      const resumeAt = performance.now(); engine.resume(); const resumeMs = performance.now() - resumeAt
      const stopAt = performance.now(); engine.restartEpisode(); const stopMs = performance.now() - stopAt
      unsubscribe(); Math.random = originalRandom
      runs.push({ size, repetition, updates, samples, pauseMs, resumeMs, stopMs })
    }
    return { userAgent: navigator.userAgent, snapshotCosts, runs }
  })
  mkdirSync('benchmarks/results', { recursive: true })
  writeFileSync(`benchmarks/results/${process.env.BENCH_LABEL ?? 'latest'}.json`, JSON.stringify(results, null, 2))
  console.log(JSON.stringify({ snapshotCosts: results.snapshotCosts, runs: results.runs.map(r => ({ size: r.size, repetition: r.repetition, steps: r.samples.at(-1)?.totalSteps, states: r.samples.at(-1)?.qStates, updates: r.updates, pauseMs: r.pauseMs, stopMs: r.stopMs })) }))
})

test('retained Q rows and transition history cost after explicit GC', async ({ page, context }) => {
  await page.goto('./')
  const cdp = await context.newCDPSession(page)
  const retained = []
  for (const [kind, count] of [['q', 10000], ['q', 50000], ['q', 100000], ['history', 100000]] as const) {
    await page.reload()
    // Preload modules before taking the baseline, to exclude source compilation/module objects.
    await page.evaluate(async () => { for (const path of ['/RL-Playground/src/core/agents/TabularQAgent.ts', '/RL-Playground/src/core/engine/SimulationEngine.ts']) await import(path) })
    await cdp.send('HeapProfiler.collectGarbage')
    const before = await cdp.send('Runtime.getHeapUsage')
    const metrics = await page.evaluate(async ({ kind, count }) => {
      const path = kind === 'q' ? '/RL-Playground/src/core/agents/TabularQAgent.ts' : '/RL-Playground/src/core/engine/SimulationEngine.ts'
      if (kind === 'q') {
        const { TabularQAgent } = await import(path) as typeof import('../src/core/agents/TabularQAgent')
        const agent = new TabularQAgent(4)
        for (let i = 0; i < count; i++) agent.applyUpdate(`${i % 20},${Math.floor(i / 20) % 20},${Math.floor(i / 400)},0,0`, 0, { algorithm: 'seed', target: 1, error: 1, previousEstimate: 0, updatedEstimate: 1, targetFormula: '' })
        Object.defineProperty(globalThis, '__benchmarkRetained', { value: agent, configurable: true })
        return { states: agent.size, estimatedBytes: agent.estimatedBytes }
      }
      const { SimulationEngine } = await import(path) as typeof import('../src/core/engine/SimulationEngine')
      const engine = new SimulationEngine({ resourceBudget: { maxEpisodeSteps: 1000, maxRecordedSteps: count + 1 }, hyperparams: { alpha: .1, gamma: .9, epsilon: 0 } })
      for (let i = 0; i < count; i++) engine.step()
      Object.defineProperty(globalThis, '__benchmarkRetained', { value: engine, configurable: true })
      return { states: engine.getResourceMetrics().qStates, recordedSteps: engine.getResourceMetrics().recordedSteps }
    }, { kind, count })
    await cdp.send('HeapProfiler.collectGarbage')
    const after = await cdp.send('Runtime.getHeapUsage')
    retained.push({ kind, count, ...metrics, baselineBytes: before.usedSize, retainedBytes: after.usedSize, deltaBytes: after.usedSize - before.usedSize, bytesPerItem: (after.usedSize - before.usedSize) / count })
  }
  mkdirSync('benchmarks/results', { recursive: true })
  writeFileSync('benchmarks/results/retained-costs.json', JSON.stringify(retained, null, 2))
  console.log(JSON.stringify(retained))
})
