

public static const uint VERTS_PER_INSTANCE = 6u;
// Dotplot line segment renderer. Each instance is a line from (x1,y1) to
// (x2,y2) in data space; the shader expands it into a screen-space quad of
// thickness `lineWidth` pixels with smoothstep-based edge antialiasing.
//
// Colors are pre-packed ABGR u32 on the CPU side
// (dotplotWebGLColors.ts#packColor). Blend uses premultiplied alpha
// (one / one-minus-src-alpha).
//! targets: wgsl, glsl

static const uint VERTICES_PER_INSTANCE = 6u;

float4 unpackRGBA(uint c) {
  return float4(
    float((c >>  0u) & 0xFFu),
    float((c >>  8u) & 0xFFu),
    float((c >> 16u) & 0xFFu),
    float((c >> 24u) & 0xFFu)) / 255.0;
}

struct DotplotInstance {
  float x1    : ATTR0;
  float y1    : ATTR1;
  float x2    : ATTR2;
  float y2    : ATTR3;
  uint  color : ATTR4;
};

struct Uniforms {
  float2 resolution;
  float  offsetX;
  float  offsetY;
  float  lineWidth;
  float  scaleX;
  float  scaleY;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float  edge     : COLOR1;
};

[shader("vertex")]
VsOut vs_main(DotplotInstance inst, uint vid : SV_VertexID) {
  uint v = vid % VERTICES_PER_INSTANCE;

  // Quad template: pairs (0,1), (2,3), (4,5) form two triangles that cover
  // the thickened line. `t` interpolates along the segment, `side` pushes
  // the vertex to one side of the segment by lineWidth/2.
  // v : 0   1   2   3   4   5
  // t : 0   0   1   1   0   1
  // s :-1  +1  -1  -1  +1  +1
  float t = (v == 2u || v == 3u || v == 5u) ? 1.0 : 0.0;
  float side = (v == 1u || v == 4u || v == 5u) ? 1.0 : -1.0;

  float sx1 = inst.x1 * u.scaleX - u.offsetX;
  float sy1 = u.resolution.y - (inst.y1 * u.scaleY - u.offsetY);
  float sx2 = inst.x2 * u.scaleX - u.offsetX;
  float sy2 = u.resolution.y - (inst.y2 * u.scaleY - u.offsetY);

  float x = lerp(sx1, sx2, t);
  float y = lerp(sy1, sy2, t);

  float dx = sx2 - sx1;
  float dy = sy2 - sy1;
  float len = sqrt(dx * dx + dy * dy);
  float2 normal;
  if (len > 0.001) {
    normal = float2(-dy, dx) / len;
  } else {
    normal = float2(0.0, 1.0);
  }

  float2 pos = float2(x, y) + normal * side * u.lineWidth * 0.5;
  float2 clipSpace = (pos / u.resolution) * 2.0 - 1.0;

  VsOut o;
  o.position = float4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  o.edge = side;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float d = abs(fragIn.edge);
  float aa = fwidth(fragIn.edge);
  float edgeAlpha = 1.0 - smoothstep(0.5 - aa * 0.5, 0.5 + aa, d);
  float finalAlpha = fragIn.color.a * edgeAlpha;
  return float4(fragIn.color.rgb * finalAlpha, finalAlpha);
}
