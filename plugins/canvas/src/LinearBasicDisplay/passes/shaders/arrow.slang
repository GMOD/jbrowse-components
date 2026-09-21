// Strand-direction arrow glyph placed at feature boundaries.
// 9 vertices per arrow: 6 stem vertices (two triangles) + 3 arrowhead
// triangle vertices dispatched via vertex ID.
//! targets: wgsl, glsl
//! export-consts: STEM_LENGTH_PX, STEM_HALF_H_PX, HEAD_HALF_H_PX, ARROW_MIN_FEATURE_WIDTH_PX
//! js-export: arrowDraws, arrowHeadHalfHeightPx

import hpmath;
import colorPack;
import featureGlyphUniforms;


public static const uint VERTS_PER_INSTANCE = 9u;
static const float STEM_LENGTH_PX = 7.0;
static const float STEM_HALF_H_PX = 0.5;
static const float HEAD_HALF_H_PX = 2.5;

// The arrow is drawn OUTSIDE the box it annotates (from the feature boundary
// outward), so on a narrow feature it is both wider than the box and sitting on
// the neighbor. Below this width the direction marker would occupy more space
// than the thing whose direction it marks, so it is dropped entirely — a run of
// repeats packed a few px apart reads as boxes, not as a mess of overlapping
// arrowheads. Set to 2x the arrow's own footprint (STEM_LENGTH_PX). Same
// principle as chevron.slang's short-line gate and the label decimation ladder:
// an annotation that doesn't fit is dropped, never shrunk.
static const float ARROW_MIN_FEATURE_WIDTH_PX = 14.0;

// Whether a feature this wide gets its direction marker, from the gate above.
//
// A one-comparison function, and it earns being one because it has THREE
// callers in two processes and they measure `featureWidthPx` differently on
// purpose: this shader from `widthBp / bpPerPx`, `drawArrows` through the
// block's own bp→px mapper, and — main-thread, before either renderer exists —
// `strandArrowPadding` in layout.ts, which reserves the arrow's 8px of packing
// room only where one will paint. That third caller is why the boundary is
// load-bearing rather than cosmetic: reserved-but-unpainted room is what packed
// 5000 sub-pixel stranded marks 46 rows deep instead of 2, and it is
// `>=` vs `>` at exactly 14px that decides it.
public bool arrowDraws(float featureWidthPx) {
  return featureWidthPx >= ARROW_MIN_FEATURE_WIDTH_PX;
}

// Half-height of the arrowhead, never more than half the box it comes off.
// HEAD_HALF_H_PX alone is a fixed 5px head, so on the 3px body superCompact
// draws at it overhung the feature a pixel top and bottom and read as a marker
// for something taller than the thing it marks. Measured against the box's DRAWN
// height (snapBoxHeightPx), which is what paints. A no-op at every drawn height
// from 5px up, so normal and compact are untouched. Same rule, same reason, as
// continuation.slang's markerHalfHeight.
public float arrowHeadHalfHeightPx(float boxHeightPx) {
  return min(HEAD_HALF_H_PX, snapBoxHeightPx(boxHeightPx) * 0.5);
}

struct ArrowInstance {
  uint  x         : ATTR0;
  float y         : ATTR1;
  float direction : ATTR2;
  uint  color     : ATTR3;
  // Box height this arrow sits on, so it snaps onto the box's drawn center row.
  float height    : ATTR4;
  // Length of the feature this arrow marks, in bp — the width gate below is a
  // pixel decision, and bpPerPx is only known at draw time. A length, not a
  // coordinate, so it needs no hp splitting.
  uint  widthBp   : ATTR5;
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
  if (!arrowDraws(float(inst.widthBp) / u.bpPerPx)) {
    VsOut culled;
    culled.position = OFFSCREEN;
    culled.color = float4(0.0);
    return culled;
  }

  float cx = bpToClipX(inst.x, u);

  float cy = snapBoxCenterY(inst.y, inst.height, u.scrollY, u.canvasHeight);

  float stemLength = pxToClipW(STEM_LENGTH_PX, u);
  float stemHalf = pxToClipH(STEM_HALF_H_PX, u);
  float headHalf = pxToClipH(arrowHeadHalfHeightPx(inst.height), u);

  float dir = flipX(inst.direction, u);

  float sx;
  float sy;
  if (vid < 6u) {
    float2 q = quadLocal(vid);
    float localX = q.x;
    float localY = 1.0 - 2.0 * q.y;
    sx = cx + localX * stemLength * 0.5 * dir;
    sy = cy + localY * stemHalf;
  } else {
    uint hvid = vid - 6u;
    if (hvid == 0u) {
      sx = cx + stemLength * 0.5 * dir;
      sy = cy + headHalf;
    } else if (hvid == 1u) {
      sx = cx + stemLength * 0.5 * dir;
      sy = cy - headHalf;
    } else {
      sx = cx + stemLength * dir;
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
