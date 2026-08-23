// Shared coverage-band primitive: the uniform block, the band geometry and the
// depth-normalizer every mark in a coverage histogram is placed by.
//
// Two displays draw exactly this band — the alignments pileup's depth/SNP/
// modification/interbase strip and the MAF display's depth/SNP/interbase strip
// — off the same worker-packed buffers (`@jbrowse/alignments-core`'s
// `packCoverageBinsForGpu`, `computeSNPCoverage`, `computeInterbaseCoverage`).
// The five entry-point shaders beside this file are the only copy of each pass,
// so a change to a bar's height rule lands in both displays by construction.
//
// It shipped as the alignments plugin's own passes over its plugin-wide
// `Uniforms` struct, with the MAF band on Canvas2D only. Lifting them here cost
// the alignments renderer one extra UBO write per band per block (it already
// does the same for its arc band) and bought a second consumer that cannot
// drift: MAF's band is now the same five draws, not a second reading of them.
//
// Colors arrive as packed u32 ABGR (one slot each, no std140 vec3 padding) and
// are read with `unpackRGBA(u.colorX).xyz` from colorPack.
//! export-consts: TRIANGLE_HW, TRIANGLE_H
// The band's px-space decisions, lifted for the Canvas2D and SVG painters that
// have to land on the same pixels (adr-051). They live in
// @jbrowse/alignments-core because that is where those painters are, and it
// cannot depend on a plugin — nor, being upstream of it, on this package.
//! js-export: covEffectiveHeightPx, covBottomOffsetPx, normalizeDepthScalar
//! js-export-out: packages/alignments-core/src/coverageBandLayout.generated.ts
//! consts-out: packages/alignments-core/src/indicatorTriangle.generated.ts
//! js-skip: covExpandMinWidthX — a 1 CSS px floor over hpmath's expandToMinWidthX, which is where the rule and the reason it has no Canvas2D twin are recorded
module coverageBand;

import colorPack;
import hpmath;
import scoreScale;

public struct CoverageBandUniforms {
  // HP-split bp range: hi = base-pair offset (high 20 bits), lo = fractional
  // low 12 bits, len = visible span in bp. See hpmath.slang.
  public float bpHi;
  public float bpLo;
  public float bpLen;
  // Runtime 0.0 sentinel. HP math uses 1/hpZero to materialize +inf without the
  // compiler folding the hi/lo combination. MUST always be uploaded as 0.0.
  public float hpZero;

  public float canvasW;
  public float canvasH;

  // The band box. `covTop` is the screen-pixel Y of the band's top edge: 0 for
  // a band pinned to the canvas top, a scrolled offset for one that travels
  // with a stacked section. `covYOffset` is the scalebar-label inset, reserved
  // at BOTH ends — see covEffectiveHeightPx.
  public float covHeight;
  public float covYOffset;
  public float covTop;

  // The depth axis. `depthScale` is regionMaxDepth / domainMax, which is what
  // recovers a raw depth from the buffer's `relDepth`; the domain is the
  // display's autoscaled one, so a rescale needs no repack.
  public float depthScale;
  public float depthDomainMax;
  public float depthDomainMin;
  // symlog's linear-region width, already resolved from the domain on the JS
  // side (see resolveSymlogConstant). Unread by the other two scales.
  public float coverageSymlogConstant;

  // Bin width in bp for the depth bars: 1 for per-bp coverage, wider once the
  // producer downsamples.
  public float binSize;
  // Full-scale height in px of the interbase histogram — see
  // `interbaseBarHeightPx`, which is the one rule the draw, the hit test and
  // this uniform share.
  public float interbaseHeight;
  // Allele-fraction floor for the SNP segments: a segment whose `segHeight`
  // (its share of THIS position's depth) is below this is folded away. 0 draws
  // every mismatch. The depth bar underneath is not gated, so a hidden segment
  // reads as reference rather than as a gap.
  public float snpMinFreq;
  public float reversed;

  public int coverageScaleType; // 0 = linear, 1 = log2, 2 = symlog

  public uint colorCoverage;
  public uint colorBaseA;
  public uint colorBaseC;
  public uint colorBaseG;
  public uint colorBaseT;
  // Also what a non-A/C/G/T base takes, and the muted grey a palette collapse
  // writes into all five. Resolved on the CPU so the shader has one lookup and
  // no mode to branch on.
  public uint colorBaseN;
  // The band's own indicator variants (lightened in dark mode), distinct from
  // the pileup's insertion/clip fills; see covClipKindColor.
  public uint colorInsertionIndicator;
  public uint colorSoftclipIndicator;
  public uint colorHardclipIndicator;
};

// Coverage-band clip indicator triangle, in CSS px: half-width and height.
// Four consumers depend on this one number: coverageIndicator.slang draws the
// triangle, coverageInterbase.slang hangs its bars directly below one, and the
// Canvas2D painter + hit test read it from `@jbrowse/alignments-core` — which
// the `consts-out` directive above generates from these declarations, so the
// cross-package copy can't drift either.
public static const float TRIANGLE_HW = 3.5;
public static const float TRIANGLE_H  = 4.5;

// Shared vertex output for the band's four solid-fill passes. The indicator
// pass carries a barycentric varying as well and declares its own.
public struct CoverageVsOut {
  public float4 position : SV_Position;
  public float4 color    : COLOR0;
};

// Fold a vertex to the origin (degenerate, invisible), for an instance a gate
// dropped. Folding rather than shrinking is what leaves the rest of the stack
// where it was.
public CoverageVsOut covDiscardVertex() {
  CoverageVsOut o;
  o.position = float4(0.0);
  o.color = float4(0.0);
  return o;
}

public float covBpToClipX(uint bp, CoverageBandUniforms u) {
  return hpToClipX(hpSplitUint(bp), float3(u.bpHi, u.bpLo, u.bpLen), u.hpZero);
}

public float covFlipX(float x, CoverageBandUniforms u) {
  return lerp(x, -x, u.reversed);
}

// Widen a [x1,x2] clip-space span to a minimum of 1 CSS pixel about its
// MIDPOINT, so sub-pixel-narrow marks (a coverage bin, a 1bp SNP slice) stay
// visible without sliding off the coordinate they report. The 1.0 is this
// band's floor; hpmath's `expandToMinWidthX` is the rule.
public float2 covExpandMinWidthX(float x1, float x2, float canvasWidth) {
  return expandToMinWidthX(x1, x2, 1.0, canvasWidth);
}

// Clip-space position of one corner of a box mark: interpolate the
// [x0,x1] x [yBot,yTop] clip box by the quadLocal() corner and apply the
// reverse-strand X flip. Y args are (bottom, top) to match quadLocal's Y-up
// local.y.
public float4 covFlippedQuad(float x0, float x1, float yBot, float yTop,
                             float2 local, CoverageBandUniforms u) {
  return float4(covFlipX(lerp(x0, x1, local.x), u), lerp(yBot, yTop, local.y),
                0.0, 1.0);
}

// The band's two px-space numbers, factored out of the clip-space conversions
// below so `//! js-export` can lift them. `covYOffset` is the scalebar-label
// inset, reserved at BOTH ends — hence the drawable height losing two of them
// while the baseline loses one.
//
// `coverageLayout` in @jbrowse/alignments-core's coverageBandBox.ts is the
// generated twin, read by the coverage bars, the SNP segments, the modification
// segments and the y-axis ticks. Both backends measure every mark from these,
// so disagreeing shifts the whole band rather than one glyph — visible only
// against the other backend.
//
// Floored at 0 here, at the declaration, because a band shorter than its two
// insets otherwise INVERTS rather than degrades: every mark is
// `baseline - fraction * effectiveH`, so a negative height grows the depth
// bars, the SNP segments stacked in them and the interbase bars DOWNWARD from a
// baseline sitting near the band's top edge. `covHeight` reaches here unclamped
// — a resize handle floors at 20 but a config slot declaring less is left where
// it is — and 2 * covYOffset is 10, so any band under 10px drew upside down on
// both backends.
public float covEffectiveHeightPx(float covHeight, float covYOffset) {
  return max(covHeight - 2.0 * covYOffset, 0.0);
}

// Distance from the band's top edge down to the bars' baseline.
public float covBottomOffsetPx(float covHeight, float covYOffset) {
  return covHeight - covYOffset;
}

public float covEffHeight(CoverageBandUniforms u) {
  return covEffectiveHeightPx(u.covHeight, u.covYOffset);
}

// Clip-space Y of the band's top edge. Single source for where every
// top-anchored mark (bars, SNP/mod segments, indicators, interbase histogram)
// starts. covTop == 0 → clip-top (1.0), the pinned-band behavior; a stacked
// section passes its scrolled top.
public float covAreaTop(CoverageBandUniforms u) {
  return yPxToClipY(u.covTop, u.canvasH);
}

public float covBottom(CoverageBandUniforms u) {
  return covAreaTop(u)
    - (covBottomOffsetPx(u.covHeight, u.covYOffset) / u.canvasH) * 2.0;
}

// Normalize a raw coverage depth to [0,1] over the domain [min, max], on the
// current scale type — `scoreScale.slang`'s normalizer under the coverage
// band's name for it.
//
// The name is what the alignments coverage reads it by: it is the scalar twin
// of makeScoreNormalizer in packages/wiggle-core/src/normalize.ts, which is
// what the Canvas2D coverage draws and the y-axis ticks go through, and
// `coverageNormalizeParity.test.ts` pins all of those against each other. The
// three branches themselves are no longer here — this band and the wiggle
// renderer had a copy each and they had drifted (see scoreScale.slang).
public float normalizeDepthScalar(float rawDepth, float domainMin, float domainMax, int scaleType, float symlogConstant) {
  return normalizeScore(rawDepth, domainMin, domainMax, scaleType, symlogConstant);
}

// The uniform-block wrapper every pass calls. Recovers the raw depth from the
// packed `relDepth` (= rawDepth / regionMaxDepth, with
// depthScale = regionMaxDepth / domainMax) and hands it to the scalar above.
// Split in two so the scalar half can be `//! js-export`ed — the twin emitter
// cannot carry a uniform struct across.
public float covNormalizeDepth(float relDepth, CoverageBandUniforms u) {
  float rawDepth = relDepth * u.depthScale * u.depthDomainMax;
  return normalizeDepthScalar(
    rawDepth, u.depthDomainMin, u.depthDomainMax, u.coverageScaleType,
    u.coverageSymlogConstant);
}

// Bar height scale: maps relDepth to a clip-space height multiplier. Shared by
// every stacked-segment pass so the formula can't drift between them.
public float covBarScale(float relDepth, CoverageBandUniforms u) {
  return covNormalizeDepth(relDepth, u) * covEffHeight(u) / u.canvasH * 2.0;
}

// Stacked-segment quad — the geometry of EVERY bar in the band. A `widthBp`-wide
// rect whose bottom/top are the yOffset / yOffset+segHeight fractions of this
// position's coverage bar (covBarScale(relDepth)).
//
// The three passes differ only in what they put in those parameters. The SNP and
// modification segments are 1bp slices of a bar (widthBp 1, a partial y span);
// the depth bar itself is the whole bar (widthBp = u.binSize, y span 0..1), and
// coverageBar.slang open-coded it once — the same four calls in the same order,
// so the band could shift under its own segments without anything catching it.
// Passing `0.0, 1.0` is not a special case here, it is what "the whole bar"
// spells.
public float4 covSegQuad(uint position, uint widthBp, float yOffset,
                         float segHeight, float relDepth, float2 local,
                         CoverageBandUniforms u) {
  float2 xx = covExpandMinWidthX(
    covBpToClipX(position, u), covBpToClipX(position + widthBp, u), u.canvasW);
  float bottom = covBottom(u);
  float k = covBarScale(relDepth, u);
  float segBot = bottom + yOffset * k;
  float segTop = segBot + segHeight * k;
  return covFlippedQuad(xx.x, xx.y, segBot, segTop, local, u);
}

// SNP segment fill. colorType encodes 1=A 2=C 3=G 4=T 5=N; 5 and any other type
// take the dedicated N color. `snpColorForType` in @jbrowse/alignments-core is
// the Canvas2D twin.
public float3 covSnpColor(float ct, CoverageBandUniforms u) {
  switch (int(ct)) {
    case 1:  return unpackRGBA(u.colorBaseA).xyz;
    case 2:  return unpackRGBA(u.colorBaseC).xyz;
    case 3:  return unpackRGBA(u.colorBaseG).xyz;
    case 4:  return unpackRGBA(u.colorBaseT).xyz;
    default: return unpackRGBA(u.colorBaseN).xyz;
  }
}

// Interbase mark fill, for both the histogram bars and the indicator triangles:
// 1=insertion 2=softclip 3=hardclip, with anything else taking the insertion
// color — the same fallback `drawIndicators`' lut takes for an out-of-range
// kind. Nothing reaches that arm today (the interbase compute only ever emits
// 1..3), which is exactly why the two spellings disagreeing would be invisible.
public float3 covClipKindColor(float ct, CoverageBandUniforms u) {
  int ci = int(ct);
  if (ci == 2) { return unpackRGBA(u.colorSoftclipIndicator).xyz; }
  if (ci == 3) { return unpackRGBA(u.colorHardclipIndicator).xyz; }
  return unpackRGBA(u.colorInsertionIndicator).xyz;
}
