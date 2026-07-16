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

// Snap a thin glyph's screen-y to a pixel center before converting to clip
// space. Shared by arrow/line/chevron so the centering convention lives in one
// place; rect uses pixel-edge snapping instead (solid fills need exact edges).
public float snapPixelCenterY(float yScreen, float scrollY, float canvasHeight) {
  float yPx = floor(yScreen - scrollY + 0.5) + 0.5;
  return yPxToClipY(yPx, canvasHeight);
}

// Center a thin glyph on the *drawn* middle row of the box it annotates, given
// the box's real center `centerY` and height `heightPx`. The box is rasterized
// with the rect shader's edge snapping (top = floor(top+0.5), height =
// floor(h+0.5)); reproducing that here lands the line/chevron exactly on the
// box's center row for odd pixel heights (superCompact) instead of the ~1px
// bias plain `snapPixelCenterY(centerY)` gives, and stays consistent (just
// below the seam) for even heights — where a 1px line can't sit dead-center.
public float snapBoxCenterY(
  float centerY, float heightPx, float scrollY, float canvasHeight
) {
  float topPx = floor(centerY - heightPx * 0.5 - scrollY + 0.5);
  float hPx = floor(heightPx + 0.5);
  float yPx = topPx + floor(hPx * 0.5) + 0.5;
  return yPxToClipY(yPx, canvasHeight);
}

// Extend the free edge `x2` away from the anchor `x1` so the span is at least
// `minWidthPx` CSS px wide, returning the new x2. Sub-pixel-narrow features (a
// 1bp rect, a zoomed-out coverage bin) still paint instead of vanishing.
//
// Orientation-preserving on purpose: reversal is baked into bpRangeX (negated
// length), so x2 < x1 on reversed blocks and the span must grow in the sign
// direction of dx. Widening toward +x would flip the quad on reversed regions.
// Contrast `expandMinWidthX` in alignmentsUniforms, which expands about the
// midpoint (both edges move) — that one is for spans with no anchored edge.
public float extendToMinWidthX(
  float x1, float x2, float minWidthPx, float canvasWidth
) {
  float minClipW = minWidthPx * 2.0 / canvasWidth;
  float dx = x2 - x1;
  return abs(dx) < minClipW ? x1 + (dx < 0.0 ? -minClipW : minClipW) : x2;
}

// vid%6: 0→(0,0)  1→(1,0)  2→(0,1)  3→(0,1)  4→(1,0)  5→(1,1)
public float2 quadLocal(uint vid) {
  uint v = vid % 6u;
  return float2(
    (v == 0u || v == 2u || v == 3u) ? 0.0 : 1.0,
    (v == 0u || v == 1u || v == 4u) ? 0.0 : 1.0
  );
}
