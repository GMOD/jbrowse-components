import type {
  CigarCoords,
  CigarHitResult,
  ResolvedBlock,
} from '../../LinearAlignmentsDisplay/components/hitTesting.ts'

export function hitTestGap(
  resolved: ResolvedBlock,
  coords: CigarCoords,
): CigarHitResult | undefined {
  const { genomicPos, row } = coords
  const { gapPositions, gapYs, gapTypes } = resolved.rpcData
  const numGaps = gapPositions.length / 2

  for (let i = 0; i < numGaps; i++) {
    if (gapYs[i] !== row) {
      continue
    }
    const startPos = gapPositions[i * 2]
    const endPos = gapPositions[i * 2 + 1]
    if (
      startPos !== undefined &&
      endPos !== undefined &&
      genomicPos >= startPos &&
      genomicPos <= endPos
    ) {
      const gapType = gapTypes[i]
      return {
        type: gapType === 1 ? 'skip' : 'deletion',
        index: i,
        position: startPos,
        length: endPos - startPos,
      }
    }
  }
  return undefined
}
