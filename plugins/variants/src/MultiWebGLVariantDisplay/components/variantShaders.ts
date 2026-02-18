export const INSTANCE_STRIDE = 8

export function interleaveVariantInstances(data: {
  cellPositions: Uint32Array
  cellRowIndices: Uint32Array
  cellColors: Uint8Array
  cellShapeTypes: Uint8Array
  numCells: number
}) {
  const count = data.numCells
  const buf = new ArrayBuffer(count * INSTANCE_STRIDE * 4)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    const off = i * INSTANCE_STRIDE
    u32[off] = data.cellPositions[i * 2]!
    u32[off + 1] = data.cellPositions[i * 2 + 1]!
    u32[off + 2] = data.cellRowIndices[i]!
    u32[off + 3] = data.cellShapeTypes[i]!
    f32[off + 4] = data.cellColors[i * 4]! / 255
    f32[off + 5] = data.cellColors[i * 4 + 1]! / 255
    f32[off + 6] = data.cellColors[i * 4 + 2]! / 255
    f32[off + 7] = data.cellColors[i * 4 + 3]! / 255
  }
  return buf
}

export const variantShader = /* wgsl */ `
const HP_LOW_MASK: u32 = 0xFFFu;

fn hp_split_uint(value: u32) -> vec2f {
  let lo = value & HP_LOW_MASK;
  let hi = value - lo;
  return vec2f(f32(hi), f32(lo));
}

fn hp_to_clip_x(split_pos: vec2f, bp_range: vec3f) -> f32 {
  let hi = split_pos.x - bp_range.x;
  let lo = split_pos.y - bp_range.y;
  return (hi + lo) / bp_range.z * 2.0 - 1.0;
}

struct CellInstance {
  start_end: vec2u,
  row_index: u32,
  shape_type: u32,
  color: vec4f,
}

struct Uniforms {
  bp_range_x: vec3f,
  region_start: u32,
  canvas_height: f32,
  canvas_width: f32,
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

  let abs_start = inst.start_end.x + u.region_start;
  let abs_end = inst.start_end.y + u.region_start;
  let split_start = hp_split_uint(abs_start);
  let split_end = hp_split_uint(abs_end);
  let clip_x1 = hp_to_clip_x(split_start, u.bp_range_x);
  let clip_x2 = hp_to_clip_x(split_end, u.bp_range_x);

  let px_size = 2.0 / u.canvas_width;
  var cx1 = floor(clip_x1 / px_size + 0.5) * px_size;
  var cx2 = floor(clip_x2 / px_size + 0.5) * px_size;
  if cx2 - cx1 < 2.0 * px_size {
    cx2 = cx1 + 2.0 * px_size;
  }

  let y_top_px = f32(inst.row_index) * u.row_height - u.scroll_top;
  let y_bot_px = y_top_px + u.row_height;
  let y_top = floor(y_top_px + 0.5);
  let y_bot = floor(y_bot_px + 0.5);
  let y_mid = (y_top + y_bot) * 0.5;
  let px_to_clip_y = 2.0 / u.canvas_height;
  let cy_top = 1.0 - y_top * px_to_clip_y;
  let cy_bot = 1.0 - y_bot * px_to_clip_y;
  let cy_mid = 1.0 - y_mid * px_to_clip_y;
  let x_mid = (cx1 + cx2) * 0.5;

  var sx: f32;
  var sy: f32;

  if inst.shape_type == 0u {
    let lx = select(1.0, 0.0, vid == 0u || vid == 2u || vid == 3u);
    let ly = select(1.0, 0.0, vid == 0u || vid == 1u || vid == 4u);
    sx = mix(cx1, cx2, lx);
    sy = mix(cy_bot, cy_top, ly);
  } else if inst.shape_type == 1u {
    switch vid {
      case 0u: { sx = cx1; sy = cy_top; }
      case 1u: { sx = cx1; sy = cy_bot; }
      default: { sx = cx2; sy = cy_mid; }
    }
  } else if inst.shape_type == 2u {
    switch vid {
      case 0u: { sx = cx2; sy = cy_top; }
      case 1u: { sx = cx2; sy = cy_bot; }
      default: { sx = cx1; sy = cy_mid; }
    }
  } else {
    let width_extend = 6.0 / u.canvas_width;
    switch vid {
      case 0u: { sx = cx1 - width_extend; sy = cy_top; }
      case 1u: { sx = cx2 + width_extend; sy = cy_top; }
      default: { sx = x_mid; sy = cy_bot; }
    }
  }

  var out: VertexOutput;
  out.position = vec4f(sx, sy, 0.0, 1.0);
  out.color = inst.color;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return vec4f(in.color.rgb * in.color.a, in.color.a);
}
`
