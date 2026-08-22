import path from 'node:path'

import {
  isSupportedIndexingAdapter,
  sanitizeForFilename,
} from '@jbrowse/text-indexing-core'

import type { Track } from '@jbrowse/text-indexing-core'

export type indexType = 'aggregate' | 'perTrack'

export function createTextSearchConf(
  name: string,
  trackIds: string[],
  assemblyNames: string[],
  locationPath: string,
) {
  const base = path.join(locationPath, 'trix')
  const n = sanitizeForFilename(name)
  return {
    type: 'TrixTextSearchAdapter',
    textSearchAdapterId: name,
    ixFilePath: {
      localPath: path.join(base, `${n}.ix`),
      locationType: 'LocalPathLocation' as const,
    },
    ixxFilePath: {
      localPath: path.join(base, `${n}.ixx`),
      locationType: 'LocalPathLocation' as const,
    },
    metaFilePath: {
      localPath: path.join(base, `${n}_meta.json`),
      locationType: 'LocalPathLocation' as const,
    },
    tracks: trackIds,
    assemblyNames,
  }
}

export function findTrackConfigsToIndex(tracks: Track[], trackIds: string[]) {
  return trackIds
    .map(trackId => {
      const currentTrack = tracks.find(t => trackId === t.trackId)
      if (!currentTrack) {
        throw new Error(`Track not found in session for trackId ${trackId}`)
      }
      return currentTrack
    })
    .filter(track => isSupportedIndexingAdapter(track.adapter?.type))
}
