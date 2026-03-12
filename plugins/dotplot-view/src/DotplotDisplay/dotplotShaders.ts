export const INSTANCE_BYTE_SIZE = 48

export const VERTS_PER_INSTANCE = 6

const INSTANCE_STRUCT = /* wgsl */ `
struct Instance {
  x1: f32, y1: f32, x2: f32, y2: f32,
  color: vec4f,
  _pad1: f32, _pad2: f32, _pad3: f32, _pad4: f32,
}
`

const UNIFORMS_STRUCT = /* wgsl */ `
struct Uniforms {
  resolution: vec2f,
  offsetX: f32,
  offsetY: f32,
  lineWidth: f32,
  scaleX: f32,
  scaleY: f32,
  _pad: f32,
}
`

export const dotplotShader = /* wgsl */ `
${INSTANCE_STRUCT}
${UNIFORMS_STRUCT}

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
  @location(1) dist: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<Instance>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VOut {
  let inst = instances[iid];

  var out: VOut;
  out.color = inst.color;
  out.dist = 0.0;

  let sx1 = inst.x1 * uniforms.scaleX - uniforms.offsetX;
  let sy1 = uniforms.resolution.y - (inst.y1 * uniforms.scaleY - uniforms.offsetY);
  let sx2 = inst.x2 * uniforms.scaleX - uniforms.offsetX;
  let sy2 = uniforms.resolution.y - (inst.y2 * uniforms.scaleY - uniforms.offsetY);

  let templateT = array<f32, 6>(0.0, 0.0, 1.0, 1.0, 0.0, 1.0);
  let templateSide = array<f32, 6>(-1.0, 1.0, -1.0, -1.0, 1.0, 1.0);

  let t = templateT[vid];
  let side = templateSide[vid];

  let x = mix(sx1, sx2, t);
  let y = mix(sy1, sy2, t);

  let dx = sx2 - sx1;
  let dy = sy2 - sy1;
  let len = sqrt(dx * dx + dy * dy);
  var normal: vec2f;
  if (len > 0.001) {
    let dirX = dx / len;
    let dirY = dy / len;
    normal = vec2f(-dirY, dirX);
  } else {
    normal = vec2f(0.0, 1.0);
  }

  let pos = vec2f(x, y) + normal * side * uniforms.lineWidth * 0.5;
  let clipSpace = (pos / uniforms.resolution) * 2.0 - 1.0;

  out.pos = vec4f(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  out.dist = side;
  return out;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4f {
  let d = abs(in.dist);
  let aa = fwidth(in.dist);
  let edgeAlpha = 1.0 - smoothstep(0.5 - aa * 0.5, 0.5 + aa, d);
  let finalAlpha = in.color.a * edgeAlpha;
  return vec4f(in.color.rgb * finalAlpha, finalAlpha);
}
`
