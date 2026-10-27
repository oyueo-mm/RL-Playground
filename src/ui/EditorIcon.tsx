import type { EditMode } from '../viz/controls/envEditorDraft'
import { FRAGILE_CRACKS, FRAGILE_SLAB } from '../viz/grid/fragileGlyph'
const paths: Record<EditMode | 'undo' | 'redo', string> = {
  select: 'M5 3v17l5-5 4 7 3-2-4-7h7Z',
  wall: 'M3 4h18v16H3ZM3 12h18M9 4v8m6 0v8',
  start: 'M12 3a5 5 0 0 1 5 5c0 4-5 9-5 9S7 12 7 8a5 5 0 0 1 5-5ZM5 18l-2 3h18l-2-3M12 7v2',
  goal: 'M5 22V3h13l-3 4 3 4H5',
  bomb: 'M16 8a8 8 0 1 1-2-1l2-3 3 1M19 2v2m2 1h2',
  portal: 'M10 3a6 9 0 1 0 0 18 6 9 0 1 0 0-18ZM17 4a5 8 0 0 1 0 16',
  oneWay: 'M3 3h18v18H3ZM6 12h12m-5-5 5 5-5 5',
  fragile: `${FRAGILE_SLAB}${FRAGILE_CRACKS}`,
  switch: 'M3 13h18v8H3ZM7 13V8h10v5M12 3v3M4 5l2 2m14-2-2 2',
  toggleWall: 'M3 21V3h18v18M8 21V6l10-2v17ZM13 13h1',
  terrain: 'M3 3h18v18H3ZM5 9c2-2 3 2 5 0s3 2 5 0 3 2 4 0M5 14c2-2 3 2 5 0s3 2 5 0 3 2 4 0M5 19c2-2 3 2 5 0s3 2 5 0',
  erase: 'm3 14 10-11 8 7-10 11H8Zm4-4 8 7M11 21h11',
  undo: 'm8 4-5 5 5 5M3 9h11a7 7 0 0 1 0 14',
  redo: 'm16 4 5 5-5 5m5-5H10a7 7 0 0 0 0 14',
}
export function EditorIcon({ tool }: { tool: keyof typeof paths }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" data-icon={tool}><path d={paths[tool]} /></svg>
}
