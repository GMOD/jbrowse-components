// Hi-C contact map: one instance per binned contact, a square rotated 45° into
// the triangle, coloured by its count through the shared score scale.
//! targets: wgsl, glsl
//! blend: premultiplied
//! export-consts: MIN_VISIBLE_ALPHA

import colorRampLut;
import diagonalGrid;
import hpmath;
import scoreScale;

public static const uint VERTS_PER_INSTANCE = 6u;

struct HicInstance {
  float2 position : ATTR0;
  float  count    : ATTR1;
};

struct Uniforms {
  float2 canvasSize;
  float  binWidth;
  float  yScalar;
  float  domainMin;
  float  domainMax;
  float  viewScale;
  float  viewOffsetX;
  int    scaleType;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

// Dual-target shaders take a combined Sampler2D (ADR-005).
[[vk::binding(2, 0)]] Sampler2D<float4> colorRamp;

struct VsOut {
  float4 position : SV_Position;
  nointerpolation float count : COLOR0;
};

[shader("vertex")]
VsOut vs_main(HicInstance inst, uint vid : SV_VertexID) {
  float2 pos = inst.position + quadLocal(vid) * u.binWidth;

  VsOut o;
  o.position = diagonalCellToClip(
    pos, u.canvasSize, u.viewScale, u.viewOffsetX, u.yScalar);
  o.count = inst.count;
  return o;
}

// Below this a ramp entry is transparent and the bin is not painted; the
// Canvas2D and SVG paths skip on the same number.
public static const float MIN_VISIBLE_ALPHA = 0.01;

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float t = normalizeScore(
    fragIn.count, u.domainMin, u.domainMax, u.scaleType, 1.0);
  float4 c = rampColorPremultiplied(colorRamp, t);
  if (c.a < MIN_VISIBLE_ALPHA) {
    discard;
  }
  return c;
}
