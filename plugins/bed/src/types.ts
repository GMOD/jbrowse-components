export interface MinimalFeature {
  type: string
  start: number
  end: number
  refName: string
  [key: string]: unknown
}

export interface TranscriptFeat extends MinimalFeature {
  uniqueId: string
  thickStart: number
  thickEnd: number
  blockCount: number
  blockSizes: number[]
  chromStarts: number[]
  refName: string
  strand?: number
  subfeatures: MinimalFeature[]
}
