// Strand-direction arrow glyph placed at feature boundaries.
// 9 vertices per arrow: 6 stem vertices (two triangles) + 3 arrowhead
// triangle vertices dispatched via vertex ID.
//! targets: wgsl, glsl
//! export-consts: STEM_LENGTH_PX, STEM_HALF_H_PX, HEAD_HALF_H_PX

import hpmath;
import colorPack;
import featureGlyphUniforms;


public static const uint VERTS_PER_INSTANCE = 9u;
static const float STEM_LENGTH_PX = 7.0;
static const float STEM_HALF_H_PX = 0.5;
static const float HEAD_HALF_H_PX = 2.5;

struct ArrowInstance {
  uint  x         : ATTR0;
  float y         : ATTR1;
  float direction : ATTR2;
  uint  color     : ATTR3;
  // Box height this arrow sits on, so it snaps onto the box's drawn center row.
  float height    : ATTR4;
};

[[vk::binding(1, 0)]] ConstantBuffer<FeatureGlyphUniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(ArrowInstance inst, uint vid : SV_VertexID) {
  float cx = bpToClipX(inst.x, u);

  float cy = snapBoxCenterY(inst.y, inst.height, u.scrollY, u.canvasHeight);

  float stemLength = STEM_LENGTH_PX / u.canvasWidth * 2.0;
  float stemHalf = STEM_HALF_H_PX / u.canvasHeight * 2.0;
  float headHalf = HEAD_HALF_H_PX / u.canvasHeight * 2.0;

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
