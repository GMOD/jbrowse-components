// High-precision (HP) position splitting for genome-scale coordinates.
// Splits a float into hi/lo components so that subtracting large bp positions
// from a viewport origin doesn't lose precision in 32-bit floats.
// HP technique from genome-spy (MIT): https://github.com/genome-spy/genome-spy

// WGSL core HP functions, shared by all WebGPU shaders that need
// genome-coordinate → clip-space conversion
export const HP_WGSL_CORE = `
const HP_LOW_MASK: u32 = 0xFFFu;

fn hp_split_uint(value: u32) -> vec2f {
  let lo = value & HP_LOW_MASK;
  let hi = value - lo;
  return vec2f(f32(hi), f32(lo));
}

// zero MUST be 0.0 at runtime — prevents the compiler from combining hi/lo
// subtractions. A compile-time constant would be optimized away.
// max(-inf) and dot() guard against the compiler merging the split terms.
fn hp_to_clip_x(split_pos: vec2f, bp_range: vec3f, zero: f32) -> f32 {
  let inf = 1.0 / zero;
  let step = 2.0 / bp_range.z;
  let hi = max(split_pos.x - bp_range.x, -inf);
  let lo = max(split_pos.y - bp_range.y, -inf);
  return dot(vec3f(-1.0, hi, lo), vec3f(1.0, step, step));
}
`

// GLSL ES 3.00 core HP functions, shared by all WebGL2 shaders that need
// genome-coordinate → clip-space conversion.
// Declares uniform float u_zero — callers must set it to 0.0 each frame.
export const HP_GLSL_CORE = `
const uint HP_LOW_MASK = 0xFFFu;

// WARNING: u_zero MUST be 0.0 at runtime. Produces runtime infinity (1.0/0.0)
// that prevents the compiler from combining hi/lo subtractions.
// A compile-time constant would be optimized away.
uniform float u_zero;

vec2 hp_split_uint(uint value) {
  uint lo = value & HP_LOW_MASK;
  uint hi = value - lo;
  return vec2(float(hi), float(lo));
}

// WARNING: max(-inf) and dot() prevent the compiler from combining hi/lo split
// terms. Do not simplify.
float hp_to_clip_x(vec2 split_pos, vec3 bp_range) {
  float inf = 1.0 / u_zero;
  float step = 2.0 / bp_range.z;
  float hi = max(split_pos.x - bp_range.x, -inf);
  float lo = max(split_pos.y - bp_range.y, -inf);
  return dot(vec3(-1.0, hi, lo), vec3(1.0, step, step));
}
`
