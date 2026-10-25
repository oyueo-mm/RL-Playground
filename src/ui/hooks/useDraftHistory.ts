import { useCallback, useRef, useState, type SetStateAction } from 'react'

export interface DraftHistory<T> { past: T[]; present: T; future: T[]; group?: { key: string; time: number; boundary: number } }
export function changeDraft<T>(history: DraftHistory<T>, value: T, grouped = false): DraftHistory<T> {
  if (JSON.stringify(history.present) === JSON.stringify(value)) return history
  return { past: grouped ? history.past : [...history.past, history.present].slice(-100), present: value, future: [] }
}
export function useDraftHistory<T>(initial: () => T) {
  const [history, setHistory] = useState<DraftHistory<T>>(() => ({ past: [], present: initial(), future: [] }))
  const groupBoundary = useRef(0)
  const boundary = useCallback(() => { groupBoundary.current++ }, [])
  const set = useCallback((action: SetStateAction<T>, key?: string) => {
    const now = Date.now()
    const boundaryId = groupBoundary.current
    setHistory(previous => {
      const value = typeof action === 'function' ? (action as (value: T) => T)(previous.present) : action
      const grouped = !!key && previous.group?.key === key && previous.group.boundary === boundaryId && now - previous.group.time < 1000
      const next = changeDraft(previous, value, grouped)
      return next === previous ? previous : { ...next, group: key ? { key, time: now, boundary: boundaryId } : undefined }
    })
  }, [])
  const undo = useCallback(() => { boundary(); setHistory(h => h.past.length ? { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] } : h) }, [boundary])
  const redo = useCallback(() => { boundary(); setHistory(h => h.future.length ? { past: [...h.past, h.present].slice(-100), present: h.future[0], future: h.future.slice(1) } : h) }, [boundary])
  const reseed = useCallback((value: T) => { boundary(); setHistory({ past: [], present: value, future: [] }) }, [boundary])
  return { draft: history.present, set, undo, redo, reseed, boundary, canUndo: !!history.past.length, canRedo: !!history.future.length }
}
