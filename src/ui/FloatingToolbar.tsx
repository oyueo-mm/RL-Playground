import { useLayoutEffect, useRef, type ReactNode } from 'react'

export function FloatingToolbar({ children, label, active = true, className = '' }: { children: ReactNode; label: string; active?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!active) return
    const toolbar = ref.current!
    const measure = () => {
      const height = toolbar.getBoundingClientRect().height
      if (height > 0) toolbar.parentElement?.style.setProperty('--toolbar-space', `${height + 24}px`)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(toolbar)
    return () => observer.disconnect()
  }, [active])
  return <div ref={ref} className={`floating-toolbar ${className}`} role="toolbar" aria-label={label}>{children}</div>
}
