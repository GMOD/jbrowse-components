import {
  computeNumRows,
  createProgram,
  interleaveInstances,
  splitPositionWithFrac,
} from './webglUtils.ts'
import {
  WIGGLE_FRAGMENT_SHADER_GLSL,
  WIGGLE_VERTEX_SHADER_GLSL,
} from './wiggleGlslShaders.ts'
import {
  INSTANCE_STRIDE,
  RENDERING_TYPE_LINE,
  UNIFORM_SIZE,
  VERTICES_PER_INSTANCE,
} from './wiggleShader.ts'

import type {
  SourceRenderData,
  WiggleGPURenderState,
  WiggleRenderBlock,
} from './WiggleRenderer.ts'

const INSTANCE_BYTES = INSTANCE_STRIDE * 4

interface RegionData {
  regionStart: number
  featureCount: number
  numRows: number
  vao: WebGLVertexArrayObject
  vbo: WebGLBuffer
}

export class WebGLWiggleRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private program: WebGLProgram
  private ubo: WebGLBuffer
  private uniformData = new ArrayBuffer(UNIFORM_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformI32 = new Int32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)
  private regions = new Map<number, RegionData>()
  private attrLocs: {
    startEnd: number
    score: number
    prevScore: number
    rowIndex: number
    color: number
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })
    if (!gl) {
      throw new Error('WebGL2 not supported')
    }
    this.gl = gl

    this.program = createProgram(
      gl,
      WIGGLE_VERTEX_SHADER_GLSL,
      WIGGLE_FRAGMENT_SHADER_GLSL,
    )

    const uboIndex = gl.getUniformBlockIndex(this.program, 'Uniforms')
    gl.uniformBlockBinding(this.program, uboIndex, 0)

    this.ubo = gl.createBuffer()!
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferData(gl.UNIFORM_BUFFER, UNIFORM_SIZE, gl.DYNAMIC_DRAW)

    this.attrLocs = {
      startEnd: gl.getAttribLocation(this.program, 'a_start_end'),
      score: gl.getAttribLocation(this.program, 'a_score'),
      prevScore: gl.getAttribLocation(this.program, 'a_prev_score'),
      rowIndex: gl.getAttribLocation(this.program, 'a_row_index'),
      color: gl.getAttribLocation(this.program, 'a_color'),
    }

    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    )
  }

  private createRegionVAO(vbo: WebGLBuffer) {
    const gl = this.gl
    const locs = this.attrLocs
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)

    // a_start_end: uvec2 at offset 0
    gl.enableVertexAttribArray(locs.startEnd)
    gl.vertexAttribIPointer(
      locs.startEnd,
      2,
      gl.UNSIGNED_INT,
      INSTANCE_BYTES,
      0,
    )
    gl.vertexAttribDivisor(locs.startEnd, 1)

    // a_score: float at offset 8
    gl.enableVertexAttribArray(locs.score)
    gl.vertexAttribPointer(locs.score, 1, gl.FLOAT, false, INSTANCE_BYTES, 8)
    gl.vertexAttribDivisor(locs.score, 1)

    // a_prev_score: float at offset 12
    gl.enableVertexAttribArray(locs.prevScore)
    gl.vertexAttribPointer(
      locs.prevScore,
      1,
      gl.FLOAT,
      false,
      INSTANCE_BYTES,
      12,
    )
    gl.vertexAttribDivisor(locs.prevScore, 1)

    // a_row_index: float at offset 16
    gl.enableVertexAttribArray(locs.rowIndex)
    gl.vertexAttribPointer(
      locs.rowIndex,
      1,
      gl.FLOAT,
      false,
      INSTANCE_BYTES,
      16,
    )
    gl.vertexAttribDivisor(locs.rowIndex, 1)

    // a_color: vec3 at offset 20
    gl.enableVertexAttribArray(locs.color)
    gl.vertexAttribPointer(locs.color, 3, gl.FLOAT, false, INSTANCE_BYTES, 20)
    gl.vertexAttribDivisor(locs.color, 1)

    gl.bindVertexArray(null)
    return vao
  }

  uploadRegion(
    regionNumber: number,
    regionStart: number,
    sources: SourceRenderData[],
  ) {
    const gl = this.gl

    const old = this.regions.get(regionNumber)
    if (old) {
      gl.deleteVertexArray(old.vao)
      gl.deleteBuffer(old.vbo)
      this.regions.delete(regionNumber)
    }

    let totalFeatures = 0
    for (const source of sources) {
      totalFeatures += source.numFeatures
    }

    if (totalFeatures === 0 || sources.length === 0) {
      return
    }

    const buf = interleaveInstances(sources, totalFeatures)

    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW)

    const vao = this.createRegionVAO(vbo)
    const numRows = computeNumRows(sources)
    this.regions.set(regionNumber, {
      regionStart,
      featureCount: totalFeatures,
      numRows,
      vao,
      vbo,
    })
  }

  private writeUniforms(
    bpRangeHi: number,
    bpRangeLo: number,
    bpRangeLength: number,
    regionStart: number,
    numRows: number,
    viewportWidth: number,
    state: WiggleGPURenderState,
  ) {
    this.uniformF32[0] = bpRangeHi
    this.uniformF32[1] = bpRangeLo
    this.uniformF32[2] = bpRangeLength
    this.uniformU32[3] = regionStart
    this.uniformF32[4] = state.canvasHeight
    this.uniformI32[5] = state.scaleType
    this.uniformI32[6] = state.renderingType
    this.uniformF32[7] = numRows
    this.uniformF32[8] = state.domainY[0]
    this.uniformF32[9] = state.domainY[1]
    this.uniformF32[10] = 0 // 'zero' uniform — MUST be 0.0, used by hp_to_clip_x for precision
    this.uniformF32[11] = viewportWidth

    const gl = this.gl
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.uniformData)
  }

  renderBlocks(blocks: WiggleRenderBlock[], state: WiggleGPURenderState) {
    const gl = this.gl
    const canvas = this.canvas
    const { canvasWidth, canvasHeight } = state
    const dpr = window.devicePixelRatio || 1
    const bufW = Math.round(canvasWidth * dpr)
    const bufH = Math.round(canvasHeight * dpr)

    if (canvas.width !== bufW || canvas.height !== bufH) {
      canvas.width = bufW
      canvas.height = bufH
    }

    gl.viewport(0, 0, bufW, bufH)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (blocks.length === 0) {
      return
    }

    const isLine = state.renderingType === RENDERING_TYPE_LINE
    const drawMode = isLine ? gl.LINES : gl.TRIANGLES

    gl.useProgram(this.program)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.ubo)
    gl.enable(gl.SCISSOR_TEST)

    for (const block of blocks) {
      const region = this.regions.get(block.regionNumber)
      if (!region || region.featureCount === 0) {
        continue
      }

      const scissorX = Math.max(0, Math.floor(block.screenStartPx))
      const scissorEnd = Math.min(canvasWidth, Math.ceil(block.screenEndPx))
      const scissorW = scissorEnd - scissorX
      if (scissorW <= 0) {
        continue
      }

      gl.scissor(
        Math.round(scissorX * dpr),
        0,
        Math.round(scissorW * dpr),
        bufH,
      )
      gl.viewport(
        Math.round(scissorX * dpr),
        0,
        Math.round(scissorW * dpr),
        bufH,
      )

      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const regionLengthBp = block.bpRangeX[1] - block.bpRangeX[0]
      const bpPerPx = regionLengthBp / fullBlockWidth
      const clippedBpStart =
        block.bpRangeX[0] + (scissorX - block.screenStartPx) * bpPerPx
      const clippedBpEnd =
        block.bpRangeX[0] + (scissorEnd - block.screenStartPx) * bpPerPx
      const [bpStartHi, bpStartLo] = splitPositionWithFrac(clippedBpStart)
      const clippedLengthBp = clippedBpEnd - clippedBpStart

      this.writeUniforms(
        bpStartHi,
        bpStartLo,
        clippedLengthBp,
        Math.floor(region.regionStart),
        region.numRows,
        Math.round(scissorW * dpr),
        state,
      )

      gl.bindVertexArray(region.vao)
      gl.drawArraysInstanced(
        drawMode,
        0,
        VERTICES_PER_INSTANCE,
        region.featureCount,
      )
      const glErr = gl.getError()
      if (glErr !== gl.NO_ERROR) {
        // GL error occurred
      }
    }

    gl.disable(gl.SCISSOR_TEST)
    gl.viewport(0, 0, bufW, bufH)
    gl.bindVertexArray(null)
  }

  pruneStaleRegions(activeRegionNumbers: Set<number>) {
    for (const regionNumber of this.regions.keys()) {
      if (!activeRegionNumbers.has(regionNumber)) {
        const region = this.regions.get(regionNumber)
        if (region) {
          this.gl.deleteVertexArray(region.vao)
          this.gl.deleteBuffer(region.vbo)
        }
        this.regions.delete(regionNumber)
      }
    }
  }

  destroy() {
    for (const region of this.regions.values()) {
      this.gl.deleteVertexArray(region.vao)
      this.gl.deleteBuffer(region.vbo)
    }
    this.regions.clear()
    const gl = this.gl
    gl.deleteBuffer(this.ubo)
    gl.deleteProgram(this.program)
  }
}
