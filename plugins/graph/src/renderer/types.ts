export interface SubBatch {
  positions: Float32Array
  normals: Float32Array
  thicknesses: Float32Array
  colors: Float32Array
  indices: Uint32Array
}

export interface VertexRange {
  start: number
  count: number
}

export interface RenderBatch {
  edges: SubBatch
  nodes: SubBatch
  arrows: SubBatch
  nodeVertexRanges: Map<string, VertexRange>
  edgeVertexRanges: Map<number, VertexRange>
  arrowVertexRanges: Map<number, VertexRange>
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
    target: 'edges' | 'nodes' | 'arrows',
    colors: Float32Array,
    vertexStart: number,
  ): void
  updateTransform(transform: TransformUniform): void
  render(clearColor: [number, number, number, number]): void
  destroy(): void
}
