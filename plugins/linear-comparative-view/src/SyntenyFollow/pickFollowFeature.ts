import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

// How much wider a challenger's overlap has to be before a follow abandons the
// alignment it is on. Without it, two alignments covering the same window
// within a few bp of each other (a segmental duplication, a fragmented
// assembly, two rows of an all-vs-all file) trade places on the rounding a pan
// produces, and the followed panel snaps between paralogous loci while the
// anchor moves smoothly.
const SWITCH_MARGIN = 1.5

export interface FollowCandidate {
  index: number
  overlap: number
}

/**
 * The hysteresis rule, applied twice over the same margin: once inside a
 * display over the blocks it loaded, and once across the displays on a level
 * over each one's answer.
 */
export function preferIncumbent<T extends FollowCandidate>(
  best: T | undefined,
  incumbent: T | undefined,
) {
  return incumbent && best && best.overlap < incumbent.overlap * SWITCH_MARGIN
    ? incumbent
    : best
}

/**
 * Which loaded alignment a follow should map the anchor window through: the one
 * covering the most of that window, biased toward the one already being
 * followed.
 *
 * Scans the packed arrays rather than materializing `FeatPos` objects — this
 * runs on every settled pan and a whole-genome PAF's loaded set runs to
 * hundreds of thousands of blocks.
 *
 * `mateAssembly` KEEPS AN ALL-VS-ALL TRACK IN ITS LANE — belt to the adapter's
 * braces, deliberately. The fetch is single-axis (query regions in, every mate
 * out), so nothing in the SHAPE of what arrives says the mates all belong to
 * the assembly the level's lower row is on; that they do is a property of the
 * adapters we ship, which honor the `targetAssemblyName` the synteny fetch
 * passes. One that ignores it would put every sample in a PanSN file in front
 * of this, and the widest would win and send the row to another genome's
 * contig. It is the MATE array that is checked in both directions, because that
 * is the multi-assembly axis and the only one every adapter reliably fills in
 * (the worker defaults a missing feature-side `assemblyName` to '').
 *
 * `undefined` when nothing overlaps the window is an ordinary answer, not an
 * error: a haplotype-specific insertion, a centromere, a panel parked off the
 * end of the alignments. The caller holds position rather than guessing.
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
  // the assembly of the panel on the level's MATE axis (always `views[level +
  // 1]`), whichever panel is the one moving. Undefined where the caller cannot
  // name it, which skips the filter rather than dropping every candidate.
  mateAssembly?: string
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
    if (
      mateAssembly !== undefined &&
      data.mateAssemblyNames[i] !== mateAssembly
    ) {
      continue
    }
    // a negative-width block would score as a huge negative overlap and never
    // be picked, even where it is the only candidate
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
  return preferIncumbent(best, incumbent)
}
