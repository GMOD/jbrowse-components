// The circular view's coordinate stage: one instance is an annulus that samples
// a linear display's finished strip in polar coordinates. The strip's x runs
// around the ring and its y runs inward from the outer rim, so a display draws
// on the circle without knowing it — every shape, painter and hit test it has
// is the linear one, and the ring is a resampling of the picture they made.
//
// The annulus is a fan of RING_SEGMENTS quads rather than one bounding box, so
// the fragment stage runs over little more than the ring's own area: with
// several rings on one canvas that is the difference between the sum of their
// areas and several times the square of the outer radius. The outer polygon
// circumscribes the outer rim and the inner one is inscribed in the inner rim,
// with a device pixel of margin, so the analytic coverage at both rims is what
// decides a pixel and the mesh never clips it.
//
// Both rims fade over one device pixel of radius, measured per fragment, which
// is why this pass declares `coverage: analytic`. The strip lands premultiplied
// (a canvas source is copied that way on both HALs), so the sample is returned
// as premultiplied colour.
//! targets: wgsl, glsl
//! blend: premultiplied
//! coverage: analytic

import hpmath;

public static const uint RING_SEGMENTS = 64u;
public static const uint VERTS_PER_INSTANCE = RING_SEGMENTS * 6u;
static const float TWO_PI = 6.283185307179586;

struct RingInstance {
  // CSS px, from the circle's centre
  float innerPx : ATTR0;
  float outerPx : ATTR1;
};

struct Uniforms {
  // the circle's centre in the canvas's CSS px frame
  float centerX;
  float centerY;
  float canvasWidth;
  float canvasHeight;
  // where strip x = 0 sits, in radians clockwise from the +x axis
  float offsetRadians;
  float devicePixelRatio;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;
[[vk::binding(2, 0)]] Sampler2D<float4> strip;

struct VsOut {
  float4 position     : SV_Position;
  // device px from the centre, y down — carried from the vertex stage rather
  // than read off the framebuffer position, whose y runs the other way on GLSL
  float2 fromCenterPx : TEXCOORD0;
  // device px: inner and outer rim
  float2 radiiPx      : TEXCOORD1;
};

[shader("vertex")]
VsOut vs_main(RingInstance inst, uint vid : SV_VertexID) {
  uint seg = (vid / 6u) % RING_SEGMENTS;
  float2 q = quadLocal(vid);
  float step = TWO_PI / float(RING_SEGMENTS);
  float a = (float(seg) + q.x) * step;
  float dpr = u.devicePixelRatio;
  float inner = inst.innerPx * dpr;
  float outer = inst.outerPx * dpr;
  float rOut = (outer + 1.0) / cos(step * 0.5);
  float rIn = max(inner - 1.0, 0.0);
  float2 p = lerp(rIn, rOut, q.y) * float2(cos(a), sin(a));
  float2 css = float2(u.centerX, u.centerY) + p / dpr;

  VsOut o;
  o.position = float4(
    css.x / u.canvasWidth * 2.0 - 1.0,
    1.0 - css.y / u.canvasHeight * 2.0,
    0.0,
    1.0);
  o.fromCenterPx = p;
  o.radiiPx = float2(inner, outer);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut v) : SV_Target {
  float r = length(v.fromCenterPx);
  float inner = v.radiiPx.x;
  float outer = v.radiiPx.y;
  float cov = clamp(outer - r + 0.5, 0.0, 1.0) * clamp(r - inner + 0.5, 0.0, 1.0);
  if (cov <= 0.0) discard;
  float a = atan2(v.fromCenterPx.y, v.fromCenterPx.x) - u.offsetRadians;
  a -= floor(a / TWO_PI) * TWO_PI;
  float2 uv = float2(a / TWO_PI, (outer - r) / (outer - inner));
  return strip.SampleLevel(uv, 0.0) * cov;
}
