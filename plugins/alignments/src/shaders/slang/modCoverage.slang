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
  o.position = covSegQuad(inst.position, inst.yOffset, inst.segHeight,
                          inst.relDepth, quadLocal(vid), u);
  o.color = unpackRGBA(inst.packedColor);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}
