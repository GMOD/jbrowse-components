import type { SyriType } from './syriUtils.ts'

export interface MultiPairFeature {
  queryGenome: string
  origRefName: string
  start: number
  end: number
  mateStart: number
  mateEnd: number
  mateRefName: string
  strand: number
  syriType: SyriType | undefined
  identity: number
  featureId: string
  segmentId: string | undefined
  cigar: string | undefined
  cs: string | undefined
}

export interface PairInfo {
  pairCount: number
  pairs: Map<number, [string, string]>
  splitThreshold: number | undefined
  mergeGap: number | undefined
}
