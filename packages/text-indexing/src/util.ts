import path from 'path'

import { isSupportedIndexingAdapter } from '@jbrowse/core/util'
import sanitize from 'sanitize-filename'

import type { Track } from '@jbrowse/text-indexing-core'

export function createTextSearchConf(
  name: string,
  trackIds: string[],
  assemblyNames: string[],
  locationPath: string,
) {
  const base = path.join(locationPath, 'trix')
  const n = sanitize(name)
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
      localPath: path.join(base, `${n}.json`),
      locationType: 'LocalPathLocation' as const,
    },
    tracks: trackIds,
    assemblyNames,
  }
}

export function findTrackConfigsToIndex(
  tracks: Track[],
  trackIds: string[],
  assemblyName?: string,
) {
  return trackIds
    .map(trackId => {
      const currentTrack = tracks.find(t => trackId === t.trackId)
      if (!currentTrack) {
        throw new Error(`Track not found in session for trackId ${trackId}`)
      }
      return currentTrack
    })
    .filter(track =>
      assemblyName ? track.assemblyNames.includes(assemblyName) : true,
    )
    .filter(track => isSupportedIndexingAdapter(track.adapter?.type))
}
