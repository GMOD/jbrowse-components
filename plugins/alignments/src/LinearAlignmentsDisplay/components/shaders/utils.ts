export function splitPositionWithFrac(value: number): [number, number] {
  const intValue = Math.floor(value)
  const frac = value - intValue
  const loInt = intValue & 0xfff
  const hi = intValue - loInt
  const lo = loInt + frac
  return [hi, lo]
}

export const HP_GLSL_FUNCTIONS = `
const uint HP_LOW_MASK = 0xFFFu;

// WARNING: u_zero MUST be 0.0 at runtime. Produces runtime infinity (1.0/0.0)
// that prevents the compiler from combining hi/lo subtractions.
// A compile-time constant would be optimized away.
// HP technique from genome-spy (MIT): https://github.com/genome-spy/genome-spy
uniform float u_zero;

vec2 hpSplitUint(uint value) {
  uint lo = value & HP_LOW_MASK;
  uint hi = value - lo;
  return vec2(float(hi), float(lo));
}

// WARNING: max(-inf) and dot() prevent the compiler from combining hi/lo split
// terms. Do not simplify.
float hpToClipX(vec2 splitPos, vec3 bpRange) {
  float inf = 1.0 / u_zero;
  float step = 2.0 / bpRange.z;
  float hi = max(splitPos.x - bpRange.x, -inf);
  float lo = max(splitPos.y - bpRange.y, -inf);
  return dot(vec3(-1.0, hi, lo), vec3(1.0, step, step));
}

// WARNING: same compiler guards as hpToClipX. Do not simplify.
float hpScaleLinear(vec2 splitPos, vec3 bpRange) {
  float inf = 1.0 / u_zero;
  float step = 1.0 / bpRange.z;
  float hi = max(splitPos.x - bpRange.x, -inf);
  float lo = max(splitPos.y - bpRange.y, -inf);
  return dot(vec2(hi, lo), vec2(step, step));
}
`
