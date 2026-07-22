// Score display: one box per feature. The box spans start->end horizontally and
// its height is score (0..1) x canvasHeight, grown up from the bottom. A single
// uniform ABGR color fills every box. This is the minimal per-region GPU pass
// used by the "GPU displays" developer guide.
//! targets: wgsl, glsl

import hpmath;
import colorPack;

public static const uint VERTS_PER_INSTANCE = 6u;

struct ScoreInstance {
  uint  startBp : ATTR0;
  uint  endBp   : ATTR1;
  float score   : ATTR2;
};

struct Uniforms {
  // hpmath genomic->clip transform (hi, lo, +/-clippedLengthBp)
  float3 bpRangeX;
  float  zero;
  float  canvasWidth;
  float  canvasHeight;
  uint   color;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(ScoreInstance inst, uint vid : SV_VertexID) {
  // quadLocal maps the 6 vertices to the corners of a unit box: x/y each 0 or 1.
  float2 local = quadLocal(vid);

  float x1 = bpToClipX(inst.startBp, u);
  float x2 = bpToClipX(inst.endBp, u);
  // widen a sub-pixel feature so a 1bp box still paints (reversal-safe: reversal
  // is baked into bpRangeX's negated length, so x2 < x1 on reversed blocks).
  x2 = extendToMinWidthX(x1, x2, 1.0, u.canvasWidth);
  float x = local.x < 0.5 ? x1 : x2;

  float barHeightPx = clamp(inst.score, 0.0, 1.0) * u.canvasHeight;
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
