import type { PerBaseLetterEntry } from './types.ts'

export function buildPerBaseLetterArrays(
  entries: PerBaseLetterEntry[],
  getReadIndex: (id: string) => number,
) {
  const n = entries.length
  const perBaseLetterPositions = new Uint32Array(n)
  const perBaseLetterYs = new Uint16Array(n)
  const perBaseLetterBases = new Uint8Array(n)
  const perBaseLetterReadIndices = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    const e = entries[i]!
    perBaseLetterPositions[i] = e.position
    perBaseLetterBases[i] = e.base
    perBaseLetterReadIndices[i] = getReadIndex(e.featureId)
  }
  return {
    perBaseLetterPositions,
    perBaseLetterYs,
    perBaseLetterBases,
    perBaseLetterReadIndices,
  }
}
