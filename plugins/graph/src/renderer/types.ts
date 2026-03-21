export interface RenderBatch {
  positions: Float32Array
  colors: Float32Array
  indices: Uint32Array
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
  updateTransform(transform: TransformUniform): void
  render(clearColor: [number, number, number, number]): void
  destroy(): void
}
