/**
 * Split a position including its fractional part for smooth scrolling.
 *
 * Same as splitPosition but preserves the fractional component in the low part.
 * This is critical for the domain start position - without preserving fractional
 * precision, scrolling appears jerky as reads "stick" at integer bp boundaries
 * and then snap to new positions.
 *
 * Used for domain start which can have sub-bp scroll offsets.
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
 * - Subtract domain high/low parts separately, then combine
 * - This preserves precision even for positions like 200,000,000 bp
 *
 * Note: domain.y (low part) may include a fractional component for smooth scrolling.
 * Read positions are integers, but the domain start can have sub-bp precision.
 */
export const HP_GLSL_FUNCTIONS = `
// High-precision constants (12-bit split)
const uint HP_LOW_MASK = 0xFFFu;  // 4095 - mask for low 12 bits
const float HP_LOW_DIVISOR = 4096.0;

// Split a uint into high and low parts for precision
// High part is multiple of 4096, low part is 0-4095
vec2 hpSplitUint(uint value) {
  uint lo = value & HP_LOW_MASK;
  uint hi = value - lo;
  return vec2(float(hi), float(lo));
}

// Calculate normalized position (0-1) from split position and domain
// domain.xy = [domainStartHi, domainStartLo], domain.z = domainExtent
float hpScaleLinear(vec2 splitPos, vec3 domain) {
  float hi = splitPos.x - domain.x;  // High parts subtracted (similar magnitude)
  float lo = splitPos.y - domain.y;  // Low parts subtracted (both 0-4095)
  return (hi + lo) / domain.z;       // Combine and normalize
}

// Calculate clip-space X from split position and domain
float hpToClipX(vec2 splitPos, vec3 domain) {
  return hpScaleLinear(splitPos, domain) * 2.0 - 1.0;
}
`
