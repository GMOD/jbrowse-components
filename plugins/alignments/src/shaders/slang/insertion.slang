// Insertion pass: renders up to 3 rects per instance — the insertion bar
// (or numeric label box when long + zoomed), plus top/bottom serifs. The
// geometry is render-core's `insertionGlyph`, shared with alignments-core's
// `insertion` mark.
//! targets: wgsl, glsl
//! js-export: insertionSizeAlpha
//! js-export-out: packages/alignments-core/src/insertionSizeAlpha.generated.ts

import alignmentsUniforms;
import colorPack;
import hpmath;
import insertionGlyph;


public static const uint VERTS_PER_INSTANCE = 18u;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  position  : ATTR0;
  uint  y         : ATTR1;
  uint  length    : ATTR2;
  float frequency : ATTR3;
};

// alignmentsUniforms' sizeAlpha in the unit an insertion has: an insertion
// consumes no reference span, so unlike a deletion its marker has no width of
// its own to measure — the inserted SEQUENCE's span is what stands in. At
// base-level zoom a 1bp insertion is pxPerBp wide and draws in full; by the
// time a screen holds megabases only a kilobase-scale one still covers a pixel.
float insertionSizeAlpha(uint length, float pxPerBp) {
  return sizeAlpha(float(length) * pxPerBp);
}

[shader("vertex")]
ColorVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  ColorVsOut o;
  uint rectIdx = vid / 6u;
  float2 local = quadLocal(vid);

  float pxPerBp = u.pxPerBp;
  float cx = bpToClipX(inst.position, u);

  bool isLong = inst.length >= LONG_INSERTION_MIN_LENGTH;
  float rectW = insertionBarWidthPx(inst.length, pxPerBp, u.featHeight);

  float rectWClip = pxToClipLen(rectW, u.canvasW);
  float serifHalfWClip = pxToClipLen(SERIF_HALF_W_PX, u.canvasW);
  float serifHClip = pxToClipLen(SERIF_H_PX, u.canvasH);

  float2 yy = pileupY(float(inst.y), u);
  float syTop = yy.x;
  float syBot = yy.y;

  // Long insertions draw as a fixed marker and never frequency-fade. They do
  // still fade by size — see insertionSizeAlpha, which is the gate that answers
  // "is this resolvable at this zoom" rather than "is this site rare".
  float alpha = (isLong ? 1.0 : frequencyFade(pxPerBp * pxPerBp, inst.frequency, u))
    * insertionSizeAlpha(inst.length, pxPerBp);
  if (alpha <= 0.0) { return discardVertex(); }

  bool serifs = insertionSerifsDraw(inst.length, pxPerBp);
  if (rectIdx != 0u && !serifs) { return discardVertex(); }

  if (rectIdx == 0u) {
    o.position = flippedQuadPos(cx - rectWClip * 0.5, cx + rectWClip * 0.5,
                                syBot, syTop, local, u);
  } else {
    // Each cap stands on its row edge and points into the row; clip y runs up,
    // so the top cap's depth is negative.
    bool topCap = rectIdx == 1u;
    float2 p = insertionSerifCorner(local.x, local.y, cx, topCap ? syTop : syBot,
                                    serifHalfWClip, topCap ? -serifHClip : serifHClip);
    o.position = float4(flipX(p.x, u), p.y, 0.0, 1.0);
  }
  o.color = float4(unpackRGBA(u.colorInsertion).xyz, alpha);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}
