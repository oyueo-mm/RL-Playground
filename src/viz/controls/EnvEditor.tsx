// Phase 7 — GridWorld Environment Editor. Manages a local Draft (React state) that is
// completely independent of the live Engine until "Apply" — clicking cells here never
// touches the real Environment (ARCHITECTURE.md §7.3/§11, Phase 7 §2.1).
//
// GridSvg.tsx is reused as-is (not modified) to render the Draft preview: it already
// accepts a generic EnvRenderModel + onStateSelect, so a synthetic render model built
// from the Draft is fed into a second GridSvg instance. GridSvg's read-only-visualization
// responsibility is unchanged — this component just re-purposes its existing click
// callback as "edit this cell" instead of "select this cell for inspection".
//
// Phase 30: Goal mode changed from "move a singleton" to "toggle membership in an array",
// mirroring Bomb mode's existing click pattern exactly (see handleCellClick below).
// Reward fields (Step/Wall/Goal, alongside the pre-existing Bomb penalty) and an
// Environment Preset selector were added; both still only ever mutate the local Draft —
// neither reaches the live Environment before Apply.

import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import type { GridWorldConfig, Direction } from '../../core/environments/gridworld/types'
import { featurePositions, positionId, stateSpaceDetails } from '../../core/environments/gridworld/features'
import type { EnvRenderModel } from '../../core/types/render'
import type { StateKey } from '../../core/types/rl'
import { GridSvg } from '../grid/GridSvg'
import { GridViewport } from '../../ui/GridViewport'
import { FloatingToolbar } from '../../ui/FloatingToolbar'
import { ToolStrip } from '../../ui/ToolStrip'
import { MOBILE_TOOLS } from '../../ui/mobileTools'
import { TooltipButton } from '../../ui/TooltipButton'
import { toolbarTips } from '../../ui/toolbarTips'
import { EditorIcon } from '../../ui/EditorIcon'
import { ManualPlay } from '../../ui/ManualPlay'
import { Notice } from '../../ui/Notice'
import { useElementDrag } from '../../ui/hooks/useElementDrag'
import { elementAt, nextPortalId, nextGroupId, placeElement, setElementValue, setToggleInitialOpen, setTerrainCost, setPortalDirected, flipPortal, PAINTABLE_TOOLS, type EditError, type MapElement } from './editorOperations'
import { usePaintStroke } from '../../ui/hooks/usePaintStroke'
import { useMediaQuery } from '../../ui/hooks/useMediaQuery'
import { useKeyboardInset } from '../../ui/hooks/useKeyboardInset'
import { ElementInspector } from './ElementInspector'
import { useDraftHistory } from '../../ui/hooks/useDraftHistory'
import { parseStateKey } from '../grid/stateKey'
import { translations, translateValidationError, type Dictionary, type Locale } from '../../ui/i18n'
import { ENVIRONMENT_PRESETS } from './environmentPresets'
import {
  defaultDraft,
  draftFromRenderModel,
  draftToGridWorldConfig,
  draftToRenderModel,
  MAX_SIZE,
  MIN_SIZE,
  samePosition,
  validateDraft,
  removeFeaturesAt,
  cropFeatures,
  type EditMode,
  type GridEditorDraft,
} from './envEditorDraft'
import { exportFileName, parseEnvImport, serializeEnvExport } from './envEditorIO'

export interface EnvEditorProps {
  /** The live environment's current render model — used only to seed the initial Draft. */
  currentRenderModel: Extract<EnvRenderModel, { kind: 'grid' }>
  /** Called only after validation passes AND the user confirms. Never called otherwise. */
  onApply: (config: GridWorldConfig) => void
  /** Defaults to window.confirm (Phase 7 §9 explicitly allows the plain browser dialog). */
  confirmApply?: (message: string) => boolean
  /** Phase 13 — defaults to English so every pre-existing caller/test is unaffected. */
  t?: Dictionary
  locale?: Locale
  fullscreen?: boolean
  active?: boolean
  presetRequest?: { draft: GridEditorDraft } | null
  panelBlocked?: boolean
  onOpenProperties?: () => void
}

function isAnyGoal(pos: { x: number; y: number }, goals: GridEditorDraft['goals']): boolean {
  return goals.some((g) => samePosition(g, pos))
}

export function EnvEditor({
  currentRenderModel,
  onApply,
  confirmApply = window.confirm,
  t = translations.en,
  locale = 'en',
  fullscreen = false,
  active = true,
  presetRequest,
  panelBlocked = false,
  onOpenProperties,
}: EnvEditorProps) {
  const history = useDraftHistory<GridEditorDraft>(() => draftFromRenderModel(currentRenderModel))
  const { draft, set: commit, undo: undoHistory, redo: redoHistory, canUndo, canRedo, reseed, boundary } = history
  const tips = toolbarTips[locale]
  const dirty = useRef(false)
  const undo = () => { if (canUndo) { dirty.current = true; undoHistory() } }
  const redo = () => { if (canRedo) { dirty.current = true; redoHistory() } }
  const setDraft: Dispatch<SetStateAction<GridEditorDraft>> = action => { dirty.current = true; commit(action) }
  const recordInput = (action: SetStateAction<GridEditorDraft>, key: string) => { dirty.current = true; commit(action, key) }
  const seedKey = JSON.stringify([currentRenderModel.width, currentRenderModel.height, currentRenderModel.start, currentRenderModel.allGoals ?? currentRenderModel.goals, currentRenderModel.staticWalls ?? currentRenderModel.walls, currentRenderModel.bombs, currentRenderModel.stepReward, currentRenderModel.wallPenalty, currentRenderModel.goalReward, currentRenderModel.bombPenalty, currentRenderModel.features, currentRenderModel.goalRewards, currentRenderModel.bombPenalties])
  const previousSeed = useRef(seedKey)
  useEffect(() => {
    const incoming = draftFromRenderModel(currentRenderModel)
    // Applying our own draft acknowledges it; it must not erase its undo history.
    if (previousSeed.current !== seedKey && !dirty.current && serializeEnvExport(incoming) !== serializeEnvExport(draft)) reseed(incoming)
    previousSeed.current = seedKey
  }, [seedKey, currentRenderModel, reseed, draft])
  const [mode, setMode] = useState<EditMode>('wall')
  const [playing, setPlaying] = useState(false)
  const [presetId, setPresetId] = useState<string>('custom')
  const [propertiesOpen, setPropertiesOpen] = useState(false)
  const [selectedCell, setSelectedCell] = useState<StateKey | null>(null)
  const [portalId, setPortalId] = useState('P1')
  const [groupId, setGroupId] = useState('G1')
  const [autoPortal, setAutoPortal] = useState(true)
  const [autoGroup, setAutoGroup] = useState(true)
  const [keepGroup, setKeepGroup] = useState(false)
  const effectivePortalId = mode === 'select' || !autoPortal ? portalId : nextPortalId(draft, portalId)
  const effectiveGroupId = mode === 'select' || !autoGroup || keepGroup ? groupId : nextGroupId(draft, groupId)
  const [direction, setDirection] = useState<Direction>(3)
  const [editMessage, setEditMessage] = useState('')
  const [touchMove, setTouchMove] = useState(false)
  const [touchPaint, setTouchPaint] = useState(false)
  // V5 — compact (phone) layout: one explicit touch mode instead of two separate toggles.
  const compact = useMediaQuery('(max-width: 760px)') && fullscreen
  const [touchMode, setTouchMode] = useState<'edit' | 'pan'>('edit')
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const [portalDirected, setPortalDirectedTool] = useState(false)
  const keyboardInset = useKeyboardInset(compact)
  const touchMoveOn = compact ? touchMode === 'edit' : touchMove
  const touchPaintOn = compact ? touchMode === 'edit' : touchPaint
  const touchDevice = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0
  const drag = useElementDrag(draft, fullscreen && active && mode === 'select', (next, to) => { setDraft(next); setSelectedCell(positionId(to)) }, showEditError, touchMoveOn || !touchDevice)
  // V4 — one element description for both pointer strokes and keyboard/click placement.
  const toolElement = (): MapElement | null => mode === 'erase' || mode === 'select' ? null : { kind: mode, portalId: effectivePortalId, groupId: effectiveGroupId, direction, ...(mode === 'portal' && portalDirected ? { directed: true } : {}) }
  const paint = usePaintStroke(draft, fullscreen && active && !playing && mode !== 'select', toolElement, (next, first) => { setDraft(next); setSelectedCell(positionId(first)) }, showEditError, touchPaintOn || !touchDevice)
  const handledPreset = useRef<typeof presetRequest>(null)
  useEffect(() => {
    if (!presetRequest || handledPreset.current === presetRequest) return
    handledPreset.current = presetRequest
    if (dirty.current && !confirmApply(locale === 'ko' ? '현재 편집 초안을 프리셋으로 교체할까요? Undo로 되돌릴 수 있습니다. 학습 환경은 변경되지 않습니다.' : 'Replace the current draft? Undo can restore it. The learning environment will not change.')) return
    dirty.current = true
    commit(structuredClone(presetRequest.draft))
    setSelectedCell(null); setPresetId('custom')
  }, [presetRequest, confirmApply, locale, commit])
  useEffect(() => {
    setEditMessage('')
    if (!selectedCell) return
    const way = draft.oneWays?.find(tile => positionId(tile) === selectedCell)
    const pair = draft.portals?.find(pair => pair.ends.some(end => positionId(end) === selectedCell))
    const tile = [...(draft.switches ?? []), ...(draft.toggleWalls ?? [])].find(tile => positionId(tile) === selectedCell)
    if (way) setDirection(way.direction)
    if (pair) setPortalId(pair.id)
    if (tile) setGroupId(tile.groupId)
  }, [draft, selectedCell])
  useEffect(() => {
    if (!active || playing) return
    const handle = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return }
        if (event.key.toLowerCase() === 'y' && event.ctrlKey) { event.preventDefault(); redo(); return }
      }
      // Any tool: the last clicked / placed cell is the edit target. Text fields were excluded above.
      if (selectedCell && (event.key === 'Backspace' || event.key === 'Delete') && elementAt(draft, parseStateKey(selectedCell))) { event.preventDefault(); deleteCell(selectedCell) }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  })
  useEffect(() => {
    if (!active || playing) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setPropertiesOpen(false) } }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [active, playing])
  // Phase 46 — Import/Export. `importError` is cleared on every successful Import (and
  // stays until then — a bad file otherwise leaves no visible trace it was rejected).
  const [importError, setImportError] = useState<string | null>(null)
  const [importAttempt, setImportAttempt] = useState(0)
  const importFileInputRef = useRef<HTMLInputElement>(null)

  // validateDraft() itself always returns plain English messages (its own pure-function
  // tests assert those exact strings) — translated only for display here.
  const errors = validateDraft(draft)
  const isValid = errors.length === 0

  function deleteCell(key: StateKey) {
    const pos = parseStateKey(key)
    if (!elementAt(draft, pos)) return // nothing to delete: never report or change anything
    if (samePosition(pos, draft.start)) { setEditMessage(locale === 'ko' ? '시작점은 삭제할 수 없습니다. 다른 셀로 옮겨 주세요.' : 'Start cannot be deleted. Move it to another cell.'); return }
    if (isAnyGoal(pos, draft.goals) && draft.goals.length === 1) { setEditMessage(locale === 'ko' ? '최소 하나의 목표가 필요합니다. 마지막 목표는 삭제할 수 없습니다.' : 'At least one goal is required. The last goal cannot be deleted.'); return }
    setEditMessage('')
    setDraft(prev => ({ ...prev, ...removeFeaturesAt(prev, pos), walls: prev.walls.filter(p => !samePosition(p, pos)), bombs: prev.bombs.filter(p => !samePosition(p, pos)), goals: prev.goals.filter(p => !samePosition(p, pos)) }))
  }

  function updateWidth(value: number) {
    recordInput((prev) => ({
      ...prev,
      width: value,
      walls: prev.walls.filter((w) => w.x < value),
      bombs: prev.bombs.filter((b) => b.x < value),
      goals: prev.goals.filter((g) => g.x < value),
      ...cropFeatures(prev, value, prev.height),
    }), 'updateWidth')
  }

  function updateHeight(value: number) {
    recordInput((prev) => ({
      ...prev,
      height: value,
      walls: prev.walls.filter((w) => w.y < value),
      bombs: prev.bombs.filter((b) => b.y < value),
      goals: prev.goals.filter((g) => g.y < value),
      ...cropFeatures(prev, prev.width, value),
    }), 'updateHeight')
  }

  function updateBombPenalty(value: number) {
    recordInput((prev) => ({ ...prev, bombPenalty: value }), 'updateBombPenalty')
  }

  function updateStepReward(value: number) {
    recordInput((prev) => ({ ...prev, stepReward: value }), 'updateStepReward')
  }

  function updateWallPenalty(value: number) {
    recordInput((prev) => ({ ...prev, wallPenalty: value }), 'updateWallPenalty')
  }

  function updateGoalReward(value: number) {
    recordInput((prev) => ({ ...prev, goalReward: value }), 'updateGoalReward')
  }

  // Phase 32 §9/§10 — "Reset Environment": restores the Editor's Draft to the project's
  // default Environment. This ONLY touches Draft state (same as every other change in
  // this component) — it never calls onApply, so the live/running Environment is
  // completely unaffected until the user separately clicks Apply.
  function handleResetEnvironment() {
    setDraft(defaultDraft())
    setPresetId('custom')
  }

  function selectPreset(id: string) {
    setPresetId(id)
    if (id === 'custom') return
    const preset = ENVIRONMENT_PRESETS.find((p) => p.id === id)
    if (preset) setDraft(preset.draft)
  }

  function showEditError(error: EditError) {
    setEditMessage((locale === 'ko' ? {
      start: '시작점은 삭제/덮어쓸 수 없습니다. 다른 셀로 옮겨 주세요.',
      'last-goal': '마지막 목표는 보호됩니다. 먼저 다른 목표를 배치하세요.',
      'portal-complete': '이 포털 쌍은 완성되었습니다. 자동 연결이나 새 ID를 선택하세요.',
      'portal-merge': '같은 포털의 두 끝점은 서로 다른 셀이어야 합니다.',
      bounds: '격자 안에 놓아 주세요.',
    } : { start: 'Start is protected. Move it to another cell.', 'last-goal': 'The last goal is protected. Place another goal first.', 'portal-complete': 'This pair is complete. Use automatic pairing or another ID.', 'portal-merge': 'Portal endpoints must occupy distinct cells.', bounds: 'Drop inside the grid.' })[error])
  }

  function handleCellClick(stateKey: StateKey, source?: 'keyboard') {
    // Pointer clicks were already applied by the stroke/drag; keyboard activation never was.
    // Only the hook that owns the current mode may swallow a click: a stroke's pointer
    // capture can retarget its trailing click away from the cell, leaving a stale flag.
    if (source !== 'keyboard' && (mode === 'select' ? drag.consumeClick() : paint.consumeClick())) return
    const pos = parseStateKey(stateKey)
    setSelectedCell(stateKey)
    setEditMessage('')
    if (mode === 'select') {
      const pair = draft.portals?.find(pair => pair.ends.some(end => samePosition(end, pos)))
      if (pair) setPortalId(pair.id)
      const group = [...(draft.switches ?? []), ...(draft.toggleWalls ?? [])].find(tile => samePosition(tile, pos))
      if (group) setGroupId(group.groupId)
      const way = draft.oneWays?.find(tile => samePosition(tile, pos))
      if (way) setDirection(way.direction)
      onOpenProperties?.(); setPropertiesOpen(true); return
    }
    if (mode === 'erase') { deleteCell(stateKey); return }
    if (fullscreen) {
      const result = placeElement(draft, pos, toolElement()!)
      if (result.error) showEditError(result.error)
      else if (result.draft !== draft) setDraft(result.draft)
      return
    }
    if (mode === 'oneWay') {
      const tile = draft.oneWays?.find(tile => samePosition(tile, pos))
      if (tile) {
        const next = ({ 0: 3, 3: 1, 1: 2, 2: 0 } as const)[tile.direction]
        setDirection(next)
        setDraft(prev => ({ ...prev, oneWays: prev.oneWays?.map(way => samePosition(way, pos) ? { ...way, direction: next } : way) }))
        return
      }
    }
    const occupiedSpecial = featurePositions(draft).some(tile => samePosition(tile, pos))
    if (['portal', 'oneWay', 'fragile', 'switch', 'toggleWall'].includes(mode)) {
      if (occupiedSpecial || [draft.start, ...draft.goals, ...draft.walls, ...draft.bombs].some(tile => samePosition(tile, pos))) {
        setEditMessage(locale === 'ko' ? '다른 요소와 중복 배치할 수 없습니다. 선택 도구로 수정하거나 지우개로 제거하세요.' : 'Elements cannot overlap. Use Select to edit or Erase to remove.'); return
      }
      if (mode === 'portal') {
        const pair = draft.portals?.find(pair => pair.id === portalId)
        if (pair && pair.ends.length >= 2) { setEditMessage(locale === 'ko' ? '이 포털 쌍은 완성되었습니다. 새 쌍 ID를 입력하세요.' : 'This portal pair is complete. Enter a new pair ID.'); return }
        setDraft(prev => ({ ...prev, portals: pair ? prev.portals?.map(item => item.id === portalId ? { ...item, ends: [...item.ends, pos] } : item) : [...(prev.portals ?? []), { id: portalId, ends: [pos] }] }))
      } else if (mode === 'oneWay') setDraft(prev => ({ ...prev, oneWays: [...(prev.oneWays ?? []), { ...pos, direction }] }))
      else if (mode === 'fragile') setDraft(prev => ({ ...prev, fragiles: [...(prev.fragiles ?? []), pos] }))
      else if (mode === 'switch') setDraft(prev => ({ ...prev, switches: [...(prev.switches ?? []), { ...pos, groupId }] }))
      else setDraft(prev => ({ ...prev, toggleWalls: [...(prev.toggleWalls ?? []), { ...pos, groupId }] }))
      return
    }
    if (occupiedSpecial) { setEditMessage(locale === 'ko' ? '특수 요소를 먼저 지워 주세요.' : 'Erase the special element first.'); return }

    if (mode === 'start') {
      setDraft((prev) => ({
        ...prev,
        start: pos,
        walls: prev.walls.filter((w) => !samePosition(w, pos)),
        bombs: prev.bombs.filter((b) => !samePosition(b, pos)),
        goals: prev.goals.filter((g) => !samePosition(g, pos)),
      }))
      return
    }
    if (mode === 'goal') {
      // Same "toggle membership" click pattern as Bomb mode below — Start can never
      // become a Goal.
      if (samePosition(pos, draft.start)) return
      setDraft((prev) => {
        const exists = isAnyGoal(pos, prev.goals)
        return {
          ...prev,
          walls: prev.walls.filter((w) => !samePosition(w, pos)),
          bombs: prev.bombs.filter((b) => !samePosition(b, pos)),
          goals: exists ? prev.goals.filter((g) => !samePosition(g, pos)) : [...prev.goals, pos],
        }
      })
      return
    }
    if (mode === 'bomb') {
      // Bomb/Start/Goal can never coexist on one cell — same rule as Wall below.
      if (samePosition(pos, draft.start) || isAnyGoal(pos, draft.goals)) return
      setDraft((prev) => {
        const exists = prev.bombs.some((b) => samePosition(b, pos))
        return {
          ...prev,
          // Placing a Bomb where a Wall was clears the Wall — mirrors how moving
          // Start/Goal onto a Wall clears it above (last placed entity wins).
          walls: prev.walls.filter((w) => !samePosition(w, pos)),
          bombs: exists ? prev.bombs.filter((b) => !samePosition(b, pos)) : [...prev.bombs, pos],
        }
      })
      return
    }
    // mode === 'wall': Start/Goal cells can never become walls.
    if (samePosition(pos, draft.start) || isAnyGoal(pos, draft.goals)) return
    setDraft((prev) => {
      const exists = prev.walls.some((w) => samePosition(w, pos))
      return {
        ...prev,
        // Same "last placed entity wins" rule, in the other direction.
        bombs: prev.bombs.filter((b) => !samePosition(b, pos)),
        walls: exists ? prev.walls.filter((w) => !samePosition(w, pos)) : [...prev.walls, pos],
      }
    })
  }

  function handleApply() {
    if (!isValid) return // defense in depth — the button is already disabled in this case
    if (!confirmApply(t.envEditor.applyConfirm)) return
    dirty.current = false
    onApply(draftToGridWorldConfig(draft))
  }

  // Phase 46 §17/§18 — client-side file save, no server/DB: a Blob + a temporary
  // <a download> click, exactly the standard browser download pattern (revoked right
  // after the click so the object URL doesn't leak).
  function handleExport() {
    const blob = new Blob([serializeEnvExport(draft)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = exportFileName(draft)
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleImportClick() {
    importFileInputRef.current?.click()
  }

  // Phase 46 §7/§11 — unlike every other Draft mutation above, a successful Import
  // updates the Draft AND immediately calls `onApply()` (bypassing `confirmApply`'s
  // window.confirm gate the manual Apply button above uses) — selecting a file is itself
  // the deliberate confirming action. A REJECTED import touches neither the Draft nor the
  // live Environment: only `importError` changes, so the app can never crash or partially
  // apply a bad file (Phase 46's own "실행 중인 환경은 변경되지 않아야 한다" requirement).
  function handleImportFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Always reset the input value so re-selecting the SAME file path still fires
    // onChange again (browsers otherwise treat an unchanged file input as a no-op).
    e.target.value = ''
    if (!file) return
    setImportAttempt(value => value + 1)
    setEditMessage('')

    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      const result = parseEnvImport(text)
      if (!result.ok) {
        setImportError(result.error)
        return
      }
      setImportError(null)
      setPresetId('custom')
      setDraft(result.draft)
      setEditMessage(locale === 'ko' ? '환경 파일을 초안으로 불러왔습니다.' : 'Environment file loaded into draft.')
      if (!fullscreen) onApply(draftToGridWorldConfig(result.draft))
    }
    reader.onerror = () => setImportError('Could not read the selected file.')
    reader.readAsText(file)
  }

  const inspecting = mode === 'select' && !!selectedCell
  function renamePortal(id: string) {
    setAutoPortal(false); setPortalId(id)
    if (mode === 'select' && selectedCell) recordInput(prev => ({ ...prev, portals: prev.portals?.map(pair => pair.ends.some(end => positionId(end) === selectedCell) ? { ...pair, id } : pair) }), 'portal-id')
  }
  function regroup(id: string) {
    setAutoGroup(false); setGroupId(id)
    if (mode === 'select' && selectedCell) recordInput(prev => ({ ...prev, switches: prev.switches?.map(tile => positionId(tile) === selectedCell ? { ...tile, groupId: id } : tile), toggleWalls: prev.toggleWalls?.map(tile => positionId(tile) === selectedCell ? { ...tile, groupId: id } : tile) }), 'group-id')
  }

  // Canonical mode ids ('wall'/'start'/'goal'/'bomb') drive data-testid/aria-pressed
  // unchanged; only the visible button text is looked up per-locale.
  const modeLabel: Record<EditMode, string> = {
    wall: t.envEditor.modeWall,
    start: t.envEditor.modeStart,
    goal: t.envEditor.modeGoal,
    bomb: t.envEditor.modeBomb,
    erase: locale === 'ko' ? '지우개' : 'Erase',
    select: locale === 'ko' ? '선택' : 'Select',
    portal: locale === 'ko' ? '포털' : 'Portal',
    oneWay: locale === 'ko' ? '단방향' : 'One-way',
    fragile: locale === 'ko' ? '부서지는 바닥' : 'Fragile',
    switch: locale === 'ko' ? '스위치' : 'Switch',
    toggleWall: locale === 'ko' ? '토글 벽' : 'Toggle wall',
    terrain: locale === 'ko' ? '늪' : 'Swamp',
  }

  const presetLabel = { custom: t.envEditor.presetCustom }
  const presetDescription = Object.fromEntries(ENVIRONMENT_PRESETS.map(preset => [preset.id, preset.metadata.description[locale]]))

  const bodyEl = (
    <div className={`editor-body ${mode === 'select' ? 'editor-move-mode' : 'editor-paint-mode'} ${(mode === 'select' && touchMoveOn) || (mode !== 'select' && touchPaintOn) ? 'touch-element-mode' : ''} ${compact ? 'is-compact' : ''}`} data-testid="env-editor-grid" data-painting={paint.preview ? 'true' : undefined}>
      <GridViewport editable touchPan={compact && touchMode === 'pan'} locale={locale} onPanStart={() => { drag.cancel(); paint.cancel() }} width={draft.width} height={draft.height} active={active}><GridSvg interaction={mode === 'select' ? drag.interaction : paint.interaction} movable={mode === 'select' && (!touchDevice || touchMoveOn)} renderModel={draftToRenderModel(paint.preview ?? draft)} selectedState={selectedCell} cellSize={48} onStateSelect={handleCellClick} className="stage-grid" />
      {drag.preview && <svg className="stage-overlay drag-preview" viewBox={`0 0 ${draft.width * 48} ${draft.height * 48}`} data-testid="drag-preview" data-valid={drag.preview.valid}>
        <rect x={drag.preview.from.x * 48} y={drag.preview.from.y * 48} width={48} height={48} fill="#ffffffaa" stroke="#5F6B7A" strokeDasharray="3 3" />
        <rect x={drag.preview.to.x * 48} y={drag.preview.to.y * 48} width={48} height={48} fill={drag.preview.valid ? '#2479d833' : '#f2b5ae99'} stroke={drag.preview.valid ? '#0754A5' : '#b34134'} strokeWidth={2} />
        <svg x={drag.preview.to.x * 48 + 10} y={drag.preview.to.y * 48 + 10} width={28} height={28} viewBox="0 0 24 24"><EditorIcon tool={elementAt(draft, drag.preview.from)?.kind ?? 'select'} /></svg>
      </svg>}
      </GridViewport>
      <aside className={`properties-panel ${compact ? 'is-sheet' : ''}`} id="editor-properties" hidden={!propertiesOpen || panelBlocked} aria-label={locale === 'ko' ? '속성' : 'Properties'} data-sheet={compact ? (sheetExpanded ? 'expanded' : 'peek') : undefined}>
        {compact && <button type="button" className="sheet-handle" aria-expanded={sheetExpanded} aria-controls="editor-properties" aria-label={sheetExpanded ? (locale === 'ko' ? '속성 시트 줄이기' : 'Collapse properties') : (locale === 'ko' ? '속성 시트 펼치기' : 'Expand properties')} onClick={() => setSheetExpanded(value => !value)} data-testid="sheet-handle"><span aria-hidden="true" /></button>}
        <header><h2>{inspecting ? (locale === 'ko' ? '요소 속성' : 'Element properties') : (locale === 'ko' ? '맵 속성' : 'Map properties')}</h2><button onClick={() => setPropertiesOpen(false)} aria-label={locale === 'ko' ? '속성 닫기' : 'Close properties'}>×</button></header>
        <div className="property-fields" onBlurCapture={boundary}>
          <datalist id="existing-portals">{draft.portals?.map(pair => <option key={pair.id} value={pair.id}>{pair.ends.length}/2</option>)}</datalist>
          <datalist id="existing-groups">{[...new Set([...(draft.switches ?? []), ...(draft.toggleWalls ?? [])].map(tile => tile.groupId))].map(id => <option key={id} value={id}>{draft.switches?.filter(tile => tile.groupId === id).length ?? 0} S / {draft.toggleWalls?.filter(tile => tile.groupId === id).length ?? 0} W</option>)}</datalist>
          {inspecting && selectedCell && <ElementInspector draft={draft} cell={parseStateKey(selectedCell)} locale={locale} kindLabel={modeLabel} portalId={portalId} groupId={groupId} direction={direction}
            onPortalId={renamePortal} onGroupId={regroup}
            onDirection={next => { setDirection(next); setDraft(prev => ({ ...prev, oneWays: prev.oneWays?.map(tile => positionId(tile) === selectedCell ? { ...tile, direction: next } : tile) })) }}
            onValue={(kind, value, typing) => { const pos = parseStateKey(selectedCell); const change = (prev: GridEditorDraft) => setElementValue(prev, pos, kind, value); if (typing) recordInput(change, `element-value-${selectedCell}`); else setDraft(change) }}
            onInitialOpen={open => setDraft(prev => setToggleInitialOpen(prev, parseStateKey(selectedCell), open))}
            onTerrainCost={(cost, typing) => { const pos = parseStateKey(selectedCell); const change = (prev: GridEditorDraft) => setTerrainCost(prev, pos, cost); if (typing) recordInput(change, `terrain-cost-${selectedCell}`); else setDraft(change) }}
            onPortalDirected={directed => { const id = draft.portals?.find(pair => pair.ends.some(end => positionId(end) === selectedCell))?.id; if (id) setDraft(prev => setPortalDirected(prev, id, directed)) }}
            onFlipPortal={() => { const id = draft.portals?.find(pair => pair.ends.some(end => positionId(end) === selectedCell))?.id; if (id) setDraft(prev => flipPortal(prev, id)) }}
            onDelete={() => deleteCell(selectedCell)} />}
          {mode === 'select' && !selectedCell && <p className="inspector-empty" data-testid="element-inspector-hint">{locale === 'ko' ? '맵에서 요소를 클릭하면 이곳에 해당 요소의 설정이 표시됩니다.' : 'Click an element on the map to edit its settings here.'}</p>}
          {['portal', 'switch', 'toggleWall', 'oneWay', 'terrain'].includes(mode) && <section className="tool-settings" aria-label={locale === 'ko' ? '도구 설정' : 'Tool settings'}>
            <h3>{modeLabel[mode]} · {locale === 'ko' ? '새로 배치할 요소' : 'next placement'}</h3>
            {mode === 'portal' && <>
              <label><input type="checkbox" checked={autoPortal} data-testid="auto-portal" onChange={event => setAutoPortal(event.target.checked)} />{locale === 'ko' ? '포털 자동 연결' : 'Automatic portal pairing'}</label>
              <label>{locale === 'ko' ? '포털 쌍 ID' : 'Portal pair ID'}<input value={effectivePortalId} list="existing-portals" maxLength={24} data-testid="portal-id" onChange={event => renamePortal(event.target.value)} /></label>
              <label><input type="checkbox" checked={portalDirected} data-testid="portal-directed-tool" onChange={event => setPortalDirectedTool(event.target.checked)} />{locale === 'ko' ? '단방향 포털로 배치 (첫 칸 A → 둘째 칸 B)' : 'Place as one-way (first cell A → second cell B)'}</label>
            </>}
            {mode === 'terrain' && <p>{locale === 'ko' ? `새 늪 타일은 맵 기본 비용(${draft.terrainCost ?? -1})을 따릅니다. 선택 도구로 타일마다 비용을 따로 정할 수 있습니다. 칸을 다시 누르면 제거됩니다.` : `New swamp tiles use the map default cost (${draft.terrainCost ?? -1}). Use Select to give a tile its own cost. Tapping a swamp tile again removes it.`}</p>}
            {(mode === 'switch' || mode === 'toggleWall') && <>
              <label><input type="checkbox" checked={autoGroup} data-testid="auto-group" onChange={event => setAutoGroup(event.target.checked)} />{locale === 'ko' ? '그룹 자동 생성' : 'Automatic wall groups'}</label>
              <label><input type="checkbox" checked={keepGroup} data-testid="keep-group" onChange={event => setKeepGroup(event.target.checked)} />{locale === 'ko' ? '현재 그룹에 계속 추가' : 'Keep adding to current group'}</label>
              <label>{locale === 'ko' ? '벽 그룹 ID' : 'Wall group ID'}<input value={effectiveGroupId} list="existing-groups" maxLength={24} data-testid="group-id" onChange={event => regroup(event.target.value)} /></label>
            </>}
            {mode === 'toggleWall' && <p>{locale === 'ko' ? '빈 칸을 누르면 닫힌 벽이 생깁니다. 같은 벽을 다시 누르면 초기 상태가 열림 ↔ 닫힘으로 바뀝니다.' : 'Clicking an empty cell adds a closed wall. Clicking the same wall again switches its initial state between open and closed.'}</p>}
            {mode === 'oneWay' && <label>{locale === 'ko' ? '허용 방향' : 'Allowed direction'}<select value={direction} data-testid="one-way-direction" onChange={event => setDirection(Number(event.target.value) as Direction)}>{(locale === 'ko' ? ['↑ 위', '↓ 아래', '← 왼쪽', '→ 오른쪽'] : ['↑ Up', '↓ Down', '← Left', '→ Right']).map((label, index) => <option key={index} value={index}>{label}</option>)}</select></label>}
            <p>{locale === 'ko' ? 'ID: 영문·숫자·_·- (1~24자). 배치 후 선택 도구로 누르면 연결 상태를 확인하고 수정할 수 있습니다.' : 'IDs: letters, numbers, _ and -, 1–24 characters. Use Select on a placed element to inspect and edit its links.'}</p>
          </section>}
          <section className="map-settings" aria-label={locale === 'ko' ? '맵 기본 속성' : 'Map settings'}>
          <h3>{locale === 'ko' ? '맵 기본 속성' : 'Map settings'}</h3>
          <p data-testid="state-space-estimate">{locale === 'ko' ? '이론 상태 수 상한' : 'Theoretical state upper bound'}: {stateSpaceDetails(draft).text}<br />Goal {draft.goals.length} · Fragile {draft.fragiles?.length ?? 0} · {locale === 'ko' ? '벽 그룹' : 'Wall groups'} {stateSpaceDetails(draft).groups}</p>
          {stateSpaceDetails(draft).large && <Notice inline className="complexity-warning" eventKey={seedKey} title={locale === 'ko' ? '가능한 상태 조합이 많습니다' : 'Many possible state combinations'} locale={locale} kind="warning">{locale === 'ko' ? '적용과 직접 플레이는 가능합니다. 실제 Q 상태로 자원을 관리하며 학습에는 많은 경험이 필요할 수 있습니다.' : 'Apply and manual play remain available. Resources use actual Q rows; learning may require many experiences.'}</Notice>}
          {errors.length > 0 && <details><summary>{locale === 'ko' ? '적용 / 플레이 불가 이유' : 'Why apply / play is unavailable'}</summary>{errors.map(error => <p key={error}>{translateValidationError(error, locale)}</p>)}</details>}
          <label>{t.envEditor.width}<input type="number" min={3} max={MAX_SIZE} value={draft.width} onChange={e => updateWidth(Number(e.target.value))} data-testid="env-editor-width-input" /></label>
          <label>{t.envEditor.height}<input type="number" min={3} max={MAX_SIZE} value={draft.height} onChange={e => updateHeight(Number(e.target.value))} data-testid="env-editor-height-input" /></label>
          <label>{locale === 'ko' ? '늪 기본 비용' : 'Swamp default cost'}<input type="number" step="0.1" max={0} value={draft.terrainCost ?? -1} data-testid="env-editor-terrain-cost-input" onChange={e => recordInput(previous => ({ ...previous, terrainCost: e.target.value === '' ? Number.NaN : Number(e.target.value) }), 'terrainCost')} /></label>
          {(['stepReward', 'wallPenalty', 'goalReward', 'bombPenalty'] as const).map(key => <label key={key}>{({ stepReward: t.envEditor.stepReward, wallPenalty: t.envEditor.wallPenalty, goalReward: t.envEditor.goalReward, bombPenalty: t.envEditor.bombPenalty })[key]}<input type="number" step="0.1" value={draft[key]} data-testid={`env-editor-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}-input`} onChange={e => recordInput(previous => ({ ...previous, [key]: Number(e.target.value) }), key)} /></label>)}
          <p>{locale === 'ko' ? `목표 보상과 폭탄 페널티는 개별 값을 지정하지 않은 요소의 기본값입니다. (개별 지정: 목표 ${draft.goals.filter(goal => goal.reward !== undefined).length}개 · 폭탄 ${draft.bombs.filter(bomb => bomb.penalty !== undefined).length}개)` : `Goal reward and bomb penalty are defaults for elements without their own value. (Custom: ${draft.goals.filter(goal => goal.reward !== undefined).length} goals · ${draft.bombs.filter(bomb => bomb.penalty !== undefined).length} bombs)`}</p>
          <button onClick={handleImportClick} data-testid="env-editor-import">{t.envEditor.importButton}</button><button onClick={handleExport} disabled={!isValid} data-testid="env-editor-export">{t.envEditor.exportButton}</button>
          <button onClick={handleResetEnvironment} data-testid="env-editor-reset">{t.envEditor.resetEnvironment}</button>
          <input hidden ref={importFileInputRef} type="file" accept=".json,application/json" onChange={handleImportFileChange} data-testid="env-editor-import-input" />
          <p>{locale === 'ko' ? '가져오기는 초안만 변경합니다. 적용은 현재 학습을 초기화합니다.' : 'Import changes only the draft. Applying resets the current experiment.'}</p>
          </section>
        </div>
      </aside>
    </div>
  )
  const noticeEl = (errors.length > 0 || importError || editMessage) ? <Notice eventKey={JSON.stringify([errors, importError, editMessage, importAttempt])} kind={errors.length || importError ? 'error' : 'info'} title={locale === 'ko' ? '편집 알림' : 'Editor notification'} locale={locale} testId="env-editor-errors">{editMessage || (importError ? translateValidationError(importError, locale) : errors.map(error => translateValidationError(error, locale)).join(' '))}</Notice> : null

  const compactLayout = <div className="mobile-editor" data-testid="env-editor" style={{ '--kb': `${keyboardInset}px` } as CSSProperties}>
    {playing && <ManualPlay config={draftToGridWorldConfig(draft)} locale={locale} active={active} onClose={() => { setPlaying(false); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-testid=manual-play-start]')?.focus()) }} />}
    <div className="editor-edit-session mobile-editor-session" hidden={playing}>
      <h2 className="sr-only">{t.envEditor.heading}</h2>
      <ToolStrip tools={MOBILE_TOOLS} mode={mode} labels={modeLabel} descriptions={tips} onSelect={setMode} ariaLabel={locale === 'ko' ? '맵 편집 도구' : 'Map editing tools'} />
      <div className="mobile-status" role="status" aria-live="polite" data-testid="mobile-status">
        <span className="status-tool" data-testid="mobile-active-tool"><EditorIcon tool={mode} />{modeLabel[mode]}</span>
        {(mode === 'portal' || mode === 'switch' || mode === 'toggleWall') && <span className="link-indicator" data-testid="current-link-id">{mode === 'portal' ? `${effectivePortalId} · ${draft.portals?.find(pair => pair.id === effectivePortalId)?.ends.length ?? 0}/2${portalDirected ? ' →' : ''}` : effectiveGroupId}</span>}
        <div className="touch-mode" role="group" aria-label={locale === 'ko' ? '한 손가락 동작' : 'One-finger action'}>
          <button type="button" aria-pressed={touchMode === 'edit'} onClick={() => setTouchMode('edit')} data-testid="touch-edit-mode">{mode === 'select' ? (locale === 'ko' ? '이동' : 'Move') : mode === 'erase' ? (locale === 'ko' ? '지우기' : 'Erase') : (locale === 'ko' ? '그리기' : 'Draw')}</button>
          <button type="button" aria-pressed={touchMode === 'pan'} onClick={() => setTouchMode('pan')} data-testid="touch-pan-mode">{locale === 'ko' ? '화면 이동' : 'Pan view'}</button>
        </div>
      </div>
      {bodyEl}
      <div className="mobile-actions" role="group" aria-label={locale === 'ko' ? '편집 작업' : 'Editor actions'}>
        <button type="button" className="icon-action" aria-label={locale === 'ko' ? '실행 취소' : 'Undo'} disabled={!canUndo} onClick={undo} data-testid="editor-undo"><EditorIcon tool="undo" /></button>
        <button type="button" className="icon-action" aria-label={locale === 'ko' ? '다시 실행' : 'Redo'} disabled={!canRedo} onClick={redo} data-testid="editor-redo"><EditorIcon tool="redo" /></button>
        <button type="button" aria-label={locale === 'ko' ? '속성 / 파일' : 'Properties / files'} aria-expanded={propertiesOpen && !panelBlocked} aria-controls="editor-properties" onClick={() => { onOpenProperties?.(); setPropertiesOpen(!propertiesOpen || panelBlocked) }} data-testid="properties-toggle">{locale === 'ko' ? '속성' : 'Properties'}</button>
        <button type="button" aria-label={locale === 'ko' ? '직접 플레이' : 'Play draft'} disabled={!isValid} onClick={() => setPlaying(true)} data-testid="manual-play-start">{locale === 'ko' ? '플레이' : 'Play'}</button>
        <button type="button" className="primary-action" onClick={handleApply} disabled={!isValid} data-testid="env-editor-apply">{t.envEditor.apply}</button>
      </div>
      {noticeEl}
    </div>
  </div>

  if (fullscreen && compact) return compactLayout
  if (fullscreen) return <div className="fullscreen-editor" data-testid="env-editor">
    {playing && <ManualPlay config={draftToGridWorldConfig(draft)} locale={locale} active={active} onClose={() => { setPlaying(false); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-testid=manual-play-start]')?.focus()) }} />}
    <div className="editor-edit-session" hidden={playing}>
    <h2 className="sr-only">{t.envEditor.heading}</h2>
    <FloatingToolbar className="editor-toolbar" active={active} label={locale === 'ko' ? '맵 편집 도구' : 'Map editing tools'}>
      <div className="element-palette">{[
        { name: locale === 'ko' ? '기본 요소' : 'Basic', tools: ['select','wall','start','goal','bomb'] as EditMode[] },
        { name: locale === 'ko' ? '특수 요소' : 'Special', tools: ['portal','oneWay','fragile','switch','toggleWall','terrain'] as EditMode[] },
        { name: locale === 'ko' ? '보조 도구' : 'Utility', tools: ['erase'] as EditMode[] },
      ].map(group => <div className="tool-buttons" role="group" aria-label={group.name} key={group.name}><small>{group.name}</small>{group.tools.map(tool => <TooltipButton key={tool} tip={tips[tool]} aria-label={modeLabel[tool]} aria-pressed={mode===tool} onClick={()=>setMode(tool)} data-testid={`env-editor-mode-${tool}`}><EditorIcon tool={tool}/><span>{modeLabel[tool]}</span></TooltipButton>)}</div>)}<p className="palette-help" role="status">{modeLabel[mode]}: {tips[mode].split('. ')[0]}{PAINTABLE_TOOLS.has(mode) ? (locale === 'ko' ? ' · 끌어서 연속 편집 (Space+드래그: 화면 이동)' : ' · drag to paint (Space+drag pans)') : ''}</p></div>
      {(mode === 'portal' || mode === 'switch' || mode === 'toggleWall') && <span className="link-indicator" data-testid="current-link-id">{mode === 'portal' ? `${effectivePortalId} · ${draft.portals?.find(pair => pair.id === effectivePortalId)?.ends.length ?? 0}/2` : effectiveGroupId}</span>}
      <span className="toolbar-separator" />
      {touchDevice && mode === 'select' && <TooltipButton tip={locale === 'ko' ? '켜면 손가락으로 요소를 이동합니다. 끄면 확대된 격자를 스크롤할 수 있습니다.' : 'Enable to move elements by touch. Disable to scroll the zoomed grid.'} aria-pressed={touchMove} onClick={() => setTouchMove(value => !value)} data-testid="touch-move-mode">{locale === 'ko' ? '터치 이동' : 'Touch move'}</TooltipButton>}
      {touchDevice && mode !== 'select' && <TooltipButton tip={locale === 'ko' ? '켜면 한 손가락으로 끌며 연속 배치합니다. 끄면 탭으로 한 칸씩 배치하고 손가락으로 화면을 이동합니다. 두 손가락은 항상 확대·이동입니다.' : 'On: drag one finger to paint cells. Off: tap places one cell and dragging scrolls. Two fingers always zoom and pan.'} aria-pressed={touchPaint} onClick={() => setTouchPaint(value => !value)} data-testid="touch-paint-mode">{locale === 'ko' ? '터치 그리기' : 'Touch paint'}</TooltipButton>}
      <TooltipButton tip={tips.undo} aria-label={locale === 'ko' ? '실행 취소' : 'Undo'} disabled={!canUndo} onClick={undo} data-testid="editor-undo"><EditorIcon tool="undo" /></TooltipButton>
      <TooltipButton tip={tips.redo} aria-label={locale === 'ko' ? '다시 실행' : 'Redo'} disabled={!canRedo} onClick={redo} data-testid="editor-redo"><EditorIcon tool="redo" /></TooltipButton>
      <TooltipButton tip={tips.properties} onClick={() => { onOpenProperties?.(); setPropertiesOpen(!propertiesOpen || panelBlocked) }} aria-expanded={propertiesOpen && !panelBlocked} aria-controls="editor-properties">{locale === 'ko' ? '속성 / 파일' : 'Properties / files'}</TooltipButton>
      <TooltipButton tip={tips.apply} className="toolbar-primary" onClick={handleApply} disabled={!isValid} data-testid="env-editor-apply">{t.envEditor.apply}</TooltipButton>
      <TooltipButton tip={locale === 'ko' ? '현재 초안에서 방향키 / WASD로 플레이합니다. 학습 데이터는 변경되지 않습니다.' : 'Play this draft with arrows / WASD in an isolated environment.'} disabled={!isValid} onClick={() => setPlaying(true)} data-testid="manual-play-start">{locale === 'ko' ? '직접 플레이' : 'Play draft'}</TooltipButton>
    </FloatingToolbar>
    {bodyEl}
    {noticeEl}
    </div>
  </div>

  return (
    <div className="w-full max-w-lg space-y-3 rounded border border-gray-200 p-4 text-sm" data-testid="env-editor">
      <h2 className="font-semibold text-gray-700">{t.envEditor.heading}</h2>

      {/*
        Phase 46 — Import/Export, placed right under the heading per the phase's own
        suggested UI structure. Standard browser file input/download only — no server/DB
        (Phase 46 §17/§18). The hidden <input type="file"> is triggered by the visible
        "환경 불러오기"/Import button so it can be styled consistently with Export instead
        of showing the browser's own default file-input control.
      */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleImportClick}
          data-testid="env-editor-import"
          className="rounded bg-gray-200 px-3 py-1 text-sm font-medium text-gray-800 hover:bg-gray-300"
        >
          {t.envEditor.importButton}
        </button>
        <input
          ref={importFileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleImportFileChange}
          data-testid="env-editor-import-file-input"
          className="hidden"
        />
        <button
          type="button"
          onClick={handleExport}
          data-testid="env-editor-export"
          className="rounded bg-gray-200 px-3 py-1 text-sm font-medium text-gray-800 hover:bg-gray-300"
        >
          {t.envEditor.exportButton}
        </button>
      </div>
      {importError && (
        <p className="text-xs text-red-600" data-testid="env-editor-import-error">
          {t.envEditor.importError} {translateValidationError(importError, locale)}
        </p>
      )}

      <label className="flex items-center gap-1">
        {t.envEditor.preset}
        <select
          value={presetId}
          onChange={(e) => selectPreset(e.target.value)}
          data-testid="env-editor-preset-select"
          className="rounded border border-gray-300 px-1 py-0.5"
        >
          <option value="custom">{presetLabel.custom}</option>
          {ENVIRONMENT_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.metadata.name[locale]}
            </option>
          ))}
        </select>
      </label>
      {presetDescription[presetId] && (
        <p className="text-xs text-gray-500" data-testid="env-editor-preset-description">
          {presetDescription[presetId]}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1">
          {t.envEditor.width}
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={draft.width}
            onChange={(e) => updateWidth(Number(e.target.value))}
            data-testid="env-editor-width-input"
            className="w-16 rounded border border-gray-300 px-1 py-0.5"
          />
        </label>
        <label className="flex items-center gap-1">
          {t.envEditor.height}
          <input
            type="number"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={draft.height}
            onChange={(e) => updateHeight(Number(e.target.value))}
            data-testid="env-editor-height-input"
            className="w-16 rounded border border-gray-300 px-1 py-0.5"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1">
          {t.envEditor.stepReward}
          <input
            type="number"
            step={0.1}
            value={draft.stepReward}
            onChange={(e) => updateStepReward(Number(e.target.value))}
            data-testid="env-editor-step-reward-input"
            className="w-16 rounded border border-gray-300 px-1 py-0.5"
          />
        </label>
        <label className="flex items-center gap-1">
          {t.envEditor.wallPenalty}
          <input
            type="number"
            step={0.1}
            value={draft.wallPenalty}
            onChange={(e) => updateWallPenalty(Number(e.target.value))}
            data-testid="env-editor-wall-penalty-input"
            className="w-16 rounded border border-gray-300 px-1 py-0.5"
          />
        </label>
        <label className="flex items-center gap-1">
          {t.envEditor.goalReward}
          <input
            type="number"
            step={0.1}
            value={draft.goalReward}
            onChange={(e) => updateGoalReward(Number(e.target.value))}
            data-testid="env-editor-goal-reward-input"
            className="w-16 rounded border border-gray-300 px-1 py-0.5"
          />
        </label>
        <label className="flex items-center gap-1">
          {t.envEditor.bombPenalty}
          <input
            type="number"
            step={0.1}
            value={draft.bombPenalty}
            onChange={(e) => updateBombPenalty(Number(e.target.value))}
            data-testid="env-editor-bomb-penalty-input"
            className="w-16 rounded border border-gray-300 px-1 py-0.5"
          />
        </label>
      </div>

      <div className="flex gap-2">
        {(['wall', 'start', 'goal', 'bomb'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            data-testid={`env-editor-mode-${m}`}
            className={`rounded px-3 py-1 text-sm font-medium capitalize ${
              mode === m ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            {modeLabel[m]}
          </button>
        ))}
      </div>

      <div data-testid="env-editor-grid">
        <p className="mb-1 text-xs text-gray-500">{t.envEditor.draftPreview}</p>
        {/*
          Phase 52 — the Draft preview's raw SVG (cellSize=32, unconstrained) is exactly
          `draft.width * 32` px wide with no responsive scaling, so once that exceeds this
          panel's own `max-w-lg` (512px minus this div's padding), it silently overflowed
          the panel's box and spilled into the right column's Stats panel — reproduced via
          real-browser measurement: 16×16 = 512px fits, 17×17 = 544px doesn't (the exact
          "16 vs 17" threshold reported). `App.tsx`'s live Grid already solved this same
          shape of problem (Phase 37) with a maxWidth-capped wrapper + a responsive
          `w-full h-auto` SVG — reused verbatim here rather than inventing a second
          technique: the wrapper caps preferred width at the Draft's own natural full
          size (so small Drafts render unchanged, exactly as before), while `w-full
          h-auto` lets the SVG shrink to fit whatever width is actually available once
          that cap would otherwise exceed the panel.
        */}
        <div className="w-full" style={{ maxWidth: draft.width * 32 }}>
          <GridSvg
            renderModel={draftToRenderModel(draft)}
            cellSize={32}
            onStateSelect={handleCellClick}
            className="block h-auto w-full"
          />
        </div>
      </div>

      {errors.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-red-600" data-testid="env-editor-errors">
          {errors.map((message) => (
            <li key={message}>{translateValidationError(message, locale)}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleApply}
          disabled={!isValid}
          data-testid="env-editor-apply"
          className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t.envEditor.apply}
        </button>
        <button
          type="button"
          onClick={handleResetEnvironment}
          data-testid="env-editor-reset"
          className="rounded bg-gray-200 px-4 py-2 font-medium text-gray-800 hover:bg-gray-300"
        >
          {t.envEditor.resetEnvironment}
        </button>
      </div>
    </div>
  )
}
