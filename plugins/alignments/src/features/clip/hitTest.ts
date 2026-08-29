import { findMarkAt } from '../mark.ts'
import { HARDCLIP_MARK, SOFTCLIP_MARK } from './mark.ts'

import type {
  CigarCoords,
  CigarHitResult,
  ResolvedBlock,
} from '../../shared/hitTestTypes.ts'

// TWO scans, softclips then hardclips, because two independent rules meet here
// and one loop could only express one of them:
//
//   - **Softclip beats hardclip** at the same row and position. That is the
//     worker's array layout talking, not scan order, so it is the order the two
//     calls are written in — and each mark's own `rangeStart`/`rangeEnd` is what
//     confines it to its half.
//   - **Within a kind, the topmost bar wins** — `findTopmostOnRow`, same as
//     every other mark test, which matters where a collapsed group or a chain
//     puts several reads on one row.
//
// Fused into one forward loop those two disagreed: the second rule silently
// became "whichever read comes first in the array", i.e. the bar underneath.
//
// The tolerance, the significance gate and both bounds are the mark's
// (`clipMark`); this reads the answer out as the op a person sees.
export function hitTestClip(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  filterMismatchesByFrequency: boolean,
): CigarHitResult | undefined {
  const data = resolved.rpcData
  const soft = findMarkAt(
    SOFTCLIP_MARK,
    data,
    coords,
    filterMismatchesByFrequency,
  )
  const i =
    soft ?? findMarkAt(HARDCLIP_MARK, data, coords, filterMismatchesByFrequency)
  return i === undefined
    ? undefined
    : {
        type: soft === undefined ? 'hardclip' : 'softclip',
        index: i,
        position: data.interbasePositions[i]!,
        length: data.interbaseLengths[i]!,
      }
}
