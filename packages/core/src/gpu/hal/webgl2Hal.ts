import { bindUniformBlock, createProgram } from '../webglUtils.ts'

import type { BlendState, GpuHal, PassDescriptor, RegionMeta } from './types.ts'

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
  factor: BlendState['srcFactor'],
) {
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
  uniformLoc: WebGLUniformLocation | null
}

interface PassState {
  program: WebGLProgram
  vao: WebGLVertexArrayObject
  descriptor: PassDescriptor
  textureState: TextureState | null
  attrLocs: number[]
}

interface RegionPassBuffer {
  vbo: WebGLBuffer
  count: number
}

interface RegionState {
  meta: RegionMeta
  buffers: Map<string, RegionPassBuffer>
}

// Module-scope lifecycle tracking — Firefox caps active WebGL contexts
// around 16 and Chrome around 8. Context leaks force the oldest contexts to
// lose. These counters surface the leak when it happens.
let totalCreated = 0
let totalDisposed = 0

export class WebGL2Hal implements GpuHal {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private passes: Map<string, PassState>
  private regions = new Map<number, RegionState>()
  private ubo: WebGLBuffer
  private uniformByteSize: number
  private pickingFbo: WebGLFramebuffer | null = null
  private pickingTex: WebGLTexture | null = null
  private pickingW = 0
  private pickingH = 0
  private pickPixel = new Uint8Array(4)
  private debug = false
  private instanceId = 0
  private firstDrawSeen = new Set<string>()

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
    descriptors: PassDescriptor[],
    uniformByteSize: number,
  ) {
    this.canvas = canvas
    this.uniformByteSize = uniformByteSize
    this.debug = debugEnabled()
    totalCreated += 1
    this.instanceId = totalCreated
    // Always log lifecycle — the context-leak class of bugs needs this even
    // outside debug mode, which is why these use warn instead of log.
    console.warn(
      `[WebGL2Hal #${this.instanceId}] init (live=${totalCreated - totalDisposed}/${totalCreated}, passes=${descriptors.length})`,
    )
    canvas.addEventListener(
      'webglcontextlost',
      e => {
        const ev = e as WebGLContextEvent
        console.error(
          `[WebGL2Hal #${this.instanceId}] context LOST (statusMessage="${ev.statusMessage}", live=${totalCreated - totalDisposed})`,
        )
        e.preventDefault()
      },
      false,
    )
    canvas.addEventListener(
      'webglcontextrestored',
      () => {
        console.warn(`[WebGL2Hal #${this.instanceId}] context restored`)
      },
      false,
    )
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
      throw new Error('WebGL2 not supported')
    }
    this.gl = gl

    this.ubo = gl.createBuffer()!
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferData(gl.UNIFORM_BUFFER, uniformByteSize, gl.DYNAMIC_DRAW)

    this.passes = new Map()
    for (const desc of descriptors) {
      // The 16-byte stride constraint only applies to WebGPU storage buffers.
      // WebGL2 vertex buffers just need stride to be a multiple of 4.
      const usesStorageBuffer = /\bvar\s*<\s*storage\b/.test(desc.wgslSource)
      if (usesStorageBuffer && desc.instanceStride % 16 !== 0) {
        console.error(
          `[WebGL2Hal] Pass "${desc.id}" instanceStride=${desc.instanceStride} is not a multiple of 16 — ` +
            'Chrome WebGPU will reject draws with a binding-size validation error',
        )
      }
      const fragShader = desc.glslFragmentOverride ?? desc.glslFragment
      const program = createProgram(gl, desc.glslVertex, fragShader)
      bindUniformBlock(gl, program, 'Uniforms', 0)
      this.checkGlError(`link pass "${desc.id}"`)

      const attrLocs = desc.glAttributes.map(attr =>
        gl.getAttribLocation(program, attr.name),
      )
      if (this.debug) {
        const pairs = desc.glAttributes.map(
          (a, i) => `${a.name}@${attrLocs[i]}`,
        )
        console.warn(
          `[WebGL2Hal] pass "${desc.id}" stride=${desc.instanceStride} attrs: ${pairs.join(', ')}`,
        )
        const missing = desc.glAttributes.filter((_, i) => attrLocs[i]! < 0)
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
      if (desc.textures?.length) {
        const tb = desc.textures[0]!
        const uniformLoc = gl.getUniformLocation(program, tb.glUniformName)
        textureState = { texture: null!, unit: tb.glTextureUnit, uniformLoc }
      }

      this.passes.set(desc.id, {
        program,
        vao,
        descriptor: desc,
        textureState,
        attrLocs,
      })
    }

    gl.enable(gl.BLEND)
  }

  resize(width: number, height: number) {
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1
    const pw = Math.round(width * dpr)
    const ph = Math.round(height * dpr)
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw
      this.canvas.height = ph
      this.canvas.style.width = `${width}px`
      this.canvas.style.height = `${height}px`
    }
  }

  uploadBuffer(
    regionKey: number,
    passId: string,
    data: ArrayBuffer | ArrayBufferView,
    count: number,
  ) {
    const gl = this.gl
    const region = this.getOrCreateRegion(regionKey)
    const existing = region.buffers.get(passId)

    if (existing) {
      gl.deleteBuffer(existing.vbo)
    }

    if (count === 0) {
      region.buffers.delete(passId)
      return
    }

    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    region.buffers.set(passId, { vbo, count })
  }

  setRegionMeta(regionKey: number, meta: Partial<RegionMeta>) {
    const region = this.getOrCreateRegion(regionKey)
    if (meta.regionStart !== undefined) {
      region.meta.regionStart = meta.regionStart
    }
    if (meta.maxDepth !== undefined) {
      region.meta.maxDepth = meta.maxDepth
    }
  }

  getRegionMeta(regionKey: number) {
    return this.regions.get(regionKey)?.meta
  }

  getBufferCount(regionKey: number, passId: string) {
    return this.regions.get(regionKey)?.buffers.get(passId)?.count ?? 0
  }

  deleteBuffer(regionKey: number, passId: string) {
    const region = this.regions.get(regionKey)
    if (region) {
      const buf = region.buffers.get(passId)
      if (buf) {
        this.gl.deleteBuffer(buf.vbo)
        region.buffers.delete(passId)
      }
    }
  }

  deleteRegion(regionKey: number) {
    const region = this.regions.get(regionKey)
    if (region) {
      for (const buf of region.buffers.values()) {
        this.gl.deleteBuffer(buf.vbo)
      }
      this.regions.delete(regionKey)
    }
  }

  deleteAllRegions() {
    for (const region of this.regions.values()) {
      for (const buf of region.buffers.values()) {
        this.gl.deleteBuffer(buf.vbo)
      }
    }
    this.regions.clear()
  }

  uploadTexture(
    passId: string,
    data: Uint8Array,
    width: number,
    height: number,
  ) {
    const gl = this.gl
    const pass = this.passes.get(passId)
    if (!pass?.textureState) {
      return
    }
    const ts = pass.textureState
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
    const tb = pass.descriptor.textures![0]!
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
    const pass = this.passes.get(passId)
    if (!pass) {
      return
    }
    const regionBuf = this.regions
      .get(regionKey)
      ?.buffers.get(bufferPassId ?? passId)
    if (!regionBuf || regionBuf.count === 0) {
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

  drawPickingPass(
    passId: string,
    regionKey: number,
    instanceCount?: number,
    bufferPassId?: string,
  ) {
    const gl = this.gl
    const pass = this.passes.get(passId)
    if (!pass) {
      return
    }
    const regionBuf = this.regions
      .get(regionKey)
      ?.buffers.get(bufferPassId ?? passId)
    if (!regionBuf || regionBuf.count === 0) {
      return
    }

    this.ensurePickingFbo()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFbo)
    gl.viewport(0, 0, this.pickingW, this.pickingH)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.disable(gl.BLEND)

    gl.useProgram(pass.program)
    gl.bindVertexArray(pass.vao)
    this.bindAttributes(pass, regionBuf.vbo)
    this.bindTextures(pass)
    gl.drawArraysInstanced(
      gl.TRIANGLES,
      0,
      pass.descriptor.verticesPerInstance,
      instanceCount ?? regionBuf.count,
    )
    gl.bindVertexArray(null)

    gl.enable(gl.BLEND)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  readPickingPixel(x: number, y: number) {
    const gl = this.gl
    if (!this.pickingFbo) {
      return -1
    }
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1
    const px = Math.floor(x * dpr)
    const py = Math.floor(y * dpr)
    if (px < 0 || px >= this.pickingW || py < 0 || py >= this.pickingH) {
      return -1
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFbo)
    gl.readPixels(
      px,
      this.pickingH - py - 1,
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.pickPixel,
    )
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    const r = this.pickPixel[0]!
    const g = this.pickPixel[1]!
    const b = this.pickPixel[2]!
    return r === 0 && g === 0 && b === 0 ? -1 : r + g * 256 + b * 65536 - 1
  }

  async readPickingPixelAsync(x: number, y: number) {
    return this.readPickingPixel(x, y)
  }

  dispose() {
    const gl = this.gl
    totalDisposed += 1
    console.warn(
      `[WebGL2Hal #${this.instanceId}] dispose (live=${totalCreated - totalDisposed}/${totalCreated})`,
    )
    this.deleteAllRegions()
    for (const pass of this.passes.values()) {
      gl.deleteVertexArray(pass.vao)
      gl.deleteProgram(pass.program)
      if (pass.textureState?.texture) {
        gl.deleteTexture(pass.textureState.texture)
      }
    }
    this.passes.clear()
    gl.deleteBuffer(this.ubo)
    if (this.pickingFbo) {
      gl.deleteFramebuffer(this.pickingFbo)
      gl.deleteTexture(this.pickingTex)
    }

    // Firefox appears to treat WEBGL_lose_context.loseContext() as a
    // driver-wide reset: calling it on one disposed HAL synchronously
    // knocks out sibling live contexts too, so tracks go blank en masse.
    // Chrome only needs this as a test-suite optimisation; for production we
    // let the browser reclaim the context when the canvas is GC'd. If we
    // need explicit release again, gate it on navigator.userAgent.
  }

  private ensurePickingFbo() {
    const gl = this.gl
    const w = this.canvas.width
    const h = this.canvas.height
    if (this.pickingW === w && this.pickingH === h && this.pickingFbo) {
      return
    }
    if (this.pickingFbo) {
      gl.deleteFramebuffer(this.pickingFbo)
      gl.deleteTexture(this.pickingTex)
    }
    if (w === 0 || h === 0) {
      return
    }
    this.pickingTex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.pickingTex)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      w,
      h,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    this.pickingFbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFbo)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.pickingTex,
      0,
    )
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.pickingW = w
    this.pickingH = h
  }

  private getOrCreateRegion(regionKey: number) {
    let region = this.regions.get(regionKey)
    if (!region) {
      region = {
        meta: { regionStart: 0, maxDepth: 0 },
        buffers: new Map(),
      }
      this.regions.set(regionKey, region)
    }
    return region
  }

  private applyBlendState(desc: PassDescriptor) {
    const gl = this.gl
    if (!desc.blend) {
      gl.disable(gl.BLEND)
      return
    }
    gl.enable(gl.BLEND)
    // RGB and alpha get different blend factors (blendFuncSeparate):
    //   RGB:   out = src_rgb * srcFactor + dst_rgb * dstFactor  (default: src-alpha / 1-src-alpha)
    //   Alpha: out = src_alpha * 1 + dst_alpha * (1 - src_alpha)
    // The alpha channel uses ONE/ONE_MINUS_SRC_ALPHA regardless of the custom blend state;
    // using the RGB srcFactor for alpha too would give out_alpha = src_alpha² + ..., which is wrong.
    const bs = desc.blendState
    const src = bs ? glBlendFactor(gl, bs.srcFactor) : gl.SRC_ALPHA
    const dst = bs ? glBlendFactor(gl, bs.dstFactor) : gl.ONE_MINUS_SRC_ALPHA
    gl.blendFuncSeparate(src, dst, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  }

  private bindTextures(pass: PassState) {
    const gl = this.gl
    const ts = pass.textureState
    if (ts?.texture) {
      gl.activeTexture(gl.TEXTURE0 + ts.unit)
      gl.bindTexture(gl.TEXTURE_2D, ts.texture)
      gl.uniform1i(ts.uniformLoc, ts.unit)
    }
  }

  private bindAttributes(pass: PassState, vbo: WebGLBuffer) {
    const gl = this.gl
    const desc = pass.descriptor
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)

    for (let i = 0; i < desc.glAttributes.length; i++) {
      const loc = pass.attrLocs[i]!
      if (loc < 0) {
        continue
      }
      const attr = desc.glAttributes[i]!
      if (attr.integer) {
        const glType =
          attr.type === 'uint'
            ? gl.UNSIGNED_INT
            : attr.type === 'int'
              ? gl.INT
              : gl.UNSIGNED_INT
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
