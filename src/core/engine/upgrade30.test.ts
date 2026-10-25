import { expect,it,vi } from 'vitest'
import { SimulationEngine } from './SimulationEngine'
import { createDefaultGridWorldConfig } from '../environments/gridworld/GridWorldEnv'
import { Scheduler,type TimerSource } from './Scheduler'

function timer(){let clock=0,next=()=>{};const source:TimerSource={now:()=>clock,setTimeout:fn=>{next=fn;return 1},clearTimeout:()=>{},requestAnimationFrame:fn=>{next=fn;return 2},cancelAnimationFrame:()=>{}};return{source,fire:()=>{clock+=250;next()}}}
it.each(['q-learning','sarsa'])('%s policy uses 250ms, stops on full-state repeats, never creates Q rows and restores training speed',algorithmId=>{
 const t=timer(),engine=new SimulationEngine({algorithmId,envConfig:{...createDefaultGridWorldConfig(),start:{x:0,y:5}},timerSource:t.source,speed:{mode:'batch',stepsPerFrame:100}})
 const before=engine.getSnapshot().agentSnapshot
 engine.run({episodes:1,greedy:true})
 expect(engine.getSpeed()).toEqual({mode:'interval',intervalMs:250})
 engine.pause();expect(engine.getSnapshot().isGreedyRun).toBe(true);engine.resume()
 for(let i=0;i<30&&engine.getSnapshot().status==='running';i++)t.fire()
 expect(engine.getSnapshot().policyLoopDetected).toBe(true)
 expect(engine.getSnapshot().stats.episodeStatsHistory.at(-1)?.terminationReason).toBe('policy-loop')
 expect(engine.getSnapshot().agentSnapshot).toEqual(before)
 expect(engine.getSpeed()).toEqual({mode:'batch',stepsPerFrame:100})
 engine.run({episodes:1,greedy:true});engine.restartEpisode();expect(engine.getSpeed()).toEqual({mode:'batch',stepsPerFrame:100})
})
it('only cuts off a proven immobile full state; normal blocked exploration continues and bootstraps TD',()=>{
 const config={...createDefaultGridWorldConfig(),start:{x:0,y:1},oneWays:[{x:1,y:1,direction:0}],walls:[{x:1,y:0}]}
 const engine=new SimulationEngine({envConfig:config,hyperparams:{epsilon:1,alpha:.1,gamma:.9}})
 const rng=vi.spyOn(Math,'random').mockReturnValue(.9)
 for(let i=0;i<17;i++)engine.step()
 expect(engine.getSnapshot().stats.episodeStatsHistory[0]).toMatchObject({steps:17,terminationReason:'trapped'})
 expect(engine.getSnapshot().lastTransition).toMatchObject({done:false,truncated:true,cutoffReason:'trapped'})
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
 const before=engine.getSnapshot().agentSnapshot;engine.run({episodes:1,greedy:true});t.fire()
 expect(engine.getSnapshot().stats.episodeStatsHistory.at(-1)?.terminationReason).toBe('goal')
 expect(engine.getSpeed()).toEqual(speed);expect(engine.getSnapshot().agentSnapshot).toEqual(before)
 engine.run({episodes:1,greedy:true});engine.reset();expect(engine.getSpeed()).toEqual(speed)
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
