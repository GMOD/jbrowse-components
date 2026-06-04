// Shared uniform layout for every canvas feature shader. All four passes
// (rect, line, chevron, arrow) bind the same UBO at binding(1,0) and
// `GpuCanvasFeatureRenderer` writes it once per block — see
// `CANVAS_FEATURE_UNIFORM_BYTE_SIZE`.
module canvasUniforms;

import hpmath;

public struct CanvasUniforms {
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
public float bpToClipX(uint bp, CanvasUniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}
public float bpToLinear(uint bp, CanvasUniforms u) {
  return hpScaleLinear(hpSplitUint(bp), u.bpRangeX, u.zero);
}
// Pre-split variant for cases where the caller already has a float2 split
// (e.g. after arithmetic on split components).
public float hpClipX(float2 splitPos, CanvasUniforms u) {
  return hpToClipX(splitPos, u.bpRangeX, u.zero);
}
// Flip a value's sign when the block is reversed (branchless lerp). Used for
// both clip-space positions and direction scalars (+1/-1).
public float flipX(float x, CanvasUniforms u) {
  return lerp(x, -x, u.reversed);
}
