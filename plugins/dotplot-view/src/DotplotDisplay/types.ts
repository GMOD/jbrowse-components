import type { DotplotGeometryData } from './dotplotRenderingBackendTypes.ts'
import type { DotplotFeaturesAndPositionsResult } from './executeDotplotFeaturesAndPositions.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// What the display holds after a fetch: the RPC result minus the two
// skipped-refName lists, which the fetch autorun consumes on arrival (to decide
// whether the "could not be mapped" warning applies) and never stores.
//
// All position values are absolute genomic cumBp coordinates (uint32-scale
// values held in Float64Array — Float32 loses precision past ~16M bp). They
// stay absolute all the way to the GPU upload boundary, where
// instanceInterleave subtracts the per-axis `baseH`/`baseV` to get the
// window-relative Float32 the shader wants; there is no hi/lo split anywhere
// on this path. See ADR-067.
export type DotplotRpcData = Omit<
  DotplotFeaturesAndPositionsResult,
  'skippedHRefNames' | 'skippedVRefNames'
>

// What `renderSvg` reads off a DotplotDisplay. `error` is the export's terminal
// (a failed track fails the export), not something drawn — every display paints
// the one shared plot rect, so there is no box here to draw it into.
export interface DotplotRenderModel extends IStateTreeNode {
  geometry: DotplotGeometryData | undefined
  svgReady: boolean
  error: unknown
}
