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

// applied twice over the same margin: within a display, and across the displays
// on a level over each one's answer
export function preferIncumbent<T extends FollowCandidate>(
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
 * `mateAssembly` KEEPS AN ALL-VS-ALL TRACK IN ITS LANE — belt to the adapter's
 * braces. The fetch is single-axis, so nothing in the shape of what arrives
 * says the mates all belong to the level's lower row; that is a property of the
 * adapters we ship honoring `targetAssemblyName`. One that ignored it would put
 * every sample in a PanSN file here and send the row to another genome. The
 * MATE array is checked in both directions, being the multi-assembly axis and
 * the only one every adapter fills in.
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
  // undefined where the caller cannot name it, which skips the filter rather
  // than dropping every candidate
  mateAssembly?: string
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
    if (
      mateAssembly !== undefined &&
      data.mateAssemblyNames[i] !== mateAssembly
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
