import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

// How much wider a challenger's overlap of the anchor window has to be before a
// follow abandons the alignment it is already on. Pure hysteresis: without it,
// two alignments covering the same window within a few bp of each other (a
// segmental duplication, a fragmented assembly, two rows of an all-vs-all file)
// trade places on the ordinary rounding that a pan produces, and the followed
// panel snaps back and forth between paralogous loci while the anchor moves
// smoothly. 1.5x is above that noise and well below the step a genuinely better
// alignment makes when the window leaves one block for the next.
const SWITCH_MARGIN = 1.5

export interface FollowCandidate {
  index: number
  overlap: number
}

/**
 * Which loaded alignment a follow should map the anchor window through: the one
 * covering the most of that window, biased toward the one already being
 * followed.
 *
 * Scans the display's packed arrays directly rather than materializing
 * `FeatPos` objects — this runs on every settled pan of the anchor panel, and a
 * whole-genome PAF's loaded set runs to hundreds of thousands of blocks.
 *
 * THE AXIS DEPENDS ON THE DIRECTION. `starts`/`ends`/`refNames` are the query
 * axis (the level's upper panel) and `mateStarts`/`mateEnds`/`mateRefNames` the
 * target axis, so the window is matched against whichever axis the STAYING
 * panel is on: the query axis when the mate panel is the one moving, the mate
 * axis when it is not.
 *
 * `undefined` when nothing on that axis overlaps the window, which is an
 * ordinary answer rather than an error — a haplotype-specific insertion, a
 * centromere, or simply a panel parked off the end of the alignments. The
 * caller holds position rather than guessing.
 */
export function pickFollowFeature({
  data,
  window,
  toMate,
  incumbentId,
}: {
  data: SyntenyFeatureData
  window: FollowWindow
  toMate: boolean
  // the feature id this level followed last time, if it is still loaded
  incumbentId?: string
}): FollowCandidate | undefined {
  const refNames = toMate ? data.refNames : data.mateRefNames
  const starts = toMate ? data.starts : data.mateStarts
  const ends = toMate ? data.ends : data.mateEnds
  let best: FollowCandidate | undefined
  let incumbent: FollowCandidate | undefined
  for (let i = 0; i < refNames.length; i++) {
    if (refNames[i] !== window.refName) {
      continue
    }
    // normalized because a reverse-strand block's mate coords arrive genomic
    // (start < end) from every adapter we ship, but a `min`/`max` here costs
    // nothing and a negative-width block would otherwise score as a huge
    // negative overlap and never be picked even where it is the only candidate
    const lo = Math.min(starts[i]!, ends[i]!)
    const hi = Math.max(starts[i]!, ends[i]!)
    const overlap = Math.min(hi, window.end) - Math.max(lo, window.start)
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
  return incumbent && best && best.overlap < incumbent.overlap * SWITCH_MARGIN
    ? incumbent
    : best
}
