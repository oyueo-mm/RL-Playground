export const calculateUpdate = (q: number, reward: number, alpha: number, gamma: number, next: number, terminal: boolean) => {
  const target = reward + (terminal ? 0 : gamma * next)
  const error = target - q
  return { target, error, updated: q + alpha * error }
}
