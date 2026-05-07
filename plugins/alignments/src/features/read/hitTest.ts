import type { CigarCoords, ResolvedBlock } from '../../shared/hitTestTypes.ts'

export function hitTestFeature(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  featureHeightSetting: number,
): { id: string; index: number } | undefined {
  const { adjustedY, yWithinRow, genomicPos, row } = coords
  if (adjustedY >= 0 && yWithinRow <= featureHeightSetting) {
    const { readPositions, readYs, readIds } = resolved.rpcData
    const numReads = readIds.length
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
  }
  return undefined
}
