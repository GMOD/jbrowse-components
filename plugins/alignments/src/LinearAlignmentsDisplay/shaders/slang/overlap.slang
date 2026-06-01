// Chain overlap hatch: a full-row-height quad over the genomic interval where
// two reads in the same chain (same row) overlap. The fragment shader paints
// semi-transparent diagonal stripes in screen-pixel space so the overlapped
// span reads as cross-hatching regardless of zoom. Hidden under ~3px rows
// where the hatch would be noise (mirrors the read-pass chevron gate).
//! targets: wgsl, glsl

import alignmentsUniforms;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

static const float STRIPE_PERIOD_PX = 6.0;
static const float STRIPE_WIDTH_PX = 2.0;

struct Instance {
  uint  startOff : ATTR0;
  uint  endOff   : ATTR1;
  float y        : ATTR2;
};

struct VsOut {
  float4 position : SV_Position;
  // Fragment offset within the overlap rect, in CSS px. Diagonal coordinate is
  // localPx.x + localPx.y, giving 45° stripes independent of rect dimensions.
  float2 localPx  : COLOR0;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  float2 local = quadLocal(vid);

  float sx1 = hpClipX(hpSplitUint(inst.startOff), u);
  float sx2 = hpClipX(hpSplitUint(inst.endOff), u);

  float2 yy = pileupY(inst.y, u);
  float syTop = yy.x;
  float syBot = yy.y;

  float widthPx = (sx2 - sx1) * u.canvasW * 0.5;
  o.localPx = float2(local.x * widthPx, local.y * u.featHeight);

  o.position = float4(
    flipX(lerp(sx1, sx2, local.x), u),
    lerp(syBot, syTop, local.y),
    0.0, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  if (u.featHeight < 3.0) { return float4(0.0); }
  float d = (fragIn.localPx.x + fragIn.localPx.y) % STRIPE_PERIOD_PX;
  if (d < STRIPE_WIDTH_PX) {
    return float4(1.0, 1.0, 1.0, 0.6);
  }
  return float4(0.0);
}
