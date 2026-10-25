import { useEffect, useRef, useState } from 'react'
import { ENVIRONMENT_PRESETS } from './environmentPresets'
import { draftToRenderModel, type GridEditorDraft } from './envEditorDraft'
import { GridSvg } from '../grid/GridSvg'
import type { Locale } from '../../ui/i18n'
import { translations } from '../../ui/i18n'

export function MapGallery({ locale, onSelect, onClose, labels, actionLabel }: { locale: Locale; onSelect: (draft: GridEditorDraft) => void; onClose: () => void; labels: Record<string, string>; actionLabel?: string }) {
  const [selected, setSelected] = useState(ENVIRONMENT_PRESETS[0])
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
  return <section id="preset-panel" className="map-gallery preset-drawer" role="region" aria-label={ko ? '맵 갤러리' : 'Map gallery'} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <header><h2>{ko ? '맵 갤러리' : 'Map gallery'}</h2><button ref={closeButton} onClick={onClose} aria-label={ko ? '갤러리 닫기' : 'Close gallery'}>×</button></header>
    <div className="gallery-body"><div className="gallery-thumbnails">{ENVIRONMENT_PRESETS.map(preset => <button key={preset.id} aria-pressed={selected.id === preset.id} onClick={() => setSelected(preset)} data-testid={`preset-${preset.id}`}><GridSvg renderModel={draftToRenderModel(preset.draft)} cellSize={12} className="thumbnail-grid" /><span>{metadata(preset).name[locale] ?? preset.id}</span><small>{preset.draft.width} × {preset.draft.height} · {metadata(preset).difficulty[locale]}</small></button>)}</div>
      <div className="gallery-preview"><h3>{detail.name[locale] ?? selected.id}</h3><GridSvg renderModel={draftToRenderModel(selected.draft)} cellSize={24} className="thumbnail-grid" /><div className="preset-metadata"><span>{selected.draft.width} × {selected.draft.height} · {detail.difficulty[locale]}</span><p>{detail.description[locale]}</p><div>{detail.elements.map(element => <small key={element}>{element}</small>)}</div></div><p>{ko ? '미리보기는 현재 실험에 영향을 주지 않습니다.' : 'Preview does not change the current experiment.'}</p><button className="primary-button" onClick={() => { onSelect(structuredClone(selected.draft)); onClose() }}>{actionLabel ?? (ko ? '이 맵 선택' : 'Select this map')}</button></div>
    </div>
  </section>
}
