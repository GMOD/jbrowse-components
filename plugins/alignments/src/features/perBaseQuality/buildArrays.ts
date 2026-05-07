import type { PerBaseQualityEntry } from './types.ts'

export function buildPerBaseQualityArrays(
  entries: PerBaseQualityEntry[],
  getReadIndex: (id: string) => number,
) {
  const n = entries.length
  const perBaseQualPositions = new Uint32Array(n)
  const perBaseQualYs = new Uint16Array(n)
  const perBaseQualScores = new Uint8Array(n)
  const perBaseQualReadIndices = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    const e = entries[i]!
    perBaseQualPositions[i] = e.position
    perBaseQualScores[i] = e.score
    perBaseQualReadIndices[i] = getReadIndex(e.featureId)
  }
  return {
    perBaseQualPositions,
    perBaseQualYs,
    perBaseQualScores,
    perBaseQualReadIndices,
  }
}
