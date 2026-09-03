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
//! js-export: frequencyAlpha, frequencyFadeGate, sizeAlpha, arcYFraction, arcYOffsetPx, arcAvailH, arcColorSlot, linkedReadColorSlot, distToWideCirclePx, hueRampLane
//! js-skip: expandMinWidthX — this plugin's 1 CSS px floor over hpmath's expandToMinWidthX, which is where the rule and the reason it has no Canvas2D twin are recorded
//! js-skip: dashCoverageAt — same, one axis along: the other two backends dash through setLineDash and stroke-dasharray, which take the period rather than a coverage. What they must agree on is ARC_FLAT_DASH_PX / ARC_FLAT_GAP_PX, and those are export-consts already
//! js-skip: dashCoverage — the dpr wrapper over dashCoverageAt, so it inherits that entry's reason exactly; it became liftable only when the ADR-040 granularity pass swapped its Uniforms parameter for a bare dpr, which changes what the emitter can see and nothing about who wants it
module alignmentsUniforms;

import antialias;
import colorPack;
import hpmath;

// Sizes of the two indexed color palettes in the block below. Declared as
// constants rather than spelled into the array bounds because the TS side has
// to build palettes of exactly these lengths — the generated
// `UNIFORM_SLOT_ARRAYS` entry has one word offset per slot, so a palette of the
// wrong size is caught there rather than by writing off the end.
public static const uint ARC_COLOR_SLOTS = 9u;
public static const uint LINKED_READ_COLOR_SLOTS = 8u;
// One slot per read color category (read.slang's RC_*, which are dense from 0).
// It lives here rather than with the RC_* block because the uniform declaring it
// does, and imports only resolve one way. read.slang re-exports it so
// colorCategory.test.ts can pin the two counts equal.
public static const uint READ_CATEGORY_SLOTS = 23u;

public struct Uniforms {
  // HP-split bp range: hi = base-pair offset (high 20 bits), lo = fractional
  // low 12 bits, len = visible span in bp. See hpmath.slang.
  public float bpHi;
  public float bpLo;
  public float bpLen;

  // Runtime 0.0 sentinel. HP math uses 1/hpZero to materialize +inf without
  // the compiler folding hi/lo combination. MUST always be uploaded as 0.0.
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

  // The coverage band's own geometry, depth axis and colours are NOT here: the
  // band is drawn by render-core's shared coverage passes off
  // `CoverageBandUniforms` (coverageBand.slang), which the MAF display writes
  // too. This struct carries only what the pileup, arc and overlay passes read.

  // Arc pass
  public float blockStartPx;
  public float blockWidth;
  public float lineWidthPx;
  public float pairedArcsDown;
  // Domain in bp that maps to the arcs band's vertical extent (availH).
  // Arc/bezier mode sets this to availH/pxPerBp so the apex tracks genomic
  // zoom; read-cloud mode sets it to the autoscaled max |insert size| so the
  // line Y is zoom-stable. One code path, mode-dependent value.
  public float arcsYDomainBp;
  // 1 = map yBp→Y with a base-2 log scale (read cloud), 0 = linear
  // (arc/bezier mode). Float-as-bool to stay in the float block.
  public float arcsYLog;

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
  // The read cloud's flat connector line (arcFlat.slang). The theme's
  // `text.primary`: the line carries no category — its two endpoint squares do —
  // so it wants the foreground colour, and both renderers hard-coded that as
  // black, which is the background in dark mode.
  public uint colorFlatConnector;
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
  // Paired-read arc palette, indexed by the per-instance color type — a real
  // array, because that is what it is. The nine slots were nine separately-named
  // uniforms (arcColor0..8, the ninth appended at the tail years later for
  // offset stability), which the shader could not subscript: `arcColorByIndex`
  // copied all nine into a local array on every vertex to get one of them.
  //
  // float4 rather than the packed ABGR uint every OTHER color here uses, for two
  // reasons that point the same way. std140 pads an array element to 16 bytes
  // regardless, so the packed form would occupy the same 144 bytes while still
  // costing an unpack per vertex — packing buys nothing in a uniform array (it
  // buys plenty in a vertex attribute, which is where it stays). And slangc
  // cannot compile the packed form at all: see colorPack.slang.
  // The read-cloud endpoint squares (arcMarker.slang) index this same array.
  // They used to have `arcMarkerColor`, a second copy with the short-insert
  // slot swapped for the pale pileup fill, because a saturated stroke colour
  // was needed to keep a thin arc line visible while the opaque square had to
  // match the pileup. Both are the pale swatch now, so the substitution is
  // gone; a second table holding the identical nine colours is only somewhere
  // for them to drift.
  public float4 arcColor[ARC_COLOR_SLOTS];
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
  // Arc band height (CSS px) — the vertical extent the dome / flat-line Y-scale
  // (`availH`) maps into. Distinct from `canvasH` (the full canvas height, the
  // clip-space divisor) because the arc passes now run in the full-canvas
  // viewport and place Y in absolute canvas px, so the band can scroll partly
  // off-screen without an out-of-bounds viewport. Appended at the tail for
  // offset stability.
  public float arcBandH;
  // Device pixel ratio. Every other length in this struct is CSS px on purpose
  // (clip space normalizes, so nothing here needs the buffer's scale) — this is
  // the one exception, and it exists ONLY so an antialiased stroke can size its
  // ramp in DEVICE pixels. Appended at the tail for offset stability.
  public float devicePixelRatio;
};

// Coverage of a `dashPx` on / `gapPx` off pattern at `coord` CSS px along the
// mark, with the ON run starting at coord 0 — the phase `ctx.setLineDash` and
// `stroke-dasharray` give, so the three backends dash alike.
//
// The rotation is what makes both ends soft, and both halves of it were got
// wrong here before. Measuring `min(phase, dashPx - phase)` straight off the
// wrap ramps a dash's TRAILING edge and steps its LEADING edge 0 -> 0.5 in no
// distance at all; rotating the run to the middle of the period fixes that but
// then ramping over a constant 1 CSS px is two device px on a dpr=2 display —
// twice the softness of the sides of the very same line. Centring the run at
// half a period puts the wrap deep in the gap where nothing is drawn, and
// `aaPx(dpr)` is the sides' own ramp.
//
// The reduction is `t - period * floor(t / period)` rather than the obvious
// `frac(t / period) * period`, which are the same number only in exact
// arithmetic. `frac` drops the integer part BEFORE multiplying back, so what
// the quotient lost to rounding survives and gets scaled by the period;
// subtracting the floored multiple keeps it, because THAT subtraction is exact
// — its operands are within a period of each other, so nothing falls off the
// end. Same op count, once `frac`'s own `floor` is counted.
//
// This is not a visible fix and don't sell it as one: swept against the old
// spelling in float32 over both passes' whole coordinate range at dpr 1-4, the
// two differ by at most 9.8e-4 of alpha and not one 8-bit pixel changes.
//
// It is a refereeable one, which the old spelling was not. check-oracle takes
// every emittable scalar signature, not only the `//! js-export`ed ones, so a
// scalar core here is swept whether or not anything imports it — and the `frac`
// spelling missed the 1e-5 relative on 18 of its 2400 tuples, including
// in-domain ones like `(255, 2.5, 0.5, 0.25)`, a real screen px at dpr=4. The
// choice was a function nobody can check or a one-line change that costs
// nothing, so: the dash geometry is now under the CI gate.
public float dashCoverageAt(
    float coord, float dashPx, float gapPx, float aaPx) {
  float period = dashPx + gapPx;
  float shifted = coord + gapPx * 0.5;
  float phase = shifted - period * floor(shifted / period);
  return aaRamp(dashPx * 0.5 - abs(phase - period * 0.5), aaPx);
}

public float dashCoverage(float coord, float dashPx, float gapPx, float dpr) {
  return dashCoverageAt(coord, dashPx, gapPx, aaPx(dpr));
}

// A BUTT-capped stroked segment: the quad that covers it, and the coverage that
// shades it. They belong together because the pad is the contract — the quad
// grows by exactly `aaHalfPx(dpr)` past the ink on both axes, which is the
// ramp's reach and no more. Pad less and the ramp is clipped, silently; pad
// more and the surplus fragments shade to alpha 0 and blend anyway.
//
// Butt caps, because that is what the Canvas2D/SVG twins draw: both passes'
// drawCanvas strokes moveTo/lineTo with the default lineCap. The round cap
// belongs to `capsuleDist`, where it is load-bearing (a dotplot dot is the
// degenerate cap; linecenter's coincident caps make its max-blend joins
// seamless) — nothing here wants it, so the cut at the ends is the ink's own
// edge ramp. arcLine.slang is deliberately not a third consumer: a full-band
// tick has no caps, so it measures `abs(dx)` alone.
//
// The product form is exact: box-filter coverage of an axis-aligned rectangle
// separates per axis, so the ends are exactly as soft as the sides.
//
// `local` is in the SEGMENT's own frame — x along it, y across it — so a
// diagonal segment costs nothing here. Mapping that frame to the screen is the
// caller's, and genuinely differs: arcFlat's segment is horizontal by
// construction and adds `local` to a centre, while a linked-read connector
// rotates it onto capsuleFrame's tangent/normal.
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

// Exact distance from a point to the axis-aligned ellipse |p/ab| = 1 — Inigo
// Quilez's closed-form solve of the quartic. Used by arc.slang so a dome's
// coverage comes from the analytic curve rather than from the tessellated hull
// it is rasterized with.
//
// Chosen over the iterative alternatives because the arc band produces very
// flat ellipses (a 25px band under a 1500px pair is 44:1, and it goes past
// 88:1): measured against an fp64 reference at fp32 precision, this stays
// within 0.031px out to 88:1, where a seeded Newton on the parametric angle
// runs away entirely.
// NOT `//! js-export`ed, and the arc band's hover hit test has a second copy of
// this formula (features/arcs/ellipseDistance.ts) BECAUSE of that. The reasoning
// is worth keeping, since "lift it like arcRadiiPx" is the obvious first move
// and it was tried:
//
//   - The emitter refuses float2 params, so lifting means splitting a scalar
//     core out (the ADR-051 step-1 pattern). Necessary but NOT sufficient, and
//     the shortfall is SILENT: the core still calls acos/cos/sin, none of which
//     are in wgslToJs.ts's MATH_BUILTINS, so the emitter refuses it — and
//     check-oracle's `emittableOf` DROPS a refused candidate from the sweep
//     rather than failing on it. Do the split alone and the oracle stays green
//     on an unchanged comparison count, which reads as "the problem went away".
//     It has not; nothing has been checked.
//   - Add those three builtins and it does enter the sweep — which takes every
//     declared function with an emittable scalar signature, not only the
//     `//! js-export`ed ones, and `//! js-skip` does not exempt one either. Then
//     it fails, at the oracle's 1e-5 relative: 90 of the 400 tuples, 42 of them
//     on inputs with both radii positive (the sweep also generates negative
//     radii, which `arcRadiiPx` does not produce).
//   - And NOT because the twin is wrong. On every one of those 42 the float64
//     twin matches a brute-force minimum over the parametric angle to 1.1e-6
//     relative — inside the oracle's own tolerance — and slangc's float32 is the
//     side that has drifted: `(1.5, 0, 65536, 3)` is 3.0, where the C++ answers
//     3.3541019. float32 loses the solver, float64 does not.
//   - So the oracle cannot referee this function at any tolerance it could keep
//     for the rest of the tree, the same way it cannot referee `mix`/`step`
//     (SHADER_JS_CODEGEN.md). Exporting it would have meant a suppression in
//     the strongest gate here, to share a NUMERICAL METHOD rather than a
//     decision.
//
// What actually has to agree is WHICH ELLIPSE, and that is `arcRadiiPx` — which
// is exported, oracle-clean, and is what the hit test reads. Given the same two
// radii, the distance to them is geometry with one right answer, and the copy is
// pinned against a brute-force reference rather than against this (see
// ellipseDistance.test.ts), which is the stronger check of the two.
public float sdEllipse(float2 p, float2 radii) {
  float2 q = abs(p);
  float2 ab = radii;
  if (q.x > q.y) { q = q.yx; ab = ab.yx; }
  float l = ab.y * ab.y - ab.x * ab.x;
  // Circle: `l` is the solver's divisor, so hand those back the exact answer
  // rather than a division by ~0. Reachable — a clamped dome's ry is pinned to
  // the band while rx tracks the pair's width, so they cross.
  if (abs(l) < 1e-6 * ab.y * ab.y) { return abs(length(q) - ab.x); }
  float m = ab.x * q.x / l; float m2 = m * m;
  float n = ab.y * q.y / l; float n2 = n * n;
  float c = (m2 + n2 - 1.0) / 3.0;
  float c3 = c * c * c;
  float d = c3 + m2 * n2;
  float g = m + m * n2;
  float co;
  if (d < 0.0) {
    float h = acos(clamp((c3 + m2 * n2 * 2.0) / c3, -1.0, 1.0)) / 3.0;
    float s = cos(h);
    float t = sin(h) * sqrt(3.0);
    float rx = sqrt(max(-c * (s + t + 2.0) + m2, 0.0));
    float ry = sqrt(max(-c * (s - t + 2.0) + m2, 0.0));
    co = (ry + sign(l) * rx + abs(g) / max(rx * ry, 1e-20) - m) / 2.0;
  } else {
    float qq = c3 + m2 * n2 * 2.0;
    float h = 2.0 * m * n * sqrt(d);
    float s = sign(qq + h) * pow(abs(qq + h), 1.0 / 3.0);
    float t = sign(qq - h) * pow(abs(qq - h), 1.0 / 3.0);
    float rx = -s - t - c * 4.0 + 2.0 * m2;
    float ry = (s - t) * sqrt(3.0);
    float rm = sqrt(rx * rx + ry * ry);
    co = (ry / sqrt(max(rm - rx, 1e-20)) + 2.0 * g / max(rm, 1e-20) - m) / 2.0;
  }
  co = clamp(co, -1.0, 1.0);
  float2 r = ab * float2(co, sqrt(max(1.0 - co * co, 0.0)));
  return length(r - q);
}

// Distance from a point to a circle whose radius dwarfs the band it is clipped
// to — the far-pair case, where r reaches millions of px. `legLocal` is the
// point relative to the endpoint the circle meets the baseline at, x positive
// pointing AWAY from the circle.
//
// Exact, but written so nothing cancels: the centre sits at (-r, 0) in that
// frame, so |p-c|² = r² + 2r·x + x² + y² identically and
// |p-c| - r = rk / (sqrt(1+k) + 1) with both `rk` and `k` assembled from small
// terms. Evaluating `length(p - c) - r`, or even recovering x as
// `abs(p.x) - r` from a centre-relative point, loses every significant digit
// past r ≈ 1e6 px.
// Scalar core, `//! js-export`ed for the same consumer as `sdEllipsePx` — and
// for the same reason it is written this way at all: the hit test asking "is
// the cursor on this leg" from `length(p - c) - r` would lose every significant
// digit exactly where far pairs live.
public float distToWideCirclePx(float x, float y, float r) {
  float rk = 2.0 * x + (x * x + y * y) / r;
  return abs(rk / (sqrt(max(1.0 + rk / r, 0.0)) + 1.0));
}

public float distToWideCircle(float2 legLocal, float r) {
  return distToWideCirclePx(legLocal.x, legLocal.y, r);
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

public float hpLinear(float2 splitPos, Uniforms u) {
  return hpScaleLinear(splitPos, bpRange(u), u.hpZero);
}

// Type-safe bp→clip/linear converters. Accept a raw uint genomic position and
// perform the hpSplitUint internally — callers can't accidentally pass a
// pre-split float2 or a region-relative offset.
public float bpToClipX(uint bp, Uniforms u) {
  return hpClipX(hpSplitUint(bp), u);
}
public float bpToLinear(uint bp, Uniforms u) {
  return hpLinear(hpSplitUint(bp), u);
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

// Which palette slot a per-instance color type reads. Split from the two
// wrappers below only so it can be `//! js-export`ed — they take a `Uniforms`
// and return a color, neither of which the scalar emitter carries, and the
// index rule is the part all four backends have to agree on.
//
// It is a clamp, not a wrap. The Canvas2D twin was `colorIdx % palette.length`,
// which for an out-of-range slot resolves to a DIFFERENT REAL COLOR than the
// GPU's clamp rather than to an obviously-wrong one — the drift this file's
// other exports exist to prevent, and invisible in review because nothing
// currently emits a slot past 8.
public uint arcColorSlot(uint idx) {
  return min(idx, ARC_COLOR_SLOTS - 1u);
}

// The same rule for the linked-read connecting lines, whose palette is a
// different length. Separate function rather than a slots parameter: each is the
// index rule for one named palette, and a caller that can pass the wrong bound
// is the failure mode this replaces.
public uint linkedReadColorSlot(uint idx) {
  return min(idx, LINKED_READ_COLOR_SLOTS - 1u);
}

// Paired-read arc palette, indexed by the per-instance color type. Shared by
// the arc curves (arc.slang) and the interchromosomal connector ticks
// (arcLine.slang) so both stay in lockstep.
public float3 arcColorByIndex(uint idx, Uniforms u) {
  return u.arcColor[arcColorSlot(idx)].xyz;
}

// The short-insert slot, named because `getArcColorType` in
// features/arcs/arcColors.ts has to assign the same number this palette resolves.
// It is `//! export-consts`ed through arc.slang, so that side reads this
// constant instead of spelling `2` a second time.
public static const uint ARC_COLOR_SHORT_INSERT = 2u;

// The connector-tick slot, and the ONLY color an interchromosomal tick takes.
// Insert size, long-range distance and pair orientation are all meaningless
// across two references — a cross-chromosome "pair orientation" is arbitrary —
// so every translocation tick is this one color whatever `arcColorByType` says
// (see resolveArcs). That is why arcLine.slang carries no per-instance
// colorType: the attribute existed to convey a constant. `//! export-consts`ed
// through arcLine.slang, the pass that consumes it.
public static const uint ARC_COLOR_INTERCHROM = 3u;

// Where `yBp` plots within the arcs band, as a fraction in [0, inf).
// `useLog` picks a base-2 log scale (read cloud, so small inserts spread near
// the baseline instead of collapsing) over linear (arc mode, where yBp is a
// genomic radius); the linear branch guards a zero domain so it yields 0, not
// +inf.
//
// This and `arcYOffsetPx` below are `//! js-export`ed under the names the JS
// path already used: arcYScale.ts held a hand-written copy that had to stay
// byte-identical, feeding both the Canvas2D/SVG arc draw and the insert-size
// ruler ticks, so a tick label and the arc plotting its value came from two
// separately-maintained spellings of one formula.
public float arcYFraction(uint yBp, float arcsYDomainBp, bool useLog) {
  if (useLog) {
    return log2(max(1.0, float(yBp))) / log2(max(2.0, arcsYDomainBp));
  }
  return arcsYDomainBp > 0.0 ? float(yBp) / arcsYDomainBp : 0.0;
}

// Distance from the band's zero anchor to where `yBp` plots, clamped to the
// band. This is the FLAT-MARK rule: a read-cloud connector and its endpoint
// squares are a horizontal line AT this Y, so a line that left the band would
// simply be invisible and clamping is what keeps it on the axis.
public float arcYOffsetPx(uint yBp, float arcsYDomainBp, bool useLog,
                          float availH) {
  return min(availH, arcYFraction(yBp, arcsYDomainBp, useLog) * availH);
}


// Pixels of padding above the arc apex, subtracted from `u.arcBandH` to get the
// `availH` the two functions above measure against.
//
// It lives here, with the formula that consumes it, because arc.slang and
// arcMarker.slang must subtract the SAME margin or a read-cloud endpoint square
// misses its flat line by the difference. Both declared their own copy and a
// jest test pinned the two equal, on the belief that separate shader modules
// can't share a `static const`. They can — both passes already `import
// alignmentsUniforms`, and the codegen's constant evaluator resolves through
// imports, so `//! export-consts: ARC_HEIGHT_MARGIN` still emits the value into
// either pass's generated module. One declaration is what the test was
// approximating.
public static const float ARC_HEIGHT_MARGIN = 8.0;

// Plottable height of the arcs band: the drawn height less that margin, and
// NEVER negative.
//
// A band shorter than the margin is reachable from config alone —
// `readConnectionsHeight` is a plain number slot, and the 20px floor
// (`clampBandHeight`) constrains DRAGGING, not what a config or a session
// snapshot may declare — so any height in 1..7 arrives here. Unfloored, such a
// band gives `arcYOffsetPx` a negative `destY`, which is a negative `ry` on a
// dome: `ctx.ellipse` throws IndexSizeError on a negative radius and takes the
// rest of that block's Canvas2D paint with it, while the GPU throws nothing and
// draws the band inside out.
//
// Five callers ask this — arc.slang, arcFlat.slang and arcMarker.slang, plus
// arcYScale.ts's re-export, which is where both renderers' Y scales, `arcMark`,
// the hit test and the insert-size ruler get it. One definition is what keeps
// them agreeing at 0, where every arc plots at `destY` 0 and the band collapses
// to its anchor line — what a band with no room to plot in should look like.
public float arcAvailH(float bandH) {
  return max(0.0, bandH - ARC_HEIGHT_MARGIN);
}

// Read cloud/arc flat-line Y offset (unsigned px) within an `availH`-tall band.
// Shared by arcFlat.slang and arcMarker.slang so a read cloud endpoint square
// lands exactly on its flat line, and by the curved dome, whose apex it holds
// inside the band so a wide pair still draws a complete arc between its two
// endpoints rather than leaving through the band edge.
public float arcBandDestY(uint yBp, float availH, Uniforms u) {
  return arcYOffsetPx(yBp, u.arcsYDomainBp, u.arcsYLog > 0.5, availH);
}

// ---- The arc band's frame ------------------------------------------------
//
// Four passes draw into one band and each used to spell its geometry itself.
// That is four chances to disagree about which way arcs grow, how wide a
// coalesced mark strokes, and where the band sits on the canvas — and three of
// those spellings carried a comment saying "same as arc.slang, and for the same
// reason", which is the shape `arcAvailH` above was already extracted out of.

// Which way the band grows from its anchor. The predicate, not the sign, so
// arcLine.slang can ask it about the band's TOP EDGE (a different question with
// no clean sign form) without restating the comparison.
public bool arcsPointDown(Uniforms u) {
  return u.pairedArcsDown > 0.5;
}

public float arcYDir(Uniforms u) {
  return arcsPointDown(u) ? 1.0 : -1.0;
}

// Signed band-local Y, in CSS px from the anchor, of the flat mark an insert
// size plots at. arc.slang does NOT call this: it needs the unsigned `destY`
// for the dome's ry and the direction separately, so it takes the two pieces.
public float arcBandY(uint yBp, Uniforms u) {
  return arcBandDestY(yBp, arcAvailH(u.arcBandH), u) * arcYDir(u);
}

// Half the width an arc-band mark strokes at. `instWidthPx` is the instance's
// own, resolved from its read support by `arcLineWidth` at pack time; the
// uniform is the FLOOR every mark is raised to, which is an antialiasing
// property of the display (fillArcUniforms raises it to 1.5 device px) and not
// anything about how many reads a mark stands for. Both halves of that sentence
// have to be stated together, which is why this is one function and not a
// `max` at three call sites.
public float arcStrokeHalfPx(float instWidthPx, Uniforms u) {
  return max(instWidthPx, u.lineWidthPx) * 0.5;
}

// Where a genomic position sits along the band, in CSS px across the BLOCK.
//
// The band's x is the one piece of its frame that was still spelled six times —
// twice each in arc.slang and arcFlat.slang, once each in arcMarker.slang and
// arcLine.slang, identically. It is the block's own projection rather than
// `bpToClipX`'s canvas one because an arc's foot may be extrapolated well
// outside the block (a cross-region pair's far mate), and `blockStartPx` /
// `blockWidth` are what carry that extrapolation; `arcBandClipPos` normalizes
// the result afterwards. Passes that reach clip space directly — arcLine.slang,
// whose y is already canvas-absolute — still take their x from here.
public float arcBandX(uint bp, Uniforms u) {
  return u.blockStartPx + bpToLinear(bp, u) * u.blockWidth;
}

// A band-local point (CSS px from the anchor) placed on the canvas. The arc
// passes run in the FULL-canvas viewport — a grouped section's band may scroll
// partly off-screen, and WebGPU rejects an out-of-bounds one — so every band
// mark reaches clip space through the anchor rather than through a viewport of
// its own, and the scissor does the real clip. Forgetting `u.covOffset` or
// `flipX` here draws a band that is merely somewhere else, which is why the
// three passes doing it should not each be writing it out.
public float4 arcBandClipPos(float2 bandPx, Uniforms u) {
  return float4(
    flipX(pxToClipX(bandPx.x, u.canvasW), u),
    yPxToClipY(bandPx.y + u.covOffset, u.canvasH),
    0.0, 1.0);
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
// they paint over each other and because `makePileupCellMapper` is the one rule
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

// One channel of a fixed-saturation HSL hue sweep (chroma 0.5, lightness offset
// 0.25), off a hue in degrees [0,360); `lane` is 0/1/2 for R/G/B. Drives the
// MAPQ read fill (read.slang's RC_MAPQ), the one read category that is a
// per-read ramp rather than a palette slot.
//
// The sector arithmetic is the whole of what the two backends must agree on:
// Canvas2D hands the browser `hsl(mapq,50%,50%)` and never holds three
// channels, so what is exported is this lane — the scaling, the six sector
// boundaries and the `x` trapezoid — and the triple below stays packaging
// (adr-051 §"A vector signature is usually a scalar decision in a wrapper").
public float hueRampLane(float hueDeg, uint lane) {
  float hp = (hueDeg / 360.0) * 6.0;
  float c = 0.5;
  float m = 0.25;
  float x = c * (1.0 - abs(hp % 2.0 - 1.0));
  float v;
  if (hp < 1.0)      { v = lane == 0u ? c   : (lane == 1u ? x   : 0.0); }
  else if (hp < 2.0) { v = lane == 0u ? x   : (lane == 1u ? c   : 0.0); }
  else if (hp < 3.0) { v = lane == 0u ? 0.0 : (lane == 1u ? c   : x  ); }
  else if (hp < 4.0) { v = lane == 0u ? 0.0 : (lane == 1u ? x   : c  ); }
  else if (hp < 5.0) { v = lane == 0u ? x   : (lane == 1u ? 0.0 : c  ); }
  else               { v = lane == 0u ? c   : (lane == 1u ? 0.0 : x  ); }
  return v + m;
}

public float3 hueRampHalfSat(float hueDeg) {
  return float3(
    hueRampLane(hueDeg, 0u),
    hueRampLane(hueDeg, 1u),
    hueRampLane(hueDeg, 2u));
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

