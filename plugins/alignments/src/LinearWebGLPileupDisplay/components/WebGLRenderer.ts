/**
 * WebGL Renderer for pileup display
 *
 * Handles shader compilation, buffer management, and rendering.
 * Data is uploaded once, then rendering only updates uniforms.
 */

import type { FeatureData, CoverageData, GapData, MismatchData, InsertionData } from '../model'

// Vertex shader for reads
const READ_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
in float a_y;
in float a_flags;
in float a_mapq;
in float a_insertSize;

uniform vec2 u_domainX;
uniform vec2 u_rangeY;
uniform int u_colorScheme;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_coverageOffset;  // pixels to offset down for coverage area
uniform float u_canvasHeight;

out vec4 v_color;
out vec2 v_localPos;

vec3 strandColor(float flags) {
  bool isReverse = mod(floor(flags / 16.0), 2.0) > 0.5;
  return isReverse ? vec3(0.53, 0.53, 0.85) : vec3(0.85, 0.53, 0.53);
}

vec3 mapqColor(float mapq) {
  float t = clamp(mapq / 60.0, 0.0, 1.0);
  return mix(vec3(0.85, 0.35, 0.35), vec3(0.35, 0.45, 0.85), t);
}

vec3 insertSizeColor(float insertSize) {
  float normal = 400.0;
  float dev = abs(insertSize - normal) / normal;
  if (insertSize < normal) {
    return mix(vec3(0.55), vec3(0.85, 0.25, 0.25), clamp(dev * 2.0, 0.0, 1.0));
  }
  return mix(vec3(0.55), vec3(0.25, 0.35, 0.85), clamp(dev, 0.0, 1.0));
}

vec3 firstOfPairColor(float flags) {
  bool isFirst = mod(floor(flags / 64.0), 2.0) > 0.5;
  return isFirst ? vec3(0.85, 0.53, 0.53) : vec3(0.53, 0.53, 0.85);
}

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;
  v_localPos = vec2(localX, localY);

  float domainWidth = u_domainX.y - u_domainX.x;
  float sx1 = (a_position.x - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx2 = (a_position.y - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx = mix(sx1, sx2, localX);

  // Calculate available height for pileup (below coverage)
  float availableHeight = u_canvasHeight - u_coverageOffset;
  float yRange = u_rangeY.y - u_rangeY.x;
  float rowHeight = u_featureHeight + u_featureSpacing;
  float yTop = a_y * rowHeight;
  float yBot = yTop + u_featureHeight;

  // Map to clip space, accounting for coverage offset at top
  // Coverage takes top u_coverageOffset pixels
  float pileupTop = 1.0 - (u_coverageOffset / u_canvasHeight) * 2.0;
  float syTop = pileupTop - (yTop - u_rangeY.x) / yRange * (availableHeight / u_canvasHeight) * 2.0;
  float syBot = pileupTop - (yBot - u_rangeY.x) / yRange * (availableHeight / u_canvasHeight) * 2.0;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  vec3 color;
  if (u_colorScheme == 0) color = strandColor(a_flags);
  else if (u_colorScheme == 1) color = mapqColor(a_mapq);
  else if (u_colorScheme == 2) color = insertSizeColor(a_insertSize);
  else if (u_colorScheme == 3) color = firstOfPairColor(a_flags);
  else color = vec3(0.6);

  v_color = vec4(color, 1.0);
}
`

const READ_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
in vec2 v_localPos;
out vec4 fragColor;
void main() {
  float border = 0.06;
  float darken = (v_localPos.y < border || v_localPos.y > 1.0 - border) ? 0.7 : 1.0;
  fragColor = vec4(v_color.rgb * darken, v_color.a);
}
`

// Coverage vertex shader - renders bars as instanced quads
const COVERAGE_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;    // genomic position (start of bin)
in float a_depth;       // total depth

uniform vec2 u_domainX;
uniform float u_coverageHeight;  // height in pixels
uniform float u_maxDepth;
uniform float u_binSize;
uniform float u_canvasHeight;

out vec4 v_color;
out vec2 v_localPos;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;
  v_localPos = vec2(localX, localY);

  float domainWidth = u_domainX.y - u_domainX.x;

  // X: map genomic position to clip space
  float x1 = (a_position - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float x2 = (a_position + u_binSize - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx = mix(x1, x2, localX);

  // Y: coverage area at top of canvas
  // Bar height proportional to depth, growing UPWARD from bottom of coverage area
  float barHeight = (a_depth / u_maxDepth) * u_coverageHeight;

  // Bottom of coverage area in clip space
  float coverageBottom = 1.0 - (u_coverageHeight / u_canvasHeight) * 2.0;

  // Bars grow upward from the bottom of the coverage area
  float yBot = coverageBottom;
  float yTop = coverageBottom + (barHeight / u_canvasHeight) * 2.0;
  float sy = mix(yBot, yTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  // Always gray
  v_color = vec4(0.65, 0.65, 0.65, 1.0);
}
`

const COVERAGE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
in vec2 v_localPos;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Simple line shader for drawing separator
const LINE_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const LINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec4 u_color;
void main() {
  fragColor = u_color;
}
`

// Gap (deletion/skip) vertex shader - dark rectangles over reads
const GAP_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;  // start, end
in float a_y;

uniform vec2 u_domainX;
uniform vec2 u_rangeY;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_coverageOffset;
uniform float u_canvasHeight;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainWidth = u_domainX.y - u_domainX.x;
  float sx1 = (a_position.x - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx2 = (a_position.y - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx = mix(sx1, sx2, localX);

  // Gap is a thin line in the middle of the read row
  float availableHeight = u_canvasHeight - u_coverageOffset;
  float yRange = u_rangeY.y - u_rangeY.x;
  float rowHeight = u_featureHeight + u_featureSpacing;

  float yMid = a_y * rowHeight + u_featureHeight * 0.5;
  float gapHeight = u_featureHeight * 0.3;

  float pileupTop = 1.0 - (u_coverageOffset / u_canvasHeight) * 2.0;
  float syTop = pileupTop - (yMid - gapHeight - u_rangeY.x) / yRange * (availableHeight / u_canvasHeight) * 2.0;
  float syBot = pileupTop - (yMid + gapHeight - u_rangeY.x) / yRange * (availableHeight / u_canvasHeight) * 2.0;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
}
`

const GAP_FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 fragColor;
void main() {
  fragColor = vec4(0.15, 0.15, 0.15, 1.0);  // Dark for deletion
}
`

// Mismatch vertex shader - colored rectangles for SNPs
const MISMATCH_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;  // Genomic position
in float a_y;
in float a_base;      // 0=A, 1=C, 2=G, 3=T

uniform vec2 u_domainX;
uniform vec2 u_rangeY;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_coverageOffset;
uniform float u_canvasHeight;

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainWidth = u_domainX.y - u_domainX.x;

  // Mismatch is 1bp wide, ensure minimum screen width
  float x1 = a_position;
  float x2 = a_position + 1.0;

  float sx1 = (x1 - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx2 = (x2 - u_domainX.x) / domainWidth * 2.0 - 1.0;

  // Minimum width of ~3 pixels
  float minWidth = 6.0 / domainWidth * 2.0;
  if (sx2 - sx1 < minWidth) {
    float mid = (sx1 + sx2) * 0.5;
    sx1 = mid - minWidth * 0.5;
    sx2 = mid + minWidth * 0.5;
  }

  float sx = mix(sx1, sx2, localX);

  float availableHeight = u_canvasHeight - u_coverageOffset;
  float yRange = u_rangeY.y - u_rangeY.x;
  float rowHeight = u_featureHeight + u_featureSpacing;
  float yTop = a_y * rowHeight;
  float yBot = yTop + u_featureHeight;

  float pileupTop = 1.0 - (u_coverageOffset / u_canvasHeight) * 2.0;
  float syTop = pileupTop - (yTop - u_rangeY.x) / yRange * (availableHeight / u_canvasHeight) * 2.0;
  float syBot = pileupTop - (yBot - u_rangeY.x) / yRange * (availableHeight / u_canvasHeight) * 2.0;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  // Base colors: A=green, C=blue, G=orange, T=red
  vec3 baseColors[4] = vec3[4](
    vec3(0.3, 0.8, 0.3),   // A = green
    vec3(0.3, 0.3, 0.9),   // C = blue
    vec3(0.9, 0.7, 0.2),   // G = orange
    vec3(0.9, 0.3, 0.3)    // T = red
  );
  int baseIdx = int(a_base);
  v_color = vec4(baseColors[baseIdx], 1.0);
}
`

const MISMATCH_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Insertion vertex shader - small triangles
const INSERTION_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;
in float a_y;

uniform vec2 u_domainX;
uniform vec2 u_rangeY;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_coverageOffset;
uniform float u_canvasHeight;

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 3;

  float domainWidth = u_domainX.y - u_domainX.x;
  float availableHeight = u_canvasHeight - u_coverageOffset;
  float yRange = u_rangeY.y - u_rangeY.x;
  float rowHeight = u_featureHeight + u_featureSpacing;

  float cx = (a_position - u_domainX.x) / domainWidth * 2.0 - 1.0;

  float yMid = a_y * rowHeight + u_featureHeight * 0.5;
  float pileupTop = 1.0 - (u_coverageOffset / u_canvasHeight) * 2.0;
  float cy = pileupTop - (yMid - u_rangeY.x) / yRange * (availableHeight / u_canvasHeight) * 2.0;

  // Triangle size
  float sizeX = 0.008;
  float sizeY = 0.025;

  vec2 offsets[3] = vec2[3](
    vec2(0.0, sizeY),     // Top
    vec2(-sizeX, -sizeY), // Bottom left
    vec2(sizeX, -sizeY)   // Bottom right
  );

  gl_Position = vec4(cx + offsets[vid].x, cy + offsets[vid].y, 0.0, 1.0);
  v_color = vec4(0.8, 0.2, 0.8, 1.0);  // Purple for insertions
}
`

const INSERTION_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

export interface RenderState {
  domainX: [number, number]
  rangeY: [number, number]
  colorScheme: number
  featureHeight: number
  featureSpacing: number
  showCoverage: boolean
  coverageHeight: number
  showMismatches: boolean
}

interface GPUBuffers {
  readVAO: WebGLVertexArrayObject
  readCount: number
  coverageVAO: WebGLVertexArrayObject | null
  coverageCount: number
  maxDepth: number
  binSize: number
  // CIGAR data
  gapVAO: WebGLVertexArrayObject | null
  gapCount: number
  mismatchVAO: WebGLVertexArrayObject | null
  mismatchCount: number
  insertionVAO: WebGLVertexArrayObject | null
  insertionCount: number
}

export class WebGLRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement

  private readProgram: WebGLProgram
  private coverageProgram: WebGLProgram
  private lineProgram: WebGLProgram
  private gapProgram: WebGLProgram
  private mismatchProgram: WebGLProgram
  private insertionProgram: WebGLProgram

  private buffers: GPUBuffers | null = null
  private layoutMap: Map<string, number> = new Map()
  private lineBuffer: WebGLBuffer | null = null

  private readUniforms: Record<string, WebGLUniformLocation | null> = {}
  private coverageUniforms: Record<string, WebGLUniformLocation | null> = {}
  private lineUniforms: Record<string, WebGLUniformLocation | null> = {}
  private gapUniforms: Record<string, WebGLUniformLocation | null> = {}
  private mismatchUniforms: Record<string, WebGLUniformLocation | null> = {}
  private insertionUniforms: Record<string, WebGLUniformLocation | null> = {}

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

    this.readProgram = this.createProgram(
      READ_VERTEX_SHADER,
      READ_FRAGMENT_SHADER,
    )

    this.coverageProgram = this.createProgram(
      COVERAGE_VERTEX_SHADER,
      COVERAGE_FRAGMENT_SHADER,
    )

    this.lineProgram = this.createProgram(LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER)
    this.gapProgram = this.createProgram(GAP_VERTEX_SHADER, GAP_FRAGMENT_SHADER)
    this.mismatchProgram = this.createProgram(MISMATCH_VERTEX_SHADER, MISMATCH_FRAGMENT_SHADER)
    this.insertionProgram = this.createProgram(INSERTION_VERTEX_SHADER, INSERTION_FRAGMENT_SHADER)

    this.cacheUniforms(this.lineProgram, this.lineUniforms, ['u_color'])

    // Create line buffer for separator
    this.lineBuffer = gl.createBuffer()

    this.cacheUniforms(this.readProgram, this.readUniforms, [
      'u_domainX',
      'u_rangeY',
      'u_colorScheme',
      'u_featureHeight',
      'u_featureSpacing',
      'u_coverageOffset',
      'u_canvasHeight',
    ])

    this.cacheUniforms(this.coverageProgram, this.coverageUniforms, [
      'u_domainX',
      'u_coverageHeight',
      'u_maxDepth',
      'u_binSize',
      'u_canvasHeight',
    ])

    const cigarUniforms = [
      'u_domainX',
      'u_rangeY',
      'u_featureHeight',
      'u_featureSpacing',
      'u_coverageOffset',
      'u_canvasHeight',
    ]
    this.cacheUniforms(this.gapProgram, this.gapUniforms, cigarUniforms)
    this.cacheUniforms(this.mismatchProgram, this.mismatchUniforms, cigarUniforms)
    this.cacheUniforms(this.insertionProgram, this.insertionUniforms, cigarUniforms)

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

  private computeLayout(features: FeatureData[]): { maxY: number } {
    const sorted = [...features].sort((a, b) => a.start - b.start)
    const levels: number[] = []
    this.layoutMap.clear()

    for (const feature of sorted) {
      let y = 0
      for (let i = 0; i < levels.length; i++) {
        if (levels[i] <= feature.start) {
          y = i
          break
        }
        y = i + 1
      }
      this.layoutMap.set(feature.id, y)
      levels[y] = feature.end + 2
    }

    return { maxY: levels.length }
  }

  uploadFeatures(features: FeatureData[]): { maxY: number } {
    const gl = this.gl

    // Clean up old buffers
    if (this.buffers) {
      gl.deleteVertexArray(this.buffers.readVAO)
      if (this.buffers.coverageVAO) {
        gl.deleteVertexArray(this.buffers.coverageVAO)
      }
      if (this.buffers.gapVAO) {
        gl.deleteVertexArray(this.buffers.gapVAO)
      }
      if (this.buffers.mismatchVAO) {
        gl.deleteVertexArray(this.buffers.mismatchVAO)
      }
      if (this.buffers.insertionVAO) {
        gl.deleteVertexArray(this.buffers.insertionVAO)
      }
    }

    if (features.length === 0) {
      this.buffers = null
      return { maxY: 0 }
    }

    const { maxY } = this.computeLayout(features)

    // Prepare arrays
    const positions = new Float32Array(features.length * 2)
    const ys = new Float32Array(features.length)
    const flags = new Float32Array(features.length)
    const mapqs = new Float32Array(features.length)
    const insertSizes = new Float32Array(features.length)

    for (let i = 0; i < features.length; i++) {
      const f = features[i]
      const y = this.layoutMap.get(f.id) ?? 0

      positions[i * 2] = f.start
      positions[i * 2 + 1] = f.end
      ys[i] = y
      flags[i] = f.flags
      mapqs[i] = f.mapq
      insertSizes[i] = f.insertSize
    }

    // Read VAO
    const readVAO = gl.createVertexArray()!
    gl.bindVertexArray(readVAO)
    this.uploadBuffer(this.readProgram, 'a_position', positions, 2)
    this.uploadBuffer(this.readProgram, 'a_y', ys, 1)
    this.uploadBuffer(this.readProgram, 'a_flags', flags, 1)
    this.uploadBuffer(this.readProgram, 'a_mapq', mapqs, 1)
    this.uploadBuffer(this.readProgram, 'a_insertSize', insertSizes, 1)
    gl.bindVertexArray(null)

    this.buffers = {
      readVAO,
      readCount: features.length,
      coverageVAO: null,
      coverageCount: 0,
      maxDepth: 0,
      binSize: 1,
      gapVAO: null,
      gapCount: 0,
      mismatchVAO: null,
      mismatchCount: 0,
      insertionVAO: null,
      insertionCount: 0,
    }

    return { maxY }
  }

  uploadCigarData(
    gaps: GapData[],
    mismatches: MismatchData[],
    insertions: InsertionData[],
  ) {
    const gl = this.gl

    if (!this.buffers) {
      return
    }

    // Clean up old CIGAR VAOs
    if (this.buffers.gapVAO) {
      gl.deleteVertexArray(this.buffers.gapVAO)
      this.buffers.gapVAO = null
    }
    if (this.buffers.mismatchVAO) {
      gl.deleteVertexArray(this.buffers.mismatchVAO)
      this.buffers.mismatchVAO = null
    }
    if (this.buffers.insertionVAO) {
      gl.deleteVertexArray(this.buffers.insertionVAO)
      this.buffers.insertionVAO = null
    }

    // Upload gaps
    if (gaps.length > 0) {
      const gapPositions = new Float32Array(gaps.length * 2)
      const gapYs = new Float32Array(gaps.length)

      for (let i = 0; i < gaps.length; i++) {
        const g = gaps[i]
        const y = this.layoutMap.get(g.featureId) ?? 0
        gapPositions[i * 2] = g.start
        gapPositions[i * 2 + 1] = g.end
        gapYs[i] = y
      }

      const gapVAO = gl.createVertexArray()!
      gl.bindVertexArray(gapVAO)
      this.uploadBuffer(this.gapProgram, 'a_position', gapPositions, 2)
      this.uploadBuffer(this.gapProgram, 'a_y', gapYs, 1)
      gl.bindVertexArray(null)

      this.buffers.gapVAO = gapVAO
      this.buffers.gapCount = gaps.length
    } else {
      this.buffers.gapCount = 0
    }

    // Upload mismatches
    if (mismatches.length > 0) {
      const mmPositions = new Float32Array(mismatches.length)
      const mmYs = new Float32Array(mismatches.length)
      const mmBases = new Float32Array(mismatches.length)

      for (let i = 0; i < mismatches.length; i++) {
        const mm = mismatches[i]
        const y = this.layoutMap.get(mm.featureId) ?? 0
        mmPositions[i] = mm.position
        mmYs[i] = y
        mmBases[i] = mm.base
      }

      const mismatchVAO = gl.createVertexArray()!
      gl.bindVertexArray(mismatchVAO)
      this.uploadBuffer(this.mismatchProgram, 'a_position', mmPositions, 1)
      this.uploadBuffer(this.mismatchProgram, 'a_y', mmYs, 1)
      this.uploadBuffer(this.mismatchProgram, 'a_base', mmBases, 1)
      gl.bindVertexArray(null)

      this.buffers.mismatchVAO = mismatchVAO
      this.buffers.mismatchCount = mismatches.length
    } else {
      this.buffers.mismatchCount = 0
    }

    // Upload insertions
    if (insertions.length > 0) {
      const insPositions = new Float32Array(insertions.length)
      const insYs = new Float32Array(insertions.length)

      for (let i = 0; i < insertions.length; i++) {
        const ins = insertions[i]
        const y = this.layoutMap.get(ins.featureId) ?? 0
        insPositions[i] = ins.position
        insYs[i] = y
      }

      const insertionVAO = gl.createVertexArray()!
      gl.bindVertexArray(insertionVAO)
      this.uploadBuffer(this.insertionProgram, 'a_position', insPositions, 1)
      this.uploadBuffer(this.insertionProgram, 'a_y', insYs, 1)
      gl.bindVertexArray(null)

      this.buffers.insertionVAO = insertionVAO
      this.buffers.insertionCount = insertions.length
    } else {
      this.buffers.insertionCount = 0
    }
  }

  uploadCoverage(
    coverageData: CoverageData[],
    maxDepth: number,
    binSize: number,
  ) {
    const gl = this.gl

    if (!this.buffers) {
      return
    }

    // Clean up old coverage VAO
    if (this.buffers.coverageVAO) {
      gl.deleteVertexArray(this.buffers.coverageVAO)
    }

    if (coverageData.length === 0) {
      this.buffers.coverageVAO = null
      this.buffers.coverageCount = 0
      return
    }

    // Prepare coverage arrays
    const positions = new Float32Array(coverageData.length)
    const depths = new Float32Array(coverageData.length)

    for (let i = 0; i < coverageData.length; i++) {
      const d = coverageData[i]
      positions[i] = d.position
      depths[i] = d.depth
    }

    // Coverage VAO
    const coverageVAO = gl.createVertexArray()!
    gl.bindVertexArray(coverageVAO)
    this.uploadBuffer(this.coverageProgram, 'a_position', positions, 1)
    this.uploadBuffer(this.coverageProgram, 'a_depth', depths, 1)
    gl.bindVertexArray(null)

    this.buffers.coverageVAO = coverageVAO
    this.buffers.coverageCount = coverageData.length
    this.buffers.maxDepth = maxDepth
    this.buffers.binSize = binSize
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

  render(state: RenderState) {
    const gl = this.gl
    const canvas = this.canvas

    // Handle resize
    if (
      canvas.width !== canvas.clientWidth ||
      canvas.height !== canvas.clientHeight
    ) {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }

    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0.96, 0.96, 0.96, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (!this.buffers || this.buffers.readCount === 0) {
      return
    }

    // Draw coverage first (at top)
    if (
      state.showCoverage &&
      this.buffers.coverageVAO &&
      this.buffers.coverageCount > 0
    ) {
      gl.useProgram(this.coverageProgram)
      gl.uniform2f(
        this.coverageUniforms.u_domainX!,
        state.domainX[0],
        state.domainX[1],
      )
      gl.uniform1f(
        this.coverageUniforms.u_coverageHeight!,
        state.coverageHeight,
      )
      gl.uniform1f(this.coverageUniforms.u_maxDepth!, this.buffers.maxDepth)
      gl.uniform1f(this.coverageUniforms.u_binSize!, this.buffers.binSize)
      gl.uniform1f(this.coverageUniforms.u_canvasHeight!, canvas.height)

      gl.bindVertexArray(this.buffers.coverageVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.coverageCount)

      // Draw separator line at bottom of coverage area
      const lineY = 1.0 - (state.coverageHeight / canvas.height) * 2.0
      gl.useProgram(this.lineProgram)
      gl.uniform4f(this.lineUniforms.u_color!, 0.7, 0.7, 0.7, 1.0)

      const lineData = new Float32Array([-1, lineY, 1, lineY])
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, lineData, gl.DYNAMIC_DRAW)
      const linePosLoc = gl.getAttribLocation(this.lineProgram, 'a_position')
      gl.enableVertexAttribArray(linePosLoc)
      gl.vertexAttribPointer(linePosLoc, 2, gl.FLOAT, false, 0, 0)
      gl.drawArrays(gl.LINES, 0, 2)
      gl.disableVertexAttribArray(linePosLoc)
    }

    // Draw reads
    const coverageOffset = state.showCoverage ? state.coverageHeight : 0

    // Enable scissor test to clip pileup to area below coverage
    gl.enable(gl.SCISSOR_TEST)
    gl.scissor(
      0,
      0,
      canvas.width,
      canvas.height - coverageOffset,
    )

    gl.useProgram(this.readProgram)
    gl.uniform2f(
      this.readUniforms.u_domainX!,
      state.domainX[0],
      state.domainX[1],
    )
    gl.uniform2f(
      this.readUniforms.u_rangeY!,
      state.rangeY[0],
      state.rangeY[1],
    )
    gl.uniform1i(this.readUniforms.u_colorScheme!, state.colorScheme)
    gl.uniform1f(this.readUniforms.u_featureHeight!, state.featureHeight)
    gl.uniform1f(this.readUniforms.u_featureSpacing!, state.featureSpacing)
    gl.uniform1f(this.readUniforms.u_coverageOffset!, coverageOffset)
    gl.uniform1f(this.readUniforms.u_canvasHeight!, canvas.height)

    gl.bindVertexArray(this.buffers.readVAO)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.readCount)

    // Draw CIGAR features if enabled
    if (state.showMismatches) {
      const bpPerPx = (state.domainX[1] - state.domainX[0]) / canvas.width

      // Draw gaps (deletions) - always visible
      if (this.buffers.gapVAO && this.buffers.gapCount > 0) {
        gl.useProgram(this.gapProgram)
        gl.uniform2f(this.gapUniforms.u_domainX!, state.domainX[0], state.domainX[1])
        gl.uniform2f(this.gapUniforms.u_rangeY!, state.rangeY[0], state.rangeY[1])
        gl.uniform1f(this.gapUniforms.u_featureHeight!, state.featureHeight)
        gl.uniform1f(this.gapUniforms.u_featureSpacing!, state.featureSpacing)
        gl.uniform1f(this.gapUniforms.u_coverageOffset!, coverageOffset)
        gl.uniform1f(this.gapUniforms.u_canvasHeight!, canvas.height)

        gl.bindVertexArray(this.buffers.gapVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.gapCount)
      }

      // Draw mismatches - only when zoomed in enough (< 50 bp/px)
      if (this.buffers.mismatchVAO && this.buffers.mismatchCount > 0 && bpPerPx < 50) {
        gl.useProgram(this.mismatchProgram)
        gl.uniform2f(this.mismatchUniforms.u_domainX!, state.domainX[0], state.domainX[1])
        gl.uniform2f(this.mismatchUniforms.u_rangeY!, state.rangeY[0], state.rangeY[1])
        gl.uniform1f(this.mismatchUniforms.u_featureHeight!, state.featureHeight)
        gl.uniform1f(this.mismatchUniforms.u_featureSpacing!, state.featureSpacing)
        gl.uniform1f(this.mismatchUniforms.u_coverageOffset!, coverageOffset)
        gl.uniform1f(this.mismatchUniforms.u_canvasHeight!, canvas.height)

        gl.bindVertexArray(this.buffers.mismatchVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.mismatchCount)
      }

      // Draw insertions - only when zoomed in enough (< 100 bp/px)
      if (this.buffers.insertionVAO && this.buffers.insertionCount > 0 && bpPerPx < 100) {
        gl.useProgram(this.insertionProgram)
        gl.uniform2f(this.insertionUniforms.u_domainX!, state.domainX[0], state.domainX[1])
        gl.uniform2f(this.insertionUniforms.u_rangeY!, state.rangeY[0], state.rangeY[1])
        gl.uniform1f(this.insertionUniforms.u_featureHeight!, state.featureHeight)
        gl.uniform1f(this.insertionUniforms.u_featureSpacing!, state.featureSpacing)
        gl.uniform1f(this.insertionUniforms.u_coverageOffset!, coverageOffset)
        gl.uniform1f(this.insertionUniforms.u_canvasHeight!, canvas.height)

        gl.bindVertexArray(this.buffers.insertionVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, this.buffers.insertionCount)
      }
    }

    gl.disable(gl.SCISSOR_TEST)
    gl.bindVertexArray(null)
  }

  destroy() {
    const gl = this.gl
    if (this.buffers) {
      gl.deleteVertexArray(this.buffers.readVAO)
      if (this.buffers.coverageVAO) {
        gl.deleteVertexArray(this.buffers.coverageVAO)
      }
      if (this.buffers.gapVAO) {
        gl.deleteVertexArray(this.buffers.gapVAO)
      }
      if (this.buffers.mismatchVAO) {
        gl.deleteVertexArray(this.buffers.mismatchVAO)
      }
      if (this.buffers.insertionVAO) {
        gl.deleteVertexArray(this.buffers.insertionVAO)
      }
    }
    if (this.lineBuffer) {
      gl.deleteBuffer(this.lineBuffer)
    }
    gl.deleteProgram(this.readProgram)
    gl.deleteProgram(this.coverageProgram)
    gl.deleteProgram(this.lineProgram)
    gl.deleteProgram(this.gapProgram)
    gl.deleteProgram(this.mismatchProgram)
    gl.deleteProgram(this.insertionProgram)
  }
}
