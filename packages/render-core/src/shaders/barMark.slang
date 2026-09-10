// The `bar` mark shape: one instance is a rectangle spanning [x, x2) in
// absolute genomic coords, standing between the `origin` value and the
// instance's own `y` on the shared `valueScale` — the quantitative bar a BED
// score column, a CNV segment ratio or a bedGraph-shaped interval draws as.
//
// The scale is `valueScale`'s and the anchor is this shape's own (ADR-097): the
// point shape centres a glyph on the value, this one grows from the baseline to
// it, and both read one `valueToYPx`.
//
// The two HORIZONTAL cuts are antialiased analytically, as wiggle's xyplot bar
// does: the top cut IS the datum, so it must not quantise to the output grid,
// and the band is the difference of the two cuts' ramps so a bar thinner than a
// device pixel covers exactly its area. The VERTICAL cuts stay hard on purpose
// — intervals that tile (segments, bins) split a pixel column with their
// neighbours, and per-fragment alpha on both sides of that shared edge
// composites to less than full ink. That fractional edge is why this shader
// declares no `//! coverage: analytic`: the multisampled target resolves it.
//
// The min-width floor grows off the START edge (`extendToMinWidthX`), which is
// what the painter's `spanLeft` does too, so a reversed block's bars stay exact
// mirrors of a forward block's.
//! targets: wgsl, glsl

import antialias;
import hpmath;
import colorPack;
import markColor;
import valueScale;

public static const uint VERTS_PER_INSTANCE = 6u;

struct BarMarkInstance {
  uint  x     : ATTR0;
  uint  x2    : ATTR1;
  float y     : ATTR2;
  uint  color : ATTR3;
};

struct Uniforms {
  float3 bpRangeX;
  float  canvasHeight;
  float  domainMin;
  float  domainMax;
  // `scoreScale`'s scale-type vocabulary, for the declared y scale.
  int    valueScaleType;
  // `markColor`'s: 0 packs the instance's colour, 1 and 2 read its slot as a
  // value through the ramp below.
  int    rampMode;
  float  rampMin;
  float  rampMax;
  // The baseline value bars grow from, on the same scale as `y`.
  float  origin;
  float  zero;
  // The CSS width `minWidthPx` is measured against; see rowRect's
  // `minCellDenomPx` for why it has to be a CSS width.
  float  minCellDenomPx;
  float  minWidthPx;
  float  devicePixelRatio;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;
[[vk::binding(2, 0)]] Sampler2D<float4> colorRamp;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // CSS px below the bar's top cut (.x) and below its bottom cut (.y), both
  // affine in screen y with unit slope, so the fragment's ramp is one output
  // pixel wide by construction and takes no derivative.
  float2 barInkPx : TEXCOORD0;
};

float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

// One device pixel in CSS px: the ramp's full width and the geometry pad, so
// every fragment the ramp gives ink to is fully covered by the quad.
float barAaPx() {
  return 2.0 * aaHalfPx(u.devicePixelRatio);
}

[shader("vertex")]
VsOut vs_main(BarMarkInstance inst, uint vid : SV_VertexID) {
  float sx1 = bpToClipX(inst.x, u);
  float sx2 = bpToClipX(inst.x2, u);
  sx2 = extendToMinWidthX(sx1, sx2, u.minWidthPx, u.minCellDenomPx);
  float2 q = quadLocal(vid);

  float valueY = valueToYPxScaled(inst.y, u.domainMin, u.domainMax, u.canvasHeight, u.valueScaleType);
  float originY = valueToYPxScaled(u.origin, u.domainMin, u.domainMax, u.canvasHeight, u.valueScaleType);
  float topPx = min(valueY, originY);
  float botPx = max(valueY, originY);
  float padPx = barAaPx();
  float vy = lerp(botPx + padPx, topPx - padPx, q.y);

  VsOut o;
  o.position = float4(lerp(sx1, sx2, q.x), yPxToClipY(vy, u.canvasHeight), 0.0, 1.0);
  o.color = markInstanceColor(colorRamp, inst.color, u.rampMode, u.rampMin, u.rampMax);
  o.barInkPx = float2(vy - topPx, vy - botPx);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut v) : SV_Target {
  float aaPx = barAaPx();
  float alpha = aaRamp(v.barInkPx.x, aaPx) - aaRamp(v.barInkPx.y, aaPx);
  if (alpha <= 0.0) discard;
  return float4(v.color.rgb, v.color.a * alpha);
}
