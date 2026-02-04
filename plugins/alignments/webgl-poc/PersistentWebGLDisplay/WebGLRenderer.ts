/**
 * WebGLRenderer - Core WebGL rendering engine for alignments
 *
 * This class manages:
 * - WebGL context and shader programs
 * - GPU buffer management (upload once, reuse)
 * - Uniform updates for instant zoom/pan
 * - Multi-pass rendering (reads, gaps, mismatches, insertions)
 */

// Shader sources
const READ_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;      // x1, x2 packed
in float a_y;            // Y position from layout
in float a_flags;        // BAM flags
in float a_mapq;         // Mapping quality
in float a_insertSize;   // Template length

uniform vec2 u_domainX;       // Visible genomic range [start, end]
uniform vec2 u_rangeY;        // Visible Y range [top, bottom]
uniform vec2 u_canvasSize;    // Canvas dimensions
uniform int u_colorScheme;    // 0=strand, 1=mapq, 2=insertSize, 3=firstOfPair
uniform float u_featureHeight;
uniform float u_featureSpacing;

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

  // Transform X from genomic to clip space
  float domainWidth = u_domainX.y - u_domainX.x;
  float x1 = a_position.x;
  float x2 = a_position.y;
  float sx1 = (x1 - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx2 = (x2 - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx = mix(sx1, sx2, localX);

  // Transform Y from layout space to clip space
  float yRange = u_rangeY.y - u_rangeY.x;
  float rowHeight = u_featureHeight + u_featureSpacing;
  float yTop = a_y * rowHeight;
  float yBot = yTop + u_featureHeight;

  float syTop = 1.0 - (yTop - u_rangeY.x) / yRange * 2.0;
  float syBot = 1.0 - (yBot - u_rangeY.x) / yRange * 2.0;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  // Select color
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
  float darken = 1.0;
  if (v_localPos.y < border || v_localPos.y > 1.0 - border) {
    darken = 0.7;
  }
  fragColor = vec4(v_color.rgb * darken, v_color.a);
}
`

const MISMATCH_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;  // Genomic position
in float a_y;
in float a_base;      // 0=A, 1=C, 2=G, 3=T, 4=N

uniform vec2 u_domainX;
uniform vec2 u_rangeY;
uniform float u_featureHeight;
uniform float u_featureSpacing;

out vec4 v_color;

const vec3 baseColors[5] = vec3[5](
  vec3(0.35, 0.75, 0.35),  // A
  vec3(0.35, 0.35, 0.85),  // C
  vec3(0.85, 0.65, 0.25),  // G
  vec3(0.85, 0.35, 0.35),  // T
  vec3(0.5, 0.5, 0.5)      // N
);

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainWidth = u_domainX.y - u_domainX.x;
  float x1 = a_position;
  float x2 = a_position + 1.0;

  float sx1 = (x1 - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx2 = (x2 - u_domainX.x) / domainWidth * 2.0 - 1.0;

  // Minimum width
  float minW = 4.0 / domainWidth * 2.0;
  if (sx2 - sx1 < minW) {
    float mid = (sx1 + sx2) * 0.5;
    sx1 = mid - minW * 0.5;
    sx2 = mid + minW * 0.5;
  }

  float sx = mix(sx1, sx2, localX);

  float yRange = u_rangeY.y - u_rangeY.x;
  float rowHeight = u_featureHeight + u_featureSpacing;
  float yTop = a_y * rowHeight;
  float yBot = yTop + u_featureHeight;

  float syTop = 1.0 - (yTop - u_rangeY.x) / yRange * 2.0;
  float syBot = 1.0 - (yBot - u_rangeY.x) / yRange * 2.0;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  int baseIdx = int(clamp(a_base, 0.0, 4.0));
  v_color = vec4(baseColors[baseIdx], 1.0);
}
`

const SIMPLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() { fragColor = v_color; }
`

const DELETION_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;  // x1, x2
in float a_y;

uniform vec2 u_domainX;
uniform vec2 u_rangeY;
uniform float u_featureHeight;
uniform float u_featureSpacing;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainWidth = u_domainX.y - u_domainX.x;
  float sx1 = (a_position.x - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx2 = (a_position.y - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx = mix(sx1, sx2, localX);

  float yRange = u_rangeY.y - u_rangeY.x;
  float rowHeight = u_featureHeight + u_featureSpacing;
  float yMid = a_y * rowHeight + u_featureHeight * 0.5;
  float halfH = u_featureHeight * 0.15;

  float syTop = 1.0 - (yMid - halfH - u_rangeY.x) / yRange * 2.0;
  float syBot = 1.0 - (yMid + halfH - u_rangeY.x) / yRange * 2.0;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
}
`

const DELETION_FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 fragColor;
void main() { fragColor = vec4(0.15, 0.15, 0.15, 1.0); }
`

export interface FeatureData {
  id: string
  start: number
  end: number
  strand: number
  flags: number
  mapq: number
  insertSize: number
  mismatches?: { start: number; base: string }[]
  deletions?: { start: number; length: number }[]
}

export interface RenderState {
  domainX: [number, number] // Visible genomic range
  rangeY: [number, number] // Visible Y range (pixels)
  colorScheme: number // 0=strand, 1=mapq, 2=insertSize, 3=firstOfPair
  featureHeight: number
  featureSpacing: number
  showMismatches: boolean
}

interface GPUBuffers {
  readVAO: WebGLVertexArrayObject
  readCount: number
  mismatchVAO: WebGLVertexArrayObject | null
  mismatchCount: number
  deletionVAO: WebGLVertexArrayObject | null
  deletionCount: number
}

export class WebGLRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement | OffscreenCanvas

  // Shader programs
  private readProgram: WebGLProgram
  private mismatchProgram: WebGLProgram
  private deletionProgram: WebGLProgram

  // Current GPU data
  private buffers: GPUBuffers | null = null
  private layoutMap = new Map<string, number>()

  // Cached uniform locations
  private readUniforms: Record<string, WebGLUniformLocation | null> = {}
  private mismatchUniforms: Record<string, WebGLUniformLocation | null> = {}
  private deletionUniforms: Record<string, WebGLUniformLocation | null> = {}

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
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

    // Create shader programs
    this.readProgram = this.createProgram(
      READ_VERTEX_SHADER,
      READ_FRAGMENT_SHADER,
    )
    this.mismatchProgram = this.createProgram(
      MISMATCH_VERTEX_SHADER,
      SIMPLE_FRAGMENT_SHADER,
    )
    this.deletionProgram = this.createProgram(
      DELETION_VERTEX_SHADER,
      DELETION_FRAGMENT_SHADER,
    )

    // Cache uniform locations
    this.cacheUniforms(this.readProgram, this.readUniforms, [
      'u_domainX',
      'u_rangeY',
      'u_canvasSize',
      'u_colorScheme',
      'u_featureHeight',
      'u_featureSpacing',
    ])
    this.cacheUniforms(this.mismatchProgram, this.mismatchUniforms, [
      'u_domainX',
      'u_rangeY',
      'u_featureHeight',
      'u_featureSpacing',
    ])
    this.cacheUniforms(this.deletionProgram, this.deletionUniforms, [
      'u_domainX',
      'u_rangeY',
      'u_featureHeight',
      'u_featureSpacing',
    ])

    // Enable blending for transparency
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
    const program = gl.createProgram()
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

  /**
   * Compute pileup layout for features
   */
  private computeLayout(features: FeatureData[]): { maxY: number } {
    const sorted = [...features].sort((a, b) => a.start - b.start)
    const levels: number[] = []
    this.layoutMap.clear()

    for (const feature of sorted) {
      let y = 0
      for (const [i, level] of levels.entries()) {
        if (level <= feature.start) {
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

  /**
   * Upload features to GPU buffers (call when data changes)
   */
  uploadFeatures(features: FeatureData[]): { maxY: number } {
    const gl = this.gl

    // Clean up old buffers
    if (this.buffers) {
      gl.deleteVertexArray(this.buffers.readVAO)
      if (this.buffers.mismatchVAO) {
        gl.deleteVertexArray(this.buffers.mismatchVAO)
      }
      if (this.buffers.deletionVAO) {
        gl.deleteVertexArray(this.buffers.deletionVAO)
      }
    }

    // Compute layout
    const { maxY } = this.computeLayout(features)

    // Prepare read data
    const positions = new Float32Array(features.length * 2)
    const yCoords = new Float32Array(features.length)
    const flags = new Float32Array(features.length)
    const mapqs = new Float32Array(features.length)
    const insertSizes = new Float32Array(features.length)

    // Collect mismatches and deletions
    const mismatches: { pos: number; y: number; base: number }[] = []
    const deletions: { x1: number; x2: number; y: number }[] = []

    for (const [i, f] of features.entries()) {
      const y = this.layoutMap.get(f.id) ?? 0

      positions[i * 2] = f.start
      positions[i * 2 + 1] = f.end
      yCoords[i] = y
      flags[i] = f.flags
      mapqs[i] = f.mapq
      insertSizes[i] = Math.abs(f.insertSize)

      // Collect mismatches
      if (f.mismatches) {
        for (const mm of f.mismatches) {
          const baseIdx = 'ACGTN'.indexOf(mm.base.toUpperCase())
          mismatches.push({
            pos: f.start + mm.start,
            y,
            base: baseIdx !== -1 ? baseIdx : 4,
          })
        }
      }

      // Collect deletions
      if (f.deletions) {
        for (const del of f.deletions) {
          deletions.push({
            x1: f.start + del.start,
            x2: f.start + del.start + del.length,
            y,
          })
        }
      }
    }

    // Create read VAO
    const readVAO = gl.createVertexArray()
    gl.bindVertexArray(readVAO)
    this.uploadBuffer(this.readProgram, 'a_position', positions, 2)
    this.uploadBuffer(this.readProgram, 'a_y', yCoords, 1)
    this.uploadBuffer(this.readProgram, 'a_flags', flags, 1)
    this.uploadBuffer(this.readProgram, 'a_mapq', mapqs, 1)
    this.uploadBuffer(this.readProgram, 'a_insertSize', insertSizes, 1)
    gl.bindVertexArray(null)

    // Create mismatch VAO if needed
    let mismatchVAO: WebGLVertexArrayObject | null = null
    if (mismatches.length > 0) {
      mismatchVAO = gl.createVertexArray()!
      gl.bindVertexArray(mismatchVAO)
      this.uploadBuffer(
        this.mismatchProgram,
        'a_position',
        new Float32Array(mismatches.map(m => m.pos)),
        1,
      )
      this.uploadBuffer(
        this.mismatchProgram,
        'a_y',
        new Float32Array(mismatches.map(m => m.y)),
        1,
      )
      this.uploadBuffer(
        this.mismatchProgram,
        'a_base',
        new Float32Array(mismatches.map(m => m.base)),
        1,
      )
      gl.bindVertexArray(null)
    }

    // Create deletion VAO if needed
    let deletionVAO: WebGLVertexArrayObject | null = null
    if (deletions.length > 0) {
      deletionVAO = gl.createVertexArray()!
      gl.bindVertexArray(deletionVAO)
      const delPositions = new Float32Array(deletions.length * 2)
      const delYs = new Float32Array(deletions.length)
      for (const [i, deletion] of deletions.entries()) {
        delPositions[i * 2] = deletion.x1
        delPositions[i * 2 + 1] = deletion.x2
        delYs[i] = deletion.y
      }
      this.uploadBuffer(this.deletionProgram, 'a_position', delPositions, 2)
      this.uploadBuffer(this.deletionProgram, 'a_y', delYs, 1)
      gl.bindVertexArray(null)
    }

    this.buffers = {
      readVAO,
      readCount: features.length,
      mismatchVAO,
      mismatchCount: mismatches.length,
      deletionVAO,
      deletionCount: deletions.length,
    }

    return { maxY }
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
    gl.vertexAttribDivisor(loc, 1) // Instanced
  }

  /**
   * Render with current state (call on every frame/interaction)
   */
  render(state: RenderState) {
    const gl = this.gl

    // Update canvas size if needed
    const canvas = this.canvas as HTMLCanvasElement
    if (
      canvas.width !== canvas.clientWidth ||
      canvas.height !== canvas.clientHeight
    ) {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }

    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0.96, 0.96, 0.96, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (!this.buffers || this.buffers.readCount === 0) {
      return
    }

    const bpPerPx = (state.domainX[1] - state.domainX[0]) / canvas.width

    // === Pass 1: Reads ===
    gl.useProgram(this.readProgram)
    gl.uniform2f(
      this.readUniforms.u_domainX!,
      state.domainX[0],
      state.domainX[1],
    )
    gl.uniform2f(this.readUniforms.u_rangeY!, state.rangeY[0], state.rangeY[1])
    gl.uniform2f(this.readUniforms.u_canvasSize!, canvas.width, canvas.height)
    gl.uniform1i(this.readUniforms.u_colorScheme!, state.colorScheme)
    gl.uniform1f(this.readUniforms.u_featureHeight!, state.featureHeight)
    gl.uniform1f(this.readUniforms.u_featureSpacing!, state.featureSpacing)

    gl.bindVertexArray(this.buffers.readVAO)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.readCount)

    // === Pass 2: Deletions ===
    if (this.buffers.deletionVAO && this.buffers.deletionCount > 0) {
      gl.useProgram(this.deletionProgram)
      gl.uniform2f(
        this.deletionUniforms.u_domainX!,
        state.domainX[0],
        state.domainX[1],
      )
      gl.uniform2f(
        this.deletionUniforms.u_rangeY!,
        state.rangeY[0],
        state.rangeY[1],
      )
      gl.uniform1f(this.deletionUniforms.u_featureHeight!, state.featureHeight)
      gl.uniform1f(
        this.deletionUniforms.u_featureSpacing!,
        state.featureSpacing,
      )

      gl.bindVertexArray(this.buffers.deletionVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.deletionCount)
    }

    // === Pass 3: Mismatches (only when zoomed in) ===
    if (
      state.showMismatches &&
      bpPerPx < 10 &&
      this.buffers.mismatchVAO &&
      this.buffers.mismatchCount > 0
    ) {
      gl.useProgram(this.mismatchProgram)
      gl.uniform2f(
        this.mismatchUniforms.u_domainX!,
        state.domainX[0],
        state.domainX[1],
      )
      gl.uniform2f(
        this.mismatchUniforms.u_rangeY!,
        state.rangeY[0],
        state.rangeY[1],
      )
      gl.uniform1f(this.mismatchUniforms.u_featureHeight!, state.featureHeight)
      gl.uniform1f(
        this.mismatchUniforms.u_featureSpacing!,
        state.featureSpacing,
      )

      gl.bindVertexArray(this.buffers.mismatchVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.mismatchCount)
    }

    gl.bindVertexArray(null)
  }

  /**
   * Clean up resources
   */
  destroy() {
    const gl = this.gl
    if (this.buffers) {
      gl.deleteVertexArray(this.buffers.readVAO)
      if (this.buffers.mismatchVAO) {
        gl.deleteVertexArray(this.buffers.mismatchVAO)
      }
      if (this.buffers.deletionVAO) {
        gl.deleteVertexArray(this.buffers.deletionVAO)
      }
    }
    gl.deleteProgram(this.readProgram)
    gl.deleteProgram(this.mismatchProgram)
    gl.deleteProgram(this.deletionProgram)
  }

  getLayoutY(featureId: string): number | undefined {
    return this.layoutMap.get(featureId)
  }
}
