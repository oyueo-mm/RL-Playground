import { useEffect, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'

/** The wrapper keeps explanations available when the native button is disabled. */
export function TooltipButton({ tip, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tip: string }) {
  const id = useId()
  const anchor = useRef<HTMLSpanElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 8, top: 8 })
  const close = () => { if (timer.current) clearTimeout(timer.current); setOpen(false) }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  useEffect(() => {
    if (!open) return
    const hide = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); close() } }
    window.addEventListener('keydown', hide, true)
    window.addEventListener('resize', close)
    return () => { window.removeEventListener('keydown', hide, true); window.removeEventListener('resize', close) }
  }, [open])
  useLayoutEffect(() => {
    if (!open || !anchor.current || !popup.current) return
    const box = anchor.current.getBoundingClientRect()
    const hint = popup.current.getBoundingClientRect()
    setPosition({ left: Math.max(8, Math.min(box.x + box.width / 2 - hint.width / 2, innerWidth - hint.width - 8)), top: Math.max(8, box.bottom + hint.height + 12 <= innerHeight ? box.bottom + 8 : box.top - hint.height - 8) })
  }, [open, tip])
  return <span ref={anchor} className="tooltip-anchor" tabIndex={props.disabled ? 0 : undefined} aria-label={props.disabled ? props['aria-label'] ?? String(children) : undefined} aria-describedby={open ? id : undefined}
    onMouseEnter={() => { timer.current = setTimeout(() => setOpen(true), 350) }} onMouseLeave={close} onFocus={() => setOpen(true)} onBlur={close} onClick={close}>
    <button {...props} aria-describedby={open ? id : undefined}>{children}</button>
    {open && createPortal(<div ref={popup} id={id} role="tooltip" className="control-tooltip" style={position}>{tip}</div>, document.body)}
  </span>
}
