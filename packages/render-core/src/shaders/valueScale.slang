// A quantitative mark's value → canvas y: `scoreScale`'s normalizer, flipped
// so a bigger value sits higher. Only the scale lives here; each shape keeps
// its own anchor (ADR-097). `pointMark.slang` lifts the JS twin.
//! js-skip: valueToYPx — the linear case of valueToYPxScaled, whose twin pointMark.slang lifts; a shader reading it alone (the score example's scoreBarHeightPx) lifts the caller it sits inside
//! js-skip: insetValueYPx — its two consumers lift it under their own anchors, pointMark.slang as pointYPx and linkMark.slang as linkValuePx, and those are the spellings the painters and hit tests read; a third twin would be one nothing calls
module valueScale;

import scoreScale;

public float valueToYPxScaled(float value, float domainMin, float domainMax, float h, int scaleType, float symlogConstant) {
  return (1.0 - normalizeScore(value, domainMin, domainMax, scaleType, symlogConstant)) * h;
}

public float valueToYPx(float value, float domainMin, float domainMax, float h) {
  return valueToYPxScaled(value, domainMin, domainMax, h, 0, 1.0);
}

// The same scale over a range inset by `insetPx` at BOTH ends of the band, so
// an edge instance's glyph stays whole. Still only the scale: the result is px
// below the band's top, and the anchor is the caller's — `pointMark` adds its
// row's top, `linkMark` subtracts from `h` to measure up from the baseline.
// The clamp is what a band shorter than two insets needs: past `h * 0.5` the
// range would go negative and the scale would run backwards.
public float insetValueYPx(float value, float domainMin, float domainMax, float h, int scaleType, float insetPx, float symlogConstant) {
  float inset = min(insetPx, h * 0.5);
  return inset + valueToYPxScaled(value, domainMin, domainMax, h - 2.0 * inset, scaleType, symlogConstant);
}
