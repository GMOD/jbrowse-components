// Hand-written GLSL ES 300 shaders for the WebGL2 fallback renderer.
// These mirror the WGSL shader in wiggleShader.ts (used by WebGPU).
//
// SYNC: When updating rendering logic, update BOTH this file and wiggleShader.ts.
//
// Key differences from the WGSL version:
//   - WGSL uses var<storage, read> for instance data (no size limit)
//   - GLSL uses instanced vertex attributes via vertexAttribDivisor (no texture size limit)
//   - WGSL accesses instances[instance_index]; GLSL reads from per-instance attributes
//
// Shared concepts (must stay in sync between WGSL and GLSL):
//   - Instance layout: [start_end(u32x2), score(f32), prev_score(f32),
//     row_index(f32), color_r(f32), color_g(f32), color_b(f32)]
//     SYNC: must match INSTANCE_STRIDE in wiggleShader.ts and interleaveInstances() in webglUtils.ts
//   - Uniform layout: bp_range_x(vec3f), region_start(u32), canvas_height(f32),
//     scale_type(i32), rendering_type(i32), num_rows(f32), domain_y(vec2f),
//     zero(f32), viewport_width(f32)
//     SYNC: must match struct Uniforms in wiggleShader.ts and writeUniforms() in both renderers
//   - Rendering type constants: XYPLOT=0, DENSITY=1, LINE=2, SCATTER=3
//     SYNC: must match wiggleShader.ts constants
//   - HP (high-precision) position technique from genome-spy
//   - 6 vertices per instance (triangle-list or line-list)
//   - normalize_score / score_to_y logic

export const WIGGLE_VERTEX_SHADER_GLSL = `#version 300 es
precision highp float;
precision highp int;

// SYNC: attribute layout must match interleaveInstances() in webglUtils.ts
// and struct Instance in wiggleShader.ts (WGSL)
in uvec2 a_start_end;   // byte offset 0,  INSTANCE_STRIDE fields [0..1]
in float a_score;        // byte offset 8,  INSTANCE_STRIDE field  [2]
in float a_prev_score;   // byte offset 12, INSTANCE_STRIDE field  [3]
in float a_row_index;    // byte offset 16, INSTANCE_STRIDE field  [4]
in vec3 a_color;         // byte offset 20, INSTANCE_STRIDE fields [5..7]

// SYNC: uniform layout must match struct Uniforms in wiggleShader.ts (WGSL)
// and writeUniforms() in both WebGLWiggleRenderer.ts and WiggleRenderer.ts
layout(std140) uniform Uniforms {
  vec3 bp_range_x;       // [hi, lo, length] — hp split of visible bp range
  uint region_start;     // absolute bp offset for this region
  float canvas_height;
  int scale_type;        // 0=linear, 1=log — SYNC: SCALE_TYPE_* in wiggleShader.ts
  int rendering_type;    // 0=xyplot, 1=density, 2=line, 3=scatter — SYNC: RENDERING_TYPE_* in wiggleShader.ts
  float num_rows;
  vec2 domain_y;         // [min, max] score domain
  float zero;            // MUST be 0.0 at runtime — creates runtime infinity for hp precision
  float viewport_width;
};

out vec4 v_color;

// SYNC: these constants must match wiggleShader.ts (WGSL) and wiggleShader.ts (TS)
const uint HP_LOW_MASK = 0xFFFu;
const int RENDERING_TYPE_DENSITY = 1;
const int RENDERING_TYPE_LINE = 2;
const int RENDERING_TYPE_SCATTER = 3;
const int SCALE_TYPE_LOG = 1;

// SYNC: hp_split_uint — must match wiggleShader.ts (WGSL)
vec2 hp_split_uint(uint value) {
  uint lo = value & HP_LOW_MASK;
  uint hi = value - lo;
  return vec2(float(hi), float(lo));
}

// SYNC: hp_to_clip_x — must match wiggleShader.ts (WGSL)
// WARNING: 'z' MUST be 0.0 at runtime. Produces runtime infinity (1.0/0.0)
// that prevents the compiler from combining hi/lo subtractions.
// HP technique from genome-spy (MIT): https://github.com/genome-spy/genome-spy
float hp_to_clip_x(vec2 split_pos, vec3 bpr, float z) {
  float inf_ = 1.0 / z;
  float step_ = 2.0 / bpr.z;
  float hi = max(split_pos.x - bpr.x, -inf_);
  float lo = max(split_pos.y - bpr.y, -inf_);
  return dot(vec3(-1.0, hi, lo), vec3(1.0, step_, step_));
}

// SYNC: normalize_score — must match wiggleShader.ts (WGSL)
float normalize_score(float s, vec2 dy, int st) {
  if (st == SCALE_TYPE_LOG) {
    float log_min = log2(max(dy.x, 1.0));
    float log_max = log2(max(dy.y, 1.0));
    float log_s = log2(max(s, 1.0));
    return clamp((log_s - log_min) / (log_max - log_min), 0.0, 1.0);
  }
  return clamp((s - dy.x) / (dy.y - dy.x), 0.0, 1.0);
}

// SYNC: score_to_y — must match wiggleShader.ts (WGSL)
float score_to_y(float s, vec2 dy, float h, int st) {
  return (1.0 - normalize_score(s, dy, st)) * h;
}

// SYNC: vs_main rendering logic — must match wiggleShader.ts (WGSL)
void main() {
  uint vid = uint(gl_VertexID) % 6u;

  uint abs_start = a_start_end.x + region_start;
  uint abs_end = a_start_end.y + region_start;
  float sx1 = hp_to_clip_x(hp_split_uint(abs_start), bp_range_x, zero);
  float sx2 = hp_to_clip_x(hp_split_uint(abs_end), bp_range_x, zero);
  float min_clip_w = 3.0 / viewport_width;
  if (sx2 - sx1 < min_clip_w) {
    sx2 = sx1 + min_clip_w;
  }

  float row_height = canvas_height / num_rows;
  float row_top = a_row_index * row_height;
  float px_to_clip = 2.0 / canvas_height;

  float sx;
  float sy;

  if (rendering_type == RENDERING_TYPE_LINE) {
    float sy_score = 1.0 - (score_to_y(a_score, domain_y, row_height, scale_type) + row_top) * px_to_clip;
    float sy_prev = 1.0 - (score_to_y(a_prev_score, domain_y, row_height, scale_type) + row_top) * px_to_clip;
    switch (vid) {
      case 0u: sx = sx1; sy = sy_prev;  break;
      case 1u: sx = sx1; sy = sy_score; break;
      case 2u: sx = sx1; sy = sy_score; break;
      case 3u: sx = sx2; sy = sy_score; break;
      case 4u: sx = sx2; sy = sy_score; break;
      default: sx = sx2; sy = sy_score; break;
    }
  } else if (rendering_type == RENDERING_TYPE_DENSITY) {
    float lx = (vid == 0u || vid == 2u || vid == 3u) ? 0.0 : 1.0;
    float ly = (vid == 0u || vid == 1u || vid == 4u) ? 0.0 : 1.0;
    sx = mix(sx1, sx2, lx);
    float sy_top = 1.0 - row_top * px_to_clip;
    float sy_bot = 1.0 - (row_top + row_height) * px_to_clip;
    sy = mix(sy_bot, sy_top, ly);
  } else if (rendering_type == RENDERING_TYPE_SCATTER) {
    float lx = (vid == 0u || vid == 2u || vid == 3u) ? 0.0 : 1.0;
    float ly = (vid == 0u || vid == 1u || vid == 4u) ? 0.0 : 1.0;
    float s_y = score_to_y(a_score, domain_y, row_height, scale_type) + row_top;
    sx = mix(sx1, sx2, lx);
    sy = mix(1.0 - (s_y + 1.0) * px_to_clip, 1.0 - (s_y - 1.0) * px_to_clip, ly);
  } else {
    // XYPLOT (default) — SYNC: the else branch in wiggleShader.ts (WGSL)
    float lx = (vid == 0u || vid == 2u || vid == 3u) ? 0.0 : 1.0;
    float ly = (vid == 0u || vid == 1u || vid == 4u) ? 0.0 : 1.0;
    sx = mix(sx1, sx2, lx);
    float s_y = score_to_y(a_score, domain_y, row_height, scale_type);
    float o_y = score_to_y(0.0, domain_y, row_height, scale_type);
    float y_top = min(s_y, o_y) + row_top;
    float y_bot = max(s_y, o_y) + row_top;
    sy = mix(1.0 - y_bot * px_to_clip, 1.0 - y_top * px_to_clip, ly);
  }

  // SYNC: density color interpolation — must match wiggleShader.ts (WGSL)
  vec3 color;
  if (rendering_type == RENDERING_TYPE_DENSITY) {
    float norm = normalize_score(a_score, domain_y, scale_type);
    float zero_norm = normalize_score(0.0, domain_y, scale_type);
    float max_dist = max(zero_norm, 1.0 - zero_norm);
    float t = abs(norm - zero_norm) / max(max_dist, 0.0001);
    color = mix(vec3(1.0), a_color, t);
  } else {
    color = a_color;
  }

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = vec4(color, 1.0);
}
`

export const WIGGLE_FRAGMENT_SHADER_GLSL = `#version 300 es
precision highp float;

in vec4 v_color;
out vec4 fragColor;

void main() {
  fragColor = v_color;
}
`
