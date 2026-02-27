import {
  EDGE_FRAGMENT_SHADER,
  EDGE_VERTEX_SHADER,
  FILL_FRAGMENT_SHADER,
  FILL_FRAGMENT_SHADER_PICKING,
  FILL_VERTEX_SHADER,
} from './glslShaders.ts'
import {
  EDGE_SEGMENTS,
  EDGE_VERTS_PER_INSTANCE,
  FILL_SEGMENTS,
  FILL_VERTS_PER_INSTANCE,
  INSTANCE_BYTE_SIZE,
  UNIFORM_BYTE_SIZE,
  interleaveInstances,
} from './wgslShaders.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'

function compileShader(
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

function linkProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string,
) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource)
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

const INST_ATTRIB_NAMES = ['a_inst0', 'a_inst1', 'a_inst2', 'a_inst3']

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

export class WebGLSyntenyRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private fillProgram: WebGLProgram
  private pickingProgram: WebGLProgram
  private edgeProgram: WebGLProgram
  private fillVAO: WebGLVertexArrayObject
  private pickingVAO: WebGLVertexArrayObject
  private edgeVAO: WebGLVertexArrayObject
  private ubo: WebGLBuffer
  private uniformData = new ArrayBuffer(UNIFORM_BYTE_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)

  private instanceVbo: WebGLBuffer | null = null
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
  private pickPixel = new Uint8Array(4)
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

    this.fillProgram = linkProgram(gl, FILL_VERTEX_SHADER, FILL_FRAGMENT_SHADER)
    this.pickingProgram = linkProgram(
      gl,
      FILL_VERTEX_SHADER,
      FILL_FRAGMENT_SHADER_PICKING,
    )
    this.edgeProgram = linkProgram(gl, EDGE_VERTEX_SHADER, EDGE_FRAGMENT_SHADER)

    // single UBO shared across all programs, bound to points 0 and 1
    this.ubo = gl.createBuffer()!
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferData(gl.UNIFORM_BUFFER, UNIFORM_BYTE_SIZE, gl.DYNAMIC_DRAW)

    for (const program of [
      this.fillProgram,
      this.pickingProgram,
      this.edgeProgram,
    ]) {
      bindUniformBlock(gl, program, 'Uniforms_block_1Vertex', 0)
      bindUniformBlock(gl, program, 'Uniforms_block_0Fragment', 1)
    }

    this.fillVAO = this.createInstancedVAO(this.fillProgram)
    this.pickingVAO = this.createInstancedVAO(this.pickingProgram)
    this.edgeVAO = this.createInstancedVAO(this.edgeProgram)

    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    )
  }

  private createInstancedVAO(program: WebGLProgram) {
    const gl = this.gl
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    for (const name of INST_ATTRIB_NAMES) {
      const loc = gl.getAttribLocation(program, name)
      if (loc >= 0) {
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribDivisor(loc, 1)
      }
    }
    gl.bindVertexArray(null)
    return vao
  }

  private bindInstanceBuffer(program: WebGLProgram) {
    const gl = this.gl
    if (!this.instanceVbo) {
      return
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVbo)
    for (let i = 0; i < INST_ATTRIB_NAMES.length; i++) {
      const loc = gl.getAttribLocation(program, INST_ATTRIB_NAMES[i]!)
      if (loc >= 0) {
        gl.vertexAttribPointer(
          loc,
          4,
          gl.FLOAT,
          false,
          INSTANCE_BYTE_SIZE,
          i * 16,
        )
      }
    }
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

    const interleaved = interleaveInstances(data)

    if (this.instanceVbo) {
      gl.deleteBuffer(this.instanceVbo)
      this.instanceVbo = null
    }

    if (data.instanceCount === 0) {
      return
    }

    this.instanceVbo = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVbo)
    gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW)

    for (const [vao, program] of [
      [this.fillVAO, this.fillProgram],
      [this.pickingVAO, this.pickingProgram],
      [this.edgeVAO, this.edgeProgram],
    ] as const) {
      gl.bindVertexArray(vao)
      this.bindInstanceBuffer(program)
      gl.bindVertexArray(null)
    }

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
    if (!this.instanceVbo || this.instanceCount === 0) {
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

    gl.useProgram(this.fillProgram)
    gl.bindVertexArray(this.fillVAO)
    gl.drawArraysInstanced(
      gl.TRIANGLES,
      0,
      FILL_VERTS_PER_INSTANCE,
      this.instanceCount,
    )

    if (clickedFeatureId > 0) {
      gl.useProgram(this.edgeProgram)
      gl.bindVertexArray(this.edgeVAO)
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
    if (!this.instanceVbo || this.instanceCount === 0 || !this.pickingFbo) {
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

      gl.useProgram(this.pickingProgram)
      gl.bindVertexArray(this.pickingVAO)
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
    const result =
      r === 0 && g === 0 && b === 0 ? -1 : r + g * 256 + b * 65536 - 1

    onResult?.(result)
    return result
  }

  dispose() {
    const gl = this.gl
    if (this.instanceVbo) {
      gl.deleteBuffer(this.instanceVbo)
    }
    if (this.pickingFbo) {
      gl.deleteFramebuffer(this.pickingFbo)
    }
    if (this.pickingColorTex) {
      gl.deleteTexture(this.pickingColorTex)
    }
    gl.deleteVertexArray(this.fillVAO)
    gl.deleteVertexArray(this.pickingVAO)
    gl.deleteVertexArray(this.edgeVAO)
    gl.deleteBuffer(this.ubo)
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

    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.uniformData)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.ubo)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 1, this.ubo)
  }
}
