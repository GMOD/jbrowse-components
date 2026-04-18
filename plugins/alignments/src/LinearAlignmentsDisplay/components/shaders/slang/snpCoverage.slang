// SNP coverage pass: segments stacked on the coverage bars showing A/C/G/T
// fraction per bin. colorType encodes 1=A 2=C 3=G 4=T.
//! targets: wgsl, glsl

import alignmentsUniforms;
import colorPack;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  float position   : ATTR0;
  float yOffset    : ATTR1;
  float segHeight  : ATTR2;
  float colorType  : ATTR3;
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

float3 snpColor(float ct, Uniforms u) {
  int ci = int(ct);
  if (ci == 1) { return unpackRGBA(u.colorBaseA).xyz; }
  if (ci == 2) { return unpackRGBA(u.colorBaseC).xyz; }
  if (ci == 3) { return unpackRGBA(u.colorBaseG).xyz; }
  return unpackRGBA(u.colorBaseT).xyz;
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  float2 local = quadLocal(vid);

  float dw = u.domainEnd - u.domainStart;
  float2 dom = float2(u.domainStart, u.domainEnd);
  float x1 = (inst.position - dom.x) / dw * 2.0 - 1.0;
  float x2 = (inst.position + 1.0 - dom.x) / dw * 2.0 - 1.0;
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
  o.color = float4(snpColor(inst.colorType, u), 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}
