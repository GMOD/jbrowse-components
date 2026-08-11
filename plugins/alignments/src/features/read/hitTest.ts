import {
  findTopmostOnRow,
  isWithinReadBand,
} from '../../shared/hitTestTypes.ts'

import type { CigarCoords, ResolvedBlock } from '../../shared/hitTestTypes.ts'

export function hitTestFeature(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  featureHeight: number,
): { id: string; index: number } | undefined {
  const { genomicPos, row } = coords
  if (!isWithinReadBand(coords, featureHeight)) {
    return undefined
  }
  const { readPositions, readYs, readIds } = resolved.rpcData
  // Topmost, not first: see `findTopmostOnRow`. This is the read every mark
  // hit test is reconciled against, so it and they must use the one rule.
  const i = findTopmostOnRow(readYs, 0, readIds.length, row, i => {
    const readStart = readPositions[i * 2]
    const readEnd = readPositions[i * 2 + 1]
    return (
      readStart !== undefined &&
      readEnd !== undefined &&
      genomicPos >= readStart &&
      genomicPos <= readEnd
    )
  })
  return i === undefined ? undefined : { id: readIds[i]!, index: i }
}
