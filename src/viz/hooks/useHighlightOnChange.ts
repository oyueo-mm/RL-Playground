import { useEffect, useRef, useState } from 'react'

/**
 * Returns true for `highlightMs` whenever `value` changes from what it was on the
 * previous render (never true on mount). Purely a presentational animation flag — not
 * simulation state, so it doesn't violate "don't duplicate Engine state into React
 * state" (Phase 4 §6/§11).
 */
export function useHighlightOnChange(value: number, highlightMs = 500): boolean {
  const [highlight, setHighlight] = useState(false)
  const previous = useRef(value)

  useEffect(() => {
    if (previous.current === value) return
    previous.current = value
    setHighlight(true)
    const timeoutId = setTimeout(() => setHighlight(false), highlightMs)
    return () => clearTimeout(timeoutId)
  }, [value, highlightMs])

  return highlight
}
