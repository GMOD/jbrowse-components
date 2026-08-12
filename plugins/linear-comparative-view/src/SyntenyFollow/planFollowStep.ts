import { getFeatureAtIndex } from '../LinearSyntenyDisplay/model.ts'
import { followEnvelope } from './followEnvelope.ts'
import { pickFollowFeature } from './pickFollowFeature.ts'

import type {
  FeatPos,
  LinearSyntenyDisplayModel,
} from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

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
  // the union of everything under the window, for when it does not
  envelope: ResolvedSpan | undefined
}

/**
 * Which alignment this level should place its moving row from, across every
 * synteny track on it.
 *
 * A level can carry more than one track. Each is asked for its best alignment
 * over the window and the widest wins, so a sparse track does not outvote the
 * one that actually covers the locus.
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
  let best: FollowStep | undefined
  let bestOverlap = 0
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
    if (candidate && (!best || candidate.overlap > bestOverlap)) {
      bestOverlap = candidate.overlap
      const feat = getFeatureAtIndex(data, candidate.index)
      const [aStart, aEnd] = toMate
        ? [feat.start, feat.end]
        : [feat.mate.start, feat.mate.end]
      best = {
        display,
        feat,
        window,
        toMate,
        hasCigar: data.hasCigar,
        windowInsideFeat: aStart <= window.start && aEnd >= window.end,
        envelope: followEnvelope({ data, window, toMate, mateAssembly }),
      }
    }
  }
  return best
}
