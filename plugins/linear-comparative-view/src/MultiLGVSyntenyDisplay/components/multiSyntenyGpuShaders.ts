import {
  HP_GLSL_CORE,
  HP_WGSL_CORE,
  PICKING_FS_WGSL,
} from '@jbrowse/alignments-core'

// SYNC: instance struct field order must match InstanceBuilder usage
// in multiSyntenyGpuData.ts. 32 bytes per instance.
export const INSTANCE_BYTE_SIZE = 32

// Coverage bin: 8 bytes per bin (position: f32, depth: f32)
export const COVERAGE_BIN_BYTE_SIZE = 8

// SYNC: uniform field order must match writeUniforms() in the renderers
export const UNIFORM_BYTE_SIZE = 64

// Shared GLSL uniform block used by both synteny and coverage shaders
const UNIFORMS_GLSL = `
// SYNC: field order must match writeUniforms() in WebGLMultiSyntenyRenderer
layout(std140) uniform Uniforms {
  float resolutionX;
  float resolutionY;
  float rowHeight;
  float coverageHeight;       // height in pixels for coverage area (0 = no coverage)
  float bpRangeHi;
  float bpRangeLo;
  float bpRangeLen;
  float regionScreenLeft;
  float regionScreenWidth;
  float hpZero;               // must be 0.0 at runtime — compiler guard
  float rowPadding;
  float coverageYOffset;      // padding at top/bottom for scalebar labels
  float depthScale;           // maxDepth / nicedMax correction
  float _pad3;
  float _pad4;
  float _pad5;
} u;
`

export const FILL_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

// Per-instance data (divisor = 1)
in uvec4 a_data0;  // (startBp, endBp, genomeRow, featureId)
in vec4 a_color;    // (r, g, b, a)

${UNIFORMS_GLSL}

smooth out vec4 v_color;
flat out float v_featureId;

${HP_GLSL_CORE}

void main() {
  uint startBp = a_data0.x;
  uint endBp = a_data0.y;
  uint genomeRow = a_data0.z;

  vec2 splitStart = hpSplitUint(startBp);
  vec2 splitEnd = hpSplitUint(endBp);

  vec3 bpRange = vec3(u.bpRangeHi, u.bpRangeLo, u.bpRangeLen);
  float t1 = hpScaleLinear(splitStart, bpRange, u.hpZero);
  float t2 = hpScaleLinear(splitEnd, bpRange, u.hpZero);

  float px1 = u.regionScreenLeft + t1 * u.regionScreenWidth;
  float px2 = u.regionScreenLeft + t2 * u.regionScreenWidth;

  // Ensure minimum 1px width so sub-pixel features don't flicker during pan/zoom
  px2 = max(px2, px1 + 1.0);

  // Cull off-screen features
  if (px2 < 0.0 || px1 > u.resolutionX) {
    gl_Position = vec4(0.0);
    return;
  }

  // Clamp to left edge
  px1 = max(px1, 0.0);

  float pad = u.rowPadding;
  float y1 = u.coverageHeight + float(genomeRow) * u.rowHeight + pad;
  float y2 = y1 + u.rowHeight - pad * 2.0;

  uint vid = uint(gl_VertexID) % 6u;
  float x, y;
  switch (vid) {
    case 0u: x = px1; y = y1; break;
    case 1u: x = px2; y = y1; break;
    case 2u: x = px1; y = y2; break;
    case 3u: x = px1; y = y2; break;
    case 4u: x = px2; y = y1; break;
    case 5u: x = px2; y = y2; break;
    default: x = 0.0; y = 0.0; break;
  }

  vec2 clipPos = vec2(x, y) / vec2(u.resolutionX, u.resolutionY) * 2.0 - 1.0;
  gl_Position = vec4(clipPos.x, -clipPos.y, 0.0, 1.0);
  v_color = a_color;
  v_featureId = float(a_data0.w);
}
`

// Coverage vertex shader - renders grey bars in the coverage area at the top.
// Each instance is one coverage bin with (position, depth) attributes.
// SYNC: attribute layout matches coverage buffer in multiSyntenyGpuData.ts
export const COVERAGE_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;    // position offset from region start (bp)
in float a_depth;       // normalized depth (0-1, against global max)

${UNIFORMS_GLSL}

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float t1 = a_position / u.bpRangeLen;
  float t2 = (a_position + 1.0) / u.bpRangeLen;
  float px1 = u.regionScreenLeft + t1 * u.regionScreenWidth;
  float px2 = u.regionScreenLeft + t2 * u.regionScreenWidth;

  px2 = max(px2, px1 + 1.0);

  if (px2 < 0.0 || px1 > u.resolutionX) {
    gl_Position = vec4(0.0);
    return;
  }

  float sx = mix(px1, px2, localX);

  float effectiveHeight = u.coverageHeight - 2.0 * u.coverageYOffset;
  float coverageBottom = u.coverageHeight - u.coverageYOffset;
  float barTop = coverageBottom - a_depth * u.depthScale * effectiveHeight;
  float sy = mix(coverageBottom, barTop, localY);

  vec2 clipPos = vec2(sx, sy) / vec2(u.resolutionX, u.resolutionY) * 2.0 - 1.0;
  gl_Position = vec4(clipPos.x, -clipPos.y, 0.0, 1.0);
  v_color = vec4(0.6, 0.6, 0.6, 1.0);
}
`

// --- WGSL shaders for WebGPU ---

// SYNC: struct Instance field order must match InstanceBuilder usage
const INSTANCE_STRUCT_WGSL = `
struct Instance {
  startBp: u32,
  endBp: u32,
  genomeRow: u32,
  featureId: u32,
  color: vec4f,
}
`

// SYNC: struct Uniforms field order must match writeUniforms()
const UNIFORMS_STRUCT_WGSL = `
struct Uniforms {
  resolutionX: f32,
  resolutionY: f32,
  rowHeight: f32,
  coverageHeight: f32,
  bpRangeHi: f32,
  bpRangeLo: f32,
  bpRangeLen: f32,
  regionScreenLeft: f32,
  regionScreenWidth: f32,
  hpZero: f32,
  rowPadding: f32,
  coverageYOffset: f32,
  depthScale: f32,
  _pad3: f32,
  _pad4: f32,
  _pad5: f32,
}
`

export const WGSL_FILL_SHADER = `
${INSTANCE_STRUCT_WGSL}
${UNIFORMS_STRUCT_WGSL}

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
  @location(1) @interpolate(flat) featureId: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<Instance>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

${HP_WGSL_CORE}

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VOut {
  let inst = instances[iid];
  var out: VOut;
  out.color = inst.color;
  out.featureId = f32(inst.featureId);

  let splitStart = hp_split_uint(inst.startBp);
  let splitEnd = hp_split_uint(inst.endBp);

  let bpRange = vec3f(uniforms.bpRangeHi, uniforms.bpRangeLo, uniforms.bpRangeLen);
  let t1 = hp_scale_linear(splitStart, bpRange, uniforms.hpZero);
  let t2 = hp_scale_linear(splitEnd, bpRange, uniforms.hpZero);

  var px1 = uniforms.regionScreenLeft + t1 * uniforms.regionScreenWidth;
  var px2 = uniforms.regionScreenLeft + t2 * uniforms.regionScreenWidth;

  // Ensure minimum 1px width so sub-pixel features don't flicker during pan/zoom
  px2 = max(px2, px1 + 1.0);

  if (px2 < 0.0 || px1 > uniforms.resolutionX) {
    out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
    return out;
  }

  px1 = max(px1, 0.0);

  let pad = uniforms.rowPadding;
  let y1 = uniforms.coverageHeight + f32(inst.genomeRow) * uniforms.rowHeight + pad;
  let y2 = y1 + uniforms.rowHeight - pad * 2.0;

  let v = vid % 6u;
  let x = select(px2, px1, v == 0u || v == 2u || v == 3u);
  let y = select(y2, y1, v == 0u || v == 1u || v == 4u);

  let clipPos = vec2f(x, y) / vec2f(uniforms.resolutionX, uniforms.resolutionY) * 2.0 - 1.0;
  out.pos = vec4f(clipPos.x, -clipPos.y, 0.0, 1.0);
  return out;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4f {
  return in.color;
}

${PICKING_FS_WGSL}
`

// WGSL coverage shader
export const WGSL_COVERAGE_SHADER = `
${UNIFORMS_STRUCT_WGSL}

struct CovBin {
  position: f32,
  depth: f32,
}

struct CovVOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
}

@group(0) @binding(0) var<storage, read> bins: array<CovBin>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> CovVOut {
  let bin = bins[iid];
  var out: CovVOut;
  out.color = vec4f(0.6, 0.6, 0.6, 1.0);

  let v = vid % 6u;
  let localX = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let localY = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);

  let t1 = bin.position / uniforms.bpRangeLen;
  let t2 = (bin.position + 1.0) / uniforms.bpRangeLen;
  var px1 = uniforms.regionScreenLeft + t1 * uniforms.regionScreenWidth;
  var px2 = uniforms.regionScreenLeft + t2 * uniforms.regionScreenWidth;
  px2 = max(px2, px1 + 1.0);

  if (px2 < 0.0 || px1 > uniforms.resolutionX) {
    out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
    return out;
  }

  let sx = mix(px1, px2, localX);
  let effectiveHeight = uniforms.coverageHeight - 2.0 * uniforms.coverageYOffset;
  let coverageBottom = uniforms.coverageHeight - uniforms.coverageYOffset;
  let barTop = coverageBottom - bin.depth * uniforms.depthScale * effectiveHeight;
  let sy = mix(coverageBottom, barTop, localY);

  let clipPos = vec2f(sx, sy) / vec2f(uniforms.resolutionX, uniforms.resolutionY) * 2.0 - 1.0;
  out.pos = vec4f(clipPos.x, -clipPos.y, 0.0, 1.0);
  return out;
}

@fragment
fn fs_main(in: CovVOut) -> @location(0) vec4f {
  return in.color;
}
`

export {
  PICKING_FS_GLSL as PICKING_FRAGMENT_SHADER,
  SIMPLE_FS_GLSL as FILL_FRAGMENT_SHADER,
} from '@jbrowse/alignments-core'
