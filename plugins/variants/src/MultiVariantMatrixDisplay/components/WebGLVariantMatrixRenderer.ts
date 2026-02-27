import {
  MATRIX_INSTANCE_STRIDE,
  interleaveMatrixInstances,
} from './variantMatrixShaders.ts'
import { createProgram } from '../../shared/variantWebglUtils.ts'

// SYNC: Hand-written GLSL ES 3.00 for the WebGL2 renderer.
// Mirrors the WGSL shader in variantMatrixShaders.ts (used by WebGPU).
// When updating rendering logic, update BOTH this file and variantMatrixShaders.ts.
//
// Key differences from the WGSL version:
//   - WGSL uses var<storage, read> instances: array<CellInstance> (storage buffer)
//   - GLSL uses instanced vertex attributes via vertexAttribDivisor
//   - WGSL uses struct Uniforms with @binding(1); GLSL uses individual uniforms
//
// SYNC: attribute layout must match interleaveMatrixInstances() in variantMatrixShaders.ts
// and struct CellInstance in variantMatrixShaders.ts (WGSL):
//   [0]    feature_index: f32  -> a_feature_index
//   [1]    row_index: u32      -> a_row_index
//   [2..3] padding (unused)
//   [4..7] color: vec4f        -> a_color
//
// SYNC: uniform names map to struct Uniforms fields in variantMatrixShaders.ts (WGSL)

const VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

// SYNC: attribute layout must match MATRIX_INSTANCE_STRIDE and
// interleaveMatrixInstances() in variantMatrixShaders.ts,
// and struct CellInstance in the WGSL shader
in float a_feature_index;
in uint a_row_index;
in vec4 a_color;

// SYNC: uniforms must match struct Uniforms in variantMatrixShaders.ts (WGSL)
uniform float u_num_features;
uniform float u_canvas_width;
uniform float u_canvas_height;
uniform float u_row_height;
uniform float u_scroll_top;

out vec4 v_color;

// SYNC: vs_main rendering logic must match variantMatrixShaders.ts (WGSL)
void main() {
  uint vid = uint(gl_VertexID) % 6u;
  float lx = (vid == 0u || vid == 2u || vid == 3u) ? 0.0 : 1.0;
  float ly = (vid == 0u || vid == 1u || vid == 4u) ? 0.0 : 1.0;

  float x1 = a_feature_index / u_num_features;
  float x2 = (a_feature_index + 1.0) / u_num_features;
  float px_size_x = 1.0 / u_canvas_width;
  float cx1 = floor(x1 / px_size_x + 0.5) * px_size_x;
  float cx2 = floor(x2 / px_size_x + 0.5) * px_size_x;
  if (cx2 - cx1 < px_size_x) {
    cx2 = cx1 + px_size_x;
  }
  float clip_x = mix(cx1, cx2, lx) * 2.0 - 1.0;

  float y_top_px = float(a_row_index) * u_row_height - u_scroll_top;
  float y_top = floor(y_top_px + 0.5);
  float y_bot = floor(y_top_px + u_row_height + 0.5);
  if (y_bot - y_top < 1.0) {
    y_bot = y_top + 1.0;
  }
  float px_to_clip_y = 2.0 / u_canvas_height;
  float clip_y = mix(1.0 - y_bot * px_to_clip_y, 1.0 - y_top * px_to_clip_y, ly);

  gl_Position = vec4(clip_x, clip_y, 0.0, 1.0);
  v_color = a_color;
}
`

// SYNC: fs_main must match variantMatrixShaders.ts (WGSL) — premultiplied alpha output
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_color;
out vec4 fragColor;

void main() {
  fragColor = vec4(v_color.rgb * v_color.a, v_color.a);
}
`

export interface MatrixRenderState {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  scrollTop: number
  numFeatures: number
}

export class WebGLVariantMatrixRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject | null = null
  private instanceBuffer: WebGLBuffer | null = null
  private uniforms: Record<string, WebGLUniformLocation | null> = {}
  private cellCount = 0

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
    for (const name of [
      'u_num_features',
      'u_canvas_width',
      'u_canvas_height',
      'u_row_height',
      'u_scroll_top',
    ]) {
      this.uniforms[name] = gl.getUniformLocation(this.program, name)
    }

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  }

  uploadCellData(data: {
    cellFeatureIndices: Float32Array
    cellRowIndices: Uint32Array
    cellColors: Uint8Array
    numCells: number
  }) {
    const gl = this.gl

    this.deleteBuffers()
    this.cellCount = 0

    if (data.numCells === 0) {
      return
    }

    this.cellCount = data.numCells

    const buf = interleaveMatrixInstances(data)
    const stride = MATRIX_INSTANCE_STRIDE * 4

    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)

    this.instanceBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW)

    // SYNC: vertex attribute offsets must match interleaveMatrixInstances()
    // in variantMatrixShaders.ts and struct CellInstance in the WGSL shader
    const featureIndexLoc = gl.getAttribLocation(
      this.program,
      'a_feature_index',
    )
    gl.enableVertexAttribArray(featureIndexLoc)
    gl.vertexAttribPointer(featureIndexLoc, 1, gl.FLOAT, false, stride, 0)
    gl.vertexAttribDivisor(featureIndexLoc, 1)

    const rowIndexLoc = gl.getAttribLocation(this.program, 'a_row_index')
    gl.enableVertexAttribArray(rowIndexLoc)
    gl.vertexAttribIPointer(rowIndexLoc, 1, gl.UNSIGNED_INT, stride, 4)
    gl.vertexAttribDivisor(rowIndexLoc, 1)

    // offset 16 skips padding u32s at [2..3], matching _pad0/_pad1 in WGSL CellInstance
    const colorLoc = gl.getAttribLocation(this.program, 'a_color')
    gl.enableVertexAttribArray(colorLoc)
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, stride, 16)
    gl.vertexAttribDivisor(colorLoc, 1)

    gl.bindVertexArray(null)
  }

  render(state: MatrixRenderState) {
    const gl = this.gl
    const canvas = this.canvas
    const { canvasWidth, canvasHeight } = state
    const dpr = window.devicePixelRatio || 1
    const bufW = Math.round(canvasWidth * dpr)
    const bufH = Math.round(canvasHeight * dpr)

    if (canvas.width !== bufW || canvas.height !== bufH) {
      canvas.width = bufW
      canvas.height = bufH
    }

    gl.viewport(0, 0, bufW, bufH)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (!this.vao || this.cellCount === 0 || state.numFeatures === 0) {
      return
    }

    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)

    gl.uniform1f(this.uniforms.u_num_features!, state.numFeatures)
    gl.uniform1f(this.uniforms.u_canvas_width!, canvasWidth)
    gl.uniform1f(this.uniforms.u_canvas_height!, canvasHeight)
    gl.uniform1f(this.uniforms.u_row_height!, state.rowHeight)
    gl.uniform1f(this.uniforms.u_scroll_top!, state.scrollTop)

    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.cellCount)

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
    this.gl.deleteProgram(this.program)
  }
}
