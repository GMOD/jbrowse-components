import { packAbgr } from '@jbrowse/core/util/colorBits'

import type { ModificationEntry } from '../../shared/webglRpcTypes.ts'

export function buildModificationArrays(
  modifications: ModificationEntry[],
  regionStart: number,
  getReadIndex: (featureId: string) => number,
  detectedModifications?: Set<string> | string[],
) {
  const filtered = modifications.filter(m => m.position >= regionStart)
  const modificationPositions = new Uint32Array(filtered.length)
  const modificationYs = new Uint16Array(filtered.length)
  // Pre-pack each modification's RGB + probability-as-alpha into ABGR u32 so
  // both the GPU vertex buffer and the Canvas2D shader path can read one
  // slot instead of four shifted bytes.
  const modificationColors = new Uint32Array(filtered.length)
  const modificationProbabilities = new Uint8Array(filtered.length)
  const modificationReadIndices = new Uint32Array(filtered.length)
  const modTypeToIdx = detectedModifications
    ? new Map([...detectedModifications].map((t, i) => [t, i]))
    : undefined
  const modificationTypeIndices = modTypeToIdx
    ? new Uint8Array(filtered.length)
    : undefined
  for (let i = 0; i < filtered.length; i++) {
    const m = filtered[i]!
    modificationPositions[i] = m.position
    // Quadratic curve with 0.1 floor: low-prob mods stay faintly visible,
    // high-prob mods are strongly opaque (matches main branch alphaColor).
    const a = Math.round(Math.min(1, m.prob * m.prob + 0.1) * 255) & 0xff
    modificationColors[i] = packAbgr(m.r, m.g, m.b, a)
    modificationProbabilities[i] = Math.round(m.prob * 255) & 0xff
    modificationReadIndices[i] = getReadIndex(m.featureId)
    if (modificationTypeIndices && modTypeToIdx) {
      modificationTypeIndices[i] = modTypeToIdx.get(m.modType) ?? 0
    }
  }
  return {
    modificationPositions,
    modificationYs,
    modificationColors,
    modificationProbabilities,
    modificationReadIndices,
    modificationTypeIndices,
  }
}
