export interface ProtoTrack {
  [key: string]: unknown
  category?: string
  config?: ProtoTrack
  features?: Feature[]
  key?: string
  label?: string
  metadata?: Metadata
  storeClass?: string
  type?: string
  urlTemplate?: string
  baiUrlTemplate?: string
  craiUrlTemplate?: string
  tbiUrlTemplate?: string
  csiUrlTemplate?: string
  faiUrlTemplate?: string
  gziUrlTemplate?: string
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

export interface Config {
  [key: string]: unknown
  dataRoot?: string
  include?: string | string[]
  tracks?: Track | Track[] | Record<string, Track | ProtoTrack>
}
