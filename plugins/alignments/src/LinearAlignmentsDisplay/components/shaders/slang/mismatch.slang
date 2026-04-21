// Mismatch pass: one colored 1bp rectangle per mismatch base. Also used for
// the softclip-bases overlay (same geometry, same color lookup).
//! targets: wgsl, glsl

import alignmentsUniforms;
import colorPack;
import hpmath;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  position  : ATTR0;   // absolute genomic bp
  uint  y         : ATTR1;   // pileup row
  uint  base      : ATTR2;   // ASCII: A=65/97 C=67/99 G=71/103 T=84/116
  float frequency : ATTR3;   // 0..1, fraction of reads with this base
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

float3 baseColor(uint b, Uniforms u) {
  if (b == 65u || b == 97u)  { return unpackRGBA(u.colorBaseA).xyz; }
  if (b == 67u || b == 99u)  { return unpackRGBA(u.colorBaseC).xyz; }
  if (b == 71u || b == 103u) { return unpackRGBA(u.colorBaseG).xyz; }
  if (b == 84u || b == 116u) { return unpackRGBA(u.colorBaseT).xyz; }
  return float3(0.5);
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  float2 local = quadLocal(vid);

  float pxPerBp = u.canvasW / u.bpLen;

  // Sub-pixel alpha: at <1 px/bp, blend toward full-row alpha based on the
  // per-site frequency so thinly-covered mismatches fade out.
  float alpha = 1.0;
  if (pxPerBp < 1.0) {
    alpha = pxPerBp + inst.frequency * (1.0 - pxPerBp);
  }
  if (alpha <= 0.0) {
    o.position = float4(0.0);
    o.color = float4(0.0);
    return o;
  }

  float clip1 = hpClipX(hpSplitUint(inst.position), u);
  float clip2 = hpClipX(hpSplitUint(inst.position + 1u), u);
  float sx1 = snapToPixelX(clip1, u.canvasW);
  float sx2 = max(sx1 + 2.0 / u.canvasW, snapToPixelX(clip2, u.canvasW));
  float sx = lerp(sx1, sx2, local.x);

  float2 yy = pileupY(float(inst.y), u);
  float sy = lerp(yy.y, yy.x, local.y);

  o.position = float4(flipX(sx, u), sy, 0.0, 1.0);
  o.color = float4(baseColor(inst.base, u), alpha);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}
