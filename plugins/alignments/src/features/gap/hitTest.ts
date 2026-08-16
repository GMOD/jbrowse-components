import { GAP_SKIP } from '../../shaders/slang/gap.consts.generated.ts'
import { findTopmostOnRow } from '../../shared/hitTestTypes.ts'

import type {
  CigarCoords,
  CigarHitResult,
  ResolvedBlock,
} from '../../shared/hitTestTypes.ts'

export function hitTestGap(
  resolved: ResolvedBlock,
  coords: CigarCoords,
): CigarHitResult | undefined {
  const { genomicPos, row } = coords
  const { gapPositions, gapYs, gapTypes } = resolved.rpcData
  const numGaps = gapPositions.length / 2

  // Topmost, not first: see `findTopmostOnRow`. On a collapsed group every read
  // sits on row 0, so scanning forwards answered with the deletion of a read
  // painted under the one `hitTestFeature` names alongside it.
  const i = findTopmostOnRow(gapYs, 0, numGaps, row, i => {
    const startPos = gapPositions[i * 2]
    const endPos = gapPositions[i * 2 + 1]
    return (
      startPos !== undefined &&
      endPos !== undefined &&
      genomicPos >= startPos &&
      genomicPos < endPos
    )
  })
  if (i === undefined) {
    return undefined
  }
  const startPos = gapPositions[i * 2]!
  return {
    type: gapTypes[i] === GAP_SKIP ? 'skip' : 'deletion',
    index: i,
    position: startPos,
    length: gapPositions[i * 2 + 1]! - startPos,
  }
}
