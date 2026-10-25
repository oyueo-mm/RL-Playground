import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'

// Serve pristine 32b7a0e on 4175 and current source on 4176. Run without other suites.
const browser=await chromium.launch({channel:'msedge',headless:true})
const results=[]
try {
 for(let repeat=0;repeat<2;repeat++) for(const map of ['default7','preset20','preset32','preset48']) for(const variant of repeat===0?['before','normal','turbo']:['turbo','normal','before']) {
  const page=await browser.newPage({viewport:{width:1366,height:768}})
  await page.goto(`http://127.0.0.1:${variant==='before'?4175:4176}/RL-Playground/`)
  await page.getByTestId('nav-environment').click()
  await page.getByRole('button',{name:'설정',exact:true}).click()
  await page.getByRole('tab',{name:'시각화 설정',exact:true}).click()
  for(const id of ['toggle-policy','toggle-value','toggle-rewards','toggle-live-rewards','toggle-reward-animation'])await page.getByTestId(id).setChecked(true)
  await page.getByRole('button',{name:'설정',exact:true}).click()
  if(variant==='turbo')await page.getByTestId('training-mode').selectOption('turbo')
  await page.evaluate(async map=>{
   const {engine}=await import('/RL-Playground/src/ui/engine.ts')
   const {SimulationEngine}=await import('/RL-Playground/src/core/engine/SimulationEngine.ts')
   const {createDefaultGridWorldConfig}=await import('/RL-Playground/src/core/environments/gridworld/GridWorldEnv.ts')
   const {ENVIRONMENT_PRESETS}=await import('/RL-Playground/src/data/presets/manifest.ts')
   const {draftToGridWorldConfig}=await import('/RL-Playground/src/viz/controls/envEditorDraft.ts')
   const index={preset20:18,preset32:26,preset48:29}[map]
   const config=index===undefined?createDefaultGridWorldConfig():draftToGridWorldConfig(ENVIRONMENT_PRESETS[index].draft)
   const warm=new SimulationEngine({envConfig:config});for(let i=0;i<2500;i++)warm.step()
   engine.reset({envConfig:config,hyperparams:{alpha:.1,gamma:.9,epsilon:.3}})
   engine.setResourceBudget({maxQStates:100000,maxRecordedSteps:500000,maxEpisodeSteps:10000,maxDetailedEpisodes:100})
   engine.setSpeed({mode:'batch',stepsPerFrame:100})
   await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)
  },map)
  const cdp=await page.context().newCDPSession(page)
  await cdp.send('Performance.enable');await cdp.send('HeapProfiler.collectGarbage')
  const heapBefore=await cdp.send('Runtime.getHeapUsage'),cpuBefore=await cdp.send('Performance.getMetrics')
  const sample=await page.evaluate(async turbo=>{
   const {engine}=await import('/RL-Playground/src/ui/engine.ts')
   let seed=12345;const random=Math.random;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
   let updates=0,sampling=true,last=performance.now(),maxAnimations=0
   const unsubscribe=engine.subscribeUI(()=>{updates++;maxAnimations=Math.max(maxAnimations,document.querySelectorAll('[data-testid="reward-animation"]').length)})
   const frames=[]
   const frame=()=>{if(!sampling)return;const now=performance.now();frames.push(now-last);last=now;requestAnimationFrame(frame)};requestAnimationFrame(frame)
   const started=performance.now();engine.run({episodes:1000000,turbo});await new Promise(resolve=>setTimeout(resolve,5000))
   sampling=false;frames.sort((a,b)=>a-b);Math.random=random;unsubscribe()
   return{elapsedMs:performance.now()-started,updates,maxAnimations,frameP95Ms:frames[Math.floor(frames.length*.95)],frameMaxMs:Math.max(...frames),metrics:engine.getResourceMetrics(),gridCells:document.querySelectorAll('[data-testid="learning-grid"] [data-testid^="cell-"]').length,policyOverlays:document.querySelectorAll('[data-testid="learning-grid"] [data-testid="policy-overlay"]').length}
  },variant==='turbo')
  const pauseStarted=Date.now();await page.getByTestId('playback-pause').click();const pauseInputMs=Date.now()-pauseStarted
  const after=await page.evaluate(async()=>{const {engine}=await import('/RL-Playground/src/ui/engine.ts');const s=engine.getUISnapshot();return{turbo:s.turbo,status:s.status,metrics:engine.getResourceMetrics()}})
  await cdp.send('HeapProfiler.collectGarbage');const heapAfter=await cdp.send('Runtime.getHeapUsage'),cpuAfter=await cdp.send('Performance.getMetrics')
  const metric=(response,name)=>response.metrics.find(m=>m.name===name)?.value??0
  const row={variant,repeat,map,...sample,pauseInputMs,stepsPerSecond:sample.metrics.totalSteps*1000/sample.elapsedMs,episodesPerSecond:sample.metrics.completedEpisodes*1000/sample.elapsedMs,taskCpuPercent:(metric(cpuAfter,'TaskDuration')-metric(cpuBefore,'TaskDuration'))*100000/sample.elapsedMs,scriptCpuPercent:(metric(cpuAfter,'ScriptDuration')-metric(cpuBefore,'ScriptDuration'))*100000/sample.elapsedMs,heapBefore:heapBefore.usedSize,heapAfter:heapAfter.usedSize,after}
  if(sample.metrics.pauseReason)throw new Error(`Budget reached; sample cannot serve as throughput comparison: ${JSON.stringify(row)}`)
  if(variant==='turbo'&&(sample.gridCells!==0||sample.updates>12))throw new Error('Turbo visual suppression / summary cadence failed')
  results.push(row);console.log(JSON.stringify({variant,repeat,map,stepsPerSecond:row.stepsPerSecond,updates:row.updates,pauseInputMs}))
  await page.close()
 }
 writeFileSync('benchmarks/results/turbo-paired.json',JSON.stringify({baseline:'32b7a0e1df26f500843055157a4225911f2d2013',conditions:'Edge headless 1366x768; actual mounted React simulator; all visual preferences ON in all variants (temporarily unmounted in turbo); seed12345; alpha .1 gamma .9 epsilon .3; batch100 normal; same default budgets; 2500 isolated warmup steps; 5s x2, reverse variant order on repetition 2; no concurrent suites. CDP task/script CPU are main-renderer metrics, not OS process CPU.',results},null,2)+'\n')
} finally {await browser.close()}
