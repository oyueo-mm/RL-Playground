const episodeDefaults: Readonly<Record<string, number>> = {
  'very-easy':500, easy:1000, medium:2000, hard:3000, 'very-hard':5000,
}

/** Official difficulty metadata only. Custom/unknown environments retain 250. */
export function defaultEpisodesForDifficulty(difficulty?: string): number {
  return difficulty && Object.hasOwn(episodeDefaults, difficulty) ? episodeDefaults[difficulty] : 250
}
