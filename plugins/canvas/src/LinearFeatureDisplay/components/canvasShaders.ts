const HP_WGSL = `
const HP_LOW_MASK: u32 = 0xFFFu;

fn hp_split_uint(value: u32) -> vec2f {
  let lo = value & HP_LOW_MASK;
  let hi = value - lo;
  return vec2f(f32(hi), f32(lo));
}

// zero MUST be 0.0 at runtime — prevents the compiler from combining hi/lo
// subtractions. A compile-time constant would be optimized away.
// max(-inf) and dot() guard against the compiler merging the split terms.
// HP technique from genome-spy (MIT): https://github.com/genome-spy/genome-spy
fn hp_to_clip_x(split_pos: vec2f, bp_range: vec3f, zero: f32) -> f32 {
  let inf = 1.0 / zero;
  let step = 2.0 / bp_range.z;
  let hi = max(split_pos.x - bp_range.x, -inf);
  let lo = max(split_pos.y - bp_range.y, -inf);
  return dot(vec3f(-1.0, hi, lo), vec3f(1.0, step, step));
}

fn snap_to_pixel_x(clip_x: f32, canvas_width: f32) -> f32 {
  let px = (clip_x + 1.0) * 0.5 * canvas_width;
  return floor(px + 0.5) / canvas_width * 2.0 - 1.0;
}
`

export const RECT_SHADER = /* wgsl */ `
${HP_WGSL}

struct RectInstance {
  start_end: vec2u,
  y: f32,
  height: f32,
  color: vec4f,
}

struct Uniforms {
  bp_range_x: vec3f,
  region_start: u32,
  canvas_height: f32,
  canvas_width: f32,
  scroll_y: f32,
  bp_per_px: f32,
  zero: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<RectInstance>;
@group(0) @binding(1) var<uniform> u: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VertexOutput {
  let inst = instances[iid];
  let v = vid % 6u;
  let local_x = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let local_y = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);

  let abs_start = inst.start_end.x + u.region_start;
  let abs_end = inst.start_end.y + u.region_start;
  let sx1 = snap_to_pixel_x(hp_to_clip_x(hp_split_uint(abs_start), u.bp_range_x, u.zero), u.canvas_width);
  let sx2 = snap_to_pixel_x(hp_to_clip_x(hp_split_uint(abs_end), u.bp_range_x, u.zero), u.canvas_width);

  let min_width = 4.0 / u.canvas_width;
  let final_sx2 = select(sx2, sx1 + min_width, sx2 - sx1 < min_width);
  let sx = mix(sx1, final_sx2, local_x);

  let y_top_px = floor(inst.y - u.scroll_y + 0.5);
  let y_bot_px = floor(y_top_px + inst.height + 0.5);
  let sy_top = 1.0 - (y_top_px / u.canvas_height) * 2.0;
  let sy_bot = 1.0 - (y_bot_px / u.canvas_height) * 2.0;
  let sy = mix(sy_bot, sy_top, local_y);

  var out: VertexOutput;
  out.position = vec4f(sx, sy, 0.0, 1.0);
  out.color = inst.color;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return in.color;
}
`

export const LINE_SHADER = /* wgsl */ `
${HP_WGSL}

struct LineInstance {
  start_end: vec2u,
  y: f32,
  direction: f32,
  color: vec4f,
}

struct Uniforms {
  bp_range_x: vec3f,
  region_start: u32,
  canvas_height: f32,
  canvas_width: f32,
  scroll_y: f32,
  bp_per_px: f32,
  zero: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<LineInstance>;
@group(0) @binding(1) var<uniform> u: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VertexOutput {
  let inst = instances[iid];
  let v = vid % 6u;

  let abs_start = inst.start_end.x + u.region_start;
  let abs_end = inst.start_end.y + u.region_start;
  let sx1 = hp_to_clip_x(hp_split_uint(abs_start), u.bp_range_x, u.zero);
  let sx2 = hp_to_clip_x(hp_split_uint(abs_end), u.bp_range_x, u.zero);

  let y_px = floor(inst.y - u.scroll_y + 0.5) + 0.5;
  let cy = 1.0 - (y_px / u.canvas_height) * 2.0;
  let half_px = 1.0 / u.canvas_height;

  let local_x = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let local_y = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);
  let sx = mix(sx1, sx2, local_x);
  let sy = mix(cy - half_px, cy + half_px, local_y);

  var out: VertexOutput;
  out.position = vec4f(sx, sy, 0.0, 1.0);
  out.color = inst.color;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return in.color;
}
`

export const CHEVRON_SHADER = /* wgsl */ `
${HP_WGSL}

struct ChevronInstance {
  start_end: vec2u,
  y: f32,
  direction: f32,
  color: vec4f,
}

struct Uniforms {
  bp_range_x: vec3f,
  region_start: u32,
  canvas_height: f32,
  canvas_width: f32,
  scroll_y: f32,
  bp_per_px: f32,
  zero: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<ChevronInstance>;
@group(0) @binding(1) var<uniform> u: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VertexOutput {
  let inst = instances[iid];
  let local_chevron_index = i32(vid / 12u);
  let v = vid % 12u;

  let line_length_bp = f32(inst.start_end.y - inst.start_end.x);
  let line_width_px = line_length_bp / u.bp_per_px;
  let chevron_spacing_px = 25.0;

  var out: VertexOutput;

  if inst.direction == 0.0 || line_width_px < chevron_spacing_px * 0.5 {
    out.position = vec4f(2.0, 2.0, 0.0, 1.0);
    out.color = vec4f(0.0);
    return out;
  }

  let total_chevrons = max(1, i32(floor(line_width_px / chevron_spacing_px)));
  let bp_spacing = line_length_bp / f32(total_chevrons + 1);

  let viewport_start_bp = u.bp_range_x.x + u.bp_range_x.y - f32(u.region_start) - f32(inst.start_end.x);
  let viewport_end_bp = viewport_start_bp + u.bp_range_x.z;

  let first_visible = max(0, i32(floor(viewport_start_bp / bp_spacing)) - 1);
  let last_visible = min(total_chevrons - 1, i32(ceil(viewport_end_bp / bp_spacing)));

  let global_chevron_index = first_visible + local_chevron_index;

  if global_chevron_index < 0 || global_chevron_index > last_visible || global_chevron_index >= total_chevrons {
    out.position = vec4f(2.0, 2.0, 0.0, 1.0);
    out.color = vec4f(0.0);
    return out;
  }

  let chevron_offset_bp = bp_spacing * f32(global_chevron_index + 1);
  let line_start_abs = inst.start_end.x + u.region_start;
  let split_start = hp_split_uint(line_start_abs);
  let split_chevron = vec2f(split_start.x, split_start.y + chevron_offset_bp);
  let cx = hp_to_clip_x(split_chevron, u.bp_range_x, u.zero);

  let y_px = floor(inst.y - u.scroll_y + 0.5) + 0.5;
  let cy = 1.0 - (y_px / u.canvas_height) * 2.0;

  let half_w = 4.5 / u.canvas_width;
  let half_h = 3.5 / u.canvas_height;
  let thickness = 1.0 / u.canvas_height;
  let dir = inst.direction;

  let is_top_arm = v < 6u;
  let qv = v % 6u;
  var sx: f32;
  var sy: f32;

  let tip_x = cx + half_w * dir;
  let outer_x = cx - half_w * dir;
  let arm_y = select(-half_h, half_h, is_top_arm);

  switch qv {
    case 0u: { sx = outer_x; sy = cy + arm_y; }
    case 1u: { sx = tip_x; sy = cy + thickness * 0.5; }
    case 2u: { sx = tip_x; sy = cy - thickness * 0.5; }
    case 3u: { sx = outer_x; sy = cy + arm_y; }
    case 4u: { sx = tip_x; sy = cy - thickness * 0.5; }
    default: { sx = outer_x; sy = cy + arm_y - select(thickness, -thickness, is_top_arm); }
  }

  out.position = vec4f(sx, sy, 0.0, 1.0);
  out.color = inst.color;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return in.color;
}
`

export const ARROW_SHADER = /* wgsl */ `
${HP_WGSL}

struct ArrowInstance {
  x: u32,
  _pad0: u32,
  y: f32,
  direction: f32,
  height: f32,
  color_r: f32,
  color_g: f32,
  color_b: f32,
}

struct Uniforms {
  bp_range_x: vec3f,
  region_start: u32,
  canvas_height: f32,
  canvas_width: f32,
  scroll_y: f32,
  bp_per_px: f32,
  zero: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<ArrowInstance>;
@group(0) @binding(1) var<uniform> u: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VertexOutput {
  let inst = instances[iid];
  let v = vid % 9u;

  let abs_x = inst.x + u.region_start;
  let cx = hp_to_clip_x(hp_split_uint(abs_x), u.bp_range_x, u.zero);

  let y_px = floor(inst.y - u.scroll_y + 0.5) + 0.5;
  let cy = 1.0 - (y_px / u.canvas_height) * 2.0;

  let stem_length = 7.0 / u.canvas_width * 2.0;
  let stem_half = 0.5 / u.canvas_height * 2.0;
  let head_half = 2.5 / u.canvas_height * 2.0;

  let dir = inst.direction;

  var sx: f32;
  var sy: f32;
  if v < 6u {
    let local_x = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
    let local_y = select(1.0, -1.0, v == 0u || v == 1u || v == 4u);
    sx = cx + local_x * stem_length * 0.5 * dir;
    sy = cy + local_y * stem_half;
  } else {
    let hvid = v - 6u;
    if hvid == 0u {
      sx = cx + stem_length * 0.5 * dir;
      sy = cy + head_half;
    } else if hvid == 1u {
      sx = cx + stem_length * 0.5 * dir;
      sy = cy - head_half;
    } else {
      sx = cx + stem_length * dir;
      sy = cy;
    }
  }

  var out: VertexOutput;
  out.position = vec4f(sx, sy, 0.0, 1.0);
  out.color = vec4f(inst.color_r, inst.color_g, inst.color_b, 1.0);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return in.color;
}
`
