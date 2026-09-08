// The arc band's uniform block and the frame its four passes place marks in.
//
// A struct of its own, the way render-core's coverageBand.slang is: the band is
// drawn in the middle of a pileup frame, so it used to be a memcpy of the whole
// 800-byte `Uniforms` with the band-sensitive slots poked on top — a partial
// write over a copy, where a slot the poke forgot silently redrew with the
// pileup's value. Now `writeArcBandUniforms` fills this block whole.
//
// The SCALAR half of the band's vocabulary stays in alignmentsUniforms.slang —
// arcAvailH, arcYFraction, arcYOffsetPx, arcColorSlot, ARC_HEIGHT_MARGIN,
// ARC_COLOR_*. Those are `//! js-export`ed, and the twins the Canvas2D draw, the
// hit test and the insert-size ruler import are emitted from the module that
// declares them.
module arcBandUniforms;

import alignmentsUniforms;
import hpmath;

public struct ArcBandUniforms {
  // HP-split bp range of the BLOCK, not the clipped viewport: an arc's foot may
  // be extrapolated well outside the block (a cross-region pair's far mate).
  public float bpHi;
  public float bpLo;
  public float bpLen;
  // Runtime 0.0 sentinel; see hpmath.slang. MUST always be uploaded as 0.0.
  public float hpZero;

  public float canvasW;
  public float canvasH;
  // The arc baseline in absolute canvas px — band bottom in up mode, band top
  // in down mode. The passes run in the full-canvas viewport (a grouped
  // section's band may scroll partly off-screen, and WebGPU rejects an
  // out-of-bounds viewport), so every band mark reaches clip space through this
  // anchor and the scissor does the real clip.
  public float covOffset;
  // Band height in CSS px — the vertical extent the dome / flat-line Y-scale
  // (`availH`) maps into. Distinct from `canvasH`, the clip-space divisor.
  public float arcBandH;

  // The block's own px projection, which is what carries a foot extrapolated
  // outside it.
  public float blockStartPx;
  public float blockWidth;
  // The stroke-width FLOOR every mark is raised to, an antialiasing property of
  // the display; each mark's own width rides on its instance.
  public float lineWidthPx;
  public float pairedArcsDown;
  // Domain in bp that maps to the band's vertical extent (availH). Arc/bezier
  // mode sets this to availH/pxPerBp so the apex tracks genomic zoom; read-cloud
  // mode sets it to the autoscaled max |insert size| so the line Y is
  // zoom-stable. One code path, mode-dependent value.
  public float arcsYDomainBp;
  // 1 = map yBp→Y with a base-2 log scale (read cloud), 0 = linear
  // (arc/bezier mode). Float-as-bool to stay in the float block.
  public float arcsYLog;
  public float reversed;
  // Sizes an antialiased stroke's ramp in DEVICE pixels; every other length
  // here is CSS px.
  public float devicePixelRatio;

  // The read cloud's flat connector line (arcFlat.slang). The theme's
  // `text.primary`: the line carries no category — its two endpoint squares do —
  // so it wants the foreground colour, and both renderers hard-coded that as
  // black, which is the background in dark mode. Packed ABGR u32.
  public uint colorFlatConnector;

  // Paired-read arc palette, indexed by the per-instance color type — a real
  // array, because that is what it is. The nine slots were nine separately-named
  // uniforms (arcColor0..8), which the shader could not subscript:
  // `arcColorByIndex` copied all nine into a local array on every vertex to get
  // one of them.
  //
  // float4 rather than the packed ABGR uint every OTHER color uses. std140 pads
  // an array element to 16 bytes regardless, so ONE packed colour per element
  // would occupy the same 144 bytes while still costing an unpack per vertex.
  // Four to a `uint4` element would be 48 and does compile — measured on
  // alignments' 23-colour palette and declined there: see colorPack.slang.
  //
  // The read-cloud endpoint squares (arcMarker.slang) index this same array.
  // They used to have `arcMarkerColor`, a second copy with the short-insert
  // slot swapped for the pale pileup fill, because a saturated stroke colour
  // was needed to keep a thin arc line visible while the opaque square had to
  // match the pileup. Both are the pale swatch now, so the substitution is
  // gone; a second table holding the identical nine colours is only somewhere
  // for them to drift.
  //
  // Last in the block on purpose: the seventeen scalars above pack into 68
  // bytes, so std140's 16-byte array alignment costs 12 bytes of pad rather
  // than splitting the scalars around it.
  public float4 arcColor[ARC_COLOR_SLOTS];
};

// Paired-read arc palette, indexed by the per-instance color type. Shared by
// the arc curves (arc.slang) and the interchromosomal connector ticks
// (arcLine.slang) so both stay in lockstep. `arcColorSlot` (alignmentsUniforms)
// is the clamp, and is what the Canvas2D twin reads.
public float3 arcColorByIndex(uint idx, ArcBandUniforms u) {
  return u.arcColor[arcColorSlot(idx)].xyz;
}

// Read cloud/arc flat-line Y offset (unsigned px) within an `availH`-tall band.
// Shared by arcFlat.slang and arcMarker.slang so a read cloud endpoint square
// lands exactly on its flat line, and by the curved dome, whose apex it holds
// inside the band so a wide pair still draws a complete arc between its two
// endpoints rather than leaving through the band edge.
public float arcBandDestY(uint yBp, float availH, ArcBandUniforms u) {
  return arcYOffsetPx(yBp, u.arcsYDomainBp, u.arcsYLog > 0.5, availH);
}

// ---- The arc band's frame ------------------------------------------------
//
// Four passes draw into one band and each used to spell its geometry itself.
// That is four chances to disagree about which way arcs grow, how wide a
// coalesced mark strokes, and where the band sits on the canvas — and three of
// those spellings carried a comment saying "same as arc.slang, and for the same
// reason", which is the shape `arcAvailH` was already extracted out of.

// Which way the band grows from its anchor. The predicate, not the sign, so
// arcLine.slang can ask it about the band's TOP EDGE (a different question with
// no clean sign form) without restating the comparison.
public bool arcsPointDown(ArcBandUniforms u) {
  return u.pairedArcsDown > 0.5;
}

public float arcYDir(ArcBandUniforms u) {
  return arcsPointDown(u) ? 1.0 : -1.0;
}

// Signed band-local Y, in CSS px from the anchor, of the flat mark an insert
// size plots at. arc.slang does NOT call this: it needs the unsigned `destY`
// for the dome's ry and the direction separately, so it takes the two pieces.
public float arcBandY(uint yBp, ArcBandUniforms u) {
  return arcBandDestY(yBp, arcAvailH(u.arcBandH), u) * arcYDir(u);
}

// Half the width an arc-band mark strokes at. `instWidthPx` is the instance's
// own, resolved from its read support by `arcLineWidth` at pack time; the
// uniform is the FLOOR every mark is raised to, which is an antialiasing
// property of the display (writeArcBandUniforms raises it to 1.5 device px) and
// not anything about how many reads a mark stands for. Both halves of that
// sentence have to be stated together, which is why this is one function and
// not a `max` at three call sites.
public float arcStrokeHalfPx(float instWidthPx, ArcBandUniforms u) {
  return max(instWidthPx, u.lineWidthPx) * 0.5;
}

public float arcFlipX(float x, ArcBandUniforms u) {
  return lerp(x, -x, u.reversed);
}

// Fraction of the block a genomic position sits at. The `bpToClipX` twin for
// this struct, and the one place the HP split is spelled here.
public float arcBpToLinear(uint bp, ArcBandUniforms u) {
  return hpScaleLinear(hpSplitUint(bp), float3(u.bpHi, u.bpLo, u.bpLen),
                       u.hpZero);
}

// Where a genomic position sits along the band, in CSS px across the BLOCK.
//
// The band's x is the one piece of its frame that was still spelled six times —
// twice each in arc.slang and arcFlat.slang, once each in arcMarker.slang and
// arcLine.slang, identically. It is the block's own projection rather than a
// canvas one because an arc's foot may be extrapolated well outside the block
// (a cross-region pair's far mate), and `blockStartPx` / `blockWidth` are what
// carry that extrapolation; `arcBandClipPos` normalizes the result afterwards.
// Passes that reach clip space directly — arcLine.slang, whose y is already
// canvas-absolute — still take their x from here.
public float arcBandX(uint bp, ArcBandUniforms u) {
  return u.blockStartPx + arcBpToLinear(bp, u) * u.blockWidth;
}

// A band-local point (CSS px from the anchor) placed on the canvas. Forgetting
// `u.covOffset` or the flip here draws a band that is merely somewhere else,
// which is why the three passes doing it should not each be writing it out.
public float4 arcBandClipPos(float2 bandPx, ArcBandUniforms u) {
  return float4(
    arcFlipX(pxToClipX(bandPx.x, u.canvasW), u),
    yPxToClipY(bandPx.y + u.covOffset, u.canvasH),
    0.0, 1.0);
}
