import { GAP_SKIP } from '../../shaders/slang/gap.consts.generated.ts'
import { findMarkAt } from '../mark.ts'
import { gapMark } from './mark.ts'

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
// The span, the row scan and the significance gate are the mark's; this reads
// the answer out as the op a person sees.
export function hitTestGap(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  includeDeletions: boolean,
  filterMismatchesByFrequency: boolean,
): CigarHitResult | undefined {
  const data = resolved.rpcData
  const mark = gapMark({ deletions: includeDeletions, skips: true })
  const i = findMarkAt(mark, data, coords, filterMismatchesByFrequency)
  return i === undefined
    ? undefined
    : {
        type: data.gapTypes[i] === GAP_SKIP ? 'skip' : 'deletion',
        index: i,
        position: mark.startBp(data, i),
        length: mark.endBp(data, i) - mark.startBp(data, i),
      }
}
