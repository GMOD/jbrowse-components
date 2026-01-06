export interface MinimalFeature {
  type: string
  start: number
  end: number
  refName: string
  uniqueId?: string
  phase?: number
  [key: string]: unknown
}

export interface TranscriptFeat {
  uniqueId: string
  start: number
  end: number
  refName: string
  type: string
  thickStart: number
  thickEnd: number
  blockCount: number
  blockSizes: number[]
  chromStarts: number[]
  strand?: number
  subfeatures: MinimalFeature[]
  [key: string]: unknown
}
