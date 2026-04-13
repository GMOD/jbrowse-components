export interface GlAttributeLayout {
  name: string
  components: number
  type: 'float' | 'uint' | 'int'
  offsetBytes: number
  // true => vertexAttribIPointer (integer), false => vertexAttribPointer (float)
  integer: boolean
}

export interface BlendState {
  srcFactor: 'one' | 'src-alpha' | 'one-minus-src-alpha' | 'zero'
  dstFactor: 'one' | 'src-alpha' | 'one-minus-src-alpha' | 'zero'
}

export interface TextureBinding {
  // WebGPU binding index for the texture view (e.g. 2)
  textureBinding: number
  // WebGPU binding index for the sampler (e.g. 3)
  samplerBinding: number
  // WebGL texture unit index (e.g. 0 for TEXTURE0)
  glTextureUnit: number
  // GLSL sampler uniform name (e.g. 'u_colorRamp')
  glUniformName: string
  filter: 'linear' | 'nearest'
}

export interface PassDescriptor {
  id: string
  wgslSource: string
  glslVertex: string
  glslFragment: string
  instanceStride: number
  // 6 for quads (2 triangles), 3 for triangles
  verticesPerInstance: number
  blend: boolean
  // custom blend factors (defaults to src-alpha / one-minus-src-alpha if omitted)
  blendState?: BlendState
  glAttributes: GlAttributeLayout[]
  // if true, this pass renders to an offscreen picking target (no blend)
  picking?: boolean
  // WGSL fragment entry point override (default: 'fs_main')
  wgslFragmentEntry?: string
  // GLSL fragment shader override for picking (uses different shader for picking)
  glslFragmentOverride?: string
  // primitive topology (default: 'triangle-list')
  topology?: 'triangle-list' | 'triangle-strip' | 'line-list'
  // texture bindings for this pass
  textures?: TextureBinding[]
}

export interface RegionMeta {
  regionStart: number
  maxDepth: number
}

export interface GpuHal {
  resize(width: number, height: number): void

  uploadBuffer(
    regionKey: number,
    passId: string,
    data: ArrayBuffer | ArrayBufferView,
    count: number,
  ): void
  setRegionMeta(regionKey: number, meta: Partial<RegionMeta>): void
  getRegionMeta(regionKey: number): RegionMeta | undefined
  getBufferCount(regionKey: number, passId: string): number
  deleteBuffer(regionKey: number, passId: string): void
  deleteRegion(regionKey: number): void
  deleteAllRegions(): void

  uploadTexture(
    passId: string,
    data: Uint8Array,
    width: number,
    height: number,
  ): void

  writeUniforms(data: ArrayBuffer): void
  beginFrame(
    clearR: number,
    clearG: number,
    clearB: number,
    clearA?: number,
  ): void
  // Draw a pass. If bufferPassId is provided, use that pass's data buffer
  // instead of passId's own buffer (for sharing data between passes with
  // different pipelines/topologies).
  drawPass(passId: string, regionKey: number, bufferPassId?: string): void
  endFrame(): void

  // Render a picking pass to the offscreen target. The pass must have picking: true.
  // Optional instanceCount overrides the uploaded count (for rendering a subset).
  // Optional bufferPassId uses another pass's data buffer.
  drawPickingPass(
    passId: string,
    regionKey: number,
    instanceCount?: number,
    bufferPassId?: string,
  ): void
  // Synchronous pixel read from picking target (WebGL) or last cached result.
  readPickingPixel(x: number, y: number): number
  // Async pixel read from picking target (WebGPU mapAsync).
  readPickingPixelAsync(x: number, y: number): Promise<number>

  // Scissor and viewport control (coordinates in physical pixels, top-left origin)
  setScissor(x: number, y: number, w: number, h: number): void
  clearScissor(): void
  setViewport(x: number, y: number, w: number, h: number): void
  clearViewport(): void

  dispose(): void
}
