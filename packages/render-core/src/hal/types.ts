import type { CanvasScale } from '../canvas2dUtils.ts'

export type { CanvasScale }

/**
 * One field of a pass's **vertex input layout** — the map from bytes in the
 * packed instance buffer to an input the shader declares. Both HALs build from
 * it: WebGPU as a `GPUVertexBufferLayout` attribute, WebGL2 as a VAO pointer.
 * Emitted from the shader by codegen as `VERTEX_ATTRIBUTES`; never hand-written.
 */
export interface VertexAttributeLayout {
  name: string
  components: number
  type: 'float' | 'uint' | 'int'
  offsetBytes: number
  // true => vertexAttribIPointer (integer), false => vertexAttribPointer (float)
  integer: boolean
}

/**
 * Samples per pixel a display's WebGPU render target is allocated at.
 *
 * **1 and 4 are the whole set the WebGPU spec permits** ("must be either 1 or
 * 4" — standard sample patterns are defined for no other count), so this is the
 * API's constraint rather than a policy of ours, and 2 is not an option to add.
 *
 * At 4 the HAL allocates a multisampled colour attachment the size of the
 * canvas and resolves it into the canvas texture; at 1 it allocates **nothing**
 * and draws straight into the canvas texture. The bytes are canvas area x dpr²
 * x samples x 4, unrelated to how much data the display holds, which is why
 * this is worth stating per display — see ARCHITECTURAL_LIMITS.md §"The MSAA
 * target is the largest per-display allocation".
 *
 * WebGL2 has no counterpart: it draws to the default framebuffer with
 * `antialias: true`, so its multisampling is the browser's choice inside the
 * browser's budget.
 */
export type SampleCount = 1 | 4

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

/**
 * A **pipeline state object (PSO)**: shaders, vertex input layout, blend state,
 * primitive topology and texture bindings, baked into one immutable
 * description. One of these compiles to exactly one `GPURenderPipeline`
 * (`webgpuHal`) or one linked program + VAO (`webgl2Hal`), up front at HAL
 * construction — never lazily mid-frame.
 *
 * `id` is the join key everything else calls a *pass*: `drawPass(id, …)` binds
 * this pipeline and issues one instanced draw, and the HAL's buffer registry is
 * keyed `(regionKey, id)`. That word does **not** mean WebGPU's render pass,
 * which is the `beginFrame`/`endFrame` bracket and happens once per frame.
 */
export interface PipelineDescriptor {
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
  vertexAttributes: readonly VertexAttributeLayout[]
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
  /**
   * Size the canvas, and report the scale its backing store actually got.
   * Callers derive every device-px rect from THAT rather than from `getDpr()`:
   * past `MAX_CANVAS_DIM_PX` the two differ, and a rect built from the true dpr
   * exceeds the target it draws into (WebGPU rejects the whole pass and the
   * track goes blank; WebGL2 clamps and paints at the wrong scale).
   */
  resize(width: number, height: number): CanvasScale

  // Replacing or deleting a buffer between `beginFrame` and `endFrame` is legal
  // on every HAL, including one the open frame has already drawn from. WebGL2
  // is immediate-mode so the old contents are already consumed; WebGPU holds
  // the `destroy()` until after the frame's submit, because destroying a buffer
  // an encoded draw references fails validation for the WHOLE command buffer
  // and drops every other track's draws in that frame with it.
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

  // Scissor and viewport control (coordinates in physical pixels, top-left
  // origin). Both take effect from the next `drawPass` and hold until changed.
  //
  // `clearScissor` / `clearViewport` restore the FULL canvas, and a HAL owes
  // that to the draws after them, not just to its own bookkeeping. WebGL2 gets
  // it for free (`disable(SCISSOR_TEST)`); WebGPU has to re-issue a whole-
  // attachment rect, because `setScissorRect` is render-pass state with no off
  // switch — see `webgpuHal`'s `applyScissor`. A HAL that merely forgets the
  // rect keeps clipping to it, which no test in tree would catch: every caller
  // clears after its last draw of the frame.
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
