// @vitest-environment jsdom
import { cleanup, fireEvent, render as rtlRender, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultGridWorldConfig } from '../core/environments/gridworld/GridWorldEnv'
import App from './App'
import { engine } from './engine'

afterEach(cleanup)

// Phase 28 §9 changed App's own initial `locale` state from 'en' to 'ko' — every test in
// this file (bar the language-selector tests, which explicitly drive locale switches of
// their own and use `rtlRender` directly to observe the raw, un-forced default) was
// written assuming an English-by-default render, per the Phase 13 convention this file
// has followed since. Rather than rewrite scores of unrelated tests' text assertions to
// Korean, this thin wrapper renders <App/> and immediately switches it to English via the
// same real LanguageSelector UI a user would use — preserving each test's actual intent
// (Bomb/Statistics/Trajectory/etc., not language) while still exercising the real Korean
// default once, in the dedicated Phase 28 test below that uses `rtlRender` directly.
function render(ui: Parameters<typeof rtlRender>[0]) {
  const result = rtlRender(ui)
  const languageSelector = screen.queryByTestId('language-selector')
  if (languageSelector) {
    fireEvent.change(languageSelector, { target: { value: 'en' } })
  }
  return result
}

// Phase 34: a StateKey is now "x,y,mask" (Environment.getState()/Transition.state —
// GridWorldEnv.ts's file header), but GridSvg's own cell testids stay plain "x,y"
// (rendering-only, deliberately unaffected). Strips the mask segment back off wherever a
// test needs to look up the Grid cell a given State's position corresponds to.
function statePosition(state: string): string {
  const [x, y] = state.split(',')
  return `${x},${y}`
}

// `engine` is the app's single shared instance (src/ui/engine.ts) — reset it before
// each test so tests don't leak state into one another through it. reset() does not
// touch Scheduler speed (that's not simulation state), so it's restored explicitly too
// — otherwise a setSpeed() call in one test could linger into the next.
//
// Phase 7 note: reset() with NO envConfig override keeps whatever environment config is
// currently live (SimulationEngine.ts: `envConfig = overrides?.envConfig ?? this.environment.getConfig()`).
// Before Phase 7, no test's environment config outlived its own test body in a way that
// mattered, so a bare reset() here was enough. Phase 7 tests apply custom Grid
// size/Start/Goal/Wall configs via the Editor, which — being real engine.reset({envConfig})
// calls — DO persist across tests in this shared-singleton file unless explicitly
// restored. So this beforeEach now also pins envConfig back to the true default GridWorld
// config every time, to keep every test's starting point deterministic.
beforeEach(() => {
  // Phase 23: also pin algorithmId back to the default ('q-learning') every time — a
  // test that switches to 'sarsa' (via reset({algorithmId})) would otherwise leak that
  // choice into the next test through this same shared `engine` singleton.
  engine.reset({ envConfig: createDefaultGridWorldConfig(), algorithmId: 'q-learning' })
  engine.setSpeed({ mode: 'interval', intervalMs: 200 })
})

describe('App (integration, real Engine — Phase 4 §9.4)', () => {
  it('Grid State click -> selectedState changes -> QValueBars shows that State', () => {
    render(<App />)
    expect(screen.getByTestId('qvalue-bars-empty')).toBeTruthy()

    fireEvent.click(screen.getByTestId('cell-1,1'))

    expect(screen.queryByTestId('qvalue-bars-empty')).toBeNull()
    expect(screen.getByTestId('qvalue-bars').textContent).toContain('1,1')
  })

  it('selecting a different State updates QValueBars to that State', () => {
    render(<App />)

    fireEvent.click(screen.getByTestId('cell-1,1'))
    expect(screen.getByTestId('qvalue-bars').textContent).toContain('1,1')

    fireEvent.click(screen.getByTestId('cell-2,3'))
    expect(screen.getByTestId('qvalue-bars').textContent).toContain('2,3')
  })

  it('Step -> Engine snapshot changes -> Inspector reflects the new transition/action/TD info', () => {
    render(<App />)
    expect(screen.getByTestId('inspector-empty')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /step/i }))

    const snapshot = engine.getSnapshot()
    expect(snapshot.lastTransition).not.toBeNull()
    expect(snapshot.lastTdInfo).not.toBeNull()

    expect(screen.queryByTestId('inspector-empty')).toBeNull()
    expect(screen.getByTestId('inspector-panel')).toBeTruthy()
    expect(screen.getByTestId('inspector-target').textContent).toBe(snapshot.lastTdInfo!.target.toFixed(3))
    expect(screen.getByTestId('inspector-target-formula').textContent).toBe(snapshot.lastTdInfo!.targetFormula)
    expect(screen.getByTestId('inspector-state').textContent).toContain(snapshot.lastTransition!.nextState)
  })

  it('selected State stays selected across Steps, and its Q-values reflect the latest snapshot', () => {
    render(<App />)

    fireEvent.click(screen.getByTestId('cell-0,0')) // select the start cell (Start's own kind, still selectable)
    expect(screen.getByTestId('qvalue-bars').textContent).toContain('0,0')

    fireEvent.click(screen.getByRole('button', { name: /step/i }))
    fireEvent.click(screen.getByRole('button', { name: /step/i }))

    // Selection persists (still showing "0,0"), and whatever the engine now reports
    // for that state's Q-vector is what's rendered — read via the same public snapshot.
    const snapshot = engine.getSnapshot()
    expect(screen.getByTestId('qvalue-bars').textContent).toContain('0,0')
    if (snapshot.agentSnapshot.kind === 'Q') {
      // Phase 34: the real Q-table key is "x,y,mask" — the far-off default Goal (6,6) is
      // nowhere near (0,0) after only 2 steps, so mask is still "0".
      const qVector = snapshot.agentSnapshot.qTable['0,0,0'] ?? [0, 0, 0, 0]
      expect(screen.getByTestId('qvalue-up').textContent).toBe(qVector[0].toFixed(3))
    }
  })

  it('Reset returns Inspector to its empty state', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /step/i }))
    expect(screen.getByTestId('inspector-panel')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /reset/i }))

    expect(screen.getByTestId('inspector-empty')).toBeTruthy()
  })
})

describe('App (integration, real Engine — Phase 5 §15.5)', () => {
  it('Run -> snapshot status becomes running', () => {
    render(<App />)

    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(engine.getSnapshot().status).toBe('running')

    engine.pause() // don't leave a scheduled callback dangling past the test
  })

  it('Pause -> snapshot status becomes paused, Resume -> running again', () => {
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect(engine.getSnapshot().status).toBe('running')

    fireEvent.click(screen.getByTestId('playback-pause'))
    expect(engine.getSnapshot().status).toBe('paused')

    fireEvent.click(screen.getByTestId('playback-resume'))
    expect(engine.getSnapshot().status).toBe('running')

    engine.pause()
  })

  it('Run Episode completes the current episode and returns to idle automatically (no extra episode runs)', () => {
    // A tiny 2-cell grid + a large batch speed so the whole episode finishes inside the
    // single synchronous first batch — no fake timers needed for a deterministic check.
    engine.reset({
      envConfig: {
        width: 2,
        height: 1,
        start: { x: 0, y: 0 },
        goal: { x: 1, y: 0 },
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [],
        bombPenalty: -10,
      },
    })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })

    render(<App />)
    // Phase 46: episodeCount now defaults to 100 — set it to 1 explicitly so this test's
    // "exactly one episode" premise still holds.
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().episode).toBe(1)
  })

  it('selecting a visited State and enabling Policy/Value shows overlays for it', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('playback-step'))
    const visitedState = engine.getSnapshot().lastTransition!.state

    fireEvent.click(screen.getByTestId(`cell-${statePosition(visitedState)}`))
    fireEvent.click(screen.getByTestId('toggle-policy'))
    fireEvent.click(screen.getByTestId('toggle-value'))

    expect(screen.getByTestId('policy-overlay')).toBeTruthy()
    expect(screen.getByTestId('value-heatmap')).toBeTruthy()
    expect(screen.getByTestId(`policy-arrow-${visitedState}`)).toBeTruthy()
    expect(screen.getByTestId(`value-cell-${visitedState}`)).toBeTruthy()
  })

  it('Step -> Q-table changes -> Value overlay reflects the exact current max Q for that State', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('toggle-value'))

    fireEvent.click(screen.getByTestId('playback-step'))

    const snapshot = engine.getSnapshot()
    const state = snapshot.lastTransition!.state
    if (snapshot.agentSnapshot.kind === 'Q') {
      const expectedValue = Math.max(...(snapshot.agentSnapshot.qTable[state] ?? [0, 0, 0, 0]))
      expect(screen.getByTestId(`value-cell-${state}`).getAttribute('data-value')).toBe(String(expectedValue))
    }
  })

  it('Policy and Value overlays can both be shown at once without breaking Grid/Inspector/QValueBars', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('playback-step'))
    fireEvent.click(screen.getByTestId('cell-0,0'))
    fireEvent.click(screen.getByTestId('toggle-policy'))
    fireEvent.click(screen.getByTestId('toggle-value'))

    expect(screen.getByTestId('grid-svg')).toBeTruthy()
    expect(screen.getByTestId('agent-marker')).toBeTruthy()
    expect(screen.getByTestId('selected-cell-outline')).toBeTruthy()
    expect(screen.getByTestId('inspector-panel')).toBeTruthy()
    expect(screen.getByTestId('qvalue-bars')).toBeTruthy()
    expect(screen.getByTestId('policy-overlay')).toBeTruthy()
    expect(screen.getByTestId('value-heatmap')).toBeTruthy()
  })
})

describe('App (integration, real Engine — Phase 6 §9.3)', () => {
  it('shows initial Statistics (Episode 0, empty reward history) before any Step', () => {
    render(<App />)

    expect(screen.getByTestId('stats-episode').textContent).toBe('0')
    expect(screen.getByTestId('stats-episode-length').textContent).toBe('0')
    expect(screen.getByTestId('reward-chart-empty')).toBeTruthy()
  })

  it('Step -> Episode Length and Total Reward update to match the Engine snapshot', () => {
    render(<App />)

    fireEvent.click(screen.getByTestId('playback-step'))

    const snapshot = engine.getSnapshot()
    expect(screen.getByTestId('stats-episode-length').textContent).toBe(String(snapshot.stats.episodeLength))
    expect(screen.getByTestId('stats-total-reward').textContent).toBe(snapshot.stats.totalReward.toFixed(2))
  })

  it('Episode completion -> Episode/Success Rate/Reward History update, and the chart reflects it', () => {
    // Tiny grid + fast batch speed so a full episode completes inside one Run Episode click.
    engine.reset({
      envConfig: {
        width: 2,
        height: 1,
        start: { x: 0, y: 0 },
        goal: { x: 1, y: 0 },
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [],
        bombPenalty: -10,
      },
    })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })

    render(<App />)
    // Phase 46: episodeCount now defaults to 100 — set it to 1 explicitly so this test's
    // "one Run Episode click completes exactly one episode" premise still holds.
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    const snapshot = engine.getSnapshot()
    expect(snapshot.episode).toBe(1)
    expect(screen.getByTestId('stats-episode').textContent).toBe('1')
    expect(screen.getByTestId('stats-success-rate').textContent).toBe(
      `${(snapshot.stats.successRate * 100).toFixed(1)}%`,
    )
    expect(snapshot.stats.rewardHistory.length).toBe(1)
    expect(screen.queryByTestId('reward-chart-empty')).toBeNull()
    expect(screen.getByTestId('reward-chart-svg')).toBeTruthy()
  })

  it('Reset returns Statistics to their initial state (no stale values left over in the UI)', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('playback-step'))
    fireEvent.click(screen.getByTestId('playback-step'))
    expect(screen.getByTestId('stats-episode-length').textContent).not.toBe('0')

    fireEvent.click(screen.getByTestId('playback-reset'))

    expect(screen.getByTestId('stats-episode').textContent).toBe('0')
    expect(screen.getByTestId('stats-episode-length').textContent).toBe('0')
    expect(screen.getByTestId('stats-total-reward').textContent).toBe('0.00')
    expect(screen.getByTestId('stats-success-rate').textContent).toBe('0.0%')
    expect(screen.getByTestId('reward-chart-empty')).toBeTruthy()
  })

  it('Reward Chart tracks Engine reward history across multiple completed episodes', () => {
    engine.reset({
      envConfig: {
        width: 2,
        height: 1,
        start: { x: 0, y: 0 },
        goal: { x: 1, y: 0 },
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [],
        bombPenalty: -10,
      },
    })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 2000 })

    render(<App />)
    // Phase 12: Run now executes exactly one episode per click (terminal -> idle) rather
    // than auto-continuing, so multiple completed episodes are produced by clicking Run
    // several times — each click completes synchronously within the single first batch
    // (stepsPerFrame=2000 on a 2-cell grid), returning to idle before the next click.
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    const snapshot = engine.getSnapshot()
    expect(snapshot.stats.rewardHistory.length).toBeGreaterThan(1)

    const pathD = screen.getByTestId('reward-chart-path').getAttribute('d') ?? ''
    // one "L" per point after the first -> confirms the chart is actually drawing all
    // of rewardHistory, not just the latest value.
    expect((pathD.match(/L/g) ?? []).length).toBe(snapshot.stats.rewardHistory.length - 1)
  })
})

describe('App (integration, real Engine — Phase 7 §15)', () => {
  function openEditor() {
    fireEvent.click(screen.getByTestId('toggle-env-editor'))
  }
  function editorGrid() {
    return within(screen.getByTestId('env-editor-grid'))
  }
  function mainGrid() {
    return within(screen.getByTestId('grid-stack'))
  }

  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('1. Apply after adding a Wall reflects it in the live Grid', () => {
    render(<App />)
    openEditor()
    fireEvent.click(editorGrid().getByTestId('cell-3,3'))
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(mainGrid().getByTestId('cell-3,3').getAttribute('data-cell-kind')).toBe('wall')
  })

  it('2/5. Apply after moving Start reflects it live, and the Agent is placed at the new Start', () => {
    render(<App />)
    openEditor()
    fireEvent.click(screen.getByTestId('env-editor-mode-start'))
    fireEvent.click(editorGrid().getByTestId('cell-2,2'))
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(mainGrid().getByTestId('cell-2,2').getAttribute('data-cell-kind')).toBe('start')
    expect(engine.getSnapshot().currentState).toBe('2,2,0') // Phase 34: fresh Apply -> mask 0
    expect(mainGrid().getByTestId('agent-marker').getAttribute('cx')).toBe(String(2 * 48 + 24)) // CELL_SIZE=48 in App.tsx
  })

  it('3. Apply after moving Goal reflects it in the live Grid', () => {
    render(<App />)
    openEditor()
    fireEvent.click(screen.getByTestId('env-editor-mode-goal'))
    fireEvent.click(editorGrid().getByTestId('cell-5,5'))
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(mainGrid().getByTestId('cell-5,5').getAttribute('data-cell-kind')).toBe('goal')
  })

  it('4. Apply after changing Grid size resizes the live Grid', () => {
    render(<App />)
    openEditor()
    // Grow (not shrink) so the default Start(0,0)/Goal(6,6) stay in-bounds without also
    // having to move them in this test — shrinking below 7 would need a Goal move too,
    // which is already covered by the dedicated Goal-move test above.
    fireEvent.change(screen.getByTestId('env-editor-width-input'), { target: { value: '10' } })
    fireEvent.change(screen.getByTestId('env-editor-height-input'), { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(mainGrid().getAllByTestId(/^cell-/)).toHaveLength(100)
  })

  it('6/7/8. Apply resets Episode/Total Reward/Success Rate/Reward History/Q-table, and Inspector returns to empty', () => {
    render(<App />)
    // A large batch (rather than the "Very Fast" preset's 100/frame) so the episode is
    // virtually certain to finish within the single synchronous first batch, regardless
    // of how far epsilon=1 random exploration wanders on the default 7x7 grid.
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 5000 })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect(engine.getSnapshot().episode).toBeGreaterThan(0) // confirm learning actually happened first

    openEditor()
    fireEvent.click(editorGrid().getByTestId('cell-3,3'))
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    const snapshot = engine.getSnapshot()
    expect(snapshot.episode).toBe(0)
    expect(snapshot.stats.totalReward).toBe(0)
    expect(snapshot.stats.successRate).toBe(0)
    expect(snapshot.stats.rewardHistory).toEqual([])
    expect(snapshot.agentSnapshot.kind).toBe('Q')
    if (snapshot.agentSnapshot.kind === 'Q') {
      expect(Object.keys(snapshot.agentSnapshot.qTable).length).toBe(0)
    }
    expect(screen.getByTestId('inspector-empty')).toBeTruthy()
    expect(screen.getByTestId('stats-episode').textContent).toBe('0')
    expect(screen.getByTestId('reward-chart-empty')).toBeTruthy()
  })

  it('9. Editing the Draft (wall click, size change) does not affect the live Engine before Apply', () => {
    render(<App />)
    const before = engine.getSnapshot()

    openEditor()
    fireEvent.click(editorGrid().getByTestId('cell-3,3')) // draft-only wall
    fireEvent.change(screen.getByTestId('env-editor-width-input'), { target: { value: '9' } })

    expect(engine.getSnapshot().envRenderModel).toEqual(before.envRenderModel)
    expect(mainGrid().getByTestId('cell-3,3').getAttribute('data-cell-kind')).toBe('empty')
  })

  it('10. Validation failure blocks Apply and leaves the Engine unchanged', () => {
    render(<App />)
    const before = engine.getSnapshot()

    openEditor()
    fireEvent.click(screen.getByTestId('env-editor-mode-start'))
    fireEvent.click(editorGrid().getByTestId('cell-6,6')) // Start onto Goal's cell -> start === goal
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(engine.getSnapshot().envRenderModel).toEqual(before.envRenderModel)
  })

  it('11. Cancelling the Apply confirmation leaves the Engine unchanged', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<App />)
    const before = engine.getSnapshot()

    openEditor()
    fireEvent.click(editorGrid().getByTestId('cell-3,3'))
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(engine.getSnapshot().envRenderModel).toEqual(before.envRenderModel)
  })

  it('the existing Reset button still resets simulation state without changing the environment config', () => {
    render(<App />)
    const beforeRenderModel = engine.getSnapshot().envRenderModel
    fireEvent.click(screen.getByTestId('playback-step'))

    fireEvent.click(screen.getByTestId('playback-reset'))

    expect(engine.getSnapshot().envRenderModel).toEqual(beforeRenderModel)
    expect(engine.getSnapshot().episode).toBe(0)
  })

  // Phase 10 §5 boundary audit: selecting a State, then Applying an Environment where
  // that State no longer exists (grid shrunk), must not leave QValueBars showing a
  // stale selection for a cell that's no longer on the grid.
  it('Apply clears the State selection (avoids a stale QValueBars reading after resize)', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('cell-4,4'))
    expect(screen.getByTestId('qvalue-bars').textContent).toContain('4,4')

    openEditor()
    fireEvent.change(screen.getByTestId('env-editor-width-input'), { target: { value: '3' } })
    fireEvent.change(screen.getByTestId('env-editor-height-input'), { target: { value: '3' } })
    fireEvent.click(screen.getByTestId('env-editor-mode-goal'))
    fireEvent.click(editorGrid().getByTestId('cell-2,2')) // move Goal in-bounds for the 3x3 grid
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(screen.getByTestId('qvalue-bars-empty')).toBeTruthy()
    expect(screen.queryByTestId('qvalue-bars')).toBeNull()
  })
})

describe('App (integration, real Engine — Phase 13: language selector)', () => {
  function langSelect(): HTMLSelectElement {
    return screen.getByTestId('language-selector') as HTMLSelectElement
  }
  function selectKorean() {
    fireEvent.change(langSelect(), { target: { value: 'ko' } })
  }
  function selectEnglish() {
    fireEvent.change(langSelect(), { target: { value: 'en' } })
  }

  // Phase 28 §9 — the real, un-forced default changed from English to Korean. This is
  // the one test in this describe block that must observe App's raw initial render, so
  // it uses `rtlRender` directly rather than this file's English-forcing `render`
  // wrapper (see that wrapper's comment for why every other test here still uses it).
  it('Phase 28: defaults to Korean on first render (no language selector interaction)', () => {
    rtlRender(<App />)
    expect(langSelect().value).toBe('ko')
    expect(screen.getByTestId('playback-run-episode').textContent).toBe('학습하기')
    expect(screen.getByTestId('playback-step').textContent).toBe('스텝')
    expect(screen.getByTestId('stats-panel').textContent).toContain('통계')
  })

  it('switching to English from the real Korean default shows correct English text', () => {
    rtlRender(<App />)
    selectEnglish()
    expect(langSelect().value).toBe('en')
    expect(screen.getByTestId('playback-run-episode').textContent).toBe('Train')
    expect(screen.getByTestId('playback-step').textContent).toBe('Step')
    expect(screen.getByTestId('stats-panel').textContent).toContain('Statistics')
  })

  it('selecting 한국어 changes the major UI strings to Korean', () => {
    render(<App />)
    selectKorean()

    expect(langSelect().value).toBe('ko')
    expect(screen.getByTestId('playback-step').textContent).toBe('스텝')
    expect(screen.getByTestId('playback-run-episode').textContent).toBe('학습하기')
    expect(screen.getByTestId('playback-reset').textContent).toBe('초기화')
    expect(screen.getByTestId('stats-panel').textContent).toContain('통계')
    expect(screen.getByTestId('toggle-env-editor').textContent).toBe('환경 편집')
  })

  it('can be switched back to English from Korean', () => {
    render(<App />)
    selectKorean()
    expect(screen.getByTestId('playback-run-episode').textContent).toBe('학습하기')

    selectEnglish()
    expect(screen.getByTestId('playback-run-episode').textContent).toBe('Train')
    expect(screen.getByTestId('stats-panel').textContent).toContain('Statistics')
  })

  it('language change does not reset Engine state (Environment/Q-table/episode/stats untouched)', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('playback-step'))
    const before = engine.getSnapshot()

    selectKorean()

    const after = engine.getSnapshot()
    expect(after.currentState).toBe(before.currentState)
    expect(after.envRenderModel).toEqual(before.envRenderModel)
    expect(after.agentSnapshot).toEqual(before.agentSnapshot)
    expect(after.episode).toBe(before.episode)
    expect(after.stats).toEqual(before.stats)
  })

  it('Episode / Reward history / selected State are preserved across a language change', () => {
    engine.reset({
      envConfig: {
        width: 2,
        height: 1,
        start: { x: 0, y: 0 },
        goal: { x: 1, y: 0 },
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [],
        bombPenalty: -10,
      },
    })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })

    render(<App />)
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('cell-0,0'))
    expect(screen.getByTestId('qvalue-bars').textContent).toContain('0,0')

    const episodeBefore = engine.getSnapshot().episode
    const rewardHistoryBefore = engine.getSnapshot().stats.rewardHistory

    selectKorean()

    expect(engine.getSnapshot().episode).toBe(episodeBefore)
    expect(engine.getSnapshot().stats.rewardHistory).toEqual(rewardHistoryBefore)
    // Selection itself is UI state, untouched by the language change — still showing
    // the same State, just now via the translated "Q-값" heading instead of "Q-values".
    expect(screen.getByTestId('qvalue-bars').textContent).toContain('0,0')
    expect(screen.getByTestId('qvalue-bars').textContent).toContain('Q-값')
  })

  it('the Environment Editor stays open and displays correctly (including translated validation errors) when the language changes mid-edit', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('toggle-env-editor'))
    expect(screen.getByTestId('env-editor')).toBeTruthy()

    // Put the Draft into an invalid, in-progress state so the translated error message
    // and the un-applied Draft value are both observable across the language switch.
    fireEvent.change(screen.getByTestId('env-editor-width-input'), { target: { value: '1' } })
    expect(screen.getByTestId('env-editor-errors')).toBeTruthy()

    selectKorean()

    // Still open (not force-closed or remounted-and-reset) and still showing the same
    // in-progress, unapplied Draft value.
    expect(screen.getByTestId('env-editor')).toBeTruthy()
    expect((screen.getByTestId('env-editor-width-input') as HTMLInputElement).value).toBe('1')
    expect(screen.getByTestId('env-editor-errors').textContent).toContain('너비는')
    expect(screen.getByTestId('env-editor').textContent).toContain('환경 편집기')
    expect(screen.getByTestId('env-editor-apply').textContent).toBe('환경 적용')
  })
})

describe('App (integration, real Engine — Phase 15: Episode count)', () => {
  function countInput(): HTMLInputElement {
    return screen.getByTestId('episode-count-input') as HTMLInputElement
  }
  function setCount(value: string) {
    fireEvent.change(countInput(), { target: { value } })
  }
  const tinyTwoCellGrid = {
    width: 2,
    height: 1,
    start: { x: 0, y: 0 },
    goal: { x: 1, y: 0 },
    walls: [],
    stepReward: -0.1,
    goalReward: 10,
    terminalCells: [],
    bombs: [],
    bombPenalty: -10,
  }

  it('A. defaults to 100 (Phase 46)', () => {
    render(<App />)
    expect(countInput().value).toBe('100')
  })

  it('B. can be changed to 5; invalid values (0, negative, decimal) are rejected', () => {
    render(<App />)
    setCount('5')
    expect(countInput().value).toBe('5')

    setCount('0')
    expect(countInput().value).toBe('5') // unchanged — rejected
    setCount('-1')
    expect(countInput().value).toBe('5')
    setCount('2.5')
    expect(countInput().value).toBe('5')
  })

  it('D/G. Run Episode with count=3 completes exactly 3 episodes, then idle', () => {
    engine.reset({ envConfig: tinyTwoCellGrid })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    setCount('3')

    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().episode).toBe(3)
    // Reward history accumulates across all 3 (Statistics/Reward Chart, per §5).
    expect(engine.getSnapshot().stats.rewardHistory.length).toBe(3)
  })

  it('E. the Episode count input is disabled while RUNNING', () => {
    engine.setSpeed({ mode: 'interval', intervalMs: 500 })
    render(<App />)

    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(engine.getSnapshot().status).toBe('running')
    expect(countInput().disabled).toBe(true)

    engine.pause() // don't leave a scheduled callback dangling past the test
  })

  it('F. Pause mid multi-episode Run Episode preserves progress, and Resume continues the same episode (not a restart)', () => {
    // alpha=0 (no learning) + epsilon=0 (fully greedy) on an all-zero Q-table ties every
    // step to the same lowest-index action ("up"), which self-loops against the default
    // grid's top boundary — deterministic, and the episode never finishes on its own, so
    // Pause/Resume can be tested without any risk of the episode ending mid-check (same
    // technique as Phase 12's Core-level pause/resume test).
    engine.reset({ envConfig: createDefaultGridWorldConfig(), hyperparams: { alpha: 0, gamma: 0.9, epsilon: 0 } })
    engine.setSpeed({ mode: 'interval', intervalMs: 500 })
    render(<App />)
    setCount('3')

    fireEvent.click(screen.getByTestId('playback-run-episode'))
    // Scheduler.start() performs the first step synchronously (Phase 12).
    const afterFirstStep = engine.getSnapshot()
    expect(afterFirstStep.status).toBe('running')
    expect(afterFirstStep.stepInCurrentEpisode).toBe(1)
    expect(afterFirstStep.episode).toBe(0)

    fireEvent.click(screen.getByTestId('playback-pause'))
    const paused = engine.getSnapshot()
    expect(paused.status).toBe('paused')
    expect(paused.stepInCurrentEpisode).toBe(1)
    expect(paused.currentState).toBe(afterFirstStep.currentState)

    fireEvent.click(screen.getByTestId('playback-resume'))
    // resume() -> Scheduler.start() also performs the next step synchronously.
    const afterResume = engine.getSnapshot()
    expect(afterResume.status).toBe('running')
    expect(afterResume.stepInCurrentEpisode).toBe(2) // continued, not restarted back to 1
    expect(afterResume.episode).toBe(0) // still the same in-progress episode, none skipped

    engine.pause() // don't leave a scheduled callback dangling past the test
  })

  it('H. Reset mid Run Episode cancels the run and any remaining episodes', () => {
    engine.setSpeed({ mode: 'interval', intervalMs: 500 })
    render(<App />)
    setCount('5')

    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect(engine.getSnapshot().status).toBe('running')

    fireEvent.click(screen.getByTestId('playback-reset'))

    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().episode).toBe(0)

    // A fresh Run Episode afterward uses whatever count is currently entered, unaffected
    // by the cancelled run.
    setCount('2')
    engine.reset({ envConfig: tinyTwoCellGrid })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().episode).toBe(2)
  })

  it('I. the Episode count label is translated in English and Korean', () => {
    render(<App />)
    expect(screen.getByText('Episodes')).toBeTruthy()

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'ko' } })
    expect(screen.getByText('에피소드 수')).toBeTruthy()
    // The count value itself is untouched by a language change (Phase 46: default is 100).
    expect(countInput().value).toBe('100')
  })
})

describe('App (integration — Phase 16: layout stability, structural)', () => {
  // jsdom has no real CSS box model, so pixel-position stability itself can only be
  // proven in an actual browser (done for this Phase via Playwright — see the Phase 16
  // report's measured before/after coordinates). What CAN be guarded here, cheaply and
  // durably, is the specific CSS mechanism the fix depends on: if a future change
  // silently drops `w-full` from the two-column row or `flex-1`/`max-w-lg` from the
  // right column, the shrink-to-fit + `items-center` re-centering bug this Phase fixed
  // would silently come back. This test fails loudly if that happens.
  //
  // Phase 28 §2: the right column's cap moved from max-w-md (28rem) to max-w-lg (32rem)
  // as part of that Phase's layout-width improvement — the underlying stabilizing
  // mechanism (a fixed, viewport-driven cap, not shrink-to-fit) is what this test
  // actually guards, so only the specific class name needed updating.
  //
  // Phase 37: `md:flex-1` (shorthand for `flex: 1 1 0%`) was replaced with the explicit
  // longhand `md:grow md:shrink md:basis-auto` — real-browser measurement showed the
  // zero flex-basis made this column collapse to a literal 0px box under a genuine
  // space deficit (a large Grid on a narrow viewport), while its own children still
  // rendered at their natural size and stuck out past that 0px box, which is what
  // actually produced Phase 37's horizontal-overflow bug. `basis-auto` (content-based)
  // made it shrink proportionally alongside the Grid column instead of collapsing to
  // zero.
  //
  // Phase 42: `basis-auto` turned out to have its own defect — it measures this
  // column's preferred width from its children's actual content, which includes
  // InspectorPanel's `targetFormula` (an unrounded TD-target string whose length varies
  // every Step). At large-enough Grid sizes this made the Grid/right-column boundary
  // visibly oscillate on every Step (measured: 18.703125px at 15x15 @ 1440x900).
  // `md:basis-0` (content-independent, like Phase 37's original bug) fixes the
  // oscillation; `md:min-w-[260px]` (a fixed, equally content-independent floor)
  // prevents Phase 37's collapse-to-0 regression from coming back. This test's role is
  // unchanged: guard the specific classes this fix depends on.
  it('the two-column row and the right column carry the width-stabilizing classes the Phase 16/37/42 fixes depend on', () => {
    render(<App />)

    const twoColRow = screen.getByTestId('grid-stack').closest('.md\\:flex-row')
    expect(twoColRow).toBeTruthy()
    expect(twoColRow!.className).toContain('w-full')

    const rightColumn = screen.getByTestId('stats-panel').parentElement!
    expect(rightColumn.className).toContain('md:grow')
    expect(rightColumn.className).toContain('md:shrink')
    expect(rightColumn.className).toContain('md:basis-0')
    expect(rightColumn.className).toContain('md:min-w-[260px]')
    expect(rightColumn.className).toContain('md:max-w-lg')
  })
})

describe('App (integration — Phase 42: dynamic Inspector content does not affect flex sizing)', () => {
  // The actual bug (Phase 38 Audit → Phase 42 fix): InspectorPanel's targetFormula
  // string length varies every Step (unrounded floating-point noise — see
  // qLearning.ts/sarsa.ts, deliberately unchanged this Phase), and under the old
  // `md:basis-auto` right column, that length variance changed the column's own
  // computed preferred width, visibly shifting the Grid/right-column boundary on every
  // Step at large enough Grid sizes (measured 18.703125px @ 15x15/1440x900 — see the
  // Phase 42 report for full real-browser pixel evidence; jsdom has no CSS box model so
  // that pixel-level claim can only be proven there). What CAN be guarded here is the
  // structural claim the fix depends on: the right column's sizing classes are static
  // JSX literals, never derived from Inspector's own content, so a short vs. long
  // targetFormula can never change them.
  it('the right column keeps its content-independent sizing classes whether Inspector shows a short or long TD formula', () => {
    // A short, "nice" TD formula (no bootstrap yet).
    engine.reset({ envConfig: createDefaultGridWorldConfig(), hyperparams: { alpha: 0.37, gamma: 0.83, epsilon: 0 } })
    render(<App />)
    fireEvent.click(screen.getByTestId('playback-step'))
    const shortFormula = screen.getByTestId('inspector-target-formula').textContent ?? ''
    const rightColumnShort = screen.getByTestId('stats-panel').parentElement!
    const classNameShort = rightColumnShort.className

    // Continue stepping with irrational alpha/gamma until a real long (floating-point
    // noise) formula string naturally appears, exactly as a genuine Run would produce.
    let longFormula = shortFormula
    for (let i = 0; i < 20 && longFormula.length <= shortFormula.length; i++) {
      fireEvent.click(screen.getByTestId('playback-step'))
      longFormula = screen.getByTestId('inspector-target-formula').textContent ?? ''
    }
    expect(longFormula.length).toBeGreaterThan(shortFormula.length) // sanity: content genuinely changed

    const rightColumnLong = screen.getByTestId('stats-panel').parentElement!
    expect(rightColumnLong.className).toBe(classNameShort) // identical regardless of content length
    expect(rightColumnLong.className).toContain('md:basis-0')
    expect(rightColumnLong.className).toContain('md:min-w-[260px]')
  })
})

describe('App (integration — Phase 49: Step Viewer positioned near the Grid, not the right column)', () => {
  // Phase 49 §1: moved the Step Viewer from the bottom of the right column (Phase 46) to
  // directly under the Grid, in the LEFT column, so the user can watch the Grid and
  // scrub Steps without scrolling past Inspector/Statistics/charts. Purely a JSX
  // relocation — no Step Viewer behavior changed (see EpisodeStepViewer.test.tsx, fully
  // unmodified this Phase). jsdom has no real CSS box model, so the actual "pixels away
  // from the Grid" claim is verified via Playwright (see the Phase 49 report); what's
  // guarded here is the structural claim the visual result depends on: which column the
  // Step Viewer's DOM node lives in.
  it('the empty-state Step Viewer shares an ancestor with grid-stack, not with the right column (stats-panel)', () => {
    render(<App />)

    const gridColumn = screen.getByTestId('grid-stack').parentElement!
    const rightColumn = screen.getByTestId('stats-panel').parentElement!
    const stepViewerEmpty = screen.getByTestId('step-viewer-empty')

    expect(gridColumn.contains(stepViewerEmpty)).toBe(true)
    expect(rightColumn.contains(stepViewerEmpty)).toBe(false)
  })

  it('the populated Step Viewer (an Episode selected) also lives in the left/Grid column, not the right column', () => {
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))

    const gridColumn = screen.getByTestId('grid-stack').parentElement!
    const rightColumn = screen.getByTestId('stats-panel').parentElement!
    const stepViewer = screen.getByTestId('step-viewer')

    expect(gridColumn.contains(stepViewer)).toBe(true)
    expect(rightColumn.contains(stepViewer)).toBe(false)
  })

  it('the Step Viewer appears immediately after grid-stack in DOM order (directly under the Grid, before the overlay toggles)', () => {
    render(<App />)

    const gridColumn = screen.getByTestId('grid-stack').parentElement!
    const children = Array.from(gridColumn.children)
    const gridIndex = children.indexOf(screen.getByTestId('grid-stack'))
    const stepViewerWrapper = screen.getByTestId('step-viewer-empty').parentElement!
    const stepViewerIndex = children.indexOf(stepViewerWrapper)

    expect(stepViewerIndex).toBe(gridIndex + 1)
  })

  it('EpisodeStepViewer itself received no functional/behavioral changes this Phase (still controlled purely by App-owned step/onStepChange props)', () => {
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))

    const slider = screen.getByTestId('step-viewer-slider') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '0' } })
    expect(screen.getByTestId('step-viewer-position').textContent).toContain('0 /')
    fireEvent.click(screen.getByTestId('step-viewer-next'))
    expect(screen.getByTestId('step-viewer-position').textContent).toContain('1 /')
  })
})

describe('App (integration — Phase 37: responsive Grid, structural)', () => {
  // Same rationale as the Phase 16 suite above: jsdom has no real CSS box model, so the
  // actual "does 20x20 @ 768px overflow" question can only be answered by a real browser
  // (done via Playwright — see the Phase 37 report). What's guarded here is the specific
  // CSS mechanism the fix depends on, so a future change can't silently regress it.
  it('the grid column can shrink (no flex-none, min-w-0) — the mechanism that lets a large Grid fit a narrow viewport', () => {
    render(<App />)

    const gridColumn = screen.getByTestId('grid-stack').parentElement!
    expect(gridColumn.className).not.toContain('flex-none')
    expect(gridColumn.className).toContain('min-w-0')
  })

  it('grid-stack is capped at the Grid\'s natural full-size pixel width, but can shrink below it (w-full)', () => {
    engine.reset({ envConfig: createDefaultGridWorldConfig() })
    render(<App />)

    const gridStack = screen.getByTestId('grid-stack')
    expect(gridStack.className).toContain('w-full')
    const renderModel = engine.getSnapshot().envRenderModel
    const width = renderModel.kind === 'grid' ? renderModel.width : 0
    expect(gridStack.style.maxWidth).toBe(`${width * 48}px`)
  })

  it('the live GridSvg is CSS-responsive (block, w-full, h-auto) — the standard responsive-SVG technique paired with its unchanged viewBox', () => {
    render(<App />)

    const svg = screen.getByTestId('grid-svg')
    expect(svg.getAttribute('class')).toBe('block h-auto w-full')
    // viewBox must still exactly match the intrinsic pixel size for the aspect ratio
    // that CSS `height: auto` scales against to stay correct.
    const width = svg.getAttribute('width')
    const height = svg.getAttribute('height')
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${width} ${height}`)
  })

  it('a large (20x20) Grid renders with the same responsive mechanism as the default Grid (not a special-cased path)', () => {
    engine.reset({
      envConfig: {
        width: 20,
        height: 20,
        start: { x: 0, y: 0 },
        goal: { x: 19, y: 19 },
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [],
        bombPenalty: -10,
      },
    })
    render(<App />)

    const gridStack = screen.getByTestId('grid-stack')
    expect(gridStack.style.maxWidth).toBe('960px') // 20 * CELL_SIZE(48)
    const svg = screen.getByTestId('grid-svg')
    expect(svg.getAttribute('width')).toBe('960')
    expect(svg.getAttribute('height')).toBe('960')
  })

  // `absolute inset-0` alone only positions these overlay SVGs at the container's
  // top-left corner — it does NOT stretch a replaced element (an SVG with explicit
  // width/height attributes) to fill the container, verified via real-browser
  // measurement that Value/Policy overlays kept rendering at their own unshrunk
  // intrinsic size and spilled past the (now-responsive) Grid underneath them without
  // this. `h-auto w-full` makes them track whatever size grid-stack actually renders at.
  it('Value/Policy/Trajectory overlays carry the same responsive sizing classes as the live GridSvg', () => {
    engine.reset({ envConfig: createDefaultGridWorldConfig() })
    render(<App />)
    fireEvent.click(screen.getByTestId('toggle-policy'))
    fireEvent.click(screen.getByTestId('toggle-value'))

    expect(screen.getByTestId('value-heatmap').getAttribute('class')).toBe('absolute inset-0 h-auto w-full')
    expect(screen.getByTestId('policy-overlay').getAttribute('class')).toBe('absolute inset-0 h-auto w-full')
  })

  it('EnvEditor\'s Draft preview GridSvg is unaffected (no className, fixed cellSize=32, unrelated to the live Grid\'s responsive sizing)', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('toggle-env-editor'))

    const draftSvg = within(screen.getByTestId('env-editor-grid')).getByTestId('grid-svg')
    expect(draftSvg.getAttribute('class')).toBeNull()
    expect(draftSvg.getAttribute('width')).toBe(String(createDefaultGridWorldConfig().width * 32))
  })
})

describe('App (integration, real Engine — Phase 18: Epsilon control)', () => {
  function epsilonNumberInput(): HTMLInputElement {
    return screen.getByTestId('epsilon-number') as HTMLInputElement
  }

  it('shows the default epsilon (0.1, the Algorithm schema default, Phase 46) on first render', () => {
    render(<App />)
    expect(epsilonNumberInput().value).toBe('0.1')
    expect(engine.getSnapshot().hyperparams.epsilon).toBe(0.1)
  })

  it('changing epsilon in the UI calls through to the Engine and is reflected back in the snapshot', () => {
    render(<App />)
    fireEvent.change(epsilonNumberInput(), { target: { value: '0.25' } })
    expect(engine.getSnapshot().hyperparams.epsilon).toBe(0.25)
    expect(epsilonNumberInput().value).toBe('0.25')
  })

  it('a changed epsilon is actually used by the next action selection (epsilon=0 -> deterministic greedy Step)', () => {
    render(<App />)
    fireEvent.change(epsilonNumberInput(), { target: { value: '0' } })

    fireEvent.click(screen.getByTestId('playback-step'))

    expect(engine.getSnapshot().lastActionSelection!.wasExploration).toBe(false)
  })

  it('Reset restores epsilon to the Algorithm schema default, undoing a prior change', () => {
    render(<App />)
    fireEvent.change(epsilonNumberInput(), { target: { value: '0.05' } })
    expect(engine.getSnapshot().hyperparams.epsilon).toBe(0.05)

    fireEvent.click(screen.getByTestId('playback-reset'))

    expect(engine.getSnapshot().hyperparams.epsilon).toBe(0.1)
    expect(epsilonNumberInput().value).toBe('0.1')
  })

  it('epsilon can be changed while an Episode is in progress (RUNNING) without resetting Engine state', () => {
    engine.setSpeed({ mode: 'interval', intervalMs: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect(engine.getSnapshot().status).toBe('running')
    const episodeBefore = engine.getSnapshot().episode
    const qBefore = engine.getSnapshot().agentSnapshot

    fireEvent.change(epsilonNumberInput(), { target: { value: '0.6' } })

    expect(engine.getSnapshot().hyperparams.epsilon).toBe(0.6)
    expect(engine.getSnapshot().status).toBe('running') // unaffected — not reset
    expect(engine.getSnapshot().episode).toBe(episodeBefore)
    expect(engine.getSnapshot().agentSnapshot).toEqual(qBefore) // Q-table untouched

    engine.pause() // don't leave a scheduled callback dangling past the test
  })

  it('epsilon can also be changed while PAUSED', () => {
    engine.setSpeed({ mode: 'interval', intervalMs: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('playback-pause'))
    expect(engine.getSnapshot().status).toBe('paused')

    fireEvent.change(epsilonNumberInput(), { target: { value: '0.9' } })

    expect(engine.getSnapshot().hyperparams.epsilon).toBe(0.9)
    expect(engine.getSnapshot().status).toBe('paused')
  })

  it('the epsilon label and description are translated in English and Korean', () => {
    render(<App />)
    expect(screen.getByText(/Epsilon \(ε\)/)).toBeTruthy()

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'ko' } })
    expect(screen.getByText(/엡실론 \(ε\)/)).toBeTruthy()
  })
})

describe('App (integration, real Engine — Phase 19: Greedy Value / Reward Chart explanation)', () => {
  it('selecting a State shows its Greedy Action and Greedy Value, matching the actual Q-table', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('playback-step')) // learning happens somewhere

    const snapshot = engine.getSnapshot()
    const visitedState = snapshot.lastTransition!.state
    fireEvent.click(screen.getByTestId(`cell-${statePosition(visitedState)}`))

    expect(snapshot.agentSnapshot.kind).toBe('Q')
    const qVector =
      snapshot.agentSnapshot.kind === 'Q' ? (snapshot.agentSnapshot.qTable[visitedState] ?? [0, 0, 0, 0]) : [0, 0, 0, 0]
    const expectedGreedyValue = Math.max(...qVector)

    expect(screen.getByTestId('greedy-value').textContent).toBe(`Greedy Value: ${expectedGreedyValue.toFixed(4)}`)
    expect(screen.getByTestId('greedy-action')).toBeTruthy()
  })

  it('clicking a Wall cell does not select it — no Greedy Value is shown for a Wall', () => {
    engine.reset({
      envConfig: {
        width: 5,
        height: 5,
        start: { x: 0, y: 0 },
        goal: { x: 4, y: 4 },
        walls: [{ x: 2, y: 2 }],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [],
        bombPenalty: -10,
      },
    })
    render(<App />)

    expect(screen.getByTestId('cell-2,2').getAttribute('data-cell-kind')).toBe('wall')
    fireEvent.click(screen.getByTestId('cell-2,2'))

    // Selection never happened — still the empty state, not a Wall's (meaningless) Q-values.
    expect(screen.getByTestId('qvalue-bars-empty')).toBeTruthy()
    expect(screen.queryByTestId('qvalue-bars')).toBeNull()
    expect(screen.queryByTestId('selected-cell-outline')).toBeNull()
  })

  it('a normal (non-Wall) State click still selects normally alongside a Wall in the same Grid', () => {
    engine.reset({
      envConfig: {
        width: 5,
        height: 5,
        start: { x: 0, y: 0 },
        goal: { x: 4, y: 4 },
        walls: [{ x: 2, y: 2 }],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [],
        bombPenalty: -10,
      },
    })
    render(<App />)

    fireEvent.click(screen.getByTestId('cell-1,1'))

    expect(screen.getByTestId('qvalue-bars')).toBeTruthy()
    expect(screen.getByTestId('greedy-value')).toBeTruthy()
  })

  it('selecting a State for inspection does not change any Engine state (no reset/step/episode/reward/status change)', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('playback-step'))
    const before = engine.getSnapshot()

    fireEvent.click(screen.getByTestId('cell-3,3'))

    const after = engine.getSnapshot()
    expect(after.status).toBe(before.status)
    expect(after.episode).toBe(before.episode)
    expect(after.currentState).toBe(before.currentState)
    expect(after.stats).toEqual(before.stats)
    expect(after.agentSnapshot).toEqual(before.agentSnapshot)
    expect(after.envRenderModel).toEqual(before.envRenderModel)
  })

  it('selected State (and its Greedy Value) survives a language change', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('playback-step'))
    const visitedState = engine.getSnapshot().lastTransition!.state
    fireEvent.click(screen.getByTestId(`cell-${statePosition(visitedState)}`))
    const valueBefore = screen.getByTestId('greedy-value').textContent

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'ko' } })

    expect(screen.getByTestId('qvalue-bars')).toBeTruthy() // selection preserved
    expect(screen.getByTestId('greedy-value').textContent).toBe(valueBefore!.replace('Greedy Value', '탐욕적 가치'))
    expect(screen.getByTestId('greedy-action').textContent).toContain('탐욕적 행동')
  })

  it('the Reward Chart axis explanation is present and reflects Episode/Total Reward after a run', () => {
    engine.reset({
      envConfig: {
        width: 2,
        height: 1,
        start: { x: 0, y: 0 },
        goal: { x: 1, y: 0 },
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [],
        bombPenalty: -10,
      },
    })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)

    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(screen.getByTestId('reward-chart-x-axis').textContent).toBe('X: Episode')
    expect(screen.getByTestId('reward-chart-y-axis').textContent).toBe('Y: Total Reward')
  })
})

describe('App (integration, real Engine — Phase 20: Bomb)', () => {
  function openEditor() {
    fireEvent.click(screen.getByTestId('toggle-env-editor'))
  }
  function editorGrid() {
    return within(screen.getByTestId('env-editor-grid'))
  }
  function mainGrid() {
    return within(screen.getByTestId('grid-stack'))
  }

  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('placing a Bomb via the Editor and applying it reflects the Bomb in the live Grid', () => {
    render(<App />)
    openEditor()
    fireEvent.click(screen.getByTestId('env-editor-mode-bomb'))
    fireEvent.click(editorGrid().getByTestId('cell-3,3'))
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(mainGrid().getByTestId('cell-3,3').getAttribute('data-cell-kind')).toBe('bomb')
    expect(mainGrid().getByTestId('bomb-marker-3,3')).toBeTruthy()
  })

  it('a Bomb cell is selectable for inspection (unlike Wall) and shows a Greedy Value like any other State', () => {
    engine.reset({
      envConfig: {
        width: 5,
        height: 5,
        start: { x: 0, y: 0 },
        goal: { x: 4, y: 4 },
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [{ x: 2, y: 2 }],
        bombPenalty: -10,
      },
    })
    render(<App />)

    fireEvent.click(screen.getByTestId('cell-2,2'))

    expect(screen.getByTestId('qvalue-bars')).toBeTruthy()
    expect(screen.getByTestId('greedy-value')).toBeTruthy()
  })

  it('entering a Bomb via Run ends the Episode (RUNNING -> IDLE) with the penalty reward shown in Inspector', () => {
    engine.reset({
      envConfig: {
        width: 2,
        height: 1,
        start: { x: 0, y: 0 },
        goal: { x: 1, y: 1 }, // unreachable on this 2x1 grid — only the Bomb can end an episode
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [{ x: 1, y: 0 }],
        bombPenalty: -10,
      },
    })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)

    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().episode).toBe(1)
    expect(screen.getByTestId('inspector-reward').textContent).toBe('-10.000')
  })

  it('Environment Editor Bomb mode/penalty UI is translated in English and Korean', () => {
    render(<App />)
    openEditor()

    expect(screen.getByTestId('env-editor-mode-bomb').textContent).toBe('bomb')
    expect(screen.getByText('Bomb Penalty')).toBeTruthy()

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'ko' } })

    expect(screen.getByTestId('env-editor-mode-bomb').textContent).toBe('폭탄')
    expect(screen.getByText('폭탄 페널티')).toBeTruthy()
  })

  it('selecting a Bomb State for inspection does not change any Engine state', () => {
    engine.reset({
      envConfig: {
        width: 5,
        height: 5,
        start: { x: 0, y: 0 },
        goal: { x: 4, y: 4 },
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [{ x: 2, y: 2 }],
        bombPenalty: -10,
      },
    })
    render(<App />)
    fireEvent.click(screen.getByTestId('playback-step'))
    const before = engine.getSnapshot()

    fireEvent.click(screen.getByTestId('cell-2,2')) // the Bomb cell

    const after = engine.getSnapshot()
    expect(after.status).toBe(before.status)
    expect(after.episode).toBe(before.episode)
    expect(after.agentSnapshot).toEqual(before.agentSnapshot)
    expect(after.envRenderModel).toEqual(before.envRenderModel)
  })
})

describe('App (integration, real Engine — Phase 21: Episode Statistics)', () => {
  const tinyGridConfig = {
    width: 2,
    height: 1,
    start: { x: 0, y: 0 },
    goal: { x: 1, y: 0 },
    walls: [],
    stepReward: -0.1,
    goalReward: 10,
    terminalCells: [],
    bombs: [],
    bombPenalty: -10,
  }

  it('Latest Episode shows the "no Episode yet" empty state before any Episode completes', () => {
    render(<App />)
    expect(screen.getByTestId('latest-episode-empty')).toBeTruthy()
    expect(screen.queryByTestId('latest-episode')).toBeNull()
  })

  it('A. Run -> Episode completes -> Latest Episode reflects it', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)

    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(engine.getSnapshot().status).toBe('idle')
    expect(screen.getByTestId('latest-episode')).toBeTruthy()
    expect(screen.getByTestId('latest-episode-number').textContent).toBe('1')
    expect(screen.getByTestId('latest-episode-termination').textContent).toBe('Goal')
  })

  it('B. Run Episode = 3 -> 3 Episodes complete -> History has 3 rows', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '3' } })

    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(engine.getSnapshot().episode).toBe(3)
    expect(screen.getByTestId('episode-history-row-1')).toBeTruthy()
    expect(screen.getByTestId('episode-history-row-2')).toBeTruthy()
    expect(screen.getByTestId('episode-history-row-3')).toBeTruthy()
  })

  it('C. Pausing mid-Episode does not create a premature Episode History record; completing after Resume creates exactly one', () => {
    // width=1,height=4 corridor, alpha=0/epsilon=0 -> deterministic 3-step path to Goal
    // (same fixture reasoning as the Core-level Phase 21 tests) — lets this test pause
    // partway through a *known* multi-step Episode, then reliably drive it to completion.
    engine.reset({
      envConfig: {
        width: 1,
        height: 4,
        start: { x: 0, y: 3 },
        goal: { x: 0, y: 0 },
        walls: [],
        stepReward: -1,
        goalReward: 10,
        terminalCells: [],
        bombs: [],
        bombPenalty: -10,
      },
      hyperparams: { alpha: 0, gamma: 0.9, epsilon: 0 },
    })
    engine.setSpeed({ mode: 'interval', intervalMs: 500 })
    render(<App />)

    // Phase 46: episodeCount now defaults to 100 — set it to 1 explicitly so completing
    // the single Episode below actually returns to idle instead of continuing on.
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode')) // step 1 synchronously
    expect(engine.getSnapshot().status).toBe('running')
    fireEvent.click(screen.getByTestId('playback-pause'))

    expect(screen.getByTestId('latest-episode-empty')).toBeTruthy() // still none — Episode not done
    expect(screen.queryByTestId('episode-history')).toBeNull()

    // Switch to a batch speed before resuming — resume()'s own synchronous first batch
    // then finishes the remaining (known-deterministic) steps in one call, letting this
    // test verify completion without depending on real timers.
    fireEvent.click(screen.getByTestId('speed-very-fast'))
    fireEvent.click(screen.getByTestId('playback-resume'))

    expect(engine.getSnapshot().status).toBe('idle')
    expect(screen.getByTestId('latest-episode')).toBeTruthy()
    expect(screen.getByTestId('latest-episode-steps').textContent).toBe('3')
    const history = engine.getSnapshot().stats.episodeStatsHistory
    expect(history.length).toBe(1) // exactly one record — pausing never committed a partial one
  })

  it('D. a Bomb-ended Episode is recorded as Termination "Bomb" with the penalty reflected in Total Reward', () => {
    engine.reset({
      envConfig: {
        width: 2,
        height: 1,
        start: { x: 0, y: 0 },
        goal: { x: 1, y: 1 }, // unreachable on this 2x1 grid
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [{ x: 1, y: 0 }],
        bombPenalty: -10,
      },
    })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)

    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(engine.getSnapshot().status).toBe('idle')
    expect(screen.getByTestId('latest-episode-termination').textContent).toBe('Bomb')
    const ep = engine.getSnapshot().stats.latestEpisodeStats!
    expect(screen.getByTestId('latest-episode-total-reward').textContent).toBe(ep.totalReward.toFixed(2))
  })

  it('E. epsilon=0 -> a completed Episode is exploitation-only; epsilon=1 -> exploration-only', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)

    fireEvent.change(screen.getByTestId('epsilon-number'), { target: { value: '1' } })
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect(screen.getByTestId('latest-episode-exploration').textContent).not.toBe('0')
    expect(screen.getByTestId('latest-episode-exploitation').textContent).toBe('0')

    engine.reset({ envConfig: tinyGridConfig, hyperparams: { alpha: 0.1, gamma: 0.9, epsilon: 0 } })
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect(screen.getByTestId('latest-episode-exploration').textContent).toBe('0')
    expect(screen.getByTestId('latest-episode-exploitation').textContent).not.toBe('0')
  })

  it('F. Episode Statistics UI translates to Korean and back to English', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(screen.getByText('Latest Episode')).toBeTruthy()
    expect(screen.getByTestId('latest-episode-termination').textContent).toBe('Goal')

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'ko' } })
    expect(screen.getByText('최근 Episode')).toBeTruthy()
    expect(screen.getByText('Episode 기록')).toBeTruthy()

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'en' } })
    expect(screen.getByText('Latest Episode')).toBeTruthy()
  })

  it('Reset clears Latest Episode / Episode History, matching the existing Reward Chart reset policy', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect(screen.getByTestId('latest-episode')).toBeTruthy()

    fireEvent.click(screen.getByTestId('playback-reset'))

    expect(screen.getByTestId('latest-episode-empty')).toBeTruthy()
    expect(screen.getByTestId('episode-history-empty')).toBeTruthy()
    expect(screen.getByTestId('reward-chart-empty')).toBeTruthy() // existing Reward Chart still resets the same way
  })

  it('the existing Reward Chart still works normally alongside Episode Statistics', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '3' } })

    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(screen.getByTestId('reward-chart-svg')).toBeTruthy()
    expect(engine.getSnapshot().stats.rewardHistory.length).toBe(3)
  })
})

describe('App (integration, real Engine — Phase 22: Alpha/Gamma controls)', () => {
  function alphaNumberInput(): HTMLInputElement {
    return screen.getByTestId('alpha-number') as HTMLInputElement
  }
  function gammaNumberInput(): HTMLInputElement {
    return screen.getByTestId('gamma-number') as HTMLInputElement
  }

  it('shows the default alpha (0.1) and gamma (0.9) — the Algorithm schema defaults — on first render', () => {
    render(<App />)
    expect(alphaNumberInput().value).toBe('0.1')
    expect(gammaNumberInput().value).toBe('0.9')
    expect(engine.getSnapshot().hyperparams).toEqual({ alpha: 0.1, gamma: 0.9, epsilon: 0.1 })
  })

  it('changing alpha in the UI calls through to the Engine and is reflected back in the snapshot', () => {
    render(<App />)
    fireEvent.change(alphaNumberInput(), { target: { value: '0.55' } })
    expect(engine.getSnapshot().hyperparams.alpha).toBe(0.55)
    expect(alphaNumberInput().value).toBe('0.55')
  })

  it('changing gamma in the UI calls through to the Engine and is reflected back in the snapshot', () => {
    render(<App />)
    fireEvent.change(gammaNumberInput(), { target: { value: '0.25' } })
    expect(engine.getSnapshot().hyperparams.gamma).toBe(0.25)
    expect(gammaNumberInput().value).toBe('0.25')
  })

  it('Reset restores alpha and gamma to the Algorithm schema defaults, undoing prior changes', () => {
    render(<App />)
    fireEvent.change(alphaNumberInput(), { target: { value: '0.9' } })
    fireEvent.change(gammaNumberInput(), { target: { value: '0.1' } })
    expect(engine.getSnapshot().hyperparams).toEqual({ alpha: 0.9, gamma: 0.1, epsilon: 0.1 })

    fireEvent.click(screen.getByTestId('playback-reset'))

    expect(engine.getSnapshot().hyperparams).toEqual({ alpha: 0.1, gamma: 0.9, epsilon: 0.1 })
    expect(alphaNumberInput().value).toBe('0.1')
    expect(gammaNumberInput().value).toBe('0.9')
  })

  it('alpha/gamma can be changed while RUNNING (Pause -> change -> Resume) without resetting Engine state', () => {
    engine.setSpeed({ mode: 'interval', intervalMs: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('playback-pause'))
    expect(engine.getSnapshot().status).toBe('paused')
    const episodeBefore = engine.getSnapshot().episode
    const qBefore = engine.getSnapshot().agentSnapshot

    fireEvent.change(alphaNumberInput(), { target: { value: '0.7' } })
    fireEvent.change(gammaNumberInput(), { target: { value: '0.3' } })

    expect(engine.getSnapshot().hyperparams.alpha).toBe(0.7)
    expect(engine.getSnapshot().hyperparams.gamma).toBe(0.3)
    expect(engine.getSnapshot().status).toBe('paused') // unaffected — not reset
    expect(engine.getSnapshot().episode).toBe(episodeBefore)
    expect(engine.getSnapshot().agentSnapshot).toEqual(qBefore) // Q-table untouched

    fireEvent.click(screen.getByTestId('playback-resume'))
    expect(engine.getSnapshot().status).toBe('running')

    engine.pause() // don't leave a scheduled callback dangling past the test
  })

  it('alpha/gamma controls are translated in English and Korean', () => {
    render(<App />)
    expect(screen.getByText(/Alpha \(α\)/)).toBeTruthy()
    expect(screen.getByText(/Gamma \(γ\)/)).toBeTruthy()

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'ko' } })
    expect(screen.getByText(/알파 \(α\)/)).toBeTruthy()
    expect(screen.getByText(/감마 \(γ\)/)).toBeTruthy()

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'en' } })
    expect(screen.getByText(/Alpha \(α\)/)).toBeTruthy()
  })

  it('existing epsilon control still works normally alongside the new alpha/gamma controls (no regression)', () => {
    render(<App />)
    fireEvent.change(screen.getByTestId('epsilon-number'), { target: { value: '0.4' } })
    expect(engine.getSnapshot().hyperparams.epsilon).toBe(0.4)
    // Changing epsilon must not disturb alpha/gamma.
    expect(engine.getSnapshot().hyperparams.alpha).toBe(0.1)
    expect(engine.getSnapshot().hyperparams.gamma).toBe(0.9)
  })

  it('the two-column layout / PlaybackControls structure is unaffected by the new controls (Phase 14/16 stabilizing classes still present)', () => {
    render(<App />)
    const twoColRow = screen.getByTestId('grid-stack').closest('.md\\:flex-row')
    expect(twoColRow).toBeTruthy()
    expect(twoColRow!.className).toContain('w-full')
    expect(screen.getByTestId('playback-pause-resume-slot')).toBeTruthy()
  })
})

describe('App (integration, real Engine — Phase 23: Algorithm selection)', () => {
  function algorithmSelect(): HTMLSelectElement {
    return screen.getByTestId('algorithm-select') as HTMLSelectElement
  }

  it('defaults to Q-Learning on first render, selector enabled (IDLE)', () => {
    render(<App />)
    expect(algorithmSelect().value).toBe('q-learning')
    expect(algorithmSelect().disabled).toBe(false)
    expect(engine.getSnapshot().algorithmId).toBe('q-learning')
  })

  it('IDLE: selecting SARSA switches the Engine algorithm and starts a fresh experiment', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('playback-step')) // build up some state first
    expect(engine.getSnapshot().stats.rewardHistory.length + engine.getSnapshot().episode >= 0).toBe(true)

    fireEvent.change(algorithmSelect(), { target: { value: 'sarsa' } })

    expect(algorithmSelect().value).toBe('sarsa')
    expect(engine.getSnapshot().algorithmId).toBe('sarsa')
    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().episode).toBe(0)
    expect(engine.getSnapshot().stats.rewardHistory).toEqual([])
    expect(engine.getSnapshot().stats.episodeStatsHistory).toEqual([])
    const agentSnapshot = engine.getSnapshot().agentSnapshot
    if (agentSnapshot.kind === 'Q') {
      expect(Object.keys(agentSnapshot.qTable).length).toBe(0)
    }
  })

  it('IDLE: selecting Q-Learning after SARSA switches back cleanly', () => {
    render(<App />)
    fireEvent.change(algorithmSelect(), { target: { value: 'sarsa' } })
    expect(engine.getSnapshot().algorithmId).toBe('sarsa')

    fireEvent.change(algorithmSelect(), { target: { value: 'q-learning' } })

    expect(algorithmSelect().value).toBe('q-learning')
    expect(engine.getSnapshot().algorithmId).toBe('q-learning')
    expect(engine.getSnapshot().episode).toBe(0)
  })

  it('RUNNING: selector is disabled and cannot be changed', () => {
    engine.setSpeed({ mode: 'interval', intervalMs: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect(engine.getSnapshot().status).toBe('running')

    expect(algorithmSelect().disabled).toBe(true)
    expect(engine.getSnapshot().algorithmId).toBe('q-learning')

    engine.pause() // don't leave a scheduled callback dangling past the test
  })

  it('PAUSED: selector remains disabled; Resume restores normal Run behavior', () => {
    engine.setSpeed({ mode: 'interval', intervalMs: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('playback-pause'))
    expect(engine.getSnapshot().status).toBe('paused')

    expect(algorithmSelect().disabled).toBe(true)

    fireEvent.click(screen.getByTestId('playback-resume'))
    expect(engine.getSnapshot().status).toBe('running')
    expect(algorithmSelect().disabled).toBe(true)

    engine.pause()
  })

  it('switching algorithm mid-experience resets Episode Statistics and Reward Chart, then new episodes start fresh under the new algorithm', () => {
    // A tiny 2-cell grid (same fixture technique as the episode-count tests above), not
    // the default 7x7 grid — epsilon=1 full random exploration on a 7x7 grid is not
    // reliably guaranteed to finish 1 episode within a single synchronous batch.
    engine.reset({
      envConfig: {
        width: 2,
        height: 1,
        start: { x: 0, y: 0 },
        goal: { x: 1, y: 0 },
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [],
        bombPenalty: -10,
      },
    })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    // Phase 46: episodeCount now defaults to 100 — set it to 1 explicitly.
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode')) // Q-Learning: run 1 episode
    expect(engine.getSnapshot().episode).toBe(1)
    expect(engine.getSnapshot().stats.episodeStatsHistory.length).toBe(1)

    fireEvent.change(algorithmSelect(), { target: { value: 'sarsa' } })
    expect(engine.getSnapshot().stats.episodeStatsHistory).toEqual([])

    fireEvent.click(screen.getByTestId('playback-run-episode')) // SARSA: run 1 episode
    expect(engine.getSnapshot().algorithmId).toBe('sarsa')
    expect(engine.getSnapshot().episode).toBe(1) // starts fresh at 1, not continuing old numbering
    expect(engine.getSnapshot().stats.episodeStatsHistory.length).toBe(1)
  })

  // A tiny 2-cell grid (same fixture technique as Phase 15's episode-count tests), not
  // the default 7x7 grid — with epsilon=1 full random exploration, a 7x7 grid's episode
  // length is unbounded, so 3 episodes are not reliably guaranteed to finish within a
  // single synchronous batch. The 2-cell grid always finishes an episode in 1 step.
  const tinyTwoCellGrid = {
    width: 2,
    height: 1,
    start: { x: 0, y: 0 },
    goal: { x: 1, y: 0 },
    walls: [],
    stepReward: -0.1,
    goalReward: 10,
    terminalCells: [],
    bombs: [],
    bombPenalty: -10,
  }

  it('Q-Learning: Run Episode with a custom episode count runs exactly that many episodes', () => {
    engine.reset({ envConfig: tinyTwoCellGrid })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '3' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect(engine.getSnapshot().episode).toBe(3)
  })

  it('SARSA: Run Episode with a custom episode count runs exactly that many episodes', () => {
    engine.reset({ envConfig: tinyTwoCellGrid })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(algorithmSelect(), { target: { value: 'sarsa' } })
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '3' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect(engine.getSnapshot().algorithmId).toBe('sarsa')
    expect(engine.getSnapshot().episode).toBe(3)
  })

  it('hyperparameters set under Q-Learning do not leak into SARSA — switching shows SARSA\'s own defaults', () => {
    render(<App />)
    fireEvent.change(screen.getByTestId('alpha-number'), { target: { value: '0.77' } })
    fireEvent.change(screen.getByTestId('gamma-number'), { target: { value: '0.33' } })
    fireEvent.change(screen.getByTestId('epsilon-number'), { target: { value: '0.55' } })

    fireEvent.change(algorithmSelect(), { target: { value: 'sarsa' } })

    expect(engine.getSnapshot().hyperparams).toEqual({ alpha: 0.1, gamma: 0.9, epsilon: 0.1 })
    expect((screen.getByTestId('alpha-number') as HTMLInputElement).value).toBe('0.1')
    expect((screen.getByTestId('gamma-number') as HTMLInputElement).value).toBe('0.9')
    expect((screen.getByTestId('epsilon-number') as HTMLInputElement).value).toBe('0.1')
  })

  it('Bomb termination still works after switching from Q-Learning to SARSA on the same Environment', () => {
    engine.reset({
      envConfig: {
        width: 2,
        height: 1,
        start: { x: 0, y: 0 },
        goal: { x: 1, y: 1 }, // unreachable — only the Bomb can end an episode
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [{ x: 1, y: 0 }],
        bombPenalty: -10,
      },
    })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)

    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect(engine.getSnapshot().status).toBe('idle')
    expect(screen.getByTestId('inspector-reward').textContent).toBe('-10.000')

    fireEvent.change(algorithmSelect(), { target: { value: 'sarsa' } })
    // Bomb config must survive the algorithm-only reset.
    expect(screen.getByTestId('grid-stack').querySelector('[data-testid="bomb-marker-1,0"]')).toBeTruthy()

    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect(engine.getSnapshot().algorithmId).toBe('sarsa')
    expect(engine.getSnapshot().status).toBe('idle')
    expect(screen.getByTestId('inspector-reward').textContent).toBe('-10.000')
  })

  it('Environment Editor still applies correctly after switching algorithm (Apply keeps the new Environment)', () => {
    render(<App />)
    fireEvent.change(algorithmSelect(), { target: { value: 'sarsa' } })

    fireEvent.click(screen.getByTestId('toggle-env-editor'))
    fireEvent.click(screen.getByTestId('env-editor-mode-wall'))
    fireEvent.click(within(screen.getByTestId('env-editor-grid')).getByTestId('cell-3,3'))
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(within(screen.getByTestId('grid-stack')).getByTestId('cell-3,3').getAttribute('data-cell-kind')).toBe(
      'wall',
    )
    expect(engine.getSnapshot().algorithmId).toBe('sarsa') // Applying env config doesn't change algorithm
  })

  it('Algorithm label/description are translated in English and Korean, and "Q-Learning"/"SARSA" stay untranslated', () => {
    render(<App />)
    expect(screen.getByText('Algorithm')).toBeTruthy()
    expect(screen.getByTestId('algorithm-description').textContent).toBe(
      'Off-policy — learns from the best possible next action',
    )

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'ko' } })
    expect(screen.getByText('알고리즘')).toBeTruthy()
    expect(screen.getByTestId('algorithm-description').textContent).toBe(
      '오프-정책 — 다음에 가능한 최선의 Action을 기준으로 학습',
    )
    expect(algorithmSelect().value).toBe('q-learning')

    fireEvent.change(algorithmSelect(), { target: { value: 'sarsa' } })
    expect(screen.getByTestId('algorithm-description').textContent).toBe(
      '온-정책 — 실제로 선택한 다음 Action을 기준으로 학습',
    )

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'en' } })
    expect(screen.getByText('Algorithm')).toBeTruthy()
  })

  it('the two-column layout / PlaybackControls structure is unaffected by the new AlgorithmSelector row (Phase 14/16 stabilizing classes still present)', () => {
    render(<App />)
    const twoColRow = screen.getByTestId('grid-stack').closest('.md\\:flex-row')
    expect(twoColRow).toBeTruthy()
    expect(twoColRow!.className).toContain('w-full')
    expect(screen.getByTestId('playback-pause-resume-slot')).toBeTruthy()
    expect(screen.getByTestId('algorithm-selector')).toBeTruthy()
  })
})

describe('App (integration, real Engine — Phase 24: Episode Detail / Reward Chart selection)', () => {
  const tinyGridConfig = {
    width: 2,
    height: 1,
    start: { x: 0, y: 0 },
    goal: { x: 1, y: 0 },
    walls: [],
    stepReward: -0.1,
    goalReward: 10,
    terminalCells: [],
    bombs: [],
    bombPenalty: -10,
  }

  it('A. Single Episode: run -> select its History row -> Episode Detail shows it, matching Reward Chart', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)

    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect(screen.getByTestId('episode-detail-empty')).toBeTruthy() // nothing selected yet

    fireEvent.click(screen.getByTestId('episode-history-row-1'))

    const detail = within(screen.getByTestId('episode-detail'))
    expect(detail.getByTestId('episode-detail-number').textContent).toBe('1')
    expect(detail.getByTestId('episode-detail-termination').textContent).toBe('Goal')
    expect(detail.getByTestId('episode-detail-exploration-rate')).toBeTruthy()
    expect(detail.getByTestId('episode-detail-exploitation-rate')).toBeTruthy()
    expect(screen.getByTestId('reward-chart-selected-point')).toBeTruthy()
    expect(screen.getByTestId('reward-chart-selected-label').textContent).toBe('Selected Episode: 1')
  })

  it('B. Multiple Episodes: Run Episode = 3 -> selecting each row updates Detail independently', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '3' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    fireEvent.click(screen.getByTestId('episode-history-row-2'))
    expect(within(screen.getByTestId('episode-detail')).getByTestId('episode-detail-number').textContent).toBe('2')
    expect(screen.getByTestId('episode-history-row-2').getAttribute('data-selected')).toBe('true')

    fireEvent.click(screen.getByTestId('episode-history-row-3'))
    expect(within(screen.getByTestId('episode-detail')).getByTestId('episode-detail-number').textContent).toBe('3')
    expect(screen.getByTestId('episode-history-row-2').getAttribute('data-selected')).toBeNull()
  })

  it('C. Bomb: selecting a Bomb-ended Episode shows Termination = Bomb with the penalty reflected in Total Reward', () => {
    engine.reset({
      envConfig: {
        width: 2,
        height: 1,
        start: { x: 0, y: 0 },
        goal: { x: 1, y: 1 }, // unreachable — only the Bomb can end an episode
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [{ x: 1, y: 0 }],
        bombPenalty: -10,
      },
    })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)

    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))

    const detail = within(screen.getByTestId('episode-detail'))
    expect(detail.getByTestId('episode-detail-termination').textContent).toBe('Bomb')
    const ep = engine.getSnapshot().stats.latestEpisodeStats!
    expect(detail.getByTestId('episode-detail-total-reward').textContent).toBe(ep.totalReward.toFixed(2))
  })

  it('D. Reset clears both the History selection and the Episode Detail/highlight', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))
    expect(screen.getByTestId('episode-detail')).toBeTruthy()

    fireEvent.click(screen.getByTestId('playback-reset'))

    expect(screen.getByTestId('episode-detail-empty')).toBeTruthy()
    expect(screen.getByTestId('episode-history-empty')).toBeTruthy()
  })

  it("D2. a stale selection does not resurrect after Reset even if a new Episode reuses the same number", () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode')) // Episode 1
    fireEvent.click(screen.getByTestId('episode-history-row-1'))
    expect(screen.getByTestId('episode-detail')).toBeTruthy()

    fireEvent.click(screen.getByTestId('playback-reset'))
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode')) // a new Episode 1, post-reset

    expect(screen.getByTestId('episode-detail-empty')).toBeTruthy() // not auto-selected
  })

  it('E. i18n: Episode Detail heading/empty-state and the selected label translate English -> Korean -> English', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))
    expect(screen.getByText('Episode Detail')).toBeTruthy()
    expect(screen.getByTestId('reward-chart-selected-label').textContent).toBe('Selected Episode: 1')

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'ko' } })
    expect(screen.getByText('Episode 상세')).toBeTruthy()
    expect(screen.getByTestId('reward-chart-selected-label').textContent).toBe('선택된 Episode: 1')

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'en' } })
    expect(screen.getByText('Episode Detail')).toBeTruthy()
  })

  it('Algorithm switch (Phase 23) also clears the Episode Detail selection, consistent with its full-experiment reset', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))
    expect(screen.getByTestId('episode-detail')).toBeTruthy()

    fireEvent.change(screen.getByTestId('algorithm-select'), { target: { value: 'sarsa' } })

    expect(screen.getByTestId('episode-detail-empty')).toBeTruthy()
  })

  it('Environment Editor Apply (Phase 7/10) also clears the Episode Detail selection, consistent with its full reset', () => {
    // Default 7x7 grid, not tinyGridConfig — envEditorDraft.ts's MIN_SIZE is 3, so a
    // width=2/height=1 grid can never pass validation, which would leave Apply disabled
    // and make this test a false negative unrelated to what it's actually checking.
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 5000 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))
    expect(screen.getByTestId('episode-detail')).toBeTruthy()

    fireEvent.click(screen.getByTestId('toggle-env-editor'))
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(screen.getByTestId('episode-detail-empty')).toBeTruthy()
  })

  it('a History row is keyboard-selectable end-to-end (Enter)', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    fireEvent.keyDown(screen.getByTestId('episode-history-row-1'), { key: 'Enter' })

    expect(screen.getByTestId('episode-detail')).toBeTruthy()
  })

  it('F. Responsive: Episode Detail / History / Reward Chart render without layout regression (Phase 14/16 structure intact)', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))

    const twoColRow = screen.getByTestId('grid-stack').closest('.md\\:flex-row')
    expect(twoColRow).toBeTruthy()
    expect(twoColRow!.className).toContain('w-full')
    expect(screen.getByTestId('playback-pause-resume-slot')).toBeTruthy()
  })

  it('existing Reward Chart/Episode Statistics behavior is unaffected when nothing is selected (regression)', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '3' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(screen.getByTestId('reward-chart-svg')).toBeTruthy()
    expect(screen.queryByTestId('reward-chart-selected-point')).toBeNull()
    expect(engine.getSnapshot().stats.rewardHistory.length).toBe(3)
  })
})

describe('App (integration, real Engine — Phase 25: Learning Progress)', () => {
  const tinyGridConfig = {
    width: 2,
    height: 1,
    start: { x: 0, y: 0 },
    goal: { x: 1, y: 0 },
    walls: [],
    stepReward: -0.1,
    goalReward: 10,
    terminalCells: [],
    bombs: [],
    bombPenalty: -10,
  }

  it('shows the Learning Progress empty state before any Episode completes', () => {
    render(<App />)
    expect(screen.getByTestId('learning-progress-empty')).toBeTruthy()
    expect(screen.queryByTestId('learning-progress')).toBeNull()
  })

  it('A/B. after Episodes complete, Learning Progress renders both charts (Total Reward / Steps, no Exploration Rate — Phase 28) matching the real episodeStatsHistory', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '3' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(screen.getByTestId('learning-progress')).toBeTruthy()
    expect(screen.getByTestId('learning-progress-total-reward-chart')).toBeTruthy()
    expect(screen.getByTestId('learning-progress-steps-chart')).toBeTruthy()
    expect(screen.queryByTestId('learning-progress-exploration-rate-chart')).toBeNull()
    // 3 completed Episodes -> 1 M + 2 L in each mini-chart's path.
    const d = screen.getByTestId('learning-progress-total-reward-path').getAttribute('d') ?? ''
    expect((d.match(/L/g) ?? []).length).toBe(2)
  })

  it('C/D. selecting an Episode in the History highlights it in the Reward Chart AND both remaining Learning Progress charts', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '2' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    fireEvent.click(screen.getByTestId('episode-history-row-2'))

    expect(screen.getByTestId('reward-chart-selected-point')).toBeTruthy()
    expect(screen.getByTestId('learning-progress-total-reward-selected-point')).toBeTruthy()
    expect(screen.getByTestId('learning-progress-steps-selected-point')).toBeTruthy()
  })

  it('E/F. changing epsilon/alpha/gamma does not affect Learning Progress rendering (regression)', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.change(screen.getByTestId('epsilon-number'), { target: { value: '0.3' } })
    fireEvent.change(screen.getByTestId('alpha-number'), { target: { value: '0.4' } })
    fireEvent.change(screen.getByTestId('gamma-number'), { target: { value: '0.8' } })

    expect(screen.getByTestId('learning-progress')).toBeTruthy()
    expect(engine.getSnapshot().hyperparams).toEqual({ alpha: 0.4, gamma: 0.8, epsilon: 0.3 })
  })

  it('G. Pause/Resume does not create premature Learning Progress data points', () => {
    engine.reset({
      envConfig: {
        width: 1,
        height: 4,
        start: { x: 0, y: 3 },
        goal: { x: 0, y: 0 },
        walls: [],
        stepReward: -1,
        goalReward: 10,
        terminalCells: [],
        bombs: [],
        bombPenalty: -10,
      },
      hyperparams: { alpha: 0, gamma: 0.9, epsilon: 0 },
    })
    engine.setSpeed({ mode: 'interval', intervalMs: 500 })
    render(<App />)

    // Phase 46: episodeCount now defaults to 100 — set it to 1 explicitly.
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('playback-pause'))
    expect(screen.getByTestId('learning-progress-empty')).toBeTruthy() // no premature point

    fireEvent.click(screen.getByTestId('speed-very-fast'))
    fireEvent.click(screen.getByTestId('playback-resume'))

    expect(screen.getByTestId('learning-progress')).toBeTruthy()
    expect(engine.getSnapshot().stats.episodeStatsHistory.length).toBe(1)
  })

  it('H. Reset clears Learning Progress back to the empty state, consistent with Reward Chart/Episode Statistics', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect(screen.getByTestId('learning-progress')).toBeTruthy()

    fireEvent.click(screen.getByTestId('playback-reset'))

    expect(screen.getByTestId('learning-progress-empty')).toBeTruthy()
    expect(screen.getByTestId('reward-chart-empty')).toBeTruthy()
    expect(screen.getByTestId('episode-history-empty')).toBeTruthy()
  })

  it('I. Algorithm switch also resets Learning Progress, and selection highlight clears with it', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))
    expect(screen.getByTestId('learning-progress-total-reward-selected-point')).toBeTruthy()

    fireEvent.change(screen.getByTestId('algorithm-select'), { target: { value: 'sarsa' } })

    expect(screen.getByTestId('learning-progress-empty')).toBeTruthy()
  })

  it('J. Bomb + Environment Editor: Learning Progress still renders correctly for a Bomb-affected run', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 5000 })
    render(<App />)
    fireEvent.click(screen.getByTestId('toggle-env-editor'))
    fireEvent.click(screen.getByTestId('env-editor-mode-bomb'))
    fireEvent.click(within(screen.getByTestId('env-editor-grid')).getByTestId('cell-1,1'))
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(screen.getByTestId('learning-progress')).toBeTruthy()
    expect(screen.getByTestId('learning-progress-total-reward-chart')).toBeTruthy()
  })

  it('K. i18n: Learning Progress heading and axis text translate English -> Korean -> English', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect(screen.getByText('Learning Progress')).toBeTruthy()

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'ko' } })
    expect(screen.getByText('학습 진행 상황')).toBeTruthy()
    expect(screen.getByTestId('learning-progress-steps-y-axis').textContent).toBe('Y: Step 수')

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'en' } })
    expect(screen.getByText('Learning Progress')).toBeTruthy()
  })

  it('L. Layout: Learning Progress does not disturb the Phase 14/16 stabilizing structure', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    const twoColRow = screen.getByTestId('grid-stack').closest('.md\\:flex-row')
    expect(twoColRow).toBeTruthy()
    expect(twoColRow!.className).toContain('w-full')
    expect(screen.getByTestId('playback-pause-resume-slot')).toBeTruthy()
  })
})

describe('App (integration, real Engine — Phase 26: Episode Trajectory)', () => {
  const tinyGridConfig = {
    width: 2,
    height: 1,
    start: { x: 0, y: 0 },
    goal: { x: 1, y: 0 },
    walls: [],
    stepReward: -0.1,
    goalReward: 10,
    terminalCells: [],
    bombs: [],
    bombPenalty: -10,
  }
  const corridorConfig = {
    width: 1,
    height: 4,
    start: { x: 0, y: 3 },
    goal: { x: 0, y: 0 },
    walls: [],
    stepReward: -1,
    goalReward: 10,
    terminalCells: [],
    bombs: [],
    bombPenalty: -9,
  }

  it('shows the Episode Trajectory empty state before any Episode is selected', () => {
    render(<App />)
    expect(screen.getByTestId('episode-trajectory-empty')).toBeTruthy()
    expect(screen.queryByTestId('episode-trajectory')).toBeNull()
    expect(screen.queryByTestId('trajectory-overlay')).toBeNull()
  })

  it('A. Episode 1: selecting it in the History shows both the Grid overlay and the Step Detail panel', () => {
    engine.reset({ envConfig: corridorConfig, hyperparams: { alpha: 0, gamma: 0.9, epsilon: 0 } })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    fireEvent.click(screen.getByTestId('episode-history-row-1'))

    expect(screen.getByTestId('trajectory-overlay')).toBeTruthy()
    expect(screen.getByTestId('episode-trajectory')).toBeTruthy()
    // Phase 34: State is "x,y,mask" — the single Goal at (0,0) is collected only on the
    // final transition, so the start mask is "0" and the end mask is "1".
    expect(screen.getByTestId('episode-trajectory-start').textContent).toBe('0,3,0')
    expect(screen.getByTestId('episode-trajectory-end').textContent).toBe('0,0,1')
    expect(screen.getByTestId('episode-trajectory-step-count').textContent).toBe('3')
    expect(screen.getByTestId('episode-trajectory-termination').textContent).toBe('Goal')
  })

  it('B/E. Episode 1 -> 2 -> 3: switching selection updates the trajectory to match each real Episode', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '3' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    fireEvent.click(screen.getByTestId('episode-history-row-1'))
    const ep1 = engine.getSnapshot().stats.episodeStatsHistory.find((e) => e.episode === 1)!
    expect(screen.getByTestId('episode-trajectory-step-count').textContent).toBe(String(ep1.steps))

    fireEvent.click(screen.getByTestId('episode-history-row-2'))
    const ep2 = engine.getSnapshot().stats.episodeStatsHistory.find((e) => e.episode === 2)!
    expect(screen.getByTestId('episode-trajectory-step-count').textContent).toBe(String(ep2.steps))

    fireEvent.click(screen.getByTestId('episode-history-row-3'))
    const ep3 = engine.getSnapshot().stats.episodeStatsHistory.find((e) => e.episode === 3)!
    expect(screen.getByTestId('episode-trajectory-step-count').textContent).toBe(String(ep3.steps))
  })

  it('D. the Step Detail table matches the real Core trajectory data exactly (not a guess)', () => {
    engine.reset({ envConfig: corridorConfig, hyperparams: { alpha: 0, gamma: 0.9, epsilon: 0 } })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))

    const ep = engine.getSnapshot().stats.episodeStatsHistory[0]
    ep.trajectory.forEach((step, i) => {
      expect(screen.getByTestId(`trajectory-step-state-${i}`).textContent).toBe(step.state)
      expect(screen.getByTestId(`trajectory-step-next-state-${i}`).textContent).toBe(step.nextState)
      expect(screen.getByTestId(`trajectory-step-reward-${i}`).textContent).toBe(step.reward.toFixed(2))
    })
  })

  it('F. a repeated State is preserved as separate rows in the Step Detail table (not deduplicated) — same bounce fixture as the Core-level test', () => {
    // width=2,height=1,start=(0,0),goal=(1,0), alpha=1/epsilon=0: deterministically
    // bounces at (0,0) for 3 steps (up/down/left, all boundary no-ops) before "right"
    // reaches the Goal on step 4 — see SimulationEngine.test.ts's Phase 26 comment for
    // the full derivation of why this specific config is exactly reproducible.
    engine.reset({ envConfig: tinyGridConfig, hyperparams: { alpha: 1, gamma: 0.9, epsilon: 0 } })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))

    // Phase 34: State is "x,y,mask" — the bounces at (0,0) never collect the Goal (mask
    // stays "0"); the final nextState (Goal collected) becomes "1,0,1".
    expect(screen.getByTestId('episode-trajectory-step-count').textContent).toBe('4')
    expect(screen.getByTestId('trajectory-step-state-0').textContent).toBe('0,0,0')
    expect(screen.getByTestId('trajectory-step-state-1').textContent).toBe('0,0,0')
    expect(screen.getByTestId('trajectory-step-state-2').textContent).toBe('0,0,0')
    expect(screen.getByTestId('trajectory-step-next-state-3').textContent).toBe('1,0,1')
    // Grid overlay also draws all 4 points (3 repeats + final), not deduplicated.
    expect(screen.getByTestId('trajectory-marker-0')).toBeTruthy()
    expect(screen.getByTestId('trajectory-marker-3')).toBeTruthy()
  })

  it('G. a Bomb-ended Episode shows Termination = Bomb, with the real bombPenalty as the last step\'s reward', () => {
    engine.reset({
      envConfig: {
        width: 2,
        height: 1,
        start: { x: 0, y: 0 },
        goal: { x: 1, y: 1 }, // unreachable — only the Bomb can end the episode
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [{ x: 1, y: 0 }],
        bombPenalty: -10,
      },
    })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))

    expect(screen.getByTestId('episode-trajectory-termination').textContent).toBe('Bomb')
    const ep = engine.getSnapshot().stats.episodeStatsHistory[0]
    const lastIndex = ep.trajectory.length - 1
    expect(screen.getByTestId(`trajectory-step-reward-${lastIndex}`).textContent).toBe('-10.00')
  })

  it('H. a Goal-ended Episode shows Termination = Goal, matching the real Core termination classification', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))

    expect(screen.getByTestId('episode-trajectory-termination').textContent).toBe('Goal')
  })

  it('I/J. changing epsilon/alpha/gamma before running still produces a trajectory that matches the real Episode', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('epsilon-number'), { target: { value: '0' } })
    fireEvent.change(screen.getByTestId('alpha-number'), { target: { value: '0.5' } })
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))

    const ep = engine.getSnapshot().stats.episodeStatsHistory[0]
    expect(screen.getByTestId('episode-trajectory-step-count').textContent).toBe(String(ep.steps))
  })

  it('K. Pause/Resume: a paused mid-Episode never appears selectable/complete; the trajectory appears only once the Episode actually finishes', () => {
    engine.reset({ envConfig: corridorConfig, hyperparams: { alpha: 0, gamma: 0.9, epsilon: 0 } })
    engine.setSpeed({ mode: 'interval', intervalMs: 500 })
    render(<App />)
    // Phase 46: episodeCount now defaults to 100 — set it to 1 explicitly.
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('playback-pause'))
    expect(screen.getByTestId('episode-history-empty')).toBeTruthy() // nothing to select yet

    fireEvent.click(screen.getByTestId('speed-very-fast'))
    fireEvent.click(screen.getByTestId('playback-resume'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))

    expect(screen.getByTestId('episode-trajectory-step-count').textContent).toBe('3')
  })

  it('L. Reset clears the trajectory back to the empty state, consistent with the other Episode-selection-linked panels', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))
    expect(screen.getByTestId('episode-trajectory')).toBeTruthy()

    fireEvent.click(screen.getByTestId('playback-reset'))

    expect(screen.getByTestId('episode-trajectory-empty')).toBeTruthy()
    expect(screen.queryByTestId('trajectory-overlay')).toBeNull()
  })

  it('M. Algorithm switch also clears the trajectory (no ghost data from the previous learning session)', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))
    expect(screen.getByTestId('episode-trajectory')).toBeTruthy()

    fireEvent.change(screen.getByTestId('algorithm-select'), { target: { value: 'sarsa' } })

    expect(screen.getByTestId('episode-trajectory-empty')).toBeTruthy()
    expect(screen.queryByTestId('trajectory-overlay')).toBeNull()
  })

  it('N. Environment Editor Bomb addition + Apply also clears the trajectory (consistent with Phase 24 reset semantics)', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 5000 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))
    expect(screen.getByTestId('episode-trajectory')).toBeTruthy()

    fireEvent.click(screen.getByTestId('toggle-env-editor'))
    fireEvent.click(screen.getByTestId('env-editor-mode-bomb'))
    fireEvent.click(within(screen.getByTestId('env-editor-grid')).getByTestId('cell-1,1'))
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(screen.getByTestId('episode-trajectory-empty')).toBeTruthy()
  })

  it('O. i18n: Episode Trajectory heading/summary/table headers translate English -> Korean -> English', () => {
    const ACTION_KO: Record<string, string> = { Up: '위', Down: '아래', Left: '왼쪽', Right: '오른쪽' }
    engine.reset({ envConfig: corridorConfig, hyperparams: { alpha: 0, gamma: 0.9, epsilon: 0 } })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))
    expect(screen.getByText(/Episode Trajectory/)).toBeTruthy()
    const englishAction = screen.getByTestId('trajectory-step-action-0').textContent!

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'ko' } })
    expect(screen.getByText(/Episode 경로/)).toBeTruthy()
    expect(screen.getByTestId('trajectory-step-action-0').textContent).toBe(ACTION_KO[englishAction])

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'en' } })
    expect(screen.getByText(/Episode Trajectory/)).toBeTruthy()
    expect(screen.getByTestId('trajectory-step-action-0').textContent).toBe(englishAction)
  })

  it('does not disturb the Phase 14/16 stabilizing layout structure', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))

    const twoColRow = screen.getByTestId('grid-stack').closest('.md\\:flex-row')
    expect(twoColRow).toBeTruthy()
    expect(twoColRow!.className).toContain('w-full')
    expect(screen.getByTestId('playback-pause-resume-slot')).toBeTruthy()
  })

  it('existing overlays (Policy/Value) and existing panels are unaffected by the new Trajectory overlay (regression)', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    fireEvent.click(screen.getByTestId('episode-history-row-1'))
    fireEvent.click(screen.getByTestId('toggle-policy'))
    fireEvent.click(screen.getByTestId('toggle-value'))

    expect(screen.getByTestId('policy-overlay')).toBeTruthy()
    expect(screen.getByTestId('value-heatmap')).toBeTruthy()
    expect(screen.getByTestId('trajectory-overlay')).toBeTruthy()
    expect(screen.getByTestId('reward-chart-selected-point')).toBeTruthy()
    expect(screen.getByTestId('learning-progress-total-reward-selected-point')).toBeTruthy()
  })
})

describe('App (integration, real Engine — Phase 28: UX / Layout / Episode scale / Greedy Policy / Korean default)', () => {
  const tinyGridConfig = {
    width: 2,
    height: 1,
    start: { x: 0, y: 0 },
    goal: { x: 1, y: 0 },
    walls: [],
    stepReward: -0.1,
    goalReward: 10,
    terminalCells: [],
    bombs: [],
    bombPenalty: -10,
  }
  const corridorConfig = {
    width: 1,
    height: 4,
    start: { x: 0, y: 3 },
    goal: { x: 0, y: 0 },
    walls: [],
    stepReward: -1,
    goalReward: 10,
    terminalCells: [],
    bombs: [],
    bombPenalty: -9,
  }

  it('E. shows the default epsilon (0.1) and hyperparams on first render', () => {
    render(<App />)
    expect((screen.getByTestId('epsilon-number') as HTMLInputElement).value).toBe('0.1')
    expect((screen.getByTestId('alpha-number') as HTMLInputElement).value).toBe('0.1')
    expect((screen.getByTestId('gamma-number') as HTMLInputElement).value).toBe('0.9')
  })

  it('Learning Progress shows Total Reward and Steps, but no Exploration Rate chart', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(screen.getByTestId('learning-progress-total-reward-chart')).toBeTruthy()
    expect(screen.getByTestId('learning-progress-steps-chart')).toBeTruthy()
    expect(screen.queryByTestId('learning-progress-exploration-rate-chart')).toBeNull()
  })

  it('F. Reward Chart and Learning Progress render numeric axis tick labels', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(screen.getByTestId('reward-chart-x-tick-1')).toBeTruthy()
    expect(screen.getByTestId('learning-progress-total-reward-x-tick-1')).toBeTruthy()
  })

  it('D. runs past the old 200-Episode cap (201) and all Episodes remain in Reward Chart/Episode History data', () => {
    engine.reset({ envConfig: corridorConfig, hyperparams: { alpha: 0, gamma: 0.9, epsilon: 0 } })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 100_000 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '201' } })

    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(engine.getSnapshot().episode).toBe(201)
    expect(engine.getSnapshot().stats.rewardHistory.length).toBe(201)
    expect(engine.getSnapshot().stats.episodeStatsHistory.length).toBe(201)
    expect(engine.getSnapshot().stats.episodeStatsHistory[0].episode).toBe(1) // not evicted
  })

  it('G. Run Greedy Policy: epsilon=1.0 set, but the run is still fully greedy (no exploration), and epsilon stays 1.0 afterward', () => {
    engine.reset({ envConfig: corridorConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('epsilon-number'), { target: { value: '1' } })

    fireEvent.click(screen.getByTestId('playback-run-greedy'))

    expect(engine.getSnapshot().status).toBe('idle')
    const ep = engine.getSnapshot().stats.latestEpisodeStats!
    expect(ep.explorationCount).toBe(0)
    expect(ep.terminationReason).toBe('goal')
    expect((screen.getByTestId('epsilon-number') as HTMLInputElement).value).toBe('1')
    expect(engine.getSnapshot().hyperparams.epsilon).toBe(1)
  })

  it('Run Greedy Policy does not modify the Q-table (values stay 0, verified via Q-value bars after a State select)', () => {
    engine.reset({ envConfig: corridorConfig, hyperparams: { alpha: 0.5, gamma: 0.9, epsilon: 1 } })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)

    fireEvent.click(screen.getByTestId('playback-run-greedy'))

    const snapshot = engine.getSnapshot().agentSnapshot
    expect(snapshot.kind).toBe('Q')
    if (snapshot.kind === 'Q') {
      const values = Object.values(snapshot.qTable).flat()
      expect(values.every((v) => v === 0)).toBe(true)
    }
  })

  it('H. Bomb: Run Greedy Policy still terminates on Bomb entry normally', () => {
    // A fresh (untrained, all-zero) Q-table's argmax is always action 0 ("up") — a
    // Greedy run never learns (by design, see SimulationEngine.ts's Phase 28 comment),
    // so a shape where "up" bounces at a boundary (e.g. a 2x1 grid) would loop forever
    // and never reach any terminal cell. This corridor instead puts the Bomb directly on
    // the fixed "always up" path, so a fresh Q-table's Greedy policy reaches it directly.
    engine.reset({
      envConfig: {
        width: 1,
        height: 3,
        start: { x: 0, y: 2 },
        goal: { x: 0, y: 0 }, // valid, in-bounds, but never reached — the Bomb intercepts first
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [{ x: 0, y: 1 }],
        bombPenalty: -10,
      },
      hyperparams: { alpha: 0.1, gamma: 0.9, epsilon: 0 },
    })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)

    fireEvent.click(screen.getByTestId('playback-run-greedy'))

    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().stats.latestEpisodeStats!.terminationReason).toBe('bomb')
  })

  it('Run Greedy Policy is disabled while RUNNING/PAUSED, same as Step/Run/Run Episode', () => {
    // A deterministic multi-step corridor, not tinyGridConfig — with the default
    // epsilon=0.2 (Phase 28), a 1-step-to-Goal grid could legitimately finish on Run()'s
    // own synchronous first step (a known Scheduler.start() behavior), making "still
    // running right after the click" an unreliable assumption to test against.
    engine.reset({ envConfig: corridorConfig, hyperparams: { alpha: 0, gamma: 0.9, epsilon: 0 } })
    engine.setSpeed({ mode: 'interval', intervalMs: 500 })
    render(<App />)

    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect((screen.getByTestId('playback-run-greedy') as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByTestId('playback-pause'))
    expect((screen.getByTestId('playback-run-greedy') as HTMLButtonElement).disabled).toBe(true)

    engine.pause() // don't leave a scheduled callback dangling past the test
  })

  it('J/I. Run Greedy Policy label translates to Korean and back to English', () => {
    render(<App />)
    expect(screen.getByTestId('playback-run-greedy').textContent).toBe('Run Greedy Policy')

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'ko' } })
    expect(screen.getByTestId('playback-run-greedy').textContent).toBe('탐욕 정책 실행')

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'en' } })
    expect(screen.getByTestId('playback-run-greedy').textContent).toBe('Run Greedy Policy')
  })

  it('Phase 28 §9: the real default locale (no forced switch) is Korean', () => {
    rtlRender(<App />)
    expect((screen.getByTestId('language-selector') as HTMLSelectElement).value).toBe('ko')
    expect(screen.getByTestId('playback-run-episode').textContent).toBe('학습하기')
  })

  it('§2: <main> uses the wider Phase 28 layout width classes', () => {
    render(<App />)
    const main = screen.getByText('RL Playground').closest('main')!
    expect(main.className).toContain('max-w-7xl')
  })

  it('B/C/J. regression: Run/Run Episode/Pause/Resume/Reset/Algorithm Selector/Bomb/Episode Selection/Trajectory all still work after this Phase\'s changes', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)

    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect(engine.getSnapshot().episode).toBe(1)

    fireEvent.click(screen.getByTestId('episode-history-row-1'))
    expect(screen.getByTestId('episode-detail')).toBeTruthy()
    expect(screen.getByTestId('episode-trajectory')).toBeTruthy()

    fireEvent.change(screen.getByTestId('algorithm-select'), { target: { value: 'sarsa' } })
    expect(engine.getSnapshot().algorithmId).toBe('sarsa')

    fireEvent.click(screen.getByTestId('playback-reset'))
    expect(engine.getSnapshot().episode).toBe(0)
    expect(engine.getSnapshot().hyperparams.epsilon).toBe(0.1)
  })

  it('I. Termination Chart: shows the empty state before any Episode, then real Goal/Bomb counts as Episodes complete', () => {
    render(<App />)
    expect(screen.getByTestId('termination-chart-empty')).toBeTruthy()

    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '5' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    const history = engine.getSnapshot().stats.episodeStatsHistory
    const goalCount = history.filter((e) => e.terminationReason === 'goal').length
    expect(screen.getByTestId('termination-chart-count-goal').textContent).toBe(String(goalCount))
    expect(screen.getByTestId('termination-chart-count-bomb').textContent).toBe('0')
  })

  it('F. Bomb: the Termination Chart Bomb count increases after a Bomb-ended Episode', () => {
    engine.reset({
      envConfig: {
        width: 2,
        height: 1,
        start: { x: 0, y: 0 },
        goal: { x: 1, y: 1 }, // unreachable — only the Bomb can end the episode
        walls: [],
        stepReward: -0.1,
        goalReward: 10,
        terminalCells: [],
        bombs: [{ x: 1, y: 0 }],
        bombPenalty: -10,
      },
    })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)

    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(screen.getByTestId('termination-chart-count-bomb').textContent).toBe('1')
    expect(screen.getByTestId('termination-chart-count-goal').textContent).toBe('0')
  })

  it('Termination Chart shows the full distribution regardless of Episode selection (independent of Episode Detail)', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '3' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    const countBeforeSelection = screen.getByTestId('termination-chart-count-goal').textContent

    fireEvent.click(screen.getByTestId('episode-history-row-2'))

    expect(screen.getByTestId('termination-chart-count-goal').textContent).toBe(countBeforeSelection)
  })

  it('D. Episode scale: Termination Chart handles 201+ Episodes correctly (counts sum to the real total)', () => {
    engine.reset({ envConfig: corridorConfig, hyperparams: { alpha: 0, gamma: 0.9, epsilon: 0 } })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 100_000 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '201' } })

    fireEvent.click(screen.getByTestId('playback-run-episode'))

    const goalCount = Number(screen.getByTestId('termination-chart-count-goal').textContent)
    const bombCount = Number(screen.getByTestId('termination-chart-count-bomb').textContent)
    const otherCount = Number(screen.getByTestId('termination-chart-count-other').textContent)
    expect(goalCount + bombCount + otherCount).toBe(201)
    expect(goalCount).toBe(201) // deterministic corridor always reaches Goal
  })

  it('G. i18n: Termination Chart heading/labels translate English -> Korean -> English', () => {
    engine.reset({ envConfig: tinyGridConfig })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect(screen.getByText('Termination Reasons')).toBeTruthy()

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'ko' } })
    expect(screen.getByText('종료 원인 분포')).toBeTruthy()

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'en' } })
    expect(screen.getByText('Termination Reasons')).toBeTruthy()
  })
})

describe('App (integration, real Engine — Phase 36: Policy/Value dedup, Greedy Inspector, QValueBars highlight, Episode History hint, Stop/Restart)', () => {
  // A cell fully enclosed by walls on all four sides — every action from `start` is a
  // boundary/wall no-op regardless of what the Q-table looks like, so a Greedy run from
  // here never reaches any terminal cell. This is the App-level equivalent of the Phase
  // 36 audit's 1x1-grid infinite-loop fixture, reproduced here as a real user-reachable
  // config (via the Environment Editor's own Apply path — engine.reset({envConfig}) —
  // rather than a temporary test-only construct).
  const isolatedCellConfig = {
    width: 3,
    height: 3,
    start: { x: 1, y: 1 },
    goal: { x: 2, y: 2 },
    walls: [
      { x: 0, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 0 },
      { x: 1, y: 2 },
    ],
    stepReward: -0.1,
    goalReward: 10,
    terminalCells: [],
    bombs: [],
    bombPenalty: -10,
  }

  it('Policy/Value overlays show exactly one arrow/cell per position even when the same cell has entries under two different Goal-collection masks', () => {
    // Two Goals on a 1-row corridor: the agent revisits position (0,0) both before and
    // after collecting the first Goal, so the Q-table ends up with distinct "0,0,0" and
    // "0,0,mask" entries at the same grid position — the exact multi-mask duplication
    // Phase 36 fixes (see PolicyOverlay.tsx/ValueHeatmap.tsx file headers).
    const multiGoalConfig = {
      width: 3,
      height: 1,
      start: { x: 0, y: 0 },
      goals: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
      walls: [],
      stepReward: -1,
      wallPenalty: -1,
      goalReward: 10,
      terminalCells: [],
      bombs: [],
      bombPenalty: -9,
    }
    engine.reset({ envConfig: multiGoalConfig, hyperparams: { alpha: 0.5, gamma: 0.9, epsilon: 0.8 } })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    // Regardless of exact mask semantics for this config, the live overlay must never
    // show more than one arrow/cell at the same grid position — the core Phase 36
    // regression this test guards against.
    const arrowPositions = screen
      .queryAllByTestId(/^policy-arrow-/)
      .map((el) => statePosition(el.getAttribute('data-testid')!.replace('policy-arrow-', '')))
    expect(new Set(arrowPositions).size).toBe(arrowPositions.length)

    const valuePositions = screen
      .queryAllByTestId(/^value-cell-/)
      .map((el) => statePosition(el.getAttribute('data-testid')!.replace('value-cell-', '')))
    expect(new Set(valuePositions).size).toBe(valuePositions.length)
  })

  it('Inspector shows State/Action/Reward during a Greedy run, and QValueBars highlights the Greedy Action row', () => {
    engine.reset({ envConfig: createDefaultGridWorldConfig() })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)

    fireEvent.click(screen.getByTestId('playback-run-greedy'))

    expect(screen.queryByTestId('inspector-empty')).toBeNull()
    expect(screen.getByTestId('inspector-state')).toBeTruthy()
    expect(screen.getByTestId('inspector-action')).toBeTruthy()
    expect(screen.getByTestId('inspector-reward')).toBeTruthy()
    // No TD update happens during Greedy (no learning) — those sections must stay hidden.
    expect(screen.queryByTestId('inspector-target')).toBeNull()
    expect(screen.queryByTestId('inspector-estimate')).toBeNull()

    // Select the start State to inspect its Q-value bars and confirm the Greedy row is marked.
    fireEvent.click(screen.getByTestId(`cell-${statePosition(engine.getSnapshot().envRenderModel.start)}`))
    const greedyRows = screen.queryAllByTestId(/^qvalue-row-/).filter((el) => el.getAttribute('data-greedy-action') === 'true')
    expect(greedyRows.length).toBe(1)
  })

  it('Episode History shows the discoverability hint once an Episode completes, in both locales', () => {
    engine.reset({ envConfig: createDefaultGridWorldConfig() })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(screen.getByTestId('episode-history-hint').textContent).toBe('Click an episode to view its path.')

    fireEvent.change(screen.getByTestId('language-selector'), { target: { value: 'ko' } })
    expect(screen.getByTestId('episode-history-hint').textContent).toBe(
      '에피소드를 클릭하면 해당 에피소드의 경로를 볼 수 있습니다.',
    )
  })

  it('Stop & Restart aborts a stuck/looping Greedy run, returns the Agent to Start, and leaves the Q-table untouched', () => {
    engine.reset({ envConfig: isolatedCellConfig, hyperparams: { alpha: 0.5, gamma: 0.9, epsilon: 0 } })
    engine.setSpeed({ mode: 'interval', intervalMs: 100_000 }) // one synchronous step per click, no real-timer flush needed
    render(<App />)

    fireEvent.click(screen.getByTestId('playback-run-greedy'))
    expect(engine.getSnapshot().status).toBe('running') // never reaches a terminal cell
    const qTableDuringRun = engine.getSnapshot().agentSnapshot
    expect(qTableDuringRun.kind).toBe('Q')
    const entriesDuringRun = qTableDuringRun.kind === 'Q' ? Object.keys(qTableDuringRun.qTable).length : -1

    fireEvent.click(screen.getByTestId('playback-restart-episode'))

    const snapshot = engine.getSnapshot()
    expect(snapshot.status).toBe('idle')
    expect(snapshot.envRenderModel.agentPos).toBe(snapshot.envRenderModel.start)
    expect(snapshot.lastTransition).toBeNull()
    const qTableAfterRestart = snapshot.agentSnapshot
    expect(qTableAfterRestart.kind).toBe('Q')
    if (qTableAfterRestart.kind === 'Q') {
      // Greedy never writes to the Q-table in the first place, so this also implicitly
      // confirms restartEpisode() never recreated the Agent (a recreated Agent would
      // still show 0 entries either way here — the meaningful assertion is the second
      // test below, where real prior learning exists).
      expect(Object.keys(qTableAfterRestart.qTable).length).toBe(entriesDuringRun)
    }
  })

  it('Stop & Restart preserves real prior learning when a normal (non-Greedy) run is aborted mid-flight', () => {
    engine.reset({ envConfig: createDefaultGridWorldConfig(), hyperparams: { alpha: 0.5, gamma: 0.9, epsilon: 0.5 } })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)

    fireEvent.click(screen.getByTestId('playback-run-episode')) // a few real learning episodes
    const learnedSnapshot = engine.getSnapshot().agentSnapshot
    expect(learnedSnapshot.kind).toBe('Q')
    const learnedEntries = learnedSnapshot.kind === 'Q' ? Object.keys(learnedSnapshot.qTable).length : 0
    expect(learnedEntries).toBeGreaterThan(0)

    engine.setSpeed({ mode: 'interval', intervalMs: 100_000 })
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode')) // starts a new in-progress run
    expect(engine.getSnapshot().status === 'running' || engine.getSnapshot().status === 'idle').toBe(true)

    fireEvent.click(screen.getByTestId('playback-restart-episode'))

    const snapshot = engine.getSnapshot()
    expect(snapshot.status).toBe('idle')
    const afterSnapshot = snapshot.agentSnapshot
    expect(afterSnapshot.kind).toBe('Q')
    if (afterSnapshot.kind === 'Q') {
      expect(Object.keys(afterSnapshot.qTable).length).toBeGreaterThanOrEqual(learnedEntries)
    }
  })

  it('Stop & Restart button is disabled while idle and becomes enabled once a run starts', () => {
    engine.reset({ envConfig: isolatedCellConfig })
    engine.setSpeed({ mode: 'interval', intervalMs: 100_000 })
    render(<App />)

    expect((screen.getByTestId('playback-restart-episode') as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByTestId('playback-run-greedy'))
    expect((screen.getByTestId('playback-restart-episode') as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(screen.getByTestId('playback-restart-episode'))
    expect((screen.getByTestId('playback-restart-episode') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('App (integration, real Engine — Phase 44: "Goals Collected" denominator/numerator fix)', () => {
  // Root cause: App.tsx was passing `snapshot.envRenderModel.goals` (the LIVE list that
  // shrinks as Goals are collected — Phase 32) as StatsPanel's `goals` prop, instead of
  // the new `allGoals` (the static, full list — Phase 44). Since StatsPanel counts how
  // many of that prop's entries appear in the trajectory, feeding it the shrinking list
  // corrupted both numerator and denominator identically (reported symptom: "31 / 31" ->
  // "30 / 30" -> "29 / 29" ... on every single Goal collected, never reaching the true
  // total). StatsPanel's own unit tests never caught this because they already passed a
  // correct, static `goals` array directly — this integration test exercises the real
  // App.tsx wiring end to end, which is where the actual bug lived.
  //
  // A fresh (all-zero) Q-table's argmax always ties on action 0 ("Up", decreasing y —
  // see the Phase 28 §8 "H. Bomb" test's identical technique) — alpha=0/epsilon=0 keeps
  // it that way forever, so a column of Goals going straight up from Start is collected
  // in a fully deterministic order via plain Step clicks, no exploration needed.
  const fiveGoalColumnConfig = {
    width: 1,
    height: 6,
    start: { x: 0, y: 5 },
    goals: [{ x: 0, y: 4 }, { x: 0, y: 3 }, { x: 0, y: 2 }, { x: 0, y: 1 }, { x: 0, y: 0 }],
    walls: [],
    stepReward: -0.1,
    goalReward: 10,
    terminalCells: [],
    bombs: [],
    bombPenalty: -10,
  }

  it('collecting all 5 of 5 Goals shows "5 / 5" immediately on completion', () => {
    engine.reset({ envConfig: fiveGoalColumnConfig, hyperparams: { alpha: 0, gamma: 0.9, epsilon: 0 } })
    engine.setSpeed({ mode: 'interval', intervalMs: 100_000 })
    render(<App />)

    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByTestId('playback-step'))

    expect(engine.getSnapshot().status).toBe('idle') // Episode auto-completed on the 5th (final) Goal
    expect(engine.getSnapshot().stats.latestEpisodeStats!.terminationReason).toBe('goal')
    expect(screen.getByTestId('latest-episode-goals-collected').textContent).toBe('5 / 5')
  })

  // This is the precise reproduction of the reported bug. `finishEpisode()`
  // (SimulationEngine.ts) calls `environment.reset()` synchronously as part of finishing
  // an Episode, so by the time "Latest Episode" re-renders with episode 1's completed
  // stats, `envRenderModel.goals` has ALREADY been restored to the full list too — the
  // bug is invisible if you only check right at that instant (both `goals` and
  // `allGoals` happen to agree there). It only shows up once episode 2 starts
  // collecting its OWN Goals: "Latest Episode" still displays episode 1's (unchanged,
  // correct) trajectory, but under the old code its denominator came from the LIVE
  // `envRenderModel.goals` — which now reflects episode 2's own, currently-shrinking
  // progress. That is exactly how a fixed, completed episode's "N / M" could visibly
  // count down (the user's reported "31/31 -> 30/30 -> 29/29...") purely because a
  // *different*, later Episode was quietly collecting its own Goals in the background.
  it('a completed Episode\'s "5 / 5" stays exactly "5 / 5" while the NEXT Episode collects its own Goals (the actual reported bug)', () => {
    engine.reset({ envConfig: fiveGoalColumnConfig, hyperparams: { alpha: 0, gamma: 0.9, epsilon: 0 } })
    engine.setSpeed({ mode: 'interval', intervalMs: 100_000 })
    render(<App />)

    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByTestId('playback-step')) // Episode 1: collect all 5
    expect(screen.getByTestId('latest-episode-goals-collected').textContent).toBe('5 / 5')

    // Episode 2 has now silently started (auto-reset inside finishEpisode()). Step into
    // it one Goal at a time — "Latest Episode" must keep describing episode 1 throughout.
    for (let collected = 1; collected <= 4; collected++) {
      fireEvent.click(screen.getByTestId('playback-step'))
      expect(engine.getSnapshot().stats.latestEpisodeStats!.episode).toBe(1) // still episode 1's card
      expect(screen.getByTestId('latest-episode-goals-collected').textContent).toBe('5 / 5')
    }
  })

  it('an Episode that ends early (Bomb) after collecting only 2 of 4 Goals shows "2 / 4", stable across the next Episode too', () => {
    // Same upward column, but the 3rd Goal is replaced by a Bomb — the Agent collects
    // exactly 2 Goals, then the Episode ends via Bomb with 2 Goals never reached.
    const config = {
      width: 1,
      height: 6,
      start: { x: 0, y: 5 },
      goals: [{ x: 0, y: 4 }, { x: 0, y: 3 }, { x: 0, y: 1 }, { x: 0, y: 0 }],
      walls: [],
      stepReward: -0.1,
      goalReward: 10,
      terminalCells: [],
      bombs: [{ x: 0, y: 2 }],
      bombPenalty: -10,
    }
    engine.reset({ envConfig: config, hyperparams: { alpha: 0, gamma: 0.9, epsilon: 0 } })
    engine.setSpeed({ mode: 'interval', intervalMs: 100_000 })
    render(<App />)

    fireEvent.click(screen.getByTestId('playback-step')) // y5->4: collect Goal 1/4
    fireEvent.click(screen.getByTestId('playback-step')) // y4->3: collect Goal 2/4
    fireEvent.click(screen.getByTestId('playback-step')) // y3->2: Bomb, Episode 1 ends

    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().stats.latestEpisodeStats!.terminationReason).toBe('bomb')
    expect(screen.getByTestId('latest-episode-goals-collected').textContent).toBe('2 / 4')

    // Episode 2 has silently started; step into it and collect one of ITS Goals too —
    // episode 1's "2 / 4" card must not shift because of episode 2's own progress.
    fireEvent.click(screen.getByTestId('playback-step'))
    expect(engine.getSnapshot().stats.latestEpisodeStats!.episode).toBe(1)
    // The exact regression this Phase fixes: before the fix this drifted to "1 / 3" (both
    // numerator and denominator corrupted by episode 2's live-shrinking goal list).
    expect(screen.getByTestId('latest-episode-goals-collected').textContent).toBe('2 / 4')
  })

  it('a plain Reset clears the stale "Goals Collected" display (no leftover value from the previous Episode)', () => {
    engine.reset({ envConfig: fiveGoalColumnConfig, hyperparams: { alpha: 0, gamma: 0.9, epsilon: 0 } })
    engine.setSpeed({ mode: 'interval', intervalMs: 100_000 })
    render(<App />)

    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByTestId('playback-step'))
    expect(screen.getByTestId('latest-episode-goals-collected').textContent).toBe('5 / 5')

    fireEvent.click(screen.getByTestId('playback-reset'))
    expect(screen.queryByTestId('latest-episode-goals-collected')).toBeNull()
  })

  it('single-Goal Environments are unaffected (row stays hidden, matching existing "> 1 Goal only" behavior)', () => {
    engine.reset({ envConfig: createDefaultGridWorldConfig(), hyperparams: { alpha: 0.5, gamma: 0.9, epsilon: 0.2 } })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    fireEvent.change(screen.getByTestId('episode-count-input'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(screen.queryByTestId('latest-episode-goals-collected')).toBeNull()
  })
})
