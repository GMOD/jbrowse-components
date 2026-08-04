// Shared uniform block + helpers for every alignments-plugin shader. One
// UBO is written per block render and re-read by every pass so the struct
// below stays in lockstep with writeUniforms() in GpuAlignmentsRenderer.
//
// Colors are packed as u32 ABGR (one slot each, no std140 vec3 padding);
// shaders read them with `unpackRGBA(u.colorX).xyz` (see colorPack.slang).
// See hic/canvas/multi-synteny for the same pattern on the CPU side
// (cssColorToABGR).
//! export-consts: TRIANGLE_HW, TRIANGLE_H
// The sub-pixel frequency lerp is a pure scalar decision both backends must
// make identically; rendererTypes.ts imports the generated twin rather than
// re-deriving it (adr-051).
//! js-export: frequencyAlpha, arcYFraction, arcYOffsetPx
//! consts-out: packages/alignments-core/src/indicatorTriangle.generated.ts
module alignmentsUniforms;

import colorPack;
import hpmath;

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

  // Coverage strip (above pileup)
  public float covHeight;
  public float covYOffset;
  // Screen-pixel Y of the coverage area's top edge. 0 for the single-section
  // (ungrouped) path, where coverage is sticky at the canvas top. For stacked
  // grouped sections it is the section's scrolled coverage top, so the band
  // scrolls with its section. covAreaTop() folds it into the clip-space anchor
  // every coverage pass shares.
  public float covTop;
  public float depthScale;
  public float binSize;
  public float interbaseHeight;
  public float depthDomainMax; // coverage domain maximum (for log scale normalization)

  // Insert-size thresholds
  public float insertUpper;
  public float insertLower;

  // Arc pass
  public float blockStartPx;
  public float blockWidth;
  public float lineWidthPx;
  public float gradientHue;
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
  public int coverageScaleType; // 0 = linear, 1 = log2
  // 1 = filter low-freq mismatches/insertions/gaps by coverage depth (default);
  // 0 = show all at full alpha (user has disabled frequency filtering)
  public int filterMismatchesByFrequency;
  // 1 = fade mismatch bases by their per-base Phred quality (advanced setting);
  // 0 = full alpha regardless of quality.
  public int mismatchAlpha;
  public float reversed;

  // Color palette — each uint is a packed ABGR value (1 byte per channel,
  // alpha in the high byte). Unpack with `unpackRGBA(u.colorX).xyz`.
  public uint colorFwd;
  public uint colorRev;
  public uint colorNostrand;
  public uint colorPairLR;
  public uint colorPairRL;
  public uint colorPairRR;
  public uint colorPairLL;
  public uint colorBaseA;
  public uint colorBaseC;
  public uint colorBaseG;
  public uint colorBaseT;
  public uint colorBaseN;
  public uint colorInsertion;
  public uint colorDeletion;
  public uint colorSkip;
  public uint colorSoftclip;
  public uint colorHardclip;
  // Coverage-track indicator variants (lightened in dark mode); see clipKindColor.
  public uint colorInsertionIndicator;
  public uint colorSoftclipIndicator;
  public uint colorHardclipIndicator;
  public uint colorCoverage;
  public uint colorModFwd;
  public uint colorModRev;
  public uint colorLongInsert;
  public uint colorShortInsert;
  public uint colorSupplementary;
  public uint colorUnmappedMate;
  public uint colorInterchrom;
  // Muted grey for non-A/C/G/T mismatch/softclip bases (e.g. N) and the
  // showModifications palette collapse. Matches the Canvas2D path and MAF.
  public uint colorMutedSnpBase;
  public uint arcColor0;
  public uint arcColor1;
  public uint arcColor2;
  public uint arcColor3;
  public uint arcColor4;
  public uint arcColor5;
  public uint arcColor6;
  public uint arcColor7;
  // Linked-read connecting-line palette (linkedReadBezier mode). 8 slots so
  // every paired-orientation (unknown/LR/RL/RR/LL) and split-strand pairing
  // (RF/FR/same) has its own ABGR color, looked up by per-instance colorType.
  public uint linkedReadColor0;
  public uint linkedReadColor1;
  public uint linkedReadColor2;
  public uint linkedReadColor3;
  public uint linkedReadColor4;
  public uint linkedReadColor5;
  public uint linkedReadColor6;
  public uint linkedReadColor7;
  public float pxPerBp;
  // Dedicated paired-split-inversion fill color (only the read pass reads it).
  // Kept at the tail for offset stability — appending here leaves the other
  // shaders' generated offsets alone.
  public uint colorSplitInversion;
  // 9th arc-palette slot (split-read deletion). Appended at the tail so adding
  // it leaves arcColor0..7's offsets — and every other field's — unchanged.
  public uint arcColor8;
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
  public float dpr;
};

// Coverage-strip clip indicator triangle, in CSS px: half-width and height.
// Four consumers depend on this one number: indicator.slang draws the triangle,
// interbaseHistogram.slang hangs its bars directly below one, and the Canvas2D
// painter + hit test read it from `@jbrowse/alignments-core` — which the
// `consts-out` directive above generates from these declarations, so the
// cross-package copy can't drift either.
public static const float TRIANGLE_HW = 3.5;
public static const float TRIANGLE_H  = 4.5;

// Antialiased-stroke ramp for the arc band's passes (arc, arcLine), in DEVICE
// pixels — one device pixel is the box-filter width Canvas2D rasterizes with,
// so this is what keeps the GPU and Canvas2D mirrors the same weight.
//
// The passes build a distance that is a true perpendicular distance in CSS px,
// so its gradient magnitude is analytically 1 per CSS px and there is nothing
// for `fwidth` to discover: measuring it only reintroduces the |ddx|+|ddy|
// anisotropy, which cost the arc up to 0.1 of peak alpha on its diagonal flanks
// while leaving the apex crisp. But the constant is one DEVICE px, not one CSS
// px — spelling it in CSS px (as STROKE_PERP_PX does in the synteny shaders)
// silently doubles the ramp on a dpr=2 display and reads as a soft, mushy line.
// Hence `strokeCoverage` divides by u.dpr.
public static const float STROKE_AA_PX = 1.0;

// Coverage of an antialiased stroke `halfWidthPx` wide (CSS px) at true
// perpendicular distance `d` (CSS px). Shared so the arc and arcLine passes
// cannot drift in weight; a geometry pad of STROKE_AA_PX CSS px always covers
// the ramp, since dpr >= 1.
public float strokeCoverage(float d, float halfWidthPx, Uniforms u) {
  float aa = STROKE_AA_PX / max(u.dpr, 1.0);
  return clamp((halfWidthPx - d) / aa + 0.5, 0.0, 1.0);
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
public float distToWideCircle(float2 legLocal, float r) {
  float rk = 2.0 * legLocal.x
           + (legLocal.x * legLocal.x + legLocal.y * legLocal.y) / r;
  return abs(rk / (sqrt(max(1.0 + rk / r, 0.0)) + 1.0));
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
  float px2clip = 2.0 / u.canvasH;
  return float2(1.0 - yTopPx * px2clip, 1.0 - (yTopPx + u.featHeight) * px2clip);
}

// Screen-pixel Y of a pileup row's vertical center.
public float pileupRowCenterPx(float row, Uniforms u) {
  return pileupRowTopPx(row, u) + u.featHeight * 0.5;
}

// Paired-read arc palette (arcColor0..8), indexed by the per-instance color
// type. Shared by the arc curves (arc.slang) and the interchromosomal
// connector ticks (arcLine.slang) so both stay in lockstep.
public float3 arcColorByIndex(uint idx, Uniforms u) {
  uint colors[9];
  colors[0] = u.arcColor0; colors[1] = u.arcColor1;
  colors[2] = u.arcColor2; colors[3] = u.arcColor3;
  colors[4] = u.arcColor4; colors[5] = u.arcColor5;
  colors[6] = u.arcColor6; colors[7] = u.arcColor7;
  colors[8] = u.arcColor8;
  return unpackRGBA(colors[min(idx, 8u)]).xyz;
}

// Read-cloud endpoint-square palette. The squares are filled opaque
// marks, so they read fine with the pale pileup-fill short-insert (colorShortInsert
// #ffc0cb) and must match it — index 2 in the arc palette is the *saturated*
// stroke variant (colorShortInsertArc #ff3a8c), chosen so a thin translucent arc
// line stays visible, which would mismatch the pale legend/pileup swatch. Every
// other index defers to the shared arc palette. Index 2 == COLOR_SHORT_INSERT in
// features/arcs/compute.ts.
public float3 arcMarkerColorByIndex(uint idx, Uniforms u) {
  if (idx == 2u) { return unpackRGBA(u.colorShortInsert).xyz; }
  return arcColorByIndex(idx, u);
}

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
// band.
public float arcYOffsetPx(uint yBp, float arcsYDomainBp, bool useLog,
                          float availH) {
  return min(availH, arcYFraction(yBp, arcsYDomainBp, useLog) * availH);
}

// Read cloud/arc flat-line Y offset (unsigned px) within an `availH`-tall band.
// Shared by arc.slang (flat line + dome apex) and arcMarker.slang so a read
// cloud endpoint square lands exactly on its flat line.
public float arcBandDestY(uint yBp, float availH, Uniforms u) {
  return arcYOffsetPx(yBp, u.arcsYDomainBp, u.arcsYLog > 0.5, availH);
}

// Interbase-histogram / indicator clip-kind palette: 1=insertion 2=softclip
// 3=hardclip (anything else falls through to hardclip). Uses the *Indicator
// colors — coverage-track marks sit on the dark track background, where the
// saturated on-read colors (insertion.slang / clip.slang) would wash out.
public float3 clipKindColor(float ct, Uniforms u) {
  int ci = int(ct);
  if (ci == 1) { return unpackRGBA(u.colorInsertionIndicator).xyz; }
  if (ci == 2) { return unpackRGBA(u.colorSoftclipIndicator).xyz; }
  return unpackRGBA(u.colorHardclipIndicator).xyz;
}

// Widen a [x1,x2] clip-space span to a minimum of 1 CSS pixel, centered, so
// sub-pixel-narrow features (1bp rects, coverage bins zoomed out) stay visible.
public float2 expandMinWidthX(float x1, float x2, float canvasWidth) {
  float minW = 2.0 / canvasWidth;
  if (x2 - x1 < minW) {
    float mid = (x1 + x2) * 0.5;
    return float2(mid - minW * 0.5, mid + minW * 0.5);
  }
  return float2(x1, x2);
}

// Fixed-saturation HSL hue sweep (chroma 0.5, lightness offset 0.25). Drives
// MAPQ / base-quality coloring and the arc gradient fallback off a hue in
// degrees [0,360).
public float3 hueRampHalfSat(float hueDeg) {
  float hp = (hueDeg / 360.0) * 6.0;
  float c = 0.5;
  float m = 0.25;
  float x = c * (1.0 - abs(hp % 2.0 - 1.0));
  float3 hue;
  if (hp < 1.0)      { hue = float3(c, x, 0.0); }
  else if (hp < 2.0) { hue = float3(x, c, 0.0); }
  else if (hp < 3.0) { hue = float3(0.0, c, x); }
  else if (hp < 4.0) { hue = float3(0.0, x, c); }
  else if (hp < 5.0) { hue = float3(x, 0.0, c); }
  else               { hue = float3(c, 0.0, x); }
  return hue + m;
}

// The coverage band's two px-space numbers, factored out of the clip-space
// conversions below so `//! js-export` can lift them (coverage.slang carries
// the directive, since a module has no draw path of its own to keep them
// alive). `covYOffset` is the scalebar-label inset, reserved at BOTH ends —
// hence the drawable height losing two of them while the baseline loses one.
//
// rendererUtils.ts's `coverageLayout` was the hand-written twin, read by the
// coverage bars, the SNP segments and the modification segments. Both backends
// measure every coverage mark from these, so disagreeing shifts the whole band
// rather than one glyph — visible only against the other backend.
public float covEffectiveHeightPx(float covHeight, float covYOffset) {
  return covHeight - 2.0 * covYOffset;
}

// Distance from the coverage area's top edge down to the bars' baseline.
public float covBottomOffsetPx(float covHeight, float covYOffset) {
  return covHeight - covYOffset;
}

public float effHeight(Uniforms u) {
  return covEffectiveHeightPx(u.covHeight, u.covYOffset);
}

// Clip-space Y of the coverage area's top edge. Single source for where every
// band-top-anchored coverage mark (bars, SNP/mod segments, indicators,
// interbase histogram) starts. covTop == 0 → clip-top (1.0), the ungrouped
// sticky-coverage behavior; grouped sections pass their scrolled top.
public float covAreaTop(Uniforms u) {
  return 1.0 - (u.covTop / u.canvasH) * 2.0;
}

public float covBottom(Uniforms u) {
  return covAreaTop(u)
    - (covBottomOffsetPx(u.covHeight, u.covYOffset) / u.canvasH) * 2.0;
}

// Normalize a coverage depth value (relDepth = rawDepth / regionMaxDepth) to [0,1]
// using the current coverage scale type. depthScale = regionMaxDepth / domainMax.
// Linear: relDepth * depthScale = rawDepth / domainMax.
// Log: log2(max(rawDepth,1)) / log2(max(domainMax,1)).
public float normalizeDepth(float relDepth, Uniforms u) {
  if (u.coverageScaleType == 1) {
    float rawDepth = relDepth * u.depthScale * u.depthDomainMax;
    float logMax = log2(max(u.depthDomainMax, 1.0));
    if (logMax <= 0.0) { return 0.0; }
    return clamp(log2(max(rawDepth, 1.0)) / logMax, 0.0, 1.0);
  }
  return relDepth * u.depthScale;
}

// Sub-pixel alpha blend: lerp between `base` and 1.0 using per-site frequency.
// Mirrors frequencyAlpha() in rendererTypes.ts.
public float frequencyAlpha(float base, float freq) {
  return base + freq * (1.0 - base);
}

// The whole low-frequency fade gate for one instance: honors the
// "show low frequency mismatches" toggle and skips instances already covering a
// full pixel. Passes supply `base` from their geometry — pxPerBp (mismatch,
// clip) or its square (insertion, gap deletion), which fades narrow features
// faster. Squaring can't change the sub-pixel test, since base < 1.0 ⟺
// pxPerBp < 1.0 for non-negative values.
//
// Every fading pass must go through this rather than reassembling the gate
// locally — a hand-rolled copy is how the clip pass silently lost its
// filterMismatchesByFrequency check. Mirrors frequencyFade() in rendererTypes.ts.
public float frequencyFade(float base, float freq, Uniforms u) {
  return (u.filterMismatchesByFrequency != 0 && base < 1.0)
    ? frequencyAlpha(base, freq)
    : 1.0;
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

// Coverage bar height scale: maps relDepth to a clip-space height multiplier.
// Shared by snpCoverage and modCoverage so the formula can't drift between them.
public float covBarScale(float relDepth, Uniforms u) {
  return normalizeDepth(relDepth, u) * effHeight(u) / u.canvasH * 2.0;
}

// Coverage-strip stacked-segment quad (SNP + modification coverage). A 1bp-wide
// rect whose bottom/top are the yOffset / yOffset+segHeight fractions of this
// position's coverage bar (covBarScale(relDepth)). Shared so the two passes'
// geometry can't drift — they differ only in how each colors the segment.
public float4 covSegQuad(uint position, float yOffset, float segHeight,
                         float relDepth, float2 local, Uniforms u) {
  float2 xx = expandMinWidthX(
    bpToClipX(position, u), bpToClipX(position + 1u, u), u.canvasW);
  float bottom = covBottom(u);
  float k = covBarScale(relDepth, u);
  float segBot = bottom + yOffset * k;
  float segTop = segBot + segHeight * k;
  return flippedQuadPos(xx.x, xx.y, segBot, segTop, local, u);
}

// Clip-space position of one corner of a box mark: interpolate the
// [x0,x1] x [yBot,yTop] clip box by the quadLocal() corner and apply the
// reverse-strand X flip. Y args are (bottom, top) to match quadLocal's Y-up
// local.y. Collapses the flip+lerp corner math shared by every box glyph.
public float4 flippedQuadPos(float x0, float x1, float yBot, float yTop, float2 local, Uniforms u) {
  return float4(flipX(lerp(x0, x1, local.x), u), lerp(yBot, yTop, local.y), 0.0, 1.0);
}

