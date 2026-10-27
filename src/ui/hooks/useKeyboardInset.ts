import { useEffect, useState } from 'react'

/** Height of the on-screen keyboard (or any other visual-viewport occlusion) at the bottom of the layout viewport. */
export function keyboardInset(layoutHeight: number, visualHeight: number, visualOffsetTop: number): number {
  const inset = layoutHeight - visualHeight - visualOffsetTop
  return inset > 80 ? Math.round(inset) : 0 // small differences are browser chrome, not a keyboard
}

export function useKeyboardInset(enabled: boolean): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!enabled || !viewport) { setInset(0); return }
    const update = () => setInset(keyboardInset(window.innerHeight, viewport.height, viewport.offsetTop))
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => { viewport.removeEventListener('resize', update); viewport.removeEventListener('scroll', update) }
  }, [enabled])
  return inset
}
