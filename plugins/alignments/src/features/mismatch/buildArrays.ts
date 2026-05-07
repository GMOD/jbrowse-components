import type { MismatchData } from '../../shared/webglRpcTypes.ts'

export function buildMismatchArrays(
  mismatches: MismatchData[],
  regionStart: number,
  getReadIndex: (featureId: string) => number,
) {
  const filtered = mismatches.filter(mm => mm.position >= regionStart)
  const mismatchPositions = new Uint32Array(filtered.length)
  const mismatchYs = new Uint16Array(filtered.length)
  const mismatchBases = new Uint8Array(filtered.length)
  const mismatchStrands = new Int8Array(filtered.length)
  const mismatchReadIndices = new Uint32Array(filtered.length)
  for (let i = 0; i < filtered.length; i++) {
    const mm = filtered[i]!
    mismatchPositions[i] = mm.position
    mismatchBases[i] = mm.base
    mismatchStrands[i] = mm.strand
    mismatchReadIndices[i] = getReadIndex(mm.featureId)
  }
  return {
    mismatchPositions,
    mismatchYs,
    mismatchBases,
    mismatchStrands,
    mismatchReadIndices,
  }
}
