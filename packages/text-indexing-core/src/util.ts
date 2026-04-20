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
  adapter?: { type: string; [key: string]: unknown }
  textSearching?: {
    indexingFeatureTypesToExclude?: string[]
    indexingAttributes?: string[]
    [key: string]: unknown
  }
  name: string
  assemblyNames: string[]
  trackId: string
}

export const defaultAttributesToIndex = ['Name', 'ID']
export const defaultFeatureTypesToExclude = ['exon', 'CDS']

export const adapterLocationKey: Record<string, string> = {
  Gff3Adapter: 'gffLocation',
  Gff3TabixAdapter: 'gffGzLocation',
  VcfAdapter: 'vcfLocation',
  VcfTabixAdapter: 'vcfGzLocation',
}

export interface IndexerOptions {
  config: { trackId: string }
  attributesToIndex: string[]
  inLocation: string
  outDir: string
  onStart: (totalBytes: number) => void
  onUpdate: (progressBytes: number) => void
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
