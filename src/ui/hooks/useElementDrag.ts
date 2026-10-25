import { useEffect, useRef, useState, type PointerEvent, type SVGProps } from 'react'
import { elementAt, moveElement, type EditError } from '../../viz/controls/editorOperations'
import type { GridEditorDraft } from '../../viz/controls/envEditorDraft'
import type { Position } from '../../core/environments/gridworld/types'

export function useElementDrag(draft: GridEditorDraft, enabled: boolean, onMove: (draft: GridEditorDraft, to: Position) => void, onError: (error: EditError) => void, touchEnabled = true) {
  const gesture = useRef<{ from: Position; x: number; y: number; moved: boolean; pointer: number; svg: SVGSVGElement } | null>(null)
  const [preview, setPreview] = useState<{ from: Position; to: Position; valid: boolean } | null>(null)
  const suppressClick = useRef(false)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancel = () => { gesture.current = null; setPreview(null) }
  useEffect(() => {
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') cancel() }
    window.addEventListener('keydown', escape)
    return () => { window.removeEventListener('keydown', escape); if (clickTimer.current) clearTimeout(clickTimer.current) }
  }, [])
  const position = (event: PointerEvent<SVGSVGElement>): Position => {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: Math.floor((event.clientX - box.left) / box.width * draft.width), y: Math.floor((event.clientY - box.top) / box.height * draft.height) }
  }
  const interaction: Pick<SVGProps<SVGSVGElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'> = {
    onPointerDown: event => {
      suppressClick.current = false
      if (clickTimer.current) clearTimeout(clickTimer.current)
      if (!enabled || event.button !== 0) return
      if (event.pointerType === 'touch' && !touchEnabled) return
      const from = position(event)
      if (!elementAt(draft, from)) return
      gesture.current = { from, x: event.clientX, y: event.clientY, moved: false, pointer: event.pointerId, svg: event.currentTarget }
      // Capture on the cell so a plain click still targets its selection handler.
      if (event.target instanceof Element) event.target.setPointerCapture?.(event.pointerId)
    },
    onPointerMove: event => {
      const current = gesture.current
      if (!current || current.pointer !== event.pointerId) return
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6 && !current.moved) return
      current.moved = true
      event.preventDefault()
      const to = position(event)
      setPreview({ from: current.from, to, valid: !moveElement(draft, current.from, to).error })
    },
    onPointerUp: event => {
      const current = gesture.current
      if (!current || current.pointer !== event.pointerId) return
      if (current.moved) {
        suppressClick.current = true
        clickTimer.current = setTimeout(() => { suppressClick.current = false }, 500)
        const to = position(event)
        const result = moveElement(draft, current.from, to)
        if (result.error) onError(result.error)
        else if (result.draft !== draft) onMove(result.draft, to)
      }
      cancel()
    },
    onPointerCancel: cancel,
  }
  return { preview, interaction, cancel, consumeClick: () => { if (!suppressClick.current) return false; suppressClick.current = false; return true } }
}
