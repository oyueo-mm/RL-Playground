import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export function GridViewport({ width, height, children, active = true }: { width: number; height: number; children: ReactNode; active?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  useLayoutEffect(() => { setZoom(1) }, [width, height])
  useLayoutEffect(() => {
    if (!active) return
    const element = ref.current!
    const measure = () => {
      const rect = element.getBoundingClientRect()
      setSize(previous => previous.width === rect.width && previous.height === rect.height ? previous : { width: rect.width, height: rect.height })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [active])
  // Invalid editor input can exist transiently before validation/apply. Keep its
  // viewport finite while the user corrects it; never write NaN/Infinity to CSS.
  const columns = Math.max(1, Number.isFinite(width) ? width : 1)
  const rows = Math.max(1, Number.isFinite(height) ? height : 1)
  const scale = Math.max(0, Math.min((size.width - 8) / columns, (size.height - 8) / rows))
  const drawWidth = columns * scale * zoom
  const drawHeight = rows * scale * zoom
  return <div className="grid-viewport-shell">
    <div ref={ref} className="grid-viewport" data-testid="grid-viewport">
      <div className="grid-centering" style={{ width: Math.max(size.width, drawWidth + 8), height: Math.max(size.height, drawHeight + 8) }}>
        <div className="grid-drawing" style={{ width: drawWidth, height: drawHeight }} data-testid="grid-stack">{children}</div>
      </div>
    </div>
    <div className="zoom-controls" role="group" aria-label="Zoom">
      <button type="button" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - 0.25))}>−</button>
      <button type="button" onClick={() => { setZoom(1); ref.current?.scrollTo?.(0, 0) }} aria-label="Fit entire map">{Math.round(zoom * 100)}% ⛶</button>
      <button type="button" aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom(value => Math.min(3, value + 0.25))}>+</button>
    </div>
  </div>
}
