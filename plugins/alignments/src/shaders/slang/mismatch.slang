// Mismatch pass: one colored 1bp rectangle per mismatch base. Also used for
// the softclip-bases overlay (same geometry, same color lookup).
//! targets: wgsl, glsl
//! js-export: qualityFade

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

// Phred quality at and above which a mismatch stays fully opaque. Everything
// below fades linearly toward transparent.
static const float OPAQUE_QUAL = 50.0;

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

// Alpha multiplier for a mismatch of this per-base Phred quality: 1 when the
// setting is off, 1 when the base carries no quality (qual == 0, which is also
// what the softclip-bases pass packs), and a linear ramp to OPAQUE_QUAL
// otherwise. `//! js-export`ed: features/mismatch/drawCanvas.ts carried the
// same three-way conditional under a "Mirrors the GPU mismatch.slang path"
// comment, which is the whole setting's behavior kept in agreement by eye.
float qualityFade(float qual, bool enabled) {
  if (enabled && qual > 0.0) {
    return min(1.0, qual / OPAQUE_QUAL);
  }
  return 1.0;
}

[shader("vertex")]
ColorVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  ColorVsOut o;
  float2 local = quadLocal(vid);

  // Sub-pixel alpha: at <1 px/bp, blend toward full-row alpha based on the
  // per-site frequency so thinly-covered mismatches fade out. The softclip-base
  // pass shares this shader and packs full frequency, pinning its alpha at 1.
  float alpha = frequencyFade(u.pxPerBp, inst.frequency, u)
              * qualityFade(inst.qual, u.mismatchAlpha != 0);
  if (alpha <= 0.0) { return discardVertex(); }

  // `pileupCellX` (alignmentsUniforms) is the snapped, anchored cell span every
  // per-base pileup layer measures from — see it for why the anchor matters.
  float2 xx = pileupCellX(inst.position, u);

  float2 yy = pileupY(float(inst.y), u);

  o.position = flippedQuadPos(xx.x, xx.y, yy.y, yy.x, local, u);
  o.color = float4(baseColor(inst.base, u), alpha);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}
