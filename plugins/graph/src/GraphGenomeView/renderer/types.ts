import type { BezierCurve } from '../util/geometry.ts'

export type SubBatchKey = 'edges' | 'nodes' | 'arrows'
export const SUB_BATCH_KEYS: readonly SubBatchKey[] = [
  'edges',
  'nodes',
  'arrows',
]

// Raw bezier data for an edge — used by Canvas2DRenderer to draw native bezier
// strokes instead of rasterising the tessellated triangle mesh. GPU backends
// keep using the tessellated `edges` sub-batch for now.
export interface EdgeCurveBatch {
  curves: BezierCurve[]
  thickness: number
  color: number
}

// Interleaved per-vertex buffer laid out to match graph.generated.ts
// (stride = INSTANCE_STRIDE_BYTES, fields at FIELD_OFFSET_*). `vertexData`
// and `vertexDataU32` alias the same ArrayBuffer — the float view covers
// position / normal / thickness, the u32 view reads the packed ABGR colour
// slot. `colors` is an independent dense snapshot (1 u32 / vertex) kept so
// hover / select utilities can restore originals without deinterleaving.
export interface SubBatch {
  vertexData: Float32Array
  vertexDataU32: Uint32Array
  colors: Uint32Array
  indices: Uint32Array
  vertexCount: number
}

export interface VertexRange {
  start: number
  count: number
}

export type RenderBatch = Record<SubBatchKey, SubBatch> & {
  nodeVertexRanges: Map<string, VertexRange>
  edgeVertexRanges: Map<number, VertexRange>
  arrowVertexRanges: Map<number, VertexRange>
  // Parallel curve data per edge sub-stroke. Canvas2DRenderer iterates this
  // for native bezier rendering; GPU backends ignore it.
  edgeCurves: EdgeCurveBatch[]
}

export interface TransformUniform {
  scaleX: number
  scaleY: number
  translateX: number
  translateY: number
  viewportWidth: number
  viewportHeight: number
}

export interface Renderer {
  resize(width: number, height: number): void
  uploadGeometry(batch: RenderBatch): void
  updateSubBatchColors(
    target: SubBatchKey,
    colors: Uint32Array,
    vertexStart: number,
  ): void
  updateTransform(transform: TransformUniform): void
  render(clearColor: [number, number, number, number]): void
  destroy(): void
}
