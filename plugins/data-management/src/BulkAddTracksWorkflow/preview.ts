import { buildTrackConfigs } from './buildConfigs.ts'
import { isIndexFile, pairLocations } from './pairLocations.ts'
import { locationWarnings } from './util.ts'

import type { TrackConfRow } from './buildConfigs.ts'
import type { FileLocation } from '@jbrowse/core/util/types'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface BulkPreview {
  rows: TrackConfRow[]
  skippedCount: number
  orphanIndexCount: number
  warnings: string[]
}

/**
 * Pure derivation from a deduped location list to everything the preview UI
 * needs: one row per data/index pair, and the counts behind the orphan-index /
 * skipped-row / URL-warning messages. Kept out of the component so the (subtle)
 * orphan accounting is testable in isolation.
 */
export function summarizeBulkInput({
  locations,
  model,
  assembly,
}: {
  locations: FileLocation[]
  model: IAnyStateTreeNode
  assembly: string
}): BulkPreview {
  const pairs = pairLocations(locations)
  const rows = buildTrackConfigs({
    pairs,
    model,
    assembly,
  })
  const orphanIndexCount =
    locations.filter(isIndexFile).length - pairs.filter(p => p.index).length
  return {
    rows,
    skippedCount: rows.filter(row => row.status !== 'ok').length,
    orphanIndexCount,
    warnings: locationWarnings(locations),
  }
}
