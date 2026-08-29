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
// draws the segment as render-core's shared `capsule` shape — a quad expanded
// in the segment's own frame, clipped by the fragment to a round-capped stroke
// — matching Canvas2D's lineCap:'round' behavior, so short alignments render
// as dots that grow isotropically with lineWidth. The pad/ramp contract and
// the analytic-AA reasoning live in capsule.slang.
//
// Colors are pre-packed ABGR u32 on the CPU side
// (dotplotColors.ts#packColor). Blend uses premultiplied alpha
// (one / one-minus-src-alpha). The plot-wide opacity slider is the `alpha`
// UNIFORM, never baked into those bytes — same split as the synteny renderer's
// `fillShade`. Baking it meant an opacity drag recomputed the whole colors
// array, re-packed every instance and re-uploaded the buffer once per frame;
// as a uniform it is a single scalar write.
//! targets: wgsl, glsl
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
  // Plot-wide opacity (the view's slider), multiplied into every fragment.
  float  alpha;
  // getDpr() (capped at MAX_DPR). Needed because this shader measures in CSS px
  // but rasterizes on the device-px grid — see antialias.slang.
  float  devicePixelRatio;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // Offset from the segment's CENTER in screen px, in the segment's own frame
  // (x along, y across) — capsule.slang's `local`. Tracks `pos` exactly: it is
  // the same point in that frame, so the pad appears in both or the fragment
  // measures a distance the vertex did not place.
  float2 uv       : COLOR1;
  // x = halfLen (screen px), y = halfWidth (screen px). Constant per instance.
  nointerpolation float2 dims : COLOR2;
};

[shader("vertex")]
VsOut vs_main(DotplotInstance inst, uint vid : SV_VertexID) {
  float sx1 = inst.x1 * u.bpPerPxHInv + u.panPxH;
  float sy1 = u.resolution.y - (inst.y1 * u.bpPerPxVInv + u.panPxV);
  float sx2 = inst.x2 * u.bpPerPxHInv + u.panPxH;
  float sy2 = u.resolution.y - (inst.y2 * u.bpPerPxVInv + u.panPxV);

  float2 delta = float2(sx2 - sx1, sy2 - sy1);
  float len = length(delta);
  float halfWidth = u.lineWidth * 0.5;
  CapsuleFrame f = capsuleFrame(delta, len);
  float2 local = capsuleQuadLocal(vid, len * 0.5, halfWidth, u.devicePixelRatio);

  VsOut o;
  float2 center = float2(sx1 + sx2, sy1 + sy2) * 0.5;
  o.position = screenToClip(
    center + f.tangent * local.x + f.normal * local.y, u.resolution);
  o.color = unpackRGBA(inst.color);
  o.uv = local;
  o.dims = float2(len * 0.5, halfWidth);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float d = capsuleDist(fragIn.uv, fragIn.dims.x);
  float edgeAlpha = edgeCoverage(fragIn.dims.y - d, u.devicePixelRatio);
  // The packed color's own alpha, the plot-wide slider, and the SDF edge, in
  // that order. Premultiplied output, so the slider scales rgb with it.
  float finalAlpha = fragIn.color.a * u.alpha * edgeAlpha;
  // The quad pad widens every quad, so the fragments it added are the ones
  // that ramp to nothing. Dropping them keeps the extra area off the blender.
  if (finalAlpha <= 0.0) {
    discard;
  }
  return float4(fragIn.color.rgb * finalAlpha, finalAlpha);
}
