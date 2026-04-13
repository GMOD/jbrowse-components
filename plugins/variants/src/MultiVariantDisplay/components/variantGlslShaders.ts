// SYNC: Hand-written GLSL ES 3.00 for the WebGL2 fallback.
// Mirrors the WGSL shader in variantShaders.ts (used by WebGPU).
// Uses a std140 UBO instead of individual uniforms (required by HAL).
export const VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

const uint HP_LOW_MASK = 0xFFFu;

in uvec2 a_start_end;
in uint a_row_index;
in uint a_shape_type;
in vec4 a_color;

layout(std140) uniform Uniforms {
  vec3 bp_range_x;
  uint region_start;
  float canvas_height;
  float canvas_width;
  float row_height;
  float scroll_top;
  float zero;
};

out vec4 v_color;
out vec2 v_local_px;
flat out vec2 v_size_px;
flat out uint v_shape_type_f;

vec2 hp_split_uint(uint value) {
  uint lo = value & HP_LOW_MASK;
  uint hi = value - lo;
  return vec2(float(hi), float(lo));
}

float hp_to_clip_x(vec2 split_pos, vec3 bpr, float z) {
  float inf_ = 1.0 / z;
  float step_ = 2.0 / bpr.z;
  float hi = max(split_pos.x - bpr.x, -inf_);
  float lo = max(split_pos.y - bpr.y, -inf_);
  return dot(vec3(-1.0, hi, lo), vec3(1.0, step_, step_));
}

void main() {
  uint vid = uint(gl_VertexID) % 6u;

  uint abs_start = a_start_end.x + region_start;
  uint abs_end = a_start_end.y + region_start;
  float clip_x1 = hp_to_clip_x(hp_split_uint(abs_start), bp_range_x, zero);
  float clip_x2 = hp_to_clip_x(hp_split_uint(abs_end), bp_range_x, zero);

  float px_size = 2.0 / canvas_width;
  float cx1 = floor(clip_x1 / px_size + 0.5) * px_size;
  float cx2 = max(floor(clip_x2 / px_size + 0.5) * px_size, cx1 + 2.0 * px_size);

  // fractional y keeps subpixel rows smooth (no rounding = no discrete jumps
  // during resize); max(...,1) is the minimum quad height to avoid GPU-culled
  // zero-height geometry while preserving draw order for variant priority
  float y_top = float(a_row_index) * row_height - scroll_top;
  float y_bot = y_top + max(row_height, 1.0);
  float px_to_clip_y = 2.0 / canvas_height;
  float cy_top = 1.0 - y_top * px_to_clip_y;
  float cy_bot = 1.0 - y_bot * px_to_clip_y;

  float lx = (vid == 0u || vid == 2u || vid == 3u) ? 0.0 : 1.0;
  float ly = (vid == 0u || vid == 1u || vid == 4u) ? 0.0 : 1.0;

  float natural_w_px = (cx2 - cx1) * canvas_width * 0.5;
  uint effective_shape = a_shape_type;
  if (a_shape_type == 3u && natural_w_px < 1.0) {
    effective_shape = 0u;
  }

  float x_left = cx1;
  float x_right = cx2;
  if (effective_shape == 3u) {
    float width_extend = 6.0 / canvas_width;
    x_left -= width_extend;
    x_right += width_extend;
  }

  gl_Position = vec4(mix(x_left, x_right, lx), mix(cy_bot, cy_top, ly), 0.0, 1.0);

  float w_px = (x_right - x_left) * canvas_width * 0.5;
  float h_px = max(row_height, 1.0);
  v_local_px = vec2(lx * w_px, (1.0 - ly) * h_px);
  v_size_px = vec2(w_px, h_px);
  v_shape_type_f = effective_shape;
  v_color = a_color;
}
`

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_color;
in vec2 v_local_px;
flat in vec2 v_size_px;
flat in uint v_shape_type_f;
out vec4 fragColor;

float tri_sdf_right(vec2 p, float w, float h) {
  float d_left = p.x;
  float hyp = sqrt(h * h * 0.25 + w * w);
  float d_top = (-0.5 * h * p.x + w * p.y) / hyp;
  float d_bot = (-0.5 * h * p.x - w * (p.y - h)) / hyp;
  return min(min(d_left, d_top), d_bot);
}

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
