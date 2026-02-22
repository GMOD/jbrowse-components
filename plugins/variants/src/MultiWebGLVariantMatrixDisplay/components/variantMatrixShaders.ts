export const MATRIX_INSTANCE_STRIDE = 8

export function interleaveMatrixInstances(data: {
  cellFeatureIndices: Float32Array
  cellRowIndices: Uint32Array
  cellColors: Uint8Array
  numCells: number
}) {
  const count = data.numCells
  const buf = new ArrayBuffer(count * MATRIX_INSTANCE_STRIDE * 4)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    const off = i * MATRIX_INSTANCE_STRIDE
    f32[off] = data.cellFeatureIndices[i]!
    u32[off + 1] = data.cellRowIndices[i]!
    f32[off + 4] = data.cellColors[i * 4]! / 255
    f32[off + 5] = data.cellColors[i * 4 + 1]! / 255
    f32[off + 6] = data.cellColors[i * 4 + 2]! / 255
    f32[off + 7] = data.cellColors[i * 4 + 3]! / 255
  }
  return buf
}

export const variantMatrixShader = /* wgsl */ `
struct CellInstance {
  feature_index: f32,
  row_index: u32,
  _pad0: u32,
  _pad1: u32,
  color: vec4f,
}

struct Uniforms {
  num_features: f32,
  canvas_width: f32,
  canvas_height: f32,
  row_height: f32,
  scroll_top: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<CellInstance>;
@group(0) @binding(1) var<uniform> u: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs_main(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32,
) -> VertexOutput {
  let inst = instances[instance_index];
  let vid = vertex_index % 6u;
  let lx = select(1.0, 0.0, vid == 0u || vid == 2u || vid == 3u);
  let ly = select(1.0, 0.0, vid == 0u || vid == 1u || vid == 4u);

  let x1 = inst.feature_index / u.num_features;
  let x2 = (inst.feature_index + 1.0) / u.num_features;
  let px_size_x = 1.0 / u.canvas_width;
  var cx1 = floor(x1 / px_size_x + 0.5) * px_size_x;
  var cx2 = floor(x2 / px_size_x + 0.5) * px_size_x;
  if cx2 - cx1 < px_size_x {
    cx2 = cx1 + px_size_x;
  }
  let clip_x = mix(cx1, cx2, lx) * 2.0 - 1.0;

  let y_top_px = f32(inst.row_index) * u.row_height - u.scroll_top;
  let y_top = floor(y_top_px + 0.5);
  var y_bot = floor(y_top_px + u.row_height + 0.5);
  if y_bot - y_top < 1.0 {
    y_bot = y_top + 1.0;
  }
  let px_to_clip_y = 2.0 / u.canvas_height;
  let clip_y = mix(1.0 - y_bot * px_to_clip_y, 1.0 - y_top * px_to_clip_y, ly);

  var out: VertexOutput;
  out.position = vec4f(clip_x, clip_y, 0.0, 1.0);
  out.color = inst.color;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return vec4f(in.color.rgb * in.color.a, in.color.a);
}
`
