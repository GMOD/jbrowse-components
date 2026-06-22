// Off-screen continuation marker: a fast-forward double-arrow (»/«) pinned at
// the screen edge when a feature glyph runs past the visible viewport, hinting
// "this feature keeps going". Reuses the rect instance buffer
// (drawPass(continuation, region, bufferPassId=rect)) so it carries no data of
// its own — comparing each rect's absolute bp span against the viewport
// (u.bpRangeX) is all the vertex shader needs, recomputed on the GPU every
// pan/zoom with no worker round-trip.
//
// The block's viewport is set to its on-screen (scissored) span, so clip x = ±1
// is the visible left/right edge: a rect whose start maps left of -1 (or end
// right of +1) is running off that screen edge. In a split / multi-region view
// ±1 can be an internal seam between two displayedRegions rather than the
// canvas edge, so the marker is additionally gated on u.left/rightIsCanvasEdge
// (set per block by the renderer) — a feature spilling past a sub-region
// boundary never draws a mid-screen marker.
//
// 12 vertices per instance = 4 solid triangles (a 2-triangle "»" per edge, two
// edges). Each edge's pair is culled to OFFSCREEN unless the rect actually
// straddles that screen edge.
//! targets: wgsl, glsl
//! export-consts: CONT_TRI_W_PX, CONT_TRI_HALF_H_PX, CONT_EDGE_MARGIN_PX, CONT_TRI_GAP_PX

import hpmath;
import colorPack;
import featureGlyphUniforms;


public static const uint VERTS_PER_INSTANCE = 12u;
static const float CONT_TRI_W_PX       = 5.0;
static const float CONT_TRI_HALF_H_PX  = 4.0;
static const float CONT_EDGE_MARGIN_PX = 3.0;
static const float CONT_TRI_GAP_PX     = 4.0;

// Identical attribute layout to rect.slang's RectInstance so this pass can read
// rect's instance buffer directly.
struct ContinuationInstance {
  uint2 startEnd : ATTR0;
  float y        : ATTR1;
  float height   : ATTR2;
  uint  color    : ATTR3;
};

[[vk::binding(1, 0)]] ConstantBuffer<FeatureGlyphUniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
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

  // Contrast color from luminance so the marker stays legible atop the fill.
  float4 base = unpackRGBA(inst.color);
  float lum = dot(base.rgb, float3(0.299, 0.587, 0.114));
  float3 mark = lum > 0.5 ? float3(0.0, 0.0, 0.0) : float3(1.0, 1.0, 1.0);

  uint chev = vid / 3u;   // 0,1 = right edge marker; 2,3 = left edge marker
  uint tv   = vid % 3u;   // vertex within the triangle

  bool isRight = chev < 2u;
  // The rect runs off this screen edge while still reaching into view — and the
  // edge is the real canvas edge, not an internal seam between displayedRegions
  // (a feature spilling past a sub-region boundary mustn't draw a mid-screen
  // marker).
  bool offRight =
    rightClip > 1.0 && leftClip < 1.0 && u.rightIsCanvasEdge > 0.5;
  bool offLeft =
    leftClip < -1.0 && rightClip > -1.0 && u.leftIsCanvasEdge > 0.5;
  bool visible = isRight ? offRight : offLeft;

  VsOut o;
  o.color = float4(mark, base.a);
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

  float dir = isRight ? 1.0 : -1.0;
  float edgeX = isRight ? 1.0 : -1.0;
  // 0 = outer triangle (nearest the edge), 1 = inner.
  float pairIndex = float(isRight ? chev : chev - 2u);
  float apexX = edgeX - dir * (marginClip + gapClip * pairIndex);
  float baseX = apexX - dir * triWClip;

  float sx;
  float sy;
  if (tv == 0u) {
    sx = apexX;
    sy = cy;
  } else if (tv == 1u) {
    sx = baseX;
    sy = cy + halfHClip;
  } else {
    sx = baseX;
    sy = cy - halfHClip;
  }

  o.position = float4(sx, sy, 0.0, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}
