// Read pass: one 9-vertex "quad + optional chevron cap" per alignment
// segment. Verts 0..5 draw the body rectangle; 6..8 draw a chevron tip
// clipped to the segment's leading (fwd) or trailing (rev) edge.
//! targets: wgsl, glsl
//! js-export: showChevron
//! export-consts: READ_CATEGORY_SLOTS, CS_NORMAL, CS_STRAND, CS_MAPQ, CS_INSERT_SIZE, CS_FIRST_OF_PAIR, CS_PAIR_ORIENT, CS_IS_AND_ORIENT, CS_MODIFICATIONS, CS_TAG, RC_SUPPLEMENTARY, RC_SPLIT_INVERSION, RC_SPLIT_DELETION, RC_UNMAPPED_MATE, RC_INTERCHROM, RC_FWD_STRAND, RC_REV_STRAND, RC_NO_STRAND, RC_NON_SPLIT, RC_PAIR_LR, RC_PAIR_RL, RC_PAIR_RR, RC_PAIR_LL, RC_LONG_INSERT, RC_SHORT_INSERT, RC_NORMAL_INSERT, RC_PLAIN, RC_MAPQ, RC_TAG, RC_NO_TAG_VALUE, RC_MOD_FWD, RC_MOD_REV, RC_MAPQ_UNAVAILABLE, CHEVRON_PX, CHEVRON_DIRLESS_MIN_WIDTH_PX, PAIR_MIN_SPAN_PX, READ_OUTLINE_PX, READ_OUTLINE_SHADE, READ_OUTLINE_MIN_WIDTH_PX, READ_OUTLINE_MIN_HEIGHT_PX

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 9u;
// Color scheme constants. SINGLE SOURCE OF TRUTH for the color-scheme index:
// the `export-consts` directive above emits these into read.generated.ts, and
// the TS `ColorScheme` map (constants.ts) is built from those exports — so the
// shader switch below and the JS/Canvas2D path can never disagree on indices.
static const int CS_NORMAL        = 0;
static const int CS_STRAND        = 1;
static const int CS_MAPQ          = 2;
static const int CS_INSERT_SIZE   = 3;
static const int CS_FIRST_OF_PAIR = 4;
static const int CS_PAIR_ORIENT   = 5;
static const int CS_IS_AND_ORIENT = 6;
static const int CS_MODIFICATIONS = 7;
static const int CS_TAG           = 8;

// Read color categories. SINGLE SOURCE OF TRUTH for the category vocabulary:
// `export-consts` emits these into read.generated.ts and the TS
// `READ_COLOR_CATEGORY` map (colorUtils.ts) is built from those exports, so the
// two sides cannot disagree on an index. RC_PLAIN is deliberately 0: a
// zero-filled instance buffer then paints the neutral fill rather than
// flooding the pileup with whichever category happened to land on index 0.
//
// Which category a read falls into is decided ONCE, on the CPU, by
// `readColorCategory` (colorUtils.ts) — baked per read into
// `readColorCategories` and uploaded as `inst.colorCategory`. This shader only
// PAINTS a category; it does not classify. That is why there is no precedence
// chain here anymore: the ordered rules (paired-supplementary override,
// long-read chain strand framing, split inversion/deletion, unmapped mate,
// inter-chromosomal, per-scheme) used to be hand-mirrored between this file and
// colorUtils.ts, and hand-mirrored ordered rules drift. Now the GPU, the
// Canvas2D/SVG fallback, and the legend all consume one classification.
static const uint RC_PLAIN           = 0u;
static const uint RC_SUPPLEMENTARY   = 1u;
static const uint RC_SPLIT_INVERSION = 2u;
static const uint RC_SPLIT_DELETION  = 3u;
static const uint RC_UNMAPPED_MATE   = 4u;
static const uint RC_INTERCHROM      = 5u;
static const uint RC_FWD_STRAND      = 6u;
static const uint RC_REV_STRAND      = 7u;
static const uint RC_NO_STRAND       = 8u;
static const uint RC_NON_SPLIT       = 9u;
static const uint RC_PAIR_LR         = 10u;
static const uint RC_PAIR_RL         = 11u;
static const uint RC_PAIR_RR         = 12u;
static const uint RC_PAIR_LL         = 13u;
static const uint RC_LONG_INSERT     = 14u;
static const uint RC_SHORT_INSERT    = 15u;
static const uint RC_NORMAL_INSERT   = 16u;
static const uint RC_MAPQ            = 17u;
static const uint RC_TAG             = 18u;
static const uint RC_NO_TAG_VALUE    = 19u;
static const uint RC_MOD_FWD         = 20u;
static const uint RC_MOD_REV         = 21u;
// MAPQ 255 is the SAM spec's "mapping quality unavailable" sentinel, not a
// mapping quality of 255. Fed to the hue ramp it painted an ordinary
// blue-violet — a color a reader would take for a genuine very high score, and
// one the MAPQ legend named nothing. Its own flat-swatch category instead, so it
// paints the neutral grey and the legend lists it exactly when reads carry it.
// No branch is needed in getReadColor: a flat category resolves straight out of
// u.readCategoryColor.
static const uint RC_MAPQ_UNAVAILABLE = 22u;

// Arrowhead size in CSS px (protrusion past the read edge + cap dimensions).
// Exported so features/read/drawCanvas.ts (Canvas2D) uses the same value.
static const float CHEVRON_PX = 8.0;

// When a read's direction is uninformative (normal color scheme, mate unmapped,
// or mate on another chromosome), only draw its strand arrow once the read is at
// least this many CSS px wide — so the arrows fade out when zoomed out far and
// return only when zoomed in. Direction-relevant reads (strand/orientation
// schemes) keep the looser base gate.
static const float CHEVRON_DIRLESS_MIN_WIDTH_PX = 30.0;

// Hide arrows on paired reads whose whole pair (|insert size| on screen) shrinks
// below this many CSS px — when zoomed out the mates sit on top of each other and
// the arrows are just clutter. Applies regardless of color scheme.
static const float PAIR_MIN_SPAN_PX = 10.0;

// The read outline, which is not a stroke: the outermost READ_OUTLINE_PX of the
// glyph is repainted at READ_OUTLINE_SHADE of its own fill. No second colour, no
// geometry, and it can never leave the read.
//
// Exported because `features/read/drawCanvas.ts` has to reproduce it with a
// stroke, and the three numbers were stated twice with three different answers:
// it stroked `rgba(0,0,0,0.3)` at width 0.5 CENTRED on the boundary, against
// this 1 px band inside it, and gated on width alone where this gates on both
// axes. Only the colour happened to agree, and by coincidence of algebra —
// compositing black at `1 - shade` over a fill IS `fill * shade`, so the same
// rule had been written once as a multiply and once as a composite. See
// agent-docs/reference/CROSS_BACKEND_GATE.md for the 1.99% that found it.
//
// SHADE is 0.85 because that is the ink the Canvas2D spelling actually laid
// down, and it is the number the two fixes together are answerable for. That
// spelling was 0.5 px at alpha 0.3 — 0.15 px·alpha per edge — while this band
// was 1 px at 0.3, twice as much. Nobody chose that; the two were written apart
// and only ever compared on colour. Conserving the ink and putting all of it
// inside the glyph is 1 px at alpha 0.15, so 0.85.
//
// It reads lighter than 0.7 without reading hazier, which is the whole point:
// what made the old outline soft was placement, not weight. A centred stroke
// spends half its width in the 1 px gap between pileup rows — and that gap takes
// it from the read above and the read below at once, which is why the boundary
// smudged. Inside the glyph, the same ink is a clean edge.
//
// The one number this does NOT reproduce is the old boundary's total darkening
// (17 + 38 + 17 grey levels across edge/gap/edge, against 32 + 32 here). Exactly
// matching that is 0.83, and the 8 levels between them are precisely the two
// half-strokes overlapping in the gap — the artifact being removed. Don't
// restore it by tuning this number.
static const float READ_OUTLINE_PX = 1.0;
static const float READ_OUTLINE_SHADE = 0.85;
// Two gates on two axes, and they are asked in two different PLACES because
// they are two different questions.
//
// WIDTH is per-read and mechanical: the inset the outline is drawn at has to
// fit. Below 2 px there is no interior left to inset into and the Canvas2D
// rect inverts. `>` because a read's width is continuous — 2.5 px is a real
// width and it passes. Per read, so the fragment stage asks it.
static const float READ_OUTLINE_MIN_WIDTH_PX = 2.0;
// HEIGHT is frame-level and about legibility: it is 4 = 4 * READ_OUTLINE_PX,
// the point where the interior (h - 2) stops being thinner than the two bands
// that frame it. Below it a row is more outline than read, and a pileup of them
// reads as a solid dark mass rather than as separated reads — which is exactly
// what the Compact preset (3 px, and `featureSpacingForHeight` gives it no gap
// either) would have looked like on Canvas2D.
//
// `>=` on purpose: fit mode divides pixels by rows, so this is a real number,
// and 4 itself must pass. Do not "simplify" it to `> 3` — that silently admits
// every fitted height in (3, 4), which is the band this gate exists to exclude.
//
// Asked ONCE, on the host, by `shouldOutlineReads` — which is what `u.showStroke`
// carries, and is shared with the Canvas2D painter. The fragment stage asked it
// again for a while, off a `featSize.y` that is `u.featHeight` for every read in
// the frame, so the second test could never bind; three copies of the number
// then drifted to 4/2/2 behind it, because a test that cannot fail is not a
// test. One asker, and the varying it needed is a scalar again.
static const float READ_OUTLINE_MIN_HEIGHT_PX = 4.0;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  startOff       : ATTR0;   // absolute genomic bp
  uint  endOff         : ATTR1;   // absolute genomic bp
  uint  y              : ATTR2;
  uint  flags          : ATTR3;
  uint  mapq           : ATTR4;
  float insertSize     : ATTR5;
  int   strand         : ATTR6;
  uint  tagColor       : ATTR7;   // ABGR u32; 0 = not set
  uint  edgeFlags      : ATTR8;   // bit 0 = is_first, bit 1 = is_last
  uint  interchrom     : ATTR9;   // 1 = mate on a different chromosome
  uint  colorCategory  : ATTR10;  // RC_* — CPU-classified, see above
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float2 localPos : COLOR1;
  // On-screen width of this read in CSS px, for the outline's inset and its
  // width gate. The height half of this used to ride along and was `u.featHeight`
  // every time — see READ_OUTLINE_MIN_HEIGHT_PX.
  float  featWPx  : COLOR2;
  float  edgeFlag : COLOR3;
};

// --- color painting ---
//
// No classification here — see the RC_* block above. Everything below maps an
// already-decided category to pixels.

// Flat palette lookup: the CPU wrote one color per category into
// `u.readCategoryColor` (see alignmentsUniforms.slang), so there is nothing to
// decide here and nothing that can drift from the legend.
float3 categoryPaletteColor(uint cat, Uniforms u) {
  return u.readCategoryColor[min(cat, READ_CATEGORY_SLOTS - 1u)].xyz;
}

// --- direction markers ---

// Whether a read draws its strand arrowhead.
//
// Base gate: tall rows, and either chain mode (long reads stay wide even when
// zoomed out) or >0.1 px/bp. Direction-uninformative reads (normal scheme, mate
// unmapped, or mate on another chromosome) additionally require enough
// on-screen width, so their arrows disappear when zoomed out far instead of
// cluttering the view. Paired reads whose mates have collapsed together on
// screen drop the arrow entirely — at that zoom it is noise.
//
// `//! js-export`ed: features/read/drawCanvas.ts carried a five-argument copy
// of exactly this, under a "Mirror of read.slang `showChev`" comment, and an
// arrow drawn by one backend but not the other is a difference between what is
// on screen and what an SVG export contains.
bool showChevron(bool chainMode, float pxPerBp, float featHeight,
                 uint colorScheme, uint flags, uint interchrom,
                 float insertSize, float featWPx) {
  bool baseShow = (chainMode || pxPerBp > 0.1) && featHeight >= 3.0;
  bool dirMoot = colorScheme == CS_NORMAL
      || (flags & 8u) != 0u
      || interchrom != 0u;
  bool isPaired = (flags & 1u) != 0u;
  bool pairTooTight = isPaired && abs(insertSize) * pxPerBp < PAIR_MIN_SPAN_PX;
  return baseShow && !pairTooTight
      && (!dirMoot || featWPx > CHEVRON_DIRLESS_MIN_WIDTH_PX);
}

float3 getReadColor(Instance inst, Uniforms u) {
  uint cat = inst.colorCategory;
  // The two categories that are a per-read ramp or packed value rather than a
  // flat swatch, so they cannot come from the palette table.
  if (cat == RC_MAPQ) { return hueRampHalfSat(float(inst.mapq)); }
  if (cat == RC_TAG) {
    // An unset tag color falls back to RC_TAG's OWN palette slot, which is what
    // `readCategoryPaletteKeys.tag` resolves. This used to name `u.colorPairLR`
    // — the slot that table happens to point at — which is the same colour by
    // coincidence and the last place the shader named a palette slot for a read
    // fill. Re-point the table and a named copy would silently disagree with it,
    // which is the whole failure the RC_* categories replaced.
    return inst.tagColor != 0u
      ? unpackRGBA(inst.tagColor).xyz
      : categoryPaletteColor(cat, u);
  }
  return categoryPaletteColor(cat, u);
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;

  uint v = vid % 9u;
  float sx1 = bpToClipX(inst.startOff, u);
  float sx2 = bpToClipX(inst.endOff, u);

  float2 yy = pileupY(float(inst.y), u);
  float syTop = yy.x;
  float syBot = yy.y;
  float syMid = (syTop + syBot) * 0.5;

  // 8px-wide chevron when featHeight>=3 and zoom supports it.
  float chevronClip = CHEVRON_PX / u.canvasW * 2.0;
  float featWPx = (sx2 - sx1) * u.canvasW * 0.5;
  o.featWPx = featWPx;

  bool showChev = showChevron(
    u.chainMode == 1, u.pxPerBp, u.featHeight, u.colorScheme,
    inst.flags, inst.interchrom, inst.insertSize, featWPx);

  // Which edge the arrowhead caps, asked ONCE: the body quad spends the answer
  // as `ef` (which side skips its outline) and the cap verts as their geometry,
  // and a read whose chevron is suppressed must get the same answer from both or
  // the body hides an outline edge no cap covers.
  bool isFirst = (inst.edgeFlags & 1u) != 0u;
  bool isLast = (inst.edgeFlags & 2u) != 0u;
  bool drawFwd = showChev && inst.strand > 0 && isLast;
  bool drawRev = showChev && inst.strand < 0 && isFirst;

  float sx, sy, lx, ly;
  float ef = 0.0;

  if (v < 6u) {
    float2 q = quadLocal(v);
    lx = q.x;
    ly = q.y;
    sx = lerp(sx1, sx2, lx);
    sy = lerp(syBot, syTop, ly);
    if (drawFwd)      { ef = 1.0; }
    else if (drawRev) { ef = -1.0; }
  } else if (drawFwd || drawRev) {
    ef = 2.0;
    float chevW = CHEVRON_PX;
    float halfH = u.featHeight * 0.5;
    float alt = chevW * u.featHeight / sqrt(halfH * halfH + chevW * chevW);
    if (drawFwd) {
      if (v == 6u)      { sx = sx2; sy = syTop; lx = 0.0; ly = alt; }
      else if (v == 7u) { sx = sx2; sy = syBot; lx = alt; ly = 0.0; }
      else              { sx = sx2 + chevronClip; sy = syMid; lx = 0.0; ly = 0.0; }
    } else {
      if (v == 6u)      { sx = sx1; sy = syTop; lx = 0.0; ly = alt; }
      else if (v == 7u) { sx = sx1 - chevronClip; sy = syMid; lx = 0.0; ly = 0.0; }
      else              { sx = sx1; sy = syBot; lx = alt; ly = 0.0; }
    }
  } else {
    // No cap on this read — fold its three verts to one zero-area (culled)
    // point. Both ways of having no cap land here: the zoom gates said no, or
    // this segment is not the end the arrow belongs on.
    lx = 0.5; ly = 0.5; sx = sx1; sy = syTop;
  }

  o.localPos = float2(lx, ly);
  o.edgeFlag = ef;
  o.position = float4(flipX(sx, u), sy, 0.0, 1.0);
  o.color = float4(getReadColor(inst, u), 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  if (u.showStroke == 1) {
    float edgeDist;
    if (fragIn.edgeFlag > 1.5) {
      // chevron tip — distance to the two diagonal edges
      edgeDist = min(fragIn.localPos.x, fragIn.localPos.y);
    } else {
      // Whichever side the chevron joins on hands its outline to the cap.
      float dxL = fragIn.localPos.x * fragIn.featWPx;
      float dxR = (1.0 - fragIn.localPos.x) * fragIn.featWPx;
      if (fragIn.edgeFlag > 0.5)  { dxR = 999.0; }
      if (fragIn.edgeFlag < -0.5) { dxL = 999.0; }
      float dy = min(fragIn.localPos.y, 1.0 - fragIn.localPos.y) * u.featHeight;
      edgeDist = min(min(dxL, dxR), dy);
    }
    // No height gate: `u.showStroke` already carries it, frame-level.
    if (edgeDist < READ_OUTLINE_PX
        && fragIn.featWPx > READ_OUTLINE_MIN_WIDTH_PX) {
      return float4(fragIn.color.rgb * READ_OUTLINE_SHADE, fragIn.color.a);
    }
  }
  return fragIn.color;
}
