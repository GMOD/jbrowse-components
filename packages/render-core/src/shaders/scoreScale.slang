// The score → [0,1] normalizer every score-scaled mark is placed and coloured
// by — wiggle, the coverage band, the bar and point shapes, their ramps — and
// the scale-type vocabulary its branches switch on. `makeScoreNormalizer`
// (render-core's scoreScale.ts) is its loop-hoisted twin.
//
// A domain with no range is a step: a score above its min maps to 1 and any
// other to 0, so a score above a pinned domain sits off the top everywhere.
//! export-consts: SCALE_TYPE_LOG, SCALE_TYPE_SYMLOG
//! js-export: normalizeScore
//! js-skip: symlogTransform — the JS twin (render-core scoreScale.ts) spells it Math.log1p, which is accurate near zero where the shader's log(1.0 + x) is not; a generated twin would be a faithful copy of the worse of the two. What both backends must agree on is normalizeScore, which is exported and swept by normalizeScoreParity.test.ts
module scoreScale;

// `ScaleTypeCode` in scoreScale.ts is these two and 0, for linear.
public static const int SCALE_TYPE_LOG = 1;
public static const int SCALE_TYPE_SYMLOG = 2;

public float symlogTransform(float x, float c) {
  return sign(x) * log(1.0 + abs(x / c));
}

public float normalizeScore(float score, float domainMin, float domainMax, int scaleType, float symlogConstant) {
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
  return clamp((t - tMin) / tRange, 0.0, 1.0);
}
