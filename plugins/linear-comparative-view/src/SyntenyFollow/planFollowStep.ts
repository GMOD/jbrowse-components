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
 * Whether the anchor window lies wholly inside one alignment — the test that
 * decides between the exact walk and the window mapping.
 *
 * The axis the window is measured on is the query axis when the mate row is the
 * one moving, and the mate axis when it is not.
 *
 * Shared with the per-frame pass, which answers it against the block the last
 * settle chose rather than re-picking one: re-picking costs a full scan of
 * every loaded block, and being a frame or two stale only routes the placement
 * to the mapping, which is correct either way.
 */
export function windowInsideFeat(
  feat: FeatPos,
  window: FollowWindow,
  toMate: boolean,
) {
  const [start, end] = toMate
    ? [feat.start, feat.end]
    : [feat.mate.start, feat.mate.end]
  return start <= window.start && end >= window.end
}

/** One display's answer, kept alongside where it came from. */
interface FollowPick extends FollowCandidate {
  display: LinearSyntenyDisplayModel
  data: SyntenyFeatureData
}

/**
 * Which alignment this level should place its moving row from, across every
 * synteny track on it. Each track is asked for its best alignment over the
 * window and the widest wins, so a sparse track does not outvote the one that
 * actually covers the locus.
 *
 * The same hysteresis as within a track, applied again here: comparing the
 * displays' answers on raw overlap threw it away one level up, so two tracks
 * over the same locus traded the follow back and forth on rounding.
 *
 * `undefined` means no alignment covers the window, and the caller holds the
 * row where it is rather than sending it somewhere invented.
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
    // Read off the answer rather than searched for, so a display that has
    // already abandoned the incumbent for a better block of its own does not
    // re-nominate it.
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
    // AFTER the winner is known, and only in the case that reads it: a full
    // scan of every loaded block, which a level with several synteny tracks
    // used to pay for once per improving candidate
    envelope: inside
      ? undefined
      : followWindowMapping({ data, window, toMate, mateAssembly }),
  }
}
