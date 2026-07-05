// Shared uniform block + helpers for every alignments-plugin shader. One
// UBO is written per block render and re-read by every pass so the struct
// below stays in lockstep with writeUniforms() in GpuAlignmentsRenderer.
//
// Colors are packed as u32 ABGR (one slot each, no std140 vec3 padding);
// shaders read them with `unpackRGBA(u.colorX).xyz` (see colorPack.slang).
// See hic/canvas/multi-synteny for the same pattern on the CPU side
// (cssColorToABGR).
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
  // zoom; samplot mode sets it to the autoscaled max |insert size| so the
  // line Y is zoom-stable. One code path, mode-dependent value.
  public float arcsYDomainBp;
  // 1 = map yBp→Y with a base-2 log scale (samplot read cloud), 0 = linear
  // (arc/bezier mode). Float-as-bool to stay in the float block.
  public float arcsYLog;

  // Flags (ints / float-as-bool)
  public int colorScheme;
  public int chainMode;
  public int showStroke;
  public int flipStrandLongRead;
  public int coverageScaleType; // 0 = linear, 1 = log2
  // 1 = filter low-freq mismatches/insertions/gaps by coverage depth (default);
  // 0 = show all at full alpha (user has disabled frequency filtering)
  public int filterMismatchesByFrequency;
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
  // 1 = opt-in legacy behavior: paint paired supplementary chains a flat
  // supplementary color (hides pair orientation); 0 = keep per-scheme color.
  // Only the read pass reads it; kept last so adding it leaves every other
  // shader's shared-UBO field offsets unchanged.
  public int colorSuppChains;
  // Dedicated paired-split-inversion fill color (only the read pass reads it).
  // Kept at the tail, next to colorSuppChains, for the same offset-stability
  // reason — appending here left the other 17 shaders' generated offsets alone.
  public uint colorSplitInversion;
  // 9th arc-palette slot (split-read deletion). Appended at the tail so adding
  // it leaves arcColor0..7's offsets — and every other field's — unchanged.
  public uint arcColor8;
};

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

public float effHeight(Uniforms u) {
  return u.covHeight - 2.0 * u.covYOffset;
}

// Clip-space Y of the coverage area's top edge. Single source for where every
// band-top-anchored coverage mark (bars, SNP/mod segments, indicators,
// interbase histogram) starts. covTop == 0 → clip-top (1.0), the ungrouped
// sticky-coverage behavior; grouped sections pass their scrolled top.
public float covAreaTop(Uniforms u) {
  return 1.0 - (u.covTop / u.canvasH) * 2.0;
}

public float covBottom(Uniforms u) {
  return covAreaTop(u) - ((u.covHeight - u.covYOffset) / u.canvasH) * 2.0;
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

