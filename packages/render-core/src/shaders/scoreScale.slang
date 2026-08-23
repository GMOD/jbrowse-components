// The score → [0,1] normalizer every score-scaled track is placed by, and the
// scale-type vocabulary its branches switch on.
//
// Two real consumers with non-obvious math, which is ADR-040's bar: the wiggle
// renderer's four modes (`wiggleCommon.slang`, via `scoreToY`) and the coverage
// band's depth axis (`coverageBand.slang`, via `normalizeDepthScalar`). They
// carried a branch-for-branch copy each, and the copies did not agree: the
// coverage one compared `scaleType` against bare 2 and 1 rather than the
// constants below, and answered 0 on a degenerate domain where wiggle's divided
// by a 1e-6 floor and saturated. This module is one answer to both.
//
// The degenerate domain answers 0, which is what the JS twin
// (`makeScoreNormalizer`, packages/wiggle-core/src/normalize.ts) has always
// answered. Returning 0 avoids the NaN the 1e-6 floor was there for just as
// well, so the divergence bought nothing and cost a documented exception.
//
// `SCALE_TYPE_LINEAR` is deliberately absent: it is "neither of these", and a
// third constant would be a value nothing compares against.
//! js-export: normalizeScore
//! js-skip: symlogTransform — the JS twin (wiggle-core normalize.ts) spells it Math.log1p, which is accurate near zero where the shader's log(1.0 + x) is not; a generated twin would be a faithful copy of the worse of the two. What both backends must agree on is normalizeScore, which is exported and swept by normalizeScoreParity.test.ts
module scoreScale;

// The values the `scaleType` uniform is compared against. Emitted into
// @jbrowse/wiggle-core through `wiggleCommon.slang`'s `export-consts` — the
// constant evaluator resolves through imports, and wiggle-core is where
// `WiggleScaleType` is declared, so the numbers stay next to the type they
// name rather than next to the module that happens to author them.
public static const int SCALE_TYPE_LOG = 1;
public static const int SCALE_TYPE_SYMLOG = 2;

public float symlogTransform(float x, float c) {
  return sign(x) * log(1.0 + abs(x / c));
}

public float normalizeScore(float score, float domainMin, float domainMax, int scaleType, float symlogConstant) {
  if (scaleType == SCALE_TYPE_SYMLOG) {
    // Defined at and either side of zero, so unlike the log branch there is
    // nothing to floor: the domain arrives as-is and 0 lands where it belongs
    // instead of on the baseline with everything else below the floor. On a
    // coverage band that is the whole reason symlog is offered — a depth of 0
    // is real, common, and what log cannot separate from a depth of 1.
    float tMin = symlogTransform(domainMin, symlogConstant);
    float tMax = symlogTransform(domainMax, symlogConstant);
    float tRange = tMax - tMin;
    if (tRange <= 0.0) { return 0.0; }
    float t = symlogTransform(score, symlogConstant);
    return clamp((t - tMin) / tRange, 0.0, 1.0);
  }
  if (scaleType == SCALE_TYPE_LOG) {
    // Floor at the domain's own min, not at 1, so a domain sitting entirely
    // below 1 (mappability, a methylation fraction, any normalized ratio) still
    // has a range to spread over instead of collapsing to a flat baseline. Same
    // rule and same reasoning as JS `makeScoreNormalizer`, which keeps its own
    // hand-written copy because it hoists this arithmetic out of a per-feature
    // loop — so this one is `//! js-export`ed as the ORACLE the two are swept
    // against (`normalizeScoreParity.test.ts`), not to retire it.
    float floorV = domainMin > 0.0 ? domainMin : 1.0;
    float logMin = log2(floorV);
    float logMax = log2(max(domainMax, floorV));
    float logRange = logMax - logMin;
    if (logRange <= 0.0) { return 0.0; }
    float logScore = log2(max(score, floorV));
    return clamp((logScore - logMin) / logRange, 0.0, 1.0);
  }
  float range = domainMax - domainMin;
  if (range <= 0.0) { return 0.0; }
  return clamp((score - domainMin) / range, 0.0, 1.0);
}
