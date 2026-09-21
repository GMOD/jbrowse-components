// The step line (RENDERING_TYPE_LINE): three square-capped quads per bin over
// its bar top. `wiggleLineCenter.slang` draws the interpolated line, and both
// import `wiggleCommon` for the uniform block, the row's score math and the
// pivot-side colour, so the two line renderings place and colour a score alike.
//
// They are separate modules because a module reflects exactly one instance
// struct, and each reads a different neighbour: the step line the previous and
// next scores, the center line the previous bin's span and score. One shared
// record carried both pairs, 12 bytes a bin the step line never read.
//! targets: wgsl, glsl

import hpmath;
import colorPack;
import wiggleCommon;

// `vs_main` splits `SV_VertexID` by the same quad size `quadLocal` takes it
// apart with.
static const uint STEP_LINE_SEGMENTS = 3u;
static const uint STEP_LINE_QUAD_VERTS = 6u;
public static const uint VERTS_PER_INSTANCE = STEP_LINE_SEGMENTS * STEP_LINE_QUAD_VERTS;

struct WiggleLineInstance {
  uint2 startEnd  : ATTR0;
  float score     : ATTR1;
  float prevScore : ATTR2;
  float nextScore : ATTR3;
  uint  color     : ATTR4;
  float rowIndex  : ATTR5;
  uint  negColor  : ATTR6;
};

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  nointerpolation float4 color    : COLOR0;
  nointerpolation float4 negColor : COLOR1;
  // the y range the segment's centre line spans
  nointerpolation float2 centerLine : TEXCOORD0;
  nointerpolation float pivotYPx : TEXCOORD1;
  float yPx : TEXCOORD2;
};

float rowScoreToClipY(float score, float rowTop, float rowHeight, float pxToClip) {
  return 1.0 - rowScoreToYPx(score, rowTop, rowHeight, u) * pxToClip;
}

// Each quad is square-capped (extended by the half-width along its own length)
// so segments overlap at the joints and corners fill with no gaps. Half-widths
// are computed per axis because x and y have different px→clip scales.
//   seg 0: vertical at startX from prevScore → score (transition in)
//   seg 1: horizontal at score across [startX, endX]
//   seg 2: vertical at endX   from score → nextScore (transition out)
// prevScore=0 encodes gapBefore (rise from zero); nextScore=0 encodes gapAfter
// (drop to zero). When adjacent, nextScore==score collapses seg 2 to a square
// joint that fills the corner with the next feature's seg 0.
[shader("vertex")]
VsOut vs_main(WiggleLineInstance inst, uint vid : SV_VertexID) {
  float sx1 = bpToClipX(inst.startEnd.x, u);
  float sx2 = bpToClipX(inst.startEnd.y, u);

  float rowHeight = u.canvasHeight / u.numRows;
  float rowTop = inst.rowIndex * rowHeight;
  float pxToClip = 2.0 / u.canvasHeight;

  uint seg = vid / STEP_LINE_QUAD_VERTS;
  float2 q = quadLocal(vid);
  float clipScoreY = rowScoreToClipY(inst.score,     rowTop, rowHeight, pxToClip);
  float clipPrevY  = rowScoreToClipY(inst.prevScore, rowTop, rowHeight, pxToClip);
  float clipNextY  = rowScoreToClipY(inst.nextScore, rowTop, rowHeight, pxToClip);
  float hwx = pxToClipLen(u.lineWidth * 0.5, u.viewportWidth);
  float hwy = u.lineWidth * 0.5 * pxToClip;
  float scoreYPx = rowScoreToYPx(inst.score, rowTop, rowHeight, u);

  float sx;
  float sy;
  float2 centerLine;
  if (seg == 0u) {
    sx = lerp(sx1 - hwx, sx1 + hwx, q.x);
    sy = lerp(min(clipPrevY, clipScoreY) - hwy, max(clipPrevY, clipScoreY) + hwy, q.y);
    float prevYPx = rowScoreToYPx(inst.prevScore, rowTop, rowHeight, u);
    centerLine = float2(min(prevYPx, scoreYPx), max(prevYPx, scoreYPx));
  } else if (seg == 1u) {
    sx = lerp(min(sx1, sx2) - hwx, max(sx1, sx2) + hwx, q.x);
    sy = lerp(clipScoreY - hwy, clipScoreY + hwy, q.y);
    centerLine = float2(scoreYPx, scoreYPx);
  } else {
    sx = lerp(sx2 - hwx, sx2 + hwx, q.x);
    sy = lerp(min(clipScoreY, clipNextY) - hwy, max(clipScoreY, clipNextY) + hwy, q.y);
    float nextYPx = rowScoreToYPx(inst.nextScore, rowTop, rowHeight, u);
    centerLine = float2(min(scoreYPx, nextYPx), max(scoreYPx, nextYPx));
  }

  VsOut o;
  o.position = float4(sx, sy, 0.0, 1.0);
  o.color = float4(unpackRGBA(inst.color).rgb, 1.0);
  o.negColor = float4(unpackRGBA(inst.negColor).rgb, 1.0);
  o.centerLine = centerLine;
  o.pivotYPx = rowScoreToYPx(u.pivot, rowTop, rowHeight, u);
  o.yPx = (1.0 - sy) / pxToClip;
  return o;
}

// The quads stay flat fills, and that is a decision rather than an omission: a
// feature's three quads DELIBERATELY overlap at the joints so corners fill with
// no gaps, and consecutive features overlap again. Per-fragment coverage on an
// edge two quads both cover double-blends there — Kilgard's conflation, the
// self-overlap case — so the step line would gain a lattice of darker joints.
// The rendering that wants an antialiased stroke is the center line, whose
// capsules union under max blend precisely so that overlap is free.
[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return pivotSideColor(
    clamp(fragIn.yPx, fragIn.centerLine.x, fragIn.centerLine.y),
    fragIn.pivotYPx,
    fragIn.color,
    fragIn.negColor);
}
