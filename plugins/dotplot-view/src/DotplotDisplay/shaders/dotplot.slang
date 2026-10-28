// Dotplot line segment renderer. Each instance is a line from (x1,y1) to
// (x2,y2) in WINDOW-RELATIVE bp — cumBp minus a per-axis fetch-time base — so
// one Float32 per coord is sub-pixel accurate near the view
// (agent-docs/reference/BP_PRECISION.md). Each axis maps to screen px by one
// affine, `bpRel * scale + offset`, folded on the CPU in float64
// (segmentMark.writeUniforms); the v axis carries its flip as a negative scale.
// The segment draws as render-core's `capsule`, matching Canvas2D's
// lineCap:'round', so short alignments render as dots.
//
// Colors are pre-packed opaque ABGR; the plot-wide opacity slider is the
// `alpha` uniform (DotplotDisplay/CLAUDE.md).
//! targets: wgsl, glsl
//! coverage: analytic
//! blend: premultiplied

import antialias;
import capsule;
import colorPack;
import hpmath;

public static const uint VERTS_PER_INSTANCE = 6u;

struct DotplotInstance {
  float x1 : ATTR0;
  float y1 : ATTR1;
  float x2 : ATTR2;
  float y2 : ATTR3;
  uint  color : ATTR4;
};

struct Uniforms {
  float2 resolution;
  float2 scale;
  float2 offset;
  float  lineWidth;
  float  alpha;
  // getDpr() (capped at MAX_DPR): the shader measures in CSS px but rasterizes
  // on the device-px grid — see antialias.slang.
  float  devicePixelRatio;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  nointerpolation float4 color : COLOR0;
  float3 local : COLOR1;
};

[shader("vertex")]
VsOut vs_main(DotplotInstance inst, uint vid : SV_VertexID) {
  float2 p1 = float2(inst.x1, inst.y1) * u.scale + u.offset;
  float2 p2 = float2(inst.x2, inst.y2) * u.scale + u.offset;
  SegmentCorner c =
    capsuleCorner(vid, p2 - p1, u.lineWidth * 0.5, u.devicePixelRatio);

  VsOut o;
  o.position = screenToClip((c.atEnd ? p2 : p1) + c.offsetPx, u.resolution);
  o.color = unpackRGBA(inst.color);
  o.local = c.local;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float edgeAlpha = strokeCoverage(
    u.lineWidth * 0.5, capsuleDist(fragIn.local), u.devicePixelRatio);
  // Premultiplied output, so the slider scales rgb with it.
  float finalAlpha = fragIn.color.a * u.alpha * edgeAlpha;
  // The pad's fragments ramp to nothing; dropping them keeps them off the
  // blender.
  if (finalAlpha <= 0.0) {
    discard;
  }
  return float4(fragIn.color.rgb * finalAlpha, finalAlpha);
}
