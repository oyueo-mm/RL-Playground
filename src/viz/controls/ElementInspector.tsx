// V4 — selected-element inspector for the fullscreen editor's properties panel. Shows
// only the settings that belong to the element under the selection; every change is
// reported through callbacks so EnvEditor keeps sole ownership of the undo history.

import type { Direction, Position } from '../../core/environments/gridworld/types'
import { positionId } from '../../core/environments/gridworld/features'
import { EditorIcon } from '../../ui/EditorIcon'
import type { Locale } from '../../ui/i18n'
import { elementAt } from './editorOperations'
import { samePosition, type GridEditorDraft } from './envEditorDraft'

const ID_PATTERN = /^[A-Za-z0-9_-]{1,24}$/
const signed = (value: number) => `${value > 0 ? '+' : ''}${value}`
const at = (pos: Position) => `(${pos.x}, ${pos.y})`

export interface ElementInspectorProps {
  draft: GridEditorDraft
  cell: Position
  locale: Locale
  kindLabel: Record<string, string>
  portalId: string
  groupId: string
  direction: Direction
  onPortalId: (id: string) => void
  onGroupId: (id: string) => void
  onDirection: (direction: Direction) => void
  onValue: (kind: 'goal' | 'bomb', value: number | undefined, typing: boolean) => void
  onInitialOpen: (open: boolean) => void
  onTerrainCost: (cost: number | undefined, typing: boolean) => void
  onPortalDirected: (directed: boolean) => void
  onFlipPortal: () => void
  onDelete: () => void
}

export function ElementInspector({ draft, cell, locale, kindLabel, portalId, groupId, direction, onPortalId, onGroupId, onDirection, onValue, onInitialOpen, onTerrainCost, onPortalDirected, onFlipPortal, onDelete }: ElementInspectorProps) {
  const ko = locale === 'ko'
  const element = elementAt(draft, cell)
  if (!element) return <section className="element-inspector" data-testid="element-inspector" data-kind="empty">
    <p className="inspector-empty">{ko ? `빈 칸 ${at(cell)} — 편집할 요소가 없습니다. 요소가 있는 칸을 선택하세요.` : `Empty cell ${at(cell)} — nothing to edit. Select a cell with an element.`}</p>
  </section>

  const deleteBlocked = element.kind === 'start' ? (ko ? '시작점은 삭제할 수 없습니다. 드래그로 옮기세요.' : 'Start cannot be deleted. Drag it to move it.')
    : element.kind === 'goal' && draft.goals.length === 1 ? (ko ? '마지막 목표는 삭제할 수 없습니다.' : 'The last goal cannot be deleted.') : null

  const swampField = () => {
    const own = element.cost, fallback = draft.terrainCost ?? -1, inherit = own === undefined
    return <fieldset className="value-source" data-testid="element-value">
      <legend>{ko ? '늪 진입 비용' : 'Swamp entry cost'}</legend>
      <label><input type="radio" name="terrain-cost-source" checked={inherit} onChange={() => onTerrainCost(undefined, false)} data-testid="element-value-inherit" />{ko ? '맵 기본값 사용' : 'Use map default'}<span className="value-chip">{signed(fallback)}</span></label>
      <label><input type="radio" name="terrain-cost-source" checked={!inherit} onChange={() => onTerrainCost(fallback, false)} data-testid="element-value-custom" />{ko ? '개별 값 지정' : 'Custom value'}
        <input type="number" step="0.1" max={0} aria-label={ko ? '늪 비용' : 'Swamp cost'} disabled={inherit} value={own === undefined ? fallback : Number.isNaN(own) ? '' : own} data-testid="element-value-input" onChange={event => { if (!inherit) onTerrainCost(event.target.value === '' ? Number.NaN : Number(event.target.value), true) }} /></label>
      {!inherit && !(Number.isFinite(own) && own <= 0) && <p className="inspector-problem" role="alert">{ko ? '늪 비용은 0 이하의 숫자여야 합니다.' : 'A swamp cost must be a number no greater than 0.'}</p>}
      <p>{ko ? '이 타일에 들어갈 때 일반 이동 보상 대신 이 값을 받습니다. 벽에 막히거나 격자 밖으로 나가는 이동에는 적용되지 않습니다. 0 이하만 허용됩니다.' : 'Entering this tile pays this value instead of the normal step reward. Blocked moves and boundary hits are not charged. Only values of 0 or less are allowed.'}</p>
    </fieldset>
  }

  const valueField = (kind: 'goal' | 'bomb') => {
    const own = kind === 'goal' ? element.reward : element.penalty
    const fallback = kind === 'goal' ? draft.goalReward : draft.bombPenalty
    const inherit = own === undefined
    const name = `${kind}-value-source`
    return <fieldset className="value-source" data-testid="element-value">
      <legend>{kind === 'goal' ? (ko ? '최초 수집 보상' : 'First-collection reward') : (ko ? '진입 페널티 (종료)' : 'Entry penalty (terminal)')}</legend>
      <label><input type="radio" name={name} checked={inherit} onChange={() => onValue(kind, undefined, false)} data-testid="element-value-inherit" />{ko ? '맵 기본값 사용' : 'Use map default'}<span className="value-chip">{signed(fallback)}</span></label>
      <label><input type="radio" name={name} checked={!inherit} onChange={() => onValue(kind, fallback, false)} data-testid="element-value-custom" />{ko ? '개별 값 지정' : 'Custom value'}
        <input type="number" step="0.1" aria-label={kind === 'goal' ? (ko ? '목표 보상' : 'Goal reward') : (ko ? '폭탄 페널티' : 'Bomb penalty')} disabled={inherit} value={own === undefined ? fallback : Number.isNaN(own) ? '' : own} data-testid="element-value-input" onChange={event => { if (!inherit) onValue(kind, event.target.value === '' ? Number.NaN : Number(event.target.value), true) }} /></label>
      <p>{kind === 'goal' ? (ko ? '이 목표를 에피소드에서 처음 수집할 때 한 번만 받습니다. 음수·0도 허용됩니다.' : 'Paid once, on this goal’s first collection in an episode. Zero and negative values are allowed.') : (ko ? '이 폭탄에 들어가면 에피소드가 끝나고 이 값을 받습니다. 양수도 허용되지만 보통 음수를 씁니다.' : 'Entering this bomb ends the episode with this value. Usually negative; any finite number is allowed.')}</p>
    </fieldset>
  }

  const group = (id: string) => ({ switches: draft.switches?.filter(tile => tile.groupId === id) ?? [], walls: draft.toggleWalls?.filter(tile => tile.groupId === id) ?? [] })
  const groupStatus = (id: string) => {
    const { switches, walls } = group(id)
    if (!ID_PATTERN.test(id)) return ko ? '그룹 ID는 영문·숫자·_·- 1~24자여야 합니다.' : 'Group IDs use letters, numbers, _ or -, 1–24 characters.'
    if (!switches.length) return ko ? `그룹 ${id}에 스위치가 없습니다. 같은 ID의 스위치를 배치하세요.` : `Group ${id} has no switch. Place a switch with the same ID.`
    if (!walls.length) return ko ? `그룹 ${id}에 토글 벽이 없습니다. 같은 ID의 벽을 배치하세요.` : `Group ${id} has no toggle wall. Place a wall with the same ID.`
    return null
  }
  const groupFields = () => {
    const { switches, walls } = group(groupId)
    const problem = groupStatus(groupId)
    return <>
      <label>{ko ? '벽 그룹 ID' : 'Wall group ID'}<input value={groupId} list="existing-groups" maxLength={24} data-testid="group-id" onChange={event => onGroupId(event.target.value)} /></label>
      <div className="link-summary" data-testid="element-links">
        <strong>{ko ? `스위치 ${switches.length} · 토글 벽 ${walls.length}` : `${switches.length} switch(es) · ${walls.length} wall(s)`}</strong>
        <ul>{walls.slice(0, 8).map(tile => <li key={positionId(tile)} aria-current={samePosition(tile, cell) || undefined}>{at(tile)} <span className={`state-chip ${tile.initialOpen ? 'is-open' : ''}`}>{tile.initialOpen ? (ko ? '열림으로 시작' : 'starts open') : (ko ? '닫힘으로 시작' : 'starts closed')}</span></li>)}{walls.length > 8 && <li>{ko ? `외 ${walls.length - 8}개` : `+${walls.length - 8} more`}</li>}</ul>
      </div>
      {problem ? <p className="inspector-problem" role="alert">{problem}</p> : <p>{ko ? '스위치를 밟을 때마다 이 그룹의 모든 벽이 현재 상태에서 반전됩니다.' : 'Each switch press flips every wall in this group from its current state.'}</p>}
    </>
  }

  const portal = element.kind === 'portal' ? draft.portals?.find(pair => pair.ends.some(end => samePosition(end, cell))) : undefined
  const portalProblem = !portal ? null
    : !ID_PATTERN.test(portalId) ? (ko ? '포털 ID는 영문·숫자·_·- 1~24자여야 합니다.' : 'Portal IDs use letters, numbers, _ or -, 1–24 characters.')
      : (draft.portals?.filter(pair => pair.id === portal.id).length ?? 0) > 1 ? (ko ? `ID ${portal.id}를 쓰는 다른 포털 쌍이 있습니다. 다른 ID를 입력하세요.` : `Another portal pair already uses ${portal.id}. Choose a different ID.`)
        : portal.ends.length !== 2 ? (ko ? '끝점이 1개뿐입니다. 포털 도구로 같은 ID의 끝점을 하나 더 배치하세요.' : 'Only one endpoint. Place another endpoint with the same ID using the Portal tool.') : null

  return <section className="element-inspector" data-testid="element-inspector" data-kind={element.kind} aria-label={ko ? '선택한 요소' : 'Selected element'}>
    <div className="inspector-heading"><EditorIcon tool={element.kind} /><div><strong data-testid="element-kind">{kindLabel[element.kind]}</strong><small data-testid="element-position">{ko ? '좌표' : 'Cell'} {at(cell)}</small></div></div>
    {element.kind === 'goal' && valueField('goal')}
    {element.kind === 'terrain' && swampField()}
    {element.kind === 'bomb' && valueField('bomb')}
    {element.kind === 'oneWay' && <label>{ko ? '허용 방향' : 'Allowed direction'}<select value={direction} data-testid="one-way-direction" onChange={event => onDirection(Number(event.target.value) as Direction)}>{(ko ? ['↑ 위', '↓ 아래', '← 왼쪽', '→ 오른쪽'] : ['↑ Up', '↓ Down', '← Left', '→ Right']).map((label, index) => <option key={index} value={index}>{label}</option>)}</select></label>}
    {element.kind === 'oneWay' && <p>{ko ? '이 칸에서 나갈 때 선택한 방향으로만 이동할 수 있습니다. 단방향 도구로 다시 클릭해도 시계 방향으로 바뀝니다.' : 'Leaving this cell is only allowed in the chosen direction. Re-clicking with the One-way tool also rotates it clockwise.'}</p>}
    {element.kind === 'toggleWall' && <div className="segmented" role="group" aria-label={ko ? '초기 상태' : 'Initial state'}>
      <span>{ko ? '초기 상태' : 'Initial state'}</span>
      <button type="button" aria-pressed={!element.initialOpen} onClick={() => onInitialOpen(false)} data-testid="toggle-initial-closed">{ko ? '닫힘' : 'Closed'}</button>
      <button type="button" aria-pressed={!!element.initialOpen} onClick={() => onInitialOpen(true)} data-testid="toggle-initial-open">{ko ? '열림' : 'Open'}</button>
    </div>}
    {(element.kind === 'toggleWall' || element.kind === 'switch') && groupFields()}
    {portal && <>
      <label>{ko ? '포털 쌍 ID' : 'Portal pair ID'}<input value={portalId} list="existing-portals" maxLength={24} data-testid="portal-id" onChange={event => onPortalId(event.target.value)} /></label>
      <div className="segmented" role="group" aria-label={ko ? '포털 방향' : 'Portal direction'}>
        <span>{ko ? '방향' : 'Direction'}</span>
        <button type="button" aria-pressed={!portal.directed} onClick={() => onPortalDirected(false)} data-testid="portal-two-way">{ko ? '양방향' : 'Two-way'}</button>
        <button type="button" aria-pressed={!!portal.directed} onClick={() => onPortalDirected(true)} data-testid="portal-one-way">{ko ? '단방향' : 'One-way'}</button>
      </div>
      <div className="link-summary" data-testid="element-links"><strong>{portal.ends.length === 2 ? (portal.directed ? (ko ? '연결됨 · A → B' : 'Linked · A → B') : (ko ? '연결됨 · 양방향' : 'Linked · two-way')) : (ko ? '연결 미완성' : 'Incomplete')}</strong><ul>{portal.ends.map((end, index) => <li key={positionId(end)} aria-current={samePosition(end, cell) || undefined}>{portal.directed && <span className="state-chip" data-testid={index === 0 ? 'portal-entrance' : 'portal-exit'}>{index === 0 ? (ko ? '입구 A' : 'Entrance A') : (ko ? '출구 B' : 'Exit B')}</span>}{at(end)}{samePosition(end, cell) ? (ko ? ' · 선택됨' : ' · selected') : ''}</li>)}</ul></div>
      {portal.directed && portal.ends.length === 2 && <button type="button" onClick={onFlipPortal} data-testid="portal-flip">{ko ? '방향 뒤집기 (A ↔ B)' : 'Flip direction (A ↔ B)'}</button>}
      {portalProblem ? <p className="inspector-problem" role="alert">{portalProblem}</p> : <p>{portal.directed ? (ko ? '입구 A에 들어가면 출구 B로 이동합니다. B로 들어가도 A로 돌아가지 않습니다.' : 'Entering A moves the agent to B. Walking into B does not send it back to A.') : (ko ? '한쪽 끝에 들어가면 즉시 다른 끝으로 이동합니다.' : 'Entering one end moves the agent to the other end.')}</p>}
    </>}
    {element.kind === 'start' && <p>{ko ? '에이전트가 매 에피소드를 시작하는 칸입니다.' : 'Every episode starts on this cell.'}</p>}
    <button type="button" className="danger-button" disabled={!!deleteBlocked} title={deleteBlocked ?? undefined} onClick={onDelete} data-testid="element-delete">{ko ? '이 요소 삭제' : 'Delete element'}</button>
    {deleteBlocked && <p>{deleteBlocked}</p>}
  </section>
}
