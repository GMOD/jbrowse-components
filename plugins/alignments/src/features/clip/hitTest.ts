import { passesFrequencyGate } from '../../LinearAlignmentsDisplay/constants.ts'
import { findTopmostOnRow } from '../../shared/hitTestTypes.ts'
import { interbaseRangeEnds } from '../../shared/uploadTypes.ts'

import type {
  CigarCoords,
  CigarHitResult,
  ResolvedBlock,
} from '../../shared/hitTestTypes.ts'

// Hit test for soft + hard clips, over the same `[insEnd, hcEnd)` slice
// `packClips` uploads and split on the same `scEnd` boundary — so a bar's hit
// kind and its drawn color cannot disagree.
//
// TWO scans, softclips then hardclips, because two independent rules meet here
// and one loop could only express one of them:
//
//   - **Softclip beats hardclip** at the same row and position. That is the
//     worker's array layout (insertions, softclips, hardclips) talking, not scan
//     order, so it is the order the two calls are written in.
//   - **Within a kind, the topmost bar wins** — `findTopmostOnRow`, same as
//     every other mark test, which matters where a collapsed group or a chain
//     puts several reads on one row.
//
// Fused into one forward loop those two disagreed: the second rule silently
// became "whichever read comes first in the array", i.e. the bar underneath.
export function hitTestClip(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  filterMismatchesByFrequency: boolean,
): CigarHitResult | undefined {
  const { bpPerPx, genomicPos, row } = coords
  const {
    interbasePositions,
    interbaseYs,
    interbaseLengths,
    interbaseFrequencies,
  } = resolved.rpcData
  const { insEnd, scEnd, hcEnd } = interbaseRangeEnds(resolved.rpcData)
  const hitToleranceBp = Math.max(0.5, bpPerPx * 3)

  const matches = (i: number) => {
    // Same significance gate as the mismatch and small-insertion tests, off the
    // same `interbaseFrequencies` byte the clip shader fades by (clip.slang's
    // `frequencyFade`). This test was the one mark hit-test without it, so a
    // clip faded to the noise floor still intercepted clicks that every other
    // faded mark hands back to the read body underneath.
    if (
      !passesFrequencyGate(
        bpPerPx,
        interbaseFrequencies[i] ?? 0,
        filterMismatchesByFrequency,
      )
    ) {
      return false
    }
    const pos = interbasePositions[i]
    const len = interbaseLengths[i]
    return (
      pos !== undefined &&
      len !== undefined &&
      Math.abs(genomicPos - pos) < hitToleranceBp
    )
  }

  const soft = findTopmostOnRow(interbaseYs, insEnd, scEnd, row, matches)
  const i = soft ?? findTopmostOnRow(interbaseYs, scEnd, hcEnd, row, matches)
  return i === undefined
    ? undefined
    : {
        type: i < scEnd ? 'softclip' : 'hardclip',
        index: i,
        position: interbasePositions[i]!,
        length: interbaseLengths[i]!,
      }
}
