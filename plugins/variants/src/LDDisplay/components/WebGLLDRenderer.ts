import { INSTANCE_STRIDE, interleaveLDInstances } from './ldShaders.ts'
import { cacheUniforms, createProgram } from '../../shared/variantWebglUtils.ts'

// SYNC: Hand-written GLSL ES 3.00 for the WebGL2 renderer.
// Mirrors the WGSL shader in ldShaders.ts (used by WebGPU).
// When updating rendering logic, update BOTH this file and ldShaders.ts.
//
// Key differences from the WGSL version:
//   - WGSL uses var<storage, read> instances: array<LDInstance> (storage buffer)
//   - GLSL uses instanced vertex attributes via vertexAttribDivisor
//   - WGSL uses struct Uniforms with @binding(1); GLSL uses individual uniforms
//   - WGSL uses textureSampleLevel for color ramp; GLSL uses texture()
//
// SYNC: attribute layout must match interleaveLDInstances() in ldShaders.ts
// and struct LDInstance in ldShaders.ts (WGSL):
//   [0..1] position: vec2f   -> a_position
//   [2..3] cell_size: vec2f  -> a_cellSize
//   [4]    ld_value: f32     -> a_ldValue
//   [5]    padding

const VERTEX_SHADER = `#version 300 es
precision highp float;

// SYNC: attribute layout must match INSTANCE_STRIDE and interleaveLDInstances()
// in ldShaders.ts, and struct LDInstance in the WGSL shader
in vec2 a_position;
in vec2 a_cellSize;
in float a_ldValue;

// SYNC: uniforms must match struct Uniforms in ldShaders.ts (WGSL)
uniform float u_yScalar;
uniform vec2 u_canvasSize;
uniform float u_viewScale;
uniform float u_viewOffsetX;

out float v_ldValue;

// SYNC: vs_main rendering logic must match ldShaders.ts (WGSL)
void main() {
  uint vid = uint(gl_VertexID) % 6u;
  float lx = (vid == 0u || vid == 2u || vid == 3u) ? 0.0 : 1.0;
  float ly = (vid == 0u || vid == 1u || vid == 4u) ? 0.0 : 1.0;
  vec2 pos = a_position + vec2(lx, ly) * a_cellSize;

  float c = 0.7071067811865476;
  float rx = (pos.x + pos.y) * c;
  float ry = (-pos.x + pos.y) * c;

  rx = rx * u_viewScale + u_viewOffsetX;
  ry = ry * u_viewScale;
  ry *= u_yScalar;

  float clipX = (rx / u_canvasSize.x) * 2.0 - 1.0;
  float clipY = 1.0 - (ry / u_canvasSize.y) * 2.0;

  gl_Position = vec4(clipX, clipY, 0.0, 1.0);
  v_ldValue = a_ldValue;
}
`

// SYNC: fs_main must match ldShaders.ts (WGSL) — color ramp lookup + premultiplied alpha
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in float v_ldValue;

uniform sampler2D u_colorRamp;
uniform int u_signedLD;

out vec4 fragColor;

void main() {
  float t;
  if (u_signedLD == 1) {
    t = (v_ldValue + 1.0) / 2.0;
  } else {
    t = v_ldValue;
  }
  t = clamp(t, 0.0, 1.0);
  vec4 c = texture(u_colorRamp, vec2(t, 0.5));
  fragColor = vec4(c.rgb * c.a, c.a);
}
`

function interpolateStops(stops: [number, number, number][]): Uint8Array {
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
  private instanceBuffer: WebGLBuffer | null = null
  private instanceCount = 0
  private uniforms: Record<string, WebGLUniformLocation | null> = {}
  private colorRampTexture: WebGLTexture | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    })

    if (!gl) {
      throw new Error('WebGL2 not supported')
    }
    this.gl = gl

    this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER)

    gl.useProgram(this.program)
    this.uniforms = cacheUniforms(gl, this.program, [
      'u_yScalar',
      'u_canvasSize',
      'u_signedLD',
      'u_colorRamp',
      'u_viewScale',
      'u_viewOffsetX',
    ])

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
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

    const buf = interleaveLDInstances(data)
    const stride = INSTANCE_STRIDE * 4

    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)

    this.instanceBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW)

    // SYNC: vertex attribute offsets must match interleaveLDInstances()
    // in ldShaders.ts and struct LDInstance in the WGSL shader
    const posLoc = gl.getAttribLocation(this.program, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, stride, 0)
    gl.vertexAttribDivisor(posLoc, 1)

    const cellSizeLoc = gl.getAttribLocation(this.program, 'a_cellSize')
    gl.enableVertexAttribArray(cellSizeLoc)
    gl.vertexAttribPointer(cellSizeLoc, 2, gl.FLOAT, false, stride, 8)
    gl.vertexAttribDivisor(cellSizeLoc, 1)

    const ldValLoc = gl.getAttribLocation(this.program, 'a_ldValue')
    gl.enableVertexAttribArray(ldValLoc)
    gl.vertexAttribPointer(ldValLoc, 1, gl.FLOAT, false, stride, 16)
    gl.vertexAttribDivisor(ldValLoc, 1)

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
    const {
      canvasWidth,
      canvasHeight,
      yScalar,
      signedLD,
      viewScale,
      viewOffsetX,
    } = state

    const dpr = window.devicePixelRatio || 1
    const bufW = Math.round(canvasWidth * dpr)
    const bufH = Math.round(canvasHeight * dpr)

    if (this.canvas.width !== bufW || this.canvas.height !== bufH) {
      this.canvas.width = bufW
      this.canvas.height = bufH
    }

    gl.viewport(0, 0, bufW, bufH)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (!this.vao || this.instanceCount === 0 || !this.colorRampTexture) {
      return
    }

    gl.uniform1f(this.uniforms.u_yScalar!, yScalar)
    gl.uniform2f(this.uniforms.u_canvasSize!, canvasWidth, canvasHeight)
    gl.uniform1i(this.uniforms.u_signedLD!, signedLD ? 1 : 0)
    gl.uniform1f(this.uniforms.u_viewScale!, viewScale)
    gl.uniform1f(this.uniforms.u_viewOffsetX!, viewOffsetX)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.colorRampTexture)
    gl.uniform1i(this.uniforms.u_colorRamp!, 0)

    gl.bindVertexArray(this.vao)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.instanceCount)
    gl.bindVertexArray(null)
  }

  private deleteBuffers() {
    const gl = this.gl
    if (this.instanceBuffer) {
      gl.deleteBuffer(this.instanceBuffer)
      this.instanceBuffer = null
    }
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
