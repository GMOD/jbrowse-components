// Strand-direction arrow glyph placed at feature boundaries.
// 9 vertices per arrow: 6 stem vertices (two triangles) + 3 arrowhead
// triangle vertices dispatched via vertex ID.
//! targets: wgsl, glsl
//! export-consts: STEM_LENGTH_PX, STEM_HALF_H_PX, HEAD_HALF_H_PX

import hpmath;
import colorPack;
import canvasUniforms;


public static const uint VERTS_PER_INSTANCE = 9u;
static const float STEM_LENGTH_PX = 7.0;
static const float STEM_HALF_H_PX = 0.5;
static const float HEAD_HALF_H_PX = 2.5;

struct ArrowInstance {
  uint  x         : ATTR0;
  float y         : ATTR1;
  float direction : ATTR2;
  uint  color     : ATTR3;
};

[[vk::binding(1, 0)]] ConstantBuffer<CanvasUniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(ArrowInstance inst, uint vid : SV_VertexID) {
  uint v = vid % 9u;

  float cx = hpToClipX(hpSplitUint(inst.x), u.bpRangeX, u.zero);

  float yPx = floor(inst.y - u.scrollY + 0.5) + 0.5;
  float cy = 1.0 - (yPx / u.canvasHeight) * 2.0;

  float stemLength = STEM_LENGTH_PX / u.canvasWidth * 2.0;
  float stemHalf = STEM_HALF_H_PX / u.canvasHeight * 2.0;
  float headHalf = HEAD_HALF_H_PX / u.canvasHeight * 2.0;

  float dir = lerp(inst.direction, -inst.direction, u.reversed);

  float sx;
  float sy;
  if (v < 6u) {
    float localX = (v == 0u || v == 2u || v == 3u) ? 0.0 : 1.0;
    float localY = (v == 0u || v == 1u || v == 4u) ? 1.0 : -1.0;
    sx = cx + localX * stemLength * 0.5 * dir;
    sy = cy + localY * stemHalf;
  } else {
    uint hvid = v - 6u;
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
