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

import { useEffect, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react'
import type { GridWorldConfig, Direction } from '../../core/environments/gridworld/types'
import { featurePositions, positionId, stateSpaceEstimate, STATE_SPACE_BUDGET } from '../../core/environments/gridworld/features'
import type { EnvRenderModel } from '../../core/types/render'
import type { StateKey } from '../../core/types/rl'
import { GridSvg } from '../grid/GridSvg'
import { GridViewport } from '../../ui/GridViewport'
import { FloatingToolbar } from '../../ui/FloatingToolbar'
import { TooltipButton } from '../../ui/TooltipButton'
import { toolbarTips } from '../../ui/toolbarTips'
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
  const seedKey = JSON.stringify([currentRenderModel.width, currentRenderModel.height, currentRenderModel.start, currentRenderModel.allGoals ?? currentRenderModel.goals, currentRenderModel.staticWalls ?? currentRenderModel.walls, currentRenderModel.bombs, currentRenderModel.stepReward, currentRenderModel.wallPenalty, currentRenderModel.goalReward, currentRenderModel.bombPenalty, currentRenderModel.features])
  const previousSeed = useRef(seedKey)
  useEffect(() => {
    const incoming = draftFromRenderModel(currentRenderModel)
    // Applying our own draft acknowledges it; it must not erase its undo history.
    if (previousSeed.current !== seedKey && !dirty.current && serializeEnvExport(incoming) !== serializeEnvExport(draft)) reseed(incoming)
    previousSeed.current = seedKey
  }, [seedKey, currentRenderModel, reseed, draft])
  const [mode, setMode] = useState<EditMode>('wall')
  const [presetId, setPresetId] = useState<string>('custom')
  const [propertiesOpen, setPropertiesOpen] = useState(false)
  const [selectedCell, setSelectedCell] = useState<StateKey | null>(null)
  const [portalId, setPortalId] = useState('P1')
  const [groupId, setGroupId] = useState('G1')
  const [direction, setDirection] = useState<Direction>(3)
  const [editMessage, setEditMessage] = useState('')
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
    if (!active) return
    const handle = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return }
        if (event.key.toLowerCase() === 'y' && event.ctrlKey) { event.preventDefault(); redo(); return }
      }
      if (mode === 'select' && selectedCell && (event.key === 'Backspace' || event.key === 'Delete')) { event.preventDefault(); deleteCell(selectedCell) }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  })
  useEffect(() => {
    if (!active) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setPropertiesOpen(false) } }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [active])
  // Phase 46 — Import/Export. `importError` is cleared on every successful Import (and
  // stays until then — a bad file otherwise leaves no visible trace it was rejected).
  const [importError, setImportError] = useState<string | null>(null)
  const importFileInputRef = useRef<HTMLInputElement>(null)

  // validateDraft() itself always returns plain English messages (its own pure-function
  // tests assert those exact strings) — translated only for display here.
  const errors = validateDraft(draft)
  const isValid = errors.length === 0

  function deleteCell(key: StateKey) {
    const pos = parseStateKey(key)
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

  function handleCellClick(stateKey: StateKey) {
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
      if (!fullscreen) onApply(draftToGridWorldConfig(result.draft))
    }
    reader.onerror = () => setImportError('Could not read the selected file.')
    reader.readAsText(file)
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
  }

  const presetLabel: Record<string, string> = {
    custom: t.envEditor.presetCustom,
    basic: t.envEditor.presetBasic,
    corridor: t.envEditor.presetCorridor,
    maze: t.envEditor.presetMaze,
    bombField: t.envEditor.presetBombField,
    multiGoal: t.envEditor.presetMultiGoal,
    treasureHunt: t.envEditor.presetTreasureHunt,
    obstacleCourse: t.envEditor.presetObstacleCourse,
    complexMaze: t.envEditor.presetComplexMaze,
    deadEndMaze: t.envEditor.presetDeadEndMaze,
    multipleRoute: t.envEditor.presetMultipleRoute,
    riskyPath: t.envEditor.presetRiskyPath,
  }

  // Phase 56 §4 — a short one-line description shown under the selector, so a user
  // faced with a longer Preset list can tell what each one actually does without having
  // to select it first. `custom` has no entry (nothing to describe — it's just "whatever
  // the Draft currently is"), so the description line is omitted entirely for it.
  const presetDescription: Record<string, string> = {
    basic: t.envEditor.presetBasicDescription,
    corridor: t.envEditor.presetCorridorDescription,
    maze: t.envEditor.presetMazeDescription,
    bombField: t.envEditor.presetBombFieldDescription,
    multiGoal: t.envEditor.presetMultiGoalDescription,
    treasureHunt: t.envEditor.presetTreasureHuntDescription,
    obstacleCourse: t.envEditor.presetObstacleCourseDescription,
    complexMaze: t.envEditor.presetComplexMazeDescription,
    deadEndMaze: t.envEditor.presetDeadEndMazeDescription,
    multipleRoute: t.envEditor.presetMultipleRouteDescription,
    riskyPath: t.envEditor.presetRiskyPathDescription,
  }

  if (fullscreen) return <div className="fullscreen-editor" data-testid="env-editor">
    <h2 className="sr-only">{t.envEditor.heading}</h2>
    <FloatingToolbar className="editor-toolbar" active={active} label={locale === 'ko' ? '맵 편집 도구' : 'Map editing tools'}>
      <div className="tool-buttons" role="group" aria-label={locale === 'ko' ? '배치 요소' : 'Placement tools'}>{(['select', 'wall', 'start', 'goal', 'bomb', 'portal', 'oneWay', 'fragile', 'switch', 'toggleWall', 'erase'] as const).map(tool => <TooltipButton key={tool} tip={tips[tool]} aria-label={modeLabel[tool]} aria-pressed={mode === tool} onClick={() => setMode(tool)} data-testid={`env-editor-mode-${tool}`}><span aria-hidden="true">{({ select: '↖', wall: '▦', start: 'S', goal: '⚑', bomb: '×', portal: '◎', oneWay: '→', fragile: 'ϟ', switch: '⏻', toggleWall: '▥', erase: '⌫' })[tool]}</span></TooltipButton>)}</div>
      <span className="toolbar-separator" />
      <TooltipButton tip={tips.undo} aria-label={locale === 'ko' ? '실행 취소' : 'Undo'} disabled={!canUndo} onClick={undo} data-testid="editor-undo">↶</TooltipButton>
      <TooltipButton tip={tips.redo} aria-label={locale === 'ko' ? '다시 실행' : 'Redo'} disabled={!canRedo} onClick={redo} data-testid="editor-redo">↷</TooltipButton>
      <TooltipButton tip={tips.properties} onClick={() => { onOpenProperties?.(); setPropertiesOpen(!propertiesOpen || panelBlocked) }} aria-expanded={propertiesOpen && !panelBlocked} aria-controls="editor-properties">{locale === 'ko' ? '속성 / 파일' : 'Properties / files'}</TooltipButton>
      <TooltipButton tip={tips.apply} className="toolbar-primary" onClick={handleApply} disabled={!isValid} data-testid="env-editor-apply">{t.envEditor.apply}</TooltipButton>
    </FloatingToolbar>
    <div className="editor-body" data-testid="env-editor-grid">
      <GridViewport width={draft.width} height={draft.height} active={active}><GridSvg renderModel={draftToRenderModel(draft)} selectedState={selectedCell} cellSize={48} onStateSelect={handleCellClick} className="stage-grid" /></GridViewport>
      <aside className="properties-panel" id="editor-properties" hidden={!propertiesOpen || panelBlocked} aria-label={locale === 'ko' ? '맵 속성' : 'Map properties'}>
        <header><h2>{locale === 'ko' ? '맵 속성' : 'Map properties'}</h2><button onClick={() => setPropertiesOpen(false)} aria-label={locale === 'ko' ? '속성 닫기' : 'Close properties'}>×</button></header>
        <div className="property-fields" onBlurCapture={boundary}>
          <p>{locale === 'ko' ? '현재 도구' : 'Current tool'}: <strong>{modeLabel[mode]}</strong>{selectedCell ? ` · (${selectedCell})` : ''}</p>
          <label>{locale === 'ko' ? '포털 쌍 ID' : 'Portal pair ID'}<input value={portalId} maxLength={24} data-testid="portal-id" onChange={event => {
            const id = event.target.value; setPortalId(id)
            if (mode === 'select' && selectedCell) recordInput(prev => ({ ...prev, portals: prev.portals?.map(pair => pair.ends.some(end => positionId(end) === selectedCell) ? { ...pair, id } : pair) }), 'portal-id')
          }} /></label>
          <label>{locale === 'ko' ? '벽 그룹 ID' : 'Wall group ID'}<input value={groupId} maxLength={24} data-testid="group-id" onChange={event => {
            const id = event.target.value; setGroupId(id)
            if (mode === 'select' && selectedCell) recordInput(prev => ({ ...prev, switches: prev.switches?.map(tile => positionId(tile) === selectedCell ? { ...tile, groupId: id } : tile), toggleWalls: prev.toggleWalls?.map(tile => positionId(tile) === selectedCell ? { ...tile, groupId: id } : tile) }), 'group-id')
          }} /></label>
          <label>{locale === 'ko' ? '허용 방향' : 'Allowed direction'}<select value={direction} data-testid="one-way-direction" onChange={event => {
            const next = Number(event.target.value) as Direction; setDirection(next)
            if (mode === 'select' && selectedCell) setDraft(prev => ({ ...prev, oneWays: prev.oneWays?.map(tile => positionId(tile) === selectedCell ? { ...tile, direction: next } : tile) }))
          }}>{(locale === 'ko' ? ['↑ 위', '↓ 아래', '← 왼쪽', '→ 오른쪽'] : ['↑ Up', '↓ Down', '← Left', '→ Right']).map((label, index) => <option key={index} value={index}>{label}</option>)}</select></label>
          <p>{locale === 'ko' ? '포털은 같은 ID로 두 셀을 배치하세요. 벽 그룹에는 스위치와 토글 벽이 모두 필요합니다. 선택 도구로 요소를 누르면 연결선과 ID를 확인·수정할 수 있습니다. ID: 영문·숫자·_·- (1~24자).' : 'Place two portal cells with the same ID. Each wall group needs a switch and toggle wall. Select an element to inspect its links or edit its ID/direction. IDs: letters, numbers, _ and -, 1–24 characters.'}</p>
          <p data-testid="state-space-estimate">{locale === 'ko' ? '추정 상태 수 상한' : 'Estimated state upper bound'}: {stateSpaceEstimate(draft) > Number.MAX_SAFE_INTEGER ? stateSpaceEstimate(draft).toExponential(2) : stateSpaceEstimate(draft).toLocaleString()} · {locale === 'ko' ? '동적 맵 제한' : 'Dynamic-map limit'} {STATE_SPACE_BUDGET.toLocaleString()}</p>
          <label>{t.envEditor.width}<input type="number" min={3} max={20} value={draft.width} onChange={e => updateWidth(Number(e.target.value))} data-testid="env-editor-width-input" /></label>
          <label>{t.envEditor.height}<input type="number" min={3} max={20} value={draft.height} onChange={e => updateHeight(Number(e.target.value))} data-testid="env-editor-height-input" /></label>
          {(['stepReward', 'wallPenalty', 'goalReward', 'bombPenalty'] as const).map(key => <label key={key}>{({ stepReward: t.envEditor.stepReward, wallPenalty: t.envEditor.wallPenalty, goalReward: t.envEditor.goalReward, bombPenalty: t.envEditor.bombPenalty })[key]}<input type="number" step="0.1" value={draft[key]} data-testid={`env-editor-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}-input`} onChange={e => recordInput(previous => ({ ...previous, [key]: Number(e.target.value) }), key)} /></label>)}
          <button onClick={handleImportClick} data-testid="env-editor-import">{t.envEditor.importButton}</button><button onClick={handleExport} disabled={!isValid} data-testid="env-editor-export">{t.envEditor.exportButton}</button>
          <button onClick={handleResetEnvironment} data-testid="env-editor-reset">{t.envEditor.resetEnvironment}</button>
          <input hidden ref={importFileInputRef} type="file" accept=".json,application/json" onChange={handleImportFileChange} data-testid="env-editor-import-input" />
          <p>{locale === 'ko' ? '가져오기는 초안만 변경합니다. 적용은 현재 학습을 초기화합니다.' : 'Import changes only the draft. Applying resets the current experiment.'}</p>
        </div>
      </aside>
    </div>
    {(errors.length > 0 || importError || editMessage) && <div className="editor-validation" role="status" data-testid="env-editor-errors">{editMessage || (importError ? translateValidationError(importError, locale) : errors.map(error => translateValidationError(error, locale)).join(' '))}</div>}
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
              {presetLabel[preset.id]}
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
          className="rounded bg-purple-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
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
