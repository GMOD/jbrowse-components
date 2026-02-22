import {
  EDGE_FRAGMENT_SHADER,
  EDGE_VERTEX_SHADER,
  FILL_FRAGMENT_SHADER,
  FILL_FRAGMENT_SHADER_PICKING,
  FILL_VERTEX_SHADER,
} from './generated/index.ts'
import {
  EDGE_SEGMENTS,
  EDGE_VERTS_PER_INSTANCE,
  FILL_SEGMENTS,
  FILL_VERTS_PER_INSTANCE,
  INSTANCE_BYTE_SIZE,
} from './syntenyShaders.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'

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
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource)
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

const UNIFORM_SIZE = 64

export class WebGLSyntenyRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private fillProgram: WebGLProgram
  private pickingProgram: WebGLProgram
  private edgeProgram: WebGLProgram
  private emptyVAO: WebGLVertexArrayObject
  private fillUbo: WebGLBuffer
  private fillFragUbo: WebGLBuffer
  private edgeUbo: WebGLBuffer
  private edgeFragUbo: WebGLBuffer
  private pickingUbo: WebGLBuffer
  private uniformData = new ArrayBuffer(UNIFORM_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)

  private instanceTexture: WebGLTexture | null = null
  private instanceCount = 0
  private nonCigarInstanceCount = 0
  private geometryBpPerPx0 = 1
  private geometryBpPerPx1 = 1
  private refOffset0 = 0
  private refOffset1 = 0

  private pickingFbo: WebGLFramebuffer | null = null
  private pickingColorTex: WebGLTexture | null = null
  private pickingW = 0
  private pickingH = 0
  private pickingDirty = true
  private lastRenderParams = {
    height: 0,
    adjOff0: 0,
    adjOff1: 0,
    scale0: 1,
    scale1: 1,
    maxOffScreenPx: 300,
    minAlignmentLength: 0,
    alpha: 1,
    hoveredFeatureId: 0,
    clickedFeatureId: 0,
  }

  private get dpr() {
    return typeof window !== 'undefined' ? window.devicePixelRatio : 2
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })
    if (!gl) {
      throw new Error('WebGL2 not supported')
    }
    this.gl = gl

    this.fillProgram = createProgram(
      gl,
      FILL_VERTEX_SHADER,
      FILL_FRAGMENT_SHADER,
    )
    this.pickingProgram = createProgram(
      gl,
      FILL_VERTEX_SHADER,
      FILL_FRAGMENT_SHADER_PICKING,
    )
    this.edgeProgram = createProgram(
      gl,
      EDGE_VERTEX_SHADER,
      EDGE_FRAGMENT_SHADER,
    )

    this.fillUbo = this.setupUbo(this.fillProgram, 'Uniforms_block_1Vertex', 0)
    this.fillFragUbo = this.setupUbo(
      this.fillProgram,
      'Uniforms_block_0Fragment',
      1,
    )
    this.edgeUbo = this.setupUbo(this.edgeProgram, 'Uniforms_block_1Vertex', 0)
    this.edgeFragUbo = this.setupUbo(
      this.edgeProgram,
      'Uniforms_block_0Fragment',
      1,
    )
    this.pickingUbo = this.setupUbo(
      this.pickingProgram,
      'Uniforms_block_1Vertex',
      0,
    )

    this.setupTextureSampler(this.fillProgram)
    this.setupTextureSampler(this.pickingProgram)
    this.setupTextureSampler(this.edgeProgram)

    this.emptyVAO = gl.createVertexArray()!

    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    )
  }

  private setupUbo(
    program: WebGLProgram,
    blockName: string,
    bindingPoint: number,
  ) {
    const gl = this.gl
    const idx = gl.getUniformBlockIndex(program, blockName)
    if (idx !== gl.INVALID_INDEX) {
      gl.uniformBlockBinding(program, idx, bindingPoint)
    }
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.UNIFORM_BUFFER, buf)
    gl.bufferData(gl.UNIFORM_BUFFER, UNIFORM_SIZE, gl.DYNAMIC_DRAW)
    return buf
  }

  private setupTextureSampler(program: WebGLProgram) {
    const gl = this.gl
    gl.useProgram(program)
    const texLoc = gl.getUniformLocation(program, 'u_instanceData')
    gl.uniform1i(texLoc, 0)
  }

  resize(width: number, height: number) {
    const dpr = this.dpr
    const pw = Math.round(width * dpr)
    const ph = Math.round(height * dpr)
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw
      this.canvas.height = ph
      this.createPickingFbo(pw, ph)
    }
  }

  private createPickingFbo(w: number, h: number) {
    const gl = this.gl
    if (w === 0 || h === 0) {
      return
    }

    if (this.pickingFbo) {
      gl.deleteFramebuffer(this.pickingFbo)
      gl.deleteTexture(this.pickingColorTex)
    }

    this.pickingColorTex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.pickingColorTex)
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
      this.pickingColorTex,
      0,
    )
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    this.pickingW = w
    this.pickingH = h
  }

  uploadGeometry(data: SyntenyInstanceData) {
    const gl = this.gl
    this.instanceCount = data.instanceCount
    this.nonCigarInstanceCount = data.nonCigarInstanceCount
    this.geometryBpPerPx0 = data.geometryBpPerPx0
    this.geometryBpPerPx1 = data.geometryBpPerPx1
    this.refOffset0 = data.refOffset0
    this.refOffset1 = data.refOffset1

    const interleaved = this.interleaveInstances(data)

    if (this.instanceTexture) {
      gl.deleteTexture(this.instanceTexture)
    }

    if (data.instanceCount === 0) {
      this.instanceTexture = null
      return
    }

    const texelsPerInstance = INSTANCE_BYTE_SIZE / 16
    const texWidth = data.instanceCount * texelsPerInstance

    this.instanceTexture = gl.createTexture()!
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.instanceTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32UI,
      texWidth,
      1,
      0,
      gl.RGBA_INTEGER,
      gl.UNSIGNED_INT,
      new Uint32Array(interleaved),
    )

    this.pickingDirty = true
  }

  render(
    offset0: number,
    offset1: number,
    height: number,
    curBpPerPx0: number,
    curBpPerPx1: number,
    maxOffScreenPx: number,
    minAlignmentLength: number,
    alpha: number,
    hoveredFeatureId: number,
    clickedFeatureId: number,
  ) {
    const gl = this.gl
    if (!this.instanceTexture || this.instanceCount === 0) {
      gl.viewport(0, 0, this.canvas.width, this.canvas.height)
      gl.clearColor(1, 1, 1, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      return
    }

    const scale0 = this.geometryBpPerPx0 / curBpPerPx0
    const scale1 = this.geometryBpPerPx1 / curBpPerPx1
    const adjOff0 = offset0 / scale0 - this.refOffset0
    const adjOff1 = offset1 / scale1 - this.refOffset1

    const { dpr } = this
    const logicalW = this.canvas.width / dpr
    const logicalH = this.canvas.height / dpr

    this.lastRenderParams = {
      height,
      adjOff0,
      adjOff1,
      scale0,
      scale1,
      maxOffScreenPx,
      minAlignmentLength,
      alpha,
      hoveredFeatureId,
      clickedFeatureId,
    }
    this.pickingDirty = true

    this.writeUniforms(
      logicalW,
      logicalH,
      height,
      adjOff0,
      adjOff1,
      scale0,
      scale1,
      maxOffScreenPx,
      minAlignmentLength,
      alpha,
      hoveredFeatureId,
      clickedFeatureId,
    )

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(1, 1, 1, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.bindVertexArray(this.emptyVAO)

    gl.useProgram(this.fillProgram)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.fillUbo)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 1, this.fillFragUbo)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.instanceTexture)
    gl.drawArraysInstanced(
      gl.TRIANGLES,
      0,
      FILL_VERTS_PER_INSTANCE,
      this.instanceCount,
    )

    if (clickedFeatureId > 0) {
      gl.useProgram(this.edgeProgram)
      gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.edgeUbo)
      gl.bindBufferBase(gl.UNIFORM_BUFFER, 1, this.edgeFragUbo)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.instanceTexture)
      gl.drawArraysInstanced(
        gl.TRIANGLES,
        0,
        EDGE_VERTS_PER_INSTANCE,
        this.nonCigarInstanceCount,
      )
    }

    gl.bindVertexArray(null)
  }

  pick(x: number, y: number, onResult?: (result: number) => void) {
    const gl = this.gl
    if (!this.instanceTexture || this.instanceCount === 0 || !this.pickingFbo) {
      return -1
    }

    const { dpr } = this

    if (this.pickingDirty) {
      const p = this.lastRenderParams
      const logicalW = this.canvas.width / dpr
      const logicalH = this.canvas.height / dpr
      this.writeUniforms(
        logicalW,
        logicalH,
        p.height,
        p.adjOff0,
        p.adjOff1,
        p.scale0,
        p.scale1,
        p.maxOffScreenPx,
        p.minAlignmentLength,
        1,
        0,
        0,
      )

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFbo)
      gl.viewport(0, 0, this.pickingW, this.pickingH)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.disable(gl.BLEND)

      gl.bindVertexArray(this.emptyVAO)
      gl.useProgram(this.pickingProgram)
      gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.pickingUbo)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.instanceTexture)
      gl.drawArraysInstanced(
        gl.TRIANGLES,
        0,
        FILL_VERTS_PER_INSTANCE,
        this.instanceCount,
      )
      gl.bindVertexArray(null)

      gl.enable(gl.BLEND)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      this.pickingDirty = false
    }

    const px = Math.floor(x * dpr)
    const py = Math.floor(y * dpr)

    if (px < 0 || px >= this.pickingW || py < 0 || py >= this.pickingH) {
      return -1
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFbo)
    const pixel = new Uint8Array(4)
    gl.readPixels(
      px,
      this.pickingH - py - 1,
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixel,
    )
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    const r = pixel[0]!
    const g = pixel[1]!
    const b = pixel[2]!
    const result =
      r === 0 && g === 0 && b === 0 ? -1 : r + g * 256 + b * 65536 - 1

    onResult?.(result)
    return result
  }

  dispose() {
    const gl = this.gl
    if (this.instanceTexture) {
      gl.deleteTexture(this.instanceTexture)
    }
    if (this.pickingFbo) {
      gl.deleteFramebuffer(this.pickingFbo)
    }
    if (this.pickingColorTex) {
      gl.deleteTexture(this.pickingColorTex)
    }
    gl.deleteVertexArray(this.emptyVAO)
    gl.deleteBuffer(this.fillUbo)
    gl.deleteBuffer(this.fillFragUbo)
    gl.deleteBuffer(this.edgeUbo)
    gl.deleteBuffer(this.edgeFragUbo)
    gl.deleteBuffer(this.pickingUbo)
    gl.deleteProgram(this.fillProgram)
    gl.deleteProgram(this.pickingProgram)
    gl.deleteProgram(this.edgeProgram)
  }

  private writeUniforms(
    logicalW: number,
    logicalH: number,
    height: number,
    adjOff0: number,
    adjOff1: number,
    scale0: number,
    scale1: number,
    maxOffScreenPx: number,
    minAlignmentLength: number,
    alpha: number,
    hoveredFeatureId: number,
    clickedFeatureId: number,
  ) {
    const gl = this.gl
    this.uniformF32[0] = logicalW
    this.uniformF32[1] = logicalH
    this.uniformF32[2] = height
    this.uniformF32[3] = adjOff0
    this.uniformF32[4] = adjOff1
    this.uniformF32[5] = scale0
    this.uniformF32[6] = scale1
    this.uniformF32[7] = maxOffScreenPx
    this.uniformF32[8] = minAlignmentLength
    this.uniformF32[9] = alpha
    this.uniformU32[10] = this.instanceCount
    this.uniformU32[11] = FILL_SEGMENTS
    this.uniformU32[12] = EDGE_SEGMENTS
    this.uniformF32[13] = hoveredFeatureId
    this.uniformF32[14] = clickedFeatureId
    this.uniformF32[15] = 0

    gl.bindBuffer(gl.UNIFORM_BUFFER, this.fillUbo)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.uniformData)
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.fillFragUbo)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.uniformData)
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.edgeUbo)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.uniformData)
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.edgeFragUbo)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.uniformData)
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.pickingUbo)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.uniformData)
  }

  private interleaveInstances(data: SyntenyInstanceData) {
    const {
      x1,
      x2,
      x3,
      x4,
      colors,
      featureIds,
      isCurves,
      queryTotalLengths,
      padTops,
      padBottoms,
      instanceCount: n,
    } = data
    const buf = new ArrayBuffer(n * INSTANCE_BYTE_SIZE)
    const f = new Float32Array(buf)
    const stride = INSTANCE_BYTE_SIZE / 4

    for (let i = 0; i < n; i++) {
      const off = i * stride
      f[off] = x1[i]!
      f[off + 1] = x2[i]!
      f[off + 2] = x3[i]!
      f[off + 3] = x4[i]!
      f[off + 4] = colors[i * 4]!
      f[off + 5] = colors[i * 4 + 1]!
      f[off + 6] = colors[i * 4 + 2]!
      f[off + 7] = colors[i * 4 + 3]!
      f[off + 8] = featureIds[i]!
      f[off + 9] = isCurves[i]!
      f[off + 10] = queryTotalLengths[i]!
      f[off + 11] = padTops[i]!
      f[off + 12] = padBottoms[i]!
      f[off + 13] = 0
      f[off + 14] = 0
      f[off + 15] = 0
    }
    return buf
  }
}
