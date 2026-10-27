import { useEffect, useRef, useState, type PointerEvent, type SVGProps } from 'react'
import { beginStroke, extendStroke, type EditError, type MapElement, type Stroke } from '../../viz/controls/editorOperations'
import type { GridEditorDraft } from '../../viz/controls/envEditorDraft'
import type { Position } from '../../core/environments/gridworld/types'

type Interaction = Pick<SVGProps<SVGSVGElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onLostPointerCapture'>

/**
 * V4 — continuous painting. The stroke edits a local preview draft (one React update per
 * newly crossed cell, never per pointer event) and reaches the undo history exactly once,
 * on pointer-up, so one drag is one Undo. Cancel paths (pointercancel, Escape, a camera
 * pan or pinch taking over) discard the stroke rather than half-applying it.
 */
export function usePaintStroke(draft: GridEditorDraft, enabled: boolean, element: () => MapElement | null, onCommit: (draft: GridEditorDraft, first: Position) => void, onError: (error: EditError) => void, touchEnabled = true) {
  const stroke = useRef<{ value: Stroke; first: Position; pointer: number } | null>(null)
  const [preview, setPreview] = useState<GridEditorDraft | null>(null)
  const suppressClick = useRef(false)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancel = () => { stroke.current = null; setPreview(null) }
  useEffect(() => {
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape' && stroke.current) cancel() }
    window.addEventListener('keydown', escape)
    return () => { window.removeEventListener('keydown', escape); if (clickTimer.current) clearTimeout(clickTimer.current) }
  }, [])
  const cell = (event: PointerEvent<SVGSVGElement>): Position => {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: Math.floor((event.clientX - box.left) / box.width * draft.width), y: Math.floor((event.clientY - box.top) / box.height * draft.height) }
  }
  const finish = (pointer: number) => {
    const current = stroke.current
    if (!current || current.pointer !== pointer) return
    cancel()
    if (current.value.error) onError(current.value.error)
    if (current.value.draft !== draft) onCommit(current.value.draft, current.first)
  }
  const interaction: Interaction = {
    onPointerDown: event => {
      suppressClick.current = false
      if (clickTimer.current) clearTimeout(clickTimer.current)
      if (!enabled || event.button !== 0 || stroke.current) return
      if (event.pointerType === 'touch' && !touchEnabled) return
      const first = cell(event)
      if (first.x < 0 || first.y < 0 || first.x >= draft.width || first.y >= draft.height) return
      // The following click belongs to this stroke; keyboard activation never passes here.
      suppressClick.current = true
      clickTimer.current = setTimeout(() => { suppressClick.current = false }, 500)
      const value = beginStroke(draft, first, element())
      stroke.current = { value, first, pointer: event.pointerId }
      setPreview(value.draft)
      event.currentTarget.setPointerCapture?.(event.pointerId)
    },
    onPointerMove: event => {
      const current = stroke.current
      if (!current || current.pointer !== event.pointerId) return
      event.preventDefault()
      const next = extendStroke(current.value, cell(event))
      if (next === current.value) return
      const changed = next.draft !== current.value.draft
      current.value = next
      if (changed) setPreview(next.draft)
    },
    onPointerUp: event => finish(event.pointerId),
    onLostPointerCapture: event => finish(event.pointerId),
    onPointerCancel: event => { if (stroke.current?.pointer === event.pointerId) cancel() },
  }
  return { preview, interaction, cancel, active: () => !!stroke.current, consumeClick: () => { if (!suppressClick.current) return false; suppressClick.current = false; return true } }
}
