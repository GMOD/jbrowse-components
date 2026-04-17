// Shared high-precision genome-coordinate math. HP technique from genome-spy
// (MIT): https://github.com/genome-spy/genome-spy
//
// Imported via `import hpmath;` from shaders that need sub-pixel-accurate
// conversion of base-pair positions to clip space when zoomed far in.
module hpmath;

public static const uint HP_LOW_MASK = 0xFFFu;

public float2 hpSplitUint(uint value) {
  uint lo = value & HP_LOW_MASK;
  uint hi = value - lo;
  return float2(float(hi), float(lo));
}

// WARNING: max(-inf) and dot() prevent the compiler from combining hi/lo
// split terms. Do not simplify.
public float hpToClipX(float2 splitPos, float3 bpRange, float hpZero) {
  float inf = 1.0 / hpZero;
  float step = 2.0 / bpRange.z;
  float hi = max(splitPos.x - bpRange.x, -inf);
  float lo = max(splitPos.y - bpRange.y, -inf);
  return dot(float3(-1.0, hi, lo), float3(1.0, step, step));
}

public float hpScaleLinear(float2 splitPos, float3 bpRange, float hpZero) {
  float inf = 1.0 / hpZero;
  float step = 1.0 / bpRange.z;
  float hi = max(splitPos.x - bpRange.x, -inf);
  float lo = max(splitPos.y - bpRange.y, -inf);
  return dot(float2(hi, lo), float2(step, step));
}

public float snapToPixelX(float clipX, float canvasWidth) {
  float px = (clipX + 1.0) * 0.5 * canvasWidth;
  return floor(px + 0.5) / canvasWidth * 2.0 - 1.0;
}
