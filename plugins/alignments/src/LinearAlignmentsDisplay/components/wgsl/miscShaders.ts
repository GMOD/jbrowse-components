import { ARC_CURVE_SEGMENTS, NUM_ARC_COLORS, NUM_LINE_COLORS, NUM_SASHIMI_COLORS, PREAMBLE, SIMPLE_FS, SIMPLE_VERTEX_OUTPUT, UNIFORM_WGSL } from './common.ts'

const ARC_PREAMBLE = PREAMBLE

export const ARC_WGSL = `
${ARC_PREAMBLE}

const SEGMENTS: u32 = ${ARC_CURVE_SEGMENTS}u;
const PI: f32 = 3.14159265359;

struct ArcInst { x1: f32, x2: f32, color_type: f32, is_arc: f32 }
@group(0) @binding(0) var<storage, read> instances: array<ArcInst>;

struct ArcOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
  @location(1) dist: f32,
}

fn arc_color(ct: f32) -> vec3f {
  let idx = u32(ct + 0.5);
  if idx < ${NUM_ARC_COLORS}u { return color3(98u + idx * 3u); }
  let h = uf(27u) / 360.0;
  let c = 0.5; let xc = c * (1.0 - abs(h * 6.0 % 2.0 - 1.0)); let m = 0.25;
  var rgb: vec3f;
  if h < 1.0/6.0 { rgb = vec3f(c, xc, 0.0); }
  else if h < 2.0/6.0 { rgb = vec3f(xc, c, 0.0); }
  else if h < 3.0/6.0 { rgb = vec3f(0.0, c, xc); }
  else if h < 4.0/6.0 { rgb = vec3f(0.0, xc, c); }
  else if h < 5.0/6.0 { rgb = vec3f(xc, 0.0, c); }
  else { rgb = vec3f(c, 0.0, xc); }
  return rgb + m;
}

fn eval_arc(t: f32, inst: ArcInst) -> vec2f {
  let radius = (inst.x2 - inst.x1) / 2.0;
  let absrad = abs(radius);
  let cx = inst.x1 + radius;
  let px_per_bp = uf(25u) / uf(2u);
  let absrad_px = absrad * px_per_bp;
  let avail_h = canvas_height() - coverage_offset();
  let dest_y = min(avail_h, absrad_px);
  var x_bp: f32; var y_px: f32;
  if inst.is_arc > 0.5 {
    let angle = t * PI;
    x_bp = cx + cos(angle) * radius;
    y_px = select(0.0, sin(angle) * absrad_px * (dest_y / absrad_px), absrad_px > 0.0);
  } else {
    let mt = 1.0 - t; let mt2 = mt*mt; let mt3 = mt2*mt;
    let t2 = t*t; let t3 = t2*t;
    x_bp = mt3*inst.x1 + 3.0*mt2*t*inst.x1 + 3.0*mt*t2*inst.x2 + t3*inst.x2;
    y_px = 3.0*mt2*t*dest_y + 3.0*mt*t2*dest_y;
  }
  let screen_x = uf(24u) + (x_bp - uf(30u)) * px_per_bp;
  return vec2f(screen_x, y_px);
}

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> ArcOut {
  var out: ArcOut;
  let inst = instances[iid];
  let seg = vid / 2u;
  let side_idx = vid % 2u;
  let side = select(-1.0, 1.0, side_idx == 0u);
  let t = f32(seg) / f32(SEGMENTS);

  let pos = eval_arc(t, inst);
  let eps = 1.0 / f32(SEGMENTS);
  let p0 = eval_arc(max(t - eps*0.5, 0.0), inst);
  let p1 = eval_arc(min(t + eps*0.5, 1.0), inst);
  let tang = p1 - p0;
  let tlen = length(tang);
  var normal: vec2f;
  if tlen > 0.001 { let tn = tang / tlen; normal = vec2f(-tn.y, tn.x); }
  else { normal = vec2f(0.0, 1.0); }

  let lw = uf(26u);
  let hw = lw * 0.5 + 0.5;
  let offset_pos = pos + normal * hw * side;
  let clip_x = (offset_pos.x / canvas_width()) * 2.0 - 1.0;
  let clip_y = 1.0 - ((offset_pos.y + coverage_offset()) / canvas_height()) * 2.0;
  out.position = vec4f(clip_x, clip_y, 0.0, 1.0);
  out.dist = side * hw;
  out.color = vec4f(arc_color(inst.color_type), 1.0);
  return out;
}

@fragment
fn fs_main(in: ArcOut) -> @location(0) vec4f {
  let hw = uf(26u) * 0.5;
  let d = abs(in.dist);
  let aa = fwidth(in.dist);
  let alpha = 1.0 - smoothstep(hw - aa*0.5, hw + aa, d);
  return vec4f(in.color.rgb, in.color.a * alpha);
}
`

export const ARC_LINE_WGSL = `
${ARC_PREAMBLE}
${SIMPLE_VERTEX_OUTPUT}

struct ArcLineInst { position: u32, y: f32, color_type: f32, _pad: f32 }
@group(0) @binding(0) var<storage, read> instances: array<ArcLineInst>;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VertexOutput {
  var out: VertexOutput;
  let inst = instances[iid];
  let v = vid % 2u;

  let abs_pos = inst.position + region_start();
  let split_pos = hp_split_uint(abs_pos);
  let norm = hp_scale_linear(split_pos, bp_range());
  let screen_x = uf(24u) + norm * uf(25u);
  let sx = (screen_x / canvas_width()) * 2.0 - 1.0;

  var sy: f32;
  if v == 0u { sy = 1.0 - ((inst.y + coverage_offset()) / canvas_height()) * 2.0; }
  else { sy = 1.0 - (coverage_offset() / canvas_height()) * 2.0; }

  out.position = vec4f(sx, sy, 0.0, 1.0);
  let idx = u32(inst.color_type + 0.5);
  let ci = min(idx, ${NUM_LINE_COLORS - 1}u);
  out.color = vec4f(color3(122u + ci * 3u), 1.0);
  return out;
}

${SIMPLE_FS}
`

export const SASHIMI_WGSL = `
${ARC_PREAMBLE}

const SEGMENTS: u32 = ${ARC_CURVE_SEGMENTS}u;

struct SashimiInst { x1: f32, x2: f32, color_type: f32, line_width: f32 }
@group(0) @binding(0) var<storage, read> instances: array<SashimiInst>;

struct SashimiOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
  @location(1) dist: f32,
  @location(2) lw: f32,
}

fn eval_sashimi(t: f32, inst: SashimiInst) -> vec2f {
  let mt = 1.0-t; let mt2 = mt*mt; let mt3 = mt2*mt;
  let t2 = t*t; let t3 = t2*t;
  let x_bp = mt3*inst.x1 + 3.0*mt2*t*inst.x1 + 3.0*mt*t2*inst.x2 + t3*inst.x2;
  let ch = uf(16u);
  let dest_y = ch * (0.8 / 0.75);
  let y_px = 3.0*mt2*t*dest_y + 3.0*mt*t2*dest_y;
  let px_per_bp = uf(25u) / uf(2u);
  let screen_x = uf(24u) + (x_bp - uf(30u)) * px_per_bp;
  return vec2f(screen_x, 0.9 * ch - y_px);
}

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> SashimiOut {
  var out: SashimiOut;
  let inst = instances[iid];
  let seg = vid / 2u;
  let side = select(-1.0, 1.0, vid % 2u == 0u);
  let t = f32(seg) / f32(SEGMENTS);

  let pos = eval_sashimi(t, inst);
  let eps = 1.0 / f32(SEGMENTS);
  let p0 = eval_sashimi(max(t - eps*0.5, 0.0), inst);
  let p1 = eval_sashimi(min(t + eps*0.5, 1.0), inst);
  let tang = p1 - p0;
  let tlen = length(tang);
  var normal: vec2f;
  if tlen > 0.001 { let tn = tang / tlen; normal = vec2f(-tn.y, tn.x); }
  else { normal = vec2f(0.0, 1.0); }

  let hw = inst.line_width * 0.5 + 0.5;
  let offset_pos = pos + normal * hw * side;
  let clip_x = (offset_pos.x / canvas_width()) * 2.0 - 1.0;
  let clip_y = 1.0 - ((offset_pos.y + coverage_offset()) / canvas_height()) * 2.0;
  out.position = vec4f(clip_x, clip_y, 0.0, 1.0);
  out.dist = side * hw;
  out.lw = inst.line_width;
  let idx = min(u32(inst.color_type + 0.5), ${NUM_SASHIMI_COLORS - 1}u);
  out.color = vec4f(color3(128u + idx * 3u), 1.0);
  return out;
}

@fragment
fn fs_main(in: SashimiOut) -> @location(0) vec4f {
  let hw = in.lw * 0.5;
  let d = abs(in.dist);
  let aa = fwidth(in.dist);
  let alpha = 1.0 - smoothstep(hw - aa*0.5, hw + aa, d);
  return vec4f(in.color.rgb, in.color.a * alpha);
}
`

export const CLOUD_WGSL = `
${ARC_PREAMBLE}
${SIMPLE_VERTEX_OUTPUT}

struct CloudInst { start_off: u32, end_off: u32, y: f32, flags: f32, color_type: f32 }
@group(0) @binding(0) var<storage, read> instances: array<CloudInst>;

fn iso_color(ct: f32, flags: f32) -> vec3f {
  if ct < 0.5 { return vec3f(0.55); }
  if ct < 1.5 { return vec3f(0.85, 0.25, 0.25); }
  if ct < 2.5 { return vec3f(0.25, 0.35, 0.85); }
  if ct < 3.5 { return vec3f(0.5, 0.0, 0.5); }
  return vec3f(0.0, 0.5, 0.0);
}

fn cloud_strand(flags: f32) -> vec3f {
  let is_rev = fract(floor(flags / 16.0) / 2.0) > 0.25;
  return select(vec3f(0.85, 0.55, 0.55), vec3f(0.55, 0.55, 0.85), is_rev);
}

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VertexOutput {
  var out: VertexOutput;
  let inst = instances[iid];
  let v = vid % 6u;
  let lx = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let ly = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);

  let abs_start = inst.start_off + region_start();
  let abs_end = inst.end_off + region_start();
  let sx1 = hp_to_clip_x(hp_split_uint(abs_start), bp_range());
  let sx2 = hp_to_clip_x(hp_split_uint(abs_end), bp_range());

  let avail = canvas_height() - coverage_offset();
  let y_top_px = coverage_offset() + (1.0 - inst.y) * avail - feature_height() * 0.5;
  let y_bot_px = y_top_px + feature_height();
  let px2clip = 2.0 / canvas_height();
  let sy_top = 1.0 - y_top_px * px2clip;
  let sy_bot = 1.0 - y_bot_px * px2clip;

  out.position = vec4f(mix(sx1, sx2, lx), mix(sy_bot, sy_top, ly), 0.0, 1.0);

  let cs = ui(29u);
  var c: vec3f;
  if cs == 0 { c = iso_color(inst.color_type, inst.flags); }
  else if cs == 1 { c = cloud_strand(inst.flags); }
  else { c = vec3f(0.55); }
  out.color = vec4f(c, 1.0);
  return out;
}

${SIMPLE_FS}
`

export const CONNECTING_LINE_WGSL = `
${ARC_PREAMBLE}
${SIMPLE_VERTEX_OUTPUT}

struct ConnLineInst { start_off: u32, end_off: u32, y: f32 }
@group(0) @binding(0) var<storage, read> instances: array<ConnLineInst>;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VertexOutput {
  var out: VertexOutput;
  let inst = instances[iid];
  let v = vid % 6u;
  let lx = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let ly = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);

  let abs_start = inst.start_off + region_start();
  let abs_end = inst.end_off + region_start();
  let sx1 = hp_to_clip_x(hp_split_uint(abs_start), bp_range());
  let sx2 = hp_to_clip_x(hp_split_uint(abs_end), bp_range());

  let row_h = feature_height() + feature_spacing();
  let row_center = coverage_offset() + inst.y * row_h + feature_height() * 0.5 - uf(28u);
  let y_top = floor(row_center - 0.5);
  let y_bot = y_top + 1.0;
  let px2clip = 2.0 / canvas_height();
  let sy_top = 1.0 - y_top * px2clip;
  let sy_bot = 1.0 - y_bot * px2clip;

  out.position = vec4f(mix(sx1, sx2, lx), mix(sy_bot, sy_top, ly), 0.0, 1.0);
  out.color = vec4f(0.0, 0.0, 0.0, 0.45);
  return out;
}

${SIMPLE_FS}
`

export const FLAT_QUAD_WGSL = `
${UNIFORM_WGSL}

struct QuadInst { sx1: f32, sy_top: f32, sx2: f32, sy_bot: f32, r: f32, g: f32, b: f32, a: f32 }
@group(0) @binding(0) var<storage, read> instances: array<QuadInst>;

${SIMPLE_VERTEX_OUTPUT}

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VertexOutput {
  var out: VertexOutput;
  let inst = instances[iid];
  let v = vid % 6u;
  let lx = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let ly = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);
  out.position = vec4f(mix(inst.sx1, inst.sx2, lx), mix(inst.sy_bot, inst.sy_top, ly), 0.0, 1.0);
  out.color = vec4f(inst.r, inst.g, inst.b, inst.a);
  return out;
}

${SIMPLE_FS}
`
