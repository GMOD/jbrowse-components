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
 * `mateAssembly` KEEPS AN ALL-VS-ALL TRACK IN ITS LANE — belt to the adapter's
 * braces, deliberately. The fetch is single-axis (query regions in, every mate
 * out), so nothing in the SHAPE of what arrives here says the mates all belong
 * to the assembly the level's lower row is on; that they do is a property of the
 * adapters we ship, which honor the `targetAssemblyName` the synteny fetch
 * passes (`AllVsAllPAFAdapter.getFeatures` drops the other pairs at the source).
 * An adapter that ignores it — a third-party one, or a future path that stops
 * passing it — would put alignments to every sample in a PanSN file in front of
 * this function, and the widest of them would win and send the row to a contig
 * of a different genome. Cheap enough to not depend on a contract two layers
 * away. It is the mate array that is checked in both directions, because the
 * mate axis is the multi-assembly one and is also the only one every adapter
 * reliably fills in (the worker defaults a missing feature-side `assemblyName`
 * to '').
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
  mateAssembly,
  incumbentId,
}: {
  data: SyntenyFeatureData
  window: FollowWindow
  toMate: boolean
  // the assembly of the panel on the level's MATE axis (always `views[level +
  // 1]`), whichever of the two panels is the one moving. Undefined only where
  // the caller cannot name it, which skips the filter rather than dropping
  // every candidate.
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
  return preferIncumbent(best, incumbent)
}
