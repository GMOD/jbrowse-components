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
// Canvas2D's lineCap:'round' behavior. The quad is extended by
// lineWidth/2 + the AA half-width along both the tangent and the normal, and a capsule SDF
// in the fragment shader produces circular caps so short alignments render as
// dots that grow isotropically with lineWidth.
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

  // Extend the quad past the capsule so the rounded caps have geometry to shade
  // AND the AA ramp has somewhere to land. The fragment ramps out to
  // halfWidth + aaHalfPx, so a quad that stopped at halfWidth cropped the ramp's
  // outer half: coverage fell to 0.5 at the geometry boundary and was then cut
  // to 0 by the rasterizer. That is a hard 50%-alpha edge — an aliased one, on
  // the diagonals that are most of a dotplot — around a line that also came out
  // ~1px narrower than lineWidth asked for.
  float ext = halfWidth + aaHalfPx(u.devicePixelRatio);
  float capDir = t * 2.0 - 1.0;
  float2 center = lerp(float2(sx1, sy1), float2(sx2, sy2), t);
  float2 pos = center + tangent * capDir * ext + normal * side * ext;

  VsOut o;
  o.position = screenToClip(pos, u.resolution);
  o.color = unpackRGBA(inst.color);
  // uv tracks `pos` exactly — it is the same point in the segment's own frame,
  // so the extension has to appear in both or the fragment measures a distance
  // the vertex did not place.
  o.uv = float2(t * len + capDir * ext, side * ext);
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
  float d = length(float2(fragIn.uv.x - cx, fragIn.uv.y));
  // One output pixel of ramp, centred on the capsule's edge. Analytic rather
  // than measured: `d` is a TRUE Euclidean distance in CSS px, so |grad d| = 1
  // at every angle and there is nothing to differentiate — and `d` comes off a
  // clamp, so at the 2x2 quads straddling the cap/body junction a derivative
  // would be of a discontinuous quantity. The vertex stage pads the quad by the
  // same half-width, so the ramp reaches zero inside the geometry rather than
  // being cut off half way down.
  float edgeAlpha = aaRamp(halfWidth - d, 2.0 * aaHalfPx(u.devicePixelRatio));
  // The packed color's own alpha, the plot-wide slider, and the SDF edge, in
  // that order. Premultiplied output, so the slider scales rgb with it.
  float finalAlpha = fragIn.color.a * u.alpha * edgeAlpha;
  // The pad above widens every quad, so the fragments it added are the ones
  // that ramp to nothing. Dropping them keeps the extra area off the blender.
  if (finalAlpha <= 0.0) {
    discard;
  }
  return float4(fragIn.color.rgb * finalAlpha, finalAlpha);
}
