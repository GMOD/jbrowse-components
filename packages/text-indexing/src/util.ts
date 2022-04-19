/*
 Util functions for text indexing
*/
export interface UriLocation {
  uri: string
  locationType: 'UriLocation'
}
export interface LocalPathLocation {
  localPath: string
  locationType: 'LocalPathLocation'
}
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

export interface Gff3TabixAdapter {
  type: 'Gff3TabixAdapter'
  gffGzLocation: UriLocation | LocalPathLocation
}

export interface Gff3Adapter {
  type: 'Gff3Adapter'
  gffLocation: UriLocation | LocalPathLocation
}
export interface GtfAdapter {
  type: 'GtfAdapter'
  gtfLocation: UriLocation | LocalPathLocation
}

export interface VcfTabixAdapter {
  type: 'VcfTabixAdapter'
  vcfGzLocation: UriLocation | LocalPathLocation
}
export interface VcfAdapter {
  type: 'VcfAdapter'
  vcfLocation: UriLocation | LocalPathLocation
}
export interface Track {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}
export interface TextSearching {
  indexingFeatureTypesToExclude?: string[]
  indexingAttributes?: string[]
  textSearchAdapter: TrixTextSearchAdapter
}

export interface TrixTextSearchAdapter {
  type: string
  textSearchAdapterId: string
  ixFilePath: UriLocation
  ixxFilePath: UriLocation
  metaFilePath: UriLocation
  assemblyNames: string[]
}

export interface Config {
  assemblies?: Assembly[]
  assembly?: Assembly
  configuration?: {}
  aggregateTextSearchAdapters?: TrixTextSearchAdapter[]
  connections?: unknown[]
  defaultSession?: {}
  tracks?: Track[]
}

export type indexType = 'aggregate' | 'perTrack'

// supported adapter types by text indexer
//  ensure that this matches the method found in @jbrowse/core/util
export function supportedIndexingAdapters(type: string) {
  return [
    'Gff3TabixAdapter',
    'VcfTabixAdapter',
    'Gff3Adapter',
    'VcfAdapter',
  ].includes(type)
}

export function createTextSearchConf(
  name: string,
  trackIds: string[],
  assemblyNames: string[],
  locationPath: string,
) {
  // const locationPath = self.sessionPath.substring(
  //   0,
  //   self.sessionPath.lastIndexOf('/'),
  // )
  return {
    type: 'TrixTextSearchAdapter',
    textSearchAdapterId: name,
    ixFilePath: {
      localPath: locationPath + `/trix/${name}.ix`,
      locationType: 'LocalPathLocation',
    },
    ixxFilePath: {
      localPath: locationPath + `/trix/${name}.ixx`,
      locationType: 'LocalPathLocation',
    },
    metaFilePath: {
      localPath: locationPath + `/trix/${name}.json`,
      locationType: 'LocalPathLocation',
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
  const configs = trackIds
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
    .filter(track => supportedIndexingAdapters(track.adapter.type))
  return configs
}
