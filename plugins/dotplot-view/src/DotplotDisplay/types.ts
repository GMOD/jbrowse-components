import type { Feature } from '@jbrowse/core/util'

interface Pos {
  offsetPx: number
}

export interface DotplotFeatPos {
  p11: Pos
  p12: Pos
  p21: Pos
  p22: Pos
  f: Feature
  cigar: string[]
}

export interface DotplotFeatureData {
  id: string
  refName: string
  mateRefName: string
  start: number
  end: number
  mateStart: number
  mateEnd: number
  strand: number
  cigar?: string
}
