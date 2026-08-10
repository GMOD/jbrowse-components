export interface GlAttributeLayout {
  name: string
  components: number
  type: 'float' | 'uint' | 'int'
  offsetBytes: number
  // true => vertexAttribIPointer (integer), false => vertexAttribPointer (float)
  integer: boolean
}

export type BlendFactor = 'one' | 'src-alpha' | 'one-minus-src-alpha' | 'zero'

// Blend equation. 'add' (default) = src*srcFactor + dst*dstFactor. 'max' =
// per-channel max(src, dst) — used by same-color AA lines so overlapping
// segments union instead of darkening under src-over accumulation. Max ignores
// blend factors entirely (and WebGPU rejects any factor but 'one' under it), so
// that variant carries none.
export type BlendState =
  | { op?: 'add'; srcFactor: BlendFactor; dstFactor: BlendFactor }
  | { op: 'max' }

/**
 * One entry of a shader's GPU binding table, as the Slang codegen reflects it.
 *
 * `kind` is spelled the way WebGPU spells it so a consumer can build a
 * `createBindGroupLayout` entry from it directly. That is the point: the binding
 * indices used to be asserted by hand in three places that never consulted the
 * shader — this HAL's two hardcoded render layouts, and the LD compute driver's
 * own. A shader's `BINDINGS` export is the reflected truth, and `pnpm
 * gen:shaders` now refuses a render shader whose table is not one the HALs bind.
 */
export interface ShaderBinding {
  index: number
  kind: 'uniform' | 'texture' | 'sampler' | 'storage' | 'read-only-storage'
  name: string
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
  // implementations — multi-texture passes are not currently supported, and
  // `pnpm gen:shaders` refuses a shader that declares a second sampler.
  textures?: readonly [TextureBinding, ...TextureBinding[]]
  // The shader's reflected binding table (its generated `BINDINGS`). The HALs
  // still build their layouts from the two shapes they implement; this carries
  // the shader's own answer so a consumer that needs it — and the parity gate —
  // reads reflection rather than a hardcoded index.
  bindings?: readonly ShaderBinding[]
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
  // Declare a region's existing buffers still current, exempting them from
  // endUpload()'s sweep. This is what lets a renderer whose sync re-runs every
  // upload skip a region whose data is reference-identical, instead of paying
  // the pack + upload only to write the same bytes back. The assertion is
  // whole-region: a caller that rewrites any of a region's passes must rewrite
  // all of them, so an emptied pass still leaves no stale buffer behind.
  retainRegion(regionKey: number): void

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

  // Register a handler for out-of-memory / over-device-limit allocation
  // failures (a buffer past `maxBufferSize`, a texture past
  // `maxTextureDimension2D`, or a frame that exhausts VRAM). The display routes
  // it to `renderError` so the user sees an error instead of a silently-blank
  // region. Validation errors (programming bugs) are NOT routed here — they
  // stay on the console.
  setErrorHandler(handler: (error: Error) => void): void

  dispose(): void
}
