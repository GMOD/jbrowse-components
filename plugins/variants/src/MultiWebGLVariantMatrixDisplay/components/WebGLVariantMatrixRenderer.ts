import {
  VARIANT_MATRIX_VERTEX_SHADER,
  VARIANT_MATRIX_FRAGMENT_SHADER,
} from '../../shared/generated/index.ts'
import { createProgram } from '../../shared/variantWebglUtils.ts'
import { interleaveMatrixInstances } from './variantMatrixShaders.ts'

const UNIFORM_SIZE = 32

export interface MatrixRenderState {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  scrollTop: number
  numFeatures: number
}

export class WebGLVariantMatrixRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private program: WebGLProgram
  private emptyVAO: WebGLVertexArrayObject
  private ubo: WebGLBuffer
  private uniformData = new ArrayBuffer(UNIFORM_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private instanceTexture: WebGLTexture | null = null
  private cellCount = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    })
    if (!gl) {
      throw new Error('WebGL2 not supported')
    }
    this.gl = gl

    this.program = createProgram(
      gl,
      VARIANT_MATRIX_VERTEX_SHADER,
      VARIANT_MATRIX_FRAGMENT_SHADER,
    )

    const uboIndex = gl.getUniformBlockIndex(this.program, 'Uniforms_block_1Vertex')
    gl.uniformBlockBinding(this.program, uboIndex, 0)

    this.ubo = gl.createBuffer()!
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferData(gl.UNIFORM_BUFFER, UNIFORM_SIZE, gl.DYNAMIC_DRAW)

    gl.useProgram(this.program)
    const texLoc = gl.getUniformLocation(this.program, 'u_instanceData')
    gl.uniform1i(texLoc, 0)

    this.emptyVAO = gl.createVertexArray()!

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  }

  uploadCellData(data: {
    cellFeatureIndices: Float32Array
    cellRowIndices: Uint32Array
    cellColors: Uint8Array
    numCells: number
  }) {
    const gl = this.gl

    if (this.instanceTexture) {
      gl.deleteTexture(this.instanceTexture)
      this.instanceTexture = null
    }
    this.cellCount = 0

    if (data.numCells === 0) {
      return
    }

    this.cellCount = data.numCells

    const count = data.numCells
    const buf = interleaveMatrixInstances(data)

    // RGBA32UI texture: 2 texels × 4 u32s per texel = MATRIX_INSTANCE_STRIDE u32s per instance
    // WebGL2 lacks storage buffers, so we use a texture to pass per-instance data
    const tex = gl.createTexture()!
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
      count * 2,
      1,
      0,
      gl.RGBA_INTEGER,
      gl.UNSIGNED_INT,
      new Uint32Array(buf),
    )
    this.instanceTexture = tex
  }

  render(state: MatrixRenderState) {
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

    if (!this.instanceTexture || this.cellCount === 0 || state.numFeatures === 0) {
      return
    }

    gl.useProgram(this.program)
    gl.bindVertexArray(this.emptyVAO)
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.ubo)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.instanceTexture)

    this.writeUniforms(state)

    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.cellCount)

    gl.bindVertexArray(null)
  }

  private writeUniforms(state: MatrixRenderState) {
    this.uniformF32[0] = state.numFeatures
    this.uniformF32[1] = state.canvasWidth
    this.uniformF32[2] = state.canvasHeight
    this.uniformF32[3] = state.rowHeight
    this.uniformF32[4] = state.scrollTop
    const gl = this.gl
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo)
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.uniformData)
  }

  destroy() {
    const gl = this.gl
    if (this.instanceTexture) {
      gl.deleteTexture(this.instanceTexture)
    }
    gl.deleteVertexArray(this.emptyVAO)
    gl.deleteBuffer(this.ubo)
    gl.deleteProgram(this.program)
  }
}
