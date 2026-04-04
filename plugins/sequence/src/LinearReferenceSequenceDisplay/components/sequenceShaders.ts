// Instance stride: 8 floats = 32 bytes per instance
// Layout: [x_bp(f32), y_px(f32), width_bp(f32), height_px(f32),
//          color_r(f32), color_g(f32), color_b(f32), border_flag(f32)]
export const INSTANCE_STRIDE = 8

// Uniform buffer: 8 floats = 32 bytes
// Layout: [basePx, bpPerPx, canvasWidth, canvasHeight, borderWidth, _pad, _pad, _pad]
export const UNIFORM_BYTE_SIZE = 32

export const SEQUENCE_WGSL = /* wgsl */ `
struct RectInstance {
  x_bp: f32,
  y_px: f32,
  width_bp: f32,
  height_px: f32,
  color_r: f32,
  color_g: f32,
  color_b: f32,
  border_flag: f32,
}

struct Uniforms {
  base_px: f32,
  bp_per_px: f32,
  canvas_width: f32,
  canvas_height: f32,
  border_width: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<RectInstance>;
@group(0) @binding(1) var<uniform> u: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
  @location(1) uv: vec2f,
  @location(2) rect_size_px: vec2f,
  @location(3) border_flag: f32,
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VertexOutput {
  let inst = instances[iid];
  let v = vid % 6u;
  let cx = select(0.0, 1.0, v == 1u || v == 4u || v == 5u);
  let cy = select(0.0, 1.0, v == 2u || v == 3u || v == 5u);

  let width_px = max(inst.width_bp / u.bp_per_px, 1.0);
  let x_px = inst.x_bp / u.bp_per_px + u.base_px + cx * width_px;
  let y_px = inst.y_px + cy * inst.height_px;

  let clip_x = (x_px / u.canvas_width) * 2.0 - 1.0;
  let clip_y = 1.0 - (y_px / u.canvas_height) * 2.0;

  var out: VertexOutput;
  out.position = vec4f(clip_x, clip_y, 0.0, 1.0);
  out.color = vec3f(inst.color_r, inst.color_g, inst.color_b);
  out.uv = vec2f(cx, cy);
  out.rect_size_px = vec2f(width_px, inst.height_px);
  out.border_flag = inst.border_flag;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  var color = vec4f(in.color, 1.0);

  if u.border_width > 0.0 && in.border_flag > 0.5 {
    let edge_x = min(in.uv.x * in.rect_size_px.x, (1.0 - in.uv.x) * in.rect_size_px.x);
    let edge_y = min(in.uv.y * in.rect_size_px.y, (1.0 - in.uv.y) * in.rect_size_px.y);
    let edge = min(edge_x, edge_y);
    if edge < u.border_width {
      color = vec4f(0.333, 0.333, 0.333, 1.0);
    }
  }

  return color;
}
`

export const SEQUENCE_VERTEX_SHADER = `#version 300 es
precision highp float;

// SYNC: attribute layout must match INSTANCE_STRIDE and interleaveSequenceInstances()
in vec4 a_rect;        // x_bp, y_px, width_bp, height_px (offset 0)
in vec3 a_color;       // r, g, b as floats 0-1 (offset 16)
in float a_borderFlag; // 0 or 1 (offset 28)

layout(std140) uniform Uniforms {
  float u_basePx;
  float u_bpPerPx;
  float u_canvasWidth;
  float u_canvasHeight;
  float u_borderWidth;
  float _pad0;
  float _pad1;
  float _pad2;
};

out vec3 v_color;
out vec2 v_uv;
out vec2 v_rectSizePx;
out float v_borderFlag;

void main() {
  int vid = gl_VertexID % 6;
  float cx = (vid == 1 || vid == 4 || vid == 5) ? 1.0 : 0.0;
  float cy = (vid == 2 || vid == 3 || vid == 5) ? 1.0 : 0.0;

  float widthPx = max(a_rect.z / u_bpPerPx, 1.0);
  float xPx = a_rect.x / u_bpPerPx + u_basePx + cx * widthPx;
  float yPx = a_rect.y + cy * a_rect.w;

  float clipX = (xPx / u_canvasWidth) * 2.0 - 1.0;
  float clipY = 1.0 - (yPx / u_canvasHeight) * 2.0;

  gl_Position = vec4(clipX, clipY, 0.0, 1.0);
  v_color = a_color;
  v_uv = vec2(cx, cy);
  v_rectSizePx = vec2(widthPx, a_rect.w);
  v_borderFlag = a_borderFlag;
}
`

export const SEQUENCE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

layout(std140) uniform Uniforms {
  float u_basePx;
  float u_bpPerPx;
  float u_canvasWidth;
  float u_canvasHeight;
  float u_borderWidth;
  float _pad0;
  float _pad1;
  float _pad2;
};

in vec3 v_color;
in vec2 v_uv;
in vec2 v_rectSizePx;
in float v_borderFlag;
out vec4 fragColor;

void main() {
  fragColor = vec4(v_color, 1.0);

  if (u_borderWidth > 0.0 && v_borderFlag > 0.5) {
    float edgeX = min(v_uv.x * v_rectSizePx.x, (1.0 - v_uv.x) * v_rectSizePx.x);
    float edgeY = min(v_uv.y * v_rectSizePx.y, (1.0 - v_uv.y) * v_rectSizePx.y);
    float edge = min(edgeX, edgeY);
    if (edge < u_borderWidth) {
      fragColor = vec4(0.333, 0.333, 0.333, 1.0);
    }
  }
}
`

// Interleave separate rect + color buffers into the HAL's single-buffer format.
export function interleaveSequenceInstances(
  rectBuf: Float32Array,
  colorBuf: Uint8Array,
  instanceCount: number,
) {
  const interleaved = new Float32Array(instanceCount * INSTANCE_STRIDE)
  for (let i = 0; i < instanceCount; i++) {
    const ri = i * 4
    const off = i * INSTANCE_STRIDE
    interleaved[off] = rectBuf[ri]!
    interleaved[off + 1] = rectBuf[ri + 1]!
    interleaved[off + 2] = rectBuf[ri + 2]!
    interleaved[off + 3] = rectBuf[ri + 3]!
    interleaved[off + 4] = colorBuf[ri]! / 255
    interleaved[off + 5] = colorBuf[ri + 1]! / 255
    interleaved[off + 6] = colorBuf[ri + 2]! / 255
    interleaved[off + 7] = colorBuf[ri + 3]! > 254 ? 1 : 0
  }
  return interleaved
}
