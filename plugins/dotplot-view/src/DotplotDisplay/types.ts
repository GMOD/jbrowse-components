import type { DotplotGeometryData } from './dotplotBackendTypes.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface DotplotRpcData {
  // bp-in-region for each corner (x* on H side, y* on V side); shared
  // xRegionIdx/yRegionIdx per feature (straddlers were dropped at the
  // worker). Renderers project these against ViewProjection tables.
  p11s: Uint32Array
  p12s: Uint32Array
  p21s: Uint32Array
  p22s: Uint32Array
  xRegionIdx: Uint8Array
  yRegionIdx: Uint8Array
  strands: Int8Array
  starts: Uint32Array
  ends: Uint32Array
  parsedCigars: string[][]
  identities: Float32Array
  meanScores: Float32Array
  mappingQuals: Float32Array
  refNames: string[]
}

export interface DotplotRenderModel extends IAnyStateTreeNode {
  geometry: DotplotGeometryData | undefined
  error: unknown
}
