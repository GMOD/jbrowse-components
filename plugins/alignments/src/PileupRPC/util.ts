import type { ReducedFeature } from '../shared/fetchChains'

export function getInsertSizeStats(features: ReducedFeature[]) {
  const filtered = features.map(f => Math.abs(f.tlen))
  const sum = filtered.reduce((a, b) => a + b, 0)
  const sum2 = filtered.map(a => a * a).reduce((a, b) => a + b, 0)
  const total = filtered.length
  const avg = sum / total
  const sd = Math.sqrt((total * sum2 - sum * sum) / (total * total))
  const upper = avg + 4 * sd
  const lower = avg - 3 * sd
  return { upper, lower, avg, sd }
}

export function filterForPairs(features: ReducedFeature[]) {
  return features.filter(
    f => f.flags & 2 && !(f.flags & 256) && !(f.flags & 2048),
  )
}
