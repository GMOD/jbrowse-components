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
}

// Paired-read mate coordinates, or undefined when there's no mapped mate (an
// unpaired read, or a mate-unmapped read whose next_ref/next_pos are absent).
export function getMateFields(feature: Feature): MateFields | undefined {
  const nextRef = feature.get('next_ref')
  const nextPos = feature.get('next_pos')
  return typeof nextRef === 'string' && typeof nextPos === 'number'
    ? {
        uniqueId: feature.id(),
        refName: feature.get('refName'),
        start: feature.get('start'),
        end: feature.get('end'),
        strand: feature.get('strand'),
        nextRef,
        nextPos,
      }
    : undefined
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
      strand: f.strand,
    },
  })
}
