// SYNC: Hand-written GLSL ES 3.00 for the WebGL2 fallback via HAL.
// Mirrors the WGSL shader in ldShaders.ts (used by WebGPU).
// Uses a std140 UBO instead of individual uniforms (required by HAL).
export const VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_cellSize;
in float a_ldValue;

layout(std140) uniform Uniforms {
  vec2 canvas_size;
  float y_scalar;
  float view_scale;
  float view_offset_x;
  uint signed_ld;
};

out float v_ldValue;

void main() {
  uint vid = uint(gl_VertexID) % 6u;
  float lx = (vid == 0u || vid == 2u || vid == 3u) ? 0.0 : 1.0;
  float ly = (vid == 0u || vid == 1u || vid == 4u) ? 0.0 : 1.0;
  vec2 pos = a_position + vec2(lx, ly) * a_cellSize;

  float c = 0.7071067811865476;
  float rx = (pos.x + pos.y) * c;
  float ry = (-pos.x + pos.y) * c;

  rx = rx * view_scale + view_offset_x;
  ry = ry * view_scale;
  ry *= y_scalar;

  float clipX = (rx / canvas_size.x) * 2.0 - 1.0;
  float clipY = 1.0 - (ry / canvas_size.y) * 2.0;

  gl_Position = vec4(clipX, clipY, 0.0, 1.0);
  v_ldValue = a_ldValue;
}
`

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in float v_ldValue;

layout(std140) uniform Uniforms {
  vec2 canvas_size;
  float y_scalar;
  float view_scale;
  float view_offset_x;
  uint signed_ld;
};

uniform sampler2D u_colorRamp;

out vec4 fragColor;

void main() {
  float t;
  if (signed_ld == 1u) {
    t = (v_ldValue + 1.0) / 2.0;
  } else {
    t = v_ldValue;
  }
  t = clamp(t, 0.0, 1.0);
  vec4 c = texture(u_colorRamp, vec2(t, 0.5));
  fragColor = vec4(c.rgb * c.a, c.a);
}
`
