export const INSTANCE_BYTE_SIZE = 32
export const UNIFORM_BYTE_SIZE = 32
export const VERTS_PER_INSTANCE = 6

// GLSL vertex shader — uses UBO and gl_VertexID for template
export const DOTPLOT_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_x1;
in float a_y1;
in float a_x2;
in float a_y2;
in uint a_color;

layout(std140) uniform Uniforms {
  vec2 resolution;
  float offsetX;
  float offsetY;
  float lineWidth;
  float scaleX;
  float scaleY;
  float _pad;
} u;

out vec4 v_color;
out float v_dist;

void main() {
  float templateT[6] = float[6](0.0, 0.0, 1.0, 1.0, 0.0, 1.0);
  float templateSide[6] = float[6](-1.0, 1.0, -1.0, -1.0, 1.0, 1.0);

  int vid = gl_VertexID % 6;
  float t = templateT[vid];
  float side = templateSide[vid];

  float sx1 = a_x1 * u.scaleX - u.offsetX;
  float sy1 = u.resolution.y - (a_y1 * u.scaleY - u.offsetY);
  float sx2 = a_x2 * u.scaleX - u.offsetX;
  float sy2 = u.resolution.y - (a_y2 * u.scaleY - u.offsetY);

  float x = mix(sx1, sx2, t);
  float y = mix(sy1, sy2, t);

  vec2 dir = vec2(sx2 - sx1, sy2 - sy1);
  float len = length(dir);
  vec2 normal;
  if (len > 0.001) {
    dir /= len;
    normal = vec2(-dir.y, dir.x);
  } else {
    normal = vec2(0.0, 1.0);
  }

  vec2 pos = vec2(x, y) + normal * side * u.lineWidth * 0.5;
  vec2 clipSpace = (pos / u.resolution) * 2.0 - 1.0;
  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  v_color = vec4(
    float(a_color & 0xFFu),
    float((a_color >> 8u) & 0xFFu),
    float((a_color >> 16u) & 0xFFu),
    float(a_color >> 24u)
  ) / 255.0;
  v_dist = side;
}
`

export const DOTPLOT_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec4 v_color;
in float v_dist;

out vec4 fragColor;

void main() {
  float d = abs(v_dist);
  float aa = fwidth(v_dist);
  float edgeAlpha = 1.0 - smoothstep(0.5 - aa * 0.5, 0.5 + aa, d);
  float finalAlpha = v_color.a * edgeAlpha;
  fragColor = vec4(v_color.rgb * finalAlpha, finalAlpha);
}
`

// WGSL shader (unchanged)
export const dotplotShader = `
struct Instance {
  x1: f32, y1: f32, x2: f32, y2: f32,
  color: u32,
  _pad1: u32, _pad2: u32, _pad3: u32,
}

struct Uniforms {
  resolution: vec2f,
  offsetX: f32,
  offsetY: f32,
  lineWidth: f32,
  scaleX: f32,
  scaleY: f32,
  _pad: f32,
}

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
  out.color = unpack4x8unorm(inst.color);
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
