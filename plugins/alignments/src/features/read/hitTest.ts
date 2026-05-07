import type { CigarCoords, ResolvedBlock } from '../../shared/hitTestTypes.ts'

// Hit test for an aligned read at the given (genomicPos, row).
// Walks the readPositions array linearly — fine for typical pileup density;
// chain-mode hit tests use a Flatbush index instead.
export function hitTestFeature(
  canvasX: number,
  canvasY: number,
  resolved: ResolvedBlock | undefined,
  coords: CigarCoords | undefined,
  featureHeightSetting: number,
): { id: string; index: number } | undefined {
  if (!resolved || !coords) {
    return undefined
  }

  const { adjustedY, yWithinRow, genomicPos, row } = coords

  if (adjustedY < 0) {
    return undefined
  }

  const { readPositions, readYs, readIds } = resolved.rpcData
  const numReads = readIds.length

  if (yWithinRow > featureHeightSetting) {
    return undefined
  }

  for (let i = 0; i < numReads; i++) {
    if (readYs[i] !== row) {
      continue
    }
    const readStart = readPositions[i * 2]
    const readEnd = readPositions[i * 2 + 1]
    if (
      readStart !== undefined &&
      readEnd !== undefined &&
      genomicPos >= readStart &&
      genomicPos <= readEnd
    ) {
      return { id: readIds[i]!, index: i }
    }
  }
  return undefined
}
