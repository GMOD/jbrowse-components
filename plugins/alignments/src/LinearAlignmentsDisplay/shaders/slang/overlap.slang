// Chain overlap overlay: a full-row-height quad over the genomic interval where
// two reads in the same chain (same row) overlap. Paints a mild semi-transparent
// dark tint so the overlapped span darkens the reads underneath rather than
// blacking them out. The tint fades with on-screen width so wide/zoomed-in
// overlaps read clearly while sub-pixel overlaps (zoomed out) disappear.
// Row-height gating happens at the draw call (featureHeight >= 3).
// Mirrors drawOverlaps() in features/overlap/drawCanvas.ts — keep constants in sync.
//! targets: wgsl, glsl

import alignmentsUniforms;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

// Mild dark tint at full strength; the px-width fade scales it down for narrow
// overlaps. Kept low so the underlying read color still shows through.
static const float3 OVERLAP_TINT = float3(0.0, 0.0, 0.0);
static const float OVERLAP_ALPHA = 0.4;
// On-screen width (CSS px) where the tint starts to appear / reaches full alpha.
static const float FADE_LO_PX = 1.5;
static const float FADE_HI_PX = 12.0;

struct Instance {
  uint  startOff : ATTR0;
  uint  endOff   : ATTR1;
  float y        : ATTR2;
};

[shader("vertex")]
ColorVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  ColorVsOut o;
  float2 local = quadLocal(vid);

  float sx1 = bpToClipX(inst.startOff, u);
  float sx2 = bpToClipX(inst.endOff, u);

  // Clip-space width → CSS px (clip spans [-1,1] across canvasW). flipX doesn't
  // change width, so it's safe to measure before flipping.
  float pxWidth = (sx2 - sx1) * 0.5 * u.canvasW;
  float alpha = OVERLAP_ALPHA * smoothstep(FADE_LO_PX, FADE_HI_PX, pxWidth);
  if (alpha <= 0.0) { return discardVertex(); }

  float2 yy = pileupY(inst.y, u);

  o.position = float4(
    flipX(lerp(sx1, sx2, local.x), u),
    lerp(yy.y, yy.x, local.y),
    0.0, 1.0);
  o.color = float4(OVERLAP_TINT, alpha);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}
