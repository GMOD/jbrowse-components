/**
 * WebGL Renderer for cloud display
 *
 * Draws read chains as rectangles positioned by insert size on the y-axis
 * using a log scale. Similar to pileup but y-position is based on TLEN.
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

// Vertex shader for read chains
const CHAIN_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_position;  // [start, end] as uint offsets from regionStart
in float a_y;         // log-scaled y position (0-1)
in float a_flags;
in float a_colorType; // 0=normal, 1=long, 2=short, 3=interchrom, 4=orientation

uniform vec3 u_domainX;
uniform uint u_regionStart;
uniform float u_featureHeight;
uniform float u_canvasHeight;
uniform int u_colorScheme;

out vec4 v_color;

${HP_GLSL_FUNCTIONS}

vec3 getInsertSizeOrientationColor(float colorType, float flags) {
  // Normal pair
  if (colorType < 0.5) {
    return vec3(0.55, 0.55, 0.55);
  }
  // Long insert
  if (colorType < 1.5) {
    return vec3(0.85, 0.25, 0.25);
  }
  // Short insert
  if (colorType < 2.5) {
    return vec3(0.25, 0.35, 0.85);
  }
  // Inter-chromosomal
  if (colorType < 3.5) {
    return vec3(0.5, 0.0, 0.5);
  }
  // Abnormal orientation
  return vec3(0.0, 0.5, 0.0);
}

vec3 strandColor(float flags) {
  bool isReverse = mod(floor(flags / 16.0), 2.0) > 0.5;
  return isReverse ? vec3(0.55, 0.55, 0.85) : vec3(0.85, 0.55, 0.55);
}

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  uint absStart = a_position.x + u_regionStart;
  uint absEnd = a_position.y + u_regionStart;
  vec2 splitStart = hpSplitUint(absStart);
  vec2 splitEnd = hpSplitUint(absEnd);
  float sx1 = hpToClipX(splitStart, u_domainX);
  float sx2 = hpToClipX(splitEnd, u_domainX);
  float sx = mix(sx1, sx2, localX);

  // Y position: a_y is 0 at bottom, 1 at top (log scale of insert size)
  float yTopPx = (1.0 - a_y) * u_canvasHeight - u_featureHeight * 0.5;
  float yBotPx = yTopPx + u_featureHeight;

  float pxToClip = 2.0 / u_canvasHeight;
  float syTop = 1.0 - yTopPx * pxToClip;
  float syBot = 1.0 - yBotPx * pxToClip;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  vec3 color;
  if (u_colorScheme == 0) {
    color = getInsertSizeOrientationColor(a_colorType, a_flags);
  } else if (u_colorScheme == 1) {
    color = strandColor(a_flags);
  } else {
    color = vec3(0.55);
  }

  v_color = vec4(color, 1.0);
}
`

const CHAIN_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

export interface CloudRenderState {
  domainX: [number, number]
  featureHeight: number
  colorScheme: number
  canvasWidth: number
  canvasHeight: number
}

interface GPUBuffers {
  regionStart: number
  chainVAO: WebGLVertexArrayObject
  chainCount: number
}

export class WebGLCloudRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private chainProgram: WebGLProgram
  private buffers: GPUBuffers | null = null
  private glBuffers: WebGLBuffer[] = []
  private chainUniforms: Record<string, WebGLUniformLocation | null> = {}

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

    this.chainProgram = this.createProgram(
      CHAIN_VERTEX_SHADER,
      CHAIN_FRAGMENT_SHADER,
    )

    this.cacheUniforms(this.chainProgram, this.chainUniforms, [
      'u_domainX',
      'u_regionStart',
      'u_featureHeight',
      'u_canvasHeight',
      'u_colorScheme',
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
    chainPositions: Uint32Array // [start, end] pairs as offsets
    chainYs: Float32Array // log-scaled y positions (0-1)
    chainFlags: Uint16Array
    chainColorTypes: Uint8Array // color type: 0=normal, 1=long, 2=short, 3=inter, 4=orient
    numChains: number
  }) {
    const gl = this.gl

    this.deleteBuffers()

    if (data.numChains === 0) {
      return
    }

    const chainVAO = gl.createVertexArray()!
    gl.bindVertexArray(chainVAO)

    this.uploadUintBuffer(
      this.chainProgram,
      'a_position',
      data.chainPositions,
      2,
    )
    this.uploadBuffer(this.chainProgram, 'a_y', data.chainYs, 1)
    this.uploadBuffer(
      this.chainProgram,
      'a_flags',
      new Float32Array(data.chainFlags),
      1,
    )
    this.uploadBuffer(
      this.chainProgram,
      'a_colorType',
      new Float32Array(data.chainColorTypes),
      1,
    )

    gl.bindVertexArray(null)

    this.buffers = {
      regionStart: data.regionStart,
      chainVAO,
      chainCount: data.numChains,
    }
  }

  private uploadBuffer(
    program: WebGLProgram,
    attrib: string,
    data: Float32Array,
    size: number,
  ) {
    const gl = this.gl
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return
    }

    const buffer = gl.createBuffer()
    if (buffer) {
      this.glBuffers.push(buffer)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  private uploadUintBuffer(
    program: WebGLProgram,
    attrib: string,
    data: Uint32Array,
    size: number,
  ) {
    const gl = this.gl
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return
    }

    const buffer = gl.createBuffer()
    if (buffer) {
      this.glBuffers.push(buffer)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribIPointer(loc, size, gl.UNSIGNED_INT, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  render(state: CloudRenderState) {
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

    if (!this.buffers || this.buffers.chainCount === 0) {
      return
    }

    const [domainStartHi, domainStartLo] = splitPositionWithFrac(
      state.domainX[0],
    )
    const domainExtent = state.domainX[1] - state.domainX[0]

    gl.useProgram(this.chainProgram)
    gl.uniform3f(
      this.chainUniforms.u_domainX!,
      domainStartHi,
      domainStartLo,
      domainExtent,
    )
    gl.uniform1ui(
      this.chainUniforms.u_regionStart!,
      Math.floor(this.buffers.regionStart),
    )
    gl.uniform1f(this.chainUniforms.u_featureHeight!, state.featureHeight)
    gl.uniform1f(this.chainUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1i(this.chainUniforms.u_colorScheme!, state.colorScheme)

    gl.bindVertexArray(this.buffers.chainVAO)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.chainCount)
    gl.bindVertexArray(null)
  }

  private deleteBuffers() {
    const gl = this.gl
    for (const buf of this.glBuffers) {
      gl.deleteBuffer(buf)
    }
    this.glBuffers = []
    if (this.buffers) {
      gl.deleteVertexArray(this.buffers.chainVAO)
      this.buffers = null
    }
  }

  destroy() {
    this.deleteBuffers()
    this.gl.deleteProgram(this.chainProgram)
  }
}
