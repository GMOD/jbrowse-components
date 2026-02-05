/**
 * WebGL Renderer for wiggle display
 *
 * Draws wiggle features as filled rectangles (XY plot style)
 */

import {
  HP_GLSL_FUNCTIONS,
  cacheUniforms,
  createProgram,
  splitPositionWithFrac,
} from '../../shared/webglUtils.ts'

// Vertex shader for wiggle bars
const WIGGLE_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_position;  // [start, end] as uint offsets from regionStart
in float a_score;     // score value

uniform vec3 u_domainX;
uniform uint u_regionStart;
uniform float u_canvasHeight;
uniform vec2 u_domainY;     // [min, max] score domain
uniform int u_scaleType;    // 0 = linear, 1 = log
uniform vec3 u_color;       // RGB color
uniform vec3 u_posColor;    // Positive score color
uniform vec3 u_negColor;    // Negative score color
uniform float u_bicolorPivot;
uniform int u_useBicolor;   // 0 = single color, 1 = bicolor

out vec4 v_color;

${HP_GLSL_FUNCTIONS}

float scoreToY(float score, vec2 domainY, float canvasHeight, int scaleType) {
  float minScore = domainY.x;
  float maxScore = domainY.y;

  float normalizedScore;
  if (scaleType == 1) {
    // Log scale
    float logMin = log2(max(minScore, 1.0));
    float logMax = log2(max(maxScore, 1.0));
    float logScore = log2(max(score, 1.0));
    normalizedScore = (logScore - logMin) / (logMax - logMin);
  } else {
    // Linear scale
    normalizedScore = (score - minScore) / (maxScore - minScore);
  }

  // Clamp to 0-1
  normalizedScore = clamp(normalizedScore, 0.0, 1.0);

  // Convert to pixel position (0 at top, height at bottom)
  return (1.0 - normalizedScore) * canvasHeight;
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

  // Y position based on score
  float scoreY = scoreToY(a_score, u_domainY, u_canvasHeight, u_scaleType);
  float originY = scoreToY(0.0, u_domainY, u_canvasHeight, u_scaleType);

  // For filled bars, draw from origin (0) to score
  float yTop = min(scoreY, originY);
  float yBot = max(scoreY, originY);

  // Convert to clip space
  float pxToClip = 2.0 / u_canvasHeight;
  float syTop = 1.0 - yTop * pxToClip;
  float syBot = 1.0 - yBot * pxToClip;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  // Color based on score (bicolor if enabled)
  vec3 color;
  if (u_useBicolor == 1) {
    color = a_score < u_bicolorPivot ? u_negColor : u_posColor;
  } else {
    color = u_color;
  }

  v_color = vec4(color, 1.0);
}
`

const WIGGLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

export interface WiggleRenderState {
  domainX: [number, number]
  domainY: [number, number]
  scaleType: 'linear' | 'log'
  color: [number, number, number]
  posColor: [number, number, number]
  negColor: [number, number, number]
  bicolorPivot: number
  useBicolor: boolean
  canvasWidth: number
  canvasHeight: number
}

interface GPUBuffers {
  regionStart: number
  featureVAO: WebGLVertexArrayObject
  featureCount: number
}

export class WebGLWiggleRenderer {
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

    this.program = createProgram(gl, WIGGLE_VERTEX_SHADER, WIGGLE_FRAGMENT_SHADER)

    this.uniforms = cacheUniforms(gl, this.program, [
      'u_domainX',
      'u_regionStart',
      'u_canvasHeight',
      'u_domainY',
      'u_scaleType',
      'u_color',
      'u_posColor',
      'u_negColor',
      'u_bicolorPivot',
      'u_useBicolor',
    ])

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  uploadFromTypedArrays(data: {
    regionStart: number
    featurePositions: Uint32Array // [start, end] pairs as offsets
    featureScores: Float32Array // score values
    numFeatures: number
  }) {
    const gl = this.gl

    if (this.buffers) {
      gl.deleteVertexArray(this.buffers.featureVAO)
    }

    if (data.numFeatures === 0) {
      this.buffers = null
      return
    }

    const featureVAO = gl.createVertexArray()!
    gl.bindVertexArray(featureVAO)

    this.uploadUintBuffer(this.program, 'a_position', data.featurePositions, 2)
    this.uploadBuffer(this.program, 'a_score', data.featureScores, 1)

    gl.bindVertexArray(null)

    this.buffers = {
      regionStart: data.regionStart,
      featureVAO,
      featureCount: data.numFeatures,
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
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribIPointer(loc, size, gl.UNSIGNED_INT, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  render(state: WiggleRenderState) {
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

    if (!this.buffers || this.buffers.featureCount === 0) {
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
    gl.uniform2f(
      this.uniforms.u_domainY!,
      state.domainY[0],
      state.domainY[1],
    )
    gl.uniform1i(
      this.uniforms.u_scaleType!,
      state.scaleType === 'log' ? 1 : 0,
    )
    gl.uniform3f(
      this.uniforms.u_color!,
      state.color[0],
      state.color[1],
      state.color[2],
    )
    gl.uniform3f(
      this.uniforms.u_posColor!,
      state.posColor[0],
      state.posColor[1],
      state.posColor[2],
    )
    gl.uniform3f(
      this.uniforms.u_negColor!,
      state.negColor[0],
      state.negColor[1],
      state.negColor[2],
    )
    gl.uniform1f(this.uniforms.u_bicolorPivot!, state.bicolorPivot)
    gl.uniform1i(this.uniforms.u_useBicolor!, state.useBicolor ? 1 : 0)

    gl.bindVertexArray(this.buffers.featureVAO)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.featureCount)
    gl.bindVertexArray(null)
  }

  destroy() {
    const gl = this.gl
    if (this.buffers) {
      gl.deleteVertexArray(this.buffers.featureVAO)
    }
    gl.deleteProgram(this.program)
  }
}
