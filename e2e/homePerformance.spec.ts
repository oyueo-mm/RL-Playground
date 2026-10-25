import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { navigate } from './helpers'

test('home rendering memory and timer cleanup sample', async ({ page }, info) => {
  await page.addInitScript(() => {
    const originalSet = window.setInterval, originalClear = window.clearInterval
    const active = new Set<number>()
    window.setInterval = ((...args: Parameters<typeof setInterval>) => { const id = originalSet(...args); active.add(id); return id }) as typeof setInterval
    window.clearInterval = id => { active.delete(Number(id)); originalClear(id) }
    Object.defineProperty(window, '__activeIntervals', { get: () => active.size })
  })
  await page.goto('./')
  await page.locator('.demo-gallery').scrollIntoViewIfNeeded()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  await cdp.send('HeapProfiler.collectGarbage'); const before = await cdp.send('Runtime.getHeapUsage')
  const cpuBefore = await cdp.send('Performance.getMetrics')
  const frames = await page.evaluate(async () => {
    const gaps: number[] = []; let previous = performance.now()
    await new Promise<void>(resolve => { const start = previous; const frame = () => { const now = performance.now(); gaps.push(now - previous); previous = now; if (now - start < 5000) requestAnimationFrame(frame); else resolve() }; requestAnimationFrame(frame) })
    return gaps
  })
  const intervals = await page.evaluate(() => (window as unknown as { __activeIntervals: number }).__activeIntervals)
  const cells = await page.locator('.demo-gallery [data-testid^=cell-]').count()
  for (let i = 0; i < 5; i++) { await navigate(page, 'environment'); await navigate(page, 'home') }
  await navigate(page, 'environment')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __activeIntervals: number }).__activeIntervals)).toBe(0)
  await cdp.send('HeapProfiler.collectGarbage'); const after = await cdp.send('Runtime.getHeapUsage')
  const sorted = frames.slice().sort((a,b) => a-b)
  const cpuAfter = await cdp.send('Performance.getMetrics')
  const costs = Object.fromEntries(['ScriptDuration','LayoutDuration','RecalcStyleDuration','TaskDuration'].map(name => [name+'Ms', 1000*((cpuAfter.metrics.find(m=>m.name===name)?.value??0)-(cpuBefore.metrics.find(m=>m.name===name)?.value??0))]))
  const result = { project: info.project.name, label: process.env.HOME_BENCH_LABEL ?? 'after-30', durationMs: 5000, intervals, cells, meanFrameGapMs: frames.reduce((a,b) => a+b,0)/frames.length, p95FrameGapMs: sorted[Math.floor(sorted.length*.95)], beforeGcBytes: before.usedSize, afterFiveCyclesGcBytes: after.usedSize, costsIncludingNavigation: costs }
  mkdirSync('benchmarks/results', { recursive: true }); writeFileSync(`benchmarks/results/${result.label}-home-${info.project.name}.json`, JSON.stringify(result, null, 2))
})

test('30-second live home animation keeps bounded memory and independently rotates maps', async({page},info)=>{
  test.setTimeout(60000)
  await page.addInitScript(()=>{
    const set=window.setInterval,clear=window.clearInterval,ids=new Set<number>()
    window.setInterval=((...args:Parameters<typeof setInterval>)=>{const id=set(...args);ids.add(id);return id})as typeof setInterval
    window.clearInterval=id=>{ids.delete(Number(id));clear(id)}
    Object.defineProperty(window,'__activeIntervals',{get:()=>ids.size})
  })
  await page.goto('./');await page.locator('.demo-gallery').scrollIntoViewIfNeeded()
  const cdp=await page.context().newCDPSession(page),samples=[]
  const seen=new Set<string>()
  for(let second=0;second<=30;second+=5){
    if(second)await page.waitForTimeout(5000)
    const cards=await page.locator('.mini-demo').evaluateAll(nodes=>nodes.map(node=>({id:node.getAttribute('data-scenario')!,step:Number(node.getAttribute('data-step'))})))
    cards.forEach(c=>seen.add(c.id));expect(new Set(cards.map(c=>c.id)).size).toBe(4)
    await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage')
    const intervals=await page.evaluate(()=>(window as unknown as {__activeIntervals:number}).__activeIntervals)
    expect(intervals).toBe(1);samples.push({second,cards,heapBytes:heap.usedSize,intervals})
  }
  expect(seen.size).toBeGreaterThan(4)
  await navigate(page,'environment');expect(await page.evaluate(()=>(window as unknown as {__activeIntervals:number}).__activeIntervals)).toBe(0)
  writeFileSync(`benchmarks/results/after-30-home-30s-${info.project.name}.json`,JSON.stringify({project:info.project.name,samples,uniqueMaps:seen.size},null,2))
})
