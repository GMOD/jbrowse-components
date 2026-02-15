import { cacheUniforms, createProgram } from '../../shared/variantWebglUtils.ts'

const VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in float a_featureIndex;  // feature index (column)
in uint a_rowIndex;       // row (sample) index
in vec4 a_color;          // pre-computed RGBA color (normalized 0-1)

uniform float u_numFeatures;
uniform float u_canvasWidth;
uniform float u_canvasHeight;
uniform float u_rowHeight;
uniform float u_scrollTop;

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float lx = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float ly = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  // X from feature index, snapped to pixel grid
  float x1 = a_featureIndex / u_numFeatures;
  float x2 = (a_featureIndex + 1.0) / u_numFeatures;
  float pxSizeX = 1.0 / u_canvasWidth;
  x1 = floor(x1 / pxSizeX + 0.5) * pxSizeX;
  x2 = floor(x2 / pxSizeX + 0.5) * pxSizeX;
  if (x2 - x1 < pxSizeX) {
    x2 = x1 + pxSizeX;
  }
  float clipX = mix(x1, x2, lx) * 2.0 - 1.0;

  // Y from row index, snapped to pixel grid
  float yTop = float(a_rowIndex) * u_rowHeight - u_scrollTop;
  float yBot = yTop + u_rowHeight;
  yTop = floor(yTop + 0.5);
  yBot = floor(yBot + 0.5);
  if (yBot - yTop < 1.0) {
    yBot = yTop + 1.0;
  }
  float pxToClipY = 2.0 / u_canvasHeight;
  float cyTop = 1.0 - yTop * pxToClipY;
  float cyBot = 1.0 - yBot * pxToClipY;
  float clipY = mix(cyBot, cyTop, ly);

  gl_Position = vec4(clipX, clipY, 0.0, 1.0);
  v_color = a_color;
}
`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = vec4(v_color.rgb * v_color.a, v_color.a);
}
`

export interface MatrixRenderState {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  scrollTop: number
  numFeatures: number
}

interface GPUBuffers {
  vao: WebGLVertexArrayObject
  cellCount: number
}

export class WebGLVariantMatrixRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private program: WebGLProgram
  private buffers: GPUBuffers | null = null
  private glBuffers: WebGLBuffer[] = []
  private uniforms: Record<string, WebGLUniformLocation | null> = {}

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

    this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER)
    this.uniforms = cacheUniforms(gl, this.program, [
      'u_numFeatures',
      'u_canvasWidth',
      'u_canvasHeight',
      'u_rowHeight',
      'u_scrollTop',
    ])

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

    this.deleteBuffers()

    if (data.numCells === 0) {
      return
    }

    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)

    // a_featureIndex (float)
    this.uploadFloatBuffer('a_featureIndex', data.cellFeatureIndices, 1)

    // a_rowIndex (uint)
    this.uploadUintBuffer('a_rowIndex', data.cellRowIndices, 1)

    // a_color (vec4) - normalized from uint8
    this.uploadUint8ColorBuffer('a_color', data.cellColors)

    gl.bindVertexArray(null)

    this.buffers = {
      vao,
      cellCount: data.numCells,
    }
  }

  private uploadFloatBuffer(attrib: string, data: Float32Array, size: number) {
    const gl = this.gl
    const loc = gl.getAttribLocation(this.program, attrib)
    if (loc < 0) {
      return
    }
    const buffer = gl.createBuffer()
    this.glBuffers.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  private uploadUintBuffer(attrib: string, data: Uint32Array, size: number) {
    const gl = this.gl
    const loc = gl.getAttribLocation(this.program, attrib)
    if (loc < 0) {
      return
    }
    const buffer = gl.createBuffer()
    this.glBuffers.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribIPointer(loc, size, gl.UNSIGNED_INT, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  private uploadUint8ColorBuffer(attrib: string, data: Uint8Array) {
    const gl = this.gl
    const loc = gl.getAttribLocation(this.program, attrib)
    if (loc < 0) {
      return
    }
    const buffer = gl.createBuffer()
    this.glBuffers.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 4, gl.UNSIGNED_BYTE, true, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  render(state: MatrixRenderState) {
    const gl = this.gl
    const canvas = this.canvas
    const { canvasWidth, canvasHeight } = state

    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth
      canvas.height = canvasHeight
    }

    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (
      !this.buffers ||
      this.buffers.cellCount === 0 ||
      state.numFeatures === 0
    ) {
      return
    }

    gl.useProgram(this.program)
    gl.uniform1f(this.uniforms.u_numFeatures!, state.numFeatures)
    gl.uniform1f(this.uniforms.u_canvasWidth!, canvasWidth)
    gl.uniform1f(this.uniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(this.uniforms.u_rowHeight!, state.rowHeight)
    gl.uniform1f(this.uniforms.u_scrollTop!, state.scrollTop)

    gl.bindVertexArray(this.buffers.vao)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.cellCount)
    gl.bindVertexArray(null)
  }

  private deleteBuffers() {
    const gl = this.gl
    for (const buf of this.glBuffers) {
      gl.deleteBuffer(buf)
    }
    this.glBuffers = []
    if (this.buffers) {
      gl.deleteVertexArray(this.buffers.vao)
      this.buffers = null
    }
  }

  destroy() {
    this.deleteBuffers()
    this.gl.deleteProgram(this.program)
  }
}
