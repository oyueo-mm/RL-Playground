// Single, stable SimulationEngine instance for the app. Created once at module load
// (not inside a component's render), so React re-renders never spawn a new Engine.
// Uses the Environment/Algorithm registries' defaults (GridWorld + Q-Learning) via
// SimulationEngine's own constructor, per Phase 1~2's API — no new wiring here.

import { SimulationEngine } from '../core/engine/SimulationEngine'

export const engine = new SimulationEngine()
