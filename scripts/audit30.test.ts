import { writeFileSync } from 'node:fs'
import { describe,expect,it } from 'vitest'
import { ENVIRONMENT_PRESETS } from '../src/data/presets/manifest'
import { auditStateGraph,auditStatic } from '../src/data/presets/audit'
import { draftToGridWorldConfig } from '../src/viz/controls/envEditorDraft'
import { GridWorldEnv } from '../src/core/environments/gridworld/GridWorldEnv'
import summaryJSON from '../src/data/presets/auditSummary.json?raw'

describe('bounded full-state audit and declared gimmick bypass checks',()=>{
  it('distinguishes proven safety, a trap and incomplete exploration',()=>{
    const base=draftToGridWorldConfig(ENVIRONMENT_PRESETS[0].draft)
    expect(auditStateGraph(base,1).status).toBe('incomplete')
    const safe={...base,width:3,height:3,start:{x:0,y:0},goals:[{x:2,y:2}],walls:[]}
    expect(auditStateGraph(safe,100)).toMatchObject({status:'complete',losingStates:0,successReachable:true})
    const trap={...safe,oneWays:[{x:1,y:0,direction:0 as const}]}
    expect(auditStatic(trap).blockedArrows).toEqual(['1,0'])
    expect(auditStateGraph(trap,100).losingStates).toBeGreaterThan(0)
  })
  it('forks all dynamic state independently, without changing original episodes',()=>{
    const preset=ENVIRONMENT_PRESETS.find(p=>p.draft.fragiles?.length&&p.draft.switches?.length)!
    const env=new GridWorldEnv(draftToGridWorldConfig(preset.draft)),before=env.getState(),copy=env.fork()
    for(const a of preset.solution)copy.step(a)
    expect(copy.isTerminal(copy.getState())).toBe(true);expect(env.getState()).toBe(before)
    expect(env.getRenderModel().goals).toHaveLength(preset.draft.goals.length)
  })
  it('records all thirty static and bounded dynamic audits without treating limits as passes',()=>{
    const results=ENVIRONMENT_PRESETS.map(p=>{
      const config=draftToGridWorldConfig(p.draft),staticAudit=auditStatic(config)
      const witnessEnv=new GridWorldEnv(config)
      for(const[index,a]of p.solution.entries())expect(witnessEnv.step(a).done).toBe(index===p.solution.length-1)
      expect(witnessEnv.getRenderModel().goals).toEqual([])
      expect(staticAudit.blockedArrows).toEqual([])
      expect(staticAudit.cannotReturn).toEqual([])
      const dynamic=auditStateGraph(config,5000)
      if(dynamic.status==='incomplete')expect(dynamic.losingStates).toBeNull()
      if(dynamic.losingWitness){
        const env=new GridWorldEnv(config);for(const a of dynamic.losingWitness)env.step(a)
        expect(auditStateGraph(config,5000,undefined,env)).toMatchObject({status:'complete',successReachable:false})
      }
      const bypass=Object.fromEntries((['switch','portal','fragile'] as const).filter(k=>k==='switch'?config.switches?.length:k==='portal'?config.portals?.length:config.fragiles?.length).map(k=>{
        const result=auditStateGraph(config,5000,k)
        // Any discovered bypass witness must itself replay successfully in the original engine.
        if(result.witness){const env=new GridWorldEnv(config);for(const a of result.witness)env.step(a);expect(env.isTerminal(env.getState())).toBe(true)}
        return[k,{...result,meaning:result.successReachable?'bypass-found':result.status==='complete'?'required-proven':'incomplete'}]
      }))
      const summary=(JSON.parse(summaryJSON) as Record<string,unknown>)[p.id]
      expect(summary).toEqual({status:dynamic.status,losingStates:dynamic.losingStates,gimmicks:Object.fromEntries(Object.entries(bypass).map(([k,v])=>[k,v.meaning]))})
      return{id:p.id,name:p.metadata.name,witness:{status:'success',steps:p.solution.length,remainingGoals:witnessEnv.getRenderModel().goals.length,finalState:witnessEnv.getState()},staticAudit,dynamic,bypass}
    })
    writeFileSync('docs/preset30-audit.json',JSON.stringify({stateBudget:5000,semantics:'Full actual TS states; static doors-open checks are not dynamic proofs. Optional portals/fragiles are not automatically design failures.',results},null,2))
    expect(results).toHaveLength(30)
  },120000)
})
