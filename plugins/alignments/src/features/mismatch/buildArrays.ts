import type { MismatchData } from '../../shared/webglRpcTypes.ts'

export function buildMismatchArrays(
  mismatches: MismatchData[],
  regionStart: number,
) {
  const filtered = mismatches.filter(mm => mm.position >= regionStart)
  const mismatchPositions = new Uint32Array(filtered.length)
  const mismatchYs = new Uint16Array(filtered.length)
  const mismatchBases = new Uint8Array(filtered.length)
  const mismatchStrands = new Int8Array(filtered.length)
  const mismatchReadIndices = new Uint32Array(filtered.length)
  // Per-base Phred quality (clamped to a byte; real values top out ~93). 0 =
  // no quality, which the fade-by-quality renderers read as fully opaque.
  const mismatchQuals = new Uint8Array(filtered.length)
  for (let i = 0; i < filtered.length; i++) {
    const mm = filtered[i]!
    mismatchPositions[i] = mm.position
    mismatchBases[i] = mm.base
    mismatchStrands[i] = mm.strand
    mismatchReadIndices[i] = mm.readIndex
    mismatchQuals[i] = mm.qual > 255 ? 255 : mm.qual
  }
  return {
    mismatchPositions,
    mismatchYs,
    mismatchBases,
    mismatchStrands,
    mismatchReadIndices,
    mismatchQuals,
  }
}
