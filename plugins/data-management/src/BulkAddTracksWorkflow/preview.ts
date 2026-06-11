import { buildTrackConfigs } from './buildConfigs.ts'
import { isIndexFile, pairLocations } from './pairLocations.ts'
import { locationWarnings } from './util.ts'

import type { TrackConfRow } from './buildConfigs.ts'
import type { LocationPair } from './pairLocations.ts'
import type { FileLocation } from '@jbrowse/core/util/types'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface BulkPreview {
  pairs: LocationPair[]
  rows: TrackConfRow[]
  okRows: TrackConfRow[]
  skippedCount: number
  orphanIndexCount: number
  warnings: string[]
}

/**
 * Pure derivation from a deduped location list to everything the preview UI
 * needs: the data/index pairs, their track configs, and the counts behind the
 * orphan-index / skipped-row / URL-warning messages. Kept out of the component
 * so the (subtle) orphan accounting is testable in isolation.
 */
export function summarizeBulkInput({
  locations,
  model,
  assembly,
  adminMode,
  timestamp,
}: {
  locations: FileLocation[]
  model: IAnyStateTreeNode
  assembly: string
  adminMode: boolean
  timestamp: number
}): BulkPreview {
  const pairs = pairLocations(locations)
  const rows = buildTrackConfigs({
    pairs,
    model,
    assembly,
    adminMode,
    timestamp,
  })
  const okRows = rows.filter(row => row.status === 'ok')
  const orphanIndexCount =
    locations.filter(isIndexFile).length - pairs.filter(p => p.index).length
  return {
    pairs,
    rows,
    okRows,
    skippedCount: rows.length - okRows.length,
    orphanIndexCount,
    warnings: locationWarnings(locations),
  }
}
