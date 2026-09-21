import { syncCanvasSize } from '../canvas2dUtils.ts'
import { canvasContextError, noteCanvasContext } from '../canvasContext.ts'
import { GpuHalBase } from './gpuHalBase.ts'

import type {
  BlendFactor,
  GpuHal,
  PipelineDescriptor,
  ShaderSource,
  TextureBinding,
  TextureSource,
} from './types.ts'

type GlslStages = Awaited<ReturnType<ShaderSource['glsl']>>

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

// `DEBUG.webgl2 = true` in devtools, or `?webgl2-debug=1`, logs verbosely.
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

// The sampler's unit is part of the program: `uniform1i` sets it once at link.
interface LinkedProgram {
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  attrLocs: number[]
}

interface PassState {
  descriptor: PipelineDescriptor
  linked: LinkedProgram
}

interface RegionPassBuffer {
  vbo: WebGLBuffer
  count: number
}

// Live-context counts for the debug log: a leaked context evicts the oldest
// once the browser's cap is reached.
let totalCreated = 0
let totalDisposed = 0

// WebGPU's spec-default `maxBufferSize`, since WebGL2 has none to query: an
// upload past it banners rather than dropping the context
// (ARCHITECTURAL_LIMITS.md).
const MAX_VERTEX_BUFFER_BYTES = 256 * 1024 * 1024

export class WebGL2Hal extends GpuHalBase<RegionPassBuffer> implements GpuHal {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  // `null` is a pass whose link failed, so it is reported once, not per frame.
  private passes = new Map<string, PassState | null>()
  private glsl: ReadonlyMap<string, GlslStages>
  // By vertex source, then fragment source, attribute names and sampler as
  // JSON: every pass id over one program shares it, and a failed link keeps
  // its error.
  private programs = new Map<string, Map<string, LinkedProgram | Error>>()
  private passTextures = new Map<string, WebGLTexture>()
  private ubo: WebGLBuffer
  // `getParameter` is a synchronous driver query; `limits()` runs per upload.
  private maxTextureDim: number
  private debug = false
  private instanceId = 0
  private firstDrawSeen = new Set<string>()

  // Never cleared: GL objects from before a loss stay invalid after restore,
  // when isContextLost() already answers false.
  private contextWasLost = false

  private contextLostListener: ((e: Event) => void) | null = null
  private contextRestoredListener: (() => void) | null = null

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

  /**
   * Loads every pass's GLSL before the context is acquired, so a load that
   * fails leaves the canvas free for Canvas2D.
   */
  static async create(
    canvas: HTMLCanvasElement,
    descriptors: PipelineDescriptor[],
  ) {
    const glsl = await Promise.all(
      descriptors.map(async d => [d.id, await d.source.glsl()] as const),
    )
    return new WebGL2Hal(canvas, descriptors, new Map(glsl))
  }

  private constructor(
    canvas: HTMLCanvasElement,
    descriptors: PipelineDescriptor[],
    glsl: ReadonlyMap<string, GlslStages>,
  ) {
    super(descriptors, 'WebGL2Hal')
    this.canvas = canvas
    this.glsl = glsl
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
    // The blend leaves premultiplied values in the framebuffer, which a
    // straight-alpha compositor would darken at AA edges; WebGPU's alphaMode
    // matches.
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      premultipliedAlpha: true,
    })
    if (!gl) {
      throw canvasContextError(canvas, 'webgl2')
    }
    noteCanvasContext(canvas, 'webgl2')
    this.gl = gl
    this.maxTextureDim = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE))

    this.ubo = gl.createBuffer()!
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferData(gl.UNIFORM_BUFFER, this.uniformByteSize, gl.DYNAMIC_DRAW)

    // Programs link on first draw (`getPass`). The first links here as a
    // canary, so a GL stack that cannot compile our shaders throws while
    // `createGpuHal` can still fall back to Canvas2D.
    const canary = descriptors[0]
    if (canary) {
      this.passes.set(canary.id, {
        descriptor: canary,
        linked: this.link(canary),
      })
    }

    gl.enable(gl.BLEND)
  }

  // Past the ceiling an unguarded bufferData loses the context in Chrome and
  // throws in Firefox, neither of them a getError() case.
  protected limits() {
    return {
      maxBufferBytes: MAX_VERTEX_BUFFER_BYTES,
      maxTextureDimensionPx: this.maxTextureDim,
    }
  }

  protected createBuffer(data: ArrayBuffer | ArrayBufferView, count: number) {
    const gl = this.gl
    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    return { vbo, count }
  }

  // No mid-frame deferral, unlike `WebGPUHal`: GL is immediate-mode, so a draw
  // already issued has consumed the buffer.
  protected destroyBuffer(buf: RegionPassBuffer) {
    const gl = this.gl
    if (!this.contextWasLost && !gl.isContextLost()) {
      gl.deleteBuffer(buf.vbo)
    }
  }

  // Throws on a failed link, and again on every later ask for that content.
  private link(desc: PipelineDescriptor): LinkedProgram {
    const gl = this.gl
    const stages = this.glsl.get(desc.id)
    if (!stages) {
      throw new Error(`no GLSL was loaded for pass "${desc.id}"`)
    }
    const { GLSL_VERTEX, GLSL_FRAGMENT } = stages
    const tb = desc.textures?.[0]
    const names = desc.vertexAttributes.map(attr => attr.name)
    const sampler = tb && [tb.glUniformName, tb.glTextureUnit]
    const key = JSON.stringify([GLSL_FRAGMENT, names, sampler])
    let byVertex = this.programs.get(GLSL_VERTEX)
    if (!byVertex) {
      byVertex = new Map()
      this.programs.set(GLSL_VERTEX, byVertex)
    }
    const known = byVertex.get(key)
    if (known instanceof Error) {
      throw known
    }
    if (known) {
      return known
    }
    let program: WebGLProgram
    try {
      program = createProgram(gl, GLSL_VERTEX, GLSL_FRAGMENT)
    } catch (e) {
      byVertex.set(key, e instanceof Error ? e : new Error(String(e)))
      throw e
    }
    bindUniformBlock(gl, program, 'Uniforms', 0)
    this.checkGlError(`link pass "${desc.id}"`)

    const attrLocs = names.map(name => gl.getAttribLocation(program, name))
    if (this.debug) {
      const pairs = names.map((name, i) => `${name}@${attrLocs[i]}`)
      console.warn(
        `[WebGL2Hal] pass "${desc.id}" stride=${desc.instanceStride} attrs: ${pairs.join(', ')}`,
      )
      const missing = names.filter((_, i) => attrLocs[i]! < 0)
      if (missing.length > 0) {
        console.warn(
          `[WebGL2Hal] pass "${desc.id}" missing attribute locations: ${missing.join(', ')}`,
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

    if (tb) {
      gl.useProgram(program)
      gl.uniform1i(
        gl.getUniformLocation(program, tb.glUniformName),
        tb.glTextureUnit,
      )
    }

    const linked = { program, vao, attrLocs }
    byVertex.set(key, linked)
    return linked
  }

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
      const pass = { descriptor: desc, linked: this.link(desc) }
      this.passes.set(passId, pass)
      return pass
    } catch (e) {
      this.passes.set(passId, null)
      this.oom.report(
        `#${this.instanceId} could not build the "${passId}" shader on this GPU: ${e instanceof Error ? e.message : String(e)}`,
      )
      return undefined
    }
  }

  resize(width: number, height: number) {
    return syncCanvasSize(this.canvas, width, height).scale
  }

  protected createTexture(
    passId: string,
    binding: TextureBinding,
    data: TextureSource,
    width: number,
    height: number,
  ) {
    const gl = this.gl
    const existing = this.passTextures.get(passId)
    if (existing) {
      gl.deleteTexture(existing)
    }
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    if (data instanceof Uint8Array) {
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
    } else {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    }
    const filter = binding.filter === 'linear' ? gl.LINEAR : gl.NEAREST
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    this.passTextures.set(passId, tex)
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
    // Buffer first, so a pass with nothing to draw links no program.
    const regionBuf = this.regions.get(regionKey, bufferPassId ?? passId)
    if (!regionBuf || regionBuf.count === 0) {
      return
    }
    const pass = this.getPass(passId)
    if (!pass) {
      return
    }

    this.applyBlendState(pass.descriptor)
    gl.useProgram(pass.linked.program)
    gl.bindVertexArray(pass.linked.vao)
    this.bindAttributes(pass, regionBuf.vbo)
    this.bindTexture(passId, pass.descriptor)
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

  protected releaseResources() {
    const gl = this.gl
    totalDisposed += 1
    if (this.debug) {
      console.warn(
        `[WebGL2Hal #${this.instanceId}] DISPOSING context (live=${totalCreated - totalDisposed}/${totalCreated})`,
      )
    }

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
      for (const byVertex of this.programs.values()) {
        for (const linked of byVertex.values()) {
          if (!(linked instanceof Error)) {
            gl.deleteVertexArray(linked.vao)
            gl.deleteProgram(linked.program)
          }
        }
      }
      for (const texture of this.passTextures.values()) {
        gl.deleteTexture(texture)
      }
      gl.deleteBuffer(this.ubo)
    }
    this.passes.clear()
    this.programs.clear()
    this.passTextures.clear()
    // No WEBGL_lose_context.loseContext(): Firefox treats it as a driver-wide
    // reset that blanks sibling live contexts, so the canvas's GC reclaims it.
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
      gl.blendEquation(gl.MAX)
    } else if (bs?.op === 'behind') {
      gl.blendEquation(gl.FUNC_ADD)
      gl.blendFuncSeparate(
        gl.ONE_MINUS_DST_ALPHA,
        gl.ONE,
        gl.ONE_MINUS_DST_ALPHA,
        gl.ONE,
      )
    } else {
      gl.blendEquation(gl.FUNC_ADD)
      // Alpha keeps ONE / ONE_MINUS_SRC_ALPHA whatever the RGB factors: the
      // RGB srcFactor on alpha would square it.
      const src = bs ? glBlendFactor(gl, bs.srcFactor) : gl.SRC_ALPHA
      const dst = bs ? glBlendFactor(gl, bs.dstFactor) : gl.ONE_MINUS_SRC_ALPHA
      gl.blendFuncSeparate(src, dst, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    }
  }

  private bindTexture(passId: string, desc: PipelineDescriptor) {
    const gl = this.gl
    const tb = desc.textures?.[0]
    const texture = tb && this.passTextures.get(passId)
    if (tb && texture) {
      gl.activeTexture(gl.TEXTURE0 + tb.glTextureUnit)
      gl.bindTexture(gl.TEXTURE_2D, texture)
    }
  }

  private bindAttributes(pass: PassState, vbo: WebGLBuffer) {
    const gl = this.gl
    const desc = pass.descriptor
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)

    for (let i = 0; i < desc.vertexAttributes.length; i++) {
      const loc = pass.linked.attrLocs[i]!
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
