import { junctionKey } from '../../features/junctions/junctions.ts'

import type { MergedJunction } from '../../features/junctions/junctions.ts'

type ArcIdentity = Pick<
  MergedJunction,
  'refName' | 'start' | 'end' | 'split' | 'inRead'
>

// One arc per junction key. The strand stays out: it is resolved from
// whichever region reported the most reads, so a region loading later can change
// it, and a key that changed with it dropped the selection outline.
export function junctionArcKey(arc: ArcIdentity) {
  return junctionKey(arc.refName, arc.start, arc.end, arc.split, arc.inRead)
}

export const JUNCTION_FEATURE_ID_PREFIX = 'junctions-'

// Scoped by group, so selecting a junction in one sample's section does not
// outline it in every other.
export function junctionFeatureId(groupKey: string, arc: ArcIdentity) {
  return `${JUNCTION_FEATURE_ID_PREFIX}${groupKey}-${junctionArcKey(arc)}`
}
