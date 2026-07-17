// Shared uniform block + helpers for both LD shader variants (genomic +
// uniform-grid). The genomic variant ignores `uniformW`; keeping the struct
// identical lets both shaders share a single UBO byte layout so the renderer
// writes one uniform buffer per frame regardless of which pass draws.
module ldUniforms;

public struct Uniforms {
  public float2 canvasSize;
  public float  yScalar;
  public float  viewScale;
  public float  viewOffsetX;
  public uint   signedLd;
  public float  uniformW;
};

static const float ROT_45 = 0.7071067811865476;

// Genome-space cell corner -> clip space. Both variants lay cells out as
// 45°-rotated squares above the x-axis, so the rotation + view transform is
// identical; only how `pos` is derived differs (per-instance attribute vs.
// decoded grid index).
public float4 ldCellToClip(float2 pos, Uniforms u) {
  float rx = (pos.x + pos.y) * ROT_45;
  float ry = (-pos.x + pos.y) * ROT_45;
  float sx = rx * u.viewScale + u.viewOffsetX;
  float sy = ry * u.viewScale * u.yScalar;
  return float4(
    (sx / u.canvasSize.x) * 2.0 - 1.0,
    1.0 - (sy / u.canvasSize.y) * 2.0,
    0.0, 1.0);
}

// Sample the color ramp by `ldValue`, remapping signed [-1,1] -> [0,1] when
// signedLd is set. Returns premultiplied-alpha color.
public float4 ldRampColor(float ldValue, Uniforms u, Sampler2D<float4> ramp) {
  float t = (u.signedLd == 1u) ? (ldValue + 1.0) * 0.5 : ldValue;
  t = clamp(t, 0.0, 1.0);
  float4 c = ramp.SampleLevel(float2(t, 0.5), 0.0);
  return float4(c.rgb * c.a, c.a);
}

// Decode flat lower-triangular instance index `idx` into (i, j) with i > j,
// where idx = i*(i-1)/2 + j. The float sqrt gives an approximate `i`; the
// correction loops fix the off-by-one that float32 rounding introduces once
// 8*idx exceeds 2^24 (~n>2000 cells). Shared with the worker compute kernels
// (ldCompute / ldPhasedCompute): they decode each cell to the same (i, j) the
// render path lays it out at, so a divergent copy would put values in the
// wrong grid cell.
public uint2 decodeTriangular(uint idx) {
  uint i = uint((1.0 + sqrt(1.0 + 8.0 * float(idx))) * 0.5);
  while (i * (i - 1u) / 2u > idx) { i -= 1u; }
  while ((i + 1u) * i / 2u <= idx) { i += 1u; }
  uint j = idx - i * (i - 1u) / 2u;
  return uint2(i, j);
}
