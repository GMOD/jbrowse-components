// The clip strip: 2 CSS px of red across the cut edge of a bar whose value
// the domain excludes, so a bar clamped to full height does not read as its
// value (ADR-183). Wiggle's xyplot, the coverage band and the `bar` shape each
// draw it as a second quad, or a pass, off the same instance, and their
// Canvas2D painters draw it off `clipSide`'s twin.
//! export-consts: CLIP_STRIP_PX, CLIP_STRIP_COLOR
//! js-export: clipSide
module clipStrip;

import scoreScale;

public static const float CLIP_STRIP_PX = 2.0;
// #c62828, packed ABGR as every instance color is: a red a shade darker than
// the coverage band's hard-clip triangles, which stand just above the strip.
public static const uint CLIP_STRIP_COLOR = 0xFF2828C6u;

// Which edge of the axis cut the bar: 1 the top, -1 the bottom, 0 neither. A
// log scale has no bottom to cut, since a value under its floor stands on the
// baseline as a bar of no height, which reads as what it is.
//
// The cut is measured with a tolerance of a hundred-thousandth of the domain:
// the coverage band rebuilds a depth as float32 relDepth times the region's
// peak, and a quantile that lands on an observed depth would otherwise strip
// on the backend whose rounding came out high and not on the other.
public int clipSide(float value, float domainMin, float domainMax, int scaleType) {
  float tolerance = (domainMax - domainMin) * 1e-5;
  if (value > domainMax + tolerance) {
    return 1;
  }
  if (value < domainMin - tolerance && scaleType != SCALE_TYPE_LOG) {
    return -1;
  }
  return 0;
}
