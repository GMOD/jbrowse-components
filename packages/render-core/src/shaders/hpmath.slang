// Shared high-precision genome-coordinate math. HP technique from genome-spy
// (MIT): https://github.com/genome-spy/genome-spy
//
// Imported via `import hpmath;` from shaders that need sub-pixel-accurate
// conversion of base-pair positions to clip space when zoomed far in.
//
// The `js-export` set is the px-space *decisions* the Canvas2D and SVG paths
// must make identically to the GPU — which pixel row a glyph centers on, how a
// sub-pixel span is widened. `pnpm gen:shaders` transliterates them into
// hpmath.js.generated.ts; nothing downstream re-derives them by hand.
//! js-export: snapBoxHeightPx, snapBoxCenterYPx, extendToMinWidthPx
//! js-skip: hpSplitUint — the hi/lo float32 precision split exists because a GPU has no float64; the Canvas2D path just uses a number
//! js-skip: quadLocal — maps a vertex id to a quad corner — Canvas2D has no vertices, it calls fillRect
//! js-skip: yPxToClipY — clip space is the GPU coordinate system; the px-space decision it wraps is what gets exported (snapBoxCenterYPx and friends)
//! js-skip: clipXToPx — the x half of the same clip-space conversion, and the reason a px decision can be written once — nothing outside a shader is in clip space
//! js-skip: pxToClipX — the inverse of clipXToPx, same reason
//! js-skip: pxToClipLen — the length half of the same conversion; a px dimension is already in px on the Canvas2D side, so there is nothing to convert
//! js-skip: clipLenToPx — the inverse of pxToClipLen, same reason
//! js-skip: extendToMinWidthX — clip-space wrapper over the exported extendToMinWidthPx, which is the decision
//! js-skip: expandToMinWidthPx — the midpoint rule has no Canvas2D counterpart: the pileup floors a cell width one-sidedly and adds a seam fudge the shader deliberately omits (rendererTypes.ts pileupCellWidth), and the variant matrix floors in physical px against a canvas the Canvas2D twin sizes itself. A different rule, not a twin
//! js-skip: expandToMinWidthX — clip-space wrapper over expandToMinWidthPx, same reason as extendToMinWidthX
//! js-skip: snapToPixelX — clip in, clip out; its px core is `floor(x + 0.5)`, which is Math.round and needs no twin
//! js-skip: snapBoxCenterY — clip-space wrapper over the exported snapBoxCenterYPx
module hpmath;

public static const uint HP_LOW_MASK = 0xFFFu;

public float2 hpSplitUint(uint value) {
  uint lo = value & HP_LOW_MASK;
  uint hi = value - lo;
  return float2(float(hi), float(lo));
}

// `max(-inf)` and `dot()` exist to thwart the compiler — without them it
// collapses (hi_a+lo_a)-(hi_b+lo_b) into one large subtraction and the
// float32 precision the hi/lo split exists to preserve is gone. `hpZero` is
// a tiny CPU-supplied number; `-1/hpZero` is smaller than any real diff.
public float hpToClipX(float2 splitPos, float3 bpRange, float hpZero) {
  float inf = 1.0 / hpZero;
  float step = 2.0 / bpRange.z;
  float hi = max(splitPos.x - bpRange.x, -inf);
  float lo = max(splitPos.y - bpRange.y, -inf);
  return dot(float3(-1.0, hi, lo), float3(1.0, step, step));
}

public float hpScaleLinear(float2 splitPos, float3 bpRange, float hpZero) {
  float inf = 1.0 / hpZero;
  float step = 1.0 / bpRange.z;
  float hi = max(splitPos.x - bpRange.x, -inf);
  float lo = max(splitPos.y - bpRange.y, -inf);
  return dot(float2(hi, lo), float2(step, step));
}

// Exact-as-possible bp offset from a split position to the viewport start
// stored in bpRange.xy. Subtracts the hi/lo components separately (same
// ordering as hpToClipX) so the result stays precise at high genomic
// coordinates — recombining bpStartHi+bpStartLo first would lose ~256bp near
// 3e9. Unlike hpToClipX this returns bp, not clip space.
public float hpViewportOffsetBp(float2 splitPos, float3 bpRange) {
  return (bpRange.x - splitPos.x) + (bpRange.y - splitPos.y);
}

public float snapToPixelX(float clipX, float canvasWidth) {
  float px = (clipX + 1.0) * 0.5 * canvasWidth;
  return floor(px + 0.5) / canvasWidth * 2.0 - 1.0;
}

public float yPxToClipY(float yPx, float canvasHeight) {
  return 1.0 - (yPx / canvasHeight) * 2.0;
}

// Tallest box that gets the odd-height nudge below. Above this a half-pixel of
// asymmetry is a small fraction of the box and invisible; at 2px it is half of
// it, so the exons appear to float above their intron line.
public static const float THIN_BOX_PX = 4.0;

// The pixel height a box is drawn at: its rounded height, except that a THIN box
// with an EVEN height is nudged up to the next odd one. A box spanning an even
// number of rows has no middle ROW — its center falls on the seam between two —
// so the 1px glyphs that ride on it (intron line, chevrons, strand arrow) can
// only ever sit half a pixel off center, which at the 2px bodies fit mode
// squeezes down to reads as the exons sitting above the intron line. An odd
// height gives the box a true center row for them to land on. The extra pixel
// can't reach the row below: the packer quantizes row tops to a pitch of at
// least twice the body height at these sizes (see layout.ts pitchY).
// A height that rounds to 0 is left at 0: it draws nothing, and nothing is what
// a caller asking for a zero-height box wants.
public float snapBoxHeightPx(float heightPx) {
  float hPx = floor(heightPx + 0.5);
  bool even = hPx - 2.0 * floor(hPx * 0.5) == 0.0;
  return even && hPx >= 2.0 && hPx <= THIN_BOX_PX ? hPx + 1.0 : hPx;
}

// Center a thin glyph on the *drawn* middle row of the box it annotates, given
// the box's real center `centerY` and height `heightPx`. The box is rasterized
// with the rect shader's edge snapping (top = floor(top+0.5), height =
// snapBoxHeightPx(h)); reproducing that here lands the line/chevron exactly on
// the box's center row instead of the ~1px bias a plain pixel-center snap
// (`floor(centerY - scrollY + 0.5) + 0.5`) gives. Thin boxes are drawn at an odd
// height precisely so that center row exists; a taller even box still has none,
// and stays consistent (just below the seam).
//
// Split in two on purpose. The decision — which pixel row is the center — is
// resolution math the Canvas2D and SVG paths need in *screen px*; only the
// clip-space conversion is GPU-specific. `//! js-export` lifts the px half into
// TypeScript, so the two backends share the rule instead of the Canvas2D twin
// re-deriving it (see adr-051). Keep new shared decisions in this shape: pure
// px-in/px-out below, the `yPxToClipY` wrapper above it.
public float snapBoxCenterYPx(float centerY, float heightPx, float scrollY) {
  float topPx = floor(centerY - heightPx * 0.5 - scrollY + 0.5);
  return topPx + floor(snapBoxHeightPx(heightPx) * 0.5) + 0.5;
}

public float snapBoxCenterY(
  float centerY, float heightPx, float scrollY, float canvasHeight
) {
  return yPxToClipY(snapBoxCenterYPx(centerY, heightPx, scrollY), canvasHeight);
}

// Extend the free edge `x2` away from the anchor `x1` so the span is at least
// `minWidthPx` CSS px wide, returning the new x2. Sub-pixel-narrow features (a
// 1bp rect, a zoomed-out coverage bin) still paint instead of vanishing.
//
// Orientation-preserving on purpose: reversal is baked into bpRangeX (negated
// length), so x2 < x1 on reversed blocks and the span must grow in the sign
// direction of dx. Widening toward +x would flip the quad on reversed regions.
// Contrast `expandToMinWidthPx` below, which moves both edges about the
// midpoint — that one is for spans with no anchored edge.
// Unit-agnostic core: `minWidth` is in whatever space x1/x2 are. Canvas2D calls
// this directly in screen px (paired with `spanLeft`, which owns the fill-x
// pivot); the clip-space wrapper below converts the px floor first. Same split
// as snapBoxCenterYPx — the rule is shared, the coordinate space is not.
public float extendToMinWidthPx(float x1, float x2, float minWidth) {
  float dx = x2 - x1;
  return abs(dx) < minWidth ? x1 + (dx < 0.0 ? -minWidth : minWidth) : x2;
}

public float extendToMinWidthX(
  float x1, float x2, float minWidthPx, float canvasWidth
) {
  return extendToMinWidthPx(x1, x2, minWidthPx * 2.0 / canvasWidth);
}

// The other min-width rule: widen a [x1, x2] span about its MIDPOINT, so both
// edges move. For a span with no anchored edge — a coverage bin, a gap, an
// insertion bar, a variant-matrix column — where growing off one side would
// slide the mark away from the coordinate it reports.
//
// Not orientation-preserving, and deliberately not: the callers here hand it an
// already-ordered span. `x2 - x1 < minWidth` rather than `abs(...)` means a
// span given backwards is always widened and comes back forwards.
//
// Same px-core/clip-wrapper split as `extendToMinWidthPx` above, and here it is
// what lets the alignments passes (clip space, a 1 CSS px floor) and the variant
// matrix (physical px, its own MIN_COL_PX) run one rule instead of two spellings
// of it.
public float2 expandToMinWidthPx(float x1, float x2, float minWidth) {
  if (x2 - x1 < minWidth) {
    float mid = (x1 + x2) * 0.5;
    return float2(mid - minWidth * 0.5, mid + minWidth * 0.5);
  }
  return float2(x1, x2);
}

public float2 expandToMinWidthX(
  float x1, float x2, float minWidthPx, float canvasWidth
) {
  return expandToMinWidthPx(x1, x2, minWidthPx * 2.0 / canvasWidth);
}

// vid%6: 0→(0,0)  1→(1,0)  2→(0,1)  3→(0,1)  4→(1,0)  5→(1,1)
public float2 quadLocal(uint vid) {
  uint v = vid % 6u;
  return float2(
    (v == 0u || v == 2u || v == 3u) ? 0.0 : 1.0,
    (v == 0u || v == 1u || v == 4u) ? 0.0 : 1.0
  );
}

// Screen-space (CSS px, top-left origin) → clip space, with the Y flip. Shared
// by the synteny/dotplot/hic renderers, whose 2D marks all map a screen-px
// point onto the viewport this way; keeps the flip sign from drifting between
// the plugins that previously open-coded it. (Appended after quadLocal on
// purpose: inserting earlier reshuffles every importer's debug #line numbers.)
public float4 screenToClip(float2 screen, float2 resolution) {
  float2 clip = screen / resolution * 2.0 - 1.0;
  return float4(clip.x, -clip.y, 0.0, 1.0);
}

// The x pair of `yPxToClipY`/its inverse: clip x ↔ screen px across the span
// clip [-1,1] covers. `canvasWidth` is whatever width that span means for the
// caller — for the LGV glyph passes it is the block's scissored width, not the
// canvas (see FeatureGlyphUniforms.canvasWidth).
//
// These exist so a horizontal decision can be written once in px and used from
// clip space, the way `snapBoxCenterYPx` already is vertically:
// `pxToClipX(decide(clipXToPx(a), clipXToPx(b)), w)`. `snapToPixelX` above is
// that sandwich with `floor(x + 0.5)` in the middle — the round trip is
// arithmetic it was already doing internally, so spelling a decision this way
// costs no precision. (Appended, per the note on screenToClip.)
public float clipXToPx(float clipX, float canvasWidth) {
  return (clipX + 1.0) * 0.5 * canvasWidth;
}

public float pxToClipX(float xPx, float canvasWidth) {
  return xPx / canvasWidth * 2.0 - 1.0;
}

// The LENGTH pair, as against the POSITION pair above: clip spans 2 units
// across `size`, so a px span is `px * 2 / size` with no origin term. `size` is
// the canvas width or height, or whatever span clip [-1,1] covers for the
// caller — the same argument `clipXToPx` and `yPxToClipY` take.
//
// Spell every px dimension through these. Writing `HALF_W_PX / u.canvasWidth`
// gives the same number but folds the /2 into the conversion, so the constant
// reads as a full width while meaning a half one; and `TRIANGLE_HW * 2.0 * 2.0
// / u.canvasW` (indicator.slang, before this existed) leaves a reader to work
// out which 2.0 doubles the half-width and which one is the clip span.
// (Appended, per the note on screenToClip.)
public float pxToClipLen(float px, float size) {
  return px * 2.0 / size;
}

public float clipLenToPx(float clipLen, float size) {
  return clipLen * 0.5 * size;
}
