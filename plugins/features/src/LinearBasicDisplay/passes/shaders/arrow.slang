// Strand arrow off a feature's end: a stem then a head, both measured in one
// quad over the whole arrow, so their seam blends once.
//! targets: wgsl, glsl
//! coverage: analytic
//! export-consts: ARROW_LENGTH_PX, STEM_HALF_H_PX, HEAD_HALF_H_PX, ARROW_MIN_FEATURE_WIDTH_PX, GENE_ARROW_MIN_FEATURE_WIDTH_PX
//! js-export: arrowDraws, arrowHeadHalfHeightPx, arrowReachPx, arrowCoverage

import antialias;
import hpmath;
import colorPack;
import featureGlyphUniforms;


public static const uint VERTS_PER_INSTANCE = 6u;
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

// How far the arrow's ink reaches, ramp included: (along to the tip, across
// either side of the axis). The head's ramp reaches past its tip and base
// corners by more than a centred edge's pad, the further the sharper the
// corner.
public float2 arrowReachPx(float headHalfPx, float dpr) {
  float pad = aaHalfPx(dpr);
  float stemEnd = ARROW_LENGTH_PX * 0.5;
  float slantPx = sqrt(headHalfPx * headHalfPx + stemEnd * stemEnd);
  return float2(
    headHalfPx > 0.0 ? ARROW_LENGTH_PX + pad * slantPx / max(headHalfPx, pad)
                     : stemEnd + 0.5 + pad,
    max(STEM_HALF_H_PX + pad,
        headHalfPx + pad * (headHalfPx + slantPx) / stemEnd));
}

// Coverage at `alongPx` from the arrow's root and `acrossPx` off its axis. The
// stem runs half a px into the head, which holds it there, so the union of the
// two has no seam where the head's base ramps up. A box too short to snap to a
// pixel has no head, as the Canvas2D triangle it fills has no area.
public float arrowCoverage(float alongPx, float acrossPx, float headHalfPx, float dpr) {
  float across = abs(acrossPx);
  float stemEnd = ARROW_LENGTH_PX * 0.5;
  float stem = strokeCoverage(STEM_HALF_H_PX, across, dpr)
             * edgeCoverage(alongPx, dpr)
             * edgeCoverage(stemEnd + 0.5 - alongPx, dpr);
  float slant = (headHalfPx * (ARROW_LENGTH_PX - alongPx) - stemEnd * across)
              / sqrt(headHalfPx * headHalfPx + stemEnd * stemEnd);
  float head = headHalfPx > 0.0
    ? edgeCoverage(alongPx - stemEnd, dpr) * edgeCoverage(slant, dpr)
    : 0.0;
  return max(stem, head);
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
  // CSS px from the arrow's root along its direction, and across its axis
  float2 local    : TEXCOORD0;
  nointerpolation float headHalfPx : TEXCOORD1;
};

// Off-clip vertex; the GPU culls any triangle that contains it.
static const float4 OFFSCREEN = float4(2.0, 2.0, 0.0, 1.0);

[shader("vertex")]
VsOut vs_main(ArrowInstance inst, uint vid : SV_VertexID) {
  VsOut o;
  o.color = unpackRGBA(inst.color);
  o.local = float2(0.0);
  o.headHalfPx = 0.0;
  if (!arrowDraws(float(inst.widthBp) / u.bpPerPx, inst.gene != 0u)) {
    o.position = OFFSCREEN;
    return o;
  }

  float cw = u.canvasWidth;
  float cx = clipXToPx(bpToClipX(inst.x, u), cw);
  float cy = snapBoxCenterYPx(inst.y, u.scrollY);
  float dir = flipX(inst.direction, u);
  float headHalf = arrowHeadHalfHeightPx(inst.height);
  float2 reach = arrowReachPx(headHalf, u.devicePixelRatio);

  float2 q = quadLocal(vid);
  float along = lerp(-aaHalfPx(u.devicePixelRatio), reach.x, q.x);
  float across = lerp(-reach.y, reach.y, q.y);

  o.position = float4(
    pxToClipX(cx + along * dir, cw), yPxToClipY(cy + across, u.canvasHeight),
    0.0, 1.0);
  o.local = float2(along, across);
  o.headHalfPx = headHalf;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut v) : SV_Target {
  float a = v.color.a
          * arrowCoverage(v.local.x, v.local.y, v.headHalfPx, u.devicePixelRatio);
  if (a <= 0.0) discard;
  return float4(v.color.rgb, a);
}
