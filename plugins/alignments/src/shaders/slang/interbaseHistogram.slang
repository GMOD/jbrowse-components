// Interbase histogram: slim 1px-wide bars indicating insertion /
// softclip / hardclip density across the coverage strip.
//! targets: wgsl, glsl
//! layout-out: packages/alignments-core/src/interbaseHistogramLayout.generated.ts
//! js-export: interbaseEdgePx
//! js-export-out: packages/alignments-core/src/interbaseEdge.generated.ts

import alignmentsUniforms;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  position  : ATTR0;
  float yOffset   : ATTR1;
  float segHeight : ATTR2;
  float colorType : ATTR3;  // 1=insertion 2=softclip 3=hardclip
};

// Screen-pixel Y of one edge of a bar, `offset` bars' worth of stacked height
// below the coverage-area top.
//
// Rounded to a whole pixel, and that rounding is the whole reason this is a
// named function rather than two expressions inline. TRIANGLE_H is 4.5, so an
// unsnapped edge half-covers a row — and the backends do not agree on a
// half-covered row: Canvas2D composites each of the ~40 bars that stack in one
// column at 40bp/px separately and saturates to opaque, while this pass resolves
// the union coverage once and stays at 50%. That read as a full row of 128,0,128
// against 191,127,191 and was the largest remaining cross-backend divergence.
// Whole-pixel edges leave no partial coverage to disagree about — which only
// holds while both sides round the same numbers the same way, so
// drawInterbaseSegments `//! js-export`s this rather than repeating it.
float interbaseEdgePx(float offset, float interbaseHeight) {
  return floor(TRIANGLE_H + offset * interbaseHeight + 0.5);
}

[shader("vertex")]
ColorVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  ColorVsOut o;
  float2 local = quadLocal(vid);

  float cx = bpToClipX(inst.position, u);
  float barW = pxToClipLen(1.0, u.canvasW);

  // Hang from the coverage-area top, starting just below the indicator
  // triangle row (TRIANGLE_H is the same const indicator.slang draws with).
  // Both edges snap to whole pixels BEFORE the clip-space conversion.
  float topPx = interbaseEdgePx(inst.yOffset, u.interbaseHeight);
  float botPx = interbaseEdgePx(inst.yOffset + inst.segHeight, u.interbaseHeight);
  float sTop = covAreaTop(u) - pxToClipLen(topPx, u.canvasH);
  float sBot = covAreaTop(u) - pxToClipLen(botPx, u.canvasH);

  o.position = flippedQuadPos(cx - barW * 0.5, cx + barW * 0.5, sBot, sTop, local, u);
  o.color = float4(clipKindColor(inst.colorType, u), 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}
