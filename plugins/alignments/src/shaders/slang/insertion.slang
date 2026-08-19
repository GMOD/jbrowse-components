// Insertion pass: renders up to 3 rects per instance — the insertion bar
// (or numeric label box when long + zoomed), plus top/bottom serifs.
//! targets: wgsl, glsl
//! export-consts: LONG_INSERTION_MIN_LENGTH, LONG_INSERTION_TEXT_THRESHOLD_PX, MIN_HEIGHT_FOR_TEXT, INSERTION_SERIF_MIN_PX_PER_BP, SERIF_HALF_W_PX, SERIF_H_PX
//! consts-out: packages/alignments-core/src/insertionLabel.generated.ts
//! js-export: insertionBarWidthPx, textWidth, insertionSizeAlpha
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

// The serif cap: a wedge `SERIF_HALF_W_PX` either side of the bar, tapering to
// a point `SERIF_H_PX` into the row. Two caps, mirrored, so a small insertion
// reads as an I-beam rather than a bare tick.
//
// Exported for the same reason the four above are: `drawInsertionMarker` in
// @jbrowse/alignments-core draws these caps for the Canvas2D and SVG paths and
// for three other plugins, and the two spellings had drifted into different
// glyphs — this pass drew 3x1px RECTANGLES placed OUTSIDE the row (clip-space
// `syTop + th` is above the top edge), while the CPU drew 4x2px TRIANGLES
// inside it. On a small insertion the bar is 1px, so the caps are most of the
// mark, and the on-screen GPU render disagreed with its own SVG export.
static const float SERIF_HALF_W_PX = 2.0;
static const float SERIF_H_PX = 2.0;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  position  : ATTR0;
  uint  y         : ATTR1;
  uint  length    : ATTR2;
  float frequency : ATTR3;
};

// Width of the count-label box: one char per digit plus padding.
//
// `//! js-export`ed as `textWidthForNumber` (see js-export-out): the Canvas2D
// path draws the actual text into this box, so it has to size it identically or
// the digits overflow. It used to export the two constants instead and mirror
// the digit-count branching by hand in labelConstants.ts — which is a twin, and
// the reason adr-051 exists.
static const float LABEL_CHAR_W = 6.0;
static const float LABEL_PAD = 10.0;

float textWidth(uint num) {
  if (num < 10u)    { return LABEL_CHAR_W + LABEL_PAD; }
  if (num < 100u)   { return LABEL_CHAR_W * 2.0 + LABEL_PAD; }
  if (num < 1000u)  { return LABEL_CHAR_W * 3.0 + LABEL_PAD; }
  if (num < 10000u) { return LABEL_CHAR_W * 4.0 + LABEL_PAD; }
  return LABEL_CHAR_W * 5.0 + LABEL_PAD;
}

// alignmentsUniforms' sizeAlpha in the unit an insertion has: an insertion
// consumes no reference span, so unlike a deletion its marker has no width of
// its own to measure — the inserted SEQUENCE's span is what stands in. At
// base-level zoom a 1bp insertion is pxPerBp wide and draws in full; by the
// time a screen holds megabases only a kilobase-scale one still covers a pixel.
float insertionSizeAlpha(uint length, float pxPerBp) {
  return sizeAlpha(float(length) * pxPerBp);
}

// The insertion marker's width in CSS px — three cases, in order of how much
// room the marker has earned:
//
//   large: wide enough for the count label, and in a row tall enough to draw it
//   long:  a short noticeable bar, between 1 and 5px
//   small: a 1px tick
//
// The `long` bar is floored at 1px for the same reason the `small` tick IS 1px:
// below that a marker is sub-pixel and rasterizes to a fraction of one column's
// coverage on either backend. Without the floor the width was NOT monotonic in
// length — `min(5, insWPx/3)` drops under 1 whenever the insertion spans less
// than 3 screen px, so at 10bp/px a 10-29bp insertion drew *narrower and
// fainter* than a 5bp one (0.33-0.97px against a hard 1.0), and at 20bp/px the
// whole 10-99bp range did. That is exactly the size range long-read SV calls
// live in, and `long` insertions deliberately never frequency-fade, so nothing
// downstream compensated.
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
  if (isLong)  { return clamp(insWPx / 3.0, 1.0, 5.0); }
  return 1.0;
}

// One corner of a serif cap: a wedge whose base is `halfWClip` either side of
// `cx` at `baseY`, tapering to a point at `apexY`. The taper is what makes it a
// triangle rather than a box — the quad's far edge collapses onto the apex, so
// its second triangle is degenerate and rasterizes to nothing.
//
// A cap can't go through `flippedQuadPos` because its x depends on local.y,
// which is exactly the difference this replaces: the cap used to be a plain
// quad, and a quad is the one thing the CPU twin was not drawing.
float4 serifPos(float cx, float baseY, float apexY, float halfWClip, float2 local, Uniforms u) {
  float x = cx + halfWClip * (2.0 * local.x - 1.0) * (1.0 - local.y);
  return float4(flipX(x, u), lerp(baseY, apexY, local.y), 0.0, 1.0);
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

  bool serifs = !isLong && pxPerBp >= INSERTION_SERIF_MIN_PX_PER_BP;
  if (rectIdx != 0u && !serifs) { return discardVertex(); }

  if (rectIdx == 0u) {
    o.position = flippedQuadPos(cx - rectWClip * 0.5, cx + rectWClip * 0.5,
                                syBot, syTop, local, u);
  } else if (rectIdx == 1u) {
    // Top cap: base on the row's top edge, point down into the row. Clip y
    // decreases downward, hence the subtraction.
    o.position = serifPos(cx, syTop, syTop - serifHClip, serifHalfWClip, local, u);
  } else {
    o.position = serifPos(cx, syBot, syBot + serifHClip, serifHalfWClip, local, u);
  }
  o.color = float4(unpackRGBA(u.colorInsertion).xyz, alpha);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}
