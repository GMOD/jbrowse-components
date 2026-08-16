// Gap pass: deletion (rect) or skip (1px centerline) per CIGAR D/N op.
//! targets: wgsl, glsl
//! js-export: intronAlpha
//! export-consts: GAP_DELETION, GAP_SKIP

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;

// What `gapTypes[i]` means. The worker writes it, the branches below read it,
// and so do drawGaps, the hit test, the base-pair sort, the label walk and the
// tooltip — seven sites that each hand-spelled the literal. `export-consts` is
// the move insertion.slang already made for its own thresholds.
static const uint GAP_DELETION = 0u;
static const uint GAP_SKIP     = 1u;

// Introns (skip/N gaps) draw as 1px centerlines; once reads get compact the
// per-row centerlines pack together into a solid smear. Fade them toward
// INTRON_MIN_ALPHA as the read height shrinks so dense splice pileups stay
// legible — full opacity at the default 7px, fading only at the compact end.
//
// `//! js-export`ed: the Canvas2D path draws the same centerlines and had this
// open-coded, down to a hand-expanded smoothstep, under comments on both sides
// asking the next person to keep the bounds and the floor in step.
static const float INTRON_FADE_MIN_PX = 1.0;
static const float INTRON_FADE_MAX_PX = 4.0;
static const float INTRON_MIN_ALPHA   = 0.25;

float intronAlpha(float featHeight) {
  return INTRON_MIN_ALPHA
    + (1.0 - INTRON_MIN_ALPHA)
      * smoothstep(INTRON_FADE_MIN_PX, INTRON_FADE_MAX_PX, featHeight);
}

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

  // Widen to a minimum of 1 CSS px, as drawGaps' `Math.max(1, widthPx)` does:
  // a few-bp deletion is sub-pixel at ordinary zoom, and without this it
  // rasterized to partial coverage (or nothing) on the GPU while Canvas2D and
  // SVG export drew a full 1px mark. The alpha fade below is what's meant to
  // thin these out, not the geometry.
  float2 xx = expandMinWidthX(
    bpToClipX(inst.startOff, u), bpToClipX(inst.endOff, u), u.canvasW);
  float sx1 = xx.x;
  float sx2 = xx.y;

  float2 yy = pileupY(float(inst.y), u);
  float yTop = yy.x;
  float yBot = yy.y;

  float alpha = 1.0;

  if (inst.gapType == GAP_SKIP) {
    // Collapse to a 1px centerline for introns / skipped regions, centered on
    // the row's midpoint — the same band drawGaps fills at `midY - 0.5`.
    float mid = (yTop + yBot) * 0.5;
    float halfPx = 1.0 / u.canvasH;
    yTop = mid + halfPx;
    yBot = mid - halfPx;
    alpha = intronAlpha(u.featHeight);
  }
  if (inst.gapType == GAP_DELETION) {
    // A deletion HAS a reference span, so its own width is the measure — the
    // same quantity the frequency fade squares, and the reason that fade takes
    // widthPx² rather than pxPerBp². sizeAlpha is still needed on top of it:
    // the frequency lerp returns 1 for a site every read carries no matter how
    // sub-pixel it is, so without this a chain's every D op painted a
    // full-opacity 1px bar across a megabase-wide frame. Skips are exempt —
    // an intron is a long span drawn as a centerline, and intronAlpha above is
    // its own rule.
    float widthPx = float(inst.endOff - inst.startOff) * u.pxPerBp;
    alpha = frequencyFade(widthPx * widthPx, inst.frequency, u) * sizeAlpha(widthPx);
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
