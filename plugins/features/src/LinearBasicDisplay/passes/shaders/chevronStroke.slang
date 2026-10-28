// The open ">" of the intron chevron and the continuation marker, stroked as
// their Canvas2D painters stroke the path base -> apex -> base: butt caps at
// the two base ends and a miter at the apex.
//
// One triangle holds the stroke. Its sides are the arms' outer edges pushed out
// by the ramp's reach, so they meet on the axis at the padded miter, and its
// base sits behind both padded caps. A fragment measures against the arm on its
// own side of the axis, extended past the apex to the other arm's outer edge,
// which is exactly the mitred stroke; no fragment blends both arms, so a
// translucent color is not doubled where they meet.
//
// Measuring one arm costs what one butt segment does, and leaves the inside of
// the apex light at dpr 1: there the ramp is as wide as the stroke, and a
// pixel the two arms cover together reads as one arm's share of it.
//
// Coordinates are CSS px from the apex, x pointing the way the glyph points and
// y across its axis. `lengthPx` is the run from base to apex, `halfHeightPx`
// each base end's distance from the axis.
//! js-export: chevronCornerPx, armLocalPx, armCoverage
module chevronStroke;

import antialias;

// Canvas2D's default `miterLimit`. Past it Canvas2D bevels the apex, where this
// triangle cuts the miter off at the limit; a marker reaches it only on a box
// under 1.3 px tall.
static const float MITER_LIMIT = 10.0;

// Corner 0 is the padded miter on the axis, 1 and 2 the base corners either
// side of it.
public float2 chevronCornerPx(
  uint corner, float lengthPx, float halfHeightPx, float halfWidthPx, float dpr
) {
  float aa = aaHalfPx(dpr);
  float reach = halfWidthPx + aa;
  float armPx = sqrt(lengthPx * lengthPx + halfHeightPx * halfHeightPx);
  if (corner == 0u) {
    return float2(reach * armPx / max(halfHeightPx, armPx / MITER_LIMIT), 0.0);
  }
  float baseX = -lengthPx - (aa * lengthPx + reach * halfHeightPx) / armPx;
  float baseY = (reach * armPx - baseX * halfHeightPx) / lengthPx;
  return float2(baseX, corner == 1u ? baseY : -baseY);
}

// (across, along) for the arm on +y: across its centre line, positive away from
// the inside of the ">", and along it from the base end, reaching `armPx` at the
// apex. The arm on -y is this at -y.
public float2 armLocalPx(
  float xPx, float yPx, float lengthPx, float halfHeightPx
) {
  float armPx = sqrt(lengthPx * lengthPx + halfHeightPx * halfHeightPx);
  return float2(
    (xPx * halfHeightPx + yPx * lengthPx) / armPx,
    (xPx * lengthPx - yPx * halfHeightPx) / armPx + armPx);
}

// `buttSegmentCoverage` with the apex cap swapped for the miter's far side, the
// other arm's outer edge: `otherAcrossPx` is that arm's `across`. The base cap
// and the miter never bind together, so one ramp over the nearer serves both.
public float armCoverage(
  float acrossPx, float alongPx, float otherAcrossPx, float halfWidthPx,
  float dpr
) {
  return strokeCoverage(halfWidthPx, abs(acrossPx), dpr)
       * edgeCoverage(min(alongPx, halfWidthPx - otherAcrossPx), dpr);
}

public struct ChevronCorner {
  public float2 offsetPx;
  // `armLocalPx` of the arm on +y, then of the arm on -y.
  public float4 local;
};

public ChevronCorner chevronCorner(
  uint corner, float lengthPx, float halfHeightPx, float halfWidthPx, float dpr
) {
  ChevronCorner c;
  c.offsetPx =
    chevronCornerPx(corner, lengthPx, halfHeightPx, halfWidthPx, dpr);
  c.local = float4(
    armLocalPx(c.offsetPx.x, c.offsetPx.y, lengthPx, halfHeightPx),
    armLocalPx(c.offsetPx.x, -c.offsetPx.y, lengthPx, halfHeightPx));
  return c;
}

// The two across terms differ by 2y * lengthPx / armPx, so the larger one names
// the arm on the fragment's side of the axis.
public float chevronCoverage(float4 local, float halfWidthPx, float dpr) {
  float2 arm = local.x > local.z ? local.xy : local.zw;
  return armCoverage(
    arm.x, arm.y, min(local.x, local.z), halfWidthPx, dpr);
}
