import { GridWorldEnv } from '../core/environments/gridworld/GridWorldEnv'
import { draftToGridWorldConfig } from '../viz/controls/envEditorDraft'
import { ENVIRONMENT_PRESETS, type EnvironmentPreset } from '../data/presets/manifest'

export class ShuffleBag {
  private pending: string[] = []
  private ids: string[]
  private random: () => number
  constructor(ids: string[], random: () => number = Math.random) { this.ids = ids; this.random = random }
  next(active: Set<string>): string {
    if (!this.pending.some(id => !active.has(id))) {
      // Carry-over cards are already visible in the new cycle. Queue every other map.
      this.pending = this.ids.filter(id => !active.has(id))
      for (let i = this.pending.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [this.pending[i], this.pending[j]] = [this.pending[j], this.pending[i]] }
    }
    const index = this.pending.findIndex(id => !active.has(id))
    if (index < 0) throw new Error('No distinct preset available')
    return this.pending.splice(index, 1)[0]
  }
}
export const demoInterval = (steps: number) => Math.max(80, Math.min(450, 12000 / Math.max(1, steps)))
export const DEMO_EVENT_HOLD = 260
export const DEMO_SUCCESS_HOLD = 1100
export interface DemoView { preset: EnvironmentPreset; step: number; done: boolean; model: ReturnType<GridWorldEnv['getRenderModel']>; teleport: boolean; trail: string[] }
interface Slot { env: GridWorldEnv; due: number; view: DemoView }
export class DemoPlayback {
  private bag: ShuffleBag
  private slots: Slot[] = []
  constructor(random: () => number = Math.random, now = 0) {
    this.bag = new ShuffleBag(ENVIRONMENT_PRESETS.map(p => p.id), random)
    for (let i = 0; i < 4; i++) this.slots.push(this.create(this.bag.next(new Set(this.slots.map(s => s.view.preset.id))), now))
  }
  private create(id: string, now: number): Slot {
    const preset = ENVIRONMENT_PRESETS.find(p => p.id === id)!
    const env = new GridWorldEnv(draftToGridWorldConfig(preset.draft))
    return { env, due: now + demoInterval(preset.solution.length), view: { preset, step: 0, done: false, model: env.getRenderModel(), teleport: false, trail: [env.getRenderModel().agentPos] } }
  }
  views() { return this.slots.map(slot => slot.view) }
  shuffle(now: number) {
    const excluded = new Set(this.slots.map(slot => slot.view.preset.id))
    this.slots = Array.from({ length: 4 }, () => { const id = this.bag.next(excluded); excluded.add(id); return this.create(id, now) })
  }
  tick(now: number, force = false): boolean {
    let changed = false
    for (let index = 0; index < this.slots.length; index++) {
      const slot = this.slots[index]
      if (!force && now < slot.due) continue
      changed = true
      if (slot.view.done) { this.slots[index] = this.create(this.bag.next(new Set(this.slots.map(s => s.view.preset.id))), now); continue }
      const previous = slot.view.model, result = slot.env.step(slot.view.preset.solution[slot.view.step]), model = slot.env.getRenderModel()
      const [x,y] = previous.agentPos.split(',').map(Number), [a,b] = model.agentPos.split(',').map(Number)
      const teleport = Math.abs(x-a) + Math.abs(y-b) > 1
      const event = teleport || model.goals.length !== previous.goals.length || model.collapsedFragiles?.length !== previous.collapsedFragiles?.length || JSON.stringify(model.openGroups) !== JSON.stringify(previous.openGroups)
      slot.due = now + (result.done ? DEMO_SUCCESS_HOLD : demoInterval(slot.view.preset.solution.length) + (event ? DEMO_EVENT_HOLD : 0))
      slot.view = { ...slot.view, step: slot.view.step + 1, done: result.done, model, teleport, trail: [...slot.view.trail, model.agentPos] }
    }
    return changed
  }
}
