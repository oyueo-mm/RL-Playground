export interface Camera { zoom: number; x: number; y: number }
export function followAgent(zoom: number, agentPos: string, columns: number, rows: number, scale: number): Camera {
  const [x,y] = agentPos.split(',').map(Number)
  return {zoom,x:(columns/2-x-.5)*scale*zoom,y:(rows/2-y-.5)*scale*zoom}
}
export function zoomAt(c: Camera, factor: number, x: number, y: number): Camera {
  const zoom=Math.max(.25,Math.min(24,c.zoom*factor)),ratio=zoom/c.zoom
  return {zoom,x:x-(x-c.x)*ratio,y:y-(y-c.y)*ratio}
}
