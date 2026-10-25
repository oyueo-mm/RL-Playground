import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'

// Start the pristine 4e63dd1 checkout on 4175 and current checkout on 4176.
// Alternating order, identical seeds/config/budgets, no home animation, one browser.
const browser=await chromium.launch({channel:'msedge',headless:true})
const results=[]
try {
 for(let repeat=0;repeat<2;repeat++)for(const size of [7,20])for(const variant of repeat===0?['before','after']:['after','before']){
  const page=await browser.newPage({viewport:{width:1366,height:768}})
  await page.goto(`http://127.0.0.1:${variant==='before'?4175:4176}/RL-Playground/`)
  await page.getByTestId('nav-environment').click()
  const cdp=await page.context().newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage')
  const before=await cdp.send('Runtime.getHeapUsage')
  const sample=await page.evaluate(async size=>{
   const {SimulationEngine}=await import('/RL-Playground/src/core/engine/SimulationEngine.ts')
   const {createDefaultGridWorldConfig}=await import('/RL-Playground/src/core/environments/gridworld/GridWorldEnv.ts')
   const config={...createDefaultGridWorldConfig(),width:size,height:size,goals:[{x:size-1,y:size-1}],fragiles:Array.from({length:size===7?0:5},(_,i)=>({x:i+1,y:2}))}
   const warmup=new SimulationEngine({envConfig:config});for(let i=0;i<5000;i++)warmup.step()
   let seed=12345;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
   const engine=new SimulationEngine({envConfig:config,hyperparams:{alpha:.1,gamma:.9,epsilon:.3},speed:{mode:'batch',stepsPerFrame:100}})
   window.__trainingBench=engine
   let updates=0;const unsubscribe=engine.subscribeUI(()=>updates++)
   const frames=[];let last=performance.now(),sampling=true
   const frame=()=>{if(!sampling)return;const now=performance.now();frames.push(now-last);last=now;requestAnimationFrame(frame)};requestAnimationFrame(frame)
   const start=performance.now();engine.run({episodes:1000000});await new Promise(r=>setTimeout(r,5000))
   const pauseAt=performance.now();engine.pause();const pauseMs=performance.now()-pauseAt,elapsedMs=performance.now()-start
   sampling=false;unsubscribe();frames.sort((a,b)=>a-b)
   const metrics=engine.getResourceMetrics();return{size,elapsedMs,totalSteps:metrics.totalSteps,stepsPerSecond:metrics.totalSteps/(elapsedMs/1000),frameP95Ms:frames[Math.floor(frames.length*.95)],pauseMs,updates,qStates:metrics.qStates,recordedSteps:metrics.recordedSteps,pauseReason:metrics.pauseReason}
  },size)
  await cdp.send('HeapProfiler.collectGarbage');const after=await cdp.send('Runtime.getHeapUsage')
  results.push({variant,repeat,...sample,heapBefore:before.usedSize,heapAfterGcWithEngineRetained:after.usedSize})
  await page.close()
 }
 writeFileSync('benchmarks/results/paired-training-30.json',JSON.stringify({baseline:'4e63dd101e814ca8ee7f56f8f6dfab71ead76f3e',conditions:'1366x768 Edge headless; home unmounted; seed12345; alpha .1 gamma .9 epsilon .3; batch100; default Q100000/record500000/episode10000 budgets; UI subscription; warmup5000; alternating order; 5s x2 each map/version.',results},null,2))
 console.log(JSON.stringify(results.map(({variant,size,stepsPerSecond,frameP95Ms,pauseMs})=>({variant,size,stepsPerSecond,frameP95Ms,pauseMs}))))
} finally {await browser.close()}
