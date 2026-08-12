import { buildTrackConfigs } from './buildConfigs.ts'
import { pairLocations } from './pairLocations.ts'
import { locationWarnings } from './util.ts'

import type { TrackConfRow } from './buildConfigs.ts'
import type { FileLocation } from '@jbrowse/core/util/types'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface BulkPreview {
  rows: TrackConfRow[]
  /** rows whose file type nothing recognized */
  skippedCount: number
  /** rows that need the single-track workflow to be configured at all */
  needsSetupCount: number
  orphanIndexCount: number
  warnings: string[]
}

/**
 * Pure derivation from a deduped location list to everything the preview UI
 * needs: one row per data/index pair, and the counts behind the orphan-index /
 * skipped-row / URL-warning messages. Kept out of the component so it is
 * testable in isolation.
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
  const { pairs, orphanIndexes } = pairLocations(locations)
  const rows = buildTrackConfigs({
    pairs,
    model,
    assembly,
  })
  return {
    rows,
    skippedCount: rows.filter(row => row.status === 'unknown').length,
    needsSetupCount: rows.filter(row => row.status === 'needsSetup').length,
    orphanIndexCount: orphanIndexes.length,
    warnings: locationWarnings(locations),
  }
}
