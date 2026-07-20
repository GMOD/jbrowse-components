// Gap pass: deletion (rect) or skip (1px centerline) per CIGAR D/N op.
//! targets: wgsl, glsl

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
static const uint GAP_DELETION = 0u;
static const uint GAP_SKIP     = 1u;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  startOff  : ATTR0;
  uint  endOff    : ATTR1;
  uint  y         : ATTR2;
  uint  gapType   : ATTR3;  // 0 = deletion, 1 = skip
  float frequency : ATTR4;
};

[shader("vertex")]
ColorVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  ColorVsOut o;
  float2 local = quadLocal(vid);

  float sx1 = bpToClipX(inst.startOff, u);
  float sx2 = bpToClipX(inst.endOff, u);

  float2 yy = pileupY(float(inst.y), u);
  float yTop = yy.x;
  float yBot = yy.y;

  float alpha = 1.0;

  if (inst.gapType == GAP_SKIP) {
    // Collapse to a 1px centerline for introns / skipped regions.
    float mid = (yTop + yBot) * 0.5;
    float onePx = 2.0 / u.canvasH;
    yTop = mid;
    yBot = mid - onePx;
    // Fade introns toward 0.25 as reads get compact so dense splice pileups
    // stay legible. Mirrors intronAlpha() in renderers/rendererTypes.ts — keep
    // the smoothstep bounds (1..4 px) and floor (0.25) in sync.
    alpha = 0.25 + 0.75 * smoothstep(1.0, 4.0, u.featHeight);
  }
  if (inst.gapType == GAP_DELETION) {
    float widthPx = float(inst.endOff - inst.startOff) * u.pxPerBp;
    alpha = frequencyFade(widthPx * widthPx, inst.frequency, u);
  }
  if (alpha <= 0.0) { return discardVertex(); }

  o.position = flippedQuadPos(sx1, sx2, yBot, yTop, local, u);
  float3 c = (inst.gapType == GAP_DELETION) ? unpackRGBA(u.colorDeletion).xyz : unpackRGBA(u.colorSkip).xyz;
  o.color = float4(c, alpha);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}
