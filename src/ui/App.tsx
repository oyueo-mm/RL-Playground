import { useEffect, useRef, useState } from 'react'
import Simulator from './Simulator'
import { Home } from './Home'
import { LanguageSelector } from '../viz/controls/LanguageSelector'
import { translations, type Locale } from './i18n'

type Page = 'home' | 'environment' | 'editor' | 'results' | 'guide'
const labels = {
  ko: { home: '홈 화면', environment: '학습 환경', editor: '맵 편집하기', results: '학습 결과 보기', guide: '알고리즘 가이드', menu: '메뉴 접기 / 펼치기', workspace: '나의 실험실', note: '작은 실험에서 시작하는 새로운 가능성', retained: '이동해도 현재 실험은 유지됩니다.', title: '강화학습 시뮬레이터' },
  en: { home: 'Overview', environment: 'Learning environment', editor: 'Map editor', results: 'Learning results', guide: 'Algorithm guide', menu: 'Collapse / expand menu', workspace: 'WORKSPACE', note: 'Small experiments. New possibilities.', retained: 'Your experiment stays active as you navigate.', title: 'Reinforcement learning simulator' },
}

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [locale, setLocale] = useState<Locale>('ko')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [section, setSection] = useState<'environment' | 'editor' | 'results'>('environment')
  const heading = useRef<HTMLHeadingElement>(null)
  const previousPage = useRef(page)
  const drawerWasOpen = useRef(false)
  const l = labels[locale]
  const navigate = (next: Page) => {
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
  return <div className={`app-shell ${experimentVisible ? 'lab-mode' : ''} ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
    <a href="#page-content" className="skip-link">{locale === 'ko' ? '본문으로 이동' : 'Skip to content'}</a>
    {mobileOpen && <button className="sidebar-backdrop" aria-label={locale === 'ko' ? '메뉴 닫기' : 'Close menu'} onClick={() => setMobileOpen(false)} />}
    <aside className="sidebar" id="sidebar">
      <div className="brand"><span className="brand-mark">r<span>l</span></span><span className="sidebar-label">RL Playground<small>LEARN BY EXPLORING</small></span></div>
      <button className="collapse-button" aria-label={l.menu} aria-controls="sidebar-navigation" aria-expanded={!collapsed} onClick={() => { if (window.innerWidth <= 760) setMobileOpen(false); else setCollapsed(!collapsed) }}><span aria-hidden="true" className="sidebar-toggle-icon">☰</span><span className="sidebar-label">{locale === 'ko' ? '사이드바' : 'Sidebar'}</span><span aria-hidden="true" className="sidebar-label sidebar-toggle-arrow">‹</span></button>
      <p className="nav-caption sidebar-label">{l.workspace}</p>
      <nav id="sidebar-navigation" aria-label={l.workspace}>{(['home', 'environment', 'editor', 'results', 'guide'] as Page[]).map((item, i) => <button key={item} title={l[item]} aria-label={l[item]} aria-current={page === item ? 'page' : undefined} onClick={() => navigate(item)} data-testid={`nav-${item}`}><span aria-hidden="true" className="nav-icon">{['⌂', '▦', '⊞', '▥', '≡'][i]}</span><span className="sidebar-label">{l[item]}</span>{page === item && <span className="nav-dot sidebar-label" />}</button>)}</nav>
      <div className="sidebar-bottom sidebar-label"><span className="tiny-orbit">✳</span><p>{l.note}</p><small>RL PLAYGROUND · OPEN SOURCE</small></div>
      <div className="sidebar-language"><LanguageSelector locale={locale} onChange={setLocale} t={translations[locale]} /></div>
    </aside>
    <div className="workspace" inert={mobileOpen}>
      <header className="topbar"><div className="breadcrumb"><button id="mobile-menu" aria-label={l.menu} aria-expanded={mobileOpen} aria-controls="sidebar" onClick={() => setMobileOpen(!mobileOpen)}>☰</button><span>Workspace</span><span>/</span><strong>{l[page]}</strong></div></header>
      <main id="page-content" className="page-content" tabIndex={-1}>
        <h1 ref={heading} tabIndex={-1} className="sr-only">{page === 'home' ? l.title : l[page]}</h1>
        {page === 'home' && <Home locale={locale} onStart={() => navigate('environment')} onGuide={() => navigate('guide')} />}
        {page === 'guide' && <Home locale={locale} guideOnly onStart={() => navigate('environment')} onGuide={() => navigate('guide')} />}
        <div hidden={!experimentVisible} className="experiment-workspace" data-testid="experiment-workspace"><Simulator locale={locale} section={section} active={experimentVisible} /></div>
      </main>
    </div>
    <div className="mobile-language"><LanguageSelector locale={locale} onChange={setLocale} t={translations[locale]} /></div>
  </div>
}
