// Overlap overlay: a full-row-height quad over the genomic interval where two
// features that share a row both align. Two layouts put more than one feature on
// a row, they mean different things by it, and this pass paints them
// differently — the branch is `u.chainMode`, and the draw-call gate
// (`shouldDrawOverlaps`, featureHeight >= 3) is the same for both.
//
// CHAIN (view-as-pairs / linked supplementary): two segments of ONE molecule.
// The span is the junction between them, and the junction is a SPAN rather than
// a point — which is exactly what the pileup cannot show on its own, since the
// two segments paint over each other and leave a clean edge at whichever one
// drew last. So the span is filled with a theme neutral (`u.colorOverlap`) that
// is no read category: "both segments are here, neither colour is the answer".
// Tinting instead was the older behaviour and says the opposite — on a foldback
// the arms are opposite-strand red and blue, and a 40% wash over whichever drew
// last reads as a stronger version of that one arm.
//
// COLLAPSED GROUP ROWS: several unrelated reads sharing a row on purpose, where
// the count is the point. Spans are deliberately not merged upstream, so the
// tint STACKS and depth reads as weight. That is why this is a branch rather
// than a replacement — and why the tint is `u.colorOverlapTint`, the theme's
// foreground: it was a literal black, which on a dark ground composes toward the
// ground and made depth read as nothing at all.
//
// Both fade with on-screen width so sub-pixel overlaps (zoomed out) disappear.
// Source of truth for both: features/overlap/drawCanvas.ts (Canvas2D) runs the
// generated `overlapFade`/`overlapAlpha` below, so the two paths cannot drift.
//! targets: wgsl, glsl
//! js-export: overlapAlpha, overlapFade
//! export-consts: OVERLAP_ALPHA, FADE_LO_PX, FADE_HI_PX

import alignmentsUniforms;
// for unpackRGBA — an import does not re-export through alignmentsUniforms
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

// Collapsed-rows tint at full strength; the px-width fade scales it down for
// narrow overlaps. Kept low so it can stack a few deep before saturating.
static const float OVERLAP_ALPHA = 0.4;
// On-screen width (CSS px) where the mark starts to appear / reaches full alpha.
static const float FADE_LO_PX = 1.5;
static const float FADE_HI_PX = 12.0;

// How much of the mark an overlap of this on-screen width gets, 0..1. Chain mode
// spends it as the opacity of an opaque fill (so a narrow overlap fades in over
// the reads rather than popping); collapsed mode spends it on the tint below.
float overlapFade(float pxWidth) {
  return smoothstep(FADE_LO_PX, FADE_HI_PX, pxWidth);
}

// Collapsed-rows tint strength at this on-screen width. `//! js-export`ed:
// drawCanvas.ts had the same product of a constant and a smoothstep, plus its
// own hand-written `smoothstep`, which is two chances to drift over one number.
float overlapAlpha(float pxWidth) {
  return OVERLAP_ALPHA * overlapFade(pxWidth);
}

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
  float pxW = clipLenToPx(sx2 - sx1, u.canvasW);
  float fade = overlapFade(pxW);
  if (fade <= 0.0) { return discardVertex(); }

  // both branches spelled through the js-exported helpers, which is also what
  // keeps them exported: slangc drops a function no entry point reaches
  bool chain = u.chainMode != 0;
  float3 tint =
    unpackRGBA(chain ? u.colorOverlap : u.colorOverlapTint).xyz;
  float alpha = chain ? fade : overlapAlpha(pxW);

  float2 yy = pileupY(inst.y, u);

  o.position = flippedQuadPos(sx1, sx2, yy.y, yy.x, local, u);
  o.color = float4(tint, alpha);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}
