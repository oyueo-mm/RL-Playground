// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EngineStatus } from '../../core/engine/types'
import { translations } from '../../ui/i18n'
import { PlaybackControls, type PlaybackControlsProps } from './PlaybackControls'

afterEach(cleanup)

// No @testing-library/jest-dom dependency (kept out per Phase 5 §18's "no new
// dependency" rule) — read the native `disabled` DOM property directly instead of
// toBeDisabled().
function isDisabled(element: HTMLElement): boolean {
  return (element as HTMLButtonElement).disabled
}

function renderControls(overrides: Partial<PlaybackControlsProps> = {}) {
  const props: PlaybackControlsProps = {
    status: 'idle',
    onStep: vi.fn(),
    onRun: vi.fn(),
    onRunEpisode: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  }
  const { rerender } = render(<PlaybackControls {...props} />)
  return { ...props, rerender }
}

describe('PlaybackControls', () => {
  // --- Phase 3 behaviour, preserved unchanged ---

  it('calls onStep exactly once when the Step button is clicked (idle)', () => {
    const { onStep } = renderControls({ status: 'idle' })

    fireEvent.click(screen.getByTestId('playback-step'))

    expect(onStep).toHaveBeenCalledTimes(1)
  })

  it('calls onReset exactly once when the Reset button is clicked', () => {
    const { onReset } = renderControls()

    fireEvent.click(screen.getByRole('button', { name: /reset/i }))

    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('does not call onReset when Step is clicked, or vice versa', () => {
    const { onStep, onReset } = renderControls({ status: 'idle' })

    fireEvent.click(screen.getByTestId('playback-step'))

    expect(onStep).toHaveBeenCalledTimes(1)
    expect(onReset).not.toHaveBeenCalled()
  })

  // --- Phase 5: Run / Run Episode / Pause / Resume + status-gated enable/disable ---

  it('IDLE: calls onRun when Run is clicked', () => {
    const { onRun } = renderControls({ status: 'idle' })
    fireEvent.click(screen.getByTestId('playback-run'))
    expect(onRun).toHaveBeenCalledTimes(1)
  })

  it('IDLE: calls onRunEpisode when Run Episode is clicked', () => {
    const { onRunEpisode } = renderControls({ status: 'idle' })
    fireEvent.click(screen.getByTestId('playback-run-episode'))
    expect(onRunEpisode).toHaveBeenCalledTimes(1)
  })

  it('RUNNING: calls onPause when Pause is clicked', () => {
    const { onPause } = renderControls({ status: 'running' })
    fireEvent.click(screen.getByTestId('playback-pause'))
    expect(onPause).toHaveBeenCalledTimes(1)
  })

  it('PAUSED: calls onResume when Resume is clicked', () => {
    const { onResume } = renderControls({ status: 'paused' })
    fireEvent.click(screen.getByTestId('playback-resume'))
    expect(onResume).toHaveBeenCalledTimes(1)
  })

  it.each<EngineStatus>(['idle', 'running', 'paused'])(
    'Reset is always enabled, regardless of status (%s)',
    (status) => {
      renderControls({ status })
      expect(isDisabled(screen.getByTestId('playback-reset'))).toBe(false)
    },
  )

  // Phase 14: Pause and Resume now share a single slot (data-testid
  // "playback-pause-resume-slot") that renders exactly ONE of the two buttons at a time,
  // instead of both being permanently in the DOM with `disabled` toggled — that previous
  // "always both, toggle disabled" pattern is exactly what made the row wider than
  // necessary and prone to a flex-wrap breakpoint flip on status changes (see the Phase
  // 14 report). These three tests are updated accordingly: the ABSENCE of the other
  // button's testid is now itself part of what's being verified, not weakened from
  // before — the old tests only checked `disabled`, never DOM presence/absence.
  it('IDLE: Step/Run/Run Episode are enabled; the slot shows a disabled Pause, Resume is not rendered', () => {
    renderControls({ status: 'idle' })
    expect(isDisabled(screen.getByTestId('playback-step'))).toBe(false)
    expect(isDisabled(screen.getByTestId('playback-run'))).toBe(false)
    expect(isDisabled(screen.getByTestId('playback-run-episode'))).toBe(false)
    expect(isDisabled(screen.getByTestId('playback-pause'))).toBe(true)
    expect(screen.queryByTestId('playback-resume')).toBeNull()
  })

  it('RUNNING: Step/Run/Run Episode are disabled (no duplicate execution); the slot shows an enabled Pause, Resume is not rendered', () => {
    renderControls({ status: 'running' })
    expect(isDisabled(screen.getByTestId('playback-step'))).toBe(true)
    expect(isDisabled(screen.getByTestId('playback-run'))).toBe(true)
    expect(isDisabled(screen.getByTestId('playback-run-episode'))).toBe(true)
    expect(isDisabled(screen.getByTestId('playback-pause'))).toBe(false)
    expect(screen.queryByTestId('playback-resume')).toBeNull()
  })

  it('PAUSED: Step/Run/Run Episode are disabled; the slot shows an enabled Resume, Pause is not rendered', () => {
    renderControls({ status: 'paused' })
    expect(isDisabled(screen.getByTestId('playback-step'))).toBe(true)
    expect(isDisabled(screen.getByTestId('playback-run'))).toBe(true)
    expect(isDisabled(screen.getByTestId('playback-run-episode'))).toBe(true)
    expect(screen.queryByTestId('playback-pause')).toBeNull()
    expect(isDisabled(screen.getByTestId('playback-resume'))).toBe(false)
  })

  it('clicking a disabled button never calls its handler (RUNNING: Step is disabled)', () => {
    const { onStep } = renderControls({ status: 'running' })
    fireEvent.click(screen.getByTestId('playback-step'))
    expect(onStep).not.toHaveBeenCalled()
  })
})

describe('PlaybackControls — Phase 14: Pause/Resume slot stability', () => {
  // Index of the shared slot among the row's direct children — asserted to stay the same
  // across every status, without depending on any specific CSS (flex/width/etc): only on
  // "is it still the Nth child of the row," which is exactly what a layout-shift bug
  // would break.
  function slotIndexAmongSiblings(): number {
    const slot = screen.getByTestId('playback-pause-resume-slot')
    const row = slot.parentElement!
    return Array.from(row.children).indexOf(slot)
  }

  it('1. IDLE renders the full control row with no errors', () => {
    renderControls({ status: 'idle' })
    expect(screen.getByTestId('playback-step')).toBeTruthy()
    expect(screen.getByTestId('playback-run')).toBeTruthy()
    expect(screen.getByTestId('playback-run-episode')).toBeTruthy()
    expect(screen.getByTestId('playback-pause-resume-slot')).toBeTruthy()
    expect(screen.getByTestId('playback-reset')).toBeTruthy()
  })

  it('2. RUNNING: Pause renders inside the shared slot, at a stable sibling position', () => {
    renderControls({ status: 'running' })
    const slot = screen.getByTestId('playback-pause-resume-slot')
    expect(within(slot).getByTestId('playback-pause')).toBeTruthy()
    // Exactly one button lives in the slot — never both at once.
    expect(within(slot).queryAllByRole('button')).toHaveLength(1)
    expect(slotIndexAmongSiblings()).toBe(3) // after Step, Run, Run Episode
  })

  it('3. PAUSED: Resume renders inside the same shared slot, at the same sibling position', () => {
    renderControls({ status: 'paused' })
    const slot = screen.getByTestId('playback-pause-resume-slot')
    expect(within(slot).getByTestId('playback-resume')).toBeTruthy()
    expect(within(slot).queryAllByRole('button')).toHaveLength(1)
    expect(slotIndexAmongSiblings()).toBe(3)
  })

  it('4. RUNNING -> PAUSED: the slot itself never moves, only its content swaps from Pause to Resume', () => {
    const { rerender, ...props } = renderControls({ status: 'running' })
    const indexWhileRunning = slotIndexAmongSiblings()
    const runButtonRectBefore = screen.getByTestId('playback-run').getBoundingClientRect()

    rerender(<PlaybackControls {...props} status="paused" />)

    expect(slotIndexAmongSiblings()).toBe(indexWhileRunning)
    expect(screen.queryByTestId('playback-pause')).toBeNull()
    expect(screen.getByTestId('playback-resume')).toBeTruthy()
    // Everything to the LEFT of the slot (Step/Run/Run Episode) is completely unaffected
    // by the swap — same DOM nodes, same layout box.
    const runButtonRectAfter = screen.getByTestId('playback-run').getBoundingClientRect()
    expect(runButtonRectAfter).toEqual(runButtonRectBefore)
  })

  it('5. PAUSED -> RUNNING: the slot itself never moves, only its content swaps from Resume back to Pause', () => {
    const { rerender, ...props } = renderControls({ status: 'paused' })
    const indexWhilePaused = slotIndexAmongSiblings()

    rerender(<PlaybackControls {...props} status="running" />)

    expect(slotIndexAmongSiblings()).toBe(indexWhilePaused)
    expect(screen.queryByTestId('playback-resume')).toBeNull()
    expect(screen.getByTestId('playback-pause')).toBeTruthy()
  })

  it('6. Pause/Resume text is correct in both English (default) and Korean', () => {
    const { rerender: rerenderKo } = render(
      <PlaybackControls
        status="running"
        onStep={vi.fn()}
        onRun={vi.fn()}
        onRunEpisode={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    expect(screen.getByTestId('playback-pause').textContent).toBe('Pause')

    rerenderKo(
      <PlaybackControls
        status="paused"
        onStep={vi.fn()}
        onRun={vi.fn()}
        onRunEpisode={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onReset={vi.fn()}
        t={translations.ko}
      />,
    )
    expect(screen.getByTestId('playback-resume').textContent).toBe('재개')

    rerenderKo(
      <PlaybackControls
        status="running"
        onStep={vi.fn()}
        onRun={vi.fn()}
        onRunEpisode={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onReset={vi.fn()}
        t={translations.ko}
      />,
    )
    expect(screen.getByTestId('playback-pause').textContent).toBe('일시정지')
  })
})

describe('PlaybackControls — Phase 15: Episode count input', () => {
  function countInput(): HTMLInputElement {
    return screen.getByTestId('episode-count-input') as HTMLInputElement
  }

  it('A. defaults to 1 when no episodeCount prop is given', () => {
    renderControls({ status: 'idle' })
    expect(countInput().value).toBe('1')
  })

  it('B1. changing the input to 5 reports 5 via onEpisodeCountChange', () => {
    const onEpisodeCountChange = vi.fn()
    renderControls({ status: 'idle', episodeCount: 1, onEpisodeCountChange })

    fireEvent.change(countInput(), { target: { value: '5' } })

    expect(onEpisodeCountChange).toHaveBeenCalledWith(5)
  })

  it.each(['0', '-1', '2.5', ''])('B2. invalid value %j is rejected (onEpisodeCountChange not called)', (invalid) => {
    const onEpisodeCountChange = vi.fn()
    renderControls({ status: 'idle', episodeCount: 3, onEpisodeCountChange })

    fireEvent.change(countInput(), { target: { value: invalid } })

    expect(onEpisodeCountChange).not.toHaveBeenCalled()
  })

  it('E. RUNNING: the episode count input is disabled', () => {
    renderControls({ status: 'running' })
    expect(countInput().disabled).toBe(true)
  })

  it('PAUSED: the episode count input is also disabled', () => {
    renderControls({ status: 'paused' })
    expect(countInput().disabled).toBe(true)
  })

  it('IDLE: the episode count input is enabled', () => {
    renderControls({ status: 'idle' })
    expect(countInput().disabled).toBe(false)
  })

  it('I. shows the translated label in English (default) and Korean', () => {
    const { rerender, ...props } = renderControls({ status: 'idle' })
    expect(screen.getByText('Episodes')).toBeTruthy()

    rerender(<PlaybackControls {...props} t={translations.ko} />)
    expect(screen.getByText('에피소드 수')).toBeTruthy()
  })

  it('adding the Episode count row does not add another item to the button row (Phase 14 stability preserved)', () => {
    renderControls({ status: 'idle' })
    const buttonRow = screen.getByTestId('playback-reset').parentElement!
    // Step, Run, Run Episode, the Pause/Resume slot, Reset — exactly 5, same as Phase 14.
    expect(buttonRow.children).toHaveLength(5)
    // The episode count input is a sibling of the button row, not inside it.
    expect(within(buttonRow).queryByTestId('episode-count-input')).toBeNull()
  })
})
