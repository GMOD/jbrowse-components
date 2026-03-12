export const INSTANCE_STRIDE = 6

export function interleaveLDInstances(data: {
  positions: Float32Array
  cellSizes: Float32Array
  ldValues: Float32Array
  numCells: number
}) {
  const count = data.numCells
  const buf = new ArrayBuffer(count * INSTANCE_STRIDE * 4)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    const off = i * INSTANCE_STRIDE
    f32[off] = data.positions[i * 2]!
    f32[off + 1] = data.positions[i * 2 + 1]!
    f32[off + 2] = data.cellSizes[i * 2]!
    f32[off + 3] = data.cellSizes[i * 2 + 1]!
    f32[off + 4] = data.ldValues[i]!
    // f32[off + 5] is padding for struct alignment
  }
  return buf
}

export const ldShader = /* wgsl */ `
struct LDInstance {
  position: vec2f,
  cell_size: vec2f,
  ld_value: f32,
}

struct Uniforms {
  canvas_size: vec2f,
  y_scalar: f32,
  view_scale: f32,
  view_offset_x: f32,
  signed_ld: u32,
}

@group(0) @binding(0) var<storage, read> instances: array<LDInstance>;
@group(0) @binding(1) var<uniform> u: Uniforms;
@group(0) @binding(2) var color_ramp: texture_2d<f32>;
@group(0) @binding(3) var ramp_sampler: sampler;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) ld_value: f32,
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
  let pos = inst.position + vec2f(lx, ly) * inst.cell_size;

  let c = 0.7071067811865476;
  let rx = (pos.x + pos.y) * c;
  let ry = (-pos.x + pos.y) * c;

  let sx = rx * u.view_scale + u.view_offset_x;
  let sy = ry * u.view_scale * u.y_scalar;

  let clip_x = (sx / u.canvas_size.x) * 2.0 - 1.0;
  let clip_y = 1.0 - (sy / u.canvas_size.y) * 2.0;

  var out: VertexOutput;
  out.position = vec4f(clip_x, clip_y, 0.0, 1.0);
  out.ld_value = inst.ld_value;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  var t: f32;
  if u.signed_ld == 1u {
    t = (in.ld_value + 1.0) / 2.0;
  } else {
    t = in.ld_value;
  }
  t = clamp(t, 0.0, 1.0);
  let color = textureSampleLevel(color_ramp, ramp_sampler, vec2f(t, 0.5), 0.0);
  return vec4f(color.rgb * color.a, color.a);
}
`
