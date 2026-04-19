import type { DotplotGeometryData } from './dotplotBackendTypes.ts'
import type { Feature, ViewSnap } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface DotplotFeatPos {
  p11: number
  p12: number
  p21: number
  p22: number
  f: Feature
  cigar: string[]
}

export interface DotplotRenderModel extends IAnyStateTreeNode {
  geometry: DotplotGeometryData | undefined
  error: unknown
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

export interface DotplotWebGLGeometryArgs {
  features: DotplotFeatureData[]
  hViewSnap: ViewSnap
  vViewSnap: ViewSnap
  sessionId: string
}

export interface DotplotWebGLGeometryResult {
  p11_offsetPx: Float32Array
  p12_offsetPx: Float32Array
  p21_offsetPx: Float32Array
  p22_offsetPx: Float32Array
  featureIds: string[]
  cigars: string[]
}
