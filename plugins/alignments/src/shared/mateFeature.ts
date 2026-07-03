import {
  SAM_FLAG_MATE_REVERSE,
  SAM_FLAG_MATE_UNMAPPED,
} from '@jbrowse/alignments-core'
import { SimpleFeature } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'

// The subset of paired-read fields needed to build a read+mate feature. A live
// pileup Feature (via .get()) and a serialized feature-detail object both expose
// these, so getMateFields() normalizes a Feature into this shape and the
// feature-detail panel constructs it from its serialized fields.
export interface MateFields {
  uniqueId: string
  refName: string
  start: number
  end: number
  strand?: number
  nextRef: string
  nextPos: number
  mateStrand: number
}

// Shared normalizer for the pileup Feature and the serialized feature-detail
// object. Returns undefined when there's no *mapped* mate: an unpaired read, a
// read whose next_ref/next_pos are absent, or a mate-unmapped read (RNEXT/PNEXT
// point at the read's own locus by convention, so mate actions would otherwise
// launch a bogus self-referential split view). The mate's strand comes from the
// mate-reverse flag, not the read's own strand.
export function computeMateFields(args: {
  uniqueId: string
  refName: string
  start: number
  end: number
  strand?: number
  flags?: unknown
  nextRef: unknown
  nextPos: unknown
}): MateFields | undefined {
  const { flags, nextRef, nextPos, ...rest } = args
  const flagBits = typeof flags === 'number' ? flags : 0
  const mateUnmapped = !!(flagBits & SAM_FLAG_MATE_UNMAPPED)
  return typeof nextRef === 'string' &&
    typeof nextPos === 'number' &&
    !mateUnmapped
    ? {
        ...rest,
        nextRef,
        nextPos,
        mateStrand: flagBits & SAM_FLAG_MATE_REVERSE ? -1 : 1,
      }
    : undefined
}

export function getMateFields(feature: Feature): MateFields | undefined {
  return computeMateFields({
    uniqueId: feature.id(),
    refName: feature.get('refName'),
    start: feature.get('start'),
    end: feature.get('end'),
    strand: feature.get('strand'),
    flags: feature.get('flags'),
    nextRef: feature.get('next_ref'),
    nextPos: feature.get('next_pos'),
  })
}

// The read+mate SimpleFeature that launchBreakpointSplitView consumes. Shared by
// the pileup context menu and the feature-detail launch panel so both build the
// identical feature.
export function buildPairedEndMateFeature(f: MateFields) {
  return new SimpleFeature({
    uniqueId: f.uniqueId,
    refName: f.refName,
    start: f.start,
    end: f.end,
    strand: f.strand,
    mate: {
      uniqueId: `${f.uniqueId}-mate`,
      refName: f.nextRef,
      start: f.nextPos,
      end: f.nextPos + 1,
      strand: f.mateStrand,
    },
  })
}
