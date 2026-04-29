import type {
  CigarCoords,
  CigarHitResult,
  ResolvedBlock,
} from '../../LinearAlignmentsDisplay/components/hitTesting.ts'

export function hitTestMismatch(
  resolved: ResolvedBlock,
  coords: CigarCoords,
): CigarHitResult | undefined {
  const { genomicPos, row } = coords
  const { mismatchPositions, mismatchYs, mismatchBases } = resolved.rpcData
  const numMismatches = mismatchPositions.length
  // 1bp features — floor to the integer base the mouse is over
  const mousePos = Math.floor(genomicPos)

  for (let i = 0; i < numMismatches; i++) {
    if (mismatchYs[i] !== row) {
      continue
    }
    const pos = mismatchPositions[i]
    if (pos !== undefined && mousePos === pos) {
      const baseCode = mismatchBases[i]!
      return {
        type: 'mismatch',
        index: i,
        position: pos,
        base: String.fromCharCode(baseCode),
      }
    }
  }
  return undefined
}
