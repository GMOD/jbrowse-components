import { SAM_FLAG_SECONDARY } from '@jbrowse/cigar-utils'
import { adapterRefNameText } from '@jbrowse/core/util'

import { arcSlotCategory } from '../../shaders/palettes.ts'
import { GAP_SKIP } from '../../shaders/slang/gap.consts.generated.ts'
import { isArcSplitCategory } from '../arcs/arcSplitCategory.ts'
import { forEachSplitJunction } from './splitJunctions.ts'

import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { ReadSlot } from '../../shared/readSlot.ts'
import type { ArcSplitCategory } from '../arcs/arcSplitCategory.ts'
import type { CanonicalRefName } from '../arcs/arcTypes.ts'
import type { ArcBandHit } from '../arcs/bandFeed.ts'
import type { SashimiSplitClass } from './junctionClass.ts'
import type { AdapterRefName } from '@jbrowse/core/util'

/** A junction as one lane draws it: what a hovered sashimi arc names. */
export interface LaneJunction {
  groupKey: string
  refName: string
  start: number
  end: number
  // the split class of a split junction, unset for an N gap
  split?: SashimiSplitClass
}

/**
 * A hovered junction: a sashimi junction names its lane, and a split arc,
 * whose support pools every lane, names none. A split arc names its arc
 * class, an insertion included, which no sashimi arc draws.
 */
export interface HoveredJunction extends Omit<
  LaneJunction,
  'groupKey' | 'split'
> {
  groupKey?: string
  split?: ArcSplitCategory
}

/**
 * The split junction a hovered arc draws on `refName`, the canonical name of
 * the region it is filed under. None for a mate link, a tick or an arc
 * reaching another chromosome.
 */
export function arcSplitJunction(hit: ArcBandHit, refName: string | undefined) {
  let junction: HoveredJunction | undefined
  if (
    hit.kind === 'arc' &&
    hit.endRefName === undefined &&
    refName !== undefined
  ) {
    const split = arcSlotCategory(hit.colorType)
    if (isArcSplitCategory(split)) {
      junction = {
        refName,
        start: Math.min(hit.x1, hit.x2),
        end: Math.max(hit.x1, hit.x2),
        split,
      }
    }
  }
  return junction
}

/** Whether two hovers name one junction, so a mousemove along it rewrites nothing. */
export function sameLaneJunction(a?: HoveredJunction, b?: HoveredJunction) {
  return (
    a === b ||
    (a !== undefined &&
      b !== undefined &&
      a.groupKey === b.groupKey &&
      a.refName === b.refName &&
      a.start === b.start &&
      a.end === b.end &&
      a.split === b.split)
  )
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
  | 'readAlignedBases'
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
  junction: HoveredJunction,
  split: ArcSplitCategory,
  canonicalRefName: CanonicalRefName,
) {
  const {
    readSuppAlignments,
    readClipAtStart,
    readAlignedBases,
    readPositions,
    readStrands,
  } = data
  const reads: number[] = []
  if (!readSuppAlignments || !readClipAtStart) {
    return reads
  }
  const isHere = (refName: AdapterRefName) =>
    canonicalRefName(refName) === junction.refName
  let read = -1
  const visit = (start: number, end: number, joinSplit: ArcSplitCategory) => {
    if (
      start === junction.start &&
      end === junction.end &&
      joinSplit === split &&
      reads.at(-1) !== read
    ) {
      reads.push(read)
    }
  }
  for (let i = 0; i < readSuppAlignments.length; i++) {
    const sa = readSuppAlignments[i]
    if (sa && !(data.readFlags[i]! & SAM_FLAG_SECONDARY)) {
      read = i
      forEachSplitJunction(
        {
          start: readPositions[i * 2]!,
          end: readPositions[i * 2 + 1]!,
          strand: readStrands[i]!,
          clip: readClipAtStart[i]!,
          alignedBases: readAlignedBases?.[i] ?? 0,
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
  junction: HoveredJunction & { groupKey: string },
  canonicalRefName: CanonicalRefName = adapterRefNameText,
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
