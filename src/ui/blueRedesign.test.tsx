// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { engine } from './engine'
import { createDefaultGridWorldConfig } from '../core/environments/gridworld/GridWorldEnv'

beforeEach(() => {
  vi.useFakeTimers(); vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
  engine.reset({ envConfig: createDefaultGridWorldConfig(), algorithmId: 'q-learning' })
  engine.setSpeed({ mode: 'interval', intervalMs: 100000 })
})
afterEach(() => { cleanup(); engine.reset(); vi.useRealTimers(); vi.restoreAllMocks() })

// Everything the redesign deliberately removed from the home screen, in both languages.
const REMOVED = [
  'INTERACTIVE LEARNING LAB', '작은 움직임, 더 나은 선택.', '스스로 탐험하고, 보상으로 배우는 AI.', '눈앞에서 펼쳐지는 강화학습의 원리를 발견하세요.',
  '설치 없이, 브라우저에서 바로 실험하세요.', 'Q-Learning', 'SARSA', 'GridWorld', '탐험하고, 이해하고, 발견하세요.', 'BUILT FOR CURIOSITY',
  'Small steps. Better decisions.', 'Explore, receive rewards, and learn.', 'Your next experiment starts in your browser.', 'Explore. Understand. Discover.',
  'Workspace', '홈 화면 ↗', '실험실 바로가기', 'Explore the workspace',
]

describe('Home hero is reduced to the title, two actions and the live demos', () => {
  it.each([['ko', '강화학습 시뮬레이터'], ['en', 'Reinforcement learning simulator']])('has no removed copy in %s', (locale, title) => {
    render(<App />)
    if (locale === 'en') fireEvent.change(screen.getAllByTestId('language-selector')[0], { target: { value: 'en' } })
    const page = document.querySelector('.home-page')!
    // The demo card keeps its scripted-demo disclaimer (which names the algorithms on purpose); everything else must be clean.
    const outside = page.cloneNode(true) as HTMLElement
    outside.querySelector('.demo-card')!.remove()
    for (const gone of REMOVED) expect(outside.textContent, gone).not.toContain(gone)
    expect(outside.children).toHaveLength(1) // only the hero layout
    expect(document.body.textContent).not.toContain('RL Playground')
    // The decorative card label is gone in both languages, while the scripted-demo disclosure stays.
    expect(page.textContent).not.toContain('30 WORLDS')
    expect(page.querySelector('.demo-heading')!.textContent).toBe(locale === 'ko' ? '설명용 시연' : 'SCRIPTED DEMO')
    expect(document.querySelector('.home-eyebrow, .eyebrow-line, .hero-kicker, .hero-description, .hero-meta, .algorithm-tags, .home-footer, .home-feature-links, .status-dot, .heading-dot')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(title)
    const lines = [...page.querySelector('.hero-copy h2')!.childNodes].map(node => node.nodeName === 'BR' ? ' ' : node.textContent).join('')
    expect(lines).toBe(title)
  })
  it('keeps a two-line title whose second line is the blue span, plus both actions', () => {
    render(<App />)
    const heading = document.querySelector('.hero-copy h2')!
    expect(heading.querySelectorAll('br')).toHaveLength(1)
    expect(heading.querySelector('span')!.textContent).toBe('시뮬레이터')
    expect(document.querySelector('.hero-copy')!.children).toHaveLength(2) // title + actions, nothing else
    expect(screen.getByRole('button', { name: /학습 시작하기/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /알고리즘 알아보기/ })).toBeTruthy()
  })
  it('keeps four demo cards with names, difficulty and progress, and their controls', () => {
    render(<App />)
    const cards = [...document.querySelectorAll('.mini-demo')]
    expect(cards).toHaveLength(4)
    for (const card of cards) expect(card.querySelector('header strong')!.textContent).toBeTruthy()
    for (const card of cards) expect(card.querySelector('header span')!.textContent).toMatch(/\d+\/\d+|✓/)
    for (const name of ['일시정지', '맵 섞기', '한 칸 이동']) expect(screen.getByRole('button', { name })).toBeTruthy()
    const before = cards.map(card => card.getAttribute('data-scenario'))
    fireEvent.click(screen.getByRole('button', { name: '맵 섞기' }))
    const after = [...document.querySelectorAll('.mini-demo')].map(card => card.getAttribute('data-scenario'))
    expect(after).toHaveLength(4)
    expect(new Set(after).size).toBe(4)
    expect(after).not.toEqual(before)
    act(() => vi.advanceTimersByTime(650))
  })
  it('opens a demo preview and still offers to apply the map', () => {
    render(<App />)
    fireEvent.click(document.querySelector('.mini-demo .scenario-grid')!)
    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(within(dialog).getByRole('button', { name: /이 맵으로 실험하기/ })).toBeTruthy()
  })
  it('offers learn (primary), make a map (secondary) and algorithms (text) in that order, in both languages', () => {
    render(<App />)
    const actions = [...document.querySelectorAll('.hero-actions button')]
    expect(actions.map(b => b.className.split(' ')[0])).toEqual(['primary-button', 'secondary-button', 'text-button'])
    expect(actions.map(b => b.textContent)).toEqual(['학습 시작하기 ↗', '맵 만들기', '알고리즘 알아보기 →'])
    fireEvent.change(screen.getAllByTestId('language-selector')[0], { target: { value: 'en' } })
    expect([...document.querySelectorAll('.hero-actions button')].map(b => b.textContent)).toEqual(['Start learning ↗', 'Make a map', 'Explore algorithms →'])
  })
  it('opens the map editor from the Make a map button', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('home-make-map'))
    expect(screen.getByTestId('nav-editor').getAttribute('aria-current')).toBe('page')
    expect(screen.getByTestId('env-editor')).toBeTruthy()
    expect(document.querySelector('.home-page')).toBeNull()
  })
  it('navigates from the two hero actions', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /학습 시작하기/ }))
    expect(screen.getByTestId('nav-environment').getAttribute('aria-current')).toBe('page')
    fireEvent.click(screen.getByTestId('nav-home'))
    fireEvent.click(screen.getByRole('button', { name: /알고리즘 알아보기/ }))
    expect(screen.getByTestId('nav-guide').getAttribute('aria-current')).toBe('page')
  })
})

describe('Topbar and breadcrumb', () => {
  it('shows no breadcrumb on home but keeps the menu button, and keeps breadcrumbs elsewhere', () => {
    render(<App />)
    const header = document.querySelector('header.topbar')!
    expect(header.classList.contains('topbar-home')).toBe(true)
    expect(header.querySelector('#mobile-menu')).toBeTruthy()
    expect(header.textContent).not.toContain('Workspace')
    fireEvent.click(screen.getByTestId('nav-guide'))
    const other = document.querySelector('header.topbar')!
    expect(other.classList.contains('topbar-home')).toBe(false)
    expect(other.textContent).toContain('Workspace')
    expect(other.textContent).toContain('알고리즘 가이드')
  })
})
