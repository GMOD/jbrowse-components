import { INSTANCE_STRIDE } from './wiggleShaders.ts'
import {
  WIGGLE_FRAGMENT_SHADER,
  WIGGLE_VERTEX_SHADER,
} from '../../shared/generated/index.ts'
import {
  createProgram,
  splitPositionWithFrac,
} from '../../shared/webglUtils.ts'

export type RenderingType = 'xyplot' | 'density' | 'line'

export interface WiggleRenderState {
  bpRangeX: [number, number]
  domainY: [number, number]
  scaleType: 'linear' | 'log'
  color: [number, number, number]
  posColor: [number, number, number]
  negColor: [number, number, number]
  bicolorPivot: number
  useBicolor: boolean
  canvasWidth: number
  canvasHeight: number
  renderingType: RenderingType
}

export interface WiggleRenderBlock {
  regionNumber: number
  bpRangeX: [number, number]
  screenStartPx: number
  screenEndPx: number
}

const UNIFORM_SIZE = 96
const INSTANCE_BYTES = INSTANCE_STRIDE * 4

const RENDERING_TYPE_MAP: Record<RenderingType, number> = {
  xyplot: 0,
  density: 1,
  line: 2,
}

interface RegionData {
  regionStart: number
  featureCount: number
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
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  uploadForRegion(
    regionNumber: number,
    data: {
      regionStart: number
      featurePositions: Uint32Array
      featureScores: Float32Array
      numFeatures: number
    },
  ) {
    const gl = this.gl

    const old = this.regions.get(regionNumber)
    if (old) {
      gl.deleteTexture(old.instanceTexture)
      this.regions.delete(regionNumber)
    }

    if (data.numFeatures === 0) {
      return
    }

    const buf = new ArrayBuffer(data.numFeatures * INSTANCE_BYTES)
    const u32 = new Uint32Array(buf)
    const f32 = new Float32Array(buf)
    for (let i = 0; i < data.numFeatures; i++) {
      const off = i * INSTANCE_STRIDE
      u32[off] = data.featurePositions[i * 2]!
      u32[off + 1] = data.featurePositions[i * 2 + 1]!
      f32[off + 2] = data.featureScores[i]!
      f32[off + 3] = 0
    }

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
      data.numFeatures,
      1,
      0,
      gl.RGBA_INTEGER,
      gl.UNSIGNED_INT,
      new Uint32Array(buf),
    )

    this.regions.set(regionNumber, {
      regionStart: data.regionStart,
      featureCount: data.numFeatures,
      instanceTexture: tex,
    })
  }

  private writeUniforms(
    bpRangeHi: number,
    bpRangeLo: number,
    bpRangeLength: number,
    regionStart: number,
    state: Omit<WiggleRenderState, 'bpRangeX'>,
  ) {
    this.uniformF32[0] = bpRangeHi
    this.uniformF32[1] = bpRangeLo
    this.uniformF32[2] = bpRangeLength
    this.uniformU32[3] = regionStart
    this.uniformF32[4] = state.canvasHeight
    this.uniformI32[5] = state.scaleType === 'log' ? 1 : 0
    this.uniformI32[6] = RENDERING_TYPE_MAP[state.renderingType]
    this.uniformI32[7] = state.useBicolor ? 1 : 0
    this.uniformF32[8] = state.domainY[0]
    this.uniformF32[9] = state.domainY[1]
    this.uniformF32[10] = state.bicolorPivot
    this.uniformF32[11] = 0
    this.uniformF32[12] = state.color[0]
    this.uniformF32[13] = state.color[1]
    this.uniformF32[14] = state.color[2]
    this.uniformF32[15] = 0
    this.uniformF32[16] = state.posColor[0]
    this.uniformF32[17] = state.posColor[1]
    this.uniformF32[18] = state.posColor[2]
    this.uniformF32[19] = 0
    this.uniformF32[20] = state.negColor[0]
    this.uniformF32[21] = state.negColor[1]
    this.uniformF32[22] = state.negColor[2]
    this.uniformF32[23] = 0

    const gl = this.gl
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.uniformData)
  }

  renderBlocks(
    blocks: WiggleRenderBlock[],
    state: Omit<WiggleRenderState, 'bpRangeX'>,
  ) {
    const gl = this.gl
    const canvas = this.canvas
    const { canvasWidth, canvasHeight, renderingType } = state

    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth
      canvas.height = canvasHeight
    }

    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (blocks.length === 0) {
      return
    }

    const isLine = renderingType === 'line'
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

      gl.scissor(scissorX, 0, scissorW, canvasHeight)
      gl.viewport(scissorX, 0, scissorW, canvasHeight)

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
        state,
      )

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, region.instanceTexture)
      gl.drawArraysInstanced(drawMode, 0, 6, region.featureCount)
    }

    gl.disable(gl.SCISSOR_TEST)
    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.bindVertexArray(null)
  }

  render(state: WiggleRenderState) {
    const gl = this.gl
    const canvas = this.canvas
    const { canvasWidth, canvasHeight, renderingType } = state

    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth
      canvas.height = canvasHeight
    }

    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    const region = this.regions.get(0) ?? this.regions.values().next().value
    if (!region || region.featureCount === 0) {
      return
    }

    const [bpStartHi, bpStartLo] = splitPositionWithFrac(state.bpRangeX[0])
    const regionLengthBp = state.bpRangeX[1] - state.bpRangeX[0]

    this.writeUniforms(
      bpStartHi,
      bpStartLo,
      regionLengthBp,
      Math.floor(region.regionStart),
      state,
    )

    const isLine = renderingType === 'line'
    const drawMode = isLine ? gl.LINES : gl.TRIANGLES

    gl.useProgram(this.program)
    gl.bindVertexArray(this.emptyVAO)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.ubo)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, region.instanceTexture)
    gl.drawArraysInstanced(drawMode, 0, 6, region.featureCount)
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

  clearAllBuffers() {
    for (const region of this.regions.values()) {
      this.gl.deleteTexture(region.instanceTexture)
    }
    this.regions.clear()
  }

  destroy() {
    this.clearAllBuffers()
    const gl = this.gl
    gl.deleteVertexArray(this.emptyVAO)
    gl.deleteBuffer(this.ubo)
    gl.deleteProgram(this.program)
  }
}
