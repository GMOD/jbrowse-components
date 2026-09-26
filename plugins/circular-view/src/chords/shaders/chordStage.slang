// The circle's polar stage for the marks drawn across it, and the curve they
// bow along. A foot is a position on the unrolled genome axis — every slice's
// bases laid end to end, a reversed slice counted backwards and an elided one at
// its middle — and the count of slice gaps before it. Its angle is affine in
// the two, so a zoom writes `radiansPerBp` and `gapRadians`, a rotation writes
// `offsetRadians`, and neither uploads a buffer.
//! js-export: chordTurn, ribbonEndPad, chordIsSpeck, ribbonThinFade
//! export-consts: MIN_RIBBON_END_PX
//! js-skip: footRadians — the stage's two-term scale, which chordStage.ts applies with the same two uniforms
module chordStage;

static const float TWO_PI = 6.283185307179586;
static const float PI = 3.141592653589793;

// The narrowest a ribbon end draws, in CSS px of arc, so a 5 kb alignment on a
// chromosome-scale circle keeps a sliver to see and to point at.
public static const float MIN_RIBBON_END_PX = 2.0;

public struct ChordStageUniforms {
  // the circle's centre in the canvas's CSS px frame
  public float centerX;
  public float centerY;
  public float canvasWidth;
  public float canvasHeight;
  // the stage's scale: radians per base of the unrolled axis, and per gap
  public float radiansPerBp;
  public float gapRadians;
  // the figure's rotation, clockwise from +x
  public float offsetRadians;
  // CSS px: where the feet sit, and how far toward the centre an antipodal
  // curve's control point reaches
  public float radiusPx;
  public float bezierRadiusPx;
  // the alpha every instance draws at, over its colour's own
  public float alpha;
  // a chord's stroke, CSS px
  public float strokeWidthPx;
  public float devicePixelRatio;
  // the least alpha the thin fade leaves a ribbon; 1 is no fade
  public float thinFadeFloor;
};

public float footRadians(float x, float gaps, float radiansPerBp, float gapRadians) {
  return x * radiansPerBp + gaps * gapRadians;
}

// The signed turn from `from` to `to` the short way round, in [-π, π).
public float chordTurn(float from, float to) {
  float t = to - from;
  return t - TWO_PI * floor((t + PI) / TWO_PI);
}

// How far from the centre a curve's control point sits. Scaled by the sine of
// half the short turn, which is the two ends' straight-line distance over the
// diameter: an antipodal pair bows to `bezierRadius`, and a pair a pixel apart
// stays at the rim rather than drawing a spoke to the middle and back.
public float chordControlRadius(float from, float to, float radius, float bezierRadius) {
  return radius - (radius - bezierRadius) * sin(abs(chordTurn(from, to)) * 0.5);
}

public float2 polarPoint(float radius, float radians) {
  return radius * float2(cos(radians), sin(radians));
}

public float2 chordControlPoint(float from, float to, float radius, float bezierRadius) {
  return polarPoint(chordControlRadius(from, to, radius, bezierRadius),
                    from + chordTurn(from, to) * 0.5);
}

public float2 quadBezier(float2 p0, float2 c, float2 p1, float t) {
  float s = 1.0 - t;
  return s * s * p0 + 2.0 * s * t * c + t * t * p1;
}

public float2 quadBezierTangent(float2 p0, float2 c, float2 p1, float t) {
  return 2.0 * (1.0 - t) * (c - p0) + 2.0 * t * (p1 - c);
}

// How far each side of a ribbon end grows so the end spans at least
// `minWidthPx` of arc at `radius`, about where it sits. An elided slice places
// both of an end's bases at its middle, and this keeps a ribbon into it drawn.
public float ribbonEndPad(float a, float b, float radius, float minWidthPx) {
  return max(0.0, minWidthPx / max(radius, 1.0) - abs(b - a)) * 0.5;
}

// The alpha a ribbon keeps under the thin fade: its two ends' true width over
// the width they draw at once floored to `minEndPx`, so a thousand sub-pixel
// alignments over one pixel add up to the ink they cover rather than to a
// solid band, and never under `floor`, so a lone one stays findable.
public float ribbonThinFade(float anchorPx, float matePx, float minEndPx, float floor) {
  float drawn = max(anchorPx, minEndPx) + max(matePx, minEndPx);
  return clamp((anchorPx + matePx) / drawn, floor, 1.0);
}

// Two chord ends under a pixel apart: every deletion and insertion of a
// whole-genome callset, and an antialiased speck on the rim under the ideogram.
public bool chordIsSpeck(float a, float b, float radius) {
  return abs(chordTurn(a, b)) * radius < 1.0;
}
