/**
 * WebGL Renderer for pileup display
 *
 * Handles shader compilation, buffer management, and rendering.
 * Data is uploaded once, then rendering only updates uniforms.
 */

import type { FeatureData } from '../model'

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

  float yRange = u_rangeY.y - u_rangeY.x;
  float rowHeight = u_featureHeight + u_featureSpacing;
  float yTop = a_y * rowHeight;
  float yBot = yTop + u_featureHeight;

  float syTop = 1.0 - (yTop - u_rangeY.x) / yRange * 2.0;
  float syBot = 1.0 - (yBot - u_rangeY.x) / yRange * 2.0;
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

const MISMATCH_VERTEX_SHADER = `#version 300 es
precision highp float;
in float a_position;
in float a_y;
in float a_base;
uniform vec2 u_domainX;
uniform vec2 u_rangeY;
uniform float u_featureHeight;
uniform float u_featureSpacing;
out vec4 v_color;

const vec3 baseColors[5] = vec3[5](
  vec3(0.35, 0.75, 0.35),
  vec3(0.35, 0.35, 0.85),
  vec3(0.85, 0.65, 0.25),
  vec3(0.85, 0.35, 0.35),
  vec3(0.5, 0.5, 0.5)
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
  v_color = vec4(baseColors[int(clamp(a_base, 0.0, 4.0))], 1.0);
}
`

const SIMPLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() { fragColor = v_color; }
`

export interface RenderState {
  domainX: [number, number]
  rangeY: [number, number]
  colorScheme: number
  featureHeight: number
  featureSpacing: number
  showMismatches: boolean
}

interface GPUBuffers {
  readVAO: WebGLVertexArrayObject
  readCount: number
  mismatchVAO: WebGLVertexArrayObject | null
  mismatchCount: number
}

export class WebGLRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement

  private readProgram: WebGLProgram
  private mismatchProgram: WebGLProgram

  private buffers: GPUBuffers | null = null
  private layoutMap: Map<string, number> = new Map()

  private readUniforms: Record<string, WebGLUniformLocation | null> = {}
  private mismatchUniforms: Record<string, WebGLUniformLocation | null> = {}

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
    this.mismatchProgram = this.createProgram(
      MISMATCH_VERTEX_SHADER,
      SIMPLE_FRAGMENT_SHADER,
    )

    this.cacheUniforms(this.readProgram, this.readUniforms, [
      'u_domainX',
      'u_rangeY',
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
      if (this.buffers.mismatchVAO) {
        gl.deleteVertexArray(this.buffers.mismatchVAO)
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

    const mismatches: { pos: number; y: number; base: number }[] = []

    for (let i = 0; i < features.length; i++) {
      const f = features[i]
      const y = this.layoutMap.get(f.id) ?? 0

      positions[i * 2] = f.start
      positions[i * 2 + 1] = f.end
      ys[i] = y
      flags[i] = f.flags
      mapqs[i] = f.mapq
      insertSizes[i] = f.insertSize

      if (f.mismatches) {
        for (const mm of f.mismatches) {
          const baseIdx = 'ACGTN'.indexOf(mm.base?.toUpperCase() ?? 'N')
          mismatches.push({
            pos: f.start + mm.start,
            y,
            base: baseIdx >= 0 ? baseIdx : 4,
          })
        }
      }
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

    // Mismatch VAO
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

    this.buffers = {
      readVAO,
      readCount: features.length,
      mismatchVAO,
      mismatchCount: mismatches.length,
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
    gl.vertexAttribDivisor(loc, 1)
  }

  render(state: RenderState) {
    const gl = this.gl
    const canvas = this.canvas

    // Handle resize
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }

    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0.96, 0.96, 0.96, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (!this.buffers || this.buffers.readCount === 0) {
      return
    }

    // Pass 1: Reads
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

    gl.bindVertexArray(this.buffers.readVAO)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.readCount)

    // Pass 2: Mismatches
    if (
      state.showMismatches &&
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
      gl.uniform1f(
        this.mismatchUniforms.u_featureHeight!,
        state.featureHeight,
      )
      gl.uniform1f(
        this.mismatchUniforms.u_featureSpacing!,
        state.featureSpacing,
      )

      gl.bindVertexArray(this.buffers.mismatchVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.mismatchCount)
    }

    gl.bindVertexArray(null)
  }

  destroy() {
    const gl = this.gl
    if (this.buffers) {
      gl.deleteVertexArray(this.buffers.readVAO)
      if (this.buffers.mismatchVAO) {
        gl.deleteVertexArray(this.buffers.mismatchVAO)
      }
    }
    gl.deleteProgram(this.readProgram)
    gl.deleteProgram(this.mismatchProgram)
  }
}
