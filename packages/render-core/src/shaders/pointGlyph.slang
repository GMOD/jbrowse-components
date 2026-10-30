// Shared scatter-point glyph math for the wiggle and Manhattan renderers, whose
// point mode draws the same antialiased disc. Factored here so the disc SDF and
// the "small point → crisp square" / AA-pad thresholds can't drift between the
// two shaders (they previously redeclared identical consts with "must match"
// comments pointing at each other).
//
// The CPU side keeps no copy of either the threshold or the snap:
// `export-consts` emits the constant and `js-export` emits the snap, both
// consumed by `pointMarker.ts` (adr-051).
//! export-consts: SMALL_POINT_MAX_DIAMETER
//! js-export: crispSquareTopLeftPx, discExpand, glyphExpand
module pointGlyph;

import antialias;
import hpmath;

// A disc's edge is ramped by `glyphEdgeAlpha`, whose width is one OUTPUT pixel
// measured in the SDF's own units — so in CSS px the ramp reaches `aaHalfPx`
// past the boundary and the quad has to grow by exactly that.

// At/below this diameter an AA disc reads as a muddy blob, so callers draw a
// crisp filled square instead.
public static const float SMALL_POINT_MAX_DIAMETER = 3.0;

// Below this the glyph is smaller than the pad it is asking for; the floor is
// only there so a radius of 0 cannot divide.
static const float MIN_GLYPH_RADIUS_PX = 1e-3;

// Quad scale factor that grows a glyph's bounding quad past its own half extent
// `unitPx` so the faded edge isn't clipped. localPos is scaled by the same
// factor, so the glyph boundary stays at distance 1 (see discAlpha) and the
// quad's half extent comes out at `unitPx + reaches * aaHalfPx(dpr)` px.
//
// `reaches` is how far past the boundary the SDF still inks where the quad
// binds, in ramp reaches. One wherever the boundary the quad touches is a
// single facet, more wherever two facets miter — see pointMark.slang's table.
//
// Clamping the DIVISOR instead under-pads every extent below the clamp, because
// the caller scales by the unclamped one. `pointGlyphPad.test.ts` holds each
// glyph's pad to its reach at the sub-pixel radii a diamond or a triangle
// reaches.
public float glyphExpand(float unitPx, float reaches, float dpr) {
  return 1.0 + reaches * aaHalfPx(dpr) / max(unitPx, MIN_GLYPH_RADIUS_PX);
}

public float discExpand(float radiusPx, float dpr) {
  return glyphExpand(radiusPx, 1.0, dpr);
}

// Top-left of the small-point square on one axis, on the CSS px grid. Per-axis
// and scalar so `//! js-export` can lift it: Canvas2D's `appendPointMarker`
// calls this for x and y rather than re-deriving the snap (adr-051).
public float crispSquareTopLeftPx(float centerPx, float diameterPx) {
  return floor(centerPx - diameterPx * 0.5 + 0.5);
}

// The share of the output pixel at `p` that `box` (left, top, right, bottom,
// CSS px) covers.
public float boxInkCoverage(float2 p, float4 box, float dpr) {
  return slabCoverage(p.x - box.x, p.x - box.z, dpr)
       * slabCoverage(p.y - box.y, p.y - box.w, dpr);
}

// Corner `q` of the small-point square's quad, grown an output pixel past the
// box so `boxInkCoverage` ramps its fractional edges at any sample count, as
// the Canvas2D painter's antialiased `rect` does. `centerX` is in the
// viewport's px, both callers' x coming off the hp bp conversion.
public struct CrispSquareCorner {
  public float2 px;
  public float4 box;
};

public CrispSquareCorner crispSquareCorner(
  float2 centerPx, float diameterPx, float2 q, float dpr
) {
  float left = crispSquareTopLeftPx(centerPx.x, diameterPx);
  float top = crispSquareTopLeftPx(centerPx.y, diameterPx);
  float pad = aaPx(dpr);
  CrispSquareCorner c;
  c.box = float4(left, top, left + diameterPx, top + diameterPx);
  c.px = lerp(float2(left, top) - pad, float2(left, top) + diameterPx + pad, q);
  return c;
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
