export interface ProtoTrack {
  backendVersion?: number
  baseUrl?: string
  category?: string
  config?: Track
  dataRoot?: string
  features?: Feature[]
  histograms?: Track
  index?: number
  key?: string
  label?: string
  metadata?: Metadata
  store?: Store | string
  storeClass?: string
  type?: string
  urlTemplate?: string
  baiUrlTemplate?: string
  craiUrlTemplate?: string
  tbiUrlTemplate?: string
  csiUrlTemplate?: string
  faiUrlTemplate?: string
  gziUrlTemplate?: string
  useAsRefSeqStore?: boolean
}

export interface Track extends ProtoTrack {
  label: string
}

export interface Metadata {
  category?: string
  description?: string
  Description?: string
}

export interface Feature {
  seq_id: string
  start: number
  end: number
  name?: string
}

export interface Source {
  url: string
  name?: string
  type?: string
}

export interface TrackMetadata {
  sources?: string | Source | (string | Source)[] | Record<string, Source>
}

export interface Store extends ProtoTrack {
  name?: string
}

export interface Names {
  baseUrl?: string
}

export interface RefSeq {
  name: string
  length: number
  end: number
  start: number
}

export interface RefSeqs {
  url?: string
  data?: RefSeq[]
}

export interface Include {
  url: string
  cacheBuster?: boolean
  format?: string
  version?: number
}

export interface Config {
  baseUrl?: string
  cacheBuster?: boolean
  dataRoot?: string
  include?: string[]
  names?: Record<string, string>
  nameUrl?: string
  refSeqs?: string | RefSeqs
  sourceUrl?: string
  stores?: Record<string, Store>
  trackMetadata?: TrackMetadata
  tracks?: Track | Track[] | Record<string, Track | ProtoTrack>
}

export interface UriLocation {
  uri: string
  baseUri?: string
  locationType: 'UriLocation'
}

export interface LocalPathLocation {
  localPath: string
  locationType: 'LocalPathLocation'
}

export type JBLocation = UriLocation | LocalPathLocation
