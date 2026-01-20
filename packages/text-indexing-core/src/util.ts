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
type Loc = UriLocation | LocalPathLocation
export interface Gff3TabixAdapter {
  type: 'Gff3TabixAdapter'
  gffGzLocation: Loc
}

export interface Gff3Adapter {
  type: 'Gff3Adapter'
  gffLocation: Loc
}
export interface GtfAdapter {
  type: 'GtfAdapter'
  gtfLocation: Loc
}

export interface VcfTabixAdapter {
  type: 'VcfTabixAdapter'
  vcfGzLocation: Loc
}
export interface VcfAdapter {
  type: 'VcfAdapter'
  vcfLocation: Loc
}

export interface Track {
  adapter?: { type: string; [key: string]: unknown }
  textSearching?: TextSearching
  name: string
  assemblyNames: string[]
  trackId: string
}

export interface TextSearching {
  indexingFeatureTypesToExclude?: string[]
  indexingAttributes?: string[]
  textSearchAdapter: TrixTextSearchAdapter
}

export interface TrixTextSearchAdapter {
  type: string
  textSearchAdapterId: string
  ixFilePath: UriLocation | LocalPathLocation
  ixxFilePath: UriLocation | LocalPathLocation
  metaFilePath: UriLocation | LocalPathLocation
  assemblyNames: string[]
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

export function decodeURIComponentNoThrow(uri: string) {
  try {
    return decodeURIComponent(uri)
  } catch (e) {
    // avoid throwing exception on a failure to decode URI component
    return uri
  }
}
