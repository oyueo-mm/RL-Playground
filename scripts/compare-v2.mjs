import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'

// Serve pristine b053652 on 4175 and the working tree on 4176 before running.
// Actual mounted React simulator, alternating order, same seeds/config and one browser.
const browser=await chromium.launch({channel:'msedge',headless:true})
const results=[]
try {
 for(let repeat=0;repeat<2;repeat++) for(const size of [7,20]) for(const variant of repeat===0?['before','after-off','after-on']:['after-on','after-off','before']) {
  const page=await browser.newPage({viewport:{width:1366,height:768}})
  await page.goto(`http://127.0.0.1:${variant==='before'?4175:4176}/RL-Playground/`)
  await page.getByTestId('nav-environment').click()
  if(variant!=='before') {
   await page.getByRole('button',{name:'설정',exact:true}).click()
   await page.getByRole('tab',{name:'시각화 설정',exact:true}).click()
   for(const id of ['toggle-rewards','toggle-live-rewards','toggle-reward-animation'])await page.getByTestId(id).setChecked(variant==='after-on')
   await page.getByRole('button',{name:'설정',exact:true}).click()
  }
  const sample=await page.evaluate(async size=>{
   const {engine}=await import('/RL-Playground/src/ui/engine.ts')
   const {createDefaultGridWorldConfig}=await import('/RL-Playground/src/core/environments/gridworld/GridWorldEnv.ts')
   const config={...createDefaultGridWorldConfig(),width:size,height:size,goals:[{x:size-1,y:size-1}],fragiles:Array.from({length:size===7?0:5},(_,i)=>({x:i+1,y:2}))}
   engine.reset({envConfig:config,hyperparams:{alpha:.1,gamma:.9,epsilon:.3}})
   engine.setSpeed({mode:'batch',stepsPerFrame:100})
   let seed=12345;const original=Math.random;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
   let updates=0,mutations=0,maxAnimatedNodes=0,sampling=true,last=performance.now()
   const unsubscribe=engine.subscribeUI(()=>updates++)
   const observer=new MutationObserver(records=>{mutations+=records.length;maxAnimatedNodes=Math.max(maxAnimatedNodes,document.querySelectorAll('[data-testid="reward-animation"]').length)})
   const root=document.querySelector('.workspace-stage');observer.observe(root,{subtree:true,childList:true,characterData:true})
   const frames=[]
   const frame=()=>{if(!sampling)return;const now=performance.now();frames.push(now-last);last=now;requestAnimationFrame(frame)};requestAnimationFrame(frame)
   const started=performance.now();engine.run({episodes:1000000});await new Promise(resolve=>setTimeout(resolve,5000))
   const pauseAt=performance.now();engine.pause();const pauseMs=performance.now()-pauseAt,elapsedMs=performance.now()-started
   sampling=false;observer.disconnect();unsubscribe();Math.random=original;frames.sort((a,b)=>a-b)
   const metrics=engine.getResourceMetrics()
   return{size,elapsedMs,totalSteps:metrics.totalSteps,stepsPerSecond:metrics.totalSteps/(elapsedMs/1000),uiUpdates:updates,domMutationRecords:mutations,maxAnimatedNodes,frameP95Ms:frames[Math.floor(frames.length*.95)],pauseMs,pauseReason:metrics.pauseReason}
  },size)
  results.push({variant,repeat,...sample});await page.close()
 }
 writeFileSync('benchmarks/results/v2-paired-ui.json',JSON.stringify({baseline:'b053652271c705814c95d79524ed340eeb7a9e8e',conditions:'Edge headless 1366x768, actual mounted React simulator, policy/value/path enabled, seed12345, alpha .1 gamma .9 epsilon .3, batch100, default budgets, 5s x2, alternating variants; no concurrent test suites.',results},null,2)+'\n')
 console.log(JSON.stringify(results))
} finally {await browser.close()}
