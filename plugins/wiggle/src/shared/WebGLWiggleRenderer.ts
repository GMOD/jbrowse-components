import {
  WIGGLE_FRAGMENT_SHADER,
  WIGGLE_VERTEX_SHADER,
} from './generated/index.ts'
import {
  computeNumRows,
  createProgram,
  interleaveInstances,
  splitPositionWithFrac,
} from './webglUtils.ts'
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

interface RegionData {
  regionStart: number
  featureCount: number
  numRows: number
  instanceTexture: WebGLTexture
}

export class WebGLWiggleRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private program: WebGLProgram
  private emptyVAO: WebGLVertexArrayObject
  private ubo: WebGLBuffer
  private uniformData = new ArrayBuffer(UNIFORM_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformI32 = new Int32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)
  private regions = new Map<number, RegionData>()

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
      WIGGLE_VERTEX_SHADER,
      WIGGLE_FRAGMENT_SHADER,
    )

    const uboIndex = gl.getUniformBlockIndex(
      this.program,
      'Uniforms_block_1Vertex',
    )
    gl.uniformBlockBinding(this.program, uboIndex, 0)

    this.ubo = gl.createBuffer()!
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferData(gl.UNIFORM_BUFFER, UNIFORM_SIZE, gl.DYNAMIC_DRAW)

    gl.useProgram(this.program)
    const texLoc = gl.getUniformLocation(this.program, 'u_instanceData')
    gl.uniform1i(texLoc, 0)

    this.emptyVAO = gl.createVertexArray()!

    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    )
  }

  uploadRegion(
    regionNumber: number,
    regionStart: number,
    sources: SourceRenderData[],
  ) {
    const gl = this.gl

    const old = this.regions.get(regionNumber)
    if (old) {
      gl.deleteTexture(old.instanceTexture)
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

    const texWidth = totalFeatures * (INSTANCE_STRIDE / 4)
    const tex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
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
      new Uint32Array(buf),
    )

    const numRows = computeNumRows(sources)
    this.regions.set(regionNumber, {
      regionStart,
      featureCount: totalFeatures,
      numRows,
      instanceTexture: tex,
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
    gl.bindVertexArray(this.emptyVAO)
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

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, region.instanceTexture)
      gl.drawArraysInstanced(
        drawMode,
        0,
        VERTICES_PER_INSTANCE,
        region.featureCount,
      )
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
          this.gl.deleteTexture(region.instanceTexture)
        }
        this.regions.delete(regionNumber)
      }
    }
  }

  destroy() {
    for (const region of this.regions.values()) {
      this.gl.deleteTexture(region.instanceTexture)
    }
    this.regions.clear()
    const gl = this.gl
    gl.deleteVertexArray(this.emptyVAO)
    gl.deleteBuffer(this.ubo)
    gl.deleteProgram(this.program)
  }
}
