import { describe, expect, it } from 'vitest'
import { DemoPlayback, ShuffleBag, demoInterval } from './demoPlayback'
import { ENVIRONMENT_PRESETS } from '../data/presets/manifest'
import { GridWorldEnv } from '../core/environments/gridworld/GridWorldEnv'
import { draftToGridWorldConfig } from '../viz/controls/envEditorDraft'
const random = (initial = 7) => { let seed = initial; return () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296 } }
describe('Official randomized home playback', () => {
  it('draws every preset once in the first bag, five per tier, without active duplicates', () => {
    const bag = new ShuffleBag(ENVIRONMENT_PRESETS.map(p=>p.id),random()), active: string[] = [], seen: string[] = []
    for (let i=0;i<30;i++) { const id=bag.next(new Set(active)); expect(active).not.toContain(id);seen.push(id);active.push(id);if(active.length>4)active.shift() }
    expect(new Set(seen).size).toBe(30)
    for(const tier of ['Easy','Medium','Hard','Very Hard','Extreme'])expect(seen.filter(id=>ENVIRONMENT_PRESETS.find(p=>p.id===id)!.metadata.difficulty.en===tier)).toHaveLength(6)
  })
  it('is deterministic with injected RNG and always chooses four distinct new maps on shuffle', () => {
    const a=new DemoPlayback(random()),b=new DemoPlayback(random())
    expect(a.views().map(v=>v.preset.id)).toEqual(b.views().map(v=>v.preset.id))
    for(let i=0;i<100;i++){const old=a.views().map(v=>v.preset.id);a.shuffle(i);const next=a.views().map(v=>v.preset.id);expect(new Set(next).size).toBe(4);expect(next.some(id=>old.includes(id))).toBe(false)}
  })
  it('advances four actual independent environments and preserves frame identity for unchanged slots', () => {
    const playback=new DemoPlayback(random()), initial=playback.views()
    expect(playback.tick(1)).toBe(false);expect(playback.views()[0]).toBe(initial[0])
    playback.tick(450)
    for(const [i,view]of playback.views().entries()) {const env=new GridWorldEnv(draftToGridWorldConfig(view.preset.draft));env.step(view.preset.solution[0]);expect(view.model).toEqual(env.getRenderModel());expect(view.step).toBe(1);expect(initial[i].step).toBe(0)}
  })
  it('replaces completed cards independently, exposes every map and never duplicates during long playback', () => {
    const playback=new DemoPlayback(random()),seen=new Set(playback.views().map(v=>v.preset.id));let independent=false,success=false
    for(let now=80;now<600000;now+=80){const before=playback.views();playback.tick(now);const after=playback.views();expect(new Set(after.map(v=>v.preset.id)).size).toBe(4);after.forEach(v=>{seen.add(v.preset.id);if(v.done){expect(v.model.goals).toEqual([]);success=true}});const changed=after.filter((v,i)=>v.preset.id!==before[i].preset.id);if(changed.length===1){independent=true;after.forEach((v,i)=>{if(v.preset.id===before[i].preset.id)expect(v.step).toBeGreaterThanOrEqual(before[i].step)})}}
    expect(independent).toBe(true);expect(success).toBe(true);expect(seen.size).toBe(30)
  })
  it('uses bounded length-aware intervals without skipping actions', () => {expect(demoInterval(10)).toBe(450);expect(demoInterval(152)).toBe(80);expect(demoInterval(100)).toBe(120)})
})
