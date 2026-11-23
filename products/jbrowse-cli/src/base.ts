// the shapes the CLI writes into config.json. Track is the indexer package's,
// since text-index reads the same objects add-track wrote.
import type {
  LocalPathLocation,
  Track as IndexerTrack,
  UriLocation,
} from '@jbrowse/text-indexing-core'

export interface AdapterConfig {
  type: string
  [key: string]: unknown
}

export interface Sequence {
  type: 'ReferenceSequenceTrack'
  trackId: string
  adapter: AdapterConfig
}

export interface Assembly {
  displayName?: string
  name: string
  aliases?: string[]
  sequence: Sequence
  refNameAliases?: {
    adapter: AdapterConfig
  }
  refNameColors?: string[]
}

export interface TrixTextSearchAdapter {
  type: string
  ixFilePath: UriLocation | LocalPathLocation
  ixxFilePath: UriLocation | LocalPathLocation
  assemblyNames: string[]
}

// what a config may already hold beside what text-index writes: any adapter
// type, or a trix index written as its `.ix`, bare or as `{ uri }`
export type SearchIndexEntry =
  | string
  | {
      type?: string
      uri?: string
      ixFilePath?: UriLocation | LocalPathLocation
      assemblyNames?: string[]
    }

export type Track = Omit<IndexerTrack, 'textSearching'> & {
  textSearching?: NonNullable<IndexerTrack['textSearching']> & {
    textSearchAdapter?: SearchIndexEntry
  }
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
  aggregateTextSearchAdapters?: SearchIndexEntry[]
  connections?: Connection[]
  defaultSession?: Record<string, unknown>
  tracks?: Track[]
}
