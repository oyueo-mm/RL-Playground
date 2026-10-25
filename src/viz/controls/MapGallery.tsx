import { useEffect, useRef, useState } from 'react'
import { ENVIRONMENT_PRESETS } from './environmentPresets'
import { draftToRenderModel, type GridEditorDraft } from './envEditorDraft'
import { GridSvg } from '../grid/GridSvg'
import type { Locale } from '../../ui/i18n'
import { translations } from '../../ui/i18n'

export function MapGallery({ locale, onSelect, onClose, labels, actionLabel }: { locale: Locale; onSelect: (draft: GridEditorDraft) => void; onClose: () => void; labels: Record<string, string>; actionLabel?: string }) {
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
  const metadata = (preset: typeof selected) => {
    const dictionary = translations[locale].envEditor as unknown as Record<string, string>
    const key = `preset${preset.id[0].toUpperCase()}${preset.id.slice(1)}`
    return preset.metadata ?? { name: { ko: labels[preset.id], en: labels[preset.id] }, description: { ko: dictionary[`${key}Description`], en: dictionary[`${key}Description`] }, difficulty: { ko: preset.draft.width > 8 ? '고급' : '기초', en: preset.draft.width > 8 ? 'Hard' : 'Introductory' }, elements: [preset.draft.goals.length > 1 ? 'Multi-goal' : 'Goal', ...(preset.draft.walls.length ? ['Wall'] : []), ...(preset.draft.bombs.length ? ['Bomb'] : [])] }
  }
  const detail = metadata(selected)
  const filtered = ENVIRONMENT_PRESETS.filter(preset => {
    const meta = metadata(preset)
    const features = [preset.draft.portals?.length, preset.draft.oneWays?.length, preset.draft.fragiles?.length, preset.draft.switches?.length].filter(Boolean).length
    const kind = features === 0 ? 'basic' : features === 1 ? 'dynamic' : 'mixed'
    return `${meta.name[locale]} ${meta.description[locale]} ${meta.elements.join(' ')}`.toLowerCase().includes(search.toLowerCase()) && (difficulty === 'all' || meta.difficulty.en === difficulty) && (size === 'all' || (size === 'large' ? Math.max(preset.draft.width, preset.draft.height) >= 12 : Math.max(preset.draft.width, preset.draft.height) < 12)) && (element === 'all' || meta.elements.includes(element)) && (category === 'all' || category === kind)
  })
  return <section id="preset-panel" className="map-gallery preset-drawer" role="region" aria-label={ko ? '맵 갤러리' : 'Map gallery'} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <header><h2>{ko ? '맵 갤러리' : 'Map gallery'}</h2><button ref={closeButton} onClick={onClose} aria-label={ko ? '갤러리 닫기' : 'Close gallery'}>×</button></header>
    <div className="gallery-filters"><label>{ko ? '맵 검색' : 'Search maps'}<input type="search" value={search} onChange={event => setSearch(event.target.value)} data-testid="preset-search" /></label><details><summary>{ko ? '필터' : 'Filters'} · {filtered.length}/{ENVIRONMENT_PRESETS.length}</summary>
      <label>{ko ? '난이도' : 'Difficulty'}<select value={difficulty} onChange={event => setDifficulty(event.target.value)}><option value="all">{ko ? '전체' : 'All'}</option>{[...new Map(ENVIRONMENT_PRESETS.map(preset => [metadata(preset).difficulty.en, metadata(preset).difficulty[locale]])).entries()].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>{ko ? '크기' : 'Size'}<select value={size} onChange={event => setSize(event.target.value)}><option value="all">{ko ? '전체' : 'All'}</option><option value="small">&lt; 12</option><option value="large">≥ 12</option></select></label>
      <label>{ko ? '환경 요소' : 'Element'}<select value={element} onChange={event => setElement(event.target.value)}><option value="all">{ko ? '전체' : 'All'}</option>{[...new Set(ENVIRONMENT_PRESETS.flatMap(preset => metadata(preset).elements))].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>{ko ? '유형' : 'Type'}<select value={category} onChange={event => setCategory(event.target.value)}><option value="all">{ko ? '전체' : 'All'}</option><option value="basic">{ko ? '기본' : 'Basic'}</option><option value="dynamic">{ko ? '단일 특수 요소' : 'Single feature'}</option><option value="mixed">{ko ? '복합' : 'Mixed'}</option></select></label>
      <button onClick={() => { setSearch(''); setDifficulty('all'); setSize('all'); setElement('all'); setCategory('all') }}>{ko ? '필터 초기화' : 'Reset filters'}</button></details></div>
    <div className="gallery-body"><div className="gallery-thumbnails">{filtered.map(preset => <button key={preset.id} aria-pressed={selected.id === preset.id} onClick={() => setSelected(preset)} data-testid={`preset-${preset.id}`}><GridSvg renderModel={draftToRenderModel(preset.draft)} cellSize={12} className="thumbnail-grid" /><span>{metadata(preset).name[locale] ?? preset.id}</span><small>{preset.draft.width} × {preset.draft.height} · {metadata(preset).difficulty[locale]}</small></button>)}{!filtered.length && <p role="status">{ko ? '검색 결과가 없습니다.' : 'No matching maps.'}</p>}</div>
      <div className="gallery-preview"><h3>{detail.name[locale] ?? selected.id}</h3><GridSvg renderModel={draftToRenderModel(selected.draft)} cellSize={24} className="thumbnail-grid" /><div className="preset-metadata"><span>{selected.draft.width} × {selected.draft.height} · {detail.difficulty[locale]}</span><p>{detail.description[locale]}</p><div>{detail.elements.map(element => <small key={element}>{element}</small>)}</div></div><p>{ko ? '미리보기는 현재 실험에 영향을 주지 않습니다.' : 'Preview does not change the current experiment.'}</p><button className="primary-button" onClick={() => { onSelect(structuredClone(selected.draft)); onClose() }}>{actionLabel ?? (ko ? '이 맵 선택' : 'Select this map')}</button></div>
    </div>
  </section>
}
