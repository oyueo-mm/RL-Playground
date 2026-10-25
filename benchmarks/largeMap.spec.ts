import { expect,test } from '@playwright/test'
import { writeFileSync } from 'node:fs'

test('large SVG terrain overlays camera and resource-limited training costs',async({page})=>{
 await page.goto('./');await page.getByTestId('nav-environment').click()
 const results=[]
 for(const [width,height] of [[20,20],[32,20],[48,40],[64,64]]){
  const sample=await page.evaluate(async({width,height})=>{
   const {engine}=await import('/RL-Playground/src/ui/engine.ts' as string) as typeof import('../src/ui/engine')
   const {GridWorldEnv,createDefaultGridWorldConfig}=await import('/RL-Playground/src/core/environments/gridworld/GridWorldEnv.ts' as string) as typeof import('../src/core/environments/gridworld/GridWorldEnv')
   const {ENVIRONMENT_PRESETS}=await import('/RL-Playground/src/data/presets/manifest.ts' as string) as typeof import('../src/data/presets/manifest')
   const {draftToGridWorldConfig}=await import('/RL-Playground/src/viz/controls/envEditorDraft.ts' as string) as typeof import('../src/viz/controls/envEditorDraft')
   const config=width===48?draftToGridWorldConfig(ENVIRONMENT_PRESETS.find(p=>p.id==='30_the_endless_labyrinth')!.draft):{...createDefaultGridWorldConfig(),width,height,goals:[{x:width-1,y:height-1}]}
   const start=performance.now();engine.reset({envConfig:config});await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame)
   const renderMs=performance.now()-start,env=new GridWorldEnv(config),stepAt=performance.now()
   for(let i=0;i<100000;i++){env.getState();env.step(i%4);if(env.isTerminal(env.getState()))env.reset()}
   const transitionMs=performance.now()-stepAt
   const gaps:number[]=[];let last=performance.now(),sampling=true
   const frame=()=>{if(!sampling)return;const now=performance.now();gaps.push(now-last);last=now;requestAnimationFrame(frame)};requestAnimationFrame(frame)
   engine.setSpeed({mode:'batch',stepsPerFrame:100});engine.run({episodes:1000000});await new Promise(r=>setTimeout(r,2000))
   const pauseAt=performance.now();engine.pause();const pauseMs=performance.now()-pauseAt;sampling=false
   gaps.sort((a,b)=>a-b)
   return{width,height,renderMs,transitionMs,transitionCalls:100000,frameP95Ms:gaps[Math.floor(gaps.length*.95)],pauseMs,resources:engine.getResourceMetrics(),cells:document.querySelectorAll('[data-testid=learning-grid] [data-testid^=cell-]').length}
  },{width,height})
  expect(sample.cells).toBe(width*height);expect(sample.resources.recordedSteps).toBeLessThanOrEqual(500000)
  await page.getByTestId('learning-grid').getByRole('button',{name:'Zoom in'}).click();await page.getByTestId('learning-grid').getByRole('button',{name:'Fit entire map'}).click()
  results.push(sample)
 }
 writeFileSync('benchmarks/results/large-30-render.json',JSON.stringify({mode:'Actual SVG with policy and value overlays enabled, 2s production-engine run per map. A short observation, not a long-term memory proof.',results},null,2))
})
