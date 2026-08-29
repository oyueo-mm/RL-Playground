// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EnvRenderModel } from '../../core/types/render'
import { EnvEditor } from './EnvEditor'
import { draftToGridWorldConfig, validateDraft, type GridEditorDraft } from './envEditorDraft'

afterEach(cleanup)

const baseRenderModel: Extract<EnvRenderModel, { kind: 'grid' }> = {
  kind: 'grid',
  width: 5,
  height: 5,
  walls: ['1,1'],
  bombs: [],
  bombPenalty: -10,
  stepReward: -0.1,
  wallPenalty: -0.1,
  goalReward: 10,
  start: '0,0',
  goals: ['4,4'],
  agentPos: '0,0',
}

function renderEditor(overrides: Partial<Parameters<typeof EnvEditor>[0]> = {}) {
  const onApply = vi.fn()
  const confirmApply = vi.fn(() => true)
  render(
    <EnvEditor currentRenderModel={baseRenderModel} onApply={onApply} confirmApply={confirmApply} {...overrides} />,
  )
  return { onApply, confirmApply }
}

function draft(overrides: Partial<GridEditorDraft> = {}): GridEditorDraft {
  return {
    width: 5,
    height: 5,
    start: { x: 0, y: 0 },
    goals: [{ x: 4, y: 4 }],
    walls: [],
    bombs: [],
    stepReward: -0.1,
    wallPenalty: -0.1,
    goalReward: 10,
    bombPenalty: -10,
    ...overrides,
  }
}

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('EnvEditor — Grid size', () => {
  it('reflects a Width input change in the Draft grid (Apply config carries it through)', () => {
    const { onApply } = renderEditor()
    fireEvent.change(screen.getByTestId('env-editor-width-input'), { target: { value: '8' } })

    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply.mock.calls[0][0].width).toBe(8)
  })

  it('reflects a Height input change through to Apply', () => {
    const { onApply } = renderEditor()
    fireEvent.change(screen.getByTestId('env-editor-height-input'), { target: { value: '9' } })

    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(onApply.mock.calls[0][0].height).toBe(9)
  })

  it('rejects an out-of-range width (Apply button disabled, onApply never called)', () => {
    const { onApply } = renderEditor()
    fireEvent.change(screen.getByTestId('env-editor-width-input'), { target: { value: '1' } })

    expect(screen.getByTestId('env-editor-errors')).toBeTruthy()
    fireEvent.click(screen.getByTestId('env-editor-apply'))
    expect(onApply).not.toHaveBeenCalled()
  })

  // Phase 10 §5: shrinking the grid must silently drop walls that fall outside the new
  // bounds (Phase 7 §7's documented policy), rather than leaving a stale wall reference
  // that would make the resulting Draft invalid and block Apply for no visible reason.
  it('shrinking the width drops walls that fall outside the new bounds', () => {
    const wideModel: Extract<EnvRenderModel, { kind: 'grid' }> = {
      kind: 'grid',
      width: 10,
      height: 10,
      walls: ['7,7'],
      bombs: [],
      bombPenalty: -10,
      stepReward: -0.1,
      wallPenalty: -0.1,
      goalReward: 10,
      start: '0,0',
      goals: ['9,9'],
      agentPos: '0,0',
    }
    const { onApply } = renderEditor({ currentRenderModel: wideModel })

    fireEvent.change(screen.getByTestId('env-editor-width-input'), { target: { value: '5' } })
    fireEvent.change(screen.getByTestId('env-editor-height-input'), { target: { value: '5' } })
    // Goal (9,9) is now out of bounds too — move it in-bounds so only the wall-drop
    // behavior is under test here (Goal-range validation is covered elsewhere).
    fireEvent.click(screen.getByTestId('env-editor-mode-goal'))
    fireEvent.click(within(screen.getByTestId('env-editor-grid')).getByTestId('cell-3,3'))

    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onApply.mock.calls[0][0].walls).toEqual([])
  })
})

describe('EnvEditor — Wall editing', () => {
  it('clicking an empty cell in Wall mode adds a wall', () => {
    const { onApply } = renderEditor()
    const grid = within(screen.getByTestId('env-editor-grid'))

    fireEvent.click(grid.getByTestId('cell-2,2'))
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    const walls = onApply.mock.calls[0][0].walls
    expect(walls).toContainEqual({ x: 2, y: 2 })
  })

  it('clicking an existing wall in Wall mode removes it', () => {
    const { onApply } = renderEditor()
    const grid = within(screen.getByTestId('env-editor-grid'))

    // baseRenderModel already has a wall at 1,1
    fireEvent.click(grid.getByTestId('cell-1,1'))
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    const walls = onApply.mock.calls[0][0].walls
    expect(walls).not.toContainEqual({ x: 1, y: 1 })
  })

  it('clicking the Start cell in Wall mode does not add a wall there', () => {
    const { onApply } = renderEditor()
    const grid = within(screen.getByTestId('env-editor-grid'))

    fireEvent.click(grid.getByTestId('cell-0,0')) // Start cell
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    const walls = onApply.mock.calls[0][0].walls
    expect(walls).not.toContainEqual({ x: 0, y: 0 })
  })

  it('clicking the Goal cell in Wall mode does not add a wall there', () => {
    const { onApply } = renderEditor()
    const grid = within(screen.getByTestId('env-editor-grid'))

    fireEvent.click(grid.getByTestId('cell-4,4')) // Goal cell
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    const walls = onApply.mock.calls[0][0].walls
    expect(walls).not.toContainEqual({ x: 4, y: 4 })
  })
})

describe('EnvEditor — Phase 20: Bomb editing', () => {
  it('clicking an empty cell in Bomb mode adds a bomb', () => {
    const { onApply } = renderEditor()
    fireEvent.click(screen.getByTestId('env-editor-mode-bomb'))
    const grid = within(screen.getByTestId('env-editor-grid'))

    fireEvent.click(grid.getByTestId('cell-3,3'))
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(onApply.mock.calls[0][0].bombs).toContainEqual({ x: 3, y: 3 })
  })

  it('clicking an existing bomb in Bomb mode removes it', () => {
    const { onApply } = renderEditor()
    fireEvent.click(screen.getByTestId('env-editor-mode-bomb'))
    const grid = within(screen.getByTestId('env-editor-grid'))

    fireEvent.click(grid.getByTestId('cell-3,3')) // add
    fireEvent.click(grid.getByTestId('cell-3,3')) // remove
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(onApply.mock.calls[0][0].bombs).not.toContainEqual({ x: 3, y: 3 })
  })

  it('clicking the Start cell in Bomb mode does not place a bomb there', () => {
    const { onApply } = renderEditor()
    fireEvent.click(screen.getByTestId('env-editor-mode-bomb'))
    const grid = within(screen.getByTestId('env-editor-grid'))

    fireEvent.click(grid.getByTestId('cell-0,0')) // Start cell
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(onApply.mock.calls[0][0].bombs).not.toContainEqual({ x: 0, y: 0 })
  })

  it('clicking the Goal cell in Bomb mode does not place a bomb there', () => {
    const { onApply } = renderEditor()
    fireEvent.click(screen.getByTestId('env-editor-mode-bomb'))
    const grid = within(screen.getByTestId('env-editor-grid'))

    fireEvent.click(grid.getByTestId('cell-4,4')) // Goal cell
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(onApply.mock.calls[0][0].bombs).not.toContainEqual({ x: 4, y: 4 })
  })

  it('placing a Bomb on an existing Wall removes the Wall (Wall+Bomb can never coexist)', () => {
    const { onApply } = renderEditor()
    fireEvent.click(screen.getByTestId('env-editor-mode-bomb'))
    const grid = within(screen.getByTestId('env-editor-grid'))

    fireEvent.click(grid.getByTestId('cell-1,1')) // pre-existing wall cell (baseRenderModel)
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    const config = onApply.mock.calls[0][0]
    expect(config.bombs).toContainEqual({ x: 1, y: 1 })
    expect(config.walls).not.toContainEqual({ x: 1, y: 1 })
  })

  it('placing a Wall on an existing Bomb removes the Bomb (the other direction of the same rule)', () => {
    const { onApply } = renderEditor()
    fireEvent.click(screen.getByTestId('env-editor-mode-bomb'))
    const grid = within(screen.getByTestId('env-editor-grid'))
    fireEvent.click(grid.getByTestId('cell-3,3')) // place a bomb first

    fireEvent.click(screen.getByTestId('env-editor-mode-wall'))
    fireEvent.click(grid.getByTestId('cell-3,3')) // now wall it

    fireEvent.click(screen.getByTestId('env-editor-apply'))

    const config = onApply.mock.calls[0][0]
    expect(config.walls).toContainEqual({ x: 3, y: 3 })
    expect(config.bombs).not.toContainEqual({ x: 3, y: 3 })
  })

  it('moving Start onto a bombed cell clears the bomb there (Start can never be a bomb)', () => {
    const { onApply } = renderEditor()
    fireEvent.click(screen.getByTestId('env-editor-mode-bomb'))
    const grid = within(screen.getByTestId('env-editor-grid'))
    fireEvent.click(grid.getByTestId('cell-2,2')) // place a bomb

    fireEvent.click(screen.getByTestId('env-editor-mode-start'))
    fireEvent.click(grid.getByTestId('cell-2,2'))

    fireEvent.click(screen.getByTestId('env-editor-apply'))

    const config = onApply.mock.calls[0][0]
    expect(config.start).toEqual({ x: 2, y: 2 })
    expect(config.bombs).not.toContainEqual({ x: 2, y: 2 })
  })

  it('shrinking the grid drops bombs that fall outside the new bounds, same policy as walls', () => {
    const { onApply } = renderEditor()
    fireEvent.click(screen.getByTestId('env-editor-mode-bomb'))
    const grid = within(screen.getByTestId('env-editor-grid'))
    fireEvent.click(grid.getByTestId('cell-4,4')) // Goal cell — can't bomb it, pick another
    fireEvent.click(grid.getByTestId('cell-3,3')) // in-range for now

    fireEvent.change(screen.getByTestId('env-editor-width-input'), { target: { value: '3' } })
    fireEvent.change(screen.getByTestId('env-editor-height-input'), { target: { value: '3' } })
    fireEvent.click(screen.getByTestId('env-editor-mode-goal'))
    fireEvent.click(within(screen.getByTestId('env-editor-grid')).getByTestId('cell-2,2')) // move Goal in-bounds

    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(onApply.mock.calls[0][0].bombs).toEqual([])
  })

  it('the Bomb penalty input value is carried through to Apply', () => {
    const { onApply } = renderEditor()
    fireEvent.change(screen.getByTestId('env-editor-bomb-penalty-input'), { target: { value: '-42' } })

    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(onApply.mock.calls[0][0].bombPenalty).toBe(-42)
  })

})

describe('EnvEditor — Start mode', () => {
  it('clicking a cell in Start mode moves Start there and clears the old Start', () => {
    const { onApply } = renderEditor()
    fireEvent.click(screen.getByTestId('env-editor-mode-start'))
    const grid = within(screen.getByTestId('env-editor-grid'))

    fireEvent.click(grid.getByTestId('cell-2,3'))
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    const config = onApply.mock.calls[0][0]
    expect(config.start).toEqual({ x: 2, y: 3 })
  })

  it('moving Start onto a walled cell clears the wall there (Start can never be a wall)', () => {
    const { onApply } = renderEditor()
    fireEvent.click(screen.getByTestId('env-editor-mode-start'))
    const grid = within(screen.getByTestId('env-editor-grid'))

    fireEvent.click(grid.getByTestId('cell-1,1')) // pre-existing wall cell
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    const config = onApply.mock.calls[0][0]
    expect(config.start).toEqual({ x: 1, y: 1 })
    expect(config.walls).not.toContainEqual({ x: 1, y: 1 })
  })
})

describe('EnvEditor — Goal mode (Phase 30: toggle add/remove, same pattern as Bomb mode)', () => {
  it('clicking an empty cell in Goal mode adds a second Goal (does not replace the first)', () => {
    const { onApply } = renderEditor()
    fireEvent.click(screen.getByTestId('env-editor-mode-goal'))
    const grid = within(screen.getByTestId('env-editor-grid'))

    fireEvent.click(grid.getByTestId('cell-3,2'))
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    const config = onApply.mock.calls[0][0]
    expect(config.goals).toContainEqual({ x: 3, y: 2 })
    expect(config.goals).toContainEqual({ x: 4, y: 4 }) // baseRenderModel's original Goal
  })

  it('clicking an existing Goal cell in Goal mode removes it', () => {
    const { onApply } = renderEditor()
    fireEvent.click(screen.getByTestId('env-editor-mode-goal'))
    const grid = within(screen.getByTestId('env-editor-grid'))

    fireEvent.click(grid.getByTestId('cell-3,2')) // add a second Goal first
    fireEvent.click(grid.getByTestId('cell-4,4')) // remove the original Goal
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    const config = onApply.mock.calls[0][0]
    expect(config.goals).toEqual([{ x: 3, y: 2 }])
  })

  it('clicking the Start cell in Goal mode does not place a Goal there', () => {
    const { onApply } = renderEditor()
    fireEvent.click(screen.getByTestId('env-editor-mode-goal'))
    const grid = within(screen.getByTestId('env-editor-grid'))

    fireEvent.click(grid.getByTestId('cell-0,0')) // Start cell
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    expect(onApply.mock.calls[0][0].goals).not.toContainEqual({ x: 0, y: 0 })
  })

  it('placing a Goal on an existing Wall removes the Wall (Wall+Goal can never coexist)', () => {
    const { onApply } = renderEditor()
    fireEvent.click(screen.getByTestId('env-editor-mode-goal'))
    const grid = within(screen.getByTestId('env-editor-grid'))

    fireEvent.click(grid.getByTestId('cell-1,1')) // pre-existing wall cell (baseRenderModel)
    fireEvent.click(screen.getByTestId('env-editor-apply'))

    const config = onApply.mock.calls[0][0]
    expect(config.goals).toContainEqual({ x: 1, y: 1 })
    expect(config.walls).not.toContainEqual({ x: 1, y: 1 })
  })
})

describe('validateDraft (pure function)', () => {
  it('rejects start === goal', () => {
    const errors = validateDraft(draft({ start: { x: 1, y: 1 }, goals: [{ x: 1, y: 1 }] }))
    expect(errors).toContain('Start and Goal cannot be the same cell.')
  })

  it('rejects a Start that sits on a wall', () => {
    const errors = validateDraft(draft({ start: { x: 1, y: 1 }, walls: [{ x: 1, y: 1 }] }))
    expect(errors).toContain('Start cannot be a wall.')
  })

  it('rejects a Goal that sits on a wall', () => {
    const errors = validateDraft(draft({ goals: [{ x: 4, y: 4 }], walls: [{ x: 4, y: 4 }] }))
    expect(errors).toContain('Goal cannot be a wall.')
  })

  it('rejects an out-of-range Start/Goal coordinate', () => {
    const errors = validateDraft(draft({ start: { x: 10, y: 10 } }))
    expect(errors).toContain('Start is outside the grid.')
  })

  it('rejects an invalid width/height', () => {
    expect(validateDraft(draft({ width: 0 })).length).toBeGreaterThan(0)
    expect(validateDraft(draft({ width: 100 })).length).toBeGreaterThan(0)
    expect(validateDraft(draft({ height: -1 })).length).toBeGreaterThan(0)
  })

  // Phase 10 §5 boundary audit: the exact allowed range (3~20, PRODUCT_SPEC.md FR-4) was
  // only exercised with far-out-of-range values above — pin the exact edges too.
  it('accepts the minimum allowed size (3) and rejects one below it (2)', () => {
    expect(validateDraft(draft({ width: 3, height: 3, start: { x: 0, y: 0 }, goals: [{ x: 2, y: 2 }] }))).toEqual([])
    expect(validateDraft(draft({ width: 2 })).length).toBeGreaterThan(0)
    expect(validateDraft(draft({ height: 2 })).length).toBeGreaterThan(0)
  })

  it('accepts the maximum allowed size (20) and rejects one above it (21)', () => {
    expect(
      validateDraft(draft({ width: 20, height: 20, start: { x: 0, y: 0 }, goals: [{ x: 19, y: 19 }] })),
    ).toEqual([])
    expect(validateDraft(draft({ width: 21 })).length).toBeGreaterThan(0)
    expect(validateDraft(draft({ height: 21 })).length).toBeGreaterThan(0)
  })

  it('accepts a valid draft (no errors)', () => {
    expect(validateDraft(draft())).toEqual([])
  })

  // Phase 30 §6/§7 — Multiple Goals.
  it('rejects a draft with zero Goals', () => {
    expect(validateDraft(draft({ goals: [] }))).toContain('At least one Goal is required.')
  })

  it('accepts a draft with 2 or 3 Goals', () => {
    expect(validateDraft(draft({ goals: [{ x: 4, y: 4 }, { x: 3, y: 0 }] }))).toEqual([])
    expect(validateDraft(draft({ goals: [{ x: 4, y: 4 }, { x: 3, y: 0 }, { x: 0, y: 3 }] }))).toEqual([])
  })

  it('rejects an out-of-range Goal among several valid ones', () => {
    const errors = validateDraft(draft({ goals: [{ x: 4, y: 4 }, { x: 99, y: 99 }] }))
    expect(errors).toContain('One or more Goals are outside the grid.')
  })

  it('rejects a non-finite Step/Wall/Goal reward', () => {
    expect(validateDraft(draft({ stepReward: NaN }))).toContain('Step reward must be a number.')
    expect(validateDraft(draft({ wallPenalty: Infinity }))).toContain('Wall penalty must be a number.')
    expect(validateDraft(draft({ goalReward: NaN }))).toContain('Goal reward must be a number.')
  })
})

describe('draftToGridWorldConfig (pure function)', () => {
  it('carries width/height/start/goals/walls through unchanged', () => {
    const d = draft({ walls: [{ x: 2, y: 2 }] })
    const config = draftToGridWorldConfig(d)
    expect(config.width).toBe(d.width)
    expect(config.height).toBe(d.height)
    expect(config.start).toEqual(d.start)
    expect(config.goals).toEqual(d.goals)
    expect(config.walls).toEqual(d.walls)
  })

  // Phase 30 — unlike Phase 7-29 (where stepReward/goalReward/terminalCells were never
  // exposed by the Editor and always carried forward from the environment default),
  // stepReward/wallPenalty/goalReward/bombPenalty are now ALL Draft-owned fields the user
  // edits directly, so they must pass through unchanged; only terminalCells (still not
  // user-editable, Post-MVP FR-9) keeps falling back to the environment default.
  it('carries stepReward/wallPenalty/goalReward/bombPenalty through unchanged', () => {
    const d = draft({ stepReward: -0.3, wallPenalty: -2, goalReward: 25, bombPenalty: -25 })
    const config = draftToGridWorldConfig(d)
    expect(config.stepReward).toBe(-0.3)
    expect(config.wallPenalty).toBe(-2)
    expect(config.goalReward).toBe(25)
    expect(config.bombPenalty).toBe(-25)
  })

  it('fills in terminalCells from the environment default', () => {
    const config = draftToGridWorldConfig(draft())
    expect(config.terminalCells).toEqual([])
  })

  it('carries bombs through unchanged', () => {
    const d = draft({ bombs: [{ x: 1, y: 1 }] })
    const config = draftToGridWorldConfig(d)
    expect(config.bombs).toEqual([{ x: 1, y: 1 }])
  })
})

describe('validateDraft — Phase 20: Bomb collisions', () => {
  it('rejects a Start that sits on a bomb', () => {
    const errors = validateDraft(draft({ start: { x: 1, y: 1 }, bombs: [{ x: 1, y: 1 }] }))
    expect(errors).toContain('Start cannot be a bomb.')
  })

  it('rejects a Goal that sits on a bomb', () => {
    const errors = validateDraft(draft({ goals: [{ x: 4, y: 4 }], bombs: [{ x: 4, y: 4 }] }))
    expect(errors).toContain('Goal cannot be a bomb.')
  })

  it('rejects an out-of-range bomb coordinate', () => {
    const errors = validateDraft(draft({ bombs: [{ x: 99, y: 99 }] }))
    expect(errors).toContain('One or more bombs are outside the grid.')
  })

  it('accepts a valid draft with a bomb that does not collide with anything', () => {
    expect(validateDraft(draft({ bombs: [{ x: 2, y: 2 }] }))).toEqual([])
  })

  it('rejects a non-finite Bomb penalty', () => {
    expect(validateDraft(draft({ bombPenalty: NaN }))).toContain('Bomb penalty must be a number.')
    expect(validateDraft(draft({ bombPenalty: Infinity }))).toContain('Bomb penalty must be a number.')
  })

  it('accepts a positive or zero Bomb penalty (an unusual choice, but not an invalid one)', () => {
    expect(validateDraft(draft({ bombPenalty: 0 }))).toEqual([])
    expect(validateDraft(draft({ bombPenalty: 5 }))).toEqual([])
  })
})

// Phase 30 §3/§5 — Step Reward / Wall Penalty / Goal Reward number inputs.
describe('EnvEditor — Reward inputs (Phase 30)', () => {
  it('the Step Reward input value is carried through to Apply', () => {
    const { onApply } = renderEditor()
    fireEvent.change(screen.getByTestId('env-editor-step-reward-input'), { target: { value: '-0.5' } })
    fireEvent.click(screen.getByTestId('env-editor-apply'))
    expect(onApply.mock.calls[0][0].stepReward).toBe(-0.5)
  })

  it('the Wall Penalty input value is carried through to Apply, independent of Step Reward', () => {
    const { onApply } = renderEditor()
    fireEvent.change(screen.getByTestId('env-editor-step-reward-input'), { target: { value: '-0.1' } })
    fireEvent.change(screen.getByTestId('env-editor-wall-penalty-input'), { target: { value: '-3' } })
    fireEvent.click(screen.getByTestId('env-editor-apply'))
    const config = onApply.mock.calls[0][0]
    expect(config.stepReward).toBe(-0.1)
    expect(config.wallPenalty).toBe(-3)
  })

  it('the Goal Reward input value is carried through to Apply', () => {
    const { onApply } = renderEditor()
    fireEvent.change(screen.getByTestId('env-editor-goal-reward-input'), { target: { value: '20' } })
    fireEvent.click(screen.getByTestId('env-editor-apply'))
    expect(onApply.mock.calls[0][0].goalReward).toBe(20)
  })
})

// Phase 30 §16-21 — Environment Presets.
describe('EnvEditor — Environment Presets (Phase 30)', () => {
  it('starts on "Custom" (the live environment\'s own Draft, not a Preset)', () => {
    renderEditor()
    expect((screen.getByTestId('env-editor-preset-select') as HTMLSelectElement).value).toBe('custom')
  })

  it('selecting a Preset changes only the Draft — no onApply call happens', () => {
    const { onApply } = renderEditor()
    fireEvent.change(screen.getByTestId('env-editor-preset-select'), { target: { value: 'corridor' } })
    expect(onApply).not.toHaveBeenCalled()
  })

  it('selecting a Preset then Apply applies that Preset\'s Environment', () => {
    const { onApply } = renderEditor()
    fireEvent.change(screen.getByTestId('env-editor-preset-select'), { target: { value: 'corridor' } })
    fireEvent.click(screen.getByTestId('env-editor-apply'))
    const config = onApply.mock.calls[0][0]
    expect(config.width).toBe(7)
    expect(config.height).toBe(3)
  })

  it('every built-in Preset passes validateDraft() (no errors) as loaded, before any further edit', () => {
    const { onApply } = renderEditor()
    for (const id of ['corridor', 'maze', 'bombField', 'multiGoal', 'treasureHunt']) {
      fireEvent.change(screen.getByTestId('env-editor-preset-select'), { target: { value: id } })
      expect(screen.queryByTestId('env-editor-errors')).toBeNull()
    }
    // Sanity check the Apply flow still works normally after cycling through every Preset.
    fireEvent.click(screen.getByTestId('env-editor-apply'))
    expect(onApply).toHaveBeenCalledTimes(1)
  })

  it('a Preset can be freely edited further before Apply (it is a template, not locked)', () => {
    const { onApply } = renderEditor()
    fireEvent.change(screen.getByTestId('env-editor-preset-select'), { target: { value: 'corridor' } })
    fireEvent.click(screen.getByTestId('env-editor-mode-bomb'))
    fireEvent.click(within(screen.getByTestId('env-editor-grid')).getByTestId('cell-3,0'))
    fireEvent.click(screen.getByTestId('env-editor-apply'))
    expect(onApply.mock.calls[0][0].bombs).toContainEqual({ x: 3, y: 0 })
  })

  it('applying a Preset does not change any Algorithm selection state (Preset is Environment-only)', () => {
    // EnvEditor has no Algorithm prop/state at all — applying a Preset can only ever call
    // onApply(config); it has no way to touch Algorithm selection, by construction.
    const { onApply } = renderEditor()
    fireEvent.change(screen.getByTestId('env-editor-preset-select'), { target: { value: 'maze' } })
    fireEvent.click(screen.getByTestId('env-editor-apply'))
    expect(Object.keys(onApply.mock.calls[0][0])).not.toContain('algorithmId')
  })
})
