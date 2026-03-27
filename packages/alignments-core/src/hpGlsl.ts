// HP (High Precision) 64-bit float emulation for GPU rendering.
// Splits uint32 positions into hi/lo components using a 12-bit mask,
// then uses compiler guards (runtime infinity via 1.0/hpZero, max(-inf),
// dot()) to prevent GLSL optimizers from combining the split terms.
//
// Technique from genome-spy (MIT): https://github.com/genome-spy/genome-spy
//
// SYNC(hpWgsl.ts): GLSL and WGSL implementations must produce identical
// results for the same inputs.

// Parameterized versions — caller provides hpZero value
export const HP_GLSL_CORE = `
const uint HP_LOW_MASK = 0xFFFu;

vec2 hpSplitUint(uint value) {
  uint lo = value & HP_LOW_MASK;
  uint hi = value - lo;
  return vec2(float(hi), float(lo));
}

// WARNING: max(-inf) and dot() prevent the compiler from combining hi/lo split
// terms. Do not simplify.
float hpToClipX(vec2 splitPos, vec3 bpRange, float hpZero) {
  float inf = 1.0 / hpZero;
  float step = 2.0 / bpRange.z;
  float hi = max(splitPos.x - bpRange.x, -inf);
  float lo = max(splitPos.y - bpRange.y, -inf);
  return dot(vec3(-1.0, hi, lo), vec3(1.0, step, step));
}

// WARNING: same compiler guards as hpToClipX. Do not simplify.
float hpScaleLinear(vec2 splitPos, vec3 bpRange, float hpZero) {
  float inf = 1.0 / hpZero;
  float step = 1.0 / bpRange.z;
  float hi = max(splitPos.x - bpRange.x, -inf);
  float lo = max(splitPos.y - bpRange.y, -inf);
  return dot(vec2(hi, lo), vec2(step, step));
}
`

// Convenience version with standalone u_zero uniform for use in shaders that
// don't use a uniform block (e.g. alignments plugin)
export const HP_GLSL_WITH_UNIFORM = `
// WARNING: u_zero MUST be 0.0 at runtime. Produces runtime infinity (1.0/0.0)
// that prevents the compiler from combining hi/lo subtractions.
// A compile-time constant would be optimized away.
uniform float u_zero;

${HP_GLSL_CORE}

// Overloads that use the u_zero uniform directly
float hpToClipX(vec2 splitPos, vec3 bpRange) {
  return hpToClipX(splitPos, bpRange, u_zero);
}
float hpScaleLinear(vec2 splitPos, vec3 bpRange) {
  return hpScaleLinear(splitPos, bpRange, u_zero);
}
`
