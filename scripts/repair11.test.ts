import { readFileSync, writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { ENVIRONMENT_PRESETS } from '../src/data/presets/manifest'
import { auditStateGraph } from '../src/data/presets/audit'
import { draftToGridWorldConfig } from '../src/viz/controls/envEditorDraft'
import { GridWorldEnv } from '../src/core/environments/gridworld/GridWorldEnv'
import { parseEnvImport } from '../src/viz/controls/envEditorIO'

it('reproduces original softlock and proves the repaired terrain has no losing reachable states', () => {
  const p = ENVIRONMENT_PRESETS[10]
  const parsed = parseEnvImport(readFileSync('docs/preset30-source/json/11_ruin_retrieval.json','utf8'))
  if (!parsed.ok) throw new Error(parsed.error)
  const original = draftToGridWorldConfig(parsed.draft)
  const before = auditStateGraph(original, 20000)
  expect(before).toMatchObject({status:'complete',states:4887,losingStates:624})
  const lost = new GridWorldEnv(original)
  for (const action of before.losingWitness!) lost.step(action)
  expect(auditStateGraph(original,20000,undefined,lost)).toMatchObject({status:'complete',successReachable:false})
  const config = draftToGridWorldConfig(p.draft)
  if (process.env.REPAIR_11) {
    // Leave the two one-use bridges intact; open one permanent crossing between them.
    config.walls = config.walls.filter(pos => !(pos.x === 5 && pos.y === 5))
    const after = auditStateGraph(config,20000)
    expect(after).toMatchObject({status:'complete',losingStates:0})
    const mapPath='src/data/presets/maps/11_ruin_retrieval.json'
    const map=JSON.parse(readFileSync(mapPath,'utf8')); map.walls=config.walls
    writeFileSync(mapPath,JSON.stringify(map,null,2)+'\n')
    const actions=after.witness!,env=new GridWorldEnv(config),events:Record<string,number>={},goalOrder:number[][]=[]
    for(const a of actions){
      const b=env.getRenderModel(),r=env.step(a),n=env.getRenderModel()
      let event=n.agentPos===b.agentPos?'blocked':'move'
      if(n.goals.length<b.goals.length){goalOrder.push(n.agentPos.split(',').map(Number));event='goal'}
      if((n.collapsedFragiles?.length??0)>(b.collapsedFragiles?.length??0))event='fragile'
      if((n.allGoals??[]).includes(n.agentPos)&&n.agentPos!==b.agentPos)event='goal'
      if(r.done)event='success'
      events[event]=(events[event]??0)+1
    }
    writeFileSync('src/data/presets/solutions/11_ruin_retrieval_solution.json',JSON.stringify({id:p.id,name:p.metadata.name,steps:actions.length,actions,goalOrder,events,verifiedBy:'GridWorldEnv.step + complete state graph'},null,2)+'\n')
    writeFileSync('docs/v2-repair11.json',JSON.stringify({removedWall:{x:5,y:5},before,after},null,2)+'\n')
  } else expect(auditStateGraph(config,20000)).toMatchObject({status:'complete',losingStates:0,successReachable:true})
},120000)
