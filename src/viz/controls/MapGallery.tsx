import { useEffect, useRef, useState } from 'react'
import { ENVIRONMENT_PRESETS } from './environmentPresets'
import { draftToRenderModel, type GridEditorDraft } from './envEditorDraft'
import { GridSvg } from '../grid/GridSvg'
import type { Locale } from '../../ui/i18n'

export function MapGallery({ locale, onSelect, onClose, labels, actionLabel }: { locale: Locale; onSelect: (draft: GridEditorDraft) => void; onClose: () => void; labels: Record<string, string>; actionLabel?: string }) {
  const [selected, setSelected] = useState(ENVIRONMENT_PRESETS[0])
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeButton.current?.focus()
    return () => previous?.focus()
  }, [])
  const ko = locale === 'ko'
  return <section className="map-gallery" role="dialog" aria-modal="false" aria-label={ko ? '맵 갤러리' : 'Map gallery'} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }}>
    <header><h2>{ko ? '맵 갤러리' : 'Map gallery'}</h2><button ref={closeButton} onClick={onClose} aria-label={ko ? '갤러리 닫기' : 'Close gallery'}>×</button></header>
    <div className="gallery-body"><div className="gallery-thumbnails">{ENVIRONMENT_PRESETS.map(preset => <button key={preset.id} aria-pressed={selected.id === preset.id} onClick={() => setSelected(preset)} data-testid={`preset-${preset.id}`}><GridSvg renderModel={draftToRenderModel(preset.draft)} cellSize={12} className="thumbnail-grid" /><span>{labels[preset.id] ?? preset.id}</span><small>{preset.draft.width} × {preset.draft.height}</small></button>)}</div>
      <div className="gallery-preview"><h3>{labels[selected.id] ?? selected.id}</h3><GridSvg renderModel={draftToRenderModel(selected.draft)} cellSize={24} className="thumbnail-grid" /><p>{ko ? '미리보기는 현재 실험에 영향을 주지 않습니다.' : 'Preview does not change the current experiment.'}</p><button className="primary-button" onClick={() => { onSelect(structuredClone(selected.draft)); onClose() }}>{actionLabel ?? (ko ? '이 맵 선택' : 'Select this map')}</button></div>
    </div>
  </section>
}
