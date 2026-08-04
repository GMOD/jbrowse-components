// Insertion pass: renders up to 3 rects per instance — the insertion bar
// (or numeric label box when long + zoomed), plus top/bottom serifs.
//! targets: wgsl, glsl
//! export-consts: LABEL_CHAR_W, LABEL_PAD, LONG_INSERTION_MIN_LENGTH, LONG_INSERTION_TEXT_THRESHOLD_PX, MIN_HEIGHT_FOR_TEXT, INSERTION_SERIF_MIN_PX_PER_BP
//! consts-out: packages/alignments-core/src/insertionLabel.generated.ts
//! js-export: insertionBarWidthPx
//! js-export-out: packages/alignments-core/src/insertionWidth.generated.ts

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 18u;
// The four thresholds that decide which of the three insertion markers gets
// drawn, and whether its serif caps do. Exported to @jbrowse/alignments-core
// (see consts-out) because the Canvas2D/SVG renderer, the hit test and
// plugin-maf all classify insertions against them; they used to be re-typed
// there under a SYNC tag.
static const uint  LONG_INSERTION_MIN_LENGTH = 10u;
static const float LONG_INSERTION_TEXT_THRESHOLD_PX = 15.0;
static const float INSERTION_SERIF_MIN_PX_PER_BP = 3.0;
static const float MIN_HEIGHT_FOR_TEXT = 5.0;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  position  : ATTR0;
  uint  y         : ATTR1;
  uint  length    : ATTR2;
  float frequency : ATTR3;
};

// Width of the count-label box: one char per digit plus padding. The two
// numbers are exported to @jbrowse/alignments-core (see the consts-out
// directive above) and read by textWidthForNumber(), the Canvas2D twin that
// actually measures the text, so the GPU box can't size differently from the
// label drawn into it.
static const float LABEL_CHAR_W = 6.0;
static const float LABEL_PAD = 10.0;

float textWidth(uint num) {
  if (num < 10u)    { return LABEL_CHAR_W + LABEL_PAD; }
  if (num < 100u)   { return LABEL_CHAR_W * 2.0 + LABEL_PAD; }
  if (num < 1000u)  { return LABEL_CHAR_W * 3.0 + LABEL_PAD; }
  if (num < 10000u) { return LABEL_CHAR_W * 4.0 + LABEL_PAD; }
  return LABEL_CHAR_W * 5.0 + LABEL_PAD;
}

// The insertion marker's width in CSS px — three cases, in order of how much
// room the marker has earned:
//
//   large: wide enough for the count label, and in a row tall enough to draw it
//   long:  a short noticeable bar, capped at 5px
//   small: a 1px tick
//
// `//! js-export`ed to @jbrowse/alignments-core (see js-export-out), because
// this width is not just the shader's: the Canvas2D/SVG renderer, hit-testing
// in both plugin-alignments and plugin-maf, and SNP-letter shadowing all have
// to agree on exactly where an insertion marker's edges are. It was a
// hand-written mirror in labelConstants.ts, with these three thresholds
// re-typed alongside it.
float insertionBarWidthPx(uint length, float pxPerBp, float featHeight) {
  float insWPx = float(length) * pxPerBp;
  bool isLong = length >= LONG_INSERTION_MIN_LENGTH;
  bool isLarge = isLong
    && insWPx >= LONG_INSERTION_TEXT_THRESHOLD_PX
    && featHeight >= MIN_HEIGHT_FOR_TEXT;
  if (isLarge) { return textWidth(length); }
  if (isLong)  { return min(5.0, insWPx / 3.0); }
  return 1.0;
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

  float onePx = 2.0 / u.canvasW;
  float rectWClip = rectW * 2.0 / u.canvasW;
  float tickWClip = onePx * 3.0;

  float2 yy = pileupY(float(inst.y), u);
  float syTop = yy.x;
  float syBot = yy.y;

  float x1, x2, y1, y2;
  if (rectIdx == 0u) {
    x1 = cx - rectWClip * 0.5;
    x2 = cx + rectWClip * 0.5;
    y1 = syBot;
    y2 = syTop;
  } else if (rectIdx == 1u) {
    if (isLong || pxPerBp < INSERTION_SERIF_MIN_PX_PER_BP) {
      x1 = cx; x2 = cx; y1 = syTop; y2 = syTop;  // degenerate
    } else {
      x1 = cx - tickWClip * 0.5;
      x2 = cx + tickWClip * 0.5;
      float th = 2.0 / u.canvasH;
      y1 = syTop; y2 = syTop + th;
    }
  } else {
    if (isLong || pxPerBp < INSERTION_SERIF_MIN_PX_PER_BP) {
      x1 = cx; x2 = cx; y1 = syBot; y2 = syBot;
    } else {
      x1 = cx - tickWClip * 0.5;
      x2 = cx + tickWClip * 0.5;
      float th = 2.0 / u.canvasH;
      y1 = syBot - th; y2 = syBot;
    }
  }

  // Long insertions draw as a fixed marker and never frequency-fade.
  float alpha = isLong ? 1.0 : frequencyFade(pxPerBp * pxPerBp, inst.frequency, u);
  if (alpha <= 0.0) { return discardVertex(); }

  o.position = flippedQuadPos(x1, x2, y1, y2, local, u);
  o.color = float4(unpackRGBA(u.colorInsertion).xyz, alpha);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}
