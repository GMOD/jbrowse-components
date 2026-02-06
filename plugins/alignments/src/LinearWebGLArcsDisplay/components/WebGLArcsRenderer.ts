/**
 * WebGL Renderer for arcs display using instanced rendering.
 *
 * Each arc is one instance. A shared template buffer provides the `t` parameter
 * (0..1) and a `side` parameter (-1 or +1). The vertex shader computes the
 * curve point, extrudes perpendicular to the tangent to form a ribbon, and the
 * fragment shader applies analytical anti-aliasing via smoothstep + fwidth.
 */

import { colord } from '@jbrowse/core/util/colord'

import { fillColor } from '../../shared/color.ts'

const CURVE_SEGMENTS = 64
const NUM_ARC_COLORS = 8
const NUM_LINE_COLORS = 2

function cssColorToRgb(color: string): [number, number, number] {
  const { r, g, b } = colord(color).toRgb()
  return [r / 255, g / 255, b / 255]
}

// Arc color types (indices match getColorType in executeRenderWebGLArcsData.ts):
//   0 = proper pair (lightgrey)
//   1 = long insert (red)
//   2 = short insert (pink)
//   3 = inter-chrom (purple)
//   4 = LL orientation (green)
//   5 = RR orientation (#3a3a9d)
//   6 = RL orientation (teal)
//   7 = long-read rev-fwd (navy)
//   8 = gradient (computed in shader)
const arcColorPalette = [
  cssColorToRgb(fillColor.color_pair_lr),
  cssColorToRgb(fillColor.color_longinsert),
  cssColorToRgb(fillColor.color_shortinsert),
  cssColorToRgb(fillColor.color_interchrom),
  cssColorToRgb(fillColor.color_pair_ll),
  cssColorToRgb(fillColor.color_pair_rr),
  cssColorToRgb(fillColor.color_pair_rl),
  cssColorToRgb(fillColor.color_longread_rev_fwd),
]

// Line color types:
//   0 = inter-chrom (purple)
//   1 = long range (red)
const lineColorPalette = [
  cssColorToRgb(fillColor.color_interchrom),
  cssColorToRgb(fillColor.color_longinsert),
]

// Vertex shader — computes curve points per-instance, extrudes into ribbon
const ARC_VERTEX_SHADER = `#version 300 es
precision highp float;

// Per-vertex (from template buffer, shared across all instances)
in float a_t;     // 0.0 to 1.0
in float a_side;  // -1.0 or +1.0

// Per-instance attributes
in float a_x1;        // start x offset from regionStart
in float a_x2;        // end x offset from regionStart
in float a_colorType;
in float a_isArc;     // 0=bezier, 1=semicircle

uniform float u_domainStartOffset; // domainStart - regionStart
uniform float u_domainExtent;      // domainEnd - domainStart
uniform float u_canvasWidth;
uniform float u_canvasHeight;
uniform float u_lineWidthPx;
uniform float u_gradientHue;
uniform vec3 u_colors[${NUM_ARC_COLORS}];

out vec4 v_color;
out float v_dist;

const float PI = 3.14159265359;

vec3 getColor(float colorType) {
  int idx = int(colorType + 0.5);
  if (idx < ${NUM_ARC_COLORS}) {
    return u_colors[idx];
  }
  // Gradient
  float h = u_gradientHue / 360.0;
  float s = 0.5;
  float l = 0.5;
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float xc = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
  float m = l - c / 2.0;
  vec3 rgb;
  if (h < 1.0/6.0) rgb = vec3(c, xc, 0.0);
  else if (h < 2.0/6.0) rgb = vec3(xc, c, 0.0);
  else if (h < 3.0/6.0) rgb = vec3(0.0, c, xc);
  else if (h < 4.0/6.0) rgb = vec3(0.0, xc, c);
  else if (h < 5.0/6.0) rgb = vec3(xc, 0.0, c);
  else rgb = vec3(c, 0.0, xc);
  return rgb + m;
}

// Evaluate curve at parameter t, returns position in screen pixel space
vec2 evalCurve(float t) {
  float radius = (a_x2 - a_x1) / 2.0;
  float absrad = abs(radius);
  float cx = a_x1 + radius;
  float pxPerBp = u_canvasWidth / u_domainExtent;
  float absradPx = absrad * pxPerBp;
  float destY = min(u_canvasHeight, absradPx);

  float x_bp, y_px;

  if (a_isArc > 0.5) {
    float angle = t * PI;
    x_bp = cx + cos(angle) * radius;
    float rawY = sin(angle) * absradPx;
    y_px = (absradPx > 0.0) ? rawY * (destY / absradPx) : 0.0;
  } else {
    float mt = 1.0 - t;
    float mt2 = mt * mt;
    float mt3 = mt2 * mt;
    float t2 = t * t;
    float t3 = t2 * t;
    x_bp = mt3 * a_x1 + 3.0 * mt2 * t * a_x1 + 3.0 * mt * t2 * a_x2 + t3 * a_x2;
    y_px = 3.0 * mt2 * t * destY + 3.0 * mt * t2 * destY;
  }

  float screenX = (x_bp - u_domainStartOffset) * pxPerBp;
  return vec2(screenX, y_px);
}

void main() {
  vec2 pos = evalCurve(a_t);

  // Compute tangent via finite differences
  float eps = 1.0 / ${CURVE_SEGMENTS}.0;
  float t0 = max(a_t - eps * 0.5, 0.0);
  float t1 = min(a_t + eps * 0.5, 1.0);
  vec2 p0 = evalCurve(t0);
  vec2 p1 = evalCurve(t1);
  vec2 tangent = p1 - p0;
  float tangentLen = length(tangent);

  vec2 normal;
  if (tangentLen > 0.001) {
    tangent /= tangentLen;
    normal = vec2(-tangent.y, tangent.x);
  } else {
    normal = vec2(0.0, 1.0);
  }

  float halfWidth = u_lineWidthPx * 0.5 + 0.5;
  pos += normal * halfWidth * a_side;

  float clipX = (pos.x / u_canvasWidth) * 2.0 - 1.0;
  float clipY = 1.0 - (pos.y / u_canvasHeight) * 2.0;

  gl_Position = vec4(clipX, clipY, 0.0, 1.0);
  v_dist = a_side * halfWidth;
  v_color = vec4(getColor(a_colorType), 1.0);
}
`

const ARC_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
in float v_dist;
uniform float u_lineWidthPx;
out vec4 fragColor;
void main() {
  float halfWidth = u_lineWidthPx * 0.5;
  float d = abs(v_dist);
  float aa = fwidth(v_dist);
  float alpha = 1.0 - smoothstep(halfWidth - aa * 0.5, halfWidth + aa, d);
  fragColor = vec4(v_color.rgb, v_color.a * alpha);
}
`

// High-precision GLSL functions for genomic coordinates (used by line shader)
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
uniform vec3 u_lineColors[${NUM_LINE_COLORS}];

out vec4 v_color;

${HP_GLSL_FUNCTIONS}

void main() {
  uint absPos = a_position + u_regionStart;
  vec2 splitPos = hpSplitUint(absPos);
  float sx = hpToClipX(splitPos, u_domainX);
  float sy = 1.0 - (a_y / u_canvasHeight) * 2.0;

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  int idx = int(a_colorType + 0.5);
  if (idx < ${NUM_LINE_COLORS}) {
    v_color = vec4(u_lineColors[idx], 1.0);
  } else {
    v_color = vec4(u_lineColors[0], 1.0);
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
  numArcs: number
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
  private templateBuffer: WebGLBuffer | null = null
  private arcInstanceBuffers: WebGLBuffer[] = []
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
      'u_domainStartOffset',
      'u_domainExtent',
      'u_canvasWidth',
      'u_canvasHeight',
      'u_lineWidthPx',
      'u_gradientHue',
    ])
    for (let i = 0; i < NUM_ARC_COLORS; i++) {
      this.arcUniforms[`u_colors[${i}]`] = gl.getUniformLocation(
        this.arcProgram,
        `u_colors[${i}]`,
      )
    }

    this.cacheUniforms(this.lineProgram, this.lineUniforms, [
      'u_domainX',
      'u_regionStart',
      'u_canvasHeight',
    ])
    for (let i = 0; i < NUM_LINE_COLORS; i++) {
      this.lineUniforms[`u_lineColors[${i}]`] = gl.getUniformLocation(
        this.lineProgram,
        `u_lineColors[${i}]`,
      )
    }

    // Create template buffer with interleaved (t, side) pairs for triangle strip
    // For each t value, two vertices: one at side=+1, one at side=-1
    const numVertices = (CURVE_SEGMENTS + 1) * 2
    const templateData = new Float32Array(numVertices * 2)
    for (let i = 0; i <= CURVE_SEGMENTS; i++) {
      const t = i / CURVE_SEGMENTS
      const base = i * 4
      templateData[base + 0] = t
      templateData[base + 1] = 1
      templateData[base + 2] = t
      templateData[base + 3] = -1
    }
    this.templateBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.templateBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, templateData, gl.STATIC_DRAW)

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
    const vs = this.createShader(gl.VERTEX_SHADER, vsSource)
    const fs = this.createShader(gl.FRAGMENT_SHADER, fsSource)
    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    gl.detachShader(program, vs)
    gl.detachShader(program, fs)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
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

  private cleanupArcInstanceBuffers() {
    const gl = this.gl
    for (const buf of this.arcInstanceBuffers) {
      gl.deleteBuffer(buf)
    }
    this.arcInstanceBuffers = []
  }

  uploadFromTypedArrays(data: {
    regionStart: number
    arcX1: Float32Array
    arcX2: Float32Array
    arcColorTypes: Float32Array
    arcIsArc: Uint8Array
    numArcs: number
    linePositions: Uint32Array
    lineYs: Float32Array
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
    this.cleanupArcInstanceBuffers()
    if (this.buffers?.lineBuffer) {
      gl.deleteBuffer(this.buffers.lineBuffer)
    }

    if (data.numArcs === 0 && data.numLines === 0) {
      this.buffers = null
      return
    }

    // Create arc VAO with instanced rendering
    if (data.numArcs > 0) {
      this.arcVAO = gl.createVertexArray()!
      gl.bindVertexArray(this.arcVAO)

      const stride = 2 * 4 // 2 floats * 4 bytes each

      // Per-vertex: template t values (shared, not instanced)
      const tLoc = gl.getAttribLocation(this.arcProgram, 'a_t')
      gl.bindBuffer(gl.ARRAY_BUFFER, this.templateBuffer)
      gl.enableVertexAttribArray(tLoc)
      gl.vertexAttribPointer(tLoc, 1, gl.FLOAT, false, stride, 0)

      // Per-vertex: side (-1 or +1)
      const sideLoc = gl.getAttribLocation(this.arcProgram, 'a_side')
      gl.bindBuffer(gl.ARRAY_BUFFER, this.templateBuffer)
      gl.enableVertexAttribArray(sideLoc)
      gl.vertexAttribPointer(sideLoc, 1, gl.FLOAT, false, stride, 4)

      // Per-instance: a_x1
      const x1Loc = gl.getAttribLocation(this.arcProgram, 'a_x1')
      const x1Buf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, x1Buf)
      gl.bufferData(gl.ARRAY_BUFFER, data.arcX1, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(x1Loc)
      gl.vertexAttribPointer(x1Loc, 1, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(x1Loc, 1)
      this.arcInstanceBuffers.push(x1Buf)

      // Per-instance: a_x2
      const x2Loc = gl.getAttribLocation(this.arcProgram, 'a_x2')
      const x2Buf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, x2Buf)
      gl.bufferData(gl.ARRAY_BUFFER, data.arcX2, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(x2Loc)
      gl.vertexAttribPointer(x2Loc, 1, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(x2Loc, 1)
      this.arcInstanceBuffers.push(x2Buf)

      // Per-instance: a_colorType
      const colorLoc = gl.getAttribLocation(this.arcProgram, 'a_colorType')
      const colorBuf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf)
      gl.bufferData(gl.ARRAY_BUFFER, data.arcColorTypes, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(colorLoc)
      gl.vertexAttribPointer(colorLoc, 1, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(colorLoc, 1)
      this.arcInstanceBuffers.push(colorBuf)

      // Per-instance: a_isArc (Uint8 → float)
      const isArcLoc = gl.getAttribLocation(this.arcProgram, 'a_isArc')
      const isArcFloat = new Float32Array(data.arcIsArc.length)
      for (let i = 0; i < data.arcIsArc.length; i++) {
        isArcFloat[i] = data.arcIsArc[i]!
      }
      const isArcBuf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, isArcBuf)
      gl.bufferData(gl.ARRAY_BUFFER, isArcFloat, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(isArcLoc)
      gl.vertexAttribPointer(isArcLoc, 1, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(isArcLoc, 1)
      this.arcInstanceBuffers.push(isArcBuf)

      gl.bindVertexArray(null)
    }

    // Create line VAO and buffers
    let lineBuffer: WebGLBuffer | null = null
    if (data.numLines > 0) {
      this.lineVAO = gl.createVertexArray()!
      gl.bindVertexArray(this.lineVAO)

      const linePosLoc = gl.getAttribLocation(this.lineProgram, 'a_position')
      const linePosBuffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, linePosBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, data.linePositions, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(linePosLoc)
      gl.vertexAttribIPointer(linePosLoc, 1, gl.UNSIGNED_INT, 0, 0)

      const lineYLoc = gl.getAttribLocation(this.lineProgram, 'a_y')
      const lineYBuffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, lineYBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, data.lineYs, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(lineYLoc)
      gl.vertexAttribPointer(lineYLoc, 1, gl.FLOAT, false, 0, 0)

      const lineColorLoc = gl.getAttribLocation(this.lineProgram, 'a_colorType')
      lineBuffer = gl.createBuffer()!
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, data.lineColorTypes, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(lineColorLoc)
      gl.vertexAttribPointer(lineColorLoc, 1, gl.FLOAT, false, 0, 0)

      gl.bindVertexArray(null)
    }

    this.buffers = {
      regionStart: data.regionStart,
      numArcs: data.numArcs,
      lineBuffer,
      lineCount: data.numLines,
    }
  }

  render(state: ArcsRenderState) {
    const gl = this.gl
    const { canvasWidth, canvasHeight, lineWidth } = state

    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (!this.buffers) {
      return
    }

    // Draw arcs using instanced triangle strip rendering
    if (this.arcVAO && this.buffers.numArcs > 0) {
      gl.useProgram(this.arcProgram)

      const domainStartOffset = state.domainX[0] - this.buffers.regionStart
      const domainExtent = state.domainX[1] - state.domainX[0]

      gl.uniform1f(this.arcUniforms.u_domainStartOffset!, domainStartOffset)
      gl.uniform1f(this.arcUniforms.u_domainExtent!, domainExtent)
      gl.uniform1f(this.arcUniforms.u_canvasWidth!, canvasWidth)
      gl.uniform1f(this.arcUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.arcUniforms.u_lineWidthPx!, lineWidth)
      gl.uniform1f(this.arcUniforms.u_gradientHue!, 0)

      for (let i = 0; i < NUM_ARC_COLORS; i++) {
        const c = arcColorPalette[i]!
        gl.uniform3f(this.arcUniforms[`u_colors[${i}]`]!, c[0], c[1], c[2])
      }

      gl.bindVertexArray(this.arcVAO)
      gl.drawArraysInstanced(
        gl.TRIANGLE_STRIP,
        0,
        (CURVE_SEGMENTS + 1) * 2,
        this.buffers.numArcs,
      )
    }

    // Draw vertical lines
    if (this.lineVAO && this.buffers.lineCount > 0) {
      gl.useProgram(this.lineProgram)

      const [domainStartHi, domainStartLo] = splitPositionWithFrac(
        state.domainX[0],
      )
      const domainExtent = state.domainX[1] - state.domainX[0]

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

      for (let i = 0; i < NUM_LINE_COLORS; i++) {
        const c = lineColorPalette[i]!
        gl.uniform3f(this.lineUniforms[`u_lineColors[${i}]`]!, c[0], c[1], c[2])
      }

      gl.lineWidth(lineWidth)
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
    this.cleanupArcInstanceBuffers()
    if (this.templateBuffer) {
      gl.deleteBuffer(this.templateBuffer)
    }
    if (this.buffers?.lineBuffer) {
      gl.deleteBuffer(this.buffers.lineBuffer)
    }
    gl.deleteProgram(this.arcProgram)
    gl.deleteProgram(this.lineProgram)
  }
}
