import { expect,it } from 'vitest'
import { zoomAt, followAgent } from './camera'
it('preserves the pointed map coordinate across zoom, clamps extremes and reverses exactly',()=>{
 const before={zoom:2,x:40,y:-30},point={x:137,y:-84},after=zoomAt(before,1.7,point.x,point.y)
 expect((point.x-after.x)/after.zoom).toBeCloseTo((point.x-before.x)/before.zoom)
 expect((point.y-after.y)/after.zoom).toBeCloseTo((point.y-before.y)/before.zoom)
 expect(zoomAt(after,1/1.7,point.x,point.y)).toEqual(before)
 expect(zoomAt(before,100,0,0).zoom).toBe(24);expect(zoomAt(before,.001,0,0).zoom).toBe(.25)
})
it('centers the actual agent screen position across zoom, movement and viewport resize on 64x64',()=>{
 for(const [zoom,agent,scale] of [[3,'12,40',8],[5,'13,40',8],[5,'14,40',5]] as const){
  const view=followAgent(zoom,agent,64,64,scale),[x,y]=agent.split(',').map(Number)
  expect((x+.5-32)*scale*view.zoom+view.x).toBeCloseTo(0)
  expect((y+.5-32)*scale*view.zoom+view.y).toBeCloseTo(0)
  expect(view.zoom).toBe(zoom)
 }
})
