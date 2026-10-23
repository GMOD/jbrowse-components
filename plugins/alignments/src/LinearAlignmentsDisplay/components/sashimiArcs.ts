import { junctionKey } from '../../features/sashimi/junctions.ts'

import type { MergedJunction } from '../../features/sashimi/junctions.ts'

type ArcIdentity = Pick<MergedJunction, 'refName' | 'start' | 'end' | 'split'>

// One arc per junction key. The strand stays out: it is resolved from
// whichever region reported the most reads, so a region loading later can change
// it, and a key that changed with it dropped the selection outline.
export function sashimiArcKey(arc: ArcIdentity) {
  return junctionKey(arc.refName, arc.start, arc.end, arc.split)
}

export const SASHIMI_FEATURE_ID_PREFIX = 'sashimi-'

// Scoped by group, so selecting a junction in one sample's section does not
// outline it in every other.
export function sashimiFeatureId(groupKey: string, arc: ArcIdentity) {
  return `${SASHIMI_FEATURE_ID_PREFIX}${groupKey}-${sashimiArcKey(arc)}`
}
