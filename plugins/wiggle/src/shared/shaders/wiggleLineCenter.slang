// The interpolated line (RENDERING_TYPE_LINE_CENTER): one capsule per bin, from
// the previous bin's midpoint to this one's. `wiggleLine.slang` draws the step
// line on a record of its own, since a module reflects one instance struct and
// the two read different neighbours; both import `wiggleCommon` for the
// uniform block, the row's score math and the band colour.
//
// Premultiplied MAX blend, so overlapping segments and caps union instead of
// accumulating into dark seams under src-over. The lines draw first into a
// target cleared to transparent black and the whiskers band goes behind them
// afterwards. Max is still inexact where overlaid lines of different colours
// cross, and at a joint within half a line width of a cut, whose capsules
// can pick different sides.
//! targets: wgsl, glsl
//! blend: max
//! coverage: analytic

import antialias;
import capsule;
import hpmath;
import colorPack;
import wiggleCommon;

public static const uint VERTS_PER_INSTANCE = 6u;

struct WiggleLineCenterInstance {
  uint2 startEnd     : ATTR0;
  float score        : ATTR1;
  uint  color        : ATTR2;
  float rowIndex     : ATTR3;
  uint2 prevStartEnd : ATTR4;
  float prevScore    : ATTR5;
  uint  negColor     : ATTR6;
};

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  nointerpolation float4 color    : COLOR0;
  nointerpolation float4 negColor : COLOR1;
  // the segment centre's y and the tangent's y, so the fragment can place the
  // centre line under itself
  nointerpolation float2 centerLine : TEXCOORD2;
  // each cut's y in the row
  nointerpolation float4 cutYsLo : TEXCOORD3;
  nointerpolation float4 cutYsHi : TEXCOORD4;
  // signed px distance (along, perp) from the segment centre, and the
  // segment's half-length, for the capsule SDF
  float2 localPos : TEXCOORD0;
  nointerpolation float segHalfLen : TEXCOORD1;
};

// Adjacent capsules share a round cap centred on the joint vertex, so the max
// blend unions them into a seamless round join at any angle; square caps left
// nicks on sharp diagonal bends. A zero-length capsule at a run start draws a
// dot.
[shader("vertex")]
VsOut vs_main(WiggleLineCenterInstance inst, uint vid : SV_VertexID) {
  float sx1 = bpToClipX(inst.startEnd.x, u);
  float sx2 = bpToClipX(inst.startEnd.y, u);

  float rowHeight = u.canvasHeight / u.numRows;
  float rowTop = inst.rowIndex * rowHeight;
  float pxToClip = 2.0 / u.canvasHeight;

  bool hasPrev = inst.prevStartEnd.x != NO_PREV_START;
  float midCurrX = (sx1 + sx2) * 0.5;
  // Averaged in CLIP space from the start and end, as midCurrX is, so
  // consecutive capsules meet exactly. A bp-space average would need a rounded
  // integer midpoint, putting every joint up to half a base off — tens of
  // pixels of overshoot at base resolution, where odd-width bins are the norm.
  float midPrevX = hasPrev
    ? (bpToClipX(inst.prevStartEnd.x, u) + bpToClipX(inst.prevStartEnd.y, u)) * 0.5
    : midCurrX;
  float currYpx = rowScoreToYPx(inst.score, rowTop, rowHeight, u);
  float prevYpx = hasPrev
    ? rowScoreToYPx(inst.prevScore, rowTop, rowHeight, u)
    : currYpx;
  // Built in px space (clip x → px via viewportWidth) so the capsule stays
  // isotropic despite the differing per-axis px→clip scales.
  float centerClipX = (midPrevX + midCurrX) * 0.5;
  float centerYpx = (prevYpx + currYpx) * 0.5;
  float2 deltaPx = float2(
    (midCurrX - midPrevX) * u.viewportWidth * 0.5, currYpx - prevYpx);
  float len = length(deltaPx);
  CapsuleFrame f = capsuleFrame(deltaPx, len);
  float2 local =
    capsuleQuadLocal(vid, len * 0.5, u.lineWidth * 0.5, u.devicePixelRatio);
  float2 off = f.tangent * local.x + f.normal * local.y;

  VsOut o;
  o.position = float4(
    centerClipX + pxToClipLen(off.x, u.viewportWidth),
    1.0 - (centerYpx + off.y) * pxToClip,
    0.0,
    1.0);
  o.color = float4(unpackRGBA(inst.color).rgb, 1.0);
  o.negColor = float4(unpackRGBA(inst.negColor).rgb, 1.0);
  o.localPos = local;
  o.segHalfLen = len * 0.5;
  o.centerLine = float2(centerYpx, f.tangent.y);
  o.cutYsLo = cutYsPx(0, rowTop, rowHeight, u);
  o.cutYsHi = cutYsPx(4, rowTop, rowHeight, u);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float dist = capsuleDist(fragIn.localPos, fragIn.segHalfLen);
  float alpha = edgeCoverage(u.lineWidth * 0.5 - dist, u.devicePixelRatio);
  if (alpha <= 0.0) {
    discard;
  }
  float along = clamp(fragIn.localPos.x, -fragIn.segHalfLen, fragIn.segHalfLen);
  float4 color = bandColorAt(
    fragIn.centerLine.x + fragIn.centerLine.y * along,
    fragIn.cutYsLo,
    fragIn.cutYsHi,
    u,
    fragIn.color,
    fragIn.negColor);
  // PREMULTIPLIED, so same-colour overlaps union (max) rather than accumulate
  return float4(color.rgb * alpha, alpha);
}
