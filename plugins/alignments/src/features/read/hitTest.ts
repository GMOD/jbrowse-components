import { isWithinReadBand } from '../../shared/hitTestTypes.ts'

import type { CigarCoords, ResolvedBlock } from '../../shared/hitTestTypes.ts'

export function hitTestFeature(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  featureHeight: number,
): { id: string; index: number } | undefined {
  const { genomicPos, row } = coords
  if (isWithinReadBand(coords, featureHeight)) {
    const { readPositions, readYs, readIds } = resolved.rpcData
    // Backwards, so that when several features share a row the one returned is
    // the one drawn last — i.e. the one actually under the cursor. Reads are
    // packed in array order, so later indices paint over earlier ones. In a
    // normal pileup at most one feature per row spans a position, which makes
    // the direction moot; it decides the answer only where a layout puts
    // features on a shared row (a chain, or a collapsed group).
    for (let i = readIds.length - 1; i >= 0; i--) {
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
