import {
  MATRIX_INSTANCE_STRIDE,
  interleaveMatrixInstances,
  variantMatrixShader,
} from './variantMatrixShaders.ts'

import type {
  MatrixRenderState,
  VariantMatrixBackend,
} from './variantMatrixBackendTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_MAIN = 'main'
const REGION_KEY = 0
const INSTANCE_BYTES = MATRIX_INSTANCE_STRIDE * 4
const UNIFORM_BYTE_SIZE = 32

// SYNC: Hand-written GLSL ES 3.00 for the WebGL2 fallback.
// Mirrors the WGSL shader in variantMatrixShaders.ts (used by WebGPU).
// Uses a std140 UBO instead of individual uniforms (required by HAL).
const VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in float a_feature_index;
in uint a_row_index;
in vec4 a_color;

layout(std140) uniform Uniforms {
  float num_features;
  float canvas_width;
  float canvas_height;
  float row_height;
  float scroll_top;
};

out vec4 v_color;

void main() {
  uint vid = uint(gl_VertexID) % 6u;
  float lx = (vid == 0u || vid == 2u || vid == 3u) ? 0.0 : 1.0;
  float ly = (vid == 0u || vid == 1u || vid == 4u) ? 0.0 : 1.0;

  float x1 = a_feature_index / num_features;
  float x2 = (a_feature_index + 1.0) / num_features;
  float px_size_x = 1.0 / canvas_width;
  float cx1 = floor(x1 / px_size_x + 0.5) * px_size_x;
  float cx2 = floor(x2 / px_size_x + 0.5) * px_size_x;
  if (cx2 - cx1 < px_size_x) {
    cx2 = cx1 + px_size_x;
  }
  float clip_x = mix(cx1, cx2, lx) * 2.0 - 1.0;

  float y_top_px = float(a_row_index) * row_height - scroll_top;
  float y_top = floor(y_top_px + 0.5);
  float y_bot = floor(y_top_px + row_height + 0.5);
  if (y_bot - y_top < 1.0) {
    y_bot = y_top + 1.0;
  }
  float px_to_clip_y = 2.0 / canvas_height;
  float clip_y = mix(1.0 - y_bot * px_to_clip_y, 1.0 - y_top * px_to_clip_y, ly);

  gl_Position = vec4(clip_x, clip_y, 0.0, 1.0);
  v_color = a_color;
}
`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_color;
out vec4 fragColor;

void main() {
  fragColor = vec4(v_color.rgb * v_color.a, v_color.a);
}
`

export const VARIANT_MATRIX_PASSES: PassDescriptor[] = [
  {
    id: PASS_MAIN,
    wgslSource: variantMatrixShader,
    glslVertex: VERTEX_SHADER,
    glslFragment: FRAGMENT_SHADER,
    instanceStride: INSTANCE_BYTES,
    verticesPerInstance: 6,
    blend: true,
    blendState: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
    glAttributes: [
      { name: 'a_feature_index', components: 1, type: 'float', offsetBytes: 0, integer: false },
      { name: 'a_row_index', components: 1, type: 'uint', offsetBytes: 4, integer: true },
      // offset 8 skips padding (u32x2), then color at offset 16
      { name: 'a_color', components: 4, type: 'float', offsetBytes: 16, integer: false },
    ],
  },
]

export { UNIFORM_BYTE_SIZE as VARIANT_MATRIX_UNIFORM_BYTE_SIZE }

export class GpuVariantMatrixRenderer implements VariantMatrixBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORM_BYTE_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  uploadCellData(data: {
    cellFeatureIndices: Float32Array
    cellRowIndices: Uint32Array
    cellColors: Uint8Array
    numCells: number
  }) {
    if (data.numCells === 0) {
      this.hal.deleteRegion(REGION_KEY)
      return
    }

    const buf = interleaveMatrixInstances(data)
    this.hal.uploadBuffer(REGION_KEY, PASS_MAIN, buf, data.numCells)
  }

  render(state: MatrixRenderState) {
    const { canvasWidth, canvasHeight } = state

    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    if (this.hal.getBufferCount(REGION_KEY, PASS_MAIN) > 0 && state.numFeatures > 0) {
      this.uniformF32[0] = state.numFeatures
      this.uniformF32[1] = canvasWidth
      this.uniformF32[2] = canvasHeight
      this.uniformF32[3] = state.rowHeight
      this.uniformF32[4] = state.scrollTop

      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(PASS_MAIN, REGION_KEY)
    }

    this.hal.endFrame()
  }

  dispose() {
    this.hal.dispose()
  }
}
