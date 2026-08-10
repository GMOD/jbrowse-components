// Shared scatter-point glyph math for the wiggle and Manhattan renderers, whose
// point mode draws the same antialiased disc. Factored here so the disc SDF and
// the "small point → crisp square" / AA-pad thresholds can't drift between the
// two shaders (they previously redeclared identical consts with "must match"
// comments pointing at each other).
//
// Imported via `import pointGlyph;`. The CPU side no longer keeps its own copy
// of either the threshold or the snap: `export-consts` emits the constant and
// `js-export` emits the snap, both consumed by `pointMarker.ts` (adr-051).
//! export-consts: SMALL_POINT_MAX_DIAMETER, AA_PAD_PX
//! js-export: crispSquareTopLeftPx
//! js-skip: discExpand — expands a quad so the fragment AA ramp is not clipped; Canvas2D draws ctx.arc and has no quad to expand
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

// Pixel-grid-snapped top-left of the crisp small-point square, on one axis. The
// snap (round-half-up) is what makes the square's fill land on whole pixels
// instead of AA-blurring across columns/rows — it is SHAPE_SOLID with no
// fragment-side AA, so an unsnapped center reads as a fuzzy blob.
//
// Per-axis and scalar so `//! js-export` can lift it: Canvas2D's
// `appendPointMarker` calls this for x and y rather than re-deriving the snap
// (adr-051). The float2 wrapper below keeps the shader's call site unchanged.
public float crispSquareTopLeftPx(float centerPx, float diameterPx) {
  return floor(centerPx - diameterPx * 0.5 + 0.5);
}

// Screen-px position of quad corner `q` (each component 0 or 1) for the crisp
// small-point square, given the marker center and diameter in px.
public float2 crispSquareCornerPx(float2 centerPx, float diameterPx, float2 q) {
  float2 topLeft = float2(
    crispSquareTopLeftPx(centerPx.x, diameterPx),
    crispSquareTopLeftPx(centerPx.y, diameterPx)
  );
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

// One OUTPUT pixel of antialiasing on a glyph SDF's edge, whatever units that
// SDF is in. `coverage` is positive inside and zero on the edge.
//
// The ramp's width cannot be a constant here, the way it can for an SDF already
// measured in pixels (compare syntenyTypes.slang's `aaHalfPx` and
// dotplot.slang's `aaHalf`). These SDFs are in quad-local units, and the
// conversion to pixels is the SDF's own gradient — which differs per shape. The
// disc and the triangle carry unit gradients; the diamond's does not, because
// `1 - (|x| + |y|)` is the L1 norm and so sqrt(2) times the true perpendicular
// distance to the edge. Measuring the gradient covers all three with no
// per-shape constant, and covers the next shape for free.
//
// `length(ddx, ddy)` is the true gradient magnitude per DEVICE pixel, so it IS
// the coverage-space width of one output pixel and the ramp is exactly that
// wide. Two things it is not:
//
//   - not `fwidth`, which is |ddx| + |ddy| and overshoots a true gradient by up
//     to sqrt(2) on diagonals. Around a disc that is a fade whose width varies
//     with position on its own circumference.
//   - not used as the smoothstep's HALF-width, which doubled it again. Between
//     them the ramp spanned 2 to 2.83 output pixels instead of 1, which is why
//     these glyphs read soft, and it reached further out than the quad has room
//     for: `discExpand` leaves AA_PAD_PX = 1 CSS px, and at dpr 1 the old ramp
//     wanted sqrt(2) of them on the diagonals. So the fade was also clipped,
//     precisely where it was widest.
//
// The floor is for SHAPE_BAR, whose SDF is the constant 1: zero gradient, so
// without it the ramp is zero-wide and the smoothstep is 0/0. A degenerate ramp
// there saturates to alpha 1, which is the solid fill that shape wants.
//
// Takes derivatives, so uniform control flow only. That is exactly why
// discCoverage is exposed apart from discAlpha: a caller selecting between
// several SDFs picks its coverage in a branch, then calls this once after it.
public float glyphEdgeAlpha(float coverage) {
  float halfRamp =
    0.5 * max(length(float2(ddx(coverage), ddy(coverage))), 1e-5);
  return smoothstep(-halfRamp, halfRamp, coverage);
}

// Antialiased disc coverage → alpha, for callers that draw only a disc and can
// take the derivative inline. Only call from uniform control flow.
public float discAlpha(float2 localPos) {
  return glyphEdgeAlpha(discCoverage(localPos));
}
