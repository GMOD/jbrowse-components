import { getFeatureAtIndex } from '../LinearSyntenyDisplay/model.ts'
import { preferIncumbent } from '../syntenyHysteresis.ts'
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
import type { LevelPick } from './followLevelStates.ts'
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
}

interface FollowPick extends FollowCandidate {
  display: LinearSyntenyDisplayModel
  data: SyntenyFeatureData
}

// what the last settle placed from; a feature id names a block only within its
// own track, since two PAF tracks for one pair mint the same ids
export type FollowIncumbent = Pick<LevelPick, 'display' | 'target'> & {
  feat: Pick<FeatPos, 'id'>
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
  incumbent: held,
}: {
  displays: LinearSyntenyDisplayModel[]
  window: FollowWindow
  toMate: boolean
  mateAssembly?: string
  incumbent?: FollowIncumbent
}): FollowStep | undefined {
  let widest: FollowPick | undefined
  let incumbent: FollowPick | undefined
  for (const display of displays) {
    const data = display.featureData
    if (!data) {
      continue
    }
    const incumbentId = held?.display === display ? held.feat.id : undefined
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
        incumbentTarget: held?.target,
      })
  return {
    display,
    feat,
    window,
    toMate,
    hasCigar: data.hasCigar,
    windowInsideFeat: inside,
    envelope,
  }
}
