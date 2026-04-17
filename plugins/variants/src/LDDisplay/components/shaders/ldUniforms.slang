// Shared uniform block for both LD shader variants (genomic + uniform-grid).
// The genomic variant ignores `uniformW`; keeping the struct identical lets
// both shaders share a single UBO byte layout so the renderer writes one
// uniform buffer per frame regardless of which pass draws.
module ldUniforms;

public struct Uniforms {
  public float2 canvasSize;
  public float  yScalar;
  public float  viewScale;
  public float  viewOffsetX;
  public uint   signedLd;
  public float  uniformW;
};
