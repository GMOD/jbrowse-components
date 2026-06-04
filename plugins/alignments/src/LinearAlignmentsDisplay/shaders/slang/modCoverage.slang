// Modification coverage pass: per-segment modifications stacked on the
// coverage bars. Uses per-instance packed ABGR color because modifications
// have many possible types + strengths that don't fit in palette slots.
//! targets: wgsl, glsl
//! layout-out: packages/alignments-core/src/modCoverageLayout.generated.ts

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

// See snpCoverage.slang for the per-position fraction contract.
struct Instance {
  uint  position    : ATTR0;
  float yOffset     : ATTR1;
  float segHeight   : ATTR2;
  uint  packedColor : ATTR3;
  float relDepth    : ATTR4;
};

[shader("vertex")]
ColorVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  ColorVsOut o;
  float2 local = quadLocal(vid);

  float2 xx = expandMinWidthX(
    bpToClipX(inst.position, u),
    bpToClipX(inst.position + 1u, u),
    u.canvasW);
  float x1 = xx.x;
  float x2 = xx.y;

  float bottom = covBottom(u);
  float k = covBarScale(inst.relDepth, u);
  float segBot = bottom + inst.yOffset * k;
  float segTop = segBot + inst.segHeight * k;
  o.position = float4(
    flipX(lerp(x1, x2, local.x), u),
    lerp(segBot, segTop, local.y),
    0.0, 1.0);
  o.color = unpackRGBA(inst.packedColor);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}
