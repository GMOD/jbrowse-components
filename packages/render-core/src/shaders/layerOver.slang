// Composites a `union` pass's layer into the frame, source-over at the pass's
// place in draw order. The layer is the canvas's own size, so each fragment
// samples the texel under it, at its centre, through a nearest filter; the HAL
// draws one full-canvas triangle under the pass's scissor. The layer holds
// premultiplied color, as the union pass's max blend left it.
//
// The one instance carries the layer's size in device px, which turns a
// fragment's position into the texel's coordinate. `Load` would need no size,
// and slangc emits WGSL Tint rejects for it on a combined sampler.
//! targets: wgsl, glsl
//! blend: premultiplied
//! texture-filter: nearest

public static const uint VERTS_PER_INSTANCE = 3u;

struct LayerInstance {
  float2 sizePx : ATTR0;
};

struct Uniforms {
  float unused;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;
[[vk::binding(2, 0)]] Sampler2D<float4> layer;

struct VsOut {
  float4 position : SV_Position;
  float2 sizePx   : TEXCOORD0;
};

[shader("vertex")]
VsOut vs_main(LayerInstance inst, uint vid : SV_VertexID) {
  float2 corner = float2(float((vid << 1u) & 2u), float(vid & 2u));
  VsOut o;
  o.position = float4(corner * 2.0 - 1.0, 0.0, 1.0);
  o.sizePx = inst.sizePx;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut v) : SV_Target {
  return layer.SampleLevel(v.position.xy / v.sizePx, 0.0);
}
