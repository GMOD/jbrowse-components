// Off-screen continuation marker: a fast-forward double-arrow (»/«) pinned at
// the screen edge when a feature glyph runs past the visible viewport, hinting
// "this feature keeps going". Uses its own instance buffer (uploaded by
// GpuCanvasFeatureRenderer alongside rects) that carries startEnd/y/height/color
// from the rect data plus a strand field so the arrows point in the feature's
// genomic direction — letting users read strand even when both feature ends are
// off-screen.
//
// The block's viewport is set to its on-screen (scissored) span, so clip x = ±1
// is the visible left/right edge: a rect whose start maps left of -1 (or end
// right of +1) is running off that screen edge. In a split / multi-region view
// ±1 can be an internal seam between two displayedRegions rather than the
// canvas edge, so the marker is additionally gated on u.left/rightIsCanvasEdge
// (set per block by the renderer) — a feature spilling past a sub-region
// boundary never draws a mid-screen marker.
//
// 12 vertices per instance = 4 hollow triangles (a 2-triangle "»" per edge, two
// edges). Each edge's pair is culled to OFFSCREEN unless the rect actually
// straddles that screen edge. Barycentric coordinates carry edge distance to the
// fragment shader so only the outline renders (filled interior is discarded).
// To suppress noise, the marker only draws once a meaningful amount of the
// feature is hidden: the off-screen overhang past the edge must exceed
// CONT_MIN_OVERHANG_PX. A small feature clipped by a couple px at the edge
// (common when zoomed out over a field of short repeats) stays unmarked; only
// features running well past the viewport — the zoomed-in case the marker is
// meant for — qualify.
//! targets: wgsl, glsl
//! export-consts: CONT_TRI_W_PX, CONT_TRI_HALF_H_PX, CONT_EDGE_MARGIN_PX, CONT_TRI_GAP_PX, CONT_MIN_OVERHANG_PX

import hpmath;
import colorPack;
import featureGlyphUniforms;


public static const uint VERTS_PER_INSTANCE = 12u;
static const float CONT_TRI_W_PX       = 5.0;
static const float CONT_TRI_HALF_H_PX  = 4.0;
static const float CONT_EDGE_MARGIN_PX = 1.0;
static const float CONT_TRI_GAP_PX     = 4.0;
static const float CONT_MIN_OVERHANG_PX = 20.0;

struct ContinuationInstance {
  uint2 startEnd : ATTR0;
  float y        : ATTR1;
  float height   : ATTR2;
  uint  color    : ATTR3;
  float strand   : ATTR4; // -1, 0, or +1; 0 falls back to outward arrows
};

[[vk::binding(1, 0)]] ConstantBuffer<FeatureGlyphUniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float3 bary     : TEXCOORD0;
};

// Off-clip vertex; the GPU culls any triangle that contains it.
static const float4 OFFSCREEN = float4(2.0, 2.0, 0.0, 1.0);

[shader("vertex")]
VsOut vs_main(ContinuationInstance inst, uint vid : SV_VertexID) {
  float sx1 = bpToClipX(inst.startEnd.x, u);
  float sx2 = bpToClipX(inst.startEnd.y, u);
  // Screen-space edges (handles reversed blocks, where bp→clip flips).
  float leftClip  = min(sx1, sx2);
  float rightClip = max(sx1, sx2);

  // Match the visual weight of strand arrows (text.secondary ~0.6 opacity):
  // choose dark/light based on fill luminance but render at reduced opacity so
  // the hollow outline blends rather than jarring.
  float4 base = unpackRGBA(inst.color);
  float lum = dot(base.rgb, float3(0.299, 0.587, 0.114));
  float3 mark = lum > 0.5 ? float3(0.0, 0.0, 0.0) : float3(1.0, 1.0, 1.0);
  float markAlpha = 0.55;

  uint chev = vid / 3u;   // 0,1 = right edge marker; 2,3 = left edge marker
  uint tv   = vid % 3u;   // vertex within the triangle

  bool isRight = chev < 2u;
  // Clip ±1 spans the block's visible region (abs(bpRangeX.z) bp wide); convert
  // the px overhang threshold into that clip space so the gate is zoom-aware.
  float blockWidthPx   = abs(u.bpRangeX.z) / u.bpPerPx;
  float minOverhangClip = CONT_MIN_OVERHANG_PX / blockWidthPx * 2.0;
  // The rect runs far enough off this screen edge (overhang > threshold) while
  // still reaching into view — and the edge is the real canvas edge, not an
  // internal seam between displayedRegions (a feature spilling past a sub-region
  // boundary mustn't draw a mid-screen marker).
  bool offRight =
    rightClip - 1.0 > minOverhangClip && leftClip < 1.0 && u.rightIsCanvasEdge > 0.5;
  bool offLeft =
    -1.0 - leftClip > minOverhangClip && rightClip > -1.0 && u.leftIsCanvasEdge > 0.5;
  bool visible = isRight ? offRight : offLeft;

  VsOut o;
  o.color = float4(mark, markAlpha);
  o.bary = float3(0.0, 0.0, 0.0);
  if (!visible) {
    o.position = OFFSCREEN;
    return o;
  }

  float marginClip = CONT_EDGE_MARGIN_PX / u.canvasWidth * 2.0;
  float triWClip   = CONT_TRI_W_PX / u.canvasWidth * 2.0;
  float gapClip    = CONT_TRI_GAP_PX / u.canvasWidth * 2.0;
  float halfHPx    = min(CONT_TRI_HALF_H_PX, inst.height * 0.4);
  float halfHClip  = halfHPx / u.canvasHeight * 2.0;

  float cy = snapPixelCenterY(inst.y + inst.height * 0.5, u.scrollY, u.canvasHeight);

  float edgeSide = isRight ? 1.0 : -1.0;
  float edgeX    = edgeSide;
  // 0 = outer triangle (nearest the edge), 1 = inner.
  float pairIndex = float(isRight ? chev : chev - 2u);
  // anchor: the back (flat edge) of the triangle, always margin+gap*pair px inside
  float anchorX = edgeX - edgeSide * (marginClip + gapClip * pairIndex);
  // For strand=0 fall back to outward so strand-less features still show markers.
  float effectiveStrand = inst.strand == 0.0 ? edgeSide : inst.strand;
  // 1 when strand points toward this edge, 0 when it points away
  float strandMatchesEdge = max(0.0, effectiveStrand * edgeSide);
  float apexX = anchorX - edgeSide * triWClip * (1.0 - strandMatchesEdge);
  float baseX = anchorX - edgeSide * triWClip * strandMatchesEdge;

  float sx;
  float sy;
  if (tv == 0u) {
    sx = apexX;
    sy = cy;
    o.bary = float3(1.0, 0.0, 0.0);
  } else if (tv == 1u) {
    sx = baseX;
    sy = cy + halfHClip;
    o.bary = float3(0.0, 1.0, 0.0);
  } else {
    sx = baseX;
    sy = cy - halfHClip;
    o.bary = float3(0.0, 0.0, 1.0);
  }

  o.position = float4(sx, sy, 0.0, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  // Hollow outline via barycentric edge distance.  fwidth converts the
  // barycentric gradient to pixel units so the line width is screen-stable.
  float minBary = min(fragIn.bary.x, min(fragIn.bary.y, fragIn.bary.z));
  float edgePx = minBary / fwidth(minBary);
  float edgeAlpha = 1.0 - smoothstep(0.5, 1.5, edgePx);
  return float4(fragIn.color.rgb, fragIn.color.a * edgeAlpha);
}
