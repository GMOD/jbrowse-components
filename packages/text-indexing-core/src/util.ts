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

export function decodeURIComponentNoThrow(uri: string) {
  try {
    return decodeURIComponent(uri)
  } catch (e) {
    // avoid throwing exception on a failure to decode URI component
    return uri
  }
}
