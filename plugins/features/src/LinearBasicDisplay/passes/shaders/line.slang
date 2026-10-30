// Thin 1px horizontal line connecting rects within a feature (introns), with
// the butt ends Canvas2D strokes it with. Instance data shared with
// chevron.slang — see lineInstance.slang.
//! targets: wgsl, glsl
//! coverage: analytic

import antialias;
import hpmath;
import colorPack;
import lineInstance;
import featureGlyphUniforms;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<FeatureGlyphUniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // CSS px inside the left end, inside the right end, and from the centre row
  float3 inside   : TEXCOORD0;
};

[shader("vertex")]
VsOut vs_main(LineInstance inst, uint vid : SV_VertexID) {
  float cw = u.canvasWidth;
  float x1 = clipXToPx(bpToClipX(inst.startEnd.x, u), cw);
  float x2 = clipXToPx(bpToClipX(inst.startEnd.y, u), cw);
  float left = min(x1, x2);
  float right = max(x1, x2);
  float cy = snapBoxCenterYPx(inst.y, u.scrollY);
  float padX = aaHalfPx(u.devicePixelRatio);
  float padY = snappedEdgePadPx(u);

  float2 q = quadLocal(vid);
  float x = lerp(left - padX, right + padX, q.x);
  float y = lerp(cy - 0.5 - padY, cy + 0.5 + padY, q.y);

  VsOut o;
  o.position = float4(pxToClipX(x, cw), yPxToClipY(y, u.canvasHeight), 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  o.inside = float3(x - left, right - x, y - cy);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut v) : SV_Target {
  float dpr = u.devicePixelRatio;
  float a = v.color.a * strokeCoverage(0.5, abs(v.inside.z), dpr)
          * slabCoverage(v.inside.x, -v.inside.y, dpr);
  if (a <= 0.0) discard;
  return float4(v.color.rgb, a);
}
