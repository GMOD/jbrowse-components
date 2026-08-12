import { getFeatureAtIndex } from '../LinearSyntenyDisplay/model.ts'
import { followWindowMapping } from './followWindowMapping.ts'
import { pickFollowFeature, preferIncumbent } from './pickFollowFeature.ts'

import type {
  FeatPos,
  LinearSyntenyDisplayModel,
  SyntenyFeatureData,
} from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'
import type { FollowCandidate } from './pickFollowFeature.ts'

/**
 * Everything one level's placement needs, with every observable already read.
 *
 * The point of the shape: the pass that builds this runs inside an autorun and
 * the pass that consumes it is async, so anything the second one reads off a
 * model would not be tracked. If a field is missing here it cannot be fetched
 * later.
 */
export interface FollowStep {
  display: LinearSyntenyDisplayModel
  feat: FeatPos
  window: FollowWindow
  toMate: boolean
  // whether the alignment carries a CIGAR to walk, from the same fetch the
  // feature came out of
  hasCigar: boolean
  // whether the anchor window lies wholly inside `feat`, which is what decides
  // between the exact walk and the envelope
  windowInsideFeat: boolean
  // the union of everything under the window, for when it does not — and
  // undefined when it does, since that is the only case anything reads it
  envelope: ResolvedSpan | undefined
}

/**
 * The alignment's extent on the axis the anchor window is measured on: the
 * query axis when the mate row is the one moving, the mate axis when it is not.
 */
function featSpanOnWindowAxis(
  feat: FeatPos,
  toMate: boolean,
): [number, number] {
  return toMate ? [feat.start, feat.end] : [feat.mate.start, feat.mate.end]
}

/**
 * Whether the anchor window lies wholly inside one alignment — the test that
 * decides between the exact walk and the window mapping.
 *
 * Shared with the per-frame pass, which answers it against the block the last
 * settle chose rather than re-picking one: re-picking costs a full scan of
 * every loaded block, and being a frame or two stale here only routes the
 * placement to the mapping, which is correct either way.
 */
export function windowInsideFeat(
  feat: FeatPos,
  window: FollowWindow,
  toMate: boolean,
) {
  const [aStart, aEnd] = featSpanOnWindowAxis(feat, toMate)
  return aStart <= window.start && aEnd >= window.end
}

/**
 * Whether the anchor window still touches the alignment at all, which is what
 * makes interpolating ACROSS it mean anything.
 *
 * Only the per-frame pass has to ask: it maps through the block the last settle
 * chose rather than re-picking one, so the anchor can pan clean off that block
 * between settles. `interpolateFollowSpan` clamps the window to the block
 * before mapping it, so a window entirely past the block has no interior to
 * cross and both edges collapse onto one corner.
 */
export function windowOverlapsFeat(
  feat: FeatPos,
  window: FollowWindow,
  toMate: boolean,
) {
  const [aStart, aEnd] = featSpanOnWindowAxis(feat, toMate)
  return aStart < window.end && aEnd > window.start
}

/** One display's answer, kept alongside where it came from. */
interface FollowPick extends FollowCandidate {
  display: LinearSyntenyDisplayModel
  data: SyntenyFeatureData
}

/**
 * Which alignment this level should place its moving row from, across every
 * synteny track on it.
 *
 * A level can carry more than one track. Each is asked for its best alignment
 * over the window and the widest wins, so a sparse track does not outvote the
 * one that actually covers the locus.
 *
 * THE SAME HYSTERESIS AS WITHIN A TRACK, applied again here. Each display
 * already refuses to abandon the block it is following for a marginally wider
 * one, and comparing their answers on raw overlap threw that away one level up:
 * two tracks over the same locus (an all-vs-all file overlaid on a pairwise
 * one, two aligners' output on the same pair) traded the follow back and forth
 * on the rounding a pan produces, which is exactly the flapping between
 * paralogous loci the margin exists to stop.
 *
 * `undefined` means no alignment covers the anchor window — a haplotype-specific
 * insertion, a centromere, a row parked off the end of the file. The caller
 * holds the row where it is rather than sending it somewhere invented.
 */
export function planFollowStep({
  displays,
  window,
  toMate,
  mateAssembly,
  incumbentId,
}: {
  displays: LinearSyntenyDisplayModel[]
  window: FollowWindow
  toMate: boolean
  mateAssembly?: string
  incumbentId?: string
}): FollowStep | undefined {
  let widest: FollowPick | undefined
  let incumbent: FollowPick | undefined
  for (const display of displays) {
    const data = display.featureData
    if (!data) {
      continue
    }
    const candidate = pickFollowFeature({
      data,
      window,
      toMate,
      mateAssembly,
      incumbentId,
    })
    if (!candidate) {
      continue
    }
    const pick = { ...candidate, display, data }
    if (!widest || pick.overlap > widest.overlap) {
      widest = pick
    }
    // Which display is holding the incumbent, read off the answer it gave
    // rather than searched for: `pickFollowFeature` returns the incumbent when
    // its own hysteresis kept it, so a display that has already abandoned it
    // for a decisively better block of its own says nothing here — which is
    // right, since that abandonment was legitimate.
    if (
      incumbentId !== undefined &&
      data.featureIds[candidate.index] === incumbentId
    ) {
      incumbent = pick
    }
  }
  const best = preferIncumbent(widest, incumbent)
  if (!best) {
    return undefined
  }
  const { display, data } = best
  const feat = getFeatureAtIndex(data, best.index)
  const inside = windowInsideFeat(feat, window, toMate)
  return {
    display,
    feat,
    window,
    toMate,
    hasCigar: data.hasCigar,
    windowInsideFeat: inside,
    // AFTER the winner is known, and only in the case that reads it. This is a
    // full scan of every loaded block — hundreds of thousands on a whole-genome
    // PAF — and it used to run once per improving candidate, so a level with
    // several synteny tracks paid for it repeatedly and a window sitting inside
    // one alignment paid for it to be thrown away (`resolveFollowSpan` walks
    // the CIGAR there instead).
    envelope: inside
      ? undefined
      : followWindowMapping({ data, window, toMate, mateAssembly }),
  }
}
