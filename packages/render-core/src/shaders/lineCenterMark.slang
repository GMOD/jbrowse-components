// The `line` mark shape's linear variant: one capsule per instance from the
// previous instance's bp midpoint at its value to this instance's, thickened
// to `lineWidth` with round caps, so consecutive capsules meet in a seamless
// round join under the max blend; a run's first instance (`prevX == NO_PREV_X`)
// draws as a dot. Which instance is the previous one is the packer's call
// (`gapBp`), so both backends break a run in the same place.
//
// Premultiplied MAX blend, so overlapping segments and caps union instead of
// accumulating into dark seams under src-over. Max is inexact where lines of
// different colours cross.
//
// The band is the instance's `row`, read through the bound row table as
// `barMark` reads it.
//! targets: wgsl, glsl
//! blend: max
//! coverage: analytic

import antialias;
import capsule;
import hpmath;
import colorPack;
import markColor;
import rowTable;
import valueScale;
import lineCommon;

public static const uint VERTS_PER_INSTANCE = 6u;

struct LineCenterInstance {
  uint  x      : ATTR0;
  uint  x2     : ATTR1;
  float y      : ATTR2;
  uint  color  : ATTR3;
  uint  row    : ATTR4;
  // The previous instance's span and value, NO_PREV_X at a run start.
  uint  prevX  : ATTR5;
  uint  prevX2 : ATTR6;
  float prevY  : ATTR7;
};

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;
[[vk::binding(2, 0)]] Sampler2D<float4> colorRamp;
[[vk::binding(4, 0)]] Sampler2D<float4> rowTable;

struct VsOut {
  float4 position : SV_Position;
  nointerpolation float4 color : COLOR0;
  // signed px distance (along, across) from the segment centre, and the
  // segment's half-length, for the capsule SDF
  float2 localPos : TEXCOORD0;
  nointerpolation float segHalfLen : TEXCOORD1;
  // the colour line's y at the segment centre and its rise per px along, so
  // the fragment reads the value under itself
  nointerpolation float2 colorLine : TEXCOORD2;
  nointerpolation float4 cutYsLo : TEXCOORD3;
  nointerpolation float4 cutYsHi : TEXCOORD4;
  nointerpolation float colorAlongY : TEXCOORD5;
};

[shader("vertex")]
VsOut vs_main(LineCenterInstance inst, uint vid : SV_VertexID) {
  VsOut o;
  RowPlacement place = rowTableLookup(rowTable, inst.row, u.rowTableKeys,
    markScaleColor(colorRamp, inst.color, u.rampMode, u.rampMin, u.rampMax, u.rampMidNorm, u.colorCutCount, u.colorCuts[0], u.colorCuts[1], u.colorBands));
  if (place.hidden) {
    o.position = float4(2.0, 2.0, 0.0, 1.0);
    o.color = float4(0.0);
    o.localPos = float2(0.0);
    o.segHalfLen = 0.0;
    o.colorLine = float2(0.0);
    o.cutYsLo = float4(0.0);
    o.cutYsHi = float4(0.0);
    o.colorAlongY = 0.0;
    return o;
  }
  float sx1 = lineBpToClipX(inst.x, u);
  float sx2 = lineBpToClipX(inst.x2, u);
  float bandTop = rowBandTopPx(u.rowOffsetPx, u.rowHeight, place.slot);
  bool hasPrev = inst.prevX != NO_PREV_X;
  float midCurrX = (sx1 + sx2) * 0.5;
  // Averaged in clip space, as midCurrX is, so consecutive capsules meet
  // exactly; a bp-space average would need a rounded integer midpoint.
  float midPrevX = hasPrev
    ? (lineBpToClipX(inst.prevX, u) + lineBpToClipX(inst.prevX2, u)) * 0.5
    : midCurrX;
  float currYPx = lineValueYPx(inst.y, bandTop, u);
  float prevYPx = hasPrev ? lineValueYPx(inst.prevY, bandTop, u) : currYPx;
  // Built in px space so the capsule stays isotropic despite the differing
  // per-axis px→clip scales.
  float centerClipX = (midPrevX + midCurrX) * 0.5;
  float centerYPx = (prevYPx + currYPx) * 0.5;
  float2 deltaPx = float2(
    (midCurrX - midPrevX) * u.viewportWidth * 0.5, currYPx - prevYPx);
  float len = length(deltaPx);
  CapsuleFrame f = capsuleFrame(deltaPx, len);
  float2 local =
    capsuleQuadLocal(vid, len * 0.5, u.lineWidth * 0.5, u.devicePixelRatio);
  float2 off = f.tangent * local.x + f.normal * local.y;
  o.position = float4(
    centerClipX + pxToClipLen(off.x, u.viewportWidth),
    yPxToClipY(centerYPx + off.y, u.canvasHeight),
    0.0,
    1.0);
  o.color = place.color;
  o.localPos = local;
  o.segHalfLen = len * 0.5;
  float currColorYPx = lineColorYPx(inst.y, bandTop, u);
  float prevColorYPx = hasPrev ? lineColorYPx(inst.prevY, bandTop, u) : currColorYPx;
  o.colorLine = float2(
    (prevColorYPx + currColorYPx) * 0.5,
    len > CAPSULE_MIN_LEN_PX ? (currColorYPx - prevColorYPx) / len : 0.0);
  o.cutYsLo = lineCutYsPx(0, bandTop, u);
  o.cutYsHi = lineCutYsPx(4, bandTop, u);
  o.colorAlongY = lineColorAlongY(place.overridden, u);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut v) : SV_Target {
  float dist = capsuleDist(v.localPos, v.segHalfLen);
  float alpha = edgeCoverage(u.lineWidth * 0.5 - dist, u.devicePixelRatio);
  if (alpha <= 0.0) {
    discard;
  }
  float along = clamp(v.localPos.x, -v.segHalfLen, v.segHalfLen);
  float4 color = lineFragmentColor(
    v.colorLine.x + v.colorLine.y * along, v.cutYsLo, v.cutYsHi, v.color, v.colorAlongY, u);
  // premultiplied, so same-colour overlaps union under the max blend
  return float4(color.rgb * alpha, color.a * alpha);
}
