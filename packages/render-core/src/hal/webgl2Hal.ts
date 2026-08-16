import { syncCanvasSize } from '../canvas2dUtils.ts'
import { canvasContextError, noteCanvasContext } from '../canvasContext.ts'
import { OomReporter } from './oomReporter.ts'
import { RegionRegistry } from './regionRegistry.ts'

import type { BlendFactor, GpuHal, PipelineDescriptor } from './types.ts'

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile error: ${info}`)
  }
  return shader
}

function createProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string,
) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource)
  let fs: WebGLShader
  try {
    fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource)
  } catch (e) {
    gl.deleteShader(vs)
    throw e
  }
  const program = gl.createProgram()
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.detachShader(program, vs)
  gl.detachShader(program, fs)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program link error: ${info}`)
  }
  return program
}

function bindUniformBlock(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  blockName: string,
  bindingPoint: number,
) {
  const idx = gl.getUniformBlockIndex(program, blockName)
  if (idx !== gl.INVALID_INDEX) {
    gl.uniformBlockBinding(program, idx, bindingPoint)
  }
}

// Set `DEBUG.webgl2 = true` in devtools (or `?webgl2-debug=1` in URL) to
// enable verbose logging. Kept guarded so production builds stay quiet.
function debugEnabled() {
  if (typeof window === 'undefined') {
    return false
  }
  const w = window as typeof window & { DEBUG?: { webgl2?: boolean } }
  if (w.DEBUG?.webgl2) {
    return true
  }
  return /(?:\?|&)webgl2-debug=1\b/.test(window.location.search)
}

function glErrorName(gl: WebGL2RenderingContext, code: number) {
  if (code === gl.NO_ERROR) {
    return 'NO_ERROR'
  }
  if (code === gl.INVALID_ENUM) {
    return 'INVALID_ENUM'
  }
  if (code === gl.INVALID_VALUE) {
    return 'INVALID_VALUE'
  }
  if (code === gl.INVALID_OPERATION) {
    return 'INVALID_OPERATION'
  }
  if (code === gl.INVALID_FRAMEBUFFER_OPERATION) {
    return 'INVALID_FRAMEBUFFER_OPERATION'
  }
  if (code === gl.OUT_OF_MEMORY) {
    return 'OUT_OF_MEMORY'
  }
  if (code === gl.CONTEXT_LOST_WEBGL) {
    return 'CONTEXT_LOST_WEBGL'
  }
  return `0x${code.toString(16)}`
}

function glBlendFactor(
  gl: WebGL2RenderingContext,
  factor: BlendFactor,
): number {
  switch (factor) {
    case 'one':
      return gl.ONE
    case 'zero':
      return gl.ZERO
    case 'src-alpha':
      return gl.SRC_ALPHA
    case 'one-minus-src-alpha':
      return gl.ONE_MINUS_SRC_ALPHA
  }
}

interface TextureState {
  texture: WebGLTexture | null
  unit: number
  // uniformLoc is not stored — the sampler unit is set once when the pass is
  // compiled and never changes, so per-draw uniform1i is skipped.
}

interface PassState {
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  descriptor: PipelineDescriptor
  textureState: TextureState | null
  attrLocs: number[]
}

interface RegionPassBuffer {
  vbo: WebGLBuffer
  count: number
}

// Module-scope lifecycle tracking — Firefox caps active WebGL contexts
// around 16 and Chrome around 8. Context leaks force the oldest contexts to
// lose. These counters surface the leak when it happens.
let totalCreated = 0
let totalDisposed = 0

// The vertex-buffer ceiling this HAL refuses past, in bytes.
//
// WebGL2 exposes no max-buffer-size parameter, so unlike WebGPU there is
// nothing to ask — but "ask the driver" was never what the guard was for. Its
// job is to turn one pathological upload into the "zoom in" banner, and without
// it the same upload that banners on WebGPU takes Chrome's context down here
// instead. That is strictly worse than a blank track on a page at the context
// ceiling: the loss evicts a sibling, whose recovery evicts another, and
// GPU_CONTEXT_BUDGET.md is that cascade.
//
// 256 MiB is WebGPU's *spec default* `maxBufferSize`. It is not parity with
// what the WebGPU backend actually refuses at: `gpuDevice.acquire` raises the
// limit to `adapter.limits.maxBufferSize`, which is 1 GiB on the Firefox
// Nightly / Intel UHD 630 this was checked on, so WebGL2 is the stricter of
// the two and a region can banner here while rendering there. That asymmetry
// is accepted — a quarter-gigabyte single vertex buffer is not something to
// hand an API that answers a failed allocation by dropping the context.
//
// Deliberately a ceiling and not a budget: it catches the single upload
// nothing else bounds, and says nothing about the total, which is
// ARCHITECTURAL_LIMITS.md §"No session-level GPU memory budget".
const MAX_VERTEX_BUFFER_BYTES = 256 * 1024 * 1024

// Behavioral parity with WebGPUHal is enforced by tests, not by this file:
// products/jbrowse-web/browser-tests/compare-backends.ts pixel-diffs webgl vs
// webgpu vs canvas2d output, and shared buffer bookkeeping is covered by
// hal/regionRegistry.test.ts. Neither HAL is where attribute layout is checked —
// `assertVertexInputsMatch` does that at `pnpm gen:shaders` time, per shader and
// per target. Mirror any behavior change in webgpuHal.ts.
export class WebGL2Hal implements GpuHal {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private descriptors: Map<string, PipelineDescriptor>
  // Compiled passes, filled on demand by `getPass`. A pass whose program failed
  // to build caches `null` so the failure is reported once, not every frame.
  private passes: Map<string, PassState | null>
  private regions: RegionRegistry<RegionPassBuffer>
  private ubo: WebGLBuffer
  private debug = false
  private instanceId = 0
  private firstDrawSeen = new Set<string>()

  // Guards dispose() against double invocation (pagehide + React cleanup can
  // both fire) so the disposed-counter telemetry stays honest and gl.delete*
  // isn't called twice on the same handle.
  private disposed = false

  // Latched on context loss, never cleared. GL objects from before the loss are
  // invalid even after restore — isContextLost()===false by then, so a live
  // check alone can't guard dispose().
  private contextWasLost = false

  private contextLostListener: ((e: Event) => void) | null = null
  private contextRestoredListener: (() => void) | null = null

  private oom = new OomReporter('WebGL2Hal')

  private checkGlError(label: string) {
    if (!this.debug) {
      return
    }
    const err = this.gl.getError()
    if (err !== this.gl.NO_ERROR) {
      console.error(
        `[WebGL2Hal] GL error at "${label}": ${glErrorName(this.gl, err)}`,
      )
    }
  }

  constructor(
    canvas: HTMLCanvasElement,
    descriptors: PipelineDescriptor[],
    uniformByteSize: number,
  ) {
    this.canvas = canvas
    this.debug = debugEnabled()
    totalCreated += 1
    this.instanceId = totalCreated
    if (this.debug) {
      console.warn(
        `[WebGL2Hal #${this.instanceId}] init (live=${totalCreated - totalDisposed}/${totalCreated}, passes declared=${descriptors.length}, compiled on first draw)`,
      )
    }
    const onContextLost = (e: Event) => {
      const ev = e as WebGLContextEvent
      console.error(
        `[WebGL2Hal #${this.instanceId}] context LOST (statusMessage="${ev.statusMessage}", live=${totalCreated - totalDisposed})`,
      )
      this.contextWasLost = true
      e.preventDefault()
    }
    const onContextRestored = () => {
      console.warn(`[WebGL2Hal #${this.instanceId}] context restored`)
    }
    canvas.addEventListener('webglcontextlost', onContextLost, false)
    canvas.addEventListener('webglcontextrestored', onContextRestored, false)
    this.contextLostListener = onContextLost
    this.contextRestoredListener = onContextRestored
    // premultipliedAlpha:true is required for correct AA edge blending.
    // The canvas is cleared to (0,0,0,0) and drawn with SRC_ALPHA,ONE_MINUS_SRC_ALPHA
    // blend, which produces premultiplied-alpha values in the framebuffer
    // (edge pixel: rgb = color*alpha, a = alpha).  With premultipliedAlpha:true
    // the browser compositor reads those as premultiplied and composites correctly:
    //   output = fb.rgb + bg*(1-fb.a)
    // With premultipliedAlpha:false the compositor treats them as straight alpha and
    // multiplies rgb by alpha a second time, making AA edges appear too dark.
    // The WebGPU HAL uses alphaMode:'premultiplied' for the same reason.
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      premultipliedAlpha: true,
    })
    if (!gl) {
      // Was a bare 'WebGL2 not supported', which is the wrong diagnosis for the
      // case that actually reaches here in production: a re-init on a canvas the
      // WebGPU rung already committed. See canvasContext.ts.
      throw canvasContextError(canvas, 'webgl2')
    }
    noteCanvasContext(canvas, 'webgl2')
    this.gl = gl

    this.ubo = gl.createBuffer()!
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferData(gl.UNIFORM_BUFFER, uniformByteSize, gl.DYNAMIC_DRAW)

    this.regions = new RegionRegistry<RegionPassBuffer>(buf => {
      if (!this.contextWasLost && !gl.isContextLost()) {
        gl.deleteBuffer(buf.vbo)
      }
    })

    this.descriptors = new Map(descriptors.map(d => [d.id, d]))
    this.passes = new Map()

    // Programs are built on first use (see `getPass`), not here: a renderer
    // declares every pass it could ever draw — alignments alone declares 21,
    // most of them behind a colorBy/arc/per-base setting — and linking one
    // costs tens of ms of driver time on the main thread. A profile of a
    // three-track LGV linked 29 programs and drew with 14.
    //
    // The first descriptor still links eagerly as a canary, so a GL stack that
    // can't compile our shaders at all throws from the constructor and
    // `createGpuHal` falls back to Canvas2D — the ladder only runs at
    // construction. Per-pass compile failures after that are caught in
    // `getPass` and surfaced through the error handler.
    const canary = descriptors[0]
    if (canary) {
      this.compilePass(canary)
    }

    gl.enable(gl.BLEND)
  }

  private compilePass(desc: PipelineDescriptor): PassState {
    const gl = this.gl
    const fragShader = desc.glslFragmentOverride ?? desc.glslFragment
    const program = createProgram(gl, desc.glslVertex, fragShader)
    bindUniformBlock(gl, program, 'Uniforms', 0)
    this.checkGlError(`link pass "${desc.id}"`)

    const attrLocs = desc.vertexAttributes.map(attr =>
      gl.getAttribLocation(program, attr.name),
    )
    if (this.debug) {
      const pairs = desc.vertexAttributes.map(
        (a, i) => `${a.name}@${attrLocs[i]}`,
      )
      console.warn(
        `[WebGL2Hal] pass "${desc.id}" stride=${desc.instanceStride} attrs: ${pairs.join(', ')}`,
      )
      const missing = desc.vertexAttributes.filter((_, i) => attrLocs[i]! < 0)
      if (missing.length > 0) {
        console.warn(
          `[WebGL2Hal] pass "${desc.id}" missing attribute locations: ${missing.map(a => a.name).join(', ')}`,
        )
      }
    }
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    for (const loc of attrLocs) {
      if (loc >= 0) {
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribDivisor(loc, 1)
      }
    }
    gl.bindVertexArray(null)

    let textureState: TextureState | null = null
    const tb = desc.textures?.[0]
    if (tb) {
      // Bind the sampler uniform to the texture unit once — it never changes.
      gl.useProgram(program)
      gl.uniform1i(
        gl.getUniformLocation(program, tb.glUniformName),
        tb.glTextureUnit,
      )
      textureState = { texture: null, unit: tb.glTextureUnit }
    }

    const state: PassState = {
      program,
      vao,
      descriptor: desc,
      textureState,
      attrLocs,
    }
    this.passes.set(desc.id, state)
    return state
  }

  // Compiled pass for `passId`, building it the first time it's asked for.
  // Returns undefined for an unknown id or a pass whose program failed to link.
  private getPass(passId: string) {
    const existing = this.passes.get(passId)
    if (existing !== undefined) {
      return existing ?? undefined
    }
    const desc = this.descriptors.get(passId)
    if (!desc) {
      return undefined
    }
    try {
      return this.compilePass(desc)
    } catch (e) {
      this.passes.set(passId, null)
      this.oom.report(
        `#${this.instanceId} could not build the "${passId}" shader on this GPU: ${e instanceof Error ? e.message : String(e)}`,
      )
      return undefined
    }
  }

  resize(width: number, height: number) {
    syncCanvasSize(this.canvas, width, height)
  }

  setErrorHandler(handler: (error: Error) => void) {
    this.oom.setHandler(handler)
  }

  uploadBuffer(
    regionKey: number,
    passId: string,
    data: ArrayBuffer | ArrayBufferView,
    count: number,
  ) {
    const gl = this.gl
    this.regions.deleteBuffer(regionKey, passId)
    if (count === 0) {
      return
    }
    // A fixed ceiling rather than a queried one — see MAX_VERTEX_BUFFER_BYTES
    // for why this exists at all and why the number is WebGPU's. Past it, an
    // unguarded bufferData loses the context in Chrome and throws RangeError in
    // Firefox; neither is a getError() case, so this is the only place the
    // display can be told. Below it the upload stays unchecked, exactly as
    // before: no per-upload sync flush.
    if (data.byteLength > MAX_VERTEX_BUFFER_BYTES) {
      this.oom.report(
        `This region has too much data to render on this GPU — zoom in. (vertex buffer ${data.byteLength} bytes exceeds the ${MAX_VERTEX_BUFFER_BYTES}-byte WebGL2 ceiling)`,
      )
      return
    }
    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    this.regions.set(regionKey, passId, { vbo, count })
  }

  getBufferCount(regionKey: number, passId: string) {
    return this.regions.get(regionKey, passId)?.count ?? 0
  }

  deleteBuffer(regionKey: number, passId: string) {
    this.regions.deleteBuffer(regionKey, passId)
  }

  deleteRegion(regionKey: number) {
    this.regions.deleteRegion(regionKey)
  }

  pruneRegions(active: Iterable<number>) {
    this.regions.prune(active)
  }

  beginUpload() {
    this.regions.beginUpload()
  }

  endUpload() {
    this.regions.endUpload()
  }

  retainRegion(regionKey: number) {
    this.regions.retainRegion(regionKey)
  }

  uploadTexture(
    passId: string,
    data: Uint8Array,
    width: number,
    height: number,
  ) {
    const gl = this.gl
    // Read the binding off the descriptor so a pass with no texture never
    // triggers a compile just to be told it has nothing to upload to.
    const tb = this.descriptors.get(passId)?.textures?.[0]
    if (!tb) {
      return
    }
    const ts = this.getPass(passId)?.textureState
    if (!ts) {
      return
    }
    const maxDim = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE))
    if (width > maxDim || height > maxDim) {
      this.oom.report(
        `This region is too large to render on this GPU — zoom in. (texture ${width}×${height} exceeds max texture size ${maxDim})`,
      )
      return
    }
    if (ts.texture) {
      gl.deleteTexture(ts.texture)
    }
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data,
    )
    const filter = tb.filter === 'linear' ? gl.LINEAR : gl.NEAREST
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    ts.texture = tex
  }

  writeUniforms(data: ArrayBuffer) {
    const gl = this.gl
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.ubo)
  }

  beginFrame(clearR: number, clearG: number, clearB: number, clearA = 1) {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.disable(gl.SCISSOR_TEST)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(clearR, clearG, clearB, clearA)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  setScissor(x: number, y: number, w: number, h: number) {
    const gl = this.gl
    gl.enable(gl.SCISSOR_TEST)
    gl.scissor(x, this.canvas.height - y - h, w, h)
  }

  clearScissor() {
    this.gl.disable(this.gl.SCISSOR_TEST)
  }

  setViewport(x: number, y: number, w: number, h: number) {
    this.gl.viewport(x, this.canvas.height - y - h, w, h)
  }

  clearViewport() {
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
  }

  drawPass(passId: string, regionKey: number, bufferPassId?: string) {
    const gl = this.gl
    // Buffer first, program second: a pass with nothing to draw must not be
    // the reason its shader gets compiled.
    const regionBuf = this.regions.get(regionKey, bufferPassId ?? passId)
    if (!regionBuf || regionBuf.count === 0) {
      return
    }
    const pass = this.getPass(passId)
    if (!pass) {
      return
    }

    this.applyBlendState(pass.descriptor)
    gl.useProgram(pass.program)
    gl.bindVertexArray(pass.vao)
    this.bindAttributes(pass, regionBuf.vbo)
    this.bindTextures(pass)
    const topo = pass.descriptor.topology ?? 'triangle-list'
    const glMode =
      topo === 'triangle-strip'
        ? gl.TRIANGLE_STRIP
        : topo === 'line-list'
          ? gl.LINES
          : gl.TRIANGLES
    gl.drawArraysInstanced(
      glMode,
      0,
      pass.descriptor.verticesPerInstance,
      regionBuf.count,
    )
    if (this.debug && !this.firstDrawSeen.has(passId)) {
      this.firstDrawSeen.add(passId)
      const err = gl.getError()
      console.warn(
        `[WebGL2Hal #${this.instanceId}] first draw pass="${passId}" verts=${pass.descriptor.verticesPerInstance} instances=${regionBuf.count} err=${glErrorName(gl, err)}`,
      )
    }

    gl.bindVertexArray(null)
  }

  endFrame() {
    const gl = this.gl
    gl.disable(gl.SCISSOR_TEST)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
  }

  dispose() {
    if (this.disposed) {
      if (this.debug) {
        console.warn(
          `[WebGL2Hal #${this.instanceId}] dispose() called but already disposed`,
        )
      }
      return
    }
    this.disposed = true
    const gl = this.gl
    totalDisposed += 1
    if (this.debug) {
      console.warn(
        `[WebGL2Hal #${this.instanceId}] DISPOSING context (live=${totalCreated - totalDisposed}/${totalCreated})`,
      )
    }

    // Remove canvas event listeners to prevent closure references from keeping
    // the context alive after disposal. This is critical for test suites where
    // multiple contexts are created in sequence (e.g. Puppeteer page navigation).
    // Double-dispose is short-circuited above, so listeners are guaranteed set.
    if (this.contextLostListener) {
      this.canvas.removeEventListener(
        'webglcontextlost',
        this.contextLostListener,
      )
    }
    if (this.contextRestoredListener) {
      this.canvas.removeEventListener(
        'webglcontextrestored',
        this.contextRestoredListener,
      )
    }

    this.regions.deleteAll()
    if (!this.contextWasLost && !gl.isContextLost()) {
      for (const pass of this.passes.values()) {
        if (pass) {
          gl.deleteVertexArray(pass.vao)
          gl.deleteProgram(pass.program)
          if (pass.textureState?.texture) {
            gl.deleteTexture(pass.textureState.texture)
          }
        }
      }
      gl.deleteBuffer(this.ubo)
    }
    this.passes.clear()

    // Firefox appears to treat WEBGL_lose_context.loseContext() as a
    // driver-wide reset: calling it on one disposed HAL synchronously
    // knocks out sibling live contexts too, so tracks go blank en masse.
    // Chrome only needs this as a test-suite optimisation; for production we
    // let the browser reclaim the context when the canvas is GC'd. If we
    // need explicit release again, gate it on navigator.userAgent.
  }

  private applyBlendState(desc: PipelineDescriptor) {
    const gl = this.gl
    if (!desc.blend) {
      gl.disable(gl.BLEND)
      return
    }
    gl.enable(gl.BLEND)
    const bs = desc.blendState
    if (bs?.op === 'max') {
      // MIN/MAX ignore blend factors: the framebuffer keeps the per-channel
      // max(src, dst). Used by same-color AA lines so overlapping segments union
      // instead of darkening. Reset explicitly below for every other pass.
      gl.blendEquation(gl.MAX)
    } else {
      gl.blendEquation(gl.FUNC_ADD)
      // RGB and alpha get different blend factors (blendFuncSeparate):
      //   RGB:   out = src_rgb * srcFactor + dst_rgb * dstFactor  (default: src-alpha / 1-src-alpha)
      //   Alpha: out = src_alpha * 1 + dst_alpha * (1 - src_alpha)
      // The alpha channel uses ONE/ONE_MINUS_SRC_ALPHA regardless of the custom blend state;
      // using the RGB srcFactor for alpha too would give out_alpha = src_alpha² + ..., which is wrong.
      const src = bs ? glBlendFactor(gl, bs.srcFactor) : gl.SRC_ALPHA
      const dst = bs ? glBlendFactor(gl, bs.dstFactor) : gl.ONE_MINUS_SRC_ALPHA
      gl.blendFuncSeparate(src, dst, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    }
  }

  private bindTextures(pass: PassState) {
    const gl = this.gl
    const ts = pass.textureState
    if (ts?.texture) {
      gl.activeTexture(gl.TEXTURE0 + ts.unit)
      gl.bindTexture(gl.TEXTURE_2D, ts.texture)
      // sampler uniform set once at construction — no uniform1i here
    }
  }

  private bindAttributes(pass: PassState, vbo: WebGLBuffer) {
    const gl = this.gl
    const desc = pass.descriptor
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)

    for (let i = 0; i < desc.vertexAttributes.length; i++) {
      const loc = pass.attrLocs[i]!
      if (loc < 0) {
        continue
      }
      const attr = desc.vertexAttributes[i]!
      if (attr.integer) {
        const glType = attr.type === 'uint' ? gl.UNSIGNED_INT : gl.INT
        gl.vertexAttribIPointer(
          loc,
          attr.components,
          glType,
          desc.instanceStride,
          attr.offsetBytes,
        )
      } else {
        gl.vertexAttribPointer(
          loc,
          attr.components,
          gl.FLOAT,
          false,
          desc.instanceStride,
          attr.offsetBytes,
        )
      }
    }
  }
}
