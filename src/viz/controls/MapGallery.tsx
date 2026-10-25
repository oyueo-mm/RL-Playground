import { DIFFICULTIES, type EnvironmentPreset } from '../../data/presets/manifest'
import auditSummaries from '../../data/presets/auditSummary.json'
import { useEffect, useRef, useState } from 'react'
import { ENVIRONMENT_PRESETS } from './environmentPresets'
import { draftToRenderModel, type GridEditorDraft } from './envEditorDraft'
import { GridSvg } from '../grid/GridSvg'
import type { Locale } from '../../ui/i18n'

export function MapGallery({ locale, onSelect, onClose, actionLabel, onEdit }: { locale: Locale; onSelect: (draft: GridEditorDraft, preset: EnvironmentPreset) => void; onEdit?: (draft: GridEditorDraft) => void; onClose: () => void; actionLabel?: string }) {
  const [selected, setSelected] = useState(ENVIRONMENT_PRESETS[0])
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState('all')
  const [size, setSize] = useState('all')
  const [element, setElement] = useState('all')
  const [category, setCategory] = useState('all')
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeButton.current?.focus()
    return () => { if (window.innerWidth <= 760) document.getElementById('mobile-menu')?.focus(); else previous?.focus() }
  }, [])
  const ko = locale === 'ko'
  const metadata = (preset: typeof selected) => preset.metadata
  const detail = metadata(selected)
  const audit = (auditSummaries as Record<string,{status:string;losingStates:number|null;gimmicks:Record<string,string>}>)[selected.id]
  const filtered = ENVIRONMENT_PRESETS.filter(preset => {
    const meta = metadata(preset)
    const features = [preset.draft.portals?.length, preset.draft.oneWays?.length, preset.draft.fragiles?.length, preset.draft.switches?.length].filter(Boolean).length
    const kind = features === 0 ? 'basic' : features === 1 ? 'dynamic' : 'mixed'
    return `${meta.name.ko} ${meta.name.en} ${meta.description.ko} ${meta.description.en} ${meta.elements.join(' ')} ${meta.difficulty.ko} ${meta.difficulty.en}`.toLowerCase().includes(search.toLowerCase()) && (difficulty === 'all' || meta.difficulty.id === difficulty) && (size === 'all' || (size === 'large' ? Math.max(preset.draft.width, preset.draft.height) >= 12 : Math.max(preset.draft.width, preset.draft.height) < 12)) && (element === 'all' || meta.elements.includes(element)) && (category === 'all' || category === kind)
  })
  return <section id="preset-panel" className="map-gallery preset-drawer" role="dialog" aria-modal="true" aria-label={ko ? '맵 갤러리' : 'Map gallery'} onKeyDown={event => { if (event.key === 'Tab') { const items=event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),input,select,summary,[tabindex="0"]'); const first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()} } if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <header><h2>{ko ? '맵 갤러리' : 'Map gallery'}</h2><button ref={closeButton} onClick={onClose} aria-label={ko ? '갤러리 닫기' : 'Close gallery'}>×</button></header>
    <div role="tablist" className="difficulty-tabs" aria-label={ko?'프리셋 난이도':'Preset difficulty'}>{[{id:'all',ko:'전체',en:'All'},...DIFFICULTIES].map(tier=><button role="tab" key={tier.id} aria-selected={difficulty===tier.id} onClick={()=>setDifficulty(tier.id)}>{tier[locale]} · {tier.id==='all'?30:6}</button>)}</div>
    <div className="gallery-filters"><label>{ko ? '맵 검색' : 'Search maps'}<input type="search" value={search} onChange={event => setSearch(event.target.value)} data-testid="preset-search" /></label><details><summary>{ko ? '필터' : 'Filters'} · {filtered.length}/{ENVIRONMENT_PRESETS.length}</summary>
      <label>{ko ? '난이도' : 'Difficulty'}<select aria-label={ko ? "난이도" : "Difficulty"} value={difficulty} onChange={event => setDifficulty(event.target.value)}><option value="all">{ko ? '전체' : 'All'}</option>{[...new Map(ENVIRONMENT_PRESETS.map(preset => [metadata(preset).difficulty.id, metadata(preset).difficulty[locale]])).entries()].map(([value, label]) => <option key={value} value={value}>{label} · {ENVIRONMENT_PRESETS.filter(p => p.metadata.difficulty.id === value).length}</option>)}</select></label>
      <label>{ko ? '크기' : 'Size'}<select aria-label={ko ? "크기" : "Size"} value={size} onChange={event => setSize(event.target.value)}><option value="all">{ko ? '전체' : 'All'}</option><option value="small">&lt; 12</option><option value="large">≥ 12</option></select></label>
      <label>{ko ? '환경 요소' : 'Element'}<select aria-label={ko ? "환경 요소" : "Element"} value={element} onChange={event => setElement(event.target.value)}><option value="all">{ko ? '전체' : 'All'}</option>{[...new Set(ENVIRONMENT_PRESETS.flatMap(preset => metadata(preset).elements))].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>{ko ? '유형' : 'Type'}<select aria-label={ko ? "유형" : "Type"} value={category} onChange={event => setCategory(event.target.value)}><option value="all">{ko ? '전체' : 'All'}</option><option value="basic">{ko ? '기본' : 'Basic'}</option><option value="dynamic">{ko ? '단일 특수 요소' : 'Single feature'}</option><option value="mixed">{ko ? '복합' : 'Mixed'}</option></select></label>
      <button onClick={() => { setSearch(''); setDifficulty('all'); setSize('all'); setElement('all'); setCategory('all') }}>{ko ? '필터 초기화' : 'Reset filters'}</button></details></div>
    <div className="gallery-body"><div className="gallery-thumbnails">{filtered.map(preset => <button key={preset.id} aria-pressed={selected.id === preset.id} onClick={() => setSelected(preset)} data-testid={`preset-${preset.id}`}><img src={preset.previewUrl} alt="" className="thumbnail-grid" loading="lazy" width={preset.draft.width*12} height={preset.draft.height*12} /><span>{metadata(preset).name[locale] ?? preset.id}</span><small>{preset.draft.goals.length} {ko ? "목표" : "Goals"} · {metadata(preset).elements.join(" / ")}</small><small>{preset.draft.width} × {preset.draft.height} · {metadata(preset).difficulty[locale]}</small></button>)}{!filtered.length && <p role="status">{ko ? '검색 결과가 없습니다.' : 'No matching maps.'}</p>}</div>
      <div className="gallery-preview"><h3>{detail.name[locale] ?? selected.id}</h3><GridSvg renderModel={draftToRenderModel(selected.draft)} cellSize={24} className="thumbnail-grid" /><div className="preset-metadata"><span>{selected.draft.width} × {selected.draft.height} · {detail.difficulty[locale]} · {selected.draft.goals.length} {ko ? "목표" : "Goals"}</span><p>{detail.description[locale]}</p><small>{ko ? '검증된 성공 경로' : 'Verified solution'} · {selected.solution.length} {ko ? '스텝' : 'steps'}</small><div>{detail.elements.map(element => <small key={element}>{element}</small>)}</div></div><div className="audit-summary" role="status">{audit?.losingStates ? (ko?'주의: 일부 붕괴 이후 남은 목표를 회수할 수 없는 상태가 확인되었습니다.':'Warning: some collapsed states cannot recover every remaining goal.') : audit?.status==='complete' ? (ko?'전체 상태 감사: 목표 회수 불가 상태 없음.':'Complete state audit: no losing states.') : (ko?'동적 안전성: 5,000 상태 탐색 한도로 검증 미완료.':'Dynamic safety: incomplete at the 5,000-state search budget.')}<small>{ko?'성공 경로 검증 완료 · 난이도/학습 수렴 보장 아님.':'Success path verified; difficulty and training convergence are not guaranteed.'}</small>{audit&&Object.entries(audit.gimmicks).map(([kind,result])=><small key={kind}>{({switch:ko?'스위치':'Switch',portal:ko?'포털':'Portal',fragile:ko?'붕괴 바닥':'Fragile'})[kind as 'switch'|'portal'|'fragile']}: {result==='required-proven'?(ko?'사용 필수 확인':'Required, proven'):result==='bypass-found'?(ko?'사용하지 않는 성공 경로 있음 (선택 요소)':'A successful bypass exists (optional)'):(ko?'필수 여부 미검증':'Necessity unverified')}</small>)}</div><p>{ko ? '미리보기는 현재 실험에 영향을 주지 않습니다.'  : 'Preview does not change the current experiment.'}</p><button className="primary-button" onClick={() => { onSelect(structuredClone(selected.draft), selected) }}>{actionLabel ?? (ko ? '맵 적용하기' : 'Apply map')}</button>{onEdit && <button onClick={() => onEdit(structuredClone(selected.draft))}>{ko ? '편집기로 불러오기' : 'Load into editor'}</button>}</div>
    </div>
  </section>
}
