import type { DotplotGeometryData } from './dotplotBackendTypes.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface DotplotRpcData {
  p11Hi: Float32Array
  p11Lo: Float32Array
  p12Hi: Float32Array
  p12Lo: Float32Array
  p21Hi: Float32Array
  p21Lo: Float32Array
  p22Hi: Float32Array
  p22Lo: Float32Array
  padHs: Float32Array
  padVs: Float32Array
  strands: Int8Array
  starts: Uint32Array
  ends: Uint32Array
  parsedCigars: number[][]
  identities: Float32Array
  meanScores: Float32Array
  mappingQuals: Float32Array
  refNames: string[]
}

export interface DotplotRenderModel extends IAnyStateTreeNode {
  geometry: DotplotGeometryData | undefined
  error: unknown
}
