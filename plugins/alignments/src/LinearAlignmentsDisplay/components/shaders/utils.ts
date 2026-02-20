/**
 * Split a position including its fractional part for smooth scrolling.
 *
 * Same as splitPosition but preserves the fractional component in the low part.
 * This is critical for the region start position - without preserving fractional
 * precision, scrolling appears jerky as reads "stick" at integer bp boundaries
 * and then snap to new positions.
 *
 * Used for the region start which can have sub-bp scroll offsets.
 */
export function splitPositionWithFrac(value: number): [number, number] {
  const intValue = Math.floor(value)
  const frac = value - intValue
  const loInt = intValue & 0xfff
  const hi = intValue - loInt
  const lo = loInt + frac
  return [hi, lo]
}

/**
 * High-precision GLSL functions for genomic coordinates.
 * Inspired by genome-spy (https://github.com/genome-spy/genome-spy)
 *
 * The 12-bit split approach:
 * - Split 32-bit position into high bits (multiples of 4096) and low bits (0-4095)
 * - Each part has fewer significant digits, reducing Float32 rounding errors
 * - Subtract bpRange high/low parts separately, then combine
 * - This preserves precision even for positions like 200,000,000 bp
 *
 * Note: bpRange.y (low part) may include a fractional component for smooth scrolling.
 * Read positions are integers, but the domain start can have sub-bp precision.
 */
export const HP_GLSL_FUNCTIONS = `
const uint HP_LOW_MASK = 0xFFFu;

// WARNING: u_zero MUST be set to 0.0 at runtime. It is used to produce a
// runtime infinity (1.0/u_zero) that prevents the shader compiler from
// algebraically combining the hi/lo subtractions, which would defeat the
// float32 precision workaround. Technique from genome-spy. A compile-time
// constant would be optimized away; only a runtime uniform works.
uniform float u_zero;

vec2 hpSplitUint(uint value) {
  uint lo = value & HP_LOW_MASK;
  uint hi = value - lo;
  return vec2(float(hi), float(lo));
}

// WARNING: hpToClipX uses max(-inf) and dot() to prevent the shader compiler
// from defeating the float32 precision workaround. Without these guards the
// compiler can legally transform (splitHi - domHi) + (splitLo - domLo) into
// (split - dom) on the recombined large values, causing visible pixel snapping
// at large genomic positions. Do not simplify this arithmetic.
float hpToClipX(vec2 splitPos, vec3 bpRange) {
  float inf = 1.0 / u_zero;
  float step = 2.0 / bpRange.z;
  float hi = max(splitPos.x - bpRange.x, -inf);
  float lo = max(splitPos.y - bpRange.y, -inf);
  return dot(vec3(-1.0, hi, lo), vec3(1.0, step, step));
}

// WARNING: hpScaleLinear uses the same compiler guards as hpToClipX.
// See hpToClipX comment above. Do not simplify this arithmetic.
float hpScaleLinear(vec2 splitPos, vec3 bpRange) {
  float inf = 1.0 / u_zero;
  float step = 1.0 / bpRange.z;
  float hi = max(splitPos.x - bpRange.x, -inf);
  float lo = max(splitPos.y - bpRange.y, -inf);
  return dot(vec2(hi, lo), vec2(step, step));
}
`
