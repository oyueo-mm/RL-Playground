import { useState } from 'react'

/** Event keys, rather than renders, determine whether a dismissed notice returns. */
export function Notice({ eventKey, title, children, locale = 'en', kind = 'info', testId, inline = false, className = '' }: { eventKey: string; title: string; children?: React.ReactNode; locale?: string; kind?: 'success' | 'info' | 'warning' | 'error'; testId?: string; inline?: boolean; className?: string }) {
  const [dismissed, setDismissed] = useState<string | null>(null)
  if (dismissed === eventKey) return null
  return <aside className={`notice notice-${kind} ${inline ? 'notice-inline' : ''} ${className}`} role={kind === 'error' ? 'alert' : 'status'} data-testid={testId}>
    <div><strong>{title}</strong>{children && <div className="notice-details">{children}</div>}</div>
    <button aria-label={locale === 'ko' ? '알림 닫기' : 'Dismiss notification'} onClick={() => setDismissed(eventKey)}>×</button>
  </aside>
}
