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
  glAttributes: readonly GlAttributeLayout[]
  // WGSL fragment entry point override (default: 'fs_main')
  wgslFragmentEntry?: string
  // GLSL fragment shader override (e.g. alternate fragment program)
  glslFragmentOverride?: string
  // primitive topology (default: 'triangle-list')
  topology?: 'triangle-list' | 'triangle-strip' | 'line-list'
  // Texture binding for this pass. Only textures[0] is wired up by both HAL
  // implementations — multi-texture passes are not currently supported.
  textures?: readonly [TextureBinding, ...TextureBinding[]]
}

export interface GpuHal {
  resize(width: number, height: number): void

  uploadBuffer(
    regionKey: number,
    passId: string,
    data: ArrayBuffer | ArrayBufferView,
    count: number,
  ): void
  getBufferCount(regionKey: number, passId: string): number
  deleteBuffer(regionKey: number, passId: string): void
  deleteRegion(regionKey: number): void
  // Delete every region whose key is not in `active`. Callers pass the set
  // of currently-needed regions; HAL prunes the rest. Lets renderers stop
  // mirroring HAL's region-tracking map for the sole purpose of computing
  // which regions to discard.
  pruneRegions(active: Iterable<number>): void

  // Open/close a full-rebuild transaction. Between beginUpload() and
  // endUpload(), every uploadBuffer call records its (region, pass); endUpload
  // destroys every instance buffer NOT rewritten in between. Lets a renderer
  // re-run all its uploads each sync and trust that a pass whose data went
  // empty (and was therefore skipped) leaves no stale buffer behind — without
  // pre-wiping regions. Optional: renderers that don't bracket their sync are
  // unaffected.
  beginUpload(): void
  endUpload(): void

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

  // Scissor and viewport control (coordinates in physical pixels, top-left origin)
  setScissor(x: number, y: number, w: number, h: number): void
  clearScissor(): void
  setViewport(x: number, y: number, w: number, h: number): void
  clearViewport(): void

  dispose(): void
}
