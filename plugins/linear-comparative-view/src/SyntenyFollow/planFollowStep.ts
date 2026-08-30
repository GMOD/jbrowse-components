import { getFeatureAtIndex } from '../LinearSyntenyDisplay/model.ts'
import { followReverseShare } from './followReverseShare.ts'
import { followWindowMapping } from './followWindowMapping.ts'
import { pickFollowFeature, preferIncumbent } from './pickFollowFeature.ts'
import { windowInsideFeat } from './windowInsideFeat.ts'

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
  // Whether the moving row should read right-to-left against the anchor:
  // inside one alignment that alignment's strand, wider than one only when
  // nearly everything under the window agrees. `undefined` leaves the row's
  // orientation alone, which is what a mixed window deserves — the crossing
  // ribbons ARE the picture of a rearrangement.
  wantReversed: boolean | undefined
}

// A vote past this share in either direction orients the row; anything between
// is a window showing both orientations, and flipping it would hide half.
const NEARLY_ALL = 0.9

function wantReversedFor(share: number | undefined) {
  if (share === undefined) {
    return undefined
  }
  return share >= NEARLY_ALL
    ? true
    : share <= 1 - NEARLY_ALL
      ? false
      : undefined
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
  incumbentTarget,
}: {
  displays: LinearSyntenyDisplayModel[]
  window: FollowWindow
  toMate: boolean
  mateAssembly?: string
  incumbentId?: string
  incumbentTarget?: string
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
  // AFTER the winner is known, and only in the case that reads it: a full scan
  // of every loaded block, which a level with several synteny tracks used to
  // pay for once per improving candidate
  const envelope = inside
    ? undefined
    : followWindowMapping({
        data,
        window,
        toMate,
        mateAssembly,
        incumbentTarget,
      })
  return {
    display,
    feat,
    window,
    toMate,
    hasCigar: data.hasCigar,
    windowInsideFeat: inside,
    envelope,
    // Over the contig the row is PLACED ON, which is the envelope's own answer
    // — and the picked block's mate when the envelope has none, since that is
    // then what `resolveFollowSpan` interpolates across.
    wantReversed: inside
      ? feat.strand === -1
      : wantReversedFor(
          followReverseShare({
            data,
            window,
            toMate,
            mateAssembly,
            targetRefName:
              envelope?.refName ?? (toMate ? feat.mate.refName : feat.refName),
          }),
        ),
  }
}
