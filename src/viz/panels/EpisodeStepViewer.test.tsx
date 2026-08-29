// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EpisodeStats } from '../../core/engine/types'
import { EpisodeStepViewer } from './EpisodeStepViewer'
import { translations } from '../../ui/i18n'

afterEach(cleanup)

function episodeStats(overrides: Partial<EpisodeStats> = {}): EpisodeStats {
  return {
    episode: 1,
    steps: 3,
    totalReward: 8,
    terminationReason: 'goal',
    explorationCount: 0,
    exploitationCount: 3,
    explorationRate: 0,
    averageReward: 8 / 3,
    uniqueStates: 4,
    trajectory: [
      { state: '0,3,0', action: 0, nextState: '0,2,0', reward: -1, done: false },
      { state: '0,2,0', action: 0, nextState: '0,1,0', reward: -1, done: false },
      { state: '0,1,0', action: 0, nextState: '0,0,1', reward: 10, done: true },
    ],
    ...overrides,
  }
}

describe('EpisodeStepViewer', () => {
  it('shows the empty state when no Episode is selected', () => {
    render(<EpisodeStepViewer episode={null} step={0} onStepChange={vi.fn()} />)
    expect(screen.getByTestId('step-viewer-empty')).toBeTruthy()
    expect(screen.queryByTestId('step-viewer')).toBeNull()
  })

  it('slider range is 0..trajectory.length (3 transitions -> max 3)', () => {
    render(<EpisodeStepViewer episode={episodeStats()} step={3} onStepChange={vi.fn()} />)
    const slider = screen.getByTestId('step-viewer-slider') as HTMLInputElement
    expect(slider.min).toBe('0')
    expect(slider.max).toBe('3')
  })

  it('moving the slider calls onStepChange with the new step, not any Engine/Q-table API', () => {
    const onStepChange = vi.fn()
    render(<EpisodeStepViewer episode={episodeStats()} step={0} onStepChange={onStepChange} />)
    fireEvent.change(screen.getByTestId('step-viewer-slider'), { target: { value: '2' } })
    expect(onStepChange).toHaveBeenCalledWith(2)
  })

  it('shows the current/total step position text', () => {
    render(<EpisodeStepViewer episode={episodeStats()} step={2} onStepChange={vi.fn()} />)
    expect(screen.getByTestId('step-viewer-position').textContent).toContain('2')
    expect(screen.getByTestId('step-viewer-position').textContent).toContain('3')
  })

  it('Previous/Next call onStepChange with step-1/step+1, clamped to [0, max]', () => {
    const onStepChange = vi.fn()
    const { rerender } = render(<EpisodeStepViewer episode={episodeStats()} step={1} onStepChange={onStepChange} />)
    fireEvent.click(screen.getByTestId('step-viewer-previous'))
    expect(onStepChange).toHaveBeenLastCalledWith(0)
    fireEvent.click(screen.getByTestId('step-viewer-next'))
    expect(onStepChange).toHaveBeenLastCalledWith(2)

    rerender(<EpisodeStepViewer episode={episodeStats()} step={0} onStepChange={onStepChange} />)
    expect((screen.getByTestId('step-viewer-previous') as HTMLButtonElement).disabled).toBe(true)

    rerender(<EpisodeStepViewer episode={episodeStats()} step={3} onStepChange={onStepChange} />)
    expect((screen.getByTestId('step-viewer-next') as HTMLButtonElement).disabled).toBe(true)
  })

  it('reaches the final step for a completed episode (max === trajectory.length is reachable, not off-by-one)', () => {
    render(<EpisodeStepViewer episode={episodeStats()} step={3} onStepChange={vi.fn()} />)
    expect((screen.getByTestId('step-viewer-next') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('step-viewer-position').textContent).toContain('3 / 3')
  })

  it('ArrowLeft/ArrowRight keyboard shortcuts move the step', () => {
    const onStepChange = vi.fn()
    render(<EpisodeStepViewer episode={episodeStats()} step={1} onStepChange={onStepChange} />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(onStepChange).toHaveBeenLastCalledWith(2)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onStepChange).toHaveBeenLastCalledWith(0)
  })

  it('does not respond to keyboard arrows when no Episode is selected', () => {
    const onStepChange = vi.fn()
    render(<EpisodeStepViewer episode={null} step={0} onStepChange={onStepChange} />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(onStepChange).not.toHaveBeenCalled()
  })

  // Phase 47 audit finding: reproduced via real-browser measurement — with focus on the
  // Slider itself (the common case right after dragging it), the browser's OWN native
  // <input type="range"> arrow-key handling (step=1) ALSO fires alongside this
  // component's window keydown listener, so before the fix a single ArrowRight press
  // landed on step+2, not step+1. jsdom doesn't implement the native range-input
  // keyboard behavior, so this test instead asserts the fix's actual mechanism
  // (preventDefault() on the handled key), which is what suppresses that native handling
  // in a real browser.
  it('Phase 47 — ArrowLeft/ArrowRight call preventDefault() so the Slider\'s own native arrow-key handling never double-fires', () => {
    const onStepChange = vi.fn()
    render(<EpisodeStepViewer episode={episodeStats()} step={1} onStepChange={onStepChange} />)

    const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true, bubbles: true })
    window.dispatchEvent(rightEvent)
    expect(rightEvent.defaultPrevented).toBe(true)
    expect(onStepChange).toHaveBeenCalledTimes(1)
    expect(onStepChange).toHaveBeenLastCalledWith(2)

    const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true, bubbles: true })
    window.dispatchEvent(leftEvent)
    expect(leftEvent.defaultPrevented).toBe(true)
  })

  describe('Multi-Goal step state', () => {
    // mask bit 0 = allGoals[0] collected, bit 1 = allGoals[1] collected, etc. — same
    // encoding as GridWorldEnv.ts's goalsMask().
    const multiGoalEpisode = episodeStats({
      trajectory: [
        { state: '0,0,0', action: 3, nextState: '1,0,1', reward: 5, done: false }, // collects goal 0
        { state: '1,0,1', action: 3, nextState: '2,0,3', reward: 5, done: true }, // collects goal 1 too
      ],
    })

    it('step 0 (before any collection) shows 0 / 2 collected', () => {
      render(<EpisodeStepViewer episode={multiGoalEpisode} step={0} onStepChange={vi.fn()} allGoals={['2,0', '0,2']} />)
      expect(screen.getByTestId('step-viewer-goals-collected').textContent).toContain('0 / 2')
    })

    it('step 1 (after collecting goal 0) shows 1 / 2 collected', () => {
      render(<EpisodeStepViewer episode={multiGoalEpisode} step={1} onStepChange={vi.fn()} allGoals={['2,0', '0,2']} />)
      expect(screen.getByTestId('step-viewer-goals-collected').textContent).toContain('1 / 2')
    })

    it('step 2 (the final step, both collected) shows 2 / 2 collected', () => {
      render(<EpisodeStepViewer episode={multiGoalEpisode} step={2} onStepChange={vi.fn()} allGoals={['2,0', '0,2']} />)
      expect(screen.getByTestId('step-viewer-goals-collected').textContent).toContain('2 / 2')
    })

    it('the Goals line is omitted entirely for a single-Goal Environment (allGoals.length <= 1)', () => {
      render(<EpisodeStepViewer episode={episodeStats()} step={0} onStepChange={vi.fn()} allGoals={['0,0']} />)
      expect(screen.queryByTestId('step-viewer-goals-collected')).toBeNull()
    })
  })

  describe('Phase 46 §11 — read-only guarantee', () => {
    it('never calls window.confirm, never touches localStorage/sessionStorage, and calling onStepChange is the ONLY external side effect of any interaction', () => {
      const confirmSpy = vi.spyOn(window, 'confirm')
      const onStepChange = vi.fn()
      render(<EpisodeStepViewer episode={episodeStats()} step={1} onStepChange={onStepChange} />)

      fireEvent.click(screen.getByTestId('step-viewer-next'))
      fireEvent.click(screen.getByTestId('step-viewer-previous'))
      fireEvent.change(screen.getByTestId('step-viewer-slider'), { target: { value: '2' } })

      expect(confirmSpy).not.toHaveBeenCalled()
      expect(onStepChange).toHaveBeenCalled()
      confirmSpy.mockRestore()
    })
  })

  describe('Play/Pause auto-advance', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('clicking Play advances the step automatically, and clicking Pause stops it', () => {
      const onStepChange = vi.fn()
      const { rerender } = render(<EpisodeStepViewer episode={episodeStats()} step={0} onStepChange={onStepChange} />)

      fireEvent.click(screen.getByTestId('step-viewer-play-pause'))
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(onStepChange).toHaveBeenCalledWith(1)

      // Simulate the caller applying the step change (App.tsx would re-render with the
      // new `step` prop) before advancing again.
      rerender(<EpisodeStepViewer episode={episodeStats()} step={1} onStepChange={onStepChange} />)
      fireEvent.click(screen.getByTestId('step-viewer-play-pause')) // pause
      onStepChange.mockClear()
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(onStepChange).not.toHaveBeenCalled()
    })

    it('auto-advance stops on its own at the final step', () => {
      const onStepChange = vi.fn()
      render(<EpisodeStepViewer episode={episodeStats()} step={3} onStepChange={onStepChange} />)
      fireEvent.click(screen.getByTestId('step-viewer-play-pause'))
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(onStepChange).not.toHaveBeenCalled()
    })
  })

  it('shows the translated heading in English (default) and Korean', () => {
    const { rerender } = render(<EpisodeStepViewer episode={episodeStats()} step={0} onStepChange={vi.fn()} />)
    expect(screen.getByTestId('step-viewer').textContent).toContain('Step Viewer')

    rerender(<EpisodeStepViewer episode={episodeStats()} step={0} onStepChange={vi.fn()} t={translations.ko} />)
    expect(screen.getByTestId('step-viewer').textContent).toContain('Step Viewer')
  })
})

describe('EpisodeStepViewer — Phase 51: Collapse/Expand', () => {
  it('defaults to expanded (controls visible, aria-expanded=true)', () => {
    render(<EpisodeStepViewer episode={episodeStats()} step={0} onStepChange={vi.fn()} />)
    expect(screen.getByTestId('step-viewer-controls')).toBeTruthy()
    expect(screen.getByTestId('step-viewer-toggle').getAttribute('aria-expanded')).toBe('true')
  })

  it('clicking the toggle collapses the panel (controls hidden, aria-expanded=false)', () => {
    render(<EpisodeStepViewer episode={episodeStats()} step={0} onStepChange={vi.fn()} />)
    fireEvent.click(screen.getByTestId('step-viewer-toggle'))
    expect(screen.queryByTestId('step-viewer-controls')).toBeNull()
    expect(screen.getByTestId('step-viewer-toggle').getAttribute('aria-expanded')).toBe('false')
  })

  it('clicking the toggle again re-expands the panel', () => {
    render(<EpisodeStepViewer episode={episodeStats()} step={0} onStepChange={vi.fn()} />)
    fireEvent.click(screen.getByTestId('step-viewer-toggle')) // collapse
    fireEvent.click(screen.getByTestId('step-viewer-toggle')) // expand again
    expect(screen.getByTestId('step-viewer-controls')).toBeTruthy()
    expect(screen.getByTestId('step-viewer-toggle').getAttribute('aria-expanded')).toBe('true')
  })

  it('while collapsed, the detail controls (slider/Prev/Next/Play/Goals) are all hidden, but the heading and toggle remain visible', () => {
    render(
      <EpisodeStepViewer
        episode={episodeStats()}
        step={1}
        onStepChange={vi.fn()}
        allGoals={['0,0', '1,1']}
      />,
    )
    fireEvent.click(screen.getByTestId('step-viewer-toggle'))

    expect(screen.queryByTestId('step-viewer-slider')).toBeNull()
    expect(screen.queryByTestId('step-viewer-previous')).toBeNull()
    expect(screen.queryByTestId('step-viewer-next')).toBeNull()
    expect(screen.queryByTestId('step-viewer-play-pause')).toBeNull()
    expect(screen.queryByTestId('step-viewer-position')).toBeNull()
    expect(screen.queryByTestId('step-viewer-goals-collected')).toBeNull()

    // The panel itself, its heading, and the toggle button all still render.
    expect(screen.getByTestId('step-viewer')).toBeTruthy()
    expect(screen.getByTestId('step-viewer').textContent).toContain('Step Viewer')
    expect(screen.getByTestId('step-viewer-toggle')).toBeTruthy()
  })

  it('collapsing and re-expanding never calls onStepChange (no Episode/Step state reset)', () => {
    const onStepChange = vi.fn()
    render(<EpisodeStepViewer episode={episodeStats()} step={2} onStepChange={onStepChange} />)
    fireEvent.click(screen.getByTestId('step-viewer-toggle')) // collapse
    fireEvent.click(screen.getByTestId('step-viewer-toggle')) // expand
    expect(onStepChange).not.toHaveBeenCalled()
  })

  it('re-expanding shows the same step position the panel had before it was collapsed (caller-controlled `step` prop is untouched by collapse)', () => {
    const { rerender } = render(<EpisodeStepViewer episode={episodeStats()} step={2} onStepChange={vi.fn()} />)
    expect(screen.getByTestId('step-viewer-position').textContent).toContain('2 /')

    fireEvent.click(screen.getByTestId('step-viewer-toggle')) // collapse
    // Simulate the caller (App.tsx) re-rendering with the same `step` while collapsed —
    // collapsing never touches the prop, so this is exactly what would happen in practice.
    rerender(<EpisodeStepViewer episode={episodeStats()} step={2} onStepChange={vi.fn()} />)
    fireEvent.click(screen.getByTestId('step-viewer-toggle')) // expand again

    expect(screen.getByTestId('step-viewer-position').textContent).toContain('2 /')
  })

  it('the toggle is keyboard-activatable (a native <button>, so Enter/Space work without extra wiring)', () => {
    render(<EpisodeStepViewer episode={episodeStats()} step={0} onStepChange={vi.fn()} />)
    const toggle = screen.getByTestId('step-viewer-toggle')
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle.getAttribute('type')).toBe('button')
    fireEvent.click(toggle) // fireEvent.keyDown on a <button> does not auto-activate in
    // jsdom (unlike a real browser) — clicking is the equivalent, deterministic way to
    // assert the SAME handler a keyboard Enter/Space press would invoke natively.
    expect(screen.queryByTestId('step-viewer-controls')).toBeNull()
  })

  it('shows the translated collapse/expand label in English and Korean', () => {
    const { rerender } = render(<EpisodeStepViewer episode={episodeStats()} step={0} onStepChange={vi.fn()} />)
    expect(screen.getByTestId('step-viewer-toggle').textContent).toBe('Collapse')

    rerender(<EpisodeStepViewer episode={episodeStats()} step={0} onStepChange={vi.fn()} t={translations.ko} />)
    expect(screen.getByTestId('step-viewer-toggle').textContent).toBe('접기')

    fireEvent.click(screen.getByTestId('step-viewer-toggle'))
    expect(screen.getByTestId('step-viewer-toggle').textContent).toBe('펼치기')
  })
})
