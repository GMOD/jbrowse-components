// Base-modification segments stacked on the coverage bars. Carries a
// per-instance packed ABGR color because modifications have many possible types
// + strengths that don't fit in palette slots — otherwise identical to
// coverageSnp.slang. See coverageBand.slang.
//! targets: wgsl, glsl
//! layout-out: packages/alignments-core/src/modCoverageLayout.generated.ts

import coverageBand;
import colorPack;
import hpmath;

public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<CoverageBandUniforms> u;

// See coverageSnp.slang for the per-position fraction contract.
struct Instance {
  uint  position    : ATTR0;
  float yOffset     : ATTR1;
  float segHeight   : ATTR2;
  uint  packedColor : ATTR3;
  float relDepth    : ATTR4;
};

[shader("vertex")]
CoverageVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  CoverageVsOut o;
  o.position = covSegQuad(inst.position, 1u, inst.yOffset, inst.segHeight,
                          inst.relDepth, quadLocal(vid), u);
  o.color = unpackRGBA(inst.packedColor);
  return o;
}

[shader("fragment")]
float4 fs_main(CoverageVsOut fragIn) : SV_Target {
  return fragIn.color;
}
