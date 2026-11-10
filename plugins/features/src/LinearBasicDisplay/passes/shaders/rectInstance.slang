// Per-instance layout shared by rect and continuation. Continuation draws from
// rect's vertex buffer, so both must declare identical attribute locations and
// types; lineInstance.slang does the same for line and chevron.
//
// Rect ignores `strand`, and continuation reads `densityFade` only for the INSET
// bit. One 28-byte instance spares continuation a second per-region pack and
// upload.
//! export-consts: RECT_FLAG_DENSITY_FADE, RECT_FLAG_SPARSE_EXONS, RECT_FLAG_INSET, INSET_HEIGHT_FRACTION
//! js-export: rectBoxYPx
module rectInstance;

import hpmath;

// Bits of the `densityFade` lane. The main-thread layout sets DENSITY_FADE, for
// a collapsed row-0 box sharing pixels with others, and SPARSE_EXONS, for an
// exon of a transcript with room to widen it. The worker sets INSET on a box it
// emits at its row's full height for the passes to thin in pixels: a UTR, or a
// retrotransposon body between its LTRs.
public static const uint RECT_FLAG_DENSITY_FADE = 1u;
public static const uint RECT_FLAG_SPARSE_EXONS = 2u;
public static const uint RECT_FLAG_INSET = 4u;
public static const float INSET_HEIGHT_FRACTION = 0.65;

public struct RectInstance {
  public uint2 startEnd : ATTR0;
  public float y        : ATTR1;
  public float height   : ATTR2;
  public uint  color    : ATTR3;
  public uint  densityFade : ATTR4;
  // Genomic strand (-1, 0 or +1), which the continuation markers point along; 0
  // points them out of the edge.
  public float strand   : ATTR5;
};

// The pixel row a box's top lands on and its pixel height. An inset box is
// thinned from its row's SNAPPED height rather than snapped from a fractional
// one, so it keeps at least a pixel of its row clear above and below wherever
// the row is 3 pixels or more: rounding a 0.65-scale box on its own drew a UTR
// as tall as the CDS beside it at superCompact's 3px row.
public float2 rectBoxYPx(float y, float height, bool inset, float scrollY) {
  float top = snapBoxTopPx(y, height, scrollY);
  float h = snapBoxHeightPx(height);
  float insetPx = inset && h >= 3.0
    ? max(1.0, floor(h * (1.0 - INSET_HEIGHT_FRACTION) * 0.5 + 0.5))
    : 0.0;
  return float2(top + insetPx, h - 2.0 * insetPx);
}
