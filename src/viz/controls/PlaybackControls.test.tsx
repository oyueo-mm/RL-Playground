// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EngineStatus } from '../../core/engine/types'
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
  render(<PlaybackControls {...props} />)
  return props
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

  it('IDLE: Step/Run/Run Episode are enabled, Pause/Resume are disabled', () => {
    renderControls({ status: 'idle' })
    expect(isDisabled(screen.getByTestId('playback-step'))).toBe(false)
    expect(isDisabled(screen.getByTestId('playback-run'))).toBe(false)
    expect(isDisabled(screen.getByTestId('playback-run-episode'))).toBe(false)
    expect(isDisabled(screen.getByTestId('playback-pause'))).toBe(true)
    expect(isDisabled(screen.getByTestId('playback-resume'))).toBe(true)
  })

  it('RUNNING: Step/Run/Run Episode are disabled (no duplicate execution), only Pause is enabled', () => {
    renderControls({ status: 'running' })
    expect(isDisabled(screen.getByTestId('playback-step'))).toBe(true)
    expect(isDisabled(screen.getByTestId('playback-run'))).toBe(true)
    expect(isDisabled(screen.getByTestId('playback-run-episode'))).toBe(true)
    expect(isDisabled(screen.getByTestId('playback-pause'))).toBe(false)
    expect(isDisabled(screen.getByTestId('playback-resume'))).toBe(true)
  })

  it('PAUSED: Step/Run/Run Episode/Pause are disabled, only Resume is enabled', () => {
    renderControls({ status: 'paused' })
    expect(isDisabled(screen.getByTestId('playback-step'))).toBe(true)
    expect(isDisabled(screen.getByTestId('playback-run'))).toBe(true)
    expect(isDisabled(screen.getByTestId('playback-run-episode'))).toBe(true)
    expect(isDisabled(screen.getByTestId('playback-pause'))).toBe(true)
    expect(isDisabled(screen.getByTestId('playback-resume'))).toBe(false)
  })

  it('clicking a disabled button never calls its handler (RUNNING: Step is disabled)', () => {
    const { onStep } = renderControls({ status: 'running' })
    fireEvent.click(screen.getByTestId('playback-step'))
    expect(onStep).not.toHaveBeenCalled()
  })
})
