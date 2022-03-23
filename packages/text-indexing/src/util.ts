/*
 Util functions for text indexing
*/
import { isURL, createRemoteStream } from './types/common'
import fs from 'fs'
import path from 'path'
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
  trackId: string
  name: string
  assemblyNames: string[]
  adapter:
    | Gff3TabixAdapter
    | GtfAdapter
    | VcfTabixAdapter
    | Gff3Adapter
    | VcfAdapter
  textSearching?: TextSearching
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

export async function getLocalOrRemoteStream(uri: string, out: string) {
  let stream
  let totalBytes = 0
  if (isURL(uri)) {
    const result = await createRemoteStream(uri)
    totalBytes = +(result.headers?.get('Content-Length') || 0)
    stream = result.body
  } else {
    const filename = path.isAbsolute(uri) ? uri : path.join(out, uri)
    totalBytes = fs.statSync(filename).size
    stream = fs.createReadStream(filename)
  }
  return { totalBytes, stream }
}
