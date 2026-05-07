// Non-coverage histogram: slim 1-bp-wide bars indicating insertion /
// softclip / hardclip density across the coverage strip.
//! targets: wgsl, glsl
//! layout-out: packages/alignments-core/src/noncovHistogramLayout.generated.ts

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  position  : ATTR0;
  float yOffset   : ATTR1;
  float segHeight : ATTR2;
  float colorType : ATTR3;  // 1=insertion 2=softclip 3=hardclip
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

float3 noncovColor(float ct, Uniforms u) {
  int ci = int(ct);
  if (ci == 1) { return unpackRGBA(u.colorInsertion).xyz; }
  if (ci == 2) { return unpackRGBA(u.colorSoftclip).xyz; }
  return unpackRGBA(u.colorHardclip).xyz;
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  float2 local = quadLocal(vid);

  float cx = hpClipX(hpSplitUint(inst.position), u);
  float barW = 2.0 / u.canvasW;

  // Sits just above the bottom coverage-area edge, below the indicator row.
  float indOff = 9.0 / u.canvasH;
  float sTop = 1.0 - indOff - (inst.yOffset * u.noncovHeight / u.canvasH) * 2.0;
  float sBot = sTop - (inst.segHeight * u.noncovHeight / u.canvasH) * 2.0;

  o.position = float4(
    flipX(lerp(cx - barW * 0.5, cx + barW * 0.5, local.x), u),
    lerp(sBot, sTop, local.y),
    0.0, 1.0);
  o.color = float4(noncovColor(inst.colorType, u), 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}
