import { GAP_SKIP } from '../../shaders/slang/gap.consts.generated.ts'
import { findTopmostOnRow } from '../../shared/hitTestTypes.ts'

import type {
  CigarCoords,
  CigarHitResult,
  ResolvedBlock,
} from '../../shared/hitTestTypes.ts'

// `includeDeletions` mirrors the two draw layers this one array feeds: `skip`
// draws unconditionally, `deletion` only under `showMismatches`. An undrawn
// deletion must not be found at all — not merely lose a tie — or it goes on
// intercepting the whole span of a read that paints solid across it, and it
// masks any skip beneath it on the same row.
export function hitTestGap(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  includeDeletions: boolean,
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
      (includeDeletions || gapTypes[i] === GAP_SKIP) &&
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
