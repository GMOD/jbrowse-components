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
  // NOT the canvas width: the renderer writes the block's *scissored* width, the
  // same span clip x = ±1 covers (bpRangeX carries the clipped bp range). Px↔clip
  // conversions and the continuation pass's edge tests are all block-local, so
  // this is the width they must measure against. The true canvas width never
  // reaches a shader — `canvasEdgeFlags` consumes it on the CPU and hands the
  // result down as left/rightIsCanvasEdge.
  public float  canvasWidth;
  public float  scrollY;
  public float  bpPerPx;
  // Precision-barrier sentinel for hpmath; see hpmath.slang.
  public float  zero;
  // 0=forward, 1=reversed (float so `lerp(x, -x, reversed)` is branchless).
  public float  reversed;
  public uint   outlineColor;
  // 1.0 when this block's left/right visible edge is the true canvas edge (vs.
  // an internal seam between two displayedRegions). Only the continuation pass
  // reads these — they gate the "feature keeps going" marker so it can't appear
  // at a mid-screen region boundary.
  public float  leftIsCanvasEdge;
  public float  rightIsCanvasEdge;
};

// Type-safe bp→clip/linear converters. Mirrors the same wrappers in
// alignmentsUniforms.slang — always prefer these over calling
// hpToClipX(hpSplitUint(...), u.bpRangeX, u.zero) directly.
public float bpToClipX(uint bp, FeatureGlyphUniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}
// Pre-split variant for cases where the caller already has a float2 split
// (e.g. after arithmetic on split components).
public float hpClipX(float2 splitPos, FeatureGlyphUniforms u) {
  return hpToClipX(splitPos, u.bpRangeX, u.zero);
}
// CSS px → clip-space *length*, against this block's visible width (see
// `canvasWidth` above) and the canvas height. `pxToClipLen` in hpmath owns the
// conversion and the reason to spell px dimensions through one; these two bind
// it to the axis so a call site names neither the 2 nor the uniform.
public float pxToClipW(float px, FeatureGlyphUniforms u) {
  return pxToClipLen(px, u.canvasWidth);
}
public float pxToClipH(float px, FeatureGlyphUniforms u) {
  return pxToClipLen(px, u.canvasHeight);
}
// Flip a value's sign when the block is reversed (branchless lerp). Used for
// both clip-space positions and direction scalars (+1/-1).
public float flipX(float x, FeatureGlyphUniforms u) {
  return lerp(x, -x, u.reversed);
}
