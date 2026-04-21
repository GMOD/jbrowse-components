// Shared uniform layout for every canvas feature shader. All four passes
// (rect, line, chevron, arrow) bind the same UBO at binding(1,0) and
// `GpuCanvasFeatureRenderer` writes it once per block — see
// `CANVAS_FEATURE_UNIFORM_BYTE_SIZE`. Keeping the struct in one place stops
// the four copies from drifting silently.
module canvasUniforms;

public struct CanvasUniforms {
  public float3 bpRangeX;
  public uint   regionStart;
  public float  canvasHeight;
  public float  canvasWidth;
  public float  scrollY;
  public float  bpPerPx;
  public float  zero;
  public float  reversed;
  public uint   outlineColor;
};
