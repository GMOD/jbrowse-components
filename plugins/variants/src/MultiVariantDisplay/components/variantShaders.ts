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

fn hp_to_clip_x(split_pos: vec2f, bp_range: vec3f, zero: f32) -> f32 {
  let inf = 1.0 / zero;
  let step = 2.0 / bp_range.z;
  let hi = max(split_pos.x - bp_range.x, -inf);
  let lo = max(split_pos.y - bp_range.y, -inf);
  return dot(vec3f(-1.0, hi, lo), vec3f(1.0, step, step));
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
  zero: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<CellInstance>;
@group(0) @binding(1) var<uniform> u: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
  @location(1) local_px: vec2f,
  @location(2) @interpolate(flat) size_px: vec2f,
  @location(3) @interpolate(flat) shape_type_f: u32,
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
  let clip_x1 = hp_to_clip_x(split_start, u.bp_range_x, u.zero);
  let clip_x2 = hp_to_clip_x(split_end, u.bp_range_x, u.zero);

  let px_size = 2.0 / u.canvas_width;
  var cx1 = floor(clip_x1 / px_size + 0.5) * px_size;
  var cx2 = floor(clip_x2 / px_size + 0.5) * px_size;
  if cx2 - cx1 < 2.0 * px_size {
    cx2 = cx1 + 2.0 * px_size;
  }

  let y_top_px = f32(inst.row_index) * u.row_height - u.scroll_top;
  let y_top = floor(y_top_px + 0.5);
  var y_bot = floor(y_top_px + u.row_height + 0.5);
  if y_bot - y_top < 1.0 {
    y_bot = y_top + 1.0;
  }
  let px_to_clip_y = 2.0 / u.canvas_height;
  let cy_top = 1.0 - y_top * px_to_clip_y;
  let cy_bot = 1.0 - y_bot * px_to_clip_y;

  // SDF anti-aliasing: always emit a bounding-box quad, use fragment shader SDF for triangles
  let lx = select(1.0, 0.0, vid == 0u || vid == 2u || vid == 3u);
  let ly = select(1.0, 0.0, vid == 0u || vid == 1u || vid == 4u);

  var x_left = cx1;
  var x_right = cx2;
  if inst.shape_type == 3u {
    let width_extend = 6.0 / u.canvas_width;
    x_left -= width_extend;
    x_right += width_extend;
  }

  let w_px = (x_right - x_left) * u.canvas_width * 0.5;
  let h_px = (cy_top - cy_bot) * u.canvas_height * 0.5;

  var out: VertexOutput;
  out.position = vec4f(mix(x_left, x_right, lx), mix(cy_bot, cy_top, ly), 0.0, 1.0);
  out.color = inst.color;
  out.local_px = vec2f(lx * w_px, (1.0 - ly) * h_px);
  out.size_px = vec2f(w_px, h_px);
  out.shape_type_f = inst.shape_type;
  return out;
}

fn tri_sdf_right(p: vec2f, w: f32, h: f32) -> f32 {
  let d_left = p.x;
  let hyp = sqrt(h * h * 0.25 + w * w);
  let d_top = (-0.5 * h * p.x + w * p.y) / hyp;
  let d_bot = (-0.5 * h * p.x - w * (p.y - h)) / hyp;
  return min(min(d_left, d_top), d_bot);
}

fn tri_sdf_down(p: vec2f, w: f32, h: f32) -> f32 {
  let d_top = p.y;
  let hyp = sqrt(h * h + w * w * 0.25);
  let d_left = (h * p.x - 0.5 * w * p.y) / hyp;
  let d_right = (w * h - h * p.x - 0.5 * w * p.y) / hyp;
  return min(min(d_top, d_left), d_right);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  var alpha = in.color.a;

  if in.shape_type_f != 0u {
    var d: f32;
    let w = in.size_px.x;
    let h = in.size_px.y;

    if in.shape_type_f == 1u {
      d = tri_sdf_right(in.local_px, w, h);
    } else if in.shape_type_f == 2u {
      d = tri_sdf_right(vec2f(w - in.local_px.x, in.local_px.y), w, h);
    } else {
      d = tri_sdf_down(in.local_px, w, h);
    }

    alpha *= smoothstep(-0.5, 0.5, d);
    alpha *= smoothstep(0.0, 3.0, min(w, h));
  }

  return vec4f(in.color.rgb * alpha, alpha);
}
`
