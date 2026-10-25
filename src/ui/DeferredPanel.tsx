import { memo, type ReactNode } from 'react'
/** Retain mounted panel state, but don't render hidden charts/editor on each training frame. */
export const DeferredPanel = memo(function DeferredPanel({ children }: { active: boolean; children: ReactNode }) {
  return <>{children}</>
}, (previous, next) => !previous.active && !next.active)
