// SYNC: Hand-written GLSL ES 3.00 for the WebGL2 fallback.
// Mirrors the WGSL shader in variantMatrixShaders.ts (used by WebGPU).
// Uses a std140 UBO instead of individual uniforms (required by HAL).
export const VERTEX_SHADER = `#version 300 es
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
  float y_top = y_top_px;
  float y_bot = y_top_px + row_height;
  if (y_bot - y_top < 1.0) {
    y_bot = y_top + 1.0;
  }
  float px_to_clip_y = 2.0 / canvas_height;
  float clip_y = mix(1.0 - y_bot * px_to_clip_y, 1.0 - y_top * px_to_clip_y, ly);

  gl_Position = vec4(clip_x, clip_y, 0.0, 1.0);
  v_color = a_color;
}
`

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_color;
out vec4 fragColor;

void main() {
  fragColor = vec4(v_color.rgb * v_color.a, v_color.a);
}
`
