// the shapes the CLI writes into config.json. Track is the indexer package's,
// since text-index reads the same objects add-track wrote.
import type {
  LocalPathLocation,
  Track,
  UriLocation,
} from '@jbrowse/text-indexing-core'

export type { Track } from '@jbrowse/text-indexing-core'

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

export interface TrixTextSearchAdapter {
  type: string
  textSearchAdapterId: string
  ixFilePath: UriLocation | LocalPathLocation
  ixxFilePath: UriLocation | LocalPathLocation
  assemblyNames: string[]
}

// only connectionId is fixed; the location fields and anything from --config
// vary by connection type, so they ride along in the index signature rather than
// being narrowed away when add-connection round-trips the list
export interface Connection {
  connectionId: string
  type?: string
  name?: string
  assemblyNames?: string[]
  [key: string]: unknown
}

export interface Config {
  assemblies?: Assembly[]
  assembly?: Assembly
  configuration?: Record<string, unknown>
  aggregateTextSearchAdapters?: TrixTextSearchAdapter[]
  connections?: Connection[]
  defaultSession?: Record<string, unknown>
  tracks?: Track[]
}
