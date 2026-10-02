// The insertion glyph's geometry: the marker's width, its serif caps, and
// whether it outgrows the reference span it stands on. The pileup's insertion
// pass and alignments-core's `insertion` mark both import it, and the Canvas2D,
// SVG and hit-test paths run its generated twins (adr-051).
//
// A marker is a 1px tick (small), a 1-5px bar (long), or a box sized for its
// count label (large: long, zoomed in past LONG_INSERTION_TEXT_THRESHOLD_PX,
// and in a row at least MIN_HEIGHT_FOR_TEXT tall). The long bar floors at 1px
// so the width stays monotonic in length; a sub-pixel bar rasterizes to a
// fraction of a column on either backend.
//
// Serif caps are wedges SERIF_HALF_W_PX either side of the bar, tapering
// SERIF_H_PX into the row, on small insertions zoomed in past
// INSERTION_SERIF_MIN_PX_PER_BP.
//! export-consts: LONG_INSERTION_MIN_LENGTH, LONG_INSERTION_TEXT_THRESHOLD_PX, MIN_HEIGHT_FOR_TEXT, INSERTION_SERIF_MIN_PX_PER_BP, SERIF_HALF_W_PX, SERIF_H_PX
//! consts-out: packages/alignments-core/src/insertionLabel.generated.ts
//! js-export: insertionBarWidthPx, textWidth, insertionSerifsDraw, insertionMarkerDraws
//! js-export-out: packages/alignments-core/src/insertionWidth.generated.ts
module insertionGlyph;

public static const uint  LONG_INSERTION_MIN_LENGTH = 10u;
public static const float LONG_INSERTION_TEXT_THRESHOLD_PX = 15.0;
public static const float INSERTION_SERIF_MIN_PX_PER_BP = 3.0;
public static const float MIN_HEIGHT_FOR_TEXT = 5.0;
public static const float SERIF_HALF_W_PX = 2.0;
public static const float SERIF_H_PX = 2.0;

static const float LABEL_CHAR_W = 6.0;
static const float LABEL_PAD = 10.0;

public float textWidth(uint num) {
  if (num < 10u)    { return LABEL_CHAR_W + LABEL_PAD; }
  if (num < 100u)   { return LABEL_CHAR_W * 2.0 + LABEL_PAD; }
  if (num < 1000u)  { return LABEL_CHAR_W * 3.0 + LABEL_PAD; }
  if (num < 10000u) { return LABEL_CHAR_W * 4.0 + LABEL_PAD; }
  return LABEL_CHAR_W * 5.0 + LABEL_PAD;
}

public float insertionBarWidthPx(uint length, float pxPerBp, float featHeight) {
  float insWPx = float(length) * pxPerBp;
  bool isLong = length >= LONG_INSERTION_MIN_LENGTH;
  bool isLarge = isLong
    && insWPx >= LONG_INSERTION_TEXT_THRESHOLD_PX
    && featHeight >= MIN_HEIGHT_FOR_TEXT;
  if (isLarge) { return textWidth(length); }
  if (isLong)  { return clamp(insWPx / 3.0, 1.0, 5.0); }
  return 1.0;
}

public bool insertionSerifsDraw(uint length, float pxPerBp) {
  return length < LONG_INSERTION_MIN_LENGTH && pxPerBp >= INSERTION_SERIF_MIN_PX_PER_BP;
}

// A marker standing on a reference span draws only where it is wider than
// that span, floored at `spanFloorPx`, the narrowest the span itself paints.
// An interbase insertion has no span and always draws.
public bool insertionMarkerDraws(float barWidthPx, float spanPx, float spanFloorPx) {
  return barWidthPx > max(spanFloorPx, abs(spanPx));
}
