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

import antialias;
import hpmath;

// 1px device pad around a disc so the ramped edge has room to fade without
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

// The same corner in clip space, for a marker whose centre arrives as a clip x
// and a screen y — which is how both callers hold it, since x comes off the hp
// bp conversion and y off a score scale.
//
// The round trip is the point: the snap has to happen in px, so the caller
// converts out and back, and doing that in each of the two shaders is two
// chances to convert one of the four edges differently. `viewportWidth` and
// `canvasHeight` are whatever spans clip [-1,1] covers for the caller.
public float4 crispSquareCornerClip(
  float centerClipX, float centerYPx, float diameterPx, float2 q,
  float viewportWidth, float canvasHeight
) {
  float2 centerPx = float2(clipXToPx(centerClipX, viewportWidth), centerYPx);
  float2 vPx = crispSquareCornerPx(centerPx, diameterPx, q);
  return float4(pxToClipX(vPx.x, viewportWidth),
                yPxToClipY(vPx.y, canvasHeight), 0.0, 1.0);
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

// Antialiased disc coverage → alpha, for callers that draw only a disc and can
// take the derivative inline. Only call from uniform control flow.
public float discAlpha(float2 localPos) {
  return glyphEdgeAlpha(discCoverage(localPos));
}
