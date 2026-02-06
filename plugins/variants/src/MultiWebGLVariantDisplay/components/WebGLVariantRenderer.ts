import {
  HP_GLSL_FUNCTIONS,
  cacheUniforms,
  createProgram,
  splitPositionWithFrac,
} from '../../shared/variantWebglUtils.ts'

const VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_position;    // [start, end] as uint offsets from regionStart
in uint a_rowIndex;     // row (sample) index
in vec4 a_color;        // pre-computed RGBA color (normalized 0-1)
in uint a_shapeType;    // 0=rect, 1=tri-right, 2=tri-left, 3=tri-down

uniform vec3 u_domainX;         // [hi, lo, extent] for HP math
uniform uint u_regionStart;
uniform float u_canvasHeight;
uniform float u_canvasWidth;
uniform float u_rowHeight;
uniform float u_scrollTop;

out vec4 v_color;

${HP_GLSL_FUNCTIONS}

void main() {
  int vid = gl_VertexID % 6;

  uint absStart = a_position.x + u_regionStart;
  uint absEnd = a_position.y + u_regionStart;
  vec2 splitStart = hpSplitUint(absStart);
  vec2 splitEnd = hpSplitUint(absEnd);
  float clipX1 = hpToClipX(splitStart, u_domainX);
  float clipX2 = hpToClipX(splitEnd, u_domainX);

  // ensure minimum width of 2 pixels
  float pixelWidth = (clipX2 - clipX1) * u_canvasWidth * 0.5;
  if (pixelWidth < 2.0) {
    float expand = (2.0 - pixelWidth) / u_canvasWidth;
    clipX2 = clipX1 + expand;
  }

  float yTop = float(a_rowIndex) * u_rowHeight - u_scrollTop;
  float yBot = yTop + u_rowHeight;
  float yMid = (yTop + yBot) * 0.5;
  float pxToClipY = 2.0 / u_canvasHeight;
  float cyTop = 1.0 - yTop * pxToClipY;
  float cyBot = 1.0 - yBot * pxToClipY;
  float cyMid = 1.0 - yMid * pxToClipY;
  float xMid = (clipX1 + clipX2) * 0.5;

  float sx, sy;

  if (a_shapeType == 0u) {
    // rectangle: 2 triangles
    float lx = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
    float ly = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;
    sx = mix(clipX1, clipX2, lx);
    sy = mix(cyBot, cyTop, ly);
  } else if (a_shapeType == 1u) {
    // triangle pointing right (inversion strand +1)
    if (vid == 0) { sx = clipX1; sy = cyTop; }
    else if (vid == 1) { sx = clipX1; sy = cyBot; }
    else if (vid == 2) { sx = clipX2; sy = cyMid; }
    else { sx = clipX2; sy = cyMid; } // degenerate
  } else if (a_shapeType == 2u) {
    // triangle pointing left (inversion strand -1)
    if (vid == 0) { sx = clipX2; sy = cyTop; }
    else if (vid == 1) { sx = clipX2; sy = cyBot; }
    else if (vid == 2) { sx = clipX1; sy = cyMid; }
    else { sx = clipX1; sy = cyMid; } // degenerate
  } else {
    // triangle pointing down (insertion)
    float widthExtend = 6.0 / u_canvasWidth;
    if (vid == 0) { sx = clipX1 - widthExtend; sy = cyTop; }
    else if (vid == 1) { sx = clipX2 + widthExtend; sy = cyTop; }
    else if (vid == 2) { sx = xMid; sy = cyBot; }
    else { sx = xMid; sy = cyBot; } // degenerate
  }

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = a_color;
}
`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

export interface VariantRenderState {
  domainX: [number, number]
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  scrollTop: number
  regionStart: number
}

interface GPUBuffers {
  regionStart: number
  vao: WebGLVertexArrayObject
  cellCount: number
}

export class WebGLVariantRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private program: WebGLProgram
  private buffers: GPUBuffers | null = null
  private uniforms: Record<string, WebGLUniformLocation | null> = {}

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

    this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER)
    this.uniforms = cacheUniforms(gl, this.program, [
      'u_domainX',
      'u_regionStart',
      'u_canvasHeight',
      'u_canvasWidth',
      'u_rowHeight',
      'u_scrollTop',
    ])

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  uploadCellData(data: {
    regionStart: number
    cellPositions: Uint32Array
    cellRowIndices: Uint32Array
    cellColors: Uint8Array
    cellShapeTypes: Uint8Array
    numCells: number
  }) {
    const gl = this.gl

    if (this.buffers) {
      gl.deleteVertexArray(this.buffers.vao)
    }

    if (data.numCells === 0) {
      this.buffers = null
      return
    }

    const vao = gl.createVertexArray()!
    gl.bindVertexArray(vao)

    // a_position (uvec2) - start/end offsets
    this.uploadUintBuffer('a_position', data.cellPositions, 2)

    // a_rowIndex (uint)
    this.uploadUintBuffer('a_rowIndex', data.cellRowIndices, 1)

    // a_color (vec4) - normalized from uint8
    this.uploadUint8ColorBuffer('a_color', data.cellColors)

    // a_shapeType (uint) - convert from Uint8Array to Uint32Array
    const shapeTypes32 = new Uint32Array(data.numCells)
    for (let i = 0; i < data.numCells; i++) {
      shapeTypes32[i] = data.cellShapeTypes[i]!
    }
    this.uploadUintBuffer('a_shapeType', shapeTypes32, 1)

    gl.bindVertexArray(null)

    this.buffers = {
      regionStart: data.regionStart,
      vao,
      cellCount: data.numCells,
    }
  }

  private uploadUintBuffer(attrib: string, data: Uint32Array, size: number) {
    const gl = this.gl
    const loc = gl.getAttribLocation(this.program, attrib)
    if (loc < 0) {
      return
    }
    const buffer = gl.createBuffer()
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
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 4, gl.UNSIGNED_BYTE, true, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  render(state: VariantRenderState) {
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

    if (!this.buffers || this.buffers.cellCount === 0) {
      return
    }

    const [domainStartHi, domainStartLo] = splitPositionWithFrac(
      state.domainX[0],
    )
    const domainExtent = state.domainX[1] - state.domainX[0]

    gl.useProgram(this.program)
    gl.uniform3f(
      this.uniforms.u_domainX!,
      domainStartHi,
      domainStartLo,
      domainExtent,
    )
    gl.uniform1ui(
      this.uniforms.u_regionStart!,
      Math.floor(this.buffers.regionStart),
    )
    gl.uniform1f(this.uniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(this.uniforms.u_canvasWidth!, canvasWidth)
    gl.uniform1f(this.uniforms.u_rowHeight!, state.rowHeight)
    gl.uniform1f(this.uniforms.u_scrollTop!, state.scrollTop)

    gl.bindVertexArray(this.buffers.vao)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.cellCount)
    gl.bindVertexArray(null)
  }

  destroy() {
    const gl = this.gl
    if (this.buffers) {
      gl.deleteVertexArray(this.buffers.vao)
    }
    gl.deleteProgram(this.program)
  }
}
