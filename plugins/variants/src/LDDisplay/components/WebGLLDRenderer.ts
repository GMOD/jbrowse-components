const VERTEX_SHADER = `#version 300 es
precision highp float;

// Per-vertex (quad corners)
in vec2 a_quadPos;

// Per-instance
in vec2 a_position;
in vec2 a_cellSize;
in float a_ldValue;

uniform float u_yScalar;
uniform vec2 u_canvasSize;
uniform float u_viewScale;
uniform float u_viewOffsetX;

out float v_ldValue;

void main() {
  vec2 pos = a_position + a_quadPos * a_cellSize;

  // Rotate -45 degrees
  float c = 0.7071067811865476;
  float rx = (pos.x + pos.y) * c;
  float ry = (-pos.x + pos.y) * c;

  // Apply view scale (zoom) and offset (scroll)
  rx = rx * u_viewScale + u_viewOffsetX;
  ry = ry * u_viewScale;

  ry *= u_yScalar;

  float clipX = (rx / u_canvasSize.x) * 2.0 - 1.0;
  float clipY = 1.0 - (ry / u_canvasSize.y) * 2.0;

  gl_Position = vec4(clipX, clipY, 0.0, 1.0);
  v_ldValue = a_ldValue;
}
`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in float v_ldValue;

uniform sampler2D u_colorRamp;
uniform int u_signedLD;

out vec4 fragColor;

void main() {
  float t;
  if (u_signedLD == 1) {
    // Map -1..1 to 0..1
    t = (v_ldValue + 1.0) / 2.0;
  } else {
    // Map 0..1 to 0..1
    t = v_ldValue;
  }
  t = clamp(t, 0.0, 1.0);
  fragColor = texture(u_colorRamp, vec2(t, 0.5));
}
`

// Color ramp generation functions matching the d3 interpolateRgbBasis in makeImageData.ts

function interpolateStops(
  stops: [number, number, number][],
): Uint8Array {
  const data = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    const stopIndex = t * (stops.length - 1)
    const lower = Math.floor(stopIndex)
    const upper = Math.min(lower + 1, stops.length - 1)
    const frac = stopIndex - lower
    const lo = stops[lower]!
    const hi = stops[upper]!

    data[i * 4] = Math.round(lo[0] * (1 - frac) + hi[0] * frac)
    data[i * 4 + 1] = Math.round(lo[1] * (1 - frac) + hi[1] * frac)
    data[i * 4 + 2] = Math.round(lo[2] * (1 - frac) + hi[2] * frac)
    data[i * 4 + 3] = 255
  }
  return data
}

const R2_STOPS: [number, number, number][] = [
  [255, 255, 255],
  [255, 224, 224],
  [255, 192, 192],
  [255, 128, 128],
  [255, 64, 64],
  [255, 0, 0],
  [208, 0, 0],
  [160, 0, 0],
]

const DPRIME_STOPS: [number, number, number][] = [
  [255, 255, 255],
  [224, 224, 255],
  [192, 192, 255],
  [128, 128, 255],
  [64, 64, 255],
  [0, 0, 255],
  [0, 0, 208],
  [0, 0, 160],
]

const R_SIGNED_STOPS: [number, number, number][] = [
  [0, 0, 160],
  [0, 0, 208],
  [0, 0, 255],
  [64, 64, 255],
  [128, 128, 255],
  [192, 192, 255],
  [224, 224, 255],
  [255, 255, 255],
  [255, 224, 224],
  [255, 192, 192],
  [255, 128, 128],
  [255, 64, 64],
  [255, 0, 0],
  [208, 0, 0],
  [160, 0, 0],
]

const DPRIME_SIGNED_STOPS: [number, number, number][] = [
  [0, 100, 0],
  [0, 128, 0],
  [0, 160, 0],
  [64, 192, 64],
  [128, 224, 128],
  [192, 240, 192],
  [224, 248, 224],
  [255, 255, 255],
  [224, 224, 255],
  [192, 192, 255],
  [128, 128, 255],
  [64, 64, 255],
  [0, 0, 255],
  [0, 0, 208],
  [0, 0, 160],
]

export function generateLDColorRamp(
  metric: string,
  signedLD: boolean,
): Uint8Array {
  if (signedLD) {
    return metric === 'dprime'
      ? interpolateStops(DPRIME_SIGNED_STOPS)
      : interpolateStops(R_SIGNED_STOPS)
  }
  return metric === 'dprime'
    ? interpolateStops(DPRIME_STOPS)
    : interpolateStops(R2_STOPS)
}

export interface LDRenderState {
  yScalar: number
  canvasWidth: number
  canvasHeight: number
  signedLD: boolean
  viewScale: number
  viewOffsetX: number
}

export class WebGLLDRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject | null = null
  private buffers: WebGLBuffer[] = []
  private instanceCount = 0
  private uniforms: Record<string, WebGLUniformLocation | null> = {}
  private colorRampTexture: WebGLTexture | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })

    if (!gl) {
      throw new Error('WebGL2 not supported')
    }
    this.gl = gl

    this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER)
    this.cacheUniforms([
      'u_yScalar',
      'u_canvasSize',
      'u_signedLD',
      'u_colorRamp',
      'u_viewScale',
      'u_viewOffsetX',
    ])

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  private createShader(type: number, source: string) {
    const gl = this.gl
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

  private createProgram(vsSource: string, fsSource: string) {
    const gl = this.gl
    const program = gl.createProgram()!
    gl.attachShader(program, this.createShader(gl.VERTEX_SHADER, vsSource))
    gl.attachShader(program, this.createShader(gl.FRAGMENT_SHADER, fsSource))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program)
      gl.deleteProgram(program)
      throw new Error(`Program link error: ${info}`)
    }
    return program
  }

  private cacheUniforms(names: string[]) {
    for (const name of names) {
      this.uniforms[name] = this.gl.getUniformLocation(this.program, name)
    }
  }

  uploadData(data: {
    positions: Float32Array
    cellSizes: Float32Array
    ldValues: Float32Array
    numCells: number
  }) {
    const gl = this.gl

    this.deleteBuffers()

    if (data.numCells === 0) {
      this.instanceCount = 0
      return
    }

    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)

    // Unit quad geometry
    const quadVertices = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])
    const quadIndices = new Uint16Array([0, 1, 2, 0, 2, 3])

    const quadPosLoc = gl.getAttribLocation(this.program, 'a_quadPos')
    const quadBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(quadPosLoc)
    gl.vertexAttribPointer(quadPosLoc, 2, gl.FLOAT, false, 0, 0)

    const indexBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, quadIndices, gl.STATIC_DRAW)

    // Per-instance position buffer
    const posLoc = gl.getAttribLocation(this.program, 'a_position')
    const posBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, data.positions, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(posLoc, 1)

    // Per-instance cell size buffer
    const cellSizeLoc = gl.getAttribLocation(this.program, 'a_cellSize')
    const cellSizeBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, cellSizeBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, data.cellSizes, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(cellSizeLoc)
    gl.vertexAttribPointer(cellSizeLoc, 2, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(cellSizeLoc, 1)

    // Per-instance LD value buffer
    const ldValLoc = gl.getAttribLocation(this.program, 'a_ldValue')
    const ldValBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, ldValBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, data.ldValues, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(ldValLoc)
    gl.vertexAttribPointer(ldValLoc, 1, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(ldValLoc, 1)

    this.buffers = [quadBuffer, indexBuffer, posBuffer, cellSizeBuffer, ldValBuffer]
    gl.bindVertexArray(null)
    this.instanceCount = data.numCells
  }

  uploadColorRamp(colors: Uint8Array) {
    const gl = this.gl
    if (this.colorRampTexture) {
      gl.deleteTexture(this.colorRampTexture)
    }
    this.colorRampTexture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.colorRampTexture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      256,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      colors,
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  render(state: LDRenderState) {
    const gl = this.gl
    const { canvasWidth, canvasHeight, yScalar, signedLD, viewScale, viewOffsetX } =
      state

    if (
      this.canvas.width !== canvasWidth ||
      this.canvas.height !== canvasHeight
    ) {
      this.canvas.width = canvasWidth
      this.canvas.height = canvasHeight
    }

    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (!this.vao || this.instanceCount === 0 || !this.colorRampTexture) {
      return
    }

    gl.useProgram(this.program)

    gl.uniform1f(this.uniforms.u_yScalar!, yScalar)
    gl.uniform2f(this.uniforms.u_canvasSize!, canvasWidth, canvasHeight)
    gl.uniform1i(this.uniforms.u_signedLD!, signedLD ? 1 : 0)
    gl.uniform1f(this.uniforms.u_viewScale!, viewScale)
    gl.uniform1f(this.uniforms.u_viewOffsetX!, viewOffsetX)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.colorRampTexture)
    gl.uniform1i(this.uniforms.u_colorRamp!, 0)

    gl.bindVertexArray(this.vao)
    gl.drawElementsInstanced(
      gl.TRIANGLES,
      6,
      gl.UNSIGNED_SHORT,
      0,
      this.instanceCount,
    )
    gl.bindVertexArray(null)
  }

  private deleteBuffers() {
    const gl = this.gl
    for (const buf of this.buffers) {
      gl.deleteBuffer(buf)
    }
    this.buffers = []
    if (this.vao) {
      gl.deleteVertexArray(this.vao)
      this.vao = null
    }
  }

  destroy() {
    this.deleteBuffers()
    const gl = this.gl
    if (this.colorRampTexture) {
      gl.deleteTexture(this.colorRampTexture)
    }
    gl.deleteProgram(this.program)
  }
}
