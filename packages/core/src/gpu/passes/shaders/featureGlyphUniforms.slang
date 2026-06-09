// Shared uniform layout for the LGV feature-glyph passes (rect, line, chevron,
// arrow) in this directory. All four passes bind the same UBO at binding(1,0);
// a consuming renderer writes it once per block. The hp-math bp→clip helpers
// below are the canonical way to convert absolute genomic uint positions to
// clip space — always prefer them over calling hpToClipX directly.
module featureGlyphUniforms;

import hpmath;

public struct FeatureGlyphUniforms {
  // [bpStartHi, bpStartLo, ±clippedLengthBp]. Component 2 is negated for
  // reversed blocks, flipping clip-x in hpToClipX. See blockClipUtils.ts.
  public float3 bpRangeX;
  public float  canvasHeight;
  public float  canvasWidth;
  public float  scrollY;
  public float  bpPerPx;
  // Precision-barrier sentinel for hpmath; see hpmath.slang.
  public float  zero;
  // 0=forward, 1=reversed (float so `lerp(x, -x, reversed)` is branchless).
  public float  reversed;
  public uint   outlineColor;
};

// Type-safe bp→clip/linear converters. Mirrors the same wrappers in
// alignmentsUniforms.slang — always prefer these over calling
// hpToClipX(hpSplitUint(...), u.bpRangeX, u.zero) directly.
public float bpToClipX(uint bp, FeatureGlyphUniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}
public float bpToLinear(uint bp, FeatureGlyphUniforms u) {
  return hpScaleLinear(hpSplitUint(bp), u.bpRangeX, u.zero);
}
// Pre-split variant for cases where the caller already has a float2 split
// (e.g. after arithmetic on split components).
public float hpClipX(float2 splitPos, FeatureGlyphUniforms u) {
  return hpToClipX(splitPos, u.bpRangeX, u.zero);
}
// Flip a value's sign when the block is reversed (branchless lerp). Used for
// both clip-space positions and direction scalars (+1/-1).
public float flipX(float x, FeatureGlyphUniforms u) {
  return lerp(x, -x, u.reversed);
}
