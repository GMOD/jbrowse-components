export const HP_WGSL = `
const HP_LOW_MASK: u32 = 0xFFFu;

fn hp_split_uint(value: u32) -> vec2f {
  let lo = value & HP_LOW_MASK;
  let hi = value - lo;
  return vec2f(f32(hi), f32(lo));
}

// WARNING: max(-inf) and dot() prevent the compiler from combining hi/lo split
// terms. Do not simplify.
// HP technique from genome-spy (MIT): https://github.com/genome-spy/genome-spy
fn hp_to_clip_x(split_pos: vec2f, bp_range: vec3f) -> f32 {
  let inf = 1.0 / uf(5u);
  let step = 2.0 / bp_range.z;
  let hi = max(split_pos.x - bp_range.x, -inf);
  let lo = max(split_pos.y - bp_range.y, -inf);
  return dot(vec3f(-1.0, hi, lo), vec3f(1.0, step, step));
}

// WARNING: same compiler guards as hp_to_clip_x. Do not simplify.
fn hp_scale_linear(split_pos: vec2f, bp_range: vec3f) -> f32 {
  let inf = 1.0 / uf(5u);
  let step = 1.0 / bp_range.z;
  let hi = max(split_pos.x - bp_range.x, -inf);
  let lo = max(split_pos.y - bp_range.y, -inf);
  return dot(vec2f(hi, lo), vec2f(step, step));
}

fn snap_to_pixel_x(clip_x: f32, canvas_width: f32) -> f32 {
  let px = (clip_x + 1.0) * 0.5 * canvas_width;
  return floor(px + 0.5) / canvas_width * 2.0 - 1.0;
}
`

export const UNIFORM_WGSL = `
@group(0) @binding(1) var<uniform> raw: array<vec4u, 40>;

fn uf(i: u32) -> f32 { return bitcast<f32>(raw[i / 4u][i % 4u]); }
fn uu(i: u32) -> u32 { return raw[i / 4u][i % 4u]; }
fn ui(i: u32) -> i32 { return bitcast<i32>(raw[i / 4u][i % 4u]); }
fn color3(base: u32) -> vec3f { return vec3f(uf(base), uf(base + 1u), uf(base + 2u)); }

fn bp_range() -> vec3f { return vec3f(uf(0u), uf(1u), uf(2u)); }
fn region_start() -> u32 { return uu(3u); }
fn range_y0() -> f32 { return uf(4u); }
fn canvas_height() -> f32 { return uf(6u); }
fn canvas_width() -> f32 { return uf(7u); }
fn coverage_offset() -> f32 { return uf(8u); }
fn feature_height() -> f32 { return uf(9u); }
fn feature_spacing() -> f32 { return uf(10u); }
`

export const PREAMBLE = UNIFORM_WGSL + HP_WGSL

export const SIMPLE_FS = `
@fragment
fn fs_main(@location(0) color: vec4f) -> @location(0) vec4f {
  return color;
}
`

export const SIMPLE_VERTEX_OUTPUT = `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}
`

export const RECT_LOCALS = `
  let v = vid % 6u;
  let local_x = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let local_y = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);
`

export const PILEUP_Y = `
fn pileup_y(row: f32) -> vec2f {
  let row_h = feature_height() + feature_spacing();
  let y_top = row * row_h - range_y0();
  let y_bot = y_top + feature_height();
  let px2clip = 2.0 / canvas_height();
  let top_clip = 1.0 - (coverage_offset() / canvas_height()) * 2.0;
  return vec2f(top_clip - y_top * px2clip, top_clip - y_bot * px2clip);
}
`

export const UNIFORM_SIZE = 640

export const U_BP_HI = 0
export const U_BP_LO = 1
export const U_BP_LEN = 2
export const U_REGION_START = 3
export const U_RANGE_Y0 = 4
// WARNING: U_HP_ZERO must always be 0.0. Used by HP shader functions via uf(5u)
// to produce runtime infinity that prevents compiler from combining hi/lo splits.
export const U_HP_ZERO = 5
export const U_CANVAS_H = 6
export const U_CANVAS_W = 7
export const U_COV_OFFSET = 8
export const U_FEAT_H = 9
export const U_FEAT_SPACING = 10
export const U_COLOR_SCHEME = 11
export const U_HIGHLIGHT_IDX = 12
export const U_HIGHLIGHT_ONLY = 13
export const U_CHAIN_MODE = 14
export const U_SHOW_STROKE = 15
export const U_COV_HEIGHT = 16
export const U_COV_Y_OFFSET = 17
export const U_DEPTH_SCALE = 18
export const U_BIN_SIZE = 19
export const U_NONCOV_HEIGHT = 20
export const U_INSERT_UPPER = 21
export const U_INSERT_LOWER = 22
export const U_ERASE_MODE = 23
export const U_BLOCK_START_PX = 24
export const U_BLOCK_WIDTH = 25
export const U_LINE_WIDTH_PX = 26
export const U_GRADIENT_HUE = 27
export const U_SCROLL_TOP = 28
export const U_DOMAIN_START = 30
export const U_DOMAIN_END = 31

export const U_COLOR_FWD = 32
export const U_COLOR_REV = 35
export const U_COLOR_NOSTRAND = 38
export const U_COLOR_PAIR_LR = 41
export const U_COLOR_PAIR_RL = 44
export const U_COLOR_PAIR_RR = 47
export const U_COLOR_PAIR_LL = 50
export const U_COLOR_BASE_A = 53
export const U_COLOR_BASE_C = 56
export const U_COLOR_BASE_G = 59
export const U_COLOR_BASE_T = 62
export const U_COLOR_INSERTION = 65
export const U_COLOR_DELETION = 68
export const U_COLOR_SKIP = 71
export const U_COLOR_SOFTCLIP = 74
export const U_COLOR_HARDCLIP = 77
export const U_COLOR_COVERAGE = 80
export const U_COLOR_MOD_FWD = 83
export const U_COLOR_MOD_REV = 86
export const U_COLOR_LONG_INSERT = 89
export const U_COLOR_SHORT_INSERT = 92
export const U_COLOR_SUPPLEMENTARY = 95
export const U_ARC_COLORS = 98
export const U_ARC_LINE_COLORS = 122
export const U_SASHIMI_COLORS = 128

export const READ_STRIDE = 12
export const GAP_STRIDE = 5
export const MISMATCH_STRIDE = 4
export const INSERTION_STRIDE = 4
export const SOFTCLIP_STRIDE = 4
export const HARDCLIP_STRIDE = 4
export const MODIFICATION_STRIDE = 4
export const COVERAGE_STRIDE = 2
export const SNP_COV_STRIDE = 4
export const MOD_COV_STRIDE = 4
export const NONCOV_STRIDE = 4
export const INDICATOR_STRIDE = 2
export const ARC_STRIDE = 4
export const SASHIMI_STRIDE = 4
export const ARC_LINE_STRIDE = 4
export const CONN_LINE_STRIDE = 3

export const ARC_CURVE_SEGMENTS = 64
export const NUM_ARC_COLORS = 8
export const NUM_LINE_COLORS = 2
export const NUM_SASHIMI_COLORS = 2
