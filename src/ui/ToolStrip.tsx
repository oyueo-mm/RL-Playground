import { useEffect, useRef, useState } from 'react'
import type { EditMode } from '../viz/controls/envEditorDraft'
import { EditorIcon } from './EditorIcon'

/** One-row, horizontally scrollable tool picker for phones. Edge fades appear only on the side that has more tools. */
export function ToolStrip({ tools, mode, labels, descriptions, onSelect, ariaLabel }: { tools: EditMode[]; mode: EditMode; labels: Record<EditMode, string>; descriptions?: Partial<Record<EditMode, string>>; onSelect: (mode: EditMode) => void; ariaLabel: string }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })
  const measure = () => {
    const el = scroller.current
    if (el) setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }
  useEffect(() => {
    measure()
    const el = scroller.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    scroller.current?.querySelector<HTMLElement>('[aria-pressed=true]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [mode])
  return <div className="tool-strip" data-more-left={edges.left} data-more-right={edges.right}>
    <div ref={scroller} className="tool-strip-scroll" role="toolbar" aria-label={ariaLabel} data-testid="tool-strip" onScroll={measure}>
      {tools.map(tool => <button key={tool} type="button" aria-label={labels[tool]} title={descriptions?.[tool]} aria-pressed={mode === tool} onClick={() => onSelect(tool)} data-testid={`env-editor-mode-${tool}`}><EditorIcon tool={tool} /><span>{labels[tool]}</span></button>)}
    </div>
  </div>
}
