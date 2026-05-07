import type { DotplotGeometryData } from './dotplotBackendTypes.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface DotplotRpcData {
  p11s: Float64Array
  p12s: Float64Array
  p21s: Float64Array
  p22s: Float64Array
  strands: Int8Array
  starts: Uint32Array
  ends: Uint32Array
  parsedCigars: string[][]
  identities: Float32Array
  meanScores: Float32Array
  mappingQuals: Float32Array
  refNames: string[]
  bpPerPxH: number
  bpPerPxV: number
}

export interface DotplotRenderModel extends IAnyStateTreeNode {
  geometry: DotplotGeometryData | undefined
  error: unknown
}
