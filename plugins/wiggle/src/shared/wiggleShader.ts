export const INSTANCE_STRIDE = 8
export const UNIFORM_SIZE = 48
export const VERTICES_PER_INSTANCE = 6
export const RENDERING_TYPE_XYPLOT = 0
export const RENDERING_TYPE_DENSITY = 1
export const RENDERING_TYPE_LINE = 2
export const RENDERING_TYPE_SCATTER = 3
export const SCALE_TYPE_LINEAR = 0
export const SCALE_TYPE_LOG = 1

export const wiggleShader = /* wgsl */ `
const HP_LOW_MASK: u32 = 0xFFFu;
const RENDERING_TYPE_XYPLOT: i32 = 0;
const RENDERING_TYPE_DENSITY: i32 = 1;
const RENDERING_TYPE_LINE: i32 = 2;
const RENDERING_TYPE_SCATTER: i32 = 3;
const SCALE_TYPE_LOG: i32 = 1;
const VERTICES_PER_INSTANCE: u32 = 6u;

fn hp_split_uint(value: u32) -> vec2f {
  let lo = value & HP_LOW_MASK;
  let hi = value - lo;
  return vec2f(f32(hi), f32(lo));
}

// WARNING: 'zero' MUST be 0.0 at runtime. Produces runtime infinity (1.0/0.0)
// that prevents the compiler from combining hi/lo subtractions.
// A compile-time constant would be optimized away.
// WARNING: max(-inf) and dot() prevent the compiler from combining hi/lo split
// terms. Do not simplify.
// HP technique from genome-spy (MIT): https://github.com/genome-spy/genome-spy
fn hp_to_clip_x(split_pos: vec2f, bp_range: vec3f, zero: f32) -> f32 {
  let inf = 1.0 / zero;
  let step = 2.0 / bp_range.z;
  let hi = max(split_pos.x - bp_range.x, -inf);
  let lo = max(split_pos.y - bp_range.y, -inf);
  return dot(vec3f(-1.0, hi, lo), vec3f(1.0, step, step));
}

fn normalize_score(score: f32, domain_y: vec2f, scale_type: i32) -> f32 {
  if (scale_type == SCALE_TYPE_LOG) {
    let log_min = log2(max(domain_y.x, 1.0));
    let log_max = log2(max(domain_y.y, 1.0));
    let log_score = log2(max(score, 1.0));
    return clamp((log_score - log_min) / (log_max - log_min), 0.0, 1.0);
  }
  return clamp((score - domain_y.x) / (domain_y.y - domain_y.x), 0.0, 1.0);
}

fn score_to_y(score: f32, domain_y: vec2f, height: f32, scale_type: i32) -> f32 {
  return (1.0 - normalize_score(score, domain_y, scale_type)) * height;
}

fn get_row_height(canvas_height: f32, num_rows: f32, row_padding: f32) -> f32 {
  let total_padding = row_padding * (num_rows - 1.0);
  return (canvas_height - total_padding) / num_rows;
}

fn get_row_top(row_index: f32, row_height: f32, row_padding: f32) -> f32 {
  return row_index * (row_height + row_padding);
}

struct Instance {
  start_end: vec2u,
  score: f32,
  prev_score: f32,
  row_index: f32,
  color_r: f32,
  color_g: f32,
  color_b: f32,
}

struct Uniforms {
  bp_range_x: vec3f,
  region_start: u32,
  canvas_height: f32,
  scale_type: i32,
  rendering_type: i32,
  num_rows: f32,
  domain_y: vec2f,
  row_padding: f32,
  zero: f32, // MUST be 0.0 at runtime — used by hp_to_clip_x to create runtime infinity
}

@group(0) @binding(0) var<storage, read> instances: array<Instance>;
@group(0) @binding(1) var<uniform> u: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs_main(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32,
) -> VertexOutput {
  let inst = instances[instance_index];
  let vid = vertex_index % VERTICES_PER_INSTANCE;

  let abs_start = inst.start_end.x + u.region_start;
  let abs_end = inst.start_end.y + u.region_start;
  let split_start = hp_split_uint(abs_start);
  let split_end = hp_split_uint(abs_end);
  let sx1 = hp_to_clip_x(split_start, u.bp_range_x, u.zero);
  let sx2 = hp_to_clip_x(split_end, u.bp_range_x, u.zero);

  let row_height = get_row_height(u.canvas_height, u.num_rows, u.row_padding);
  let row_top = get_row_top(inst.row_index, row_height, u.row_padding);
  let px_to_clip = 2.0 / u.canvas_height;

  var sx: f32;
  var sy: f32;
  let inst_color = vec3f(inst.color_r, inst.color_g, inst.color_b);

  if (u.rendering_type == RENDERING_TYPE_LINE) {
    let score_y = score_to_y(inst.score, u.domain_y, row_height, u.scale_type) + row_top;
    let prev_y = score_to_y(inst.prev_score, u.domain_y, row_height, u.scale_type) + row_top;
    let clip_score_y = 1.0 - score_y * px_to_clip;
    let clip_prev_y = 1.0 - prev_y * px_to_clip;

    switch vid {
      case 0u: { sx = sx1; sy = clip_prev_y; }
      case 1u: { sx = sx1; sy = clip_score_y; }
      case 2u: { sx = sx1; sy = clip_score_y; }
      case 3u: { sx = sx2; sy = clip_score_y; }
      case 4u: { sx = sx2; sy = clip_score_y; }
      default: { sx = sx2; sy = clip_score_y; }
    }
  } else if (u.rendering_type == RENDERING_TYPE_DENSITY) {
    let local_x = select(1.0, 0.0, vid == 0u || vid == 2u || vid == 3u);
    let local_y = select(1.0, 0.0, vid == 0u || vid == 1u || vid == 4u);
    sx = mix(sx1, sx2, local_x);

    let row_bot = row_top + row_height;
    let sy_top = 1.0 - row_top * px_to_clip;
    let sy_bot = 1.0 - row_bot * px_to_clip;
    sy = mix(sy_bot, sy_top, local_y);
  } else if (u.rendering_type == RENDERING_TYPE_SCATTER) {
    let local_x = select(1.0, 0.0, vid == 0u || vid == 2u || vid == 3u);
    let local_y = select(1.0, 0.0, vid == 0u || vid == 1u || vid == 4u);

    let score_y = score_to_y(inst.score, u.domain_y, row_height, u.scale_type) + row_top;
    let sy_top = 1.0 - (score_y - 1.0) * px_to_clip;
    let sy_bot = 1.0 - (score_y + 1.0) * px_to_clip;

    sx = mix(sx1, sx2, local_x);
    sy = mix(sy_bot, sy_top, local_y);
  } else {
    let local_x = select(1.0, 0.0, vid == 0u || vid == 2u || vid == 3u);
    let local_y = select(1.0, 0.0, vid == 0u || vid == 1u || vid == 4u);
    sx = mix(sx1, sx2, local_x);

    let score_y = score_to_y(inst.score, u.domain_y, row_height, u.scale_type);
    let origin_y = score_to_y(0.0, u.domain_y, row_height, u.scale_type);
    let y_top = min(score_y, origin_y) + row_top;
    let y_bot = max(score_y, origin_y) + row_top;
    let sy_top = 1.0 - y_top * px_to_clip;
    let sy_bot = 1.0 - y_bot * px_to_clip;
    sy = mix(sy_bot, sy_top, local_y);
  }

  var color: vec3f;
  if (u.rendering_type == RENDERING_TYPE_DENSITY) {
    let norm = normalize_score(inst.score, u.domain_y, u.scale_type);
    let zero_norm = normalize_score(0.0, u.domain_y, u.scale_type);
    let max_dist = max(zero_norm, 1.0 - zero_norm);
    let t = abs(norm - zero_norm) / max(max_dist, 0.0001);
    color = mix(vec3f(1.0), inst_color, t);
  } else {
    color = inst_color;
  }

  var out: VertexOutput;
  out.position = vec4f(sx, sy, 0.0, 1.0);
  out.color = vec4f(color, 1.0);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return in.color;
}
`
