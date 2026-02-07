import type { Feature } from '@jbrowse/core/util'

interface Pos {
  offsetPx: number
}

export interface FeatPos {
  x1: Pos
  y1: Pos
  x2: Pos
  y2: Pos
  f: Feature
}

export interface DotplotWebGLGeometryData {
  x1_offsetPx: Float32Array
  y1_offsetPx: Float32Array
  x2_offsetPx: Float32Array
  y2_offsetPx: Float32Array
  featureIds: string[]
  cigars: string[]
}
