// Off-screen continuation marker: a fast-forward double-arrow (»/«) pinned at
// the screen edge when a feature glyph runs past the visible viewport, hinting
// "this feature keeps going". Draws from the RECT instance buffer — the
// renderer issues drawPass(continuation, region, bufferPassId=rect), the way
// chevron reads line's — so it sees each rect's startEnd/y/height/color plus
// the `strand` field rect carries for it, letting users read strand even when
// both feature ends are off-screen. The strand is genomic, so it goes through
// `flipX` like the strand arrows' and chevrons' directions do: on a reversed
// block a + feature runs right-to-left on screen and its markers must point
// left with it.
//
// The block's viewport is set to its on-screen (scissored) span, so clip x = ±1
// is the visible left/right edge: a rect whose start maps left of -1 (or end
// right of +1) is running off that screen edge. In a split / multi-region view
// ±1 can be an internal seam between two displayedRegions rather than the
// canvas edge, so the marker is additionally gated on u.left/rightIsCanvasEdge
// (set per block by the renderer) — a feature spilling past a sub-region
// boundary never draws a mid-screen marker.
//
// 12 vertices per instance = 4 chevrons (a 2-chevron "»" per edge, two edges),
// each drawn as one triangle whose back edge is suppressed in the fragment shader
// to leave an open ">". Each edge's pair is culled to OFFSCREEN unless the rect
// actually straddles that screen edge. Barycentric coordinates carry edge
// distance to the fragment shader so only the two apex-facing arms render.
// To suppress noise, the marker only draws once a meaningful amount of the
// feature is hidden: the off-screen overhang past the edge must exceed
// CONT_MIN_OVERHANG_PX. A small feature clipped by a couple px at the edge
// (common when zoomed out over a field of short repeats) stays unmarked; only
// features running well past the viewport — the zoomed-in case the marker is
// meant for — qualify.
//! targets: wgsl, glsl
//! js-export: markerDirection, strandMatchesEdge, markerIsDark, markerHalfHeight, runsOffEdge
//! export-consts: CONT_TRI_W_PX, CONT_TRI_HALF_H_PX, CONT_EDGE_MARGIN_PX, CONT_TRI_GAP_PX, CONT_MIN_OVERHANG_PX, CONT_MARK_ALPHA

import hpmath;
import colorPack;
import featureGlyphUniforms;
import rectInstance;


public static const uint VERTS_PER_INSTANCE = 12u;
static const float CONT_TRI_W_PX       = 5.0;
static const float CONT_TRI_HALF_H_PX  = 4.0;
static const float CONT_EDGE_MARGIN_PX = 1.0;
static const float CONT_TRI_GAP_PX     = 4.0;
static const float CONT_MIN_OVERHANG_PX = 20.0;
// Reduced opacity so the hollow outline blends with the strand arrows' visual
// weight (text.secondary ~0.6) rather than jarring against the fill it sits on.
static const float CONT_MARK_ALPHA = 0.55;

// RectInstance (rectInstance.slang) is the shared layout — this pass reads
// rect's buffer, so it must declare the same attributes rect does. `densityFade`
// is rect's and goes unread here.

[[vk::binding(1, 0)]] ConstantBuffer<FeatureGlyphUniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float3 bary     : TEXCOORD0;
};

// Off-clip vertex; the GPU culls any triangle that contains it.
static const float4 OFFSCREEN = float4(2.0, 2.0, 0.0, 1.0);

// Which way a continuation marker points, and whether that is out of this edge.
//
// `edgeSide` is +1 for the right edge, -1 for the left; `screenStrand` is the
// rect's strand already flipped for a reversed block. A strand-less feature has
// no direction of its own, so it points out of whichever edge it ran past — the
// marker still reads as "keeps going that way".
//
// `//! js-export`ed because the Canvas2D twin expresses every direction as
// `edgeSide × …` for the same reason this does — to have one piece of sign
// arithmetic rather than a left and a right copy — and two such expressions,
// one per backend, is the thing that had to be kept in agreement by eye.
public float markerDirection(float screenStrand, float edgeSide) {
  return screenStrand == 0.0 ? edgeSide : screenStrand;
}

// 1 when the marker points OUT of this edge (apex sits on the anchor), 0 when
// it points back inward (apex shifted a triangle-width in, so the whole glyph
// stays inside the scissor).
public float strandMatchesEdge(float screenStrand, float edgeSide) {
  return max(0.0, markerDirection(screenStrand, edgeSide) * edgeSide);
}

// Whether the marker draws dark-on-light rather than light-on-dark, from the
// fill it sits on. Channels are 0..1; the ITU-R BT.601 luma weights and the
// midpoint are the decision, and the unpack that produces the channels is the
// conversion each backend keeps doing its own way (`unpackRGBA` here,
// `abgrRed`/`abgrGreen`/`abgrBlue` there) — the split adr-051 prescribes for a
// candidate whose signature would otherwise want a vector.
//
// Stated in 0..255 on the Canvas2D side, against a `> 127.5` midpoint, until
// this was lifted. Mathematically the same line, which is exactly what makes a
// drift between them undetectable by eye: neither copy looks like the other.
public bool markerIsDark(float r, float g, float b) {
  return r * 0.299 + g * 0.587 + b * 0.114 > 0.5;
}

// Half-height of one marker chevron, shrunk to fit a short box rather than
// overhanging it. The 0.4 was a bare literal in both backends.
public float markerHalfHeight(float boxHeight) {
  return min(CONT_TRI_HALF_H_PX, boxHeight * 0.4);
}

// Does this rect run far enough past `edgeCoord` to earn a marker there, while
// still reaching into view?
//
// `outer` is the rect edge on the far side of `edgeCoord` and `inner` the near
// one — the right edge and the left edge respectively at the right screen edge,
// swapped at the left — and `edgeSide` is +1 for the right edge, -1 for the
// left, so both edges are one piece of arithmetic. Unit-agnostic like
// `chevronOffset`: clip here (where `edgeCoord` is ±1 and the overhang converts
// through `pxToClipW`), screen px on the Canvas2D side.
//
// Not gated on `leftIsCanvasEdge`/`rightIsCanvasEdge` here: that is a per-block
// fact each backend already holds — a uniform on the GPU, `canvasEdgeFlags` on
// the CPU — and folding it in would make the shared decision take an argument
// only one side has a natural name for. What must not drift is the overhang
// test, which is three comparisons that were spelled twice.
public bool runsOffEdge(
  float outer,
  float inner,
  float edgeCoord,
  float edgeSide,
  float minOverhang
) {
  return (outer - edgeCoord) * edgeSide > minOverhang
      && (inner - edgeCoord) * edgeSide < 0.0;
}

[shader("vertex")]
VsOut vs_main(RectInstance inst, uint vid : SV_VertexID) {
  float sx1 = bpToClipX(inst.startEnd.x, u);
  float sx2 = bpToClipX(inst.startEnd.y, u);
  // Screen-space edges (handles reversed blocks, where bp→clip flips).
  float leftClip  = min(sx1, sx2);
  float rightClip = max(sx1, sx2);

  // Dark or light by the fill's luminance, at CONT_MARK_ALPHA so the hollow
  // outline blends. The pick is `markerIsDark`, shared with Canvas2D; the
  // unpack around it is this backend's.
  float4 base = unpackRGBA(inst.color);
  float3 mark = markerIsDark(base.r, base.g, base.b)
    ? float3(0.0, 0.0, 0.0)
    : float3(1.0, 1.0, 1.0);
  float markAlpha = CONT_MARK_ALPHA;

  uint chev = vid / 3u;   // 0,1 = right edge marker; 2,3 = left edge marker
  uint tv   = vid % 3u;   // vertex within the triangle

  bool isRight = chev < 2u;
  // Clip ±1 spans the block's visible region, whose width in px is u.canvasWidth
  // (see featureGlyphUniforms.slang) — so the px overhang threshold converts to
  // clip like any other px length, and the gate is zoom-aware for free.
  float minOverhangClip = pxToClipW(CONT_MIN_OVERHANG_PX, u);
  // The rect runs far enough off this screen edge (overhang > threshold) while
  // still reaching into view — and the edge is the real canvas edge, not an
  // internal seam between displayedRegions (a feature spilling past a sub-region
  // boundary mustn't draw a mid-screen marker).
  bool offRight = runsOffEdge(rightClip, leftClip, 1.0, 1.0, minOverhangClip)
    && u.rightIsCanvasEdge > 0.5;
  bool offLeft = runsOffEdge(leftClip, rightClip, -1.0, -1.0, minOverhangClip)
    && u.leftIsCanvasEdge > 0.5;
  bool visible = isRight ? offRight : offLeft;

  VsOut o;
  o.color = float4(mark, markAlpha);
  o.bary = float3(0.0, 0.0, 0.0);
  if (!visible) {
    o.position = OFFSCREEN;
    return o;
  }

  float marginClip = pxToClipW(CONT_EDGE_MARGIN_PX, u);
  float triWClip   = pxToClipW(CONT_TRI_W_PX, u);
  float gapClip    = pxToClipW(CONT_TRI_GAP_PX, u);
  float halfHClip  = pxToClipH(markerHalfHeight(inst.height), u);

  float cy = snapBoxCenterY(inst.y + inst.height * 0.5, inst.height, u.scrollY, u.canvasHeight);

  float edgeSide = isRight ? 1.0 : -1.0;
  float edgeX    = edgeSide;
  // 0 = outer triangle (nearest the edge), 1 = inner.
  float pairIndex = float(isRight ? chev : chev - 2u);
  // anchor: the back (flat edge) of the triangle, always margin+gap*pair px inside
  float anchorX = edgeX - edgeSide * (marginClip + gapClip * pairIndex);
  // Genomic strand → screen direction, so a reversed block's markers point the
  // way its glyphs run.
  float screenStrand = flipX(inst.strand, u);
  float matches = strandMatchesEdge(screenStrand, edgeSide);
  float apexX = anchorX - edgeSide * triWClip * (1.0 - matches);
  float baseX = anchorX - edgeSide * triWClip * matches;

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
  // Open chevron (">") via barycentric edge distance: draw only the two arm
  // edges (bary.y≈0 and bary.z≈0, the edges touching the apex vertex 0) and skip
  // the back/base edge (bary.x≈0), so it reads as ">" not a filled triangle.
  // fwidth converts the barycentric gradient to pixel units so the line width is
  // screen-stable.
  float minBary = min(fragIn.bary.y, fragIn.bary.z);
  float edgePx = minBary / fwidth(minBary);
  float edgeAlpha = 1.0 - smoothstep(0.5, 1.5, edgePx);
  return float4(fragIn.color.rgb, fragIn.color.a * edgeAlpha);
}
