// Uniform block, score math and mode enums shared by the wiggle renderer's two
// entry-point shaders. Split out because the two draw disjoint things off
// different per-instance layouts — `wiggle.slang` fills (xyplot, density,
// scatter) and `wiggleLine.slang` strokes (line, linecenter) — while agreeing
// exactly on where a score lands vertically and where a bp lands horizontally.
// One UBO is written per block render (GpuWiggleRenderer.drawRegion) and read by
// whichever pass draws, so `Uniforms` must stay in lockstep with the offsets
// generated from it.
//
// Imported via `import wiggleCommon;`. Each consumer declares its OWN
// `[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;` — the struct is shared,
// the binding is not — and re-imports `colorPack`/`hpmath` for itself, since
// Slang does not re-export through an import.
//
// The rendering-mode and scale enums are the numeric contract between the
// `renderingType` / `scaleType` uniforms and every TS path that sets them or
// branches on them, and the sentinel is the same contract inside the instance
// buffer. They live here, in the one module both entry points import, so there
// is a single declaration of each rather than one per shader — the evaluator
// resolves through imports, so a constant declared here still reaches both.
// Generated into @jbrowse/wiggle-core (see consts-out) because that is where
// `WiggleRenderingType` and `WiggleScaleType` are declared, and the plugin reads
// them back from there.
//! export-consts: RENDERING_TYPE_XYPLOT, RENDERING_TYPE_DENSITY, RENDERING_TYPE_LINE, RENDERING_TYPE_SCATTER, RENDERING_TYPE_LINE_CENTER, SCALE_TYPE_LOG, SCALE_TYPE_SYMLOG, NO_PREV_START, MIN_FILL_WIDTH_PX
//! consts-out: packages/wiggle-core/src/wiggleRenderModes.generated.ts
//! js-export: densityGradientT, normalizeScore
//! js-skip: symlogTransform — the JS twin (wiggle-core normalize.ts) spells it Math.log1p, which is accurate near zero where the shader's log(1.0 + x) is not; a generated twin would be a faithful copy of the worse of the two. What both backends must agree on is normalizeScore, which is exported and swept by normalizeScoreParity.test.ts
//! js-skip: scoreToY — diverges from JS makeScoreNormalizer on a degenerate (min == max) domain on purpose — JS returns 0, the shader avoids NaN. Unifying them is a product decision, not a codegen one; the part both backends must share is normalizeScore, which is exported
module wiggleCommon;

import hpmath;

public static const int RENDERING_TYPE_XYPLOT = 0;
public static const int RENDERING_TYPE_DENSITY = 1;
public static const int RENDERING_TYPE_LINE = 2;
public static const int RENDERING_TYPE_SCATTER = 3;
public static const int RENDERING_TYPE_LINE_CENTER = 4;
public static const int SCALE_TYPE_LOG = 1;
public static const int SCALE_TYPE_SYMLOG = 2;

// prevStartEnd.x sentinel: no previous feature (source start). Larger than any
// genomic coordinate, so it never collides with a real start. Only
// wiggleLine.slang reads it, but it is declared here with the other numeric
// contracts so `consts-out` emits one file (that directive takes the WHOLE
// export-consts list).
public static const uint NO_PREV_START = 0xffffffffu;

// Narrowest an xyplot bar / density column may paint, in CSS px, so a bin under
// a pixel wide still shows instead of dropping out. `//! export-consts`ed and
// read back as `WIGGLE_MIN_PX`: the Canvas2D path has to floor at the same
// number the GPU does, and it spent a while as a literal here beside a comment
// naming its TS twin — which is the arrangement adr-051 exists to retire.
public static const float MIN_FILL_WIDTH_PX = 1.5;

public struct Uniforms {
  public float3 bpRangeX;
  public float  canvasHeight;
  public int    scaleType;
  public int    renderingType;
  public float  numRows;
  public float  domainYMin;
  public float  domainYMax;
  public float  zero;
  public float  viewportWidth;
  public float  scatterPointSize;
  public float  lineWidth;
  // Score the xyplot bars pivot around and the density gradient centers on
  // (= bicolorPivot). Default 0 keeps the fixed-at-zero baseline.
  public float  origin;
  // symlog's linear-region width, already resolved on the JS side (a 0 in the
  // config means "derive from the domain", and that rule lives there so both
  // backends normalize against the same number). Unread for the other scales.
  public float  symlogConstant;
  // What one output pixel is worth in the CSS px every geometry number above is
  // measured in, so a fragment measuring a true distance can size its ramp
  // without differentiating it (antialias.slang §"Analytic"). The xyplot bar's
  // horizontal cuts and the center line's capsule both read it.
  public float  devicePixelRatio;
  // Shortest an xyplot bar may draw, in the CSS px the bar geometry is measured
  // in. Floors the bar away from the origin so a score sitting exactly on it
  // still paints (issue #4279); 0 is the unfloored bar. The Canvas2D twin
  // floors the same span from the same number.
  public float  minBarHeightPx;
};

public float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

public float symlogTransform(float x, float c) {
  return sign(x) * log(1.0 + abs(x / c));
}

public float normalizeScore(float score, float domainMin, float domainMax, int scaleType, float symlogConstant) {
  if (scaleType == SCALE_TYPE_SYMLOG) {
    // Defined at and either side of zero, so unlike the log branch there is
    // nothing to floor: the domain arrives as-is and 0 lands where it belongs
    // instead of on the baseline with everything else below the floor.
    float tMin = symlogTransform(domainMin, symlogConstant);
    float tMax = symlogTransform(domainMax, symlogConstant);
    float t = symlogTransform(score, symlogConstant);
    return clamp((t - tMin) / max(tMax - tMin, 1e-6), 0.0, 1.0);
  }
  // `max(range, 1e-6)` guards a degenerate (min==max) domain from dividing by
  // zero — the JS makeScoreNormalizer returns 0 in that case; here we just
  // avoid NaN propagating into the vertex position.
  if (scaleType == SCALE_TYPE_LOG) {
    // Floor at the domain's own min, not at 1, so a domain sitting entirely
    // below 1 (mappability, a methylation fraction, any normalized ratio) still
    // has a range to spread over instead of collapsing to a flat baseline. Same
    // rule and same reasoning as JS `makeScoreNormalizer`, which keeps its own
    // hand-written copy because it hoists this arithmetic out of a per-feature
    // loop — so this one is `//! js-export`ed as the ORACLE the two are swept
    // against (`normalizeScoreParity.test.ts`), not to retire it.
    float lo = domainMin > 0.0 ? domainMin : 1.0;
    float logMin = log2(lo);
    float logMax = log2(max(domainMax, lo));
    float logScore = log2(max(score, lo));
    return clamp((logScore - logMin) / max(logMax - logMin, 1e-6), 0.0, 1.0);
  }
  return clamp((score - domainMin) / max(domainMax - domainMin, 1e-6), 0.0, 1.0);
}

public float scoreToY(float score, float domainMin, float domainMax, float h, int scaleType, float symlogConstant) {
  return (1.0 - normalizeScore(score, domainMin, domainMax, scaleType, symlogConstant)) * h;
}

// Density mode's gradient position: how far this score sits from the pivot,
// as a fraction of the pivot's distance to the further end of the normalized
// domain. 0 paints white, 1 paints the track color.
//
// Takes normalized scores rather than raw ones because the two backends
// normalize deliberately differently — normalizeScore() above avoids NaN on a
// degenerate (min == max) domain where JS `makeScoreNormalizer` returns 0 (see
// adr-051) — so the ramp is the only part they must agree on. `//! js-export`ed:
// getDensityColor.ts carried it verbatim, keeping a `max(maxDist, 0.0001)` floor
// that can never fire (maxDist >= 0.5 always) purely so a reader comparing the
// two backends saw identical arithmetic.
public float densityGradientT(float norm, float zeroNorm) {
  float maxDist = max(zeroNorm, 1.0 - zeroNorm);
  return abs(norm - zeroNorm) / max(maxDist, 0.0001);
}
