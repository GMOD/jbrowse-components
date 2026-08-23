import { followAxes } from './followAxes.ts'

import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

// Hysteresis: without a margin, two alignments covering the same window within
// a few bp (a segmental duplication, a fragmented assembly, two rows of an
// all-vs-all file) trade places on the rounding a pan produces and the followed
// panel snaps between paralogous loci while the anchor moves smoothly.
const SWITCH_MARGIN = 1.5

export interface FollowCandidate {
  index: number
  overlap: number
}

// applied over the same margin wherever the follow re-chooses between two
// things a pan can put within rounding of each other: the block, within a
// display and then across the displays on a level, and the envelope's target
// contig
export function preferIncumbent<T extends { overlap: number }>(
  best: T | undefined,
  incumbent: T | undefined,
) {
  return incumbent && best && best.overlap < incumbent.overlap * SWITCH_MARGIN
    ? incumbent
    : best
}

/**
 * Which loaded alignment to map the anchor window through: the one covering
 * most of it, biased toward the one already being followed. Scans the packed
 * arrays rather than materializing `FeatPos`, since this runs on every settled
 * pan over hundreds of thousands of blocks.
 *
 * `undefined` means nothing covers the window, and the caller holds the row.
 */
export function pickFollowFeature({
  data,
  window,
  toMate,
  mateAssembly,
  incumbentId,
}: {
  data: SyntenyFeatureData
  window: FollowWindow
  toMate: boolean
  mateAssembly?: string
  incumbentId?: string
}): FollowCandidate | undefined {
  const {
    refNameIds,
    starts,
    ends,
    windowRefNameIds,
    mateAssemblyNameIds,
    mateAssemblyId,
  } = followAxes({ data, windows: [window], toMate, mateAssembly })
  const windowRefNameId = windowRefNameIds[0]
  let best: FollowCandidate | undefined
  let incumbent: FollowCandidate | undefined
  for (let i = 0; i < refNameIds.length; i++) {
    if (refNameIds[i] !== windowRefNameId) {
      continue
    }
    if (
      mateAssemblyId !== undefined &&
      mateAssemblyNameIds[i] !== mateAssemblyId
    ) {
      continue
    }
    // start <= end, direction in `strands` — the packing convention, and what
    // windowInsideFeat and interpolateFollowSpan already read these arrays as
    const overlap =
      Math.min(ends[i]!, window.end) - Math.max(starts[i]!, window.start)
    if (overlap <= 0) {
      continue
    }
    if (!best || overlap > best.overlap) {
      best = { index: i, overlap }
    }
    if (incumbentId !== undefined && data.featureIds[i] === incumbentId) {
      incumbent = { index: i, overlap }
    }
  }
  return preferIncumbent(best, incumbent)
}
