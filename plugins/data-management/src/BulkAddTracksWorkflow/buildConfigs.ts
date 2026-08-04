import {
  UNKNOWN,
  getFileName,
  guessAdapter,
  guessTrackType,
} from '@jbrowse/core/util/tracks'

import { locationId } from './pairLocations.ts'

import type { LocationPair } from './pairLocations.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export type TrackStatus = 'ok' | 'unknown'

export interface TrackConfRow {
  id: string
  /**
   * The config minus its trackId, which is minted at submit time from the name
   * the row is actually added under (see `submitBulkTracks`).
   */
  conf: {
    type: string
    name: string
    assemblyNames: string[]
    adapter: Record<string, unknown>
  }
  name: string
  trackType: string
  adapterType: string
  /** display name of the paired index, if any */
  indexName?: string
  /** location id of the paired index, so removing a row also removes its index */
  indexId?: string
  status: TrackStatus
}

function statusOf(adapterType: string): TrackStatus {
  return adapterType === UNKNOWN ? 'unknown' : 'ok'
}

/**
 * Builds a preview track config for each data/index pair using the same
 * `guessAdapter` / `guessTrackType` extension points the single-track workflow
 * uses, so every installed format plugin is supported automatically.
 */
export function buildTrackConfigs({
  pairs,
  model,
  assembly,
}: {
  pairs: LocationPair[]
  model: IAnyStateTreeNode
  assembly: string
}): TrackConfRow[] {
  return pairs.map(pair => {
    const adapter = guessAdapter(pair.file, pair.index, '', model)
    const adapterType = adapter.type
    const trackType = guessTrackType(adapterType, model, pair.file)
    const name = getFileName(pair.file)
    return {
      id: locationId(pair.file),
      conf: {
        type: trackType,
        name,
        assemblyNames: [assembly],
        adapter,
      },
      name,
      trackType,
      adapterType,
      indexName: pair.index ? getFileName(pair.index) : undefined,
      indexId: pair.index ? locationId(pair.index) : undefined,
      status: statusOf(adapterType),
    }
  })
}
