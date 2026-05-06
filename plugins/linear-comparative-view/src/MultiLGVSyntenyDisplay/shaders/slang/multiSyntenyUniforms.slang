// Shared uniform block used by every multi-synteny pass (fill / coverage /
// SNP / indicator). Same UBO is written once per block and re-read by each
// pass, so the struct must stay in lockstep with fillSyntenyUniforms() on
// the CPU side.
module multiSyntenyUniforms;

public struct Uniforms {
  public float resolutionX;
  public float resolutionY;
  public float rowHeight;
  public float coverageHeight;
  public float bpRangeHi;
  public float bpRangeLo;
  public float bpRangeLen;
  public float regionScreenLeft;
  public float regionScreenWidth;
  public float hpZero;
  public float rowPadding;
  public float coverageYOffset;
  public float depthScale;
  public float coverageR;
  public float coverageG;
  public float coverageB;
  public float baseAR;
  public float baseAG;
  public float baseAB;
  public float baseCR;
  public float baseCG;
  public float baseCB;
  public float baseGR;
  public float baseGG;
  public float baseGB;
  public float baseTR;
  public float baseTG;
  public float baseTB;
};

// Two-triangle fan (CCW): returns the (x,y) ∈ {0,1}² corner for vid 0..5.
public float2 quadCorner(uint vid) {
  uint v = vid % 6u;
  return float2(
    (v == 0u || v == 2u || v == 3u) ? 0.0 : 1.0,
    (v == 0u || v == 1u || v == 4u) ? 0.0 : 1.0
  );
}
