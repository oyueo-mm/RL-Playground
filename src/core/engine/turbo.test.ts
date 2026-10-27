import { expect, it, vi } from 'vitest'
import { SimulationEngine } from './SimulationEngine'
import { createDefaultGridWorldConfig, GridWorldEnv } from '../environments/gridworld/GridWorldEnv'
import { TabularQAgent } from '../agents/TabularQAgent'
import type { TimerSource } from './Scheduler'
import { Scheduler } from './Scheduler'
import { GREEDY_PLAYBACK_SPEED, sliderToSpeed } from '../../viz/controls/speedSlider'

function timer() {
  let time=0,id=0
  const pending=new Map<number,()=>void>()
  const source:TimerSource={now:()=>time++,setTimeout:fn=>{pending.set(++id,fn);return id},clearTimeout:n=>{pending.delete(n)},requestAnimationFrame:fn=>{pending.set(++id,fn);return id},cancelAnimationFrame:n=>{pending.delete(n)}}
  return {source,fire:()=>{const first=pending.entries().next().value;if(first){pending.delete(first[0]);first[1]()}},advance:(ms:number)=>{time+=ms},pending}
}
const config={...createDefaultGridWorldConfig(),width:4,height:4,start:{x:0,y:1},goals:[{x:0,y:0},{x:3,y:3}],walls:[],bombs:[{x:2,y:2}]}

it.each(['q-learning','sarsa'])('%s has identical seeded transitions, Q values and retained history in normal and turbo, including mixed continuation',algorithmId=>{
  const run=(modes:boolean[])=>{
    let seed=991
    const rng=vi.spyOn(Math,'random').mockImplementation(()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296})
    const t=timer(),engine=new SimulationEngine({algorithmId,envConfig:config,timerSource:t.source,speed:{mode:'batch',stepsPerFrame:100},hyperparams:{alpha:.2,gamma:.9,epsilon:.35},resourceBudget:{maxEpisodeSteps:40,maxRecordedSteps:500,maxDetailedEpisodes:5}})
    try {
      for(const turbo of modes){engine.run({episodes:60/modes.length,turbo});for(let i=0;i<10000&&engine.getSnapshot().status!=='idle';i++)t.fire()}
      const s=engine.getSnapshot()
      expect(s.episode).toBe(60);expect(s.resources!.recordedSteps).toBeLessThanOrEqual(500)
      return {agent:s.agentSnapshot,state:s.currentState,transition:s.lastTransition,td:s.lastTdInfo,stats:s.stats,steps:s.resources!.totalSteps}
    } finally {rng.mockRestore()}
  }
  expect(run([true])).toEqual(run([false]))
  expect(run([false,true,false])).toEqual(run([false]))
})

it('publishes summaries at 750ms without generating grid or Q projections, and pauses immediately',()=>{
  const t=timer(),engine=new SimulationEngine({timerSource:t.source,envConfig:{...config,start:{x:0,y:0},walls:[{x:1,y:0},{x:0,y:1}]},resourceBudget:{maxEpisodeSteps:100000}})
  const seen:number[]=[];engine.subscribeUI(s=>{if(s.turbo)seen.push(s.turbo.totalSteps)})
  engine.run({episodes:1000,turbo:true})
  const grid=vi.spyOn(GridWorldEnv.prototype,'getRenderModel'),q=vi.spyOn(TabularQAgent.prototype,'toVisibleSnapshot')
  const base=engine.getUISnapshot()
  for(let i=0;i<80;i++)t.fire()
  const next=engine.getUISnapshot()
  expect(next.turbo!.totalSteps).toBeGreaterThan(base.turbo!.totalSteps)
  expect(next.envRenderModel).toBe(base.envRenderModel);expect(next.agentSnapshot).toBe(base.agentSnapshot)
  expect(grid).not.toHaveBeenCalled();expect(q).not.toHaveBeenCalled()
  expect(seen.length).toBeGreaterThan(2);expect(seen.length).toBeLessThan(8)
  engine.pause();expect(engine.getUISnapshot().turbo!.state).toBe('paused')
  const paused=engine.getUISnapshot().turbo!;t.advance(10000)
  expect(engine.getUISnapshot().turbo!.elapsedMs).toBe(paused.elapsedMs)
  engine.resume();expect(engine.getUISnapshot().turbo!.totalSteps).toBeGreaterThan(paused.totalSteps)
  engine.restartEpisode();expect(engine.getSnapshot().turbo).toMatchObject({state:'stopped',active:false})
  grid.mockRestore();q.mockRestore()
})

it('retains shared Q and completed statistics on stop, clears on reset and resumes greedy at Normal speed',()=>{
  const t=timer(),speed=sliderToSpeed(95),engine=new SimulationEngine({timerSource:t.source,speed,envConfig:config,resourceBudget:{maxEpisodeSteps:5,maxRecordedSteps:10,maxDetailedEpisodes:2}})
  engine.run({episodes:100,turbo:true});while(engine.getSnapshot().status==='running')t.fire()
  const trained=engine.getSnapshot()
  expect(trained.turbo).toMatchObject({state:'completed',active:false,completedEpisodes:100,targetEpisodes:100,progress:1})
  expect(trained.resources!.recordedSteps).toBeLessThanOrEqual(10)
  expect(engine.getSpeed()).toEqual(speed)
  engine.run({episodes:1,greedy:true})
  expect(engine.getSnapshot().turbo).toBeUndefined();expect(engine.getSpeed()).toEqual(GREEDY_PLAYBACK_SPEED)
  engine.setSpeed(sliderToSpeed(60));engine.pause();engine.resume();engine.restartEpisode()
  expect(engine.getSpeed()).toEqual(speed);expect(engine.getSnapshot().agentSnapshot).toEqual(trained.agentSnapshot)
  engine.run({episodes:1000,turbo:true});engine.pause()
  const before=engine.getSnapshot();engine.run({episodes:1,turbo:false})
  expect(engine.getSnapshot()).toEqual(before)
  engine.restartEpisode();expect(engine.getSnapshot().agentSnapshot).toEqual(before.agentSnapshot)
  engine.reset();expect(engine.getSnapshot().episode).toBe(0);expect(engine.getSnapshot().turbo).toBeUndefined();expect(t.pending.size).toBe(0)
})

it('honors Q budgets, manual resume and maximum episode steps instead of new loop/trap cutoffs',()=>{
  const t=timer(),engine=new SimulationEngine({timerSource:t.source,envConfig:config,hyperparams:{alpha:.1,gamma:.9,epsilon:1},resourceBudget:{maxQStates:10,maxEpisodeSteps:30}})
  engine.run({episodes:1000,turbo:true});for(let i=0;i<200&&engine.getSnapshot().status==='running';i++)t.fire()
  expect(engine.getSnapshot().status).toBe('paused');expect(engine.getSnapshot().resources!.pauseReason).toBe('q-states')
  expect(engine.getSnapshot().turbo!.progress).toBeLessThan(1)
  expect(engine.getSnapshot().resources!.qStates).toBeLessThanOrEqual(10)
  engine.setResourceBudget({maxQStates:1000});engine.resume();for(let i=0;i<20;i++)t.fire();engine.restartEpisode()
  expect(engine.getSnapshot().stats.episodeStatsHistory.length).toBeGreaterThan(0)
  expect(engine.getSnapshot().stats.episodeStatsHistory.every(e=>['goal','bomb','truncated'].includes(e.terminationReason))).toBe(true)
  expect(engine.getSnapshot().stats.episodeStatsHistory.some(e=>e.terminationReason==='truncated')).toBe(true)
})

it.each([NaN,Infinity,0,-1,1.5,Number.MAX_SAFE_INTEGER+1])('rejects unsafe target %s',episodes=>{
  expect(()=>new SimulationEngine().run({episodes,turbo:true})).toThrow()
})

it.each(['pause','reset'] as const)('honors synchronous %s during the initial turbo publication without starting a stray timer',action=>{
  const t=timer(),engine=new SimulationEngine({timerSource:t.source})
  const unsubscribe=engine.subscribeUI(s=>{if(s.turbo?.state==='running')engine[action]()})
  engine.run({episodes:100,turbo:true})
  expect(engine.getResourceMetrics().totalSteps).toBe(0);expect(t.pending.size).toBe(0)
  expect(engine.getSnapshot().status).toBe(action==='pause'?'paused':'idle')
  unsubscribe();engine.reset()
})

it('bounds diagnostic-only publications too and freezes completed summary totals',()=>{
  const t=timer(),engine=new SimulationEngine({timerSource:t.source,envConfig:config,resourceBudget:{maxEpisodeSteps:5}})
  let updates=0;engine.subscribe(()=>updates++)
  engine.run({episodes:100000,turbo:true});for(let i=0;i<80;i++)t.fire()
  expect(updates).toBeLessThan(10)
  engine.restartEpisode();const stopped=engine.getSnapshot().turbo
  engine.step();expect(engine.getSnapshot().turbo).toEqual(stopped)
})

it('bounds a frozen-clock chunk and cancels between individual turbo units',()=>{
  const t=timer();t.source.now=()=>0
  const scheduler=new Scheduler(t.source,sliderToSpeed(10)),work=vi.fn(()=>true)
  scheduler.setTurbo(true);scheduler.start({performUnit:work,afterBatch:()=>{}})
  expect(work).toHaveBeenCalledTimes(50000);scheduler.stop();expect(t.pending.size).toBe(0)
  const cancel=vi.fn(()=>{scheduler.stop();return true})
  scheduler.start({performUnit:cancel,afterBatch:()=>{}})
  expect(cancel).toHaveBeenCalledTimes(1);expect(t.pending.size).toBe(0)
})

it.each(['goal','bomb'])('records real %s termination in turbo with unchanged rewards',kind=>{
  const t=timer(),engine=new SimulationEngine({timerSource:t.source,hyperparams:{alpha:0,gamma:.9,epsilon:0},envConfig:{...config,goals:kind==='goal'?[{x:0,y:0}]:[{x:3,y:3}],bombs:kind==='bomb'?[{x:0,y:0}]:[]}})
  engine.run({episodes:3,turbo:true});while(engine.getSnapshot().status==='running')t.fire()
  const s=engine.getSnapshot()
  expect(s.stats.episodeStatsHistory.map(e=>e.terminationReason)).toEqual([kind,kind,kind])
  expect(s.stats.rewardHistory).toEqual(Array(3).fill(kind==='goal'?10:-10))
})
