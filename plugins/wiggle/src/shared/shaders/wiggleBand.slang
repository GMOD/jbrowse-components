// A line plot's whiskers band: a quad per bin under the step line, a trapezoid
// between bin midpoints under the interpolated one. Drawn after the lines and
// composited behind them, so every line lies exactly over every band.
//! targets: wgsl, glsl
//! coverage: analytic
//! blend: behind
//! export-consts: WHISKER_BAND_OPACITY
//! js-skip: edgePerp — the analytic edge ramp's slope factor; Canvas2D fills the band as a path and antialiases it itself

import antialias;
import hpmath;
import colorPack;
import wiggleCommon;

public static const uint VERTS_PER_INSTANCE = 6u;

public static const float WHISKER_BAND_OPACITY = 0.3;

struct WiggleBandInstance {
  uint2 startEnd     : ATTR0;
  uint2 prevStartEnd : ATTR1;
  float minScore     : ATTR2;
  float maxScore     : ATTR3;
  float prevMinScore : ATTR4;
  float prevMaxScore : ATTR5;
  uint  posColor     : ATTR6;
  uint  negColor     : ATTR7;
  float rowIndex     : ATTR8;
};

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  nointerpolation float4 posColor : COLOR0;
  nointerpolation float4 negColor : COLOR1;
  // perpendicular CSS px inside the top (.x) and bottom (.y) edges
  float2 inkPx : TEXCOORD0;
  float belowPivotPx : TEXCOORD1;
};

// Floored only in a column narrower than an output pixel, where the edge's rise
// would otherwise pad and fade along its whole length; a wider steep edge keeps
// its true perpendicular ramp.
float edgePerp(float dyPx, float dxPx, float dpr) {
  float slope = abs(dxPx) > 1e-6 ? dyPx / dxPx : 0.0;
  float perp = 1.0 / sqrt(1.0 + slope * slope);
  return abs(dxPx) * dpr < 1.0 ? max(perp, 0.5) : perp;
}

[shader("vertex")]
VsOut vs_main(WiggleBandInstance inst, uint vid : SV_VertexID) {
  float rowHeight = u.canvasHeight / u.numRows;
  float rowTop = inst.rowIndex * rowHeight;
  float startX = bpToClipX(inst.startEnd.x, u);
  float endX = bpToClipX(inst.startEnd.y, u);
  float top = rowScoreToYPx(inst.maxScore, rowTop, rowHeight, u);
  float bottom = rowScoreToYPx(inst.minScore, rowTop, rowHeight, u);

  float x0 = startX;
  float x1 = endX;
  float top0 = top;
  float bottom0 = bottom;
  if (u.renderingType == RENDERING_TYPE_LINE_CENTER) {
    // averaged in clip space, as the neighbour does, so the two share this edge
    x1 = (startX + endX) * 0.5;
    if (inst.prevStartEnd.x != NO_PREV_START) {
      x0 = (bpToClipX(inst.prevStartEnd.x, u) + bpToClipX(inst.prevStartEnd.y, u)) * 0.5;
      top0 = rowScoreToYPx(inst.prevMaxScore, rowTop, rowHeight, u);
      bottom0 = rowScoreToYPx(inst.prevMinScore, rowTop, rowHeight, u);
    } else {
      x0 = x1;
    }
  }

  float dxPx = (x1 - x0) * u.viewportWidth * 0.5;
  float topPerp = edgePerp(top - top0, dxPx, u.devicePixelRatio);
  float bottomPerp = edgePerp(bottom - bottom0, dxPx, u.devicePixelRatio);
  float pad = aaHalfPx(u.devicePixelRatio);

  float2 q = quadLocal(vid);
  float x = lerp(x0, x1, q.x);
  float topEdge = lerp(top0, top, q.x);
  float bottomEdge = lerp(bottom0, bottom, q.x);
  float y = lerp(bottomEdge + pad / bottomPerp, topEdge - pad / topPerp, q.y);

  VsOut o;
  o.position = float4(x, 1.0 - y * 2.0 / u.canvasHeight, 0.0, 1.0);
  o.posColor = float4(unpackRGBA(inst.posColor).rgb, 1.0);
  o.negColor = float4(unpackRGBA(inst.negColor).rgb, 1.0);
  o.inkPx = float2((y - topEdge) * topPerp, (bottomEdge - y) * bottomPerp);
  o.belowPivotPx = y - rowScoreToYPx(u.pivot, rowTop, rowHeight, u);
  return o;
}

float bandCoverage(float insideTopPx, float insideBottomPx) {
  return max(
    edgeCoverage(insideTopPx, u.devicePixelRatio)
      + edgeCoverage(insideBottomPx, u.devicePixelRatio) - 1.0,
    0.0);
}

// Covered separately above and below the pivot, so an edge lying on the pivot
// takes none of the other colour.
[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float above = bandCoverage(
    fragIn.inkPx.x, min(fragIn.inkPx.y, -fragIn.belowPivotPx));
  float below = bandCoverage(
    min(fragIn.inkPx.x, fragIn.belowPivotPx), fragIn.inkPx.y);
  float coverage = above + below;
  if (coverage <= 0.0) {
    discard;
  }
  float3 rgb = (fragIn.posColor.rgb * above + fragIn.negColor.rgb * below) / coverage;
  float alpha = WHISKER_BAND_OPACITY * coverage;
  return float4(rgb * alpha, alpha);
}
