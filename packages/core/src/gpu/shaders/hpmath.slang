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

// `max(-inf)` and `dot()` exist to thwart the compiler — without them it
// collapses (hi_a+lo_a)-(hi_b+lo_b) into one large subtraction and the
// float32 precision the hi/lo split exists to preserve is gone. `hpZero` is
// a tiny CPU-supplied number; `-1/hpZero` is smaller than any real diff.
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

// Exact-as-possible bp offset from a split position to the viewport start
// stored in bpRange.xy. Subtracts the hi/lo components separately (same
// ordering as hpToClipX) so the result stays precise at high genomic
// coordinates — recombining bpStartHi+bpStartLo first would lose ~256bp near
// 3e9. Unlike hpToClipX this returns bp, not clip space.
public float hpViewportOffsetBp(float2 splitPos, float3 bpRange) {
  return (bpRange.x - splitPos.x) + (bpRange.y - splitPos.y);
}

public float snapToPixelX(float clipX, float canvasWidth) {
  float px = (clipX + 1.0) * 0.5 * canvasWidth;
  return floor(px + 0.5) / canvasWidth * 2.0 - 1.0;
}

public float yPxToClipY(float yPx, float canvasHeight) {
  return 1.0 - (yPx / canvasHeight) * 2.0;
}

// (cumBp - viewBp)/bpPerPx + pad == cumBp/bpPerPx + pad - offsetPx (LGV
// render position). Used by synteny + dotplot. Same hi/lo precision trick
// as hpToClipX — see comment there.
public float hpCornerScreenX(
  float bpHi, float bpLo,
  float originHi, float originLo,
  float bpPerPxInv, float pad, float hpZero,
) {
  float inf = 1.0 / hpZero;
  float hi = max(bpHi - originHi, -inf);
  float lo = max(bpLo - originLo, -inf);
  return dot(float2(hi, lo), float2(bpPerPxInv, bpPerPxInv)) + pad;
}

// vid%6: 0→(0,0)  1→(1,0)  2→(0,1)  3→(0,1)  4→(1,0)  5→(1,1)
public float2 quadLocal(uint vid) {
  uint v = vid % 6u;
  return float2(
    (v == 0u || v == 2u || v == 3u) ? 0.0 : 1.0,
    (v == 0u || v == 1u || v == 4u) ? 0.0 : 1.0
  );
}
