import { computePairedInsertSizeStats } from '../shared/computePairedInsertSizeStats.ts'
import { partitionFeatures } from '../shared/groupFeatures.ts'
import { sampleFeatures } from './filterChainFeatures.ts'

import type { WorkerFacet } from '../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

/**
 * One fetch's counted reads in the facet's lanes: the sample the coverage
 * counts, the insert-size band it measures, and the lanes keyed over it. The
 * render and the Save track data export both start here, so a read's lane in
 * the file is the one it is drawn and counted in.
 */
export function sampleLanes({
  featuresArray,
  filter,
  facet,
  jexl,
}: {
  featuresArray: Feature[]
  filter: FieldPredicate[] | undefined
  facet: WorkerFacet | undefined
  jexl: JexlInstance
}) {
  const sample = sampleFeatures(featuresArray, filter)
  const insertSizeStats = computePairedInsertSizeStats(sample)
  return {
    sample,
    insertSizeStats,
    lanes: partitionFeatures(
      sample,
      facet,
      jexl,
      facet?.pinnedInsertSizeBand ?? insertSizeStats,
    ),
  }
}
