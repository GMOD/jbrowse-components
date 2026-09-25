import { GAP_SKIP } from '../../shaders/slang/gap.consts.generated.ts'

import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { ReadSlot } from '../../shared/readSlot.ts'

/** A junction as one lane draws it: what a hovered arc names. */
export interface LaneJunction {
  groupKey: string
  refName: string
  start: number
  end: number
}

type GapFields = Pick<
  WorkerPileupData,
  'gapPositions' | 'gapTypes' | 'gapReadIndices'
>

/**
 * The slots of the reads whose skip gap is exactly this junction, in every
 * region of its lane on its refName. A read reaching two regions has a slot in
 * each, so a junction spanning two collapsed-intron exons lights both halves.
 */
export function junctionSupportingReadSlots(
  regions: Iterable<{
    displayedRegionIndex: number
    refName: string | undefined
    data: GapFields
  }>,
  junction: LaneJunction,
) {
  const { groupKey, start, end } = junction
  const slots: ReadSlot[] = []
  for (const { displayedRegionIndex, refName, data } of regions) {
    if (refName !== junction.refName) {
      continue
    }
    const { gapPositions, gapTypes, gapReadIndices } = data
    const n = gapTypes.length
    for (let i = 0; i < n; i++) {
      if (
        gapPositions[i * 2] === start &&
        gapPositions[i * 2 + 1] === end &&
        gapTypes[i] === GAP_SKIP
      ) {
        slots.push({ displayedRegionIndex, groupKey, idx: gapReadIndices[i]! })
      }
    }
  }
  return slots
}
