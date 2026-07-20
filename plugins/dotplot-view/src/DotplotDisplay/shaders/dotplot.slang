

public static const uint VERTS_PER_INSTANCE = 6u;
// Dotplot line segment renderer. Each instance is a line from (x1,y1) to
// (x2,y2) in WINDOW-RELATIVE bp — cumBp minus a per-axis fetch-time base
// (`baseH`/`baseV` = the viewport-start cumBp captured when the geometry was
// built). The base keeps on-screen coords small-magnitude, so a single Float32
// per coord is sub-pixel accurate — no hi/lo hp-math split. (Absolute cumBp is
// genome-scale, up to Gbp, past Float32's 24-bit mantissa, and would need the
// split; the base cancels that.) This is viable because the fetch is scoped per
// h-window and refetches when it moves, and a zoom rebuilds the geometry (so the
// base is recaptured near the view). Far-off-screen coords — a distant-mate
// segment on another chromosome, only reachable off-screen — lose absolute
// precision but only on the clipped-away sliver; visible error stays
// ~panDistancePx*2^-23.
//
// The shader converts window-relative bp to screen px with
// `bpRel*bpPerPxInv + panPx`, where `panPx = (base - viewBp)/bpPerPx` is folded
// on the CPU (float64) from a SMALL delta (see GpuDotplotRenderer.render), then
// expands the line into a screen-space quad with rounded caps, matching
// Canvas2D's lineCap:'round' behavior. The quad is extended by lineWidth/2 along
// the segment tangent at each end and a capsule SDF in the fragment shader
// produces circular caps so short alignments render as dots that grow
// isotropically with lineWidth.
//
// Colors are pre-packed ABGR u32 on the CPU side
// (dotplotColors.ts#packColor). Blend uses premultiplied alpha
// (one / one-minus-src-alpha).
//! targets: wgsl, glsl

import colorPack;
import hpmath;

struct DotplotInstance {
  float x1 : ATTR0;
  float y1 : ATTR1;
  float x2 : ATTR2;
  float y2 : ATTR3;
  uint  color : ATTR4;
};

// Per-axis `panPx` + `bpPerPxInv`. `panPx = (base - viewBp)/bpPerPx` (computed
// float64 on the main thread from a SMALL delta) carries how far the current
// view has panned from the fetch-time base; `bpRel*bpPerPxInv + panPx`
// reconstructs the screen position.
struct Uniforms {
  float2 resolution;
  float  lineWidth;
  float  panPxH;
  float  bpPerPxHInv;
  float  panPxV;
  float  bpPerPxVInv;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // uv.x: signed distance along the segment in screen px (0 at start, segLen
  //   at end; the cap quad extends to -halfWidth and segLen+halfWidth).
  // uv.y: signed perpendicular distance in screen px (±halfWidth at quad edges).
  float2 uv       : COLOR1;
  // x = segLen (screen px), y = halfWidth (screen px). Constant per instance.
  nointerpolation float2 dims : COLOR2;
};

[shader("vertex")]
VsOut vs_main(DotplotInstance inst, uint vid : SV_VertexID) {
  uint v = vid % VERTS_PER_INSTANCE;

  // Quad template: pairs (0,1), (2,3), (4,5) form two triangles.
  // t interpolates along the segment, side pushes to one edge by halfWidth.
  float2 q = quadLocal(v);
  float t = q.y;
  float side = q.x * 2.0 - 1.0;

  float sx1 = inst.x1 * u.bpPerPxHInv + u.panPxH;
  float sy1 = u.resolution.y - (inst.y1 * u.bpPerPxVInv + u.panPxV);
  float sx2 = inst.x2 * u.bpPerPxHInv + u.panPxH;
  float sy2 = u.resolution.y - (inst.y2 * u.bpPerPxVInv + u.panPxV);

  float dx = sx2 - sx1;
  float dy = sy2 - sy1;
  float len = sqrt(dx * dx + dy * dy);
  float halfWidth = u.lineWidth * 0.5;

  float2 tangent;
  float2 normal;
  if (len > 0.001) {
    tangent = float2(dx, dy) / len;
    normal = float2(-dy, dx) / len;
  } else {
    tangent = float2(1.0, 0.0);
    normal = float2(0.0, 1.0);
  }

  // Extend quad by halfWidth along the tangent at each end so the rounded
  // caps have geometry to shade.
  float capDir = t * 2.0 - 1.0;
  float2 center = lerp(float2(sx1, sy1), float2(sx2, sy2), t);
  float2 pos = center + tangent * capDir * halfWidth + normal * side * halfWidth;

  VsOut o;
  o.position = screenToClip(pos, u.resolution);
  o.color = unpackRGBA(inst.color);
  o.uv = float2(t * len + capDir * halfWidth, side * halfWidth);
  o.dims = float2(len, halfWidth);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  // Capsule SDF: distance from the fragment to the segment {(0,0)..(segLen,0)}.
  // For very short segments (segLen << halfWidth) this collapses to the
  // distance from origin, producing a circular dot of radius halfWidth.
  float segLen = fragIn.dims.x;
  float halfWidth = fragIn.dims.y;
  float cx = clamp(fragIn.uv.x, 0.0, segLen);
  float du = fragIn.uv.x - cx;
  float dv = fragIn.uv.y;
  float d = sqrt(du * du + dv * dv);
  float aa = fwidth(d);
  float edgeAlpha = 1.0 - smoothstep(halfWidth - aa, halfWidth + aa, d);
  float finalAlpha = fragIn.color.a * edgeAlpha;
  return float4(fragIn.color.rgb * finalAlpha, finalAlpha);
}
