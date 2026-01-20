import path from 'path'

import { isSupportedIndexingAdapter } from '@jbrowse/core/util'
import sanitize from 'sanitize-filename'

import type {
  LocalPathLocation,
  Track,
  UriLocation,
} from '@jbrowse/text-indexing-core'

export interface IndexedFastaAdapter {
  type: 'IndexedFastaAdapter'
  fastaLocation: UriLocation
  faiLocation: UriLocation
}

export interface BgzipFastaAdapter {
  type: 'BgzipFastaAdapter'
  fastaLocation: UriLocation
  faiLocation: UriLocation
  gziLocation: UriLocation
}

export interface TwoBitAdapter {
  type: 'TwoBitAdapter'
  twoBitLocation: UriLocation
}

export interface ChromeSizesAdapter {
  type: 'ChromSizesAdapter'
  chromSizesLocation: UriLocation
}

export interface CustomSequenceAdapter {
  type: string
}

export interface RefNameAliasAdapter {
  type: 'RefNameAliasAdapter'
  location: UriLocation
}

export interface CustomRefNameAliasAdapter {
  type: string
}

export interface Assembly {
  displayName?: string
  name: string
  aliases?: string[]
  sequence: Sequence
  refNameAliases?: {
    adapter: RefNameAliasAdapter | CustomRefNameAliasAdapter
  }
  refNameColors?: string[]
}

export interface Sequence {
  type: 'ReferenceSequenceTrack'
  trackId: string
  adapter:
    | IndexedFastaAdapter
    | BgzipFastaAdapter
    | TwoBitAdapter
    | ChromeSizesAdapter
    | CustomSequenceAdapter
}

export interface TrixTextSearchAdapter {
  type: string
  textSearchAdapterId: string
  ixFilePath: UriLocation | LocalPathLocation
  ixxFilePath: UriLocation | LocalPathLocation
  metaFilePath: UriLocation | LocalPathLocation
  assemblyNames: string[]
}

export interface TextSearching {
  indexingFeatureTypesToExclude?: string[]
  indexingAttributes?: string[]
  textSearchAdapter?: TrixTextSearchAdapter
  [key: string]: unknown
}

export interface Config {
  assemblies?: Assembly[]
  assembly?: Assembly
  configuration?: Record<string, unknown>
  aggregateTextSearchAdapters?: TrixTextSearchAdapter[]
  connections?: unknown[]
  defaultSession?: Record<string, unknown>
  tracks?: Track[]
}

export type indexType = 'aggregate' | 'perTrack'

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
