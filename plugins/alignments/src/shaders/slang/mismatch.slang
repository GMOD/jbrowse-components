// Mismatch pass: one colored 1bp rectangle per mismatch base. Also used for
// the softclip-bases overlay (same geometry, same color lookup).
//! targets: wgsl, glsl
//! export-consts: QUAL_UNAVAILABLE, FREQUENCY_SHIFT, QUAL_SHIFT
//! js-export: qualityFade

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

// "This base carries no quality": a read whose QUAL is absent, and every base of
// the softclip-bases overlay, which shares this shader and has no quality to
// report. 255 rather than 0, because 0 is a REAL Phred score — the worst one —
// and the sentinel has to be a value no base can hold. BAM already spells a
// missing QUAL as 0xFF, the SAM text range stops at 93, and this ramp saturates
// at 50, so 255 was already indistinguishable from opaque; 0 was not.
static const float QUAL_UNAVAILABLE = 255.0;

static const uint ROW_MASK = 0xFFFFu;
static const uint FREQUENCY_SHIFT = 16u;
static const uint QUAL_SHIFT = 24u;

struct Instance {
  uint  position         : ATTR0;   // absolute genomic bp
  uint  rowFrequencyQual : ATTR1;   // row | frequency byte (255 = every read) << FREQUENCY_SHIFT | Phred byte << QUAL_SHIFT
  uint  base             : ATTR2;   // ASCII: A=65/97 C=67/99 G=71/103 T=84/116
};

float3 baseColor(uint b, Uniforms u) {
  // Non-A/C/G/T bases (e.g. N) hit `default` and use the dedicated N color,
  // matching the Canvas2D path (`buildBaseCssMap`, every base-cell mark) and MAF's
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

// Alpha multiplier for a mismatch of this per-base Phred quality: the linear
// scale `pileup.mismatches.encoding.opacity` folds into `zero` and `slope`
// (`qualityOpacityOf`), clamped to [lo, hi], and 1 for a base that carries no
// quality. Off is lo = hi = 1. `//! js-export`ed, so the Canvas2D and label
// paths run this same ramp.
//
// The guard tests the sentinel, not `> 0`: under `> 0` a Phred 0 base, the
// least trustworthy call in the file, drew fully opaque while Phred 1 vanished.
float qualityFade(float qual, float zero, float slope, float lo, float hi) {
  if (qual != QUAL_UNAVAILABLE) {
    return clamp((qual - zero) * slope, lo, hi);
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
  uint row = inst.rowFrequencyQual & ROW_MASK;
  float frequency = float((inst.rowFrequencyQual >> FREQUENCY_SHIFT) & 0xFFu) / 255.0;
  float qual = float(inst.rowFrequencyQual >> QUAL_SHIFT);
  float alpha = frequencyFade(u.pxPerBp, frequency, u)
              * qualityFade(qual, u.qualityOpacityZero, u.qualityOpacitySlope,
                            u.qualityOpacityMin, u.qualityOpacityMax);
  if (alpha <= 0.0) { return discardVertex(); }

  // `pileupCellX` (alignmentsUniforms) is the snapped, anchored cell span every
  // per-base pileup layer measures from — see it for why the anchor matters.
  float2 xx = pileupCellX(inst.position, u);

  float2 yy = pileupY(float(row), u);

  o.position = flippedQuadPos(xx.x, xx.y, yy.y, yy.x, local, u);
  o.color = float4(baseColor(inst.base, u), alpha);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}
