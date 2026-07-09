// Mismatch pass: one colored 1bp rectangle per mismatch base. Also used for
// the softclip-bases overlay (same geometry, same color lookup).
//! targets: wgsl, glsl

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  position  : ATTR0;   // absolute genomic bp
  uint  y         : ATTR1;   // pileup row
  uint  base      : ATTR2;   // ASCII: A=65/97 C=67/99 G=71/103 T=84/116
  float frequency : ATTR3;   // 0..1, fraction of reads with this base
  float qual      : ATTR4;   // per-base Phred quality; 0 = none (softclip pass leaves it 0)
};

float3 baseColor(uint b, Uniforms u) {
  // Non-A/C/G/T bases (e.g. N) hit `default` and use the dedicated N color,
  // matching the Canvas2D path (drawMismatches / drawSoftclipBases) and MAF's
  // resolveCellColor. During show-modifications, writeUniforms swaps colorBaseN
  // to grey along with ACGT.
  switch (b) {
    case 65u: case 97u:  return unpackRGBA(u.colorBaseA).xyz;
    case 67u: case 99u:  return unpackRGBA(u.colorBaseC).xyz;
    case 71u: case 103u: return unpackRGBA(u.colorBaseG).xyz;
    case 84u: case 116u: return unpackRGBA(u.colorBaseT).xyz;
    default:             return unpackRGBA(u.colorBaseN).xyz;
  }
}

[shader("vertex")]
ColorVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  ColorVsOut o;
  float2 local = quadLocal(vid);

  float pxPerBp = u.pxPerBp;
  // Sub-pixel alpha: at <1 px/bp, blend toward full-row alpha based on the
  // per-site frequency so thinly-covered mismatches fade out.
  float alpha = 1.0;
  if (u.filterMismatchesByFrequency != 0 && pxPerBp < 1.0) {
    alpha = frequencyAlpha(pxPerBp, inst.frequency);
  }
  // Fade by base quality: Phred 50+ stays opaque, lower qualities fade toward
  // transparent. qual == 0 (no quality, and the softclip-bases pass) is left
  // untouched. Mirrors the Canvas2D drawMismatches path.
  if (u.mismatchAlpha != 0 && inst.qual > 0.0) {
    alpha *= min(1.0, inst.qual / 50.0);
  }
  if (alpha <= 0.0) { return discardVertex(); }

  float clip1 = bpToClipX(inst.position, u);
  float clip2 = bpToClipX(inst.position + 1u, u);
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
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}
