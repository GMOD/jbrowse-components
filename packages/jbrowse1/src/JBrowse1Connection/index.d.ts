declare module '@gmod/jbrowse-core/util/tracks'

interface ProtoTrack {
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

interface RefSeq {
  name: string
  length: number
  end: number
  start: number
}

interface RefSeqs {
  url?: string
  data?: RefSeq[]
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
  refSeqs?: string | RefSeqs
  sourceUrl?: string
  stores?: Record<string, Store>
  trackMetadata?: TrackMetadata
  tracks?: Track | Track[] | Record<string, Track | ProtoTrack>
}

interface UriLocation {
  uri: string
}

interface LocalPathLocation {
  localPath: string
}

type JBLocation = UriLocation | LocalPathLocation
