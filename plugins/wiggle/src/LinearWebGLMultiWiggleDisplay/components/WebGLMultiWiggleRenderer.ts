/**
 * WebGL Renderer for multi-wiggle display
 *
 * Supports multiple rendering modes: multirowxy (bars), multirowdensity (heatmap), multirowline
 */

import {
  HP_GLSL_FUNCTIONS,
  cacheUniforms,
  createProgram,
  splitPositionWithFrac,
} from '../../shared/webglUtils.ts'

// Vertex shader for multi-wiggle XY plot (bars)
const MULTI_XYPLOT_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_position;  // [start, end] as uint offsets from regionStart
in float a_score;     // score value
in float a_rowIndex;  // which row (source) this feature belongs to
in vec3 a_color;      // RGB color for this source

uniform vec3 u_domainX;
uniform uint u_regionStart;
uniform float u_canvasHeight;
uniform vec2 u_domainY;     // [min, max] score domain
uniform int u_scaleType;    // 0 = linear, 1 = log
uniform float u_numRows;    // total number of rows
uniform float u_rowPadding; // padding between rows in pixels

out vec4 v_color;

${HP_GLSL_FUNCTIONS}

float scoreToY(float score, vec2 domainY, float rowHeight, int scaleType) {
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

  // Convert to pixel position within row (0 at top, rowHeight at bottom)
  return (1.0 - normalizedScore) * rowHeight;
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

  // Calculate row dimensions
  float totalPadding = u_rowPadding * (u_numRows - 1.0);
  float rowHeight = (u_canvasHeight - totalPadding) / u_numRows;
  float rowTop = a_rowIndex * (rowHeight + u_rowPadding);

  // Y position based on score within the row
  float scoreY = scoreToY(a_score, u_domainY, rowHeight, u_scaleType);
  float originY = scoreToY(0.0, u_domainY, rowHeight, u_scaleType);

  // For filled bars, draw from origin (0) to score
  float yTop = min(scoreY, originY);
  float yBot = max(scoreY, originY);

  // Add row offset
  yTop += rowTop;
  yBot += rowTop;

  // Convert to clip space
  float pxToClip = 2.0 / u_canvasHeight;
  float syTop = 1.0 - yTop * pxToClip;
  float syBot = 1.0 - yBot * pxToClip;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = vec4(a_color, 1.0);
}
`

// Vertex shader for multi-wiggle density (heatmap)
const MULTI_DENSITY_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_position;  // [start, end] as uint offsets from regionStart
in float a_score;     // score value
in float a_rowIndex;  // which row (source) this feature belongs to
in vec3 a_color;      // RGB color for this source

uniform vec3 u_domainX;
uniform uint u_regionStart;
uniform float u_canvasHeight;
uniform vec2 u_domainY;     // [min, max] score domain
uniform int u_scaleType;    // 0 = linear, 1 = log
uniform float u_numRows;    // total number of rows
uniform float u_rowPadding; // padding between rows in pixels

out vec4 v_color;

${HP_GLSL_FUNCTIONS}

float normalizeScore(float score, vec2 domainY, int scaleType) {
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

  return clamp(normalizedScore, 0.0, 1.0);
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

  // Calculate row dimensions
  float totalPadding = u_rowPadding * (u_numRows - 1.0);
  float rowHeight = (u_canvasHeight - totalPadding) / u_numRows;
  float rowTop = a_rowIndex * (rowHeight + u_rowPadding);
  float rowBot = rowTop + rowHeight;

  // Density fills the full row height
  float pxToClip = 2.0 / u_canvasHeight;
  float syTop = 1.0 - rowTop * pxToClip;
  float syBot = 1.0 - rowBot * pxToClip;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  // Color based on normalized score - interpolate from gray to source color
  float normalizedScore = normalizeScore(a_score, u_domainY, u_scaleType);
  vec3 lowColor = vec3(0.93, 0.93, 0.93); // #eee
  vec3 color = mix(lowColor, a_color, normalizedScore);

  v_color = vec4(color, 1.0);
}
`

// Vertex shader for multi-wiggle line rendering
const MULTI_LINE_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_position;  // [start, end] as uint offsets from regionStart
in float a_score;     // score value
in float a_prevScore; // previous score for connecting lines
in float a_rowIndex;  // which row (source) this feature belongs to
in vec3 a_color;      // RGB color for this source

uniform vec3 u_domainX;
uniform uint u_regionStart;
uniform float u_canvasHeight;
uniform vec2 u_domainY;     // [min, max] score domain
uniform int u_scaleType;    // 0 = linear, 1 = log
uniform float u_numRows;    // total number of rows
uniform float u_rowPadding; // padding between rows in pixels

out vec4 v_color;

${HP_GLSL_FUNCTIONS}

float scoreToY(float score, vec2 domainY, float rowHeight, int scaleType) {
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

  normalizedScore = clamp(normalizedScore, 0.0, 1.0);
  return (1.0 - normalizedScore) * rowHeight;
}

void main() {
  int vid = gl_VertexID % 6;

  uint absStart = a_position.x + u_regionStart;
  uint absEnd = a_position.y + u_regionStart;
  vec2 splitStart = hpSplitUint(absStart);
  vec2 splitEnd = hpSplitUint(absEnd);
  float sx1 = hpToClipX(splitStart, u_domainX);
  float sx2 = hpToClipX(splitEnd, u_domainX);

  // Calculate row dimensions
  float totalPadding = u_rowPadding * (u_numRows - 1.0);
  float rowHeight = (u_canvasHeight - totalPadding) / u_numRows;
  float rowTop = a_rowIndex * (rowHeight + u_rowPadding);

  float scoreY = scoreToY(a_score, u_domainY, rowHeight, u_scaleType) + rowTop;
  float prevScoreY = scoreToY(a_prevScore, u_domainY, rowHeight, u_scaleType) + rowTop;

  float pxToClip = 2.0 / u_canvasHeight;
  float clipScoreY = 1.0 - scoreY * pxToClip;
  float clipPrevScoreY = 1.0 - prevScoreY * pxToClip;

  float sx;
  float sy;

  // Create step pattern: vertical then horizontal
  if (vid == 0) {
    sx = sx1;
    sy = clipPrevScoreY;
  } else if (vid == 1) {
    sx = sx1;
    sy = clipScoreY;
  } else if (vid == 2) {
    sx = sx1;
    sy = clipScoreY;
  } else if (vid == 3) {
    sx = sx2;
    sy = clipScoreY;
  } else if (vid == 4) {
    sx = sx2;
    sy = clipScoreY;
  } else {
    sx = sx2;
    sy = clipScoreY;
  }

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = vec4(a_color, 1.0);
}
`

const MULTI_WIGGLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

export type MultiRenderingType = 'multirowxy' | 'multirowdensity' | 'multirowline'

export interface SourceRenderData {
  featurePositions: Uint32Array
  featureScores: Float32Array
  numFeatures: number
  color: [number, number, number]
}

export interface MultiWiggleRenderState {
  domainX: [number, number]
  domainY: [number, number]
  scaleType: 'linear' | 'log'
  canvasWidth: number
  canvasHeight: number
  rowPadding: number
  renderingType: MultiRenderingType
}

interface GPUBuffers {
  regionStart: number
  featureVAO: WebGLVertexArrayObject
  totalFeatureCount: number
  numRows: number
  lineVAO?: WebGLVertexArrayObject
}

export class WebGLMultiWiggleRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private xyplotProgram: WebGLProgram
  private densityProgram: WebGLProgram
  private lineProgram: WebGLProgram
  private buffers: GPUBuffers | null = null
  private xyplotUniforms: Record<string, WebGLUniformLocation | null> = {}
  private densityUniforms: Record<string, WebGLUniformLocation | null> = {}
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

    this.xyplotProgram = createProgram(
      gl,
      MULTI_XYPLOT_VERTEX_SHADER,
      MULTI_WIGGLE_FRAGMENT_SHADER,
    )
    this.densityProgram = createProgram(
      gl,
      MULTI_DENSITY_VERTEX_SHADER,
      MULTI_WIGGLE_FRAGMENT_SHADER,
    )
    this.lineProgram = createProgram(
      gl,
      MULTI_LINE_VERTEX_SHADER,
      MULTI_WIGGLE_FRAGMENT_SHADER,
    )

    const uniformNames = [
      'u_domainX',
      'u_regionStart',
      'u_canvasHeight',
      'u_domainY',
      'u_scaleType',
      'u_numRows',
      'u_rowPadding',
    ]

    this.xyplotUniforms = cacheUniforms(gl, this.xyplotProgram, uniformNames)
    this.densityUniforms = cacheUniforms(gl, this.densityProgram, uniformNames)
    this.lineUniforms = cacheUniforms(gl, this.lineProgram, uniformNames)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  uploadFromSources(regionStart: number, sources: SourceRenderData[]) {
    const gl = this.gl

    if (this.buffers) {
      gl.deleteVertexArray(this.buffers.featureVAO)
      if (this.buffers.lineVAO) {
        gl.deleteVertexArray(this.buffers.lineVAO)
      }
    }

    // Calculate total features across all sources
    let totalFeatures = 0
    for (const source of sources) {
      totalFeatures += source.numFeatures
    }

    if (totalFeatures === 0 || sources.length === 0) {
      this.buffers = null
      return
    }

    // Create combined arrays with row index and color per feature
    const allPositions = new Uint32Array(totalFeatures * 2)
    const allScores = new Float32Array(totalFeatures)
    const allRowIndices = new Float32Array(totalFeatures)
    const allColors = new Float32Array(totalFeatures * 3)
    const allPrevScores = new Float32Array(totalFeatures)

    let offset = 0
    for (let rowIndex = 0; rowIndex < sources.length; rowIndex++) {
      const source = sources[rowIndex]!
      for (let i = 0; i < source.numFeatures; i++) {
        allPositions[(offset + i) * 2] = source.featurePositions[i * 2]!
        allPositions[(offset + i) * 2 + 1] = source.featurePositions[i * 2 + 1]!
        allScores[offset + i] = source.featureScores[i]!
        allRowIndices[offset + i] = rowIndex
        allColors[(offset + i) * 3] = source.color[0]
        allColors[(offset + i) * 3 + 1] = source.color[1]
        allColors[(offset + i) * 3 + 2] = source.color[2]
        // Previous score (first in each row uses its own score)
        allPrevScores[offset + i] =
          i === 0 ? source.featureScores[i]! : source.featureScores[i - 1]!
      }
      offset += source.numFeatures
    }

    // Create VAO for xyplot and density
    const featureVAO = gl.createVertexArray()!
    gl.bindVertexArray(featureVAO)

    this.uploadUintBuffer(this.xyplotProgram, 'a_position', allPositions, 2)
    this.uploadBuffer(this.xyplotProgram, 'a_score', allScores, 1)
    this.uploadBuffer(this.xyplotProgram, 'a_rowIndex', allRowIndices, 1)
    this.uploadBuffer(this.xyplotProgram, 'a_color', allColors, 3)

    gl.bindVertexArray(null)

    // Create VAO for line rendering (needs previous score)
    const lineVAO = gl.createVertexArray()!
    gl.bindVertexArray(lineVAO)

    this.uploadUintBuffer(this.lineProgram, 'a_position', allPositions, 2)
    this.uploadBuffer(this.lineProgram, 'a_score', allScores, 1)
    this.uploadBuffer(this.lineProgram, 'a_prevScore', allPrevScores, 1)
    this.uploadBuffer(this.lineProgram, 'a_rowIndex', allRowIndices, 1)
    this.uploadBuffer(this.lineProgram, 'a_color', allColors, 3)

    gl.bindVertexArray(null)

    this.buffers = {
      regionStart,
      featureVAO,
      totalFeatureCount: totalFeatures,
      numRows: sources.length,
      lineVAO,
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

  render(state: MultiWiggleRenderState) {
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

    if (!this.buffers || this.buffers.totalFeatureCount === 0) {
      return
    }

    const [domainStartHi, domainStartLo] = splitPositionWithFrac(
      state.domainX[0],
    )
    const domainExtent = state.domainX[1] - state.domainX[0]

    // Select program and uniforms based on rendering type
    let program: WebGLProgram
    let uniforms: Record<string, WebGLUniformLocation | null>
    let vao: WebGLVertexArrayObject

    if (renderingType === 'multirowdensity') {
      program = this.densityProgram
      uniforms = this.densityUniforms
      vao = this.buffers.featureVAO
    } else if (renderingType === 'multirowline') {
      program = this.lineProgram
      uniforms = this.lineUniforms
      vao = this.buffers.lineVAO!
    } else {
      program = this.xyplotProgram
      uniforms = this.xyplotUniforms
      vao = this.buffers.featureVAO
    }

    gl.useProgram(program)
    gl.uniform3f(
      uniforms.u_domainX!,
      domainStartHi,
      domainStartLo,
      domainExtent,
    )
    gl.uniform1ui(
      uniforms.u_regionStart!,
      Math.floor(this.buffers.regionStart),
    )
    gl.uniform1f(uniforms.u_canvasHeight!, canvasHeight)
    gl.uniform2f(uniforms.u_domainY!, state.domainY[0], state.domainY[1])
    gl.uniform1i(uniforms.u_scaleType!, state.scaleType === 'log' ? 1 : 0)
    gl.uniform1f(uniforms.u_numRows!, this.buffers.numRows)
    gl.uniform1f(uniforms.u_rowPadding!, state.rowPadding)

    gl.bindVertexArray(vao)

    if (renderingType === 'multirowline') {
      gl.drawArraysInstanced(gl.LINES, 0, 6, this.buffers.totalFeatureCount)
    } else {
      gl.drawArraysInstanced(
        gl.TRIANGLES,
        0,
        6,
        this.buffers.totalFeatureCount,
      )
    }

    gl.bindVertexArray(null)
  }

  destroy() {
    const gl = this.gl
    if (this.buffers) {
      gl.deleteVertexArray(this.buffers.featureVAO)
      if (this.buffers.lineVAO) {
        gl.deleteVertexArray(this.buffers.lineVAO)
      }
    }
    gl.deleteProgram(this.xyplotProgram)
    gl.deleteProgram(this.densityProgram)
    gl.deleteProgram(this.lineProgram)
  }
}
