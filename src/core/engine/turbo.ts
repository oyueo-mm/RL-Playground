/** Summary-only UI contract: no Q vectors, trajectories or grid model transfers. */
export interface TurboProgress {
  state: 'running' | 'paused' | 'completed' | 'stopped'
  active: boolean
  completedEpisodes: number
  targetEpisodes: number
  progress: number
  totalSteps: number
  successes: number
  successRate: number
  elapsedMs: number
  stepsPerSecond: number
  episodesPerSecond: number
  recentEpisodes: number
  recentMeanReward: number
  recentSuccessRate: number
}

export interface TurboRunState {
  state: TurboProgress['state']
  startEpisode: number
  startSteps: number
  startSuccesses: number
  targetEpisodes: number
  elapsedMs: number
  activeSince: number
}
