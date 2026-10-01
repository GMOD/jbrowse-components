// "Feature keeps going" marker: a »/« pair pinned at a screen edge the feature
// runs past, pointing along its strand. Draws from rect's vertex buffer
// (rectInstance.slang).
//
// Clip x = ±1 is the block's scissored edge, which in a multi-region view can be
// a seam between displayedRegions, so left/rightIsCanvasEdge gates the marker.
// The marker also waits for the overhang to exceed CONT_MIN_OVERHANG_PX, so a
// short feature clipped by a few px stays unmarked.
//
// 12 vertices: two edges, two chevrons each, one triangle per chevron. The
// fragment stage drops each triangle's back edge to leave an open ">", and an
// edge's pair goes OFFSCREEN unless the rect runs off that edge.
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
// Near the strand arrows' visual weight, so the outline doesn't jar against the
// fill it sits on.
static const float CONT_MARK_ALPHA = 0.55;

[[vk::binding(1, 0)]] ConstantBuffer<FeatureGlyphUniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float3 bary     : TEXCOORD0;
};

// Off-clip vertex; the GPU culls any triangle that contains it.
static const float4 OFFSCREEN = float4(2.0, 2.0, 0.0, 1.0);

// Which way a marker points. `edgeSide` is +1 at the right edge and -1 at the
// left; `screenStrand` is the strand already flipped for a reversed block. A
// strandless feature points out of the edge it ran past.
public float markerDirection(float screenStrand, float edgeSide) {
  return screenStrand == 0.0 ? edgeSide : screenStrand;
}

// 1 when the marker points out of this edge, putting its apex on the anchor; 0
// when it points inward, shifting the apex a triangle-width in so the glyph
// stays inside the scissor.
public float strandMatchesEdge(float screenStrand, float edgeSide) {
  return max(0.0, markerDirection(screenStrand, edgeSide) * edgeSide);
}

// Whether the marker draws dark rather than light, by the BT.601 luma of the
// fill. Channels are 0..1, and each backend unpacks them its own way (adr-051).
public bool markerIsDark(float r, float g, float b) {
  return r * 0.299 + g * 0.587 + b * 0.114 > 0.5;
}

// Half-height of one marker chevron, shrunk to fit a short box rather than
// overhanging it.
public float markerHalfHeight(float boxHeight) {
  return min(CONT_TRI_HALF_H_PX, boxHeight * 0.4);
}

// Whether the rect runs more than `minOverhang` past `edgeCoord` while still
// reaching into view. `outer` is the rect edge beyond `edgeCoord`, `inner` the
// near one, and `edgeSide` is +1 at the right edge, -1 at the left. Clip units
// here, px on Canvas2D; each backend applies its own canvas-edge gate.
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
  // Screen-space edges; bp→clip flips on a reversed block.
  float leftClip  = min(sx1, sx2);
  float rightClip = max(sx1, sx2);

  float4 base = unpackRGBA(inst.color);
  float3 mark = markerIsDark(base.r, base.g, base.b)
    ? float3(0.0, 0.0, 0.0)
    : float3(1.0, 1.0, 1.0);
  float markAlpha = CONT_MARK_ALPHA;

  uint chev = vid / 3u;   // 0,1 = right edge marker; 2,3 = left edge marker
  uint tv   = vid % 3u;   // vertex within the triangle

  bool isRight = chev < 2u;
  float minOverhangClip = pxToClipW(CONT_MIN_OVERHANG_PX, u);
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

  float cy = snapBoxCenterY(inst.y + inst.height * 0.5, u.scrollY, u.canvasHeight);

  float edgeSide = isRight ? 1.0 : -1.0;
  float edgeX    = edgeSide;
  // 0 = outer triangle (nearest the edge), 1 = inner.
  float pairIndex = float(isRight ? chev : chev - 2u);
  // The triangle's outermost x, margin + gap*pair px in from the edge.
  float anchorX = edgeX - edgeSide * (marginClip + gapClip * pairIndex);
  // The strand is genomic, so a reversed block's markers flip with its glyphs.
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
  // Draws the two arms meeting at the apex (bary.y≈0, bary.z≈0) and skips the
  // back edge (bary.x≈0). `fwidth` rather than `aaGradient`, unlike the other
  // passes: minBary is a barycentric wireframe estimate, not a distance field,
  // and `aaGradient` would thin the line by up to sqrt(2) on the diagonals, a
  // visible change the Canvas2D marker would have to match.
  float minBary = min(fragIn.bary.y, fragIn.bary.z);
  float edgePx = minBary / fwidth(minBary);
  float edgeAlpha = 1.0 - smoothstep(0.5, 1.5, edgePx);
  return float4(fragIn.color.rgb, fragIn.color.a * edgeAlpha);
}
