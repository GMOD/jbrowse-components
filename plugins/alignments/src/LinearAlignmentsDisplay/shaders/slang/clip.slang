// Clip pass (soft + hard combined): draws a thin colored bar at a clip
// boundary. `kind` = 0 → use u.colorSoftclip, `kind` = 1 → u.colorHardclip.
// Bar is always 1 CSS pixel wide (enforced by a 1px minimum).
//! targets: wgsl, glsl

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  position  : ATTR0;
  uint  y         : ATTR1;
  float frequency : ATTR2;
  uint  kind      : ATTR3;  // 0 = softclip, 1 = hardclip
};

[shader("vertex")]
ColorVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  ColorVsOut o;
  float2 local = quadLocal(vid);

  float pxPerBp = u.pxPerBp;

  // Sub-pixel alpha: at <1 px/bp, thinly-supported clip boundaries fade out.
  // Mirrors the Canvas2D drawClipBars path.
  float alpha = frequencyFade(pxPerBp, inst.frequency, u);
  if (alpha <= 0.0) { return discardVertex(); }

  float clipCx = bpToClipX(inst.position, u);
  float halfWClip = 1.0 / u.canvasW;
  float sx1 = clipCx - halfWClip;
  float sx2 = clipCx + halfWClip;

  float2 yy = pileupY(float(inst.y), u);
  o.position = flippedQuadPos(sx1, sx2, yy.y, yy.x, local, u);
  float3 c = (inst.kind == 0u) ? unpackRGBA(u.colorSoftclip).xyz : unpackRGBA(u.colorHardclip).xyz;
  o.color = float4(c, alpha);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}
