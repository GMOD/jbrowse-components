// The score → [0,1] normalizer every score-scaled mark is placed and coloured
// by — wiggle, the coverage band, the bar and point shapes, their ramps — and
// the scale-type vocabulary its branches switch on. `makeScoreNormalizer`
// (render-core's scoreScale.ts) is its loop-hoisted twin.
//
// A domain with no range is a step: a score above its min maps to 1 and any
// other to 0, so a score above a pinned domain sits off the top everywhere.
//! export-consts: SCALE_TYPE_LOG, SCALE_TYPE_SYMLOG
//! js-export: normalizeScore, normalizeScoreUnclamped
//! js-skip: log1pf — JS has Math.log1p, so a twin of this would be the float32 workaround spelled out where the language already answers it
//! js-skip: symlogTransform — render-core scoreScale.ts reaches Math.log1p directly, one call inside a normalizer it hoists the whole log domain out of, so a per-call twin of this would have no caller. What both backends must agree on is normalizeScore, which is exported and swept by normalizeScoreParity.test.ts
module scoreScale;

// `ScaleTypeCode` in scoreScale.ts is these two and 0, for linear.
public static const int SCALE_TYPE_LOG = 1;
public static const int SCALE_TYPE_SYMLOG = 2;

// log(1 + x) for x that `1.0 + x` rounds away: a symlog domain narrower than
// its constant lands entirely in that region, and in float32 the rounding
// survives the normalize's divide by a tiny domain range — 0.2px of a 40px row
// on domain [-1, 0.75] with constant 100.5, against the Canvas2D twin's
// Math.log1p. Kahan's identity: `u - 1.0` is exact where `u` is near 1, so the
// ratio is the correction the sum lost.
float log1pf(float x) {
  float u = 1.0 + x;
  return u == 1.0 ? x : log(u) * (x / (u - 1.0));
}

public float symlogTransform(float x, float c) {
  return sign(x) * log1pf(abs(x / c));
}

// The fraction a score sits at, extrapolated past either end rather than
// clamped, so a value outside the domain keeps its order against every other
// one. A threshold cut is placed through this: a cut the domain excludes then
// lands off the plot, instead of tying with the scores clamped to the edge it
// would sit on and reading as crossed.
public float normalizeScoreUnclamped(float score, float domainMin, float domainMax, int scaleType, float symlogConstant) {
  float t = score;
  float tMin = domainMin;
  float tMax = domainMax;
  if (scaleType == SCALE_TYPE_SYMLOG) {
    t = symlogTransform(score, symlogConstant);
    tMin = symlogTransform(domainMin, symlogConstant);
    tMax = symlogTransform(domainMax, symlogConstant);
  } else if (scaleType == SCALE_TYPE_LOG) {
    // The domain's own min, so a domain entirely below 1 still spreads.
    float floorV = domainMin > 0.0 ? domainMin : 1.0;
    t = log2(max(score, floorV));
    tMin = log2(floorV);
    tMax = log2(max(domainMax, floorV));
  }
  float tRange = tMax - tMin;
  if (tRange <= 0.0) {
    return t > tMin ? 1.0 : 0.0;
  }
  return (t - tMin) / tRange;
}

public float normalizeScore(float score, float domainMin, float domainMax, int scaleType, float symlogConstant) {
  return clamp(normalizeScoreUnclamped(score, domainMin, domainMax, scaleType, symlogConstant), 0.0, 1.0);
}
