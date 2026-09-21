import { getFeatureAtIndex } from '../LinearSyntenyDisplay/model.ts'
import { NEARLY_ALL, preferIncumbent } from '../syntenyHysteresis.ts'
import { followReverseShare } from './followReverseShare.ts'
import { followWindowMapping } from './followWindowMapping.ts'
import { pickFollowFeature } from './pickFollowFeature.ts'
import { windowInsideFeat } from './windowInsideFeat.ts'

import type {
  FeatPos,
  LinearSyntenyDisplayModel,
  SyntenyFeatureData,
} from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'
import type { FollowCandidate } from './pickFollowFeature.ts'

// Everything one level's placement needs, read in the autorun: the async pass
// that consumes it tracks nothing.
export interface FollowStep {
  display: LinearSyntenyDisplayModel
  feat: FeatPos
  window: FollowWindow
  toMate: boolean
  hasCigar: boolean
  windowInsideFeat: boolean
  // undefined when the window is inside one alignment
  envelope: ResolvedSpan | undefined
  // undefined for a mixed window, which leaves the row's orientation alone
  wantReversed: boolean | undefined
}

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
 * track on it: the widest, with the block pick's hysteresis across tracks too.
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
  // a full scan of the blocks, so once, for the winner
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
    // voted over the contig the row is placed on
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
