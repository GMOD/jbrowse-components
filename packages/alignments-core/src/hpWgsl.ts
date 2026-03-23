// HP (High Precision) 64-bit float emulation for WebGPU rendering.
// SYNC(hpGlsl.ts): WGSL and GLSL implementations must produce identical
// results for the same inputs.

// Parameterized versions — caller provides hp_zero value
export const HP_WGSL_CORE = `
const HP_LOW_MASK: u32 = 0xFFFu;

fn hp_split_uint(value: u32) -> vec2f {
  let lo = value & HP_LOW_MASK;
  let hi = value - lo;
  return vec2f(f32(hi), f32(lo));
}

// WARNING: max(-inf) and dot() prevent the compiler from combining hi/lo split
// terms. Do not simplify.
// HP technique from genome-spy (MIT): https://github.com/genome-spy/genome-spy
fn hp_to_clip_x(split_pos: vec2f, bp_range: vec3f, hp_zero: f32) -> f32 {
  let inf = 1.0 / hp_zero;
  let step = 2.0 / bp_range.z;
  let hi = max(split_pos.x - bp_range.x, -inf);
  let lo = max(split_pos.y - bp_range.y, -inf);
  return dot(vec3f(-1.0, hi, lo), vec3f(1.0, step, step));
}

// WARNING: same compiler guards as hp_to_clip_x. Do not simplify.
fn hp_scale_linear(split_pos: vec2f, bp_range: vec3f, hp_zero: f32) -> f32 {
  let inf = 1.0 / hp_zero;
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
