import {
  createProgram,
  bindUniformBlock,
  enableStandardBlend,
} from '@jbrowse/core/gpu/webglUtils'
import {
  getDevicePixelRatio,
  resizeCanvas,
  createPickingFbo,
} from '@jbrowse/alignments-core'

import {
  FILL_FRAGMENT_SHADER,
  FILL_VERTEX_SHADER,
  INSTANCE_BYTE_SIZE,
  PICKING_FRAGMENT_SHADER,
  UNIFORM_BYTE_SIZE,
} from './multiSyntenyGpuShaders.ts'
import { computeRegionRenderParams } from './multiSyntenyGpuData.ts'

import type { PickingFbo } from '@jbrowse/alignments-core'
import type { MultiSyntenyGpuInstanceData } from './multiSyntenyGpuData.ts'
import type { MultiSyntenyGpuBackend } from './multiSyntenyBackendTypes.ts'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

export class WebGLMultiSyntenyRenderer implements MultiSyntenyGpuBackend {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private fillProgram: WebGLProgram
  private pickingProgram: WebGLProgram
  private fillVAO: WebGLVertexArrayObject
  private pickingVAO: WebGLVertexArrayObject
  private ubo: WebGLBuffer
  private uniformData = new ArrayBuffer(UNIFORM_BYTE_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)

  private instanceVbo: WebGLBuffer | null = null
  private instanceData: MultiSyntenyGpuInstanceData | null = null

  private pickingFboState: PickingFbo | undefined
  private pickingDirty = true
  private pickPixel = new Uint8Array(4)

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
      PICKING_FRAGMENT_SHADER,
    )

    this.ubo = gl.createBuffer()!
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferData(gl.UNIFORM_BUFFER, UNIFORM_BYTE_SIZE, gl.DYNAMIC_DRAW)

    for (const program of [this.fillProgram, this.pickingProgram]) {
      bindUniformBlock(gl, program, 'Uniforms', 0)
    }

    this.fillVAO = this.createInstancedVAO(this.fillProgram)
    this.pickingVAO = this.createInstancedVAO(this.pickingProgram)

    enableStandardBlend(gl)
  }

  private createInstancedVAO(program: WebGLProgram) {
    const gl = this.gl
    const vao = gl.createVertexArray()!
    gl.bindVertexArray(vao)
    for (const name of ['a_data0', 'a_color']) {
      const loc = gl.getAttribLocation(program, name)
      if (loc >= 0) {
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribDivisor(loc, 1)
      }
    }
    gl.bindVertexArray(null)
    return vao
  }

  private bindInstanceBuffer(program: WebGLProgram, instanceOffset = 0) {
    const gl = this.gl
    if (!this.instanceVbo) {
      return
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVbo)
    const byteOffset = instanceOffset * INSTANCE_BYTE_SIZE

    // a_data0: uvec4 at offset 0 (4 × u32 = 16 bytes)
    const dataLoc = gl.getAttribLocation(program, 'a_data0')
    if (dataLoc >= 0) {
      gl.vertexAttribIPointer(
        dataLoc,
        4,
        gl.UNSIGNED_INT,
        INSTANCE_BYTE_SIZE,
        byteOffset,
      )
    }

    // a_color: vec4 at offset 16 (4 × f32 = 16 bytes)
    const colorLoc = gl.getAttribLocation(program, 'a_color')
    if (colorLoc >= 0) {
      gl.vertexAttribPointer(
        colorLoc,
        4,
        gl.FLOAT,
        false,
        INSTANCE_BYTE_SIZE,
        byteOffset + 16,
      )
    }
  }

  resize(width: number, height: number) {
    const { pw, ph, changed } = resizeCanvas(this.canvas, width, height)
    if (changed) {
      this.pickingFboState = createPickingFbo(
        this.gl,
        pw,
        ph,
        this.pickingFboState,
      )
    }
  }

  uploadGeometry(data: MultiSyntenyGpuInstanceData) {
    const gl = this.gl
    this.instanceData = data

    if (this.instanceVbo) {
      gl.deleteBuffer(this.instanceVbo)
      this.instanceVbo = null
    }
    if (data.instanceCount === 0) {
      return
    }

    this.instanceVbo = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVbo)
    gl.bufferData(gl.ARRAY_BUFFER, data.buffer, gl.STATIC_DRAW)

    for (const [vao, program] of [
      [this.fillVAO, this.fillProgram],
      [this.pickingVAO, this.pickingProgram],
    ] as const) {
      gl.bindVertexArray(vao)
      this.bindInstanceBuffer(program)
      gl.bindVertexArray(null)
    }
    this.pickingDirty = true
  }

  render(
    contentBlocks: BaseBlock[],
    viewOffsetPx: number,
    width: number,
    height: number,
    rowHeight: number,
    labelW: number,
  ) {
    const gl = this.gl
    if (
      !this.instanceVbo ||
      !this.instanceData ||
      this.instanceData.instanceCount === 0
    ) {
      this.resize(width, height)
      gl.viewport(0, 0, this.canvas.width, this.canvas.height)
      gl.clearColor(1, 1, 1, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      return
    }

    this.resize(width, height)
    const dpr = getDevicePixelRatio()
    const logicalW = this.canvas.width / dpr
    const logicalH = this.canvas.height / dpr

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(1, 1, 1, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(this.fillProgram)
    gl.bindVertexArray(this.fillVAO)

    const rowPadding = rowHeight >= 6 ? 1 : 0

    for (const block of contentBlocks) {
      const params = computeRegionRenderParams(
        block,
        viewOffsetPx,
        this.instanceData.refNameIndex,
      )
      if (!params) {
        continue
      }

      // Skip regions entirely off-screen
      if (
        params.regionScreenLeft + params.regionScreenWidth < 0 ||
        params.regionScreenLeft > logicalW
      ) {
        continue
      }

      this.writeUniforms(
        logicalW,
        logicalH,
        rowHeight,
        labelW,
        params.bpRangeHi,
        params.bpRangeLo,
        params.bpRangeLen,
        params.regionScreenLeft,
        params.regionScreenWidth,
        rowPadding,
      )

      // WebGL2 drawArraysInstanced has no firstInstance param, so rebind
      // the instance buffer with a byte offset for this region's features
      this.bindInstanceBuffer(this.fillProgram, params.instanceOffset)

      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, params.instanceCount)
    }

    gl.bindVertexArray(null)
    this.pickingDirty = true
  }

  pick(_x: number, _y: number) {
    if (!this.instanceVbo || !this.instanceData || !this.pickingFboState) {
      return -1
    }
    return -1
  }

  dispose() {
    const gl = this.gl
    if (this.instanceVbo) {
      gl.deleteBuffer(this.instanceVbo)
    }
    if (this.pickingFboState) {
      gl.deleteFramebuffer(this.pickingFboState.fbo)
      gl.deleteTexture(this.pickingFboState.colorTex)
    }
    gl.deleteVertexArray(this.fillVAO)
    gl.deleteVertexArray(this.pickingVAO)
    gl.deleteBuffer(this.ubo)
    gl.deleteProgram(this.fillProgram)
    gl.deleteProgram(this.pickingProgram)
  }

  private writeUniforms(
    width: number,
    height: number,
    rowHeight: number,
    labelW: number,
    bpRangeHi: number,
    bpRangeLo: number,
    bpRangeLen: number,
    regionScreenLeft: number,
    regionScreenWidth: number,
    rowPadding: number,
  ) {
    const gl = this.gl
    const f = this.uniformF32
    f[0] = width
    f[1] = height
    f[2] = rowHeight
    f[3] = labelW
    f[4] = bpRangeHi
    f[5] = bpRangeLo
    f[6] = bpRangeLen
    f[7] = regionScreenLeft
    f[8] = regionScreenWidth
    f[9] = 0 // hpZero — MUST be 0.0 at runtime
    f[10] = rowPadding
    f[11] = 0
    f[12] = 0
    f[13] = 0
    f[14] = 0
    f[15] = 0

    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.uniformData)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.ubo)
  }
}
