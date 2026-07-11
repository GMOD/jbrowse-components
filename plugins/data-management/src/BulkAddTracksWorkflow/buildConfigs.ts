import { makeTrackId } from '@jbrowse/core/util'
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
  conf: {
    trackId: string
    type: string
    name: string
    assemblyNames: string[]
    adapter: Record<string, unknown>
  }
  name: string
  trackType: string
  adapterType: string
  indexName?: string
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
  adminMode,
  timestamp,
}: {
  pairs: LocationPair[]
  model: IAnyStateTreeNode
  assembly: string
  adminMode: boolean
  timestamp: number
}): TrackConfRow[] {
  return pairs.map((pair, idx) => {
    const adapter = guessAdapter(pair.file, pair.index, '', model)
    const adapterType = adapter.type
    const trackType = guessTrackType(adapterType, model, pair.file)
    const name = getFileName(pair.file)
    const trackId = makeTrackId({ name, timestamp, adminMode, index: idx })
    return {
      id: locationId(pair.file),
      conf: {
        trackId,
        type: trackType,
        name,
        assemblyNames: [assembly],
        adapter,
      },
      name,
      trackType,
      adapterType,
      indexName: pair.index ? getFileName(pair.index) : undefined,
      status: statusOf(adapterType),
    }
  })
}
