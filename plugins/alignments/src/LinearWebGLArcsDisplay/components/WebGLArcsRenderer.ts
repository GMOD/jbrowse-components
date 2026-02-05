/**
 * WebGL Renderer for arcs display
 *
 * Renders arcs between paired-end reads using line strips.
 * Curves are tessellated into line segments for efficient GPU rendering.
 */

// High-precision GLSL functions for genomic coordinates
const HP_GLSL_FUNCTIONS = `
const uint HP_LOW_MASK = 0xFFFu;

vec2 hpSplitUint(uint value) {
  uint lo = value & HP_LOW_MASK;
  uint hi = value - lo;
  return vec2(float(hi), float(lo));
}

float hpScaleLinear(vec2 splitPos, vec3 domain) {
  float hi = splitPos.x - domain.x;
  float lo = splitPos.y - domain.y;
  return (hi + lo) / domain.z;
}

float hpToClipX(vec2 splitPos, vec3 domain) {
  return hpScaleLinear(splitPos, domain) * 2.0 - 1.0;
}
`

function splitPositionWithFrac(value: number): [number, number] {
  const intValue = Math.floor(value)
  const frac = value - intValue
  const loInt = intValue & 0xfff
  const hi = intValue - loInt
  const lo = loInt + frac
  return [hi, lo]
}

// Vertex shader for arc segments (line strips)
const ARC_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uint a_position;   // x position as uint offset from regionStart
in float a_y;         // y position (0 at top, height at bottom)
in float a_colorType; // 0=normal, 1=long, 2=short, 3=interchrom, 4=orientation, 5=gradient

uniform vec3 u_domainX;
uniform uint u_regionStart;
uniform float u_canvasHeight;
uniform float u_gradientHue;  // for gradient coloring

out vec4 v_color;

${HP_GLSL_FUNCTIONS}

vec3 getColor(float colorType) {
  // Normal pair (grey)
  if (colorType < 0.5) {
    return vec3(0.55, 0.55, 0.55);
  }
  // Long insert (red)
  if (colorType < 1.5) {
    return vec3(0.85, 0.25, 0.25);
  }
  // Short insert (blue)
  if (colorType < 2.5) {
    return vec3(0.25, 0.35, 0.85);
  }
  // Inter-chromosomal (purple)
  if (colorType < 3.5) {
    return vec3(0.5, 0.0, 0.5);
  }
  // Abnormal orientation (green)
  if (colorType < 4.5) {
    return vec3(0.0, 0.5, 0.0);
  }
  // Gradient - use hue
  float h = u_gradientHue / 360.0;
  float s = 0.5;
  float l = 0.5;
  // HSL to RGB conversion
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
  float m = l - c / 2.0;
  vec3 rgb;
  if (h < 1.0/6.0) rgb = vec3(c, x, 0.0);
  else if (h < 2.0/6.0) rgb = vec3(x, c, 0.0);
  else if (h < 3.0/6.0) rgb = vec3(0.0, c, x);
  else if (h < 4.0/6.0) rgb = vec3(0.0, x, c);
  else if (h < 5.0/6.0) rgb = vec3(x, 0.0, c);
  else rgb = vec3(c, 0.0, x);
  return rgb + m;
}

void main() {
  uint absPos = a_position + u_regionStart;
  vec2 splitPos = hpSplitUint(absPos);
  float sx = hpToClipX(splitPos, u_domainX);

  // Y: 0 at top of canvas, height at bottom
  float sy = 1.0 - (a_y / u_canvasHeight) * 2.0;

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = vec4(getColor(a_colorType), 1.0);
}
`

const ARC_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Vertex shader for vertical lines (inter-chromosomal connections)
const LINE_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uint a_position;
in float a_y;
in float a_colorType;

uniform vec3 u_domainX;
uniform uint u_regionStart;
uniform float u_canvasHeight;

out vec4 v_color;

${HP_GLSL_FUNCTIONS}

void main() {
  uint absPos = a_position + u_regionStart;
  vec2 splitPos = hpSplitUint(absPos);
  float sx = hpToClipX(splitPos, u_domainX);
  float sy = 1.0 - (a_y / u_canvasHeight) * 2.0;

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  // Inter-chromosomal (purple) or long-range (red)
  if (a_colorType < 0.5) {
    v_color = vec4(0.5, 0.0, 0.5, 1.0);  // purple
  } else {
    v_color = vec4(0.85, 0.25, 0.25, 1.0);  // red
  }
}
`

const LINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

export interface ArcsRenderState {
  domainX: [number, number]
  lineWidth: number
  canvasWidth: number
  canvasHeight: number
}

interface GPUBuffers {
  regionStart: number
  // Arc segments
  arcBuffer: WebGLBuffer
  arcCount: number
  arcOffsets: number[] // offsets into buffer for each arc
  arcLengths: number[] // number of vertices for each arc
  // Vertical lines
  lineBuffer: WebGLBuffer | null
  lineCount: number
}

export class WebGLArcsRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private arcProgram: WebGLProgram
  private lineProgram: WebGLProgram
  private buffers: GPUBuffers | null = null
  private arcVAO: WebGLVertexArrayObject | null = null
  private lineVAO: WebGLVertexArrayObject | null = null
  private arcUniforms: Record<string, WebGLUniformLocation | null> = {}
  private lineUniforms: Record<string, WebGLUniformLocation | null> = {}

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

    this.arcProgram = this.createProgram(ARC_VERTEX_SHADER, ARC_FRAGMENT_SHADER)
    this.lineProgram = this.createProgram(
      LINE_VERTEX_SHADER,
      LINE_FRAGMENT_SHADER,
    )

    this.cacheUniforms(this.arcProgram, this.arcUniforms, [
      'u_domainX',
      'u_regionStart',
      'u_canvasHeight',
      'u_gradientHue',
    ])

    this.cacheUniforms(this.lineProgram, this.lineUniforms, [
      'u_domainX',
      'u_regionStart',
      'u_canvasHeight',
    ])

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  private createShader(type: number, source: string): WebGLShader {
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

  private createProgram(vsSource: string, fsSource: string): WebGLProgram {
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

  private cacheUniforms(
    program: WebGLProgram,
    cache: Record<string, WebGLUniformLocation | null>,
    names: string[],
  ) {
    for (const name of names) {
      cache[name] = this.gl.getUniformLocation(program, name)
    }
  }

  uploadFromTypedArrays(data: {
    regionStart: number
    // Arc data: interleaved [x, y, colorType] per vertex, grouped by arc
    arcPositions: Uint32Array // x positions as offsets
    arcYs: Float32Array // y positions
    arcColorTypes: Float32Array // color types
    arcOffsets: number[] // start index for each arc
    arcLengths: number[] // vertex count for each arc
    numArcs: number
    // Vertical lines: [x, y0, y1, colorType] per line
    linePositions: Uint32Array
    lineYs: Float32Array // [y0, y1] pairs
    lineColorTypes: Float32Array
    numLines: number
  }) {
    const gl = this.gl

    // Clean up old buffers
    if (this.arcVAO) {
      gl.deleteVertexArray(this.arcVAO)
      this.arcVAO = null
    }
    if (this.lineVAO) {
      gl.deleteVertexArray(this.lineVAO)
      this.lineVAO = null
    }
    if (this.buffers) {
      gl.deleteBuffer(this.buffers.arcBuffer)
      if (this.buffers.lineBuffer) {
        gl.deleteBuffer(this.buffers.lineBuffer)
      }
    }

    if (data.numArcs === 0 && data.numLines === 0) {
      this.buffers = null
      return
    }

    // Create arc VAO and buffers
    this.arcVAO = gl.createVertexArray()!
    gl.bindVertexArray(this.arcVAO)

    const arcBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, arcBuffer)

    // Arc position attribute
    const posLoc = gl.getAttribLocation(this.arcProgram, 'a_position')
    const arcPosBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, arcPosBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, data.arcPositions, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribIPointer(posLoc, 1, gl.UNSIGNED_INT, 0, 0)

    // Arc y attribute
    const yLoc = gl.getAttribLocation(this.arcProgram, 'a_y')
    const arcYBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, arcYBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, data.arcYs, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(yLoc)
    gl.vertexAttribPointer(yLoc, 1, gl.FLOAT, false, 0, 0)

    // Arc color type attribute
    const colorLoc = gl.getAttribLocation(this.arcProgram, 'a_colorType')
    const arcColorBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, arcColorBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, data.arcColorTypes, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(colorLoc)
    gl.vertexAttribPointer(colorLoc, 1, gl.FLOAT, false, 0, 0)

    gl.bindVertexArray(null)

    // Create line VAO and buffers
    let lineBuffer: WebGLBuffer | null = null
    if (data.numLines > 0) {
      this.lineVAO = gl.createVertexArray()!
      gl.bindVertexArray(this.lineVAO)

      const linePosLoc = gl.getAttribLocation(this.lineProgram, 'a_position')
      const linePosBuffer = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, linePosBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, data.linePositions, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(linePosLoc)
      gl.vertexAttribIPointer(linePosLoc, 1, gl.UNSIGNED_INT, 0, 0)

      const lineYLoc = gl.getAttribLocation(this.lineProgram, 'a_y')
      const lineYBuffer = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, lineYBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, data.lineYs, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(lineYLoc)
      gl.vertexAttribPointer(lineYLoc, 1, gl.FLOAT, false, 0, 0)

      const lineColorLoc = gl.getAttribLocation(
        this.lineProgram,
        'a_colorType',
      )
      lineBuffer = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, data.lineColorTypes, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(lineColorLoc)
      gl.vertexAttribPointer(lineColorLoc, 1, gl.FLOAT, false, 0, 0)

      gl.bindVertexArray(null)
    }

    this.buffers = {
      regionStart: data.regionStart,
      arcBuffer,
      arcCount: data.numArcs,
      arcOffsets: data.arcOffsets,
      arcLengths: data.arcLengths,
      lineBuffer,
      lineCount: data.numLines,
    }
  }

  render(state: ArcsRenderState) {
    const gl = this.gl
    const canvas = this.canvas
    const { canvasWidth, canvasHeight, lineWidth } = state

    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth
      canvas.height = canvasHeight
    }

    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (!this.buffers) {
      return
    }

    const [domainStartHi, domainStartLo] = splitPositionWithFrac(
      state.domainX[0],
    )
    const domainExtent = state.domainX[1] - state.domainX[0]

    gl.lineWidth(lineWidth)

    // Draw arcs
    if (this.arcVAO && this.buffers.arcCount > 0) {
      gl.useProgram(this.arcProgram)
      gl.uniform3f(
        this.arcUniforms.u_domainX!,
        domainStartHi,
        domainStartLo,
        domainExtent,
      )
      gl.uniform1ui(
        this.arcUniforms.u_regionStart!,
        Math.floor(this.buffers.regionStart),
      )
      gl.uniform1f(this.arcUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.arcUniforms.u_gradientHue!, 0) // Default hue

      gl.bindVertexArray(this.arcVAO)

      // Draw each arc as a separate line strip
      for (let i = 0; i < this.buffers.arcCount; i++) {
        const offset = this.buffers.arcOffsets[i]!
        const length = this.buffers.arcLengths[i]!
        gl.drawArrays(gl.LINE_STRIP, offset, length)
      }
    }

    // Draw vertical lines
    if (this.lineVAO && this.buffers.lineCount > 0) {
      gl.useProgram(this.lineProgram)
      gl.uniform3f(
        this.lineUniforms.u_domainX!,
        domainStartHi,
        domainStartLo,
        domainExtent,
      )
      gl.uniform1ui(
        this.lineUniforms.u_regionStart!,
        Math.floor(this.buffers.regionStart),
      )
      gl.uniform1f(this.lineUniforms.u_canvasHeight!, canvasHeight)

      gl.bindVertexArray(this.lineVAO)
      gl.drawArrays(gl.LINES, 0, this.buffers.lineCount * 2)
    }

    gl.bindVertexArray(null)
  }

  destroy() {
    const gl = this.gl
    if (this.arcVAO) {
      gl.deleteVertexArray(this.arcVAO)
    }
    if (this.lineVAO) {
      gl.deleteVertexArray(this.lineVAO)
    }
    if (this.buffers) {
      gl.deleteBuffer(this.buffers.arcBuffer)
      if (this.buffers.lineBuffer) {
        gl.deleteBuffer(this.buffers.lineBuffer)
      }
    }
    gl.deleteProgram(this.arcProgram)
    gl.deleteProgram(this.lineProgram)
  }
}
