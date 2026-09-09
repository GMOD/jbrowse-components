// #exampleFile shared | the `score` shape's shader: one box per feature, compiled by gen:shaders
// The score shape: one box per instance, spanning x->x2 and grown up from the
// canvas bottom to y (0..1) x canvasHeight, every box in the one uniform ABGR
// color. The box height is written here once and lifted into a
// TypeScript twin, which the painter and the hit test read.
//! targets: wgsl, glsl
//! export-consts: MIN_WIDTH_PX
//! js-export: scoreBarHeightPx

import hpmath;
import colorPack;

public static const uint VERTS_PER_INSTANCE = 6u;

// Narrowest a box paints, in CSS px, so a 1bp feature still shows at
// chromosome zoom. Both backends floor at this constant.
static const float MIN_WIDTH_PX = 1.0;

struct ScoreInstance {
  uint  x  : ATTR0;
  uint  x2 : ATTR1;
  float y  : ATTR2;
};

struct Uniforms {
  // hpmath genomic->clip transform (hi, lo, +/-clippedLengthBp)
  float3 bpRangeX;
  float  zero;
  // CSS px of the block column clip space spans, not the whole canvas
  float  viewportWidth;
  float  canvasHeight;
  uint   color;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

float scoreBarHeightPx(float score, float canvasHeight) {
  return clamp(score, 0.0, 1.0) * canvasHeight;
}

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(ScoreInstance inst, uint vid : SV_VertexID) {
  // quadLocal maps the 6 vertices to the corners of a unit box: x/y each 0 or 1.
  float2 local = quadLocal(vid);

  float x1 = bpToClipX(inst.x, u);
  float x2 = bpToClipX(inst.x2, u);
  // reversal-safe: it is baked into bpRangeX's negated length, so x2 < x1 on a
  // reversed block and the widening grows the same way
  x2 = extendToMinWidthX(x1, x2, MIN_WIDTH_PX, u.viewportWidth);
  float x = local.x < 0.5 ? x1 : x2;

  float barHeightPx = scoreBarHeightPx(inst.y, u.canvasHeight);
  // local.y: 0 = top of the box, 1 = bottom (canvas bottom edge).
  float yPx = (u.canvasHeight - barHeightPx) + local.y * barHeightPx;

  VsOut o;
  o.position = float4(x, yPxToClipY(yPx, u.canvasHeight), 0.0, 1.0);
  o.color = unpackRGBA(u.color);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}
