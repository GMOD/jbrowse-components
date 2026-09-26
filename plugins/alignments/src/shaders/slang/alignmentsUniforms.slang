// Shared uniform block + helpers for every alignments-plugin shader. One
// UBO is written per block render and re-read by every pass so the struct
// below stays in lockstep with writeUniforms() in GpuAlignmentsRenderer.
//
// Colors are packed as u32 ABGR (one slot each, no std140 vec3 padding);
// shaders read them with `unpackRGBA(u.colorX).xyz` (see colorPack.slang).
// See hic/canvas/multi-synteny for the same pattern on the CPU side
// (cssColorToABGR).
// The sub-pixel frequency lerp is a pure scalar decision both backends must
// make identically; rendererTypes.ts imports the generated twin rather than
// re-deriving it (adr-051).
//! js-export: frequencyAlpha, frequencyFadeGate, sizeAlpha, linkedReadColorSlot
//! js-skip: expandMinWidthX — the clip-space half of this plugin's 1 CSS px floor; the px core it wraps is hpmath's expandToMinWidthLeftPx and RightPx, which coverageBar.slang exports into @jbrowse/alignments-core and fillSpanRect (this pass's Canvas2D twin) places its edges with
module alignmentsUniforms;

import antialias;
import colorPack;
import hpmath;

// The size of `linkedReadColor` in the block below. Declared as a constant
// rather than spelled into the array bound because the TS side has to build a
// palette of exactly this length — the generated `UNIFORM_SLOT_ARRAYS` entry
// has one word offset per slot, so a palette of the wrong size is caught there
// rather than by writing off the end.
public static const uint LINKED_READ_COLOR_SLOTS = 8u;
// One slot per read color category (read.slang's RC_*, which are dense from 0).
// It lives here rather than with the RC_* block because the uniform declaring it
// does, and imports only resolve one way. read.slang re-exports it so
// colorCategory.test.ts can pin the two counts equal.
public static const uint READ_CATEGORY_SLOTS = 22u;

public struct Uniforms {
  // HP-split bp range: hi = base-pair offset (high 20 bits), lo = fractional
  // low 12 bits, len = visible span in bp. See hpmath.slang.
  public float bpHi;
  public float bpLo;
  public float bpLen;

  // Runtime 0.0 sentinel that keeps the HP clamp floor off the compiler's
  // constant table; see hpmath.slang. MUST always be uploaded as 0.0.
  public float hpZero;

  // Canvas metadata
  public float canvasW;
  public float canvasH;
  // Pileup top in scrolled px. Read by pileupY and (via pileupRowCenterPx) by
  // the connecting/linked-read line shaders.
  public float rangeY0;
  public float covOffset;
  public float featHeight;
  public float featSpacing;

  // The coverage band's geometry, depth axis and colours are not here: it is
  // drawn off render-core's `CoverageBandUniforms`, which the MAF display
  // writes too, and the read-connection band off the link and point marks'.
  // This struct carries only what the pileup and overlay passes read.

  // Flags (ints / float-as-bool)
  public int colorScheme;
  public int chainMode;
  public int showStroke;
  // 1 = filter low-freq mismatches/insertions/gaps by coverage depth (default);
  // 0 = show all at full alpha (user has disabled frequency filtering)
  public int filterMismatchesByFrequency;
  // 1 = fade mismatch bases by their per-base Phred quality (advanced setting);
  // 0 = full alpha regardless of quality.
  public int mismatchAlpha;
  public float reversed;

  // Color palette — each uint is a packed ABGR value (1 byte per channel,
  // alpha in the high byte). Unpack with `unpackRGBA(u.colorX).xyz`.
  //
  // A NAMED SLOT IS A MARK'S COLOUR; a read fill's comes from
  // `readCategoryColor` below. That split is the whole point of the RC_*
  // refactor, and until this block was trimmed it was only half true: the
  // sixteen slots the vanished `cat == RC_X` chain used to read (colorFwd,
  // colorPairRR, colorSupplementary, …) stayed declared and stayed written once
  // per region per track per frame, with nothing left to read them. A slot no
  // shader names cannot be caught by a parity test either — `paletteUboParity`
  // walks this table, so it only ever proved the dead slots held the right dead
  // colour. Add a slot here only for a mark that paints it by name.
  public uint colorBaseA;
  public uint colorBaseC;
  public uint colorBaseG;
  public uint colorBaseT;
  // Also the muted grey the showModifications palette collapse writes, and what
  // a non-A/C/G/T base (e.g. N) takes. `effectiveBaseColors` resolves that on
  // the CPU into these five slots, so the shader has one base lookup and no
  // mode to branch on.
  public uint colorBaseN;
  public uint colorInsertion;
  public uint colorDeletion;
  public uint colorSkip;
  public uint colorSoftclip;
  public uint colorHardclip;
  // The chain's mate-joining hairline (connectingLine.slang) and the
  // collapsed-row overlap tint (overlap.slang). Same argument as the flat
  // connector above — see colors.ts, which is where each says which neutral it
  // wants and why.
  public uint colorConnectingLine;
  public uint colorOverlapTint;
  // The chain-layout overlap span (overlap.slang). Same argument as the flat
  // connector above and the opposite conclusion about WHICH neutral: two
  // segments of one molecule cover that span, so no read colour is right there,
  // but unlike a hairline over the track background this is an opaque fill
  // between two read fills, so it takes its own theme slot (`readOverlap`)
  // rather than the foreground.
  public uint colorOverlap;
  // Linked-read connecting-line palette (linkedReadBezier mode). 8 slots so
  // every paired-orientation (unknown/LR/RL/RR/LL) and split-strand pairing
  // (RF/FR/same) has its own color, looked up by per-instance colorType.
  public float4 linkedReadColor[LINKED_READ_COLOR_SLOTS];
  // Read fill color per RC_* category, baked on the CPU.
  //
  // The shader used to decide this: a 17-arm `cat == RC_X` chain in read.slang
  // mapping each category to one of the named colors above. That chain and the
  // legend's `swatchPaletteKeys` were two spellings of one mapping, and the only
  // thing holding them together was a test that RE-READ read.slang's source with
  // a regex and matched the arms against the table — pinning the source text,
  // breaking on reformatting, and unable to catch the two sides agreeing on a
  // spelling while disagreeing on a color.
  //
  // Now the CPU writes one color per category from the same table the legend
  // swatches, and the shader indexes it. The mapping cannot disagree with the
  // legend because there is only one of it, and since the named read-fill slots
  // went it is also the only copy — the duplicated 352 bytes this cost while
  // both existed are back.
  public float4 readCategoryColor[READ_CATEGORY_SLOTS];
  public float pxPerBp;
  // Device pixel ratio. Every other length in this struct is CSS px on purpose
  // (clip space normalizes, so nothing here needs the buffer's scale) — this is
  // the one exception, and it exists ONLY so an antialiased stroke can size its
  // ramp in DEVICE pixels. Appended at the tail for offset stability.
  public float devicePixelRatio;
};


// A BUTT-capped stroked segment: the quad that covers it, and the coverage that
// shades it. They belong together because the pad is the contract — the quad
// grows by exactly `aaHalfPx(dpr)` past the ink on both axes, which is the
// ramp's reach and no more. Pad less and the ramp is clipped, silently; pad
// more and the surplus fragments shade to alpha 0 and blend anyway.
//
// Butt caps, because that is what the Canvas2D/SVG twin draws: its painter
// strokes moveTo/lineTo with the default lineCap. The round cap belongs to
// `capsuleDist`, where it is load-bearing (a dotplot dot is the degenerate
// cap; linecenter's coincident caps make its max-blend joins seamless) —
// nothing here wants it, so the cut at the ends is the ink's own edge ramp.
//
// The product form is exact: box-filter coverage of an axis-aligned rectangle
// separates per axis, so the ends are exactly as soft as the sides.
//
// `local` is in the SEGMENT's own frame — x along it, y across it — so a
// diagonal segment costs nothing here. Mapping that frame to the screen is the
// caller's: a linked-read connector rotates it onto capsuleFrame's
// tangent/normal.
public float2 segmentQuadLocal(
    uint vid, float halfLenPx, float halfWidthPx, float dpr) {
  float ext = aaHalfPx(dpr);
  float2 q = quadLocal(vid) * 2.0 - 1.0;
  return float2(q.x * (halfLenPx + ext), q.y * (halfWidthPx + ext));
}

public float buttSegmentCoverage(
    float2 local, float halfLenPx, float halfWidthPx, float dpr) {
  return edgeCoverage(halfWidthPx - abs(local.y), dpr)
       * edgeCoverage(halfLenPx - abs(local.x), dpr);
}

// ---- Helper functions ---------------------------------------------------
//
// Palette colors live in the Uniforms struct as u32 ABGR (1 slot each, no
// std140 vec3 padding). Call sites read them with `unpackRGBA(u.colorX).xyz`
// from colorPack.slang — the same pattern multi-synteny and linear-synteny
// use, so there's no per-plugin wrapper to learn.

public float3 bpRange(Uniforms u) {
  return float3(u.bpHi, u.bpLo, u.bpLen);
}

public float hpClipX(float2 splitPos, Uniforms u) {
  return hpToClipX(splitPos, bpRange(u), u.hpZero);
}

// Type-safe bp→clip converter. Accepts a raw uint genomic position and performs
// the hpSplitUint internally — callers can't accidentally pass a pre-split
// float2 or a region-relative offset.
public float bpToClipX(uint bp, Uniforms u) {
  return hpClipX(hpSplitUint(bp), u);
}

public float flipX(float x, Uniforms u) {
  return lerp(x, -x, u.reversed);
}

// Screen-pixel Y of a pileup row's top edge. The single source for row
// placement: pileupY (the quad's clip-space extent) and pileupRowCenterPx (the
// linked-read connecting lines) both derive from it, so they can't drift.
public float pileupRowTopPx(float row, Uniforms u) {
  return u.covOffset + row * (u.featHeight + u.featSpacing) - u.rangeY0;
}

// Returns (yTopClip, yBotClip) for a pileup row index.
public float2 pileupY(float row, Uniforms u) {
  float yTopPx = pileupRowTopPx(row, u);
  return float2(yPxToClipY(yTopPx, u.canvasH),
                yPxToClipY(yTopPx + u.featHeight, u.canvasH));
}

// Screen-pixel Y of a pileup row's vertical center.
public float pileupRowCenterPx(float row, Uniforms u) {
  return pileupRowTopPx(row, u) + u.featHeight * 0.5;
}

// Which palette slot a linked-read connector's colour type reads: a clamp,
// not a wrap, so an out-of-range slot resolves to the last colour on every
// backend rather than to a different real one.
public uint linkedReadColorSlot(uint idx) {
  return min(idx, LINKED_READ_COLOR_SLOTS - 1u);
}

// Widen a [x1,x2] clip-space span to a minimum of 1 CSS pixel, centered, so
// sub-pixel-narrow features (coverage bins, gaps, insertion bars zoomed out)
// stay visible. For a span with an anchored edge — every 1bp pileup cell — the
// rule is `pileupCellX` below instead.
//
// The 1.0 is this plugin's floor; hpmath's `expandToMinWidthX` is the rule.
public float2 expandMinWidthX(float x1, float x2, float canvasWidth) {
  return expandToMinWidthX(x1, x2, 1.0, canvasWidth);
}

// The clip-space x span of ONE 1bp pileup cell: both edges snapped to a pixel
// column, then the free edge pushed out so the cell stays 1 CSS px wide.
//
// ANCHORED, which is the whole content of the function. `x` is the snapped
// column this base starts at and must not move, so the widening goes through
// `extendToMinWidthX` (hpmath) rather than `expandMinWidthX` above, which moves
// both edges about the midpoint. On a reversed block the anchor is still the
// base's low-coordinate edge — `flipX` mirrors the finished quad, and a
// reflection carries the anchor with it.
//
// Every layer that paints one rect per base measures from here: mismatch,
// soft-clip bases and per-base letters through mismatch.slang; modifications and
// per-base quality through packedColorQuad.slang. They have to agree, because
// they paint over each other and because `cellPlacement` is the one rule
// all five of their Canvas2D twins share (`cellPainterParity.test.ts` pins that
// side). packedColorQuad.slang widened about the midpoint instead, which put its
// two layers up to half a pixel left of the other three — and of their own
// Canvas2D painters — once the view passed 1bp/px. One spelling, so the five
// cannot disagree about which column a base owns.
public float2 pileupCellX(uint bp, Uniforms u) {
  float x = snapToPixelX(bpToClipX(bp, u), u.canvasW);
  return float2(
    x,
    extendToMinWidthX(
      x, snapToPixelX(bpToClipX(bp + 1u, u), u.canvasW), 1.0, u.canvasW));
}

// Below one 8-bit alpha step a mark is not representable, so sizeAlpha() snaps
// there rather than emitting something no pixel can show. Not exported: it is
// an implementation detail of that snap, and every caller reads the 0 instead.
static const float MIN_VISIBLE_ALPHA = 0.00392156862745098; // 1/255

// Sub-pixel alpha blend: lerp between `base` and 1.0 using per-site frequency.
// The single definition of that lerp for both backends; `alphaShaderParity.test.ts`
// holds its endpoints. Nothing on the CPU side imports it directly — it arrives
// there inside the generated `frequencyFadeGate`, which is the decision callers
// want.
public float frequencyAlpha(float base, float freq) {
  return base + freq * (1.0 - base);
}

// The whole low-frequency fade gate for one instance: honors the
// "show low frequency mismatches" toggle and skips instances already covering a
// full pixel. Passes supply `base` from their own geometry — a bare on-screen
// width for a point event (mismatch and clip pass pxPerBp), its SQUARE for an
// indel, which fades narrow features faster. Squaring can't change the sub-pixel
// test, since base < 1.0 ⟺ sqrt(base) < 1.0 for non-negative values.
//
// WHICH width an indel squares is the pass's own answer, and the two differ. An
// insertion consumes no reference span, so it squares pxPerBp; a deletion HAS
// one, so it squares its own on-screen widthPx — see gap.slang, whose Canvas2D
// twin squares the same quantity.
//
// Every fading pass must go through this rather than reassembling the gate
// locally — a hand-rolled copy is how the clip pass silently lost its
// filterMismatchesByFrequency check. `frequencyFade()` in rendererTypes.ts calls
// the generated twin of this, adding the two things that are the CPU side's
// alone: reading the toggle off the render state, and normalizing the worker's
// frequency byte.
//
// Split from the Uniforms wrapper below only so it can be `//! js-export`ed —
// the wrapper takes the whole uniform block, which the scalar twin emitter
// cannot carry across, and the GATE is the part both backends need. It holds
// three facts that have to agree: the toggle, the sub-pixel test, and which one
// short-circuits. Dropping the toggle is what silently disabled the clip pass's
// filter.
public float frequencyFadeGate(float base, float freq, bool filterByFrequency) {
  return (filterByFrequency && base < 1.0) ? frequencyAlpha(base, freq) : 1.0;
}

public float frequencyFade(float base, float freq, Uniforms u) {
  return frequencyFadeGate(base, freq, u.filterMismatchesByFrequency != 0);
}

// How much of an indel marker this zoom has earned, from its own on-screen
// span in CSS px. Multiplies a pass's frequency fade; it does not replace it.
//
// The two gates answer different questions and neither substitutes. Frequency
// asks "is this site rare", and it structurally cannot bound an indel drawn in
// bulk: frequencyAlpha is `base + freq*(1 - base)`, so a site carried by every
// read at that depth returns 1 however sub-pixel `base` is. A synteny alignment
// has depth 1, so every indel it carries has frequency 1 — which is how a
// whole-genome chain drawn at megabase scale covered its own alignment in
// full-opacity ticks.
//
// Indels only. A mismatch is a point event whose whole value is being visible
// when a screen holds more bases than pixels — a SNP column carried by every
// read must stay opaque there, which is exactly what the frequency lerp is for.
// An indel at that zoom is noise, and a big one still survives on its own span.
//
// Snaps to 0 below one 8-bit alpha step so each pass's existing `alpha <= 0`
// discard drops the instance rather than paying to rasterize the invisible.
// That cost is the point at low zoom: a chain offers tens of thousands of
// indels per block and nearly all of them arrive here.
public float sizeAlpha(float spanPx) {
  float a = clamp(spanPx, 0.0, 1.0);
  return a <= MIN_VISIBLE_ALPHA ? 0.0 : a;
}

// Shared vertex output for passes that only need clip-space position + color.
// Passes with extra varyings (read, arc, indicator, overlap) define their own.
public struct ColorVsOut {
  public float4 position : SV_Position;
  public float4 color    : COLOR0;
};

// Fold a vertex to the origin (degenerate, invisible). Call when alpha == 0 to
// skip rasterization of sub-pixel-transparent geometry.
public ColorVsOut discardVertex() {
  ColorVsOut o;
  o.position = float4(0.0);
  o.color = float4(0.0);
  return o;
}

// Clip-space position of one corner of a box mark: interpolate the
// [x0,x1] x [yBot,yTop] clip box by the quadLocal() corner and apply the
// reverse-strand X flip. Y args are (bottom, top) to match quadLocal's Y-up
// local.y. Collapses the flip+lerp corner math shared by every box glyph.
public float4 flippedQuadPos(float x0, float x1, float yBot, float yTop, float2 local, Uniforms u) {
  return float4(flipX(lerp(x0, x1, local.x), u), lerp(yBot, yTop, local.y), 0.0, 1.0);
}

