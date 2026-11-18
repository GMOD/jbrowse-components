// The scatter rendering: a point marker on each bin's bp midpoint.
//
// A point over SMALL_POINT_MAX_DIAMETER is an antialiased disc, and a smaller
// one the crisp square `pointMark` draws through the same pointGlyph kernel.
// Which one follows from uniforms alone, so the fragment's branch stays in the
// uniform control flow WGSL requires around the disc's derivatives.
//! targets: wgsl, glsl

import antialias;
import hpmath;
import colorPack;
import colorRampLut;
import pointGlyph;
import scoreScale;
import wiggleCommon;

public static const uint VERTS_PER_INSTANCE = 6u;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;
[[vk::binding(2, 0)]] Sampler2D<float4> colorRamp;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  nointerpolation float rampT : COLOR1;
  // the disc's quad-local coord, its edge at distance 1
  float2 localPos : TEXCOORD0;
  // the square: the fragment and its box, CSS px
  float2 squarePx : TEXCOORD1;
  nointerpolation float4 squareBox : TEXCOORD2;
};

bool drawsDisc() {
  return u.diameterPx > SMALL_POINT_MAX_DIAMETER;
}

[shader("vertex")]
VsOut vs_main(WiggleFillInstance inst, uint vid : SV_VertexID) {
  float rowHeight = u.rowHeight;
  float rowTop = inst.rowIndex * rowHeight;
  float pxToClip = 2.0 / u.canvasHeight;
  float midX = (bpToClipX(inst.startEnd.x, u) + bpToClipX(inst.startEnd.y, u)) * 0.5;
  float scoreYPx = rowScoreToYPx(inst.score, rowTop, rowHeight, u);
  float2 q = quadLocal(vid);

  VsOut o;
  o.localPos = float2(0.0, 0.0);
  o.squarePx = float2(0.0, 0.0);
  o.squareBox = float4(0.0);
  if (drawsDisc()) {
    float radiusPx = u.diameterPx * 0.5;
    float2 local = q * 2.0 - float2(1.0, 1.0);
    float expand = discExpand(radiusPx, u.devicePixelRatio);
    float halfPx = radiusPx * expand;
    o.position = float4(
      midX + pxToClipLen(local.x * halfPx, u.viewportWidth),
      (1.0 - scoreYPx * pxToClip) + local.y * halfPx * pxToClip,
      0.0, 1.0);
    o.localPos = local * expand;
  } else {
    CrispSquareCorner c = crispSquareCorner(
      float2(clipXToPx(midX, u.viewportWidth), scoreYPx), u.diameterPx, q,
      u.devicePixelRatio);
    o.position = float4(
      pxToClipX(c.px.x, u.viewportWidth), yPxToClipY(c.px.y, u.canvasHeight),
      0.0, 1.0);
    o.squarePx = c.px;
    o.squareBox = c.box;
  }
  o.color = float4(unpackRGBA(inst.color).rgb, 1.0);
  o.rampT = u.rampLut == 1
    ? rampMidT(
        normalizeScore(inst.score, u.domainYMin, u.domainYMax, u.scaleType, u.symlogConstant),
        u.rampMidNorm)
    : 0.0;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float4 color = fragIn.color;
  if (u.rampLut == 1) {
    color = rampColor(colorRamp, fragIn.rampT);
  }
  float alpha;
  if (drawsDisc()) {
    alpha = discAlpha(fragIn.localPos);
  } else {
    alpha = boxInkCoverage(fragIn.squarePx, fragIn.squareBox, u.devicePixelRatio);
  }
  if (alpha <= 0.0) {
    discard;
  }
  return float4(color.rgb, color.a * alpha);
}
