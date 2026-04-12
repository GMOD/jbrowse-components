// SYNC: Hand-written GLSL ES 3.00 for the WebGL2 fallback via HAL.
// Mirrors the WGSL shader in hicShaders.ts (used by WebGPU).
// Uses a std140 UBO instead of individual uniforms (required by HAL).
export const VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec2 a_position;
in float a_count;

layout(std140) uniform Uniforms {
  vec2 canvas_size;
  float bin_width;
  float y_scalar;
  float max_score;
  float view_scale;
  float view_offset_x;
  uint use_log_scale;
};

out float v_count;

void main() {
  uint vid = uint(gl_VertexID) % 6u;
  float lx = (vid == 0u || vid == 2u || vid == 3u) ? 0.0 : 1.0;
  float ly = (vid == 0u || vid == 1u || vid == 4u) ? 0.0 : 1.0;
  vec2 pos = a_position + vec2(lx, ly) * bin_width;

  float c = 0.7071067811865476;
  float rx = (pos.x + pos.y) * c;
  float ry = (-pos.x + pos.y) * c;

  rx = rx * view_scale + view_offset_x;
  ry = ry * view_scale;
  ry *= y_scalar;

  float clipX = (rx / canvas_size.x) * 2.0 - 1.0;
  float clipY = 1.0 - (ry / canvas_size.y) * 2.0;

  gl_Position = vec4(clipX, clipY, 0.0, 1.0);
  v_count = a_count;
}
`

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

in float v_count;

layout(std140) uniform Uniforms {
  vec2 canvas_size;
  float bin_width;
  float y_scalar;
  float max_score;
  float view_scale;
  float view_offset_x;
  uint use_log_scale;
};

uniform sampler2D u_colorRamp;

out vec4 fragColor;

void main() {
  float m = use_log_scale == 1u ? max_score : max_score / 20.0;
  float t;
  if (use_log_scale == 1u) {
    t = log2(max(v_count, 1.0)) / log2(max(m, 1.0));
  } else {
    t = v_count / max(m, 0.001);
  }
  t = clamp(t, 0.0, 1.0);
  vec4 c = texture(u_colorRamp, vec2(t, 0.5));
  fragColor = vec4(c.rgb * c.a, c.a);
}
`
