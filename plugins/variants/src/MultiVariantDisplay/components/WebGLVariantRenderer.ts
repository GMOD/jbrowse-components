import { HP_GLSL_CORE } from '@jbrowse/core/gpu/shaderConstants'

import {
  INSTANCE_STRIDE,
  interleaveVariantInstances,
} from './variantShaders.ts'
import {
  createProgram,
  splitPositionWithFrac,
} from '../../shared/variantWebglUtils.ts'

import type {
  VariantBackend,
  VariantRenderBlock,
} from './variantBackendTypes.ts'

// SYNC: Hand-written GLSL ES 3.00 for the WebGL2 renderer.
// Mirrors the WGSL shader in variantShaders.ts (used by WebGPU).
// When updating rendering logic, update BOTH this file and variantShaders.ts.

const VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_start_end;
in uint a_row_index;
in uint a_shape_type;
in vec4 a_color;

uniform vec3 u_bp_range_x;
uniform uint u_region_start;
uniform float u_canvas_height;
uniform float u_canvas_width;
uniform float u_row_height;
uniform float u_scroll_top;

out vec4 v_color;
out vec2 v_local_px;
flat out vec2 v_size_px;
flat out uint v_shape_type_f;

${HP_GLSL_CORE}

void main() {
  uint vid = uint(gl_VertexID) % 6u;

  uint abs_start = a_start_end.x + u_region_start;
  uint abs_end = a_start_end.y + u_region_start;
  float clip_x1 = hp_to_clip_x(hp_split_uint(abs_start), u_bp_range_x);
  float clip_x2 = hp_to_clip_x(hp_split_uint(abs_end), u_bp_range_x);

  float px_size = 2.0 / u_canvas_width;
  float cx1 = floor(clip_x1 / px_size + 0.5) * px_size;
  float cx2 = floor(clip_x2 / px_size + 0.5) * px_size;
  if (cx2 - cx1 < 2.0 * px_size) {
    cx2 = cx1 + 2.0 * px_size;
  }

  float y_top_px = float(a_row_index) * u_row_height - u_scroll_top;
  float y_top = floor(y_top_px + 0.5);
  float y_bot = floor(y_top_px + u_row_height + 0.5);
  if (y_bot - y_top < 1.0) {
    y_bot = y_top + 1.0;
  }
  float px_to_clip_y = 2.0 / u_canvas_height;
  float cy_top = 1.0 - y_top * px_to_clip_y;
  float cy_bot = 1.0 - y_bot * px_to_clip_y;

  // SDF anti-aliasing: always emit a bounding-box quad, use fragment shader SDF for triangles
  float lx = (vid == 0u || vid == 2u || vid == 3u) ? 0.0 : 1.0;
  float ly = (vid == 0u || vid == 1u || vid == 4u) ? 0.0 : 1.0;

  float natural_w_px = (cx2 - cx1) * u_canvas_width * 0.5;
  uint effective_shape = a_shape_type;
  if (a_shape_type == 3u && natural_w_px < 1.0) {
    effective_shape = 0u;
  }

  float x_left = cx1;
  float x_right = cx2;
  if (effective_shape == 3u) {
    float width_extend = 6.0 / u_canvas_width;
    x_left -= width_extend;
    x_right += width_extend;
  }

  gl_Position = vec4(mix(x_left, x_right, lx), mix(cy_bot, cy_top, ly), 0.0, 1.0);

  float w_px = (x_right - x_left) * u_canvas_width * 0.5;
  float h_px = (cy_top - cy_bot) * u_canvas_height * 0.5;
  v_local_px = vec2(lx * w_px, (1.0 - ly) * h_px);
  v_size_px = vec2(w_px, h_px);
  v_shape_type_f = effective_shape;
  v_color = a_color;
}
`

// SYNC: fs_main must match variantShaders.ts (WGSL) — premultiplied alpha output
// SDF anti-aliasing for triangle shapes: renders all shapes as bounding-box quads,
// then uses signed distance fields to produce smooth edges.
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_color;
in vec2 v_local_px;
flat in vec2 v_size_px;
flat in uint v_shape_type_f;
out vec4 fragColor;

// SDF for right-pointing triangle: vertices (0,0), (0,h), (w,h/2)
float tri_sdf_right(vec2 p, float w, float h) {
  float d_left = p.x;
  float hyp = sqrt(h * h * 0.25 + w * w);
  float d_top = (-0.5 * h * p.x + w * p.y) / hyp;
  float d_bot = (-0.5 * h * p.x - w * (p.y - h)) / hyp;
  return min(min(d_left, d_top), d_bot);
}

// SDF for down-pointing triangle: vertices (0,0), (w,0), (w/2,h)
float tri_sdf_down(vec2 p, float w, float h) {
  float d_top = p.y;
  float hyp = sqrt(h * h + w * w * 0.25);
  float d_left = (h * p.x - 0.5 * w * p.y) / hyp;
  float d_right = (w * h - h * p.x - 0.5 * w * p.y) / hyp;
  return min(min(d_top, d_left), d_right);
}

void main() {
  float alpha = v_color.a;

  if (v_shape_type_f != 0u) {
    float d;
    float w = v_size_px.x;
    float h = v_size_px.y;

    if (v_shape_type_f == 1u) {
      d = tri_sdf_right(v_local_px, w, h);
    } else if (v_shape_type_f == 2u) {
      d = tri_sdf_right(vec2(w - v_local_px.x, v_local_px.y), w, h);
    } else {
      d = tri_sdf_down(v_local_px, w, h);
    }

    alpha *= smoothstep(-0.5, 0.5, d);
    alpha *= smoothstep(0.0, 3.0, min(w, h));
  }

  fragColor = vec4(v_color.rgb * alpha, alpha);
}
`

interface RegionGLData {
  regionStart: number
  vao: WebGLVertexArrayObject
  instanceBuffer: WebGLBuffer
  cellCount: number
}

export class WebGLVariantRenderer implements VariantBackend {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private program: WebGLProgram
  private uniforms: Record<string, WebGLUniformLocation | null> = {}
  private regionDataMap = new Map<number, RegionGLData>()

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
      'u_bp_range_x',
      'u_region_start',
      'u_canvas_height',
      'u_canvas_width',
      'u_row_height',
      'u_scroll_top',
      'u_zero',
    ]) {
      this.uniforms[name] = gl.getUniformLocation(this.program, name)
    }

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  }

  uploadRegion(
    regionNumber: number,
    data: {
      regionStart: number
      cellPositions: Uint32Array
      cellRowIndices: Uint32Array
      cellColors: Uint8Array
      cellShapeTypes: Uint8Array
      numCells: number
    },
  ) {
    const gl = this.gl

    const existing = this.regionDataMap.get(regionNumber)
    if (existing) {
      gl.deleteBuffer(existing.instanceBuffer)
      gl.deleteVertexArray(existing.vao)
      this.regionDataMap.delete(regionNumber)
    }

    if (data.numCells === 0) {
      return
    }

    const buf = interleaveVariantInstances(data)
    const stride = INSTANCE_STRIDE * 4

    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)

    const instanceBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW)

    // SYNC: vertex attribute offsets must match interleaveVariantInstances()
    // in variantShaders.ts and struct CellInstance in the WGSL shader
    const startEndLoc = gl.getAttribLocation(this.program, 'a_start_end')
    gl.enableVertexAttribArray(startEndLoc)
    gl.vertexAttribIPointer(startEndLoc, 2, gl.UNSIGNED_INT, stride, 0)
    gl.vertexAttribDivisor(startEndLoc, 1)

    const rowIndexLoc = gl.getAttribLocation(this.program, 'a_row_index')
    gl.enableVertexAttribArray(rowIndexLoc)
    gl.vertexAttribIPointer(rowIndexLoc, 1, gl.UNSIGNED_INT, stride, 8)
    gl.vertexAttribDivisor(rowIndexLoc, 1)

    const shapeTypeLoc = gl.getAttribLocation(this.program, 'a_shape_type')
    gl.enableVertexAttribArray(shapeTypeLoc)
    gl.vertexAttribIPointer(shapeTypeLoc, 1, gl.UNSIGNED_INT, stride, 12)
    gl.vertexAttribDivisor(shapeTypeLoc, 1)

    const colorLoc = gl.getAttribLocation(this.program, 'a_color')
    gl.enableVertexAttribArray(colorLoc)
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, stride, 16)
    gl.vertexAttribDivisor(colorLoc, 1)

    gl.bindVertexArray(null)

    this.regionDataMap.set(regionNumber, {
      regionStart: data.regionStart,
      vao,
      instanceBuffer,
      cellCount: data.numCells,
    })
  }

  pruneStaleRegions(activeRegionNumbers: number[]) {
    const gl = this.gl
    const active = new Set(activeRegionNumbers)
    for (const [regionNumber, data] of this.regionDataMap) {
      if (!active.has(regionNumber)) {
        gl.deleteBuffer(data.instanceBuffer)
        gl.deleteVertexArray(data.vao)
        this.regionDataMap.delete(regionNumber)
      }
    }
  }

  renderBlocks(
    blocks: VariantRenderBlock[],
    state: {
      canvasWidth: number
      canvasHeight: number
      rowHeight: number
      scrollTop: number
    },
  ) {
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

    if (blocks.length === 0) {
      return
    }

    gl.useProgram(this.program)
    gl.enable(gl.SCISSOR_TEST)

    for (const block of blocks) {
      const region = this.regionDataMap.get(block.regionNumber)
      if (!region || region.cellCount === 0) {
        continue
      }

      const scissorX = Math.max(0, Math.floor(block.screenStartPx))
      const scissorEnd = Math.min(canvasWidth, Math.ceil(block.screenEndPx))
      const scissorW = scissorEnd - scissorX
      if (scissorW <= 0) {
        continue
      }

      gl.bindVertexArray(region.vao)

      gl.scissor(
        Math.round(scissorX * dpr),
        0,
        Math.round(scissorW * dpr),
        bufH,
      )
      gl.viewport(
        Math.round(scissorX * dpr),
        0,
        Math.round(scissorW * dpr),
        bufH,
      )

      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const regionLengthBp = block.bpRangeX[1] - block.bpRangeX[0]
      const bpPerPx = regionLengthBp / fullBlockWidth
      const clippedBpStart =
        block.bpRangeX[0] + (scissorX - block.screenStartPx) * bpPerPx
      const clippedBpEnd =
        block.bpRangeX[0] + (scissorEnd - block.screenStartPx) * bpPerPx
      const [bpStartHi, bpStartLo] = splitPositionWithFrac(clippedBpStart)
      const clippedLengthBp = clippedBpEnd - clippedBpStart

      this.writeUniforms(
        bpStartHi,
        bpStartLo,
        clippedLengthBp,
        Math.floor(region.regionStart),
        scissorW,
        state,
      )

      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, region.cellCount)
    }

    gl.disable(gl.SCISSOR_TEST)
    gl.viewport(0, 0, bufW, bufH)
    gl.bindVertexArray(null)
  }

  private writeUniforms(
    bpRangeHi: number,
    bpRangeLo: number,
    bpRangeLength: number,
    regionStart: number,
    canvasWidth: number,
    state: { canvasHeight: number; rowHeight: number; scrollTop: number },
  ) {
    const gl = this.gl
    gl.uniform3f(
      this.uniforms.u_bp_range_x!,
      bpRangeHi,
      bpRangeLo,
      bpRangeLength,
    )
    gl.uniform1ui(this.uniforms.u_region_start!, regionStart)
    gl.uniform1f(this.uniforms.u_canvas_height!, state.canvasHeight)
    gl.uniform1f(this.uniforms.u_canvas_width!, canvasWidth)
    gl.uniform1f(this.uniforms.u_row_height!, state.rowHeight)
    gl.uniform1f(this.uniforms.u_scroll_top!, state.scrollTop)
    gl.uniform1f(this.uniforms.u_zero!, 0)
  }

  dispose() {
    const gl = this.gl
    for (const [, data] of this.regionDataMap) {
      gl.deleteBuffer(data.instanceBuffer)
      gl.deleteVertexArray(data.vao)
    }
    this.regionDataMap.clear()
    gl.deleteProgram(this.program)
  }
}
