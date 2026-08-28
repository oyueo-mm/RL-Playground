// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultGridWorldConfig } from '../core/environments/gridworld/GridWorldEnv'
import App from './App'
import { engine } from './engine'

afterEach(cleanup)

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
  engine.reset({ envConfig: createDefaultGridWorldConfig() })
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
      const qVector = snapshot.agentSnapshot.qTable['0,0'] ?? [0, 0, 0, 0]
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

    fireEvent.click(screen.getByTestId('playback-run'))

    expect(engine.getSnapshot().status).toBe('running')

    engine.pause() // don't leave a scheduled callback dangling past the test
  })

  it('Pause -> snapshot status becomes paused, Resume -> running again', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('playback-run'))
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
      },
    })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })

    render(<App />)
    fireEvent.click(screen.getByTestId('playback-run-episode'))

    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().episode).toBe(1)
  })

  it('selecting a visited State and enabling Policy/Value shows overlays for it', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('playback-step'))
    const visitedState = engine.getSnapshot().lastTransition!.state

    fireEvent.click(screen.getByTestId(`cell-${visitedState}`))
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
      },
    })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })

    render(<App />)
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
      },
    })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 2000 })

    render(<App />)
    // Phase 12: Run now executes exactly one episode per click (terminal -> idle) rather
    // than auto-continuing, so multiple completed episodes are produced by clicking Run
    // several times — each click completes synchronously within the single first batch
    // (stepsPerFrame=2000 on a 2-cell grid), returning to idle before the next click.
    fireEvent.click(screen.getByTestId('playback-run'))
    fireEvent.click(screen.getByTestId('playback-run'))
    fireEvent.click(screen.getByTestId('playback-run'))

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
    expect(engine.getSnapshot().currentState).toBe('2,2')
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

  it('defaults to English', () => {
    render(<App />)
    expect(langSelect().value).toBe('en')
    expect(screen.getByTestId('playback-run').textContent).toBe('Run')
    expect(screen.getByTestId('playback-step').textContent).toBe('Step')
    expect(screen.getByTestId('stats-panel').textContent).toContain('Statistics')
  })

  it('selecting 한국어 changes the major UI strings to Korean', () => {
    render(<App />)
    selectKorean()

    expect(langSelect().value).toBe('ko')
    expect(screen.getByTestId('playback-step').textContent).toBe('스텝')
    expect(screen.getByTestId('playback-run').textContent).toBe('실행')
    expect(screen.getByTestId('playback-run-episode').textContent).toBe('에피소드 실행')
    expect(screen.getByTestId('playback-reset').textContent).toBe('초기화')
    expect(screen.getByTestId('stats-panel').textContent).toContain('통계')
    expect(screen.getByTestId('toggle-env-editor').textContent).toBe('환경 편집')
  })

  it('can be switched back to English from Korean', () => {
    render(<App />)
    selectKorean()
    expect(screen.getByTestId('playback-run').textContent).toBe('실행')

    selectEnglish()
    expect(screen.getByTestId('playback-run').textContent).toBe('Run')
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
  }

  it('A. defaults to 1', () => {
    render(<App />)
    expect(countInput().value).toBe('1')
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

  it('C. Run still runs exactly 1 episode regardless of the Episode count input', () => {
    engine.reset({ envConfig: tinyTwoCellGrid })
    engine.setSpeed({ mode: 'batch', stepsPerFrame: 500 })
    render(<App />)
    setCount('7') // set a count that would matter for Run Episode, but not for Run

    fireEvent.click(screen.getByTestId('playback-run'))

    expect(engine.getSnapshot().status).toBe('idle')
    expect(engine.getSnapshot().episode).toBe(1)
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
    // The count value itself is untouched by a language change.
    expect(countInput().value).toBe('1')
  })
})

describe('App (integration — Phase 16: layout stability, structural)', () => {
  // jsdom has no real CSS box model, so pixel-position stability itself can only be
  // proven in an actual browser (done for this Phase via Playwright — see the Phase 16
  // report's measured before/after coordinates). What CAN be guarded here, cheaply and
  // durably, is the specific CSS mechanism the fix depends on: if a future change
  // silently drops `w-full` from the two-column row or `flex-1`/`max-w-md` from the
  // right column, the shrink-to-fit + `items-center` re-centering bug this Phase fixed
  // would silently come back. This test fails loudly if that happens.
  it('the two-column row and the right column carry the width-stabilizing classes the Phase 16 fix depends on', () => {
    render(<App />)

    const twoColRow = screen.getByTestId('grid-stack').closest('.md\\:flex-row')
    expect(twoColRow).toBeTruthy()
    expect(twoColRow!.className).toContain('w-full')

    const rightColumn = screen.getByTestId('stats-panel').parentElement!
    expect(rightColumn.className).toContain('md:flex-1')
    expect(rightColumn.className).toContain('md:max-w-md')
  })
})
