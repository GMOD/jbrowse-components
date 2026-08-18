export interface UriLocation {
  uri: string
  locationType: 'UriLocation'
}

export interface LocalPathLocation {
  localPath: string
  locationType: 'LocalPathLocation'
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
  type?: string
  adapter?: { type: string; [key: string]: unknown }
  textSearching?: {
    indexingFeatureTypesToExclude?: string[]
    indexingAttributes?: string[]
    [key: string]: unknown
  }
  metadata?: {
    // when true, `jbrowse text-index` always skips this track (declarative
    // equivalent of passing its trackId to --excludeTracks)
    skipTextIndex?: boolean
    [key: string]: unknown
  }
  name: string
  assemblyNames: string[]
  trackId: string
  category?: string[]
  description?: string
}

export const defaultAttributesToIndex = ['Name', 'ID', 'symbol']
export const defaultFeatureTypesToExclude = ['exon', 'CDS']

export type IndexableFormat = 'gff3' | 'gtf' | 'vcf'

// single source of truth for what `jbrowse text-index` can index: which adapter
// types, where each keeps its file location, and which line parser to use.
// Everything else (the adapter dispatch, the CLI's supported() gate, the
// filename guesser) derives from this table.
export const indexableAdapters: Record<
  string,
  { locationKey: string; format: IndexableFormat }
> = {
  Gff3Adapter: { locationKey: 'gffLocation', format: 'gff3' },
  Gff3TabixAdapter: { locationKey: 'gffGzLocation', format: 'gff3' },
  GtfAdapter: { locationKey: 'gtfLocation', format: 'gtf' },
  GtfTabixAdapter: { locationKey: 'gtfGzLocation', format: 'gtf' },
  VcfAdapter: { locationKey: 'vcfLocation', format: 'vcf' },
  VcfTabixAdapter: { locationKey: 'vcfGzLocation', format: 'vcf' },
}

export function isSupportedIndexingAdapter(type = '') {
  return type in indexableAdapters
}

export interface IndexerOptions {
  config: { trackId: string }
  attributesToIndex: string[]
  inLocation: string
  outDir: string
  onStart: (totalBytes: number) => void
  onUpdate: (progressBytes: number) => void
  // throttled cancellation check; throws to abort the index mid-stream
  checkAbort?: () => void
}

export interface Gff3IndexerOptions extends IndexerOptions {
  featureTypesToExclude: string[]
}

export function decodeURIComponentNoThrow(uri: string) {
  try {
    return decodeURIComponent(uri)
  } catch {
    return uri
  }
}
