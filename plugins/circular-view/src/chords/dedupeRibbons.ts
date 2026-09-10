import { dedupe } from '@jbrowse/core/util'
import { getMate } from '@jbrowse/synteny-core'

import type { Feature } from '@jbrowse/core/util'

/**
 * One ribbon per alignment, not one per perspective. A pairwise file indexes
 * every row from both ends and a two-assembly circle asks for the regions of
 * both, so each alignment arrives twice and paints its ribbon on top of itself.
 *
 * The key is the UNORDERED pair of loci, which is what a ribbon is and the one
 * thing separating this from the adapter's `createSideDedupe`: that keys on the
 * ORIENTED alignment, so a tandem duplication's two ends each keep their own
 * half in a linear view. On the circle those two halves are one arc.
 *
 * JSON rather than a joined string: a refName is free-form text, so a key made
 * by joining on any character it may carry can be read two ways.
 */
export function ribbonIdentity(feature: Feature) {
  const mate = getMate(feature)
  const own = JSON.stringify([
    feature.get('assemblyName'),
    feature.get('refName'),
    feature.get('start'),
    feature.get('end'),
  ])
  const other = mate
    ? JSON.stringify([mate.assemblyName, mate.refName, mate.start, mate.end])
    : ''
  const [a, b] = own < other ? [own, other] : [other, own]
  return JSON.stringify([a, b, feature.get('strand') ?? 1])
}

export function dedupeRibbons(features: Feature[]) {
  return dedupe(features, ribbonIdentity)
}
