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
//! export-consts: RENDERING_TYPE_XYPLOT, RENDERING_TYPE_DENSITY, RENDERING_TYPE_LINE, RENDERING_TYPE_SCATTER, RENDERING_TYPE_LINE_CENTER, NO_PREV_START, MIN_FILL_WIDTH_PX, MAX_WIGGLE_CUTS
//! consts-out: packages/wiggle-core/src/wiggleRenderModes.generated.ts
//! js-skip: rowYPxToNorm — a GPU line reads its gradient position back off a y; Canvas2D and the SVG export stroke a gradient line as threshold bands placed by score (rampAsBands), so nothing there maps a y back
module wiggleCommon;

import colorRampLut;
import hpmath;
import markColor;
import valueScale;

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

// The most cuts a threshold color parts a plot at; the uniform block holds
// this many.
public static const int MAX_WIGGLE_CUTS = 8;

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
  public float  diameterPx;
  public float  lineWidth;
  // The score xyplot bars grow from.
  public float  origin;
  // Where a gradient's middle stop sits, as a normalized score:
  // `domainMid`'s, else 0.5, which runs the ramp straight across the domain.
  //
  // The only score the JS side normalizes for the shader, and it does not
  // generalize to `origin` and `cuts`, whose per-vertex normalize
  // looks like the same saving. Nothing is ever COMPARED to `rampMidNorm` — it
  // positions a ramp — while each of those two is tested against a score the
  // shader normalized itself, and the two tie only while one normalize places
  // both. `bandCutTie.test.ts` sabotages the cut version.
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
  // 1 = a gradient: every rendering colors through the bound 256×1
  // colorRamp LUT texture, 0 = the instance color. The LUT cannot encode
  // multiwiggle's PER-ROW track colors, so a gradient paints them all.
  public int    rampLut;
  // How many of `cuts` are in use, at least 1.
  public int    numCuts;
  // The scores the color changes at, ascending, four to a vector.
  public float4 cuts[MAX_WIGGLE_CUTS / 4];
  // The color of each band between two cuts. The band below the first cut
  // and the one past the last are the instance's own colors, since a source
  // can bring its own.
  public float4 innerColor[MAX_WIGGLE_CUTS - 1];
};

public float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

// A score's CSS px down the canvas in its row. The line shaders and the band
// place every vertex, neighbour and pivot through it, so a band lies under its
// line exactly.
public float rowScoreToYPx(float score, float rowTop, float rowHeight, Uniforms u) {
  return valueToYPxScaled(score, u.domainYMin, u.domainYMax, rowHeight, u.scaleType, u.symlogConstant) + rowTop;
}

// A value's y in the row for the color test, as `colorCutYsPx` places a cut.
// Unclamped, so a peak of 20 under a cut at 15 on a [0, 10] plot colors as
// over it, as the xyplot comparing raw scores does.
public float rowColorYPx(float value, float rowTop, float rowHeight, Uniforms u) {
  return rowTop + valueToYPxUnclamped(value, u.domainYMin, u.domainYMax, rowHeight, u.scaleType, u.symlogConstant);
}

public float4 cutYsPx(int from, float rowTop, float rowHeight, Uniforms u) {
  return colorCutYsPx(from, u.numCuts, u.cuts[0], u.cuts[1], rowTop, rowHeight, u.domainYMin, u.domainYMax, u.scaleType, u.symlogConstant);
}

// A line's color follows the band its centre line is in, not the pixel's, so
// a line lying on a cut stays one color.
public float4 bandColorAt(float centerLineYPx, float4 cutYsLo, float4 cutYsHi, Uniforms u, float4 posColor, float4 negColor) {
  int band = thresholdBandAtYPx(centerLineYPx, u.numCuts, cutYsLo, cutYsHi);
  return band == 0 ? negColor
    : band == u.numCuts ? posColor
    : u.innerColor[band - 1];
}

// The score a y in its row stands for, normalized: the inverse of
// `rowColorYPx`, clamped onto the domain as the ramp reads it.
public float rowYPxToNorm(float yPx, float rowTop, float rowHeight) {
  return clamp(1.0 - (yPx - rowTop) / rowHeight, 0.0, 1.0);
}

// A line's color at its centre line's y: the band between two cuts it is in,
// or under a gradient the ramp at that y's score, so a rise runs through the
// ramp's colors as a bar of each height would show them. The binding is each
// importer's own; the ramp comes in as a parameter.
public float4 lineColorAt(
    float centerLineYPx, float rowTop, float rowHeight, float4 cutYsLo,
    float4 cutYsHi, Uniforms u, float4 posColor, float4 negColor,
    Sampler2D<float4> ramp) {
  if (u.rampLut == 1) {
    return rampColor(
      ramp, rampMidT(rowYPxToNorm(centerLineYPx, rowTop, rowHeight), u.rampMidNorm));
  }
  return bandColorAt(centerLineYPx, cutYsLo, cutYsHi, u, posColor, negColor);
}
