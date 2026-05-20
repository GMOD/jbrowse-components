// Shared uniform layout for every canvas feature shader. All four passes
// (rect, line, chevron, arrow) bind the same UBO at binding(1,0) and
// `GpuCanvasFeatureRenderer` writes it once per block — see
// `CANVAS_FEATURE_UNIFORM_BYTE_SIZE`.
module canvasUniforms;

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
