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

// Everything one level's placement needs, with every observable already read:
// the pass that builds this is an autorun and the pass that consumes it is
// async, so a field missing here cannot be fetched later.
export interface FollowStep {
  display: LinearSyntenyDisplayModel
  feat: FeatPos
  window: FollowWindow
  toMate: boolean
  hasCigar: boolean
  windowInsideFeat: boolean
  // the union of everything under the window, and undefined when the window is
  // inside one alignment, which is the only case that does not read it
  envelope: ResolvedSpan | undefined
}

/**
 * Decides between the exact walk and the window mapping. The axis is the query
 * one when the mate row is moving, and the mate one when it is not.
 *
 * THE REFNAME IS PART OF IT, and only the frame pass needs that: the exact pass
 * asks about a block `pickFollowFeature` just picked ON the window's refName, so
 * they always agree, but the frame pass asks about the block the last settle
 * chose against a live window that may have moved to another contig. Overlapping
 * COORDINATES alone made that window look inside the old block, and the row was
 * placed through an unrelated alignment until the next settle corrected it.
 */
export function windowInsideFeat(
  feat: FeatPos,
  window: FollowWindow,
  toMate: boolean,
) {
  const { refName, start, end } = toMate ? feat : feat.mate
  return (
    refName === window.refName && start <= window.start && end >= window.end
  )
}

interface FollowPick extends FollowCandidate {
  display: LinearSyntenyDisplayModel
  data: SyntenyFeatureData
}

/**
 * Which alignment this level places its moving row from, across every synteny
 * track on it. Widest wins, so a sparse track does not outvote the one covering
 * the locus, and the same hysteresis applies again here — comparing the
 * displays' answers on raw overlap let two tracks over one locus trade the
 * follow on rounding.
 *
 * `undefined` means nothing covers the window, and the caller holds the row.
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
    // read off the answer rather than searched for, so a display that has
    // abandoned the incumbent for a better block does not re-nominate it
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
