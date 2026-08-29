// Density (and multirowdensity — one code path, `rowIndex`/`numRows` are what
// differ) as a composed shape: `rowRect`'s geometry, `scoreScale`'s normalizer,
// wiggleCommon's inline white-to-track-colour ramp. One instance is a rect
// filling its whole row over [startBp, endBp), coloured by its score through
// the uniform domain — the score stays in the instance buffer and the domain
// stays a uniform, so an autoscale move on pan is one uniform write, never a
// buffer re-upload (ADR-094's load-bearing cardinality).
//
// Draws off PASS_FILL's buffer: the record is `WiggleFillInstance`, declared in
// wiggleCommon and shared with `wiggle.slang` the way canvas's chevron and line
// entry points share `LineInstance` (slangPass.ts §"no bufferStride override").
//
// Row edges are hard on purpose. Density's quad spans the whole row, so its
// horizontal cuts are row boundaries that TILE with the row above and below —
// the one case where per-fragment alpha on both sides of a shared edge sums to
// 0.75 where 1.0 is right and leaves a seam down every boundary
// (GPU_RENDERING.md §"Antialiasing ramps", "Tiled cells"). It also has no datum
// on those cuts: density encodes its score in the COLOR, so a soft row boundary
// would cost the seam and buy nothing. `rowRect` draws hard-edged quads, which
// is exactly that.
//
// Composing the shape brings its `MIN_DRAWN_ROW_PX` floor along: a row thinner
// than a CSS px is painted at 1px, centered, overlapping its neighbours — where
// the pre-composition density branch let sub-pixel rows miss every pixel center
// and drop out. Only reachable when numRows outgrows the canvas height.
//
// The default colour resolves in the vertex stage, as it always has: every
// fragment of a density quad is one flat colour, so per-vertex is the cheaper
// stage. The alternative named-ramp mode (`u.densityRampLut`) samples the
// shared 256×1 LUT texture instead — the same colorRampLut module and binding
// slot HiC and LD sample through — and that sample has to be the fragment's,
// because the HALs bind textures with fragment-stage visibility only. The
// vertex stage therefore carries both the resolved default colour and the ramp
// position `t`, and the fragment picks by the uniform; `t` is per-instance
// flat, so the varying interpolates nothing.
//! targets: wgsl, glsl

import hpmath;
import colorPack;
import colorRampLut;
import rowRect;
import scoreScale;
import wiggleCommon;

public static const uint VERTS_PER_INSTANCE = 6u;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;
[[vk::binding(2, 0)]] Sampler2D<float4> colorRamp;

struct DensityVsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  nointerpolation float rampT : COLOR1;
};

[shader("vertex")]
DensityVsOut vs_main(WiggleFillInstance inst, uint vid : SV_VertexID) {
  // The shape's uniform bundle, derived from the wiggle family's own block: one
  // UBO write per region serves all three wiggle entry shaders. `minCellPx`
  // takes MIN_FILL_WIDTH_PX — the same floor the Canvas2D twin reads back as
  // WIGGLE_MIN_PX, anchored at the bin start by `extendToMinWidthX` inside the
  // shape — so the min-width behavior is one decision, not two.
  // `rowProportion` 1.0 because density rows tile edge-to-edge; `scrollTop` 0
  // because this canvas is sized to its content.
  RowRectUniforms r;
  r.bpRangeX      = u.bpRangeX;
  r.canvasHeight  = u.canvasHeight;
  r.minCellDenomPx = u.viewportWidth;
  r.minCellPx     = MIN_FILL_WIDTH_PX;
  r.zero          = u.zero;
  r.rowHeight     = u.canvasHeight / u.numRows;
  r.rowProportion = 1.0;
  r.scrollTop     = 0.0;

  float norm = normalizeScore(
    inst.score, u.domainYMin, u.domainYMax, u.scaleType, u.symlogConstant);
  float zeroNorm = normalizeScore(
    u.origin, u.domainYMin, u.domainYMax, u.scaleType, u.symlogConstant);

  float t = densityGradientT(norm, zeroNorm);

  DensityVsOut o;
  o.position = rowRectClipPos(
    inst.startEnd.x, inst.startEnd.y, inst.rowIndex, vid, r);
  o.color = float4(
    lerp(float3(1.0), unpackRGBA(inst.color).rgb, t), 1.0);
  o.rampT = t;
  return o;
}

[shader("fragment")]
float4 fs_main(DensityVsOut v) : SV_Target {
  if (u.densityRampLut == 1) {
    return rampColor(colorRamp, v.rampT);
  }
  return v.color;
}
