// Strand arrow off a feature's end: a stem quad (6 vertices) then a head
// triangle (3), picked by vertex ID.
//! targets: wgsl, glsl
//! export-consts: ARROW_LENGTH_PX, STEM_HALF_H_PX, HEAD_HALF_H_PX, ARROW_MIN_FEATURE_WIDTH_PX, GENE_ARROW_MIN_FEATURE_WIDTH_PX
//! js-export: arrowDraws, arrowHeadHalfHeightPx

import hpmath;
import colorPack;
import featureGlyphUniforms;


public static const uint VERTS_PER_INSTANCE = 9u;
// Stem and head together; the stem takes the first half.
static const float ARROW_LENGTH_PX = 7.0;
static const float STEM_HALF_H_PX = 0.5;
static const float HEAD_HALF_H_PX = 2.5;

// The arrow paints outside the feature, so on a narrow one it is wider than the
// box and lands on the neighbor. Below twice its length the arrow is dropped,
// never shrunk, and a run of packed repeats reads as boxes, not arrowheads.
static const float ARROW_MIN_FEATURE_WIDTH_PX = 14.0;

// A gene's direction is its main fact and genes are sparse, so a gene keeps its
// arrow down to one arrow length. Any lower and a sub-pixel gene would reserve
// 9px of packing room instead of 2.
static const float GENE_ARROW_MIN_FEATURE_WIDTH_PX = 7.0;

// Whether a feature this wide gets its arrow. This shader, the Canvas2D mark,
// layout and hit testing (both through `strandArrowReachPx`) must agree, though
// each measures `featureWidthPx` its own way. A disagreement either reserves
// room nothing paints or paints an arrow with no room.
public bool arrowDraws(float featureWidthPx, bool gene) {
  float minWidthPx = gene ? GENE_ARROW_MIN_FEATURE_WIDTH_PX : ARROW_MIN_FEATURE_WIDTH_PX;
  return featureWidthPx >= minWidthPx;
}

// Arrowhead half-height, capped at half the box's drawn height so the head
// never overhangs a short box.
public float arrowHeadHalfHeightPx(float boxHeightPx) {
  return min(HEAD_HALF_H_PX, snapBoxHeightPx(boxHeightPx) * 0.5);
}

struct ArrowInstance {
  uint  x         : ATTR0;
  float y         : ATTR1;
  float direction : ATTR2;
  uint  color     : ATTR3;
  float height    : ATTR4;
  // Feature length in bp: `arrowDraws` gates on px, and bpPerPx is only known
  // at draw time.
  uint  widthBp   : ATTR5;
  uint  gene      : ATTR6;
};

[[vk::binding(1, 0)]] ConstantBuffer<FeatureGlyphUniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

// Off-clip vertex; the GPU culls any triangle that contains it.
static const float4 OFFSCREEN = float4(2.0, 2.0, 0.0, 1.0);

[shader("vertex")]
VsOut vs_main(ArrowInstance inst, uint vid : SV_VertexID) {
  if (!arrowDraws(float(inst.widthBp) / u.bpPerPx, inst.gene != 0u)) {
    VsOut culled;
    culled.position = OFFSCREEN;
    culled.color = float4(0.0);
    return culled;
  }

  float cx = bpToClipX(inst.x, u);

  float cy = snapBoxCenterY(inst.y, u.scrollY, u.canvasHeight);

  float arrowLength = pxToClipW(ARROW_LENGTH_PX, u);
  float stemHalf = pxToClipH(STEM_HALF_H_PX, u);
  float headHalf = pxToClipH(arrowHeadHalfHeightPx(inst.height), u);

  float dir = flipX(inst.direction, u);

  float sx;
  float sy;
  if (vid < 6u) {
    float2 q = quadLocal(vid);
    float localX = q.x;
    float localY = 1.0 - 2.0 * q.y;
    sx = cx + localX * arrowLength * 0.5 * dir;
    sy = cy + localY * stemHalf;
  } else {
    uint hvid = vid - 6u;
    if (hvid == 0u) {
      sx = cx + arrowLength * 0.5 * dir;
      sy = cy + headHalf;
    } else if (hvid == 1u) {
      sx = cx + arrowLength * 0.5 * dir;
      sy = cy - headHalf;
    } else {
      sx = cx + arrowLength * dir;
      sy = cy;
    }
  }

  VsOut o;
  o.position = float4(sx, sy, 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}
