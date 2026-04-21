// Modification coverage pass: per-segment modifications stacked on the
// coverage bars. Uses per-instance packed ABGR color because modifications
// have many possible types + strengths that don't fit in palette slots.
//! targets: wgsl, glsl
//! layout-out: packages/alignments-core/src/modCoverageLayout.generated.ts

import alignmentsUniforms;
import colorPack;
import hpmath;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  position    : ATTR0;
  float yOffset     : ATTR1;
  float segHeight   : ATTR2;
  uint  packedColor : ATTR3;
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  float2 local = quadLocal(vid);

  float x1 = hpClipX(hpSplitUint(inst.position), u);
  float x2 = hpClipX(hpSplitUint(inst.position + 1u), u);
  float minW = 2.0 / u.canvasW;
  if (x2 - x1 < minW) {
    float mid = (x1 + x2) * 0.5;
    x1 = mid - minW * 0.5;
    x2 = mid + minW * 0.5;
  }

  float eh = effHeight(u);
  float bottom = covBottom(u);
  float segBot = bottom + (inst.yOffset * u.depthScale * eh / u.canvasH) * 2.0;
  float segTop = segBot + (inst.segHeight * u.depthScale * eh / u.canvasH) * 2.0;
  o.position = float4(
    flipX(lerp(x1, x2, local.x), u),
    lerp(segBot, segTop, local.y),
    0.0, 1.0);
  o.color = unpackRGBA(inst.packedColor);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}
