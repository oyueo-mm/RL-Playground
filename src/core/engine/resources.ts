export interface ResourceBudget {
  maxQStates: number
  maxRecordedSteps: number
  maxEpisodeSteps: number
  maxDetailedEpisodes?: number
}
/** Configurable soft budgets (maxQStates caps lazily-created Q rows; nothing is preallocated); see measured browser costs in COMPLEX_ENVIRONMENT_UPGRADE.md. */
export const DEFAULT_RESOURCE_BUDGET: ResourceBudget = { maxQStates: 1_000_000, maxRecordedSteps: 500_000, maxEpisodeSteps: 10_000, maxDetailedEpisodes: 100 }
export type ResourcePauseReason = 'q-states' | 'recorded-steps' | null
export interface ResourceMetrics {
  qStates: number
  qStateGrowth: number
  qVersion: number
  estimatedQBytes: number
  totalSteps: number
  completedEpisodes: number
  episodeSteps: number
  recordedSteps: number
  stepsPerSecond: number
  uiUpdatesPerSecond: number
  pauseReason: ResourcePauseReason
  level: 'normal' | 'warning' | 'high'
  budget: ResourceBudget
  lifetime?: { exploration: number; exploitation: number; reasons: Record<string, number> }
}
