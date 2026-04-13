import { bindUniformBlock, createProgram } from '../webglUtils.ts'

import type { BlendState, GpuHal, PassDescriptor, RegionMeta } from './types.ts'

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

  constructor(
    canvas: HTMLCanvasElement,
    descriptors: PassDescriptor[],
    uniformByteSize: number,
  ) {
    this.canvas = canvas
    this.uniformByteSize = uniformByteSize
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
      const fragShader = desc.glslFragmentOverride ?? desc.glslFragment
      const program = createProgram(gl, desc.glslVertex, fragShader)
      bindUniformBlock(gl, program, 'Uniforms', 0)

      const attrLocs = desc.glAttributes.map(attr =>
        gl.getAttribLocation(program, attr.name),
      )
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

    // Explicitly release the WebGL context so Chrome's GPU process frees
    // the memory immediately instead of waiting for GC.  Without this,
    // long-running test suites accumulate unreleased contexts and OOM.
    const ext = gl.getExtension('WEBGL_lose_context')
    if (ext) {
      ext.loseContext()
    }
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
