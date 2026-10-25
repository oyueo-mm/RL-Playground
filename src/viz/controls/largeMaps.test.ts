import { expect,it } from 'vitest'
import { GridWorldEnv,createDefaultGridWorldConfig } from '../../core/environments/gridworld/GridWorldEnv'
import { draftFromRenderModel,validateDraft,cropFeatures } from './envEditorDraft'
import { parseEnvImport,serializeEnvExport } from './envEditorIO'

it.each([[32,20],[40,32],[48,40],[64,64]])('%i by %i supports real transitions and JSON roundtrips', (width,height)=>{
 const env=new GridWorldEnv({...createDefaultGridWorldConfig(),width,height,goals:[{x:width-1,y:height-1}]})
 const draft=draftFromRenderModel(env.getRenderModel())
 expect(validateDraft(draft)).toEqual([]);expect(parseEnvImport(serializeEnvExport(draft))).toEqual({ok:true,draft})
 for(let i=1;i<width;i++)env.step(3);for(let i=1;i<height;i++)env.step(1)
 expect(env.isTerminal(env.getState())).toBe(true)
})
it('rejects overflow dimensions and retains visible broken-link errors after cropping',()=>{
 expect(()=>new GridWorldEnv({...createDefaultGridWorldConfig(),width:65})).toThrow()
 const env=new GridWorldEnv(createDefaultGridWorldConfig()),draft=draftFromRenderModel(env.getRenderModel())
 const cropped=cropFeatures({...draft,portals:[{id:'P1',ends:[{x:1,y:1},{x:6,y:6}]}],switches:[{x:1,y:2,groupId:'G1'}],toggleWalls:[{x:6,y:5,groupId:'G1'}]},4,4)
 expect(cropped.portals).toEqual([{id:'P1',ends:[{x:1,y:1}]}]);expect(cropped.toggleWalls).toEqual([])
 expect(validateDraft({...draft,width:4,height:4,...cropped})).toContain('Each portal pair must have exactly two endpoints.')
})
