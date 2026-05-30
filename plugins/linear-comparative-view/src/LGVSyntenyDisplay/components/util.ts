import { parseCigar2 } from '@jbrowse/cigar-utils'

import { findPosInCigar } from './findPosInCigar.ts'

import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface SimpleRegion {
  refName: string
  start: number
  end: number
}

// The visible content block overlapping the clicked feature, used to clip the
// launched synteny view to the region of interest. Picking the block the
// feature actually falls in (not contentBlocks[0]) keeps this correct when the
// view shows multiple regions.
export function findVisibleBlockForFeature(
  view: LinearGenomeViewModel,
  feature: Feature,
) {
  const refName = feature.get('refName')
  const start = feature.get('start')
  const end = feature.get('end')
  return view.dynamicBlocks.contentBlocks.find(
    b => b.refName === refName && b.start <= end && b.end >= start,
  )
}

interface MateAnchor {
  start: number
  end: number
}

// Given a CIGAR-walked offset `mateX` along the mate axis, place it back on
// genomic coordinates. The mate's genomic span is mate.start..mate.end. For
// forward-strand alignments we walk forward from mate.start; for reverse
// strand we walk backward from mate.end. `strand === undefined` is treated as
// forward (avoids `* 0` zeroing out the offset).
function mateOffsetToGenomic(
  mate: MateAnchor,
  mateOffset: number,
  strand: number | undefined,
) {
  return strand === -1 ? mate.end - mateOffset : mate.start + mateOffset
}

export function navToSynteny({
  feature,
  windowSize,
  session,
  trackId,
  region,
  horizontallyFlip,
}: {
  windowSize: number
  trackId: string
  horizontallyFlip: boolean
  feature: Feature
  session: AbstractSessionModel
  region?: SimpleRegion
}) {
  const cigar = feature.get('CIGAR')
  const strand = feature.get('strand')

  const featRef = feature.get('refName')
  const featAsm = feature.get('assemblyName')
  const featStart = feature.get('start')
  const featEnd = feature.get('end')
  const mate = feature.get('mate')
  const mateAsm = mate.assemblyName
  const mateRef = mate.refName

  let rMateStart: number
  let rMateEnd: number
  let rFeatStart: number
  let rFeatEnd: number

  if (region && cigar) {
    const p = parseCigar2(cigar)
    const [fStartX, mStartX] = findPosInCigar(p, region.start - featStart)
    const [fEndX, mEndX] = findPosInCigar(p, region.end - featStart)

    rFeatStart = featStart + fStartX
    rFeatEnd = featStart + fEndX
    rMateStart = mateOffsetToGenomic(mate, mStartX, strand)
    rMateEnd = mateOffsetToGenomic(mate, mEndX, strand)
  } else {
    rFeatStart = featStart
    rFeatEnd = featEnd
    rMateStart = mate.start
    rMateEnd = mate.end
  }
  const m1 = Math.min(rMateStart, rMateEnd)
  const m2 = Math.max(rMateStart, rMateEnd)
  const l1 = `${featRef}:${Math.max(0, Math.floor(rFeatStart - windowSize))}-${Math.floor(rFeatEnd + windowSize)}`
  const l2 = `${mateRef}:${Math.max(0, Math.floor(m1 - windowSize))}-${Math.floor(m2 + windowSize)}${horizontallyFlip ? '[rev]' : ''}`
  session.addView('LinearSyntenyView', {
    init: {
      views: [
        { assembly: featAsm, loc: l1 },
        { assembly: mateAsm, loc: l2 },
      ],
      tracks: [[trackId]],
    },
  })
}
