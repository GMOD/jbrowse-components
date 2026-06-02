// SNP coverage pass: segments stacked on the coverage bars showing A/C/G/T/N
// fraction per bin. colorType encodes 1=A 2=C 3=G 4=T 5=N.
//! targets: wgsl, glsl
//! layout-out: packages/alignments-core/src/snpCoverageLayout.generated.ts

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

// yOffset/segHeight are fractions of THIS position's coverage bar (not regional).
// relDepth = totalDepthAtPos / regionMaxDepth feeds the bar-height calculation
// via normalizeDepth, so each segment is a linear slice of a possibly-log-scaled
// bar without any per-position un-mixing at draw time.
struct Instance {
  uint  position   : ATTR0;
  float yOffset    : ATTR1;
  float segHeight  : ATTR2;
  float colorType  : ATTR3;
  float relDepth   : ATTR4;
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

float3 snpColor(float ct, Uniforms u) {
  // 5=N and any other type hit `default` and use the dedicated N color.
  switch (int(ct)) {
    case 1:  return unpackRGBA(u.colorBaseA).xyz;
    case 2:  return unpackRGBA(u.colorBaseC).xyz;
    case 3:  return unpackRGBA(u.colorBaseG).xyz;
    case 4:  return unpackRGBA(u.colorBaseT).xyz;
    default: return unpackRGBA(u.colorBaseN).xyz;
  }
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  float2 local = quadLocal(vid);

  float2 xx = expandMinWidthX(
    hpClipX(hpSplitUint(inst.position), u),
    hpClipX(hpSplitUint(inst.position + 1u), u),
    u.canvasW);
  float x1 = xx.x;
  float x2 = xx.y;

  float bottom = covBottom(u);
  float k = normalizeDepth(inst.relDepth, u) * effHeight(u) / u.canvasH * 2.0;
  float segBot = bottom + inst.yOffset * k;
  float segTop = segBot + inst.segHeight * k;
  o.position = float4(
    flipX(lerp(x1, x2, local.x), u),
    lerp(segBot, segTop, local.y),
    0.0, 1.0);
  o.color = float4(snpColor(inst.colorType, u), 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}
