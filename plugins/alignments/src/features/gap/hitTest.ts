import { GAP_SKIP } from '../../shaders/slang/gap.consts.generated.ts'
import { findMarkAt } from '../mark.ts'
import { DELETION_MARK, SKIP_MARK } from './mark.ts'

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
//
// One scan per drawn layer, and the LARGER index wins: both marks read one
// array in one order, so a later entry is the one painted on top — the rule
// `findTopmostOnRow` states, applied across the two layers as well as within
// each. The span, the row scan and the significance gate are the marks'; this
// reads the answer out as the op a person sees.
export function hitTestGap(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  includeDeletions: boolean,
  filterMismatchesByFrequency: boolean,
): CigarHitResult | undefined {
  const data = resolved.rpcData
  const skip = findMarkAt(SKIP_MARK, data, coords, filterMismatchesByFrequency)
  const deletion = includeDeletions
    ? findMarkAt(DELETION_MARK, data, coords, filterMismatchesByFrequency)
    : undefined
  const i =
    skip === undefined
      ? deletion
      : deletion === undefined
        ? skip
        : Math.max(skip, deletion)
  return i === undefined
    ? undefined
    : {
        type: data.gapTypes[i] === GAP_SKIP ? 'skip' : 'deletion',
        index: i,
        position: data.gapPositions[i * 2]!,
        length: data.gapPositions[i * 2 + 1]! - data.gapPositions[i * 2]!,
      }
}
