// Interbase histogram: slim 1px-wide bars indicating insertion /
// softclip / hardclip density across the coverage strip.
//! targets: wgsl, glsl
//! layout-out: packages/alignments-core/src/interbaseHistogramLayout.generated.ts

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

[shader("vertex")]
ColorVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  ColorVsOut o;
  float2 local = quadLocal(vid);

  float cx = bpToClipX(inst.position, u);
  float barW = 2.0 / u.canvasW;

  // Hang from the coverage-area top, starting just below the indicator
  // triangle row (TRIANGLE_H is the same const indicator.slang draws with).
  //
  // Both edges are rounded to whole pixels BEFORE the clip-space conversion,
  // and drawInterbaseSegments rounds the same two numbers the same way. TRIANGLE_H
  // is 4.5, so an unsnapped top edge half-covers a row — and the backends do not
  // agree on a half-covered row: Canvas2D composites each of the ~40 bars that
  // stack in one column at 40bp/px separately and saturates to opaque, while
  // this pass resolves the union coverage once and stays at 50%. Whole-pixel
  // edges leave no partial coverage to disagree about.
  float topPx = floor(TRIANGLE_H + inst.yOffset * u.interbaseHeight + 0.5);
  float botPx = floor(TRIANGLE_H + (inst.yOffset + inst.segHeight) * u.interbaseHeight + 0.5);
  float sTop = covAreaTop(u) - topPx * 2.0 / u.canvasH;
  float sBot = covAreaTop(u) - botPx * 2.0 / u.canvasH;

  o.position = flippedQuadPos(cx - barW * 0.5, cx + barW * 0.5, sBot, sTop, local, u);
  o.color = float4(clipKindColor(inst.colorType, u), 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}
