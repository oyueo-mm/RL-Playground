const episodeDefaults: Readonly<Record<string, number>> = {
  'very-easy':100, easy:250, medium:500, hard:1000, 'very-hard':2000,
}

/** Official difficulty metadata only. Custom/unknown environments retain 250. */
export function defaultEpisodesForDifficulty(difficulty?: string): number {
  return difficulty && Object.hasOwn(episodeDefaults, difficulty) ? episodeDefaults[difficulty] : 250
}
