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

  // Canvas + region metadata
  public uint  regionStart;
  public float canvasW;
  public float canvasH;
  public float rangeY0;
  public float scrollTop;
  public float covOffset;
  public float featHeight;
  public float featSpacing;

  // Coverage strip (above pileup)
  public float covHeight;
  public float covYOffset;
  public float depthScale;
  public float binSize;
  public float noncovHeight;
  public float depthDomainMax; // coverage domain maximum (for log scale normalization)

  // Visible domain for cigar/coverage x conversion
  public float domainStart;
  public float domainEnd;

  // Insert-size thresholds
  public float insertUpper;
  public float insertLower;

  // Arc pass
  public float blockStartPx;
  public float blockWidth;
  public float lineWidthPx;
  public float gradientHue;
  public float pairedArcsDown;

  // Flags (ints / float-as-bool)
  public int colorScheme;
  public int highlightIdx;
  public int highlightOnly;
  public int chainMode;
  public int showStroke;
  public int flipStrandLongRead;
  public int coverageScaleType; // 0 = linear, 1 = log2
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
  public uint colorInsertion;
  public uint colorDeletion;
  public uint colorSkip;
  public uint colorSoftclip;
  public uint colorHardclip;
  public uint colorCoverage;
  public uint colorModFwd;
  public uint colorModRev;
  public uint colorLongInsert;
  public uint colorShortInsert;
  public uint colorSupplementary;
  public uint colorUnmappedMate;
  public uint arcColor0;
  public uint arcColor1;
  public uint arcColor2;
  public uint arcColor3;
  public uint arcColor4;
  public uint arcColor5;
  public uint arcColor6;
  public uint arcColor7;
  public uint arcLineColor0;
  public uint arcLineColor1;
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

public float flipX(float x, Uniforms u) {
  return lerp(x, -x, u.reversed);
}

// Returns (yTopClip, yBotClip) for a pileup row index.
public float2 pileupY(float row, Uniforms u) {
  float rowH = u.featHeight + u.featSpacing;
  float yTop = row * rowH - u.rangeY0;
  float yBot = yTop + u.featHeight;
  float px2clip = 2.0 / u.canvasH;
  float topClip = 1.0 - (u.covOffset / u.canvasH) * 2.0;
  return float2(topClip - yTop * px2clip, topClip - yBot * px2clip);
}

public float2 cigarDomain(Uniforms u) {
  return float2(u.domainStart, u.domainEnd);
}

public float cigarDomainLen(Uniforms u) {
  return u.domainEnd - u.domainStart;
}

public float effHeight(Uniforms u) {
  return u.covHeight - 2.0 * u.covYOffset;
}

public float covBottom(Uniforms u) {
  return 1.0 - ((u.covHeight - u.covYOffset) / u.canvasH) * 2.0;
}

// Quad vertex -> local (x,y) in [0,1] for a 6-vertex quad strip.
// v=0 (0,0) v=1 (1,1) v=2 (0,1) v=3 (0,0) v=4 (1,0) v=5 (1,1)
public float2 quadLocal(uint vid) {
  uint v = vid % 6u;
  float lx = (v == 0u || v == 2u || v == 3u) ? 0.0 : 1.0;
  float ly = (v == 0u || v == 1u || v == 4u) ? 0.0 : 1.0;
  return float2(lx, ly);
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
