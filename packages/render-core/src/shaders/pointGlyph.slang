// Shared scatter-point glyph math for the wiggle and Manhattan renderers, whose
// point mode draws the same antialiased disc. Factored here so the disc SDF and
// the "small point → crisp square" / AA-pad thresholds can't drift between the
// two shaders (they previously redeclared identical consts with "must match"
// comments pointing at each other).
//
// Imported via `import pointGlyph;`. The CPU-side counterpart of
// SMALL_POINT_MAX_DIAMETER is SMALL_POINT_MAX_DIAMETER_PX in JS — keep them in
// sync.
module pointGlyph;

// 1px device pad around a disc so the smoothstep edge has room to fade without
// being clipped by the quad.
public static const float AA_PAD_PX = 1.0;

// At/below this diameter an AA disc reads as a muddy blob, so callers draw a
// crisp filled square instead. Must match SMALL_POINT_MAX_DIAMETER_PX in JS.
public static const float SMALL_POINT_MAX_DIAMETER = 3.0;

// Quad scale factor that grows the disc's bounding quad by AA_PAD_PX so its
// faded edge isn't clipped. localPos is scaled by the same factor so the disc
// boundary stays at distance 1 (see discAlpha). `max(radiusPx, 0.5)` keeps
// sub-pixel points from exploding the expansion.
public float discExpand(float radiusPx) {
  return (radiusPx + AA_PAD_PX) / max(radiusPx, 0.5);
}

// Screen-px position of quad corner `q` (each component 0 or 1) for the crisp
// small-point square, given the marker center and diameter in px. The square's
// top-left is snapped to the pixel grid (round-half-up) so its fill lands on
// whole pixels instead of AA-blurring across columns/rows — the square is
// SHAPE_SOLID with no fragment-side AA, so an unsnapped center reads as a fuzzy
// blob rather than a crisp square. Mirrors the Math.floor(v + 0.5) snap in the
// Canvas2D appendPointMarker so both backends land identical pixels.
public float2 crispSquareCornerPx(float2 centerPx, float diameterPx, float2 q) {
  float2 topLeft = floor(centerPx - diameterPx * 0.5 + 0.5);
  return topLeft + q * diameterPx;
}

// Disc SDF, positive inside. localPos is the expanded quad-local coord
// (-expand..expand); the disc boundary sits at distance 1, so the SDF is
// `1 - length`. Exposed separately for shaders that select between several
// glyph SDFs and take the AA derivative once afterwards — WGSL only allows
// derivatives in uniform control flow, so they can't call discAlpha inside a
// branch on a varying.
public float discCoverage(float2 localPos) {
  return 1.0 - length(localPos);
}

// Antialiased disc coverage → alpha. fwidth-based smoothstep gives a
// resolution-independent 1px fade. Only call from uniform control flow.
public float discAlpha(float2 localPos) {
  float coverage = discCoverage(localPos);
  float aa = fwidth(coverage);
  return smoothstep(-aa, aa, coverage);
}
