// SYNC: Hand-written GLSL ES 3.00 for the WebGL2 fallback via HAL.
// Mirrors the WGSL shaders in ldShaders.ts (used by WebGPU).
// Uses a std140 UBO instead of individual uniforms (required by HAL).
//
// UNIFORM mode: instance buffer is just ld_values (1 float per instance).
// Vertex shader decodes (i,j) from gl_InstanceID and computes position from uniform_w.
export const UNIFORM_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_ldValue;

layout(std140) uniform Uniforms {
  vec2 canvas_size;
  float y_scalar;
  float view_scale;
  float view_offset_x;
  uint signed_ld;
  float uniform_w;
};

out float v_ldValue;

void main() {
  uint instanceId = uint(gl_InstanceID);
  float fi = (1.0 + sqrt(1.0 + 8.0 * float(instanceId))) * 0.5;
  uint i = uint(fi);
  uint j = instanceId - (i * (i - 1u)) / 2u;

  float w = uniform_w;
  uint vid = uint(gl_VertexID) % 6u;
  float lx = (vid == 0u || vid == 2u || vid == 3u) ? 0.0 : 1.0;
  float ly = (vid == 0u || vid == 1u || vid == 4u) ? 0.0 : 1.0;
  vec2 pos = (vec2(float(j), float(i)) + vec2(lx, ly)) * w;

  float c = 0.7071067811865476;
  float rx = (pos.x + pos.y) * c;
  float ry = (-pos.x + pos.y) * c;

  rx = rx * view_scale + view_offset_x;
  ry = ry * view_scale * y_scalar;

  gl_Position = vec4((rx / canvas_size.x) * 2.0 - 1.0, 1.0 - (ry / canvas_size.y) * 2.0, 0.0, 1.0);
  v_ldValue = a_ldValue;
}
`

// GENOMIC mode: instance buffer has interleaved (position, cellSize, ldValue).
// Uniforms struct reads only the first 24 bytes; uniform_w at offset 24 is ignored.
export const GENOMIC_VERTEX_SHADER = `#version 300 es
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
