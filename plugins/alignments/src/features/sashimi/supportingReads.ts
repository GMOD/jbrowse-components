import { SAM_FLAG_SECONDARY } from '@jbrowse/cigar-utils'

import { GAP_SKIP } from '../../shaders/slang/gap.consts.generated.ts'
import { splitClassCode } from './junctionClass.ts'
import { forEachSplitJunction } from './splitJunctions.ts'

import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { ReadSlot } from '../../shared/readSlot.ts'
import type { ArcSplitCategory } from '../arcs/arcSplitCategory.ts'

/** A junction as one lane draws it: what a hovered arc names. */
export interface LaneJunction {
  groupKey: string
  refName: string
  start: number
  end: number
  // the split class of a split junction, unset for an N gap
  split?: ArcSplitCategory
}

type ReadFields = Pick<
  WorkerPileupData,
  | 'gapPositions'
  | 'gapTypes'
  | 'gapReadIndices'
  | 'readPositions'
  | 'readStrands'
  | 'readFlags'
  | 'readSuppAlignments'
  | 'readClipAtStart'
>

function skipGapReads(data: ReadFields, start: number, end: number) {
  const { gapPositions, gapTypes, gapReadIndices } = data
  const reads: number[] = []
  for (let i = 0; i < gapTypes.length; i++) {
    if (
      gapPositions[i * 2] === start &&
      gapPositions[i * 2 + 1] === end &&
      gapTypes[i] === GAP_SKIP
    ) {
      reads.push(gapReadIndices[i]!)
    }
  }
  return reads
}

// The reads whose segment makes this split junction with a read neighbour,
// each read once.
function splitReads(
  data: ReadFields,
  junction: LaneJunction,
  split: ArcSplitCategory,
  canonicalRefName: (refName: string) => string,
) {
  const { readSuppAlignments, readClipAtStart, readPositions, readStrands } =
    data
  const reads: number[] = []
  if (!readSuppAlignments || !readClipAtStart) {
    return reads
  }
  const code = splitClassCode(split)
  const isHere = (refName: string) =>
    canonicalRefName(refName) === junction.refName
  let read = -1
  const visit = (start: number, end: number, splitClass: number) => {
    if (
      start === junction.start &&
      end === junction.end &&
      splitClass === code &&
      reads.at(-1) !== read
    ) {
      reads.push(read)
    }
  }
  for (const [i, sa] of readSuppAlignments.entries()) {
    if (sa && !(data.readFlags[i]! & SAM_FLAG_SECONDARY)) {
      read = i
      forEachSplitJunction(
        {
          start: readPositions[i * 2]!,
          end: readPositions[i * 2 + 1]!,
          strand: readStrands[i]!,
          clipAtStart: readClipAtStart[i]!,
        },
        sa,
        isHere,
        visit,
      )
    }
  }
  return reads
}

/**
 * The slots of the reads supporting this junction, in every region of its
 * lane on its refName: those whose skip gap it is, or for a split junction
 * those whose segment it joins to the next. A read reaching two regions has a
 * slot in each, so a junction spanning two collapsed-intron exons lights both
 * halves.
 */
export function junctionSupportingReadSlots(
  regions: Iterable<{
    displayedRegionIndex: number
    refName: string | undefined
    data: ReadFields
  }>,
  junction: LaneJunction,
  canonicalRefName: (refName: string) => string = refName => refName,
) {
  const { groupKey, start, end, split } = junction
  const slots: ReadSlot[] = []
  for (const { displayedRegionIndex, refName, data } of regions) {
    if (refName === junction.refName) {
      for (const idx of split
        ? splitReads(data, junction, split, canonicalRefName)
        : skipGapReads(data, start, end)) {
        slots.push({ displayedRegionIndex, groupKey, idx })
      }
    }
  }
  return slots
}
