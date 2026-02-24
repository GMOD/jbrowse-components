import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

import type { Feature } from '@jbrowse/core/util'

export interface DotplotFeatPos {
  p11: number
  p12: number
  p21: number
  p22: number
  f: Feature
  cigar: string[]
}

export interface DotplotRenderModel extends IAnyStateTreeNode {
  featPositions: DotplotFeatPos[]
  error: unknown
  featPositionsBpPerPxH: number
  featPositionsBpPerPxV: number
  alpha: number
  minAlignmentLength: number
  colorBy: string
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
