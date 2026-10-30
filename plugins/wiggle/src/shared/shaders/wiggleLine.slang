// The step line (RENDERING_TYPE_LINE): three square-capped quads per bin over
// its bar top. `wiggleLineCenter.slang` draws the interpolated line, and both
// import `wiggleCommon` for the uniform block, the row's score math and the
// band color, so the two line renderings place and color a score alike.
//
// They are separate modules because a module reflects exactly one instance
// struct, and each reads a different neighbour: the step line the previous and
// next scores, the center line the previous bin's span and score. One shared
// record carried both pairs, 12 bytes a bin the step line never read.
//
// Each quad inks the area its box covers of the pixel (`slabCoverage` on both
// axes), as `lineStepMark.slang`'s do, so the line draws at one sample. The
// quads overlap at the joints, where an opaque line's partially covered edge
// pixels composite 1-(1-a)(1-b) rather than the union's area.
//! targets: wgsl, glsl
//! coverage: analytic

import antialias;
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
[[vk::binding(2, 0)]] Sampler2D<float4> colorRamp;

struct VsOut {
  float4 position : SV_Position;
  nointerpolation float4 color    : COLOR0;
  nointerpolation float4 negColor : COLOR1;
  // the y range the fragment's color is read in: a rise's own span, or a
  // level run's score placed unclamped
  nointerpolation float2 centerLine : TEXCOORD0;
  // each cut's y in the row
  nointerpolation float4 cutYsLo : TEXCOORD1;
  nointerpolation float4 cutYsHi : TEXCOORD2;
  float yPx : TEXCOORD3;
  nointerpolation float rowTop : TEXCOORD4;
  float xPx : TEXCOORD5;
  nointerpolation float4 box : TEXCOORD6;
};


// Each quad is square-capped (extended by the half-width along its own length)
// so segments overlap at the joints and corners fill with no gaps.
//   seg 0: vertical at startX from prevScore → score (transition in)
//   seg 1: horizontal at score across [startX, endX]
//   seg 2: vertical at endX   from score → nextScore (transition out)
// At a gap prevScore and nextScore are the origin, the bars' baseline. When
// adjacent, nextScore==score collapses seg 2 to a square
// joint that fills the corner with the next feature's seg 0.
[shader("vertex")]
VsOut vs_main(WiggleLineInstance inst, uint vid : SV_VertexID) {
  float sx1 = bpToClipX(inst.startEnd.x, u);
  float sx2 = bpToClipX(inst.startEnd.y, u);

  float rowHeight = u.canvasHeight / u.numRows;
  float rowTop = inst.rowIndex * rowHeight;

  uint seg = vid / STEP_LINE_QUAD_VERTS;
  float2 q = quadLocal(vid);
  float scoreYPx = rowScoreToYPx(inst.score, rowTop, rowHeight, u);
  float prevYPx = rowScoreToYPx(inst.prevScore, rowTop, rowHeight, u);
  float nextYPx = rowScoreToYPx(inst.nextScore, rowTop, rowHeight, u);
  float hw = u.lineWidth * 0.5;
  float px1 = clipXToPx(sx1, u.viewportWidth);
  float px2 = clipXToPx(sx2, u.viewportWidth);

  float4 box;
  float2 centerLine;
  if (seg == 0u) {
    box = float4(px1 - hw, min(prevYPx, scoreYPx) - hw, px1 + hw, max(prevYPx, scoreYPx) + hw);
    centerLine = float2(min(prevYPx, scoreYPx), max(prevYPx, scoreYPx));
  } else if (seg == 1u) {
    box = float4(min(px1, px2) - hw, scoreYPx - hw, max(px1, px2) + hw, scoreYPx + hw);
    float scoreColorYPx = rowColorYPx(inst.score, rowTop, rowHeight, u);
    centerLine = float2(scoreColorYPx, scoreColorYPx);
  } else {
    box = float4(px2 - hw, min(scoreYPx, nextYPx) - hw, px2 + hw, max(scoreYPx, nextYPx) + hw);
    centerLine = float2(min(scoreYPx, nextYPx), max(scoreYPx, nextYPx));
  }
  float pad = aaPx(u.devicePixelRatio);
  float xPx = lerp(box.x - pad, box.z + pad, q.x);
  float yPx = lerp(box.w + pad, box.y - pad, q.y);

  VsOut o;
  o.position = float4(pxToClipX(xPx, u.viewportWidth), yPxToClipY(yPx, u.canvasHeight), 0.0, 1.0);
  o.color = float4(unpackRGBA(inst.color).rgb, 1.0);
  o.negColor = float4(unpackRGBA(inst.negColor).rgb, 1.0);
  o.centerLine = centerLine;
  o.cutYsLo = cutYsPx(0, rowTop, rowHeight, u);
  o.cutYsHi = cutYsPx(4, rowTop, rowHeight, u);
  o.yPx = yPx;
  o.rowTop = rowTop;
  o.xPx = xPx;
  o.box = box;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float dpr = u.devicePixelRatio;
  float coverage = slabCoverage(fragIn.xPx - fragIn.box.x, fragIn.xPx - fragIn.box.z, dpr)
                 * slabCoverage(fragIn.yPx - fragIn.box.y, fragIn.yPx - fragIn.box.w, dpr);
  if (coverage <= 0.0) {
    discard;
  }
  float4 color = lineColorAt(
    clamp(fragIn.yPx, fragIn.centerLine.x, fragIn.centerLine.y),
    fragIn.rowTop,
    u.canvasHeight / u.numRows,
    fragIn.cutYsLo,
    fragIn.cutYsHi,
    u,
    fragIn.color,
    fragIn.negColor,
    colorRamp);
  return float4(color.rgb, color.a * coverage);
}
