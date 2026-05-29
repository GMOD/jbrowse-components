import type { DotplotGeometryData } from './dotplotBackendTypes.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

// All position values are absolute genomic cumBp coordinates (uint32-scale
// values held in Float64Array — Float32 loses precision past ~16M bp). Per
// project rules, hi/lo splits are confined to the GPU upload boundary.
export interface DotplotRpcData {
  p11: Float64Array
  p12: Float64Array
  p21: Float64Array
  p22: Float64Array
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
  totalFeatureCount: number
  skippedFeatureCount: number
  assembliesSwapped: boolean
}

export interface DotplotRenderModel extends IAnyStateTreeNode {
  geometry: DotplotGeometryData | undefined
  error: unknown
}
