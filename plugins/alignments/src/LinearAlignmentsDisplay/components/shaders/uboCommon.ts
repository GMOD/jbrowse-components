import { HP_GLSL_CORE } from '@jbrowse/alignments-core'

// GLSL UBO preamble for HAL-based rendering.
// Matches the WGSL uniform layout in wgsl/common.ts: array<vec4u, 40> (640 bytes).
// All shaders use uf()/uu()/ui() accessors instead of named uniforms.
export const GLSL_UBO_PREAMBLE = `
layout(std140) uniform Uniforms { uvec4 raw[40]; };
float uf(uint i) { return uintBitsToFloat(raw[i / 4u][i % 4u]); }
uint uu(uint i) { return raw[i / 4u][i % 4u]; }
int ui(uint i) { return int(raw[i / 4u][i % 4u]); }
vec3 color3(uint base) { return vec3(uf(base), uf(base + 1u), uf(base + 2u)); }

vec3 bp_range() { return vec3(uf(0u), uf(1u), uf(2u)); }
uint region_start() { return uu(3u); }
float range_y0() { return uf(4u); }
float canvas_height() { return uf(6u); }
float canvas_width() { return uf(7u); }
float coverage_offset() { return uf(8u); }
float feature_height() { return uf(9u); }
float feature_spacing() { return uf(10u); }
float flip_x(float x) { return mix(x, -x, uf(23u)); }
`

// HP (high precision) GLSL functions using UBO accessor for hp_zero.
// The HAL uses a UBO, so we can't use the old named-uniform version.
// hp_zero is always at slot 5 (U_HP_ZERO).
// HP_GLSL_CORE defines camelCase (hpSplitUint, hpToClipX, hpScaleLinear).
// We add snake_case aliases for consistency with WGSL naming.
export const HP_GLSL_UBO = HP_GLSL_CORE + `
vec2 hp_split_uint(uint value) { return hpSplitUint(value); }
float hp_to_clip_x(vec2 splitPos, vec3 bpRange) {
  return hpToClipX(splitPos, bpRange, uf(5u));
}
float hp_scale_linear(vec2 splitPos, vec3 bpRange) {
  return hpScaleLinear(splitPos, bpRange, uf(5u));
}
// Short aliases matching WGSL hp_clip_x / hp_linear
float hp_clip_x(vec2 splitPos, vec3 bpRange) {
  return hpToClipX(splitPos, bpRange, uf(5u));
}
float hp_linear(vec2 splitPos, vec3 bpRange) {
  return hpScaleLinear(splitPos, bpRange, uf(5u));
}
`

// Pileup Y coordinate computation (matches wgsl/common.ts PILEUP_Y)
export const PILEUP_Y_GLSL = `
void pileup_y(float row, out float y_top_clip, out float y_bot_clip) {
  float row_h = feature_height() + feature_spacing();
  float y_top = row * row_h - range_y0();
  float y_bot = y_top + feature_height();
  float px2clip = 2.0 / canvas_height();
  float top_clip = 1.0 - (coverage_offset() / canvas_height()) * 2.0;
  y_top_clip = top_clip - y_top * px2clip;
  y_bot_clip = top_clip - y_bot * px2clip;
}
`

// Domain-based coordinate helpers for cigar/coverage shaders
export const CIGAR_DOMAIN_GLSL = `
vec2 cigar_domain() { return vec2(uf(30u), uf(31u)); }
float cigar_domain_len() { return uf(31u) - uf(30u); }
`

export const COV_DOMAIN_GLSL = `
vec2 vis_range() { return vec2(uf(30u), uf(31u)); }
float vis_range_len() { return uf(31u) - uf(30u); }
float cov_height() { return uf(16u); }
float cov_y_offset() { return uf(17u); }
float depth_scale() { return uf(18u); }
float eff_height() { return cov_height() - 2.0 * cov_y_offset(); }
float cov_bottom() { return 1.0 - ((cov_height() - cov_y_offset()) / canvas_height()) * 2.0; }
`
