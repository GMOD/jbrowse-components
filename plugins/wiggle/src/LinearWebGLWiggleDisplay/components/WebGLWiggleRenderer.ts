/**
 * WebGL Renderer for wiggle display
 *
 * Supports multiple rendering modes: xyplot (bars), density (heatmap), line
 */

import {
  HP_GLSL_FUNCTIONS,
  SCORE_GLSL_FUNCTIONS,
  cacheUniforms,
  createProgram,
  splitPositionWithFrac,
} from '../../shared/webglUtils.ts'

// Vertex shader for wiggle bars (XY plot)
const XYPLOT_VERTEX_SHADER = `#version 300 es
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
${SCORE_GLSL_FUNCTIONS}

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
  float scoreYPos = scoreToY(a_score, u_domainY, u_canvasHeight, u_scaleType);
  float originY = scoreToY(0.0, u_domainY, u_canvasHeight, u_scaleType);

  // For filled bars, draw from origin (0) to score
  float yTop = min(scoreYPos, originY);
  float yBot = max(scoreYPos, originY);

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

// Vertex shader for density (heatmap) rendering
const DENSITY_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_position;  // [start, end] as uint offsets from regionStart
in float a_score;     // score value

uniform vec3 u_domainX;
uniform uint u_regionStart;
uniform float u_canvasHeight;
uniform vec2 u_domainY;     // [min, max] score domain
uniform int u_scaleType;    // 0 = linear, 1 = log
uniform vec3 u_posColor;    // High score color
uniform vec3 u_negColor;    // Low score color
uniform float u_bicolorPivot;
uniform int u_useBicolor;   // 0 = gradient, 1 = bicolor

out vec4 v_color;

${HP_GLSL_FUNCTIONS}
${SCORE_GLSL_FUNCTIONS}

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

  // Density fills the full height
  float sy = mix(-1.0, 1.0, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  // Color based on normalized score
  float normScore = normalizeScore(a_score, u_domainY, u_scaleType);

  vec3 color;
  if (u_useBicolor == 1) {
    // Bicolor mode: two distinct colors based on pivot
    float normalizedPivot = normalizeScore(u_bicolorPivot, u_domainY, u_scaleType);
    color = normScore < normalizedPivot ? u_negColor : u_posColor;
  } else {
    // Gradient mode: interpolate from low (gray/white) to high (posColor)
    vec3 lowColor = vec3(0.93, 0.93, 0.93); // #eee
    color = mix(lowColor, u_posColor, normScore);
  }

  v_color = vec4(color, 1.0);
}
`

// Vertex shader for line rendering
const LINE_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_position;  // [start, end] as uint offsets from regionStart
in float a_score;     // score value
in float a_prevScore; // previous score for connecting lines

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
${SCORE_GLSL_FUNCTIONS}

void main() {
  // Line rendering uses 6 vertices per feature to draw a step pattern:
  // - vertices 0,1: vertical line from previous score to current score at start
  // - vertices 2,3,4,5: horizontal line at current score from start to end
  int vid = gl_VertexID % 6;

  uint absStart = a_position.x + u_regionStart;
  uint absEnd = a_position.y + u_regionStart;
  vec2 splitStart = hpSplitUint(absStart);
  vec2 splitEnd = hpSplitUint(absEnd);
  float sx1 = hpToClipX(splitStart, u_domainX);
  float sx2 = hpToClipX(splitEnd, u_domainX);

  float scoreYPos = scoreToY(a_score, u_domainY, u_canvasHeight, u_scaleType);
  float prevScoreY = scoreToY(a_prevScore, u_domainY, u_canvasHeight, u_scaleType);

  float pxToClip = 2.0 / u_canvasHeight;
  float clipScoreY = 1.0 - scoreYPos * pxToClip;
  float clipPrevScoreY = 1.0 - prevScoreY * pxToClip;

  float sx;
  float sy;

  // Create step pattern: vertical then horizontal
  if (vid == 0) {
    // Start of vertical line (at previous score)
    sx = sx1;
    sy = clipPrevScoreY;
  } else if (vid == 1) {
    // End of vertical line (at current score)
    sx = sx1;
    sy = clipScoreY;
  } else if (vid == 2) {
    // Start of horizontal line
    sx = sx1;
    sy = clipScoreY;
  } else if (vid == 3) {
    // Middle of horizontal (for triangle strip)
    sx = sx2;
    sy = clipScoreY;
  } else if (vid == 4) {
    // Degenerate (same as 3)
    sx = sx2;
    sy = clipScoreY;
  } else {
    // End point
    sx = sx2;
    sy = clipScoreY;
  }

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

export type RenderingType = 'xyplot' | 'density' | 'line'

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
  renderingType: RenderingType
}

export interface WiggleRenderBlock {
  regionNumber: number
  domainX: [number, number]
  screenStartPx: number
  screenEndPx: number
}

interface GPUBuffers {
  regionStart: number
  featureVAO: WebGLVertexArrayObject
  featureCount: number
  lineVAO?: WebGLVertexArrayObject
}

export class WebGLWiggleRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private xyplotProgram: WebGLProgram
  private densityProgram: WebGLProgram
  private lineProgram: WebGLProgram
  private buffersMap = new Map<number, GPUBuffers>()
  private glBuffersMap = new Map<number, WebGLBuffer[]>()
  private xyplotUniforms: Record<string, WebGLUniformLocation | null> = {}
  private densityUniforms: Record<string, WebGLUniformLocation | null> = {}
  private lineUniforms: Record<string, WebGLUniformLocation | null> = {}
  private featureScoresMap = new Map<number, Float32Array>()

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

    // Create all shader programs
    this.xyplotProgram = createProgram(
      gl,
      XYPLOT_VERTEX_SHADER,
      WIGGLE_FRAGMENT_SHADER,
    )
    this.densityProgram = createProgram(
      gl,
      DENSITY_VERTEX_SHADER,
      WIGGLE_FRAGMENT_SHADER,
    )
    this.lineProgram = createProgram(
      gl,
      LINE_VERTEX_SHADER,
      WIGGLE_FRAGMENT_SHADER,
    )

    const uniformNames = [
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
    ]

    this.xyplotUniforms = cacheUniforms(gl, this.xyplotProgram, uniformNames)
    this.densityUniforms = cacheUniforms(gl, this.densityProgram, uniformNames)
    this.lineUniforms = cacheUniforms(gl, this.lineProgram, uniformNames)

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

    this.deleteBuffersForRegion(regionNumber)

    if (data.numFeatures === 0) {
      this.featureScoresMap.delete(regionNumber)
      return
    }

    this.featureScoresMap.set(regionNumber, data.featureScores)

    const glBuffers: WebGLBuffer[] = []

    const featureVAO = gl.createVertexArray()
    gl.bindVertexArray(featureVAO)

    glBuffers.push(
      ...this.uploadUintBuffer(
        this.xyplotProgram,
        'a_position',
        data.featurePositions,
        2,
      ),
    )
    glBuffers.push(
      ...this.uploadBufferReturnHandles(
        this.xyplotProgram,
        'a_score',
        data.featureScores,
        1,
      ),
    )

    gl.bindVertexArray(null)

    const lineVAO = gl.createVertexArray()
    gl.bindVertexArray(lineVAO)

    glBuffers.push(
      ...this.uploadUintBuffer(
        this.lineProgram,
        'a_position',
        data.featurePositions,
        2,
      ),
    )
    glBuffers.push(
      ...this.uploadBufferReturnHandles(
        this.lineProgram,
        'a_score',
        data.featureScores,
        1,
      ),
    )

    const prevScores = new Float32Array(data.numFeatures)
    prevScores[0] = data.featureScores[0]!
    for (let i = 1; i < data.numFeatures; i++) {
      prevScores[i] = data.featureScores[i - 1]!
    }
    glBuffers.push(
      ...this.uploadBufferReturnHandles(
        this.lineProgram,
        'a_prevScore',
        prevScores,
        1,
      ),
    )

    gl.bindVertexArray(null)

    this.glBuffersMap.set(regionNumber, glBuffers)
    this.buffersMap.set(regionNumber, {
      regionStart: data.regionStart,
      featureVAO,
      featureCount: data.numFeatures,
      lineVAO,
    })
  }

  // Legacy single-region upload (stores as region 0)
  uploadFromTypedArrays(data: {
    regionStart: number
    featurePositions: Uint32Array
    featureScores: Float32Array
    numFeatures: number
  }) {
    this.uploadForRegion(0, data)
  }

  private uploadBufferReturnHandles(
    program: WebGLProgram,
    attrib: string,
    data: Float32Array,
    size: number,
  ) {
    const gl = this.gl
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return []
    }

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
    return [buffer]
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
      return []
    }

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribIPointer(loc, size, gl.UNSIGNED_INT, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
    return [buffer]
  }

  renderBlocks(
    blocks: WiggleRenderBlock[],
    state: Omit<WiggleRenderState, 'domainX'>,
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

    let program: WebGLProgram
    let uniforms: Record<string, WebGLUniformLocation | null>

    if (renderingType === 'density') {
      program = this.densityProgram
      uniforms = this.densityUniforms
    } else if (renderingType === 'line') {
      program = this.lineProgram
      uniforms = this.lineUniforms
    } else {
      program = this.xyplotProgram
      uniforms = this.xyplotUniforms
    }

    gl.useProgram(program)

    // Set uniforms that don't change per-block
    gl.uniform1f(uniforms.u_canvasHeight!, canvasHeight)
    gl.uniform2f(uniforms.u_domainY!, state.domainY[0], state.domainY[1])
    gl.uniform1i(uniforms.u_scaleType!, state.scaleType === 'log' ? 1 : 0)
    gl.uniform3f(
      uniforms.u_color!,
      state.color[0],
      state.color[1],
      state.color[2],
    )
    gl.uniform3f(
      uniforms.u_posColor!,
      state.posColor[0],
      state.posColor[1],
      state.posColor[2],
    )
    gl.uniform3f(
      uniforms.u_negColor!,
      state.negColor[0],
      state.negColor[1],
      state.negColor[2],
    )
    gl.uniform1f(uniforms.u_bicolorPivot!, state.bicolorPivot)
    gl.uniform1i(uniforms.u_useBicolor!, state.useBicolor ? 1 : 0)

    gl.enable(gl.SCISSOR_TEST)

    for (const block of blocks) {
      const buffers = this.buffersMap.get(block.regionNumber)
      if (!buffers || buffers.featureCount === 0) {
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

      // Compute viewport-clipped domain
      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const domainExtent = block.domainX[1] - block.domainX[0]
      const bpPerPx = domainExtent / fullBlockWidth
      const clippedDomainStart =
        block.domainX[0] + (scissorX - block.screenStartPx) * bpPerPx
      const clippedDomainEnd =
        block.domainX[0] + (scissorEnd - block.screenStartPx) * bpPerPx

      const [domainStartHi, domainStartLo] =
        splitPositionWithFrac(clippedDomainStart)
      const clippedExtent = clippedDomainEnd - clippedDomainStart

      gl.uniform3f(
        uniforms.u_domainX!,
        domainStartHi,
        domainStartLo,
        clippedExtent,
      )
      gl.uniform1ui(uniforms.u_regionStart!, Math.floor(buffers.regionStart))

      let vao: WebGLVertexArrayObject
      if (renderingType === 'line') {
        vao = buffers.lineVAO!
      } else {
        vao = buffers.featureVAO
      }

      gl.bindVertexArray(vao)

      if (renderingType === 'line') {
        gl.drawArraysInstanced(gl.LINES, 0, 6, buffers.featureCount)
      } else {
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, buffers.featureCount)
      }

      gl.bindVertexArray(null)
    }

    gl.disable(gl.SCISSOR_TEST)
    gl.viewport(0, 0, canvasWidth, canvasHeight)
  }

  // Legacy single-region render (used for interaction fast path)
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

    // Find first available buffers for legacy render
    const buffers =
      this.buffersMap.get(0) ?? this.buffersMap.values().next().value
    if (!buffers || buffers.featureCount === 0) {
      return
    }

    const [domainStartHi, domainStartLo] = splitPositionWithFrac(
      state.domainX[0],
    )
    const domainExtent = state.domainX[1] - state.domainX[0]

    let program: WebGLProgram
    let uniforms: Record<string, WebGLUniformLocation | null>
    let vao: WebGLVertexArrayObject

    if (renderingType === 'density') {
      program = this.densityProgram
      uniforms = this.densityUniforms
      vao = buffers.featureVAO
    } else if (renderingType === 'line') {
      program = this.lineProgram
      uniforms = this.lineUniforms
      vao = buffers.lineVAO!
    } else {
      program = this.xyplotProgram
      uniforms = this.xyplotUniforms
      vao = buffers.featureVAO
    }

    gl.useProgram(program)
    gl.uniform3f(
      uniforms.u_domainX!,
      domainStartHi,
      domainStartLo,
      domainExtent,
    )
    gl.uniform1ui(uniforms.u_regionStart!, Math.floor(buffers.regionStart))
    gl.uniform1f(uniforms.u_canvasHeight!, canvasHeight)
    gl.uniform2f(uniforms.u_domainY!, state.domainY[0], state.domainY[1])
    gl.uniform1i(uniforms.u_scaleType!, state.scaleType === 'log' ? 1 : 0)
    gl.uniform3f(
      uniforms.u_color!,
      state.color[0],
      state.color[1],
      state.color[2],
    )
    gl.uniform3f(
      uniforms.u_posColor!,
      state.posColor[0],
      state.posColor[1],
      state.posColor[2],
    )
    gl.uniform3f(
      uniforms.u_negColor!,
      state.negColor[0],
      state.negColor[1],
      state.negColor[2],
    )
    gl.uniform1f(uniforms.u_bicolorPivot!, state.bicolorPivot)
    gl.uniform1i(uniforms.u_useBicolor!, state.useBicolor ? 1 : 0)

    gl.bindVertexArray(vao)

    if (renderingType === 'line') {
      gl.drawArraysInstanced(gl.LINES, 0, 6, buffers.featureCount)
    } else {
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, buffers.featureCount)
    }

    gl.bindVertexArray(null)
  }

  pruneStaleRegions(activeRegionNumbers: Set<number>) {
    for (const regionNumber of [...this.buffersMap.keys()]) {
      if (!activeRegionNumbers.has(regionNumber)) {
        this.deleteBuffersForRegion(regionNumber)
      }
    }
  }

  clearAllBuffers() {
    for (const regionNumber of [...this.buffersMap.keys()]) {
      this.deleteBuffersForRegion(regionNumber)
    }
  }

  private deleteBuffersForRegion(regionNumber: number) {
    const gl = this.gl
    const glBuffers = this.glBuffersMap.get(regionNumber)
    if (glBuffers) {
      for (const buf of glBuffers) {
        gl.deleteBuffer(buf)
      }
      this.glBuffersMap.delete(regionNumber)
    }
    const buffers = this.buffersMap.get(regionNumber)
    if (buffers) {
      gl.deleteVertexArray(buffers.featureVAO)
      if (buffers.lineVAO) {
        gl.deleteVertexArray(buffers.lineVAO)
      }
      this.buffersMap.delete(regionNumber)
    }
    this.featureScoresMap.delete(regionNumber)
  }

  destroy() {
    this.clearAllBuffers()
    const gl = this.gl
    gl.deleteProgram(this.xyplotProgram)
    gl.deleteProgram(this.densityProgram)
    gl.deleteProgram(this.lineProgram)
  }
}
