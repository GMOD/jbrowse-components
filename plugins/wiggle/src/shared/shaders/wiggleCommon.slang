// Uniform block, plot-box math and mode enums shared by the wiggle renderer's
// entry-point shaders: `wiggle.slang` and `wiggleDensity.slang` fill (xyplot,
// scatter, density), `wiggleLine.slang` and `wiggleLineCenter.slang` stroke
// (line, linecenter), and `wiggleBand.slang` fills a line's whiskers band. They
// draw off different per-instance records while agreeing exactly on where a
// score lands vertically, where a bp lands horizontally, and which side of the
// pivot a line is on. One UBO is written per block render
// (`writeWiggleUniforms`) and read by whichever pass draws, so `Uniforms` must
// stay in lockstep with the offsets generated from it.
//
// Imported via `import wiggleCommon;`. Each consumer declares its OWN
// `[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;` — the struct is shared,
// the binding is not — and re-imports `colorPack`/`hpmath` for itself, since
// Slang does not re-export through an import.
//
// The rendering-mode enum is the numeric contract between the `renderingType`
// uniform and every TS path that sets it or branches on it, and the sentinel is
// the same contract inside the instance buffer. They live here, in the one
// module every entry point imports, so there is a single declaration of each
// rather than one per shader — the evaluator resolves through imports, so a
// constant declared here still reaches all of them. `SCALE_TYPE_LOG` /
// `SCALE_TYPE_SYMLOG` are the shared `scoreScale` module's, generated into
// render-core. Generated into @jbrowse/wiggle-core (see consts-out) because
// that is where `WiggleRenderingType` is declared, and the plugin reads them
// back from there.
//! export-consts: RENDERING_TYPE_XYPLOT, RENDERING_TYPE_DENSITY, RENDERING_TYPE_LINE, RENDERING_TYPE_SCATTER, RENDERING_TYPE_LINE_CENTER, NO_PREV_START, MIN_FILL_WIDTH_PX
//! consts-out: packages/wiggle-core/src/wiggleRenderModes.generated.ts
//! js-export: densityGradientT, densityRampT
//! js-skip: scoreToY — a plot-box wrapper over scoreScale.slang's normalizeScore, which is where the shared decision is and where it is exported from. The Canvas2D side composes the same normalizer with its own box (wiggle-core yScaleTicks.ts), so a twin of this signature would have no caller
module wiggleCommon;

import hpmath;
import scoreScale;

public static const int RENDERING_TYPE_XYPLOT = 0;
public static const int RENDERING_TYPE_DENSITY = 1;
public static const int RENDERING_TYPE_LINE = 2;
public static const int RENDERING_TYPE_SCATTER = 3;
public static const int RENDERING_TYPE_LINE_CENTER = 4;
// prevStartEnd.x sentinel: no previous feature (source start). Larger than any
// genomic coordinate, so it never collides with a real start. Only the center
// line and the band read it, but it is declared here with the other numeric
// contracts so `consts-out` emits one file (that directive takes the WHOLE
// export-consts list).
public static const uint NO_PREV_START = 0xffffffffu;

// Narrowest an xyplot bar / density column may paint, in CSS px, so a bin under
// a pixel wide still shows instead of dropping out. `//! export-consts`ed and
// read back as `WIGGLE_MIN_PX`: the Canvas2D path has to floor at the same
// number the GPU does, and it spent a while as a literal here beside a comment
// naming its TS twin — which is the arrangement adr-051 exists to retire.
public static const float MIN_FILL_WIDTH_PX = 1.5;

// The fill renderings' per-instance record, declared here because two entry
// shaders draw off ONE buffer packed in this layout: `wiggle.slang` (xyplot,
// scatter) and `wiggleDensity.slang` both read the fill pass's buffer, and two
// passes sharing a buffer must share the struct declaration itself rather than
// mirror it (slangPass.ts §"There is deliberately no bufferStride override").
// `rowIndex` is float, not `rowRect.slang`'s uint: the record is what
// `packFillInstances` writes for every fill rendering, the row transform
// consumes it as float arithmetic either way, and re-typing the lane would
// re-touch xyplot/scatter for no behavior.
public struct WiggleFillInstance {
  public uint2 startEnd  : ATTR0;
  public float score     : ATTR1;
  public uint  color     : ATTR2;
  public float rowIndex  : ATTR3;
};

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
  // The score xyplot bars grow from.
  public float  origin;
  // The score the colour parts at: the line and band colour sides and the
  // density fade's white. A threshold's cut, else `origin`.
  public float  pivot;
  // Where a named density ramp's middle stop sits, as a normalized score:
  // `domainMid`'s, else 0.5, which runs the ramp straight across the domain.
  public float  rampMidNorm;
  // symlog's linear-region width, already resolved on the JS side (a 0 in the
  // config means "derive from the domain", and that rule lives there so both
  // backends normalize against the same number). Unread for the other scales.
  public float  symlogConstant;
  // What one output pixel is worth in the CSS px every geometry number above is
  // measured in, so a fragment measuring a true distance can size its ramp
  // without differentiating it (antialias.slang §"Analytic"). The xyplot bar's
  // horizontal cuts and the center line's capsule both read it.
  public float  devicePixelRatio;
  // 1 = density colours through the bound 256×1 colorRamp LUT texture (a named
  // ramp like viridis), 0 = the default inline white→track-colour lerp. Only
  // wiggleDensity.slang reads it — the LUT cannot encode multiwiggle's
  // PER-ROW track colours, so the inline lerp stays the default and the LUT is
  // the alternative a config names. In the shared block like the other mode
  // ints so one UBO write per region serves every entry shader.
  public int    densityRampLut;
};

public float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

public float scoreToY(float score, float domainMin, float domainMax, float h, int scaleType, float symlogConstant) {
  return (1.0 - normalizeScore(score, domainMin, domainMax, scaleType, symlogConstant)) * h;
}

// A score's CSS px down the canvas in its row. The line shaders and the band
// place every vertex, neighbour and pivot through it, so a band lies under its
// line exactly.
public float rowScoreToYPx(float score, float rowTop, float rowHeight, Uniforms u) {
  return scoreToY(score, u.domainYMin, u.domainYMax, rowHeight, u.scaleType, u.symlogConstant) + rowTop;
}

// A line's colour follows the side of the pivot its centre line is on, not the
// pixel's, so a line lying on the pivot stays one colour. Screen y grows
// downward, so a larger y is below the pivot.
public float4 pivotSideColor(float centerLineYPx, float pivotYPx, float4 posColor, float4 negColor) {
  return centerLineYPx > pivotYPx ? negColor : posColor;
}

// Density mode's gradient position: how far this score sits from the pivot,
// as a fraction of the pivot's distance to the further end of the normalized
// domain. 0 paints white, 1 paints the track color.
//
// Takes normalized scores rather than raw ones so the ramp is one decision and
// the normalizer another — `scoreScale.slang` owns the second and exports its
// own twin. `//! js-export`ed:
// getDensityColor.ts carried it verbatim, keeping a `max(maxDist, 0.0001)` floor
// that can never fire (maxDist >= 0.5 always) purely so a reader comparing the
// two backends saw identical arithmetic.
public float densityGradientT(float norm, float zeroNorm) {
  float maxDist = max(zeroNorm, 1.0 - zeroNorm);
  return abs(norm - zeroNorm) / max(maxDist, 0.0001);
}

// A named ramp's position: the domain's ends at its end stops and `midNorm` at
// its middle one, linear on each side, so a diverging scheme parts at
// `domainMid` and a sequential one runs low to high.
public float densityRampT(float norm, float midNorm) {
  return norm <= midNorm
    ? 0.5 * norm / max(midNorm, 0.0001)
    : 0.5 + 0.5 * (norm - midNorm) / max(1.0 - midNorm, 0.0001);
}
