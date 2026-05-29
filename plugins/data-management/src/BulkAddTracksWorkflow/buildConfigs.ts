import {
  UNKNOWN,
  UNSUPPORTED,
  getFileName,
  guessAdapter,
  guessTrackType,
} from '@jbrowse/core/util/tracks'

import type { LocationPair } from './pairLocations.ts'
import type { FileLocation } from '@jbrowse/core/util/types'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export type TrackStatus = 'ok' | 'unknown' | 'unsupported'

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

function locationId(loc: FileLocation) {
  if ('uri' in loc) {
    return loc.uri
  } else if ('localPath' in loc) {
    return loc.localPath
  } else if ('blobId' in loc) {
    return loc.blobId
  } else {
    return getFileName(loc)
  }
}

function statusOf(adapterType: string): TrackStatus {
  return adapterType === UNKNOWN
    ? 'unknown'
    : adapterType === UNSUPPORTED
      ? 'unsupported'
      : 'ok'
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
    const trackId = `${name.toLowerCase().replaceAll(' ', '_')}-${timestamp}-${idx}${
      adminMode ? '' : '-sessionTrack'
    }`
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
