import { sum } from '@jbrowse/core/util'

import type { ReducedFeature } from './types'

export function getInsertSizeStats(filtered: number[]) {
  const len = filtered.length
  const s = sum(filtered)
  let sumSquared = 0
  for (let i = 0; i < len; i++) {
    const elt = filtered[i]!
    sumSquared += elt * elt
  }
  const avg = s / len
  const sd = Math.sqrt((len * sumSquared - s * s) / (len * len))
  const upper = avg + 3 * sd
  const lower = avg - 3 * sd
  return {
    upper,
    lower,
    avg,
    sd,
  }
}

export function filterForPairs(features: ReducedFeature[]) {
  return features.filter(
    f => f.flags & 2 && !(f.flags & 256) && !(f.flags & 2048),
  )
}
