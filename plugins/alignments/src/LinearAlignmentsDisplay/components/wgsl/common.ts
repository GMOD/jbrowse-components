import { HP_WGSL_CORE } from '@jbrowse/alignments-core'
import {
  RECT_LOCALS_WGSL,
  SIMPLE_FS_WGSL,
  SIMPLE_VERTEX_OUTPUT_WGSL,
} from '@jbrowse/alignments-core'

// Re-export shared HP functions. Call sites pass uf(5u) (U_HP_ZERO) as the
// hp_zero parameter: hp_to_clip_x(pos, range, uf(5u))
export const HP_WGSL = HP_WGSL_CORE

// SYNC(shaders/readShaders.ts, shaders/arcShaders.ts, shaders/cigarShaders.ts, shaders/coverageShaders.ts, shaders/connectingLineShaders.ts):
// Uniform slot indices below map to named GLSL uniforms. GLSL uses named uniforms; WGSL uses raw[i] via uf()/uu()/ui().
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

// Re-export shared shader fragments for backward compat with existing references
export const SIMPLE_FS = SIMPLE_FS_WGSL
export const SIMPLE_VERTEX_OUTPUT = SIMPLE_VERTEX_OUTPUT_WGSL
export const RECT_LOCALS = RECT_LOCALS_WGSL

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
// slot 23 unused (was U_ERASE_MODE, removed with stencil pass)
export const U_BLOCK_START_PX = 24
export const U_BLOCK_WIDTH = 25
export const U_LINE_WIDTH_PX = 26
export const U_GRADIENT_HUE = 27
export const U_SCROLL_TOP = 28
export const U_FLIP_STRAND_LONG_READ = 29
export const U_DOMAIN_START = 30
export const U_DOMAIN_END = 31

// SYNC(shaders/*): Color uniform slots. Each color takes 3 consecutive slots (R,G,B).
// GLSL maps these to named vec3 uniforms (e.g. u_colorFwdStrand -> slots 32-34).
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
export const U_COLOR_UNMAPPED_MATE = 134

// SYNC(shaders/*): Stride constants must match GLSL instance attribute layouts.
// See individual shader files for field-by-field struct documentation.
export const READ_STRIDE = 17
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

// SYNC(shaders/arcShaders.ts): shared constants
export const ARC_CURVE_SEGMENTS = 64
export const ARC_HEIGHT_MARGIN = 8
export const NUM_ARC_COLORS = 8
export const NUM_LINE_COLORS = 2
export const NUM_SASHIMI_COLORS = 2
