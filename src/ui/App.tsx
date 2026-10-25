import { useEffect, useRef, useState } from 'react'
import Simulator from './Simulator'
import { Home } from './Home'
import { AlgorithmGuide } from './guide/AlgorithmGuide'
import { LanguageSelector } from '../viz/controls/LanguageSelector'
import { translations, type Locale } from './i18n'
import { engine } from './engine'
import { draftToGridWorldConfig } from '../viz/controls/envEditorDraft'

type Page = 'home' | 'environment' | 'editor' | 'results' | 'guide'
const labels = {
  ko: { home: '홈 화면', environment: '학습 환경', editor: '맵 편집하기', presets: '맵 프리셋', results: '학습 결과 보기', guide: '알고리즘 가이드', menu: '메뉴 접기 / 펼치기', workspace: '나의 실험실', title: '강화학습 시뮬레이터' },
  en: { home: 'Overview', environment: 'Learning environment', editor: 'Map editor', presets: 'Map presets', results: 'Learning results', guide: 'Algorithm guide', menu: 'Collapse / expand menu', workspace: 'WORKSPACE', title: 'Reinforcement learning simulator' },
}

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [locale, setLocale] = useState<Locale>('ko')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [homeAppliedVersion, setHomeAppliedVersion] = useState(0)
  const [section, setSection] = useState<'environment' | 'editor' | 'results'>('environment')
  const heading = useRef<HTMLHeadingElement>(null)
  const previousPage = useRef(page)
  const drawerWasOpen = useRef(false)
  const l = labels[locale]
  const navigate = (next: Page) => {
    setPresetsOpen(false)
    setPage(next)
    if (next === 'environment' || next === 'editor' || next === 'results') setSection(next)
    setMobileOpen(false)
  }
  useEffect(() => { document.documentElement.lang = locale }, [locale])
  useEffect(() => {
    if (previousPage.current !== page) heading.current?.focus({ preventScroll: true })
    previousPage.current = page
  }, [page])
  useEffect(() => {
    if (!mobileOpen) {
      if (drawerWasOpen.current) document.getElementById('mobile-menu')?.focus()
      drawerWasOpen.current = false
      return
    }
    drawerWasOpen.current = true
    document.querySelector<HTMLButtonElement>('.collapse-button')?.focus()
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [mobileOpen])
  const experimentVisible = page === 'environment' || page === 'editor' || page === 'results'
  return <div className={`app-shell ${experimentVisible ? 'lab-mode' : page === 'guide' ? 'guide-mode' : ''} ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
    <a href="#page-content" className="skip-link">{locale === 'ko' ? '본문으로 이동' : 'Skip to content'}</a>
    {mobileOpen && <button className="sidebar-backdrop" aria-label={locale === 'ko' ? '메뉴 닫기' : 'Close menu'} onClick={() => setMobileOpen(false)} />}
    <aside className="sidebar" id="sidebar">
      <button className="collapse-button" aria-label={l.menu} aria-controls="sidebar-navigation" aria-expanded={!collapsed} onClick={() => { if (window.innerWidth <= 760) setMobileOpen(false); else setCollapsed(!collapsed) }}><span aria-hidden="true" className="sidebar-toggle-icon">☰</span><span className="sidebar-label">{locale === 'ko' ? '사이드바' : 'Sidebar'}</span><span aria-hidden="true" className="sidebar-label sidebar-toggle-arrow">‹</span></button>
      <nav id="sidebar-navigation" aria-label={l.workspace}>{(['home', 'environment', 'editor', 'presets', 'results', 'guide'] as const).map((item, i) => <button key={item} title={l[item]} aria-label={l[item]} aria-current={item !== 'presets' && page === item ? 'page' : undefined} aria-expanded={item === 'presets' ? presetsOpen : undefined} aria-controls={item === 'presets' ? 'preset-panel' : undefined} onClick={() => {
        if (item !== 'presets') { navigate(item); return }
        setPresetsOpen(open => !open); setMobileOpen(false)
      }} data-testid={`nav-${item}`}><span aria-hidden="true" className="nav-icon">{['⌂', '▦', '⊞', '▧', '▥', '≡'][i]}</span><span className="sidebar-label">{l[item]}</span></button>)}</nav>
      <div className="sidebar-language"><LanguageSelector locale={locale} onChange={setLocale} t={translations[locale]} /></div>
    </aside>
    <div className="workspace" inert={mobileOpen}>
      <header className="topbar"><div className="breadcrumb"><button id="mobile-menu" aria-label={l.menu} aria-expanded={mobileOpen} aria-controls="sidebar" onClick={() => setMobileOpen(!mobileOpen)}>☰</button><span>Workspace</span><span>/</span><strong>{l[page]}</strong></div></header>
      <main id="page-content" className="page-content" tabIndex={-1}>
        <h1 ref={heading} tabIndex={-1} className="sr-only">{page === 'home' ? l.title : l[page]}</h1>
        {page === 'home' && <Home locale={locale} onEditor={() => navigate('editor')} onStart={() => navigate('environment')} onGuide={() => navigate('guide')} onExperiment={preset => { if (window.confirm(translations[locale].envEditor.applyConfirm)) { engine.reset({ envConfig: draftToGridWorldConfig(preset.draft) }); setHomeAppliedVersion(value => value + 1); navigate('environment') } }} />}
        {page === 'guide' && <AlgorithmGuide locale={locale} onStart={() => navigate('environment')} />}
        <div hidden={!experimentVisible && !presetsOpen} className="experiment-workspace" data-testid="experiment-workspace"><Simulator homeAppliedVersion={homeAppliedVersion} onEditPreset={() => navigate('editor')} onApplied={() => navigate('environment')} locale={locale} section={section} active={experimentVisible || presetsOpen} presetsOpen={presetsOpen} onClosePresets={() => setPresetsOpen(false)} /></div>
      </main>
    </div>
    <div className="mobile-language"><LanguageSelector locale={locale} onChange={setLocale} t={translations[locale]} /></div>
  </div>
}
