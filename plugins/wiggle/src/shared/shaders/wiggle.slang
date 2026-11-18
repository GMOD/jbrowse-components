// The xyplot rendering: a bar from the origin to each bin's score. Its
// siblings: `wiggleScatter.slang` and `wiggleDensity.slang` draw scatter and
// density off this same fill buffer, and `wiggleLine.slang` and
// `wiggleLineCenter.slang` stroke the two line renderings off wider records of
// their own. All import `wiggleCommon` for the uniform block and the score
// math. The `fill` pass draws 12 vertices per instance: the bar quad, then
// its clip strip.
//
// No fill rendering reads a neighbouring feature, which is why the instance
// record (`WiggleFillInstance`, declared in wiggleCommon so the scatter and
// density entry points can share the buffer) is the five words it is: while all
// five renderings shared this shader every fill buffer also carried the
// step-line's prevScore/nextScore and the center-line's
// prevStartEnd/prevScoreLine — 20 bytes per feature that no fill pass reads,
// and tens of MB of a 1000-source multiwiggle's single per-region allocation.
//
// Under a gradient (`u.rampLut`) a bar takes the colorRamp LUT's color at its
// score, as wiggleDensity.slang does: the vertex stage places the flat ramp
// position and the fragment samples, since the HALs bind textures to the
// fragment stage. The domain stays a uniform, so an autoscale pan re-colors
// without touching the instance buffer.
//! targets: wgsl, glsl

import antialias;
import hpmath;
import colorPack;
import colorRampLut;
import scoreScale;
import wiggleCommon;
import clipStrip;

// Two quads: the bar, then its clip strip, which every vertex of a bar the
// domain did not cut sends off clip.
public static const uint VERTS_PER_INSTANCE = 12u;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;
[[vk::binding(2, 0)]] Sampler2D<float4> colorRamp;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // CSS px below the quad's top cut (.x) and below its bottom cut (.y). Both
  // are affine in screen y with unit slope — the vertex sets them from the
  // same `vy` it converts to clip — so the fragment's ramp is one OUTPUT pixel
  // wide by construction and takes no derivative. Same shape as
  // syntenyTypes.slang's `vertCoverage`, which is where the band-as-a-difference
  // -of-two-ramps form is written up.
  float2 barInkPx : TEXCOORD0;
  nointerpolation float rampT : COLOR1;
  // 1 on the clip strip, whose color is its own rather than the ramp's.
  nointerpolation float strip : COLOR2;
};

// A quad's slab from `topPx` to `botPx` over the bin, the bar's or the strip's.
// The min-width floor is anchored at the bin's start so it grows the way the
// Canvas2D `spanLeft` twin does. `u.viewportWidth` is CSS px (see
// wiggleMarks.ts), which is what makes the floor the same 1.5 CSS px at every
// dpr rather than 1.5 device px.
VsOut slabVertex(WiggleFillInstance inst, uint vid, float topPx, float botPx) {
  float sx1 = bpToClipX(inst.startEnd.x, u);
  float sx2 = extendToMinWidthX(
    sx1, bpToClipX(inst.startEnd.y, u), MIN_FILL_WIDTH_PX, u.viewportWidth);
  float2 q = quadLocal(vid);
  float vy = slabVertexYPx(topPx, botPx, q.y, u.devicePixelRatio);
  float pxToClip = 2.0 / u.canvasHeight;
  VsOut o;
  o.position = float4(lerp(sx1, sx2, q.x), 1.0 - vy * pxToClip, 0.0, 1.0);
  o.barInkPx = float2(vy - topPx, vy - botPx);
  return o;
}

// The strip quad: CLIP_STRIP_PX of red across the row edge that cut the bar,
// antialiased at its two horizontal cuts the way the bar is. A bar inside the
// domain has none.
VsOut clipStripVertex(WiggleFillInstance inst, uint vid, float rowTop) {
  int side = clipSide(inst.score, u.domainYMin, u.domainYMax, u.scaleType);
  VsOut o;
  if (side == 0) {
    o.position = float4(2.0, 2.0, 0.0, 1.0);
    o.barInkPx = float2(0.0, 0.0);
    o.color = float4(0.0);
  } else {
    float topPx = clipStripTopPx(side, rowTop, u.rowHeight);
    o = slabVertex(inst, vid, topPx, topPx + CLIP_STRIP_PX);
    o.color = float4(unpackRGBA(CLIP_STRIP_COLOR).rgb, 1.0);
  }
  o.rampT = 0.0;
  o.strip = 1.0;
  return o;
}

VsOut barVertex(WiggleFillInstance inst, uint vid, float rowTop) {
  float scoreY  = rowScoreToYPx(inst.score, rowTop, u.rowHeight, u);
  float originY = rowScoreToYPx(u.origin,   rowTop, u.rowHeight, u);
  VsOut o = slabVertex(inst, vid, min(scoreY, originY), max(scoreY, originY));
  o.color = float4(unpackRGBA(inst.color).rgb, 1.0);
  o.strip = 0.0;
  o.rampT = u.rampLut == 1
    ? rampMidT(
        normalizeScore(inst.score, u.domainYMin, u.domainYMax, u.scaleType, u.symlogConstant),
        u.rampMidNorm)
    : 0.0;
  return o;
}

[shader("vertex")]
VsOut vs_main(WiggleFillInstance inst, uint vid : SV_VertexID) {
  float rowTop = inst.rowIndex * u.rowHeight;
  VsOut o;
  if (vid < 6u) {
    o = barVertex(inst, vid, rowTop);
  } else {
    o = clipStripVertex(inst, vid, rowTop);
  }
  return o;
}

// A bar's top cut IS the datum, so it must not quantise to the output grid:
// the reader takes the score off that edge, and rounding it to a whole device
// pixel rounds the value.
//
// The VERTICAL cuts stay hard on purpose. Bins tile, so two neighbours split
// one pixel column, and per-fragment alpha on both sides of that shared edge
// composites to less than full ink — the seam GPU_SHADERS.md refuses for hi-C.
//
// The horizontal cuts conflate too, and the bound is worth knowing rather than
// claiming away: `extendToMinWidthX` above floors a bin at MIN_FILL_WIDTH_PX by
// growing it off its anchor, so at any zoom whose bin is under 1.5 CSS px a bar
// OVERLAPS its neighbours and a column carries two or three of them. Where
// their tops agree — a flat run, a plateau — the fringe row composites
// 1-(1-a)^n instead of a, up to 0.375 too much ink at n=3. It reads as a top
// edge a third of a device pixel too tall on flat stretches, against the 0.277
// of MSAA quantisation this replaces everywhere, so the trade is worth taking
// and is not worth hiding. barCutCoverage.test.ts pins it.
[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float4 color = fragIn.color;
  if (u.rampLut == 1) {
    float4 ramped = rampColor(colorRamp, fragIn.rampT);
    color = fragIn.strip > 0.5 ? fragIn.color : ramped;
  }
  float alpha = slabCoverage(fragIn.barInkPx.x, fragIn.barInkPx.y, u.devicePixelRatio);
  if (alpha <= 0.0) {
    discard;
  }
  return float4(color.rgb, color.a * alpha);
}
