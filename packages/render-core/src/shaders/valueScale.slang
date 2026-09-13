// A quantitative mark's value → canvas y: `scoreScale`'s normalizer, flipped
// so a bigger value sits higher. Only the scale lives here; each shape keeps
// its own anchor (ADR-097). `pointMark.slang` lifts the JS twin.
//! js-skip: valueToYPx — the linear case of valueToYPxScaled, whose twin pointMark.slang lifts; a shader reading it alone (the score example's scoreBarHeightPx) lifts the caller it sits inside
module valueScale;

import scoreScale;

public float valueToYPxScaled(float value, float domainMin, float domainMax, float h, int scaleType) {
  return (1.0 - normalizeScore(value, domainMin, domainMax, scaleType, 1.0)) * h;
}

public float valueToYPx(float value, float domainMin, float domainMax, float h) {
  return valueToYPxScaled(value, domainMin, domainMax, h, 0);
}
