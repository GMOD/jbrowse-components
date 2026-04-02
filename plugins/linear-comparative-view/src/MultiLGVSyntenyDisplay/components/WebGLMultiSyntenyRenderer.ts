import {
  createPickingFbo,
  getDevicePixelRatio,
  resizeCanvas,
} from '@jbrowse/alignments-core'
import {
  bindUniformBlock,
  createProgram,
  enableStandardBlend,
} from '@jbrowse/core/gpu/webglUtils'

import { computeRegionRenderParams } from './multiSyntenyGpuData.ts'
import { YSCALEBAR_LABEL_OFFSET, niceNum } from './coverageUtils.ts'
import {
  COVERAGE_VERTEX_SHADER,
  FILL_FRAGMENT_SHADER,
  FILL_VERTEX_SHADER,
  INSTANCE_BYTE_SIZE,
  UNIFORM_BYTE_SIZE,
  PICKING_FRAGMENT_SHADER,
  COVERAGE_BIN_BYTE_SIZE,
} from './multiSyntenyGpuShaders.ts'

import type { MultiSyntenyGpuBackend } from './multiSyntenyBackendTypes.ts'
import type {
  MultiSyntenyGpuInstanceData,
  SyntenyCoverageData,
} from './multiSyntenyGpuData.ts'
import type { PickingFbo } from '@jbrowse/alignments-core'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

export class WebGLMultiSyntenyRenderer implements MultiSyntenyGpuBackend {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private fillProgram: WebGLProgram
  private pickingProgram: WebGLProgram
  private coverageProgram: WebGLProgram
  private fillVAO: WebGLVertexArrayObject
  private pickingVAO: WebGLVertexArrayObject
  private coverageVAO: WebGLVertexArrayObject
  private ubo: WebGLBuffer
  private uniformData = new ArrayBuffer(UNIFORM_BYTE_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)

  private instanceVbo: WebGLBuffer | null = null
  private instanceData: MultiSyntenyGpuInstanceData | null = null

  private coverageVbo: WebGLBuffer | null = null
  private coverageData: SyntenyCoverageData | null = null

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
    this.coverageProgram = createProgram(
      gl,
      COVERAGE_VERTEX_SHADER,
      FILL_FRAGMENT_SHADER,
    )

    this.ubo = gl.createBuffer()!
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferData(gl.UNIFORM_BUFFER, UNIFORM_BYTE_SIZE, gl.DYNAMIC_DRAW)

    for (const program of [this.fillProgram, this.pickingProgram, this.coverageProgram]) {
      bindUniformBlock(gl, program, 'Uniforms', 0)
    }

    this.fillVAO = this.createInstancedVAO(this.fillProgram)
    this.pickingVAO = this.createInstancedVAO(this.pickingProgram)
    this.coverageVAO = this.createCoverageVAO()

    enableStandardBlend(gl)
  }

  private createInstancedVAO(program: WebGLProgram) {
    const gl = this.gl
    const vao = gl.createVertexArray()
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

  private createCoverageVAO() {
    const gl = this.gl
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    for (const name of ['a_position', 'a_depth']) {
      const loc = gl.getAttribLocation(this.coverageProgram, name)
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

  private bindCoverageBuffer(binOffset = 0) {
    const gl = this.gl
    if (!this.coverageVbo) {
      return
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.coverageVbo)
    const byteOffset = binOffset * COVERAGE_BIN_BYTE_SIZE

    const posLoc = gl.getAttribLocation(this.coverageProgram, 'a_position')
    if (posLoc >= 0) {
      gl.vertexAttribPointer(posLoc, 1, gl.FLOAT, false, COVERAGE_BIN_BYTE_SIZE, byteOffset)
    }

    const depthLoc = gl.getAttribLocation(this.coverageProgram, 'a_depth')
    if (depthLoc >= 0) {
      gl.vertexAttribPointer(depthLoc, 1, gl.FLOAT, false, COVERAGE_BIN_BYTE_SIZE, byteOffset + 4)
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

  uploadCoverage(data: SyntenyCoverageData) {
    const gl = this.gl
    this.coverageData = data

    if (this.coverageVbo) {
      gl.deleteBuffer(this.coverageVbo)
      this.coverageVbo = null
    }
    if (data.totalBins === 0) {
      return
    }

    this.coverageVbo = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.coverageVbo)
    gl.bufferData(gl.ARRAY_BUFFER, data.buffer, gl.STATIC_DRAW)

    gl.bindVertexArray(this.coverageVAO)
    this.bindCoverageBuffer()
    gl.bindVertexArray(null)
  }

  render(
    contentBlocks: BaseBlock[],
    viewOffsetPx: number,
    width: number,
    height: number,
    rowHeight: number,
    rowSpacing: boolean,
    coverageHeight: number,
  ) {
    const gl = this.gl

    this.resize(width, height)
    const dpr = getDevicePixelRatio()
    const logicalW = this.canvas.width / dpr
    const logicalH = this.canvas.height / dpr

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0.93, 0.93, 0.93, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    const rowPadding = rowSpacing ? 1 : 0
    const nicedMax = this.coverageData
      ? niceNum(this.coverageData.globalMaxDepth)
      : 1
    const depthScale =
      this.coverageData && nicedMax > 0
        ? this.coverageData.globalMaxDepth / nicedMax
        : 1

    // Draw coverage first
    if (
      coverageHeight > 0 &&
      this.coverageVbo &&
      this.coverageData &&
      this.coverageData.totalBins > 0
    ) {
      gl.useProgram(this.coverageProgram)
      gl.bindVertexArray(this.coverageVAO)

      for (const block of contentBlocks) {
        const params = computeRegionRenderParams(
          block,
          viewOffsetPx,
          this.coverageData.refNameIndex,
        )
        if (!params) {
          continue
        }
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
          params.bpRangeHi,
          params.bpRangeLo,
          params.bpRangeLen,
          params.regionScreenLeft,
          params.regionScreenWidth,
          rowPadding,
          coverageHeight,
          depthScale,
        )

        this.bindCoverageBuffer(params.instanceOffset)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, params.instanceCount)
      }

      gl.bindVertexArray(null)
    }

    // Draw synteny instances
    if (
      this.instanceVbo &&
      this.instanceData &&
      this.instanceData.instanceCount > 0
    ) {
      gl.useProgram(this.fillProgram)
      gl.bindVertexArray(this.fillVAO)

      for (const block of contentBlocks) {
        const params = computeRegionRenderParams(
          block,
          viewOffsetPx,
          this.instanceData.refNameIndex,
        )
        if (!params) {
          continue
        }

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
          params.bpRangeHi,
          params.bpRangeLo,
          params.bpRangeLen,
          params.regionScreenLeft,
          params.regionScreenWidth,
          rowPadding,
          coverageHeight,
          depthScale,
        )

        this.bindInstanceBuffer(this.fillProgram, params.instanceOffset)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, params.instanceCount)
      }

      gl.bindVertexArray(null)
    }

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
    if (this.coverageVbo) {
      gl.deleteBuffer(this.coverageVbo)
    }
    if (this.pickingFboState) {
      gl.deleteFramebuffer(this.pickingFboState.fbo)
      gl.deleteTexture(this.pickingFboState.colorTex)
    }
    gl.deleteVertexArray(this.fillVAO)
    gl.deleteVertexArray(this.pickingVAO)
    gl.deleteVertexArray(this.coverageVAO)
    gl.deleteBuffer(this.ubo)
    gl.deleteProgram(this.fillProgram)
    gl.deleteProgram(this.pickingProgram)
    gl.deleteProgram(this.coverageProgram)
  }

  private writeUniforms(
    width: number,
    height: number,
    rowHeight: number,
    bpRangeHi: number,
    bpRangeLo: number,
    bpRangeLen: number,
    regionScreenLeft: number,
    regionScreenWidth: number,
    rowPadding: number,
    coverageHeight: number,
    depthScale: number,
  ) {
    const gl = this.gl
    const f = this.uniformF32
    f[0] = width
    f[1] = height
    f[2] = rowHeight
    f[3] = coverageHeight
    f[4] = bpRangeHi
    f[5] = bpRangeLo
    f[6] = bpRangeLen
    f[7] = regionScreenLeft
    f[8] = regionScreenWidth
    f[9] = 0 // hpZero — MUST be 0.0 at runtime
    f[10] = rowPadding
    f[11] = YSCALEBAR_LABEL_OFFSET
    f[12] = depthScale
    f[13] = 0
    f[14] = 0
    f[15] = 0

    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.uniformData)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.ubo)
  }
}
