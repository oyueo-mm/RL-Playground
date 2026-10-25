import { expect,it,vi } from 'vitest'
import { SimulationEngine } from './SimulationEngine'
import { createDefaultGridWorldConfig } from '../environments/gridworld/GridWorldEnv'
import { Scheduler,type TimerSource } from './Scheduler'
import { sliderToSpeed } from '../../viz/controls/speedSlider'

function timer(){let clock=0,next=()=>{};const source:TimerSource={now:()=>clock,setTimeout:fn=>{next=fn;return 1},clearTimeout:()=>{},requestAnimationFrame:fn=>{next=fn;return 2},cancelAnimationFrame:()=>{}};return{source,fire:()=>{clock+=250;next()}}}
it.each(['q-learning','sarsa'])('%s policy permits repeats until max steps, changes speed live and preserves Q and training speed',algorithmId=>{
 const t=timer(),engine=new SimulationEngine({algorithmId,envConfig:{...createDefaultGridWorldConfig(),start:{x:0,y:5}},resourceBudget:{maxEpisodeSteps:40},timerSource:t.source,speed:{mode:'batch',stepsPerFrame:100}})
 const before=engine.getSnapshot().agentSnapshot
 engine.run({episodes:1,greedy:true})
 expect(engine.getSpeed()).toEqual(sliderToSpeed(45))
 const steps=engine.getResourceMetrics().totalSteps
 engine.setSpeed(sliderToSpeed(60));expect(engine.getResourceMetrics().totalSteps).toBe(steps)
 expect(engine.getSpeed()).toEqual(sliderToSpeed(60))
 engine.pause();expect(engine.getSnapshot().isGreedyRun).toBe(true)
 engine.setSpeed(sliderToSpeed(30));engine.resume();expect(engine.getSpeed()).toEqual(sliderToSpeed(30))
 for(let i=0;i<20;i++)t.fire()
 expect(engine.getSnapshot().status).toBe('running')
 for(let i=0;i<40&&engine.getSnapshot().status==='running';i++)t.fire()
 expect(engine.getSnapshot().stats.episodeStatsHistory.at(-1)).toMatchObject({steps:40,terminationReason:'truncated'})
 expect(engine.getSnapshot().agentSnapshot).toEqual(before)
 expect(engine.getSpeed()).toEqual({mode:'batch',stepsPerFrame:100})
 engine.run({episodes:1,greedy:true});engine.restartEpisode();expect(engine.getSpeed()).toEqual({mode:'batch',stepsPerFrame:100})
})
it.each(['q-learning','sarsa'])('%s immobile states keep learning until the max step limit',algorithmId=>{
 const config={...createDefaultGridWorldConfig(),wallPenalty:-1,start:{x:0,y:1},oneWays:[{x:1,y:1,direction:0}],walls:[{x:1,y:0}]}
 const engine=new SimulationEngine({algorithmId,envConfig:config,resourceBudget:{maxEpisodeSteps:40},hyperparams:{epsilon:1,alpha:.1,gamma:.9}})
 const rng=vi.spyOn(Math,'random').mockReturnValue(.9)
 for(let i=0;i<17;i++)engine.step()
 expect(engine.getSnapshot().stats.episodeStatsHistory).toHaveLength(0)
 expect(engine.getSnapshot().lastTransition).toMatchObject({done:false,reward:-1})
 expect(engine.getSnapshot().lastTdInfo).not.toBeNull()
 for(let i=17;i<40;i++)engine.step()
 expect(engine.getSnapshot().stats.episodeStatsHistory[0]).toMatchObject({steps:40,terminationReason:'truncated'})
 rng.mockRestore()
 const ordinary=new SimulationEngine({hyperparams:{epsilon:0,alpha:.1,gamma:.9}})
 ordinary.step();expect(ordinary.getSnapshot().stats.episodeStatsHistory).toHaveLength(0)
})
it('fast batches yield through a cancellable timeout and retain the 8ms execution budget',()=>{
 const t=timer(),timeout=vi.spyOn(t.source,'setTimeout'),raf=vi.spyOn(t.source,'requestAnimationFrame'),cancel=vi.spyOn(t.source,'clearTimeout')
 let clock=0;t.source.now=()=>clock++
 const work=vi.fn(()=>true),scheduler=new Scheduler(t.source,{mode:'batch',stepsPerFrame:100})
 scheduler.start({performUnit:work,afterBatch:()=>{}})
 expect(work.mock.calls.length).toBeLessThanOrEqual(8);expect(timeout).toHaveBeenCalledWith(expect.any(Function),0);expect(raf).not.toHaveBeenCalled()
 scheduler.stop();expect(cancel).toHaveBeenCalledWith(1)
})

it('restores the exact training speed after successful policy completion and reset',()=>{
 const t=timer(),speed={mode:'batch' as const,stepsPerFrame:137}
 const engine=new SimulationEngine({timerSource:t.source,speed,envConfig:{...createDefaultGridWorldConfig(),start:{x:0,y:2},goals:[{x:0,y:0}]}})
 const before=engine.getSnapshot().agentSnapshot;engine.run({episodes:1,greedy:true});engine.setSpeed(sliderToSpeed(70));t.fire()
 expect(engine.getSnapshot().stats.episodeStatsHistory.at(-1)?.terminationReason).toBe('goal')
 expect(engine.getSpeed()).toEqual(speed);expect(engine.getSnapshot().agentSnapshot).toEqual(before)
 engine.run({episodes:1,greedy:true});engine.setSpeed(sliderToSpeed(20));engine.reset();expect(engine.getSpeed()).toEqual(speed)
})

it.each(['q-learning','sarsa'])('%s produces identical learning transitions and Q values under changed scheduling cadence',algorithmId=>{
 const run=(batch:boolean)=>{
  let seed=19,next=()=>{};const rng=vi.spyOn(Math,'random').mockImplementation(()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296})
  const source:TimerSource={now:()=>0,setTimeout:fn=>{next=fn;return 1},clearTimeout:()=>{},requestAnimationFrame:fn=>{next=fn;return 2},cancelAnimationFrame:()=>{}}
  const engine=new SimulationEngine({algorithmId,timerSource:source,speed:{mode:'batch',stepsPerFrame:100}})
  if(batch){engine.run({episodes:1000000});while(engine.getResourceMetrics().totalSteps<5000)next();engine.pause()}
  else for(let i=0;i<5000;i++)engine.step()
  const s=engine.getSnapshot();rng.mockRestore();return{state:s.currentState,agent:s.agentSnapshot,stats:s.stats,transition:s.lastTransition}
 }
 expect(run(true)).toEqual(run(false))
})
