export const INSTANCE_STRIDE = 4

export const wiggleShader = /* wgsl */ `
const HP_LOW_MASK: u32 = 0xFFFu;

fn hp_split_uint(value: u32) -> vec2f {
  let lo = value & HP_LOW_MASK;
  let hi = value - lo;
  return vec2f(f32(hi), f32(lo));
}

fn hp_to_clip_x(split_pos: vec2f, bp_range: vec3f) -> f32 {
  let hi = split_pos.x - bp_range.x;
  let lo = split_pos.y - bp_range.y;
  return (hi + lo) / bp_range.z * 2.0 - 1.0;
}

fn normalize_score(score: f32, domain_y: vec2f, scale_type: i32) -> f32 {
  if (scale_type == 1) {
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

struct Instance {
  start_end: vec2u,
  score: f32,
  _pad: f32,
}

struct Uniforms {
  bp_range_x: vec3f,
  region_start: u32,
  canvas_height: f32,
  scale_type: i32,
  rendering_type: i32,
  use_bicolor: i32,
  domain_y: vec2f,
  bicolor_pivot: f32,
  _pad0: f32,
  color: vec3f,
  _pad1: f32,
  pos_color: vec3f,
  _pad2: f32,
  neg_color: vec3f,
  _pad3: f32,
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
  let vid = vertex_index % 6u;

  let abs_start = inst.start_end.x + u.region_start;
  let abs_end = inst.start_end.y + u.region_start;
  let split_start = hp_split_uint(abs_start);
  let split_end = hp_split_uint(abs_end);
  let sx1 = hp_to_clip_x(split_start, u.bp_range_x);
  let sx2 = hp_to_clip_x(split_end, u.bp_range_x);

  var sx: f32;
  var sy: f32;

  let px_to_clip = 2.0 / u.canvas_height;

  if (u.rendering_type == 2) {
    let score_y = score_to_y(inst.score, u.domain_y, u.canvas_height, u.scale_type);
    let safe_prev_idx = max(instance_index, 1u) - 1u;
    let prev_score = select(instances[safe_prev_idx].score, inst.score, instance_index == 0u);
    let prev_y = score_to_y(prev_score, u.domain_y, u.canvas_height, u.scale_type);

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
  } else if (u.rendering_type == 1) {
    let local_x = select(1.0, 0.0, vid == 0u || vid == 2u || vid == 3u);
    let local_y = select(1.0, 0.0, vid == 0u || vid == 1u || vid == 4u);
    sx = mix(sx1, sx2, local_x);
    sy = mix(-1.0, 1.0, local_y);
  } else {
    let local_x = select(1.0, 0.0, vid == 0u || vid == 2u || vid == 3u);
    let local_y = select(1.0, 0.0, vid == 0u || vid == 1u || vid == 4u);
    sx = mix(sx1, sx2, local_x);

    let score_y = score_to_y(inst.score, u.domain_y, u.canvas_height, u.scale_type);
    let origin_y = score_to_y(0.0, u.domain_y, u.canvas_height, u.scale_type);
    let y_top = min(score_y, origin_y);
    let y_bot = max(score_y, origin_y);
    let sy_top = 1.0 - y_top * px_to_clip;
    let sy_bot = 1.0 - y_bot * px_to_clip;
    sy = mix(sy_bot, sy_top, local_y);
  }

  var color: vec3f;
  if (u.use_bicolor == 1) {
    if (u.rendering_type == 1) {
      let norm = normalize_score(inst.score, u.domain_y, u.scale_type);
      let norm_pivot = normalize_score(u.bicolor_pivot, u.domain_y, u.scale_type);
      color = select(u.pos_color, u.neg_color, norm < norm_pivot);
    } else {
      color = select(u.pos_color, u.neg_color, inst.score < u.bicolor_pivot);
    }
  } else {
    if (u.rendering_type == 1) {
      let norm = normalize_score(inst.score, u.domain_y, u.scale_type);
      let low_color = vec3f(0.93, 0.93, 0.93);
      color = mix(low_color, u.pos_color, norm);
    } else {
      color = u.color;
    }
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
