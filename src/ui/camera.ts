export interface Camera { zoom: number; x: number; y: number }
export function zoomAt(c: Camera, factor: number, x: number, y: number): Camera {
  const zoom=Math.max(.25,Math.min(24,c.zoom*factor)),ratio=zoom/c.zoom
  return {zoom,x:x-(x-c.x)*ratio,y:y-(y-c.y)*ratio}
}
