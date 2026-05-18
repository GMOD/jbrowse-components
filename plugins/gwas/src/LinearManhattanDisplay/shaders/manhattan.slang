// Manhattan plot scatter point renderer.
// Each feature is a filled circle (disc) rendered as a quad of 6 vertices.
// GWAS scores are conventionally pre-transformed (e.g. -log10 p), so we only
// do linear Y mapping — no log branch here.
//! targets: wgsl, glsl

import hpmath;
import colorPack;

public static const uint VERTS_PER_INSTANCE = 6u;

struct ManhattanInstance {
  uint  absPosition : ATTR0;
  float score       : ATTR1;
  uint  color       : ATTR2;
};

struct Uniforms {
  float3 bpRangeX;
  float  canvasHeight;
  float  domainYMin;
  float  domainYMax;
  float  zero;
  float  viewportWidth;
  float  reversed;
  float  pointRadius;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float2 localPos : TEXCOORD0;
};

// 1px pad (in device pixels) around the disc so the smoothstep edge has room
// to fade. localPos is normalized so length==1.0 sits exactly on the disc edge.
static const float AA_PAD_PX = 1.0;

[shader("vertex")]
VsOut vs_main(ManhattanInstance inst, uint vid : SV_VertexID) {
  uint v = vid % 6u;

  // Two-triangle quad: x=0 when v in {0,2,3}, y=0 when v in {0,1,4}
  bool xZero = (v == 0u || v == 2u || v == 3u);
  bool yZero = (v == 0u || v == 1u || v == 4u);
  float qx = xZero ? 0.0 : 1.0;
  float qy = yZero ? 0.0 : 1.0;
  float2 local = float2(qx, qy) * 2.0 - float2(1.0, 1.0);

  float centerClipX = hpToClipX(hpSplitUint(inst.absPosition), u.bpRangeX, u.zero);
  float scoreNorm = clamp(
    (inst.score - u.domainYMin) / (u.domainYMax - u.domainYMin),
    0.0,
    1.0,
  );
  float scoreYPx = (1.0 - scoreNorm) * u.canvasHeight;
  float centerClipY = yPxToClipY(scoreYPx, u.canvasHeight);

  float expand = (u.pointRadius + AA_PAD_PX) / max(u.pointRadius, 0.5);
  float halfPx = u.pointRadius * expand;
  float dx = local.x * halfPx * 2.0 / u.viewportWidth;
  float dy = local.y * halfPx * 2.0 / u.canvasHeight;

  VsOut o;
  o.position = float4(lerp(centerClipX, -centerClipX, u.reversed) + dx, centerClipY + dy, 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  o.localPos = local * expand;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float d = length(fragIn.localPos);
  float aa = fwidth(d);
  float alpha = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
  if (alpha <= 0.0) discard;
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}
