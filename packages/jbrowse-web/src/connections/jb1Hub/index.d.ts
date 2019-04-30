interface ProtoTrack {
  backendVersion?: number
  baseUrl?: string
  config?: Track
  histograms?: Track
  index?: number
  label?: string
  store?: Store | string
  storeClass?: string
  type?: string
  urlTemplate?: string
  useAsRefSeqStore?: boolean
}

interface Track extends ProtoTrack {
  label: string
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
