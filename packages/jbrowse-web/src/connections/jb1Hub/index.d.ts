interface ProtoTrack {
  backendVersion?: number
  baseUrl?: string
  category?: stirng
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
  useAsRefSeqStore?: boolean
}

interface Track extends ProtoTrack {
  label: string
}

interface Metadata {
  category?: string
  description?: string
  Description?: string
}

interface Feature {
  seq_id: string
  start: number
  end: number
  name?: string
}

interface Source {
  url: string
  name?: string
  type?: string
}

interface TrackMetadata {
  sources?: string | Source | (string | Source)[] | Record<string, Source>
}

interface Store extends ProtoTrack {
  name?: string
}

interface Names {
  baseUrl?: string
}

interface Include {
  url: string
  cacheBuster?: boolean
  format?: string
  version?: number
}

interface Config {
  baseUrl?: string
  cacheBuster?: boolean
  dataRoot?: string
  include?: string[]
  names?: Record<string, string>
  nameUrl?: string
  refSeqs?: string
  sourceUrl?: string
  stores?: Record<string, Store>
  trackMetadata?: TrackMetadata
  tracks?: Track | Track[] | Record<string, Track | ProtoTrack>
}
